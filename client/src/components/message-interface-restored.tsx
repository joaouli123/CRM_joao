import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  MessageCircle, 
  Send, 
  User, 
  Search
} from "lucide-react";
import { Connection, Conversation, Message } from "@/lib/api";
import { format, isToday, isYesterday, parseISO } from "date-fns";

interface MessageInterfaceProps {
  connections: Connection[];
  selectedConnectionId: number | null;
  onSelectConnection: (id: number) => void;
}

interface RealtimeMessage {
  id: string;
  content: string;
  phoneNumber: string;
  direction: 'sent' | 'received';
  timestamp: Date;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  tempId?: string;
}

export default function RestoredMessageInterface({ 
  connections, 
  selectedConnectionId, 
  onSelectConnection 
}: MessageInterfaceProps) {
  const [selectedConversation, setSelectedConversation] = useState<string>("");
  const [newMessage, setNewMessage] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [realtimeMessages, setRealtimeMessages] = useState<RealtimeMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const processedMessageIds = useRef(new Set<string>());

  // Fetch conversations for selected connection
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['conversations', selectedConnectionId],
    queryFn: async () => {
      if (!selectedConnectionId) return [];
      const response = await fetch(`/api/connections/${selectedConnectionId}/conversations`);
      if (!response.ok) throw new Error('Failed to fetch conversations');
      return response.json() as Promise<Conversation[]>;
    },
    enabled: !!selectedConnectionId
  });

  // Fetch messages for selected conversation
  const { data: chatMessages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', selectedConnectionId, selectedConversation],
    queryFn: async () => {
      if (!selectedConnectionId || !selectedConversation) return [];
      
      try {
        const response = await fetch(`/api/connections/${selectedConnectionId}/messages/${selectedConversation}`);
        
        if (!response.ok) {
          console.error(`❌ Erro na API de mensagens: ${response.status} ${response.statusText}`);
          return [];
        }
        
        const messages = await response.json();
        return messages as Message[];
      } catch (error) {
        console.error(`❌ Erro ao carregar mensagens:`, error);
        return [];
      }
    },
    enabled: !!selectedConnectionId && !!selectedConversation
  });

  // WebSocket para mensagens em tempo real
  useEffect(() => {
    if (!selectedConnectionId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    
    console.log("🔌 Conectando WebSocket em:", wsUrl);
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WebSocket message received:", data);

        if (data.type === "messageReceived" || data.type === "messageSent") {
          const messageData = data.data;
          
          // Verificar se a mensagem é para a conversa atual
          if (messageData.phoneNumber === selectedConversation || 
              (messageData.from === selectedConversation || messageData.to === selectedConversation)) {
            
            const messageId = `${messageData.content}-${messageData.timestamp}-${messageData.direction}`;
            
            if (!processedMessageIds.current.has(messageId)) {
              processedMessageIds.current.add(messageId);
              
              const newMsg: RealtimeMessage = {
                id: crypto.randomUUID(),
                content: messageData.content || messageData.body,
                phoneNumber: messageData.phoneNumber || messageData.from || messageData.to,
                direction: messageData.direction,
                timestamp: new Date(messageData.timestamp),
                status: messageData.status || 'delivered'
              };

              setRealtimeMessages(prev => {
                const exists = prev.some(msg => 
                  msg.content === newMsg.content && 
                  msg.direction === newMsg.direction &&
                  Math.abs(msg.timestamp.getTime() - newMsg.timestamp.getTime()) < 5000
                );
                
                if (!exists) {
                  return [...prev, newMsg];
                }
                return prev;
              });
            }
          }
        }
      } catch (error) {
        console.error("Erro ao processar mensagem WebSocket:", error);
      }
    };

    socket.onclose = () => {
      console.log("WebSocket disconnected");
      setIsConnected(false);
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsConnected(false);
    };

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [selectedConnectionId, selectedConversation]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, realtimeMessages]);

  // Handle send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConnectionId || !selectedConversation) return;

    const tempId = crypto.randomUUID();
    const tempMessage: RealtimeMessage = {
      id: tempId,
      content: newMessage,
      phoneNumber: selectedConversation,
      direction: 'sent',
      timestamp: new Date(),
      status: 'pending',
      tempId
    };

    // Add temp message immediately
    setRealtimeMessages(prev => [...prev, tempMessage]);
    const messageToSend = newMessage;
    setNewMessage("");

    try {
      const response = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: selectedConnectionId,
          phoneNumber: selectedConversation,
          message: messageToSend
        })
      });

      if (response.ok) {
        // Update temp message status
        setRealtimeMessages(prev => 
          prev.map(msg => 
            msg.tempId === tempId 
              ? { ...msg, status: 'sent' as const }
              : msg
          )
        );
      } else {
        // Update temp message status to failed
        setRealtimeMessages(prev => 
          prev.map(msg => 
            msg.tempId === tempId 
              ? { ...msg, status: 'failed' as const }
              : msg
          )
        );
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      // Update temp message status to failed
      setRealtimeMessages(prev => 
        prev.map(msg => 
          msg.tempId === tempId 
            ? { ...msg, status: 'failed' as const }
            : msg
        )
      );
    }
  };

  const formatMessageTime = (timestamp: Date | string) => {
    const date = typeof timestamp === 'string' ? parseISO(timestamp) : timestamp;
    
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return `Ontem ${format(date, 'HH:mm')}`;
    } else {
      return format(date, 'dd/MM/yyyy HH:mm');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'sent':
        return '✓';
      case 'delivered':
        return '✓✓';
      case 'failed':
        return '❌';
      default:
        return '';
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.contactName.toLowerCase().includes(searchFilter.toLowerCase()) ||
    conv.phoneNumber.includes(searchFilter)
  );

  const allMessages = [
    ...chatMessages.map(msg => ({
      ...msg,
      content: msg.body || msg.content || 'Mensagem sem conteúdo',
      timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
    })),
    ...realtimeMessages.filter(msg => msg.phoneNumber === selectedConversation)
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (!selectedConnectionId) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Selecione uma conexão para ver as conversas</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex">
      {/* Sidebar com conversas */}
      <div className="w-80 border-r bg-muted/50">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-semibold">Conversas</h2>
            <Badge variant="secondary" className="ml-auto">
              {isConnected ? "🟢 Online" : "🔴 Offline"}
            </Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar conversas..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          {conversationsLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Carregando conversas...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              {searchFilter ? "Nenhuma conversa encontrada" : "Nenhuma conversa disponível"}
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <div
                key={conversation.phoneNumber}
                className={`p-3 border-b cursor-pointer hover:bg-accent transition-colors ${
                  selectedConversation === conversation.phoneNumber ? 'bg-accent' : ''
                }`}
                onClick={() => {
                  setSelectedConversation(conversation.phoneNumber);
                  setRealtimeMessages([]);
                }}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      <User className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{conversation.contactName}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {conversation.lastMessage}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {formatMessageTime(conversation.lastMessageTime)}
                    </p>
                    {conversation.unreadCount > 0 && (
                      <Badge variant="default" className="text-xs mt-1">
                        {conversation.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Área de chat */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Header do chat */}
            <div className="p-4 border-b bg-background">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium">
                    {conversations.find(c => c.phoneNumber === selectedConversation)?.contactName || selectedConversation}
                  </h3>
                  <p className="text-sm text-muted-foreground">{selectedConversation}</p>
                </div>
              </div>
            </div>

            {/* Mensagens */}
            <ScrollArea className="flex-1 p-4">
              {messagesLoading ? (
                <div className="text-center text-muted-foreground">
                  Carregando mensagens...
                </div>
              ) : allMessages.length === 0 ? (
                <div className="text-center text-muted-foreground">
                  Nenhuma mensagem encontrada
                </div>
              ) : (
                <div className="space-y-4">
                  {allMessages.map((message, index) => (
                    <div
                      key={`${message.id}-${index}`}
                      className={`flex ${message.direction === 'sent' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          message.direction === 'sent'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <p className="text-xs opacity-70">
                            {formatMessageTime(message.timestamp)}
                          </p>
                          {message.direction === 'sent' && (
                            <span className="text-xs opacity-70">
                              {getStatusIcon(message.status)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input de mensagem */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite uma mensagem..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1"
                />
                <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Selecione uma conversa para começar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}