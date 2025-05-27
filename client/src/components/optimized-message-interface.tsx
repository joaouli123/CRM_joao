import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, Send, User, Search, Archive, MoreVertical, Trash2, VolumeX, Tag, Bell, BellOff } from "lucide-react";
import { Connection, Conversation, Message } from "@/lib/api";
import { format, isToday, isYesterday } from "date-fns";
import ArchivedConversationsSection from "./archived-conversations-section";

interface MessageInterfaceProps {
  connections: Connection[];
  selectedConnectionId: number | null;
  onSelectConnection: (id: number) => void;
}

export default function OptimizedMessageInterface({ 
  connections, 
  selectedConnectionId, 
  onSelectConnection 
}: MessageInterfaceProps) {
  const [selectedConversation, setSelectedConversation] = useState<string>("");
  const [newMessage, setNewMessage] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [realtimeMessages, setRealtimeMessages] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [chatMuted, setChatMuted] = useState(false);
  const [chatTags, setChatTags] = useState<string[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const processedMessageIds = useRef(new Set<string>());

  // WebSocket para mensagens em tempo real
  useEffect(() => {
    if (!selectedConnectionId) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/ws`;
      
      console.log("🔌 Conectando WebSocket em:", wsUrl);
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("WebSocket message received:", data);
          
          if (data.type === 'message' && data.data) {
            const messageHash = `${data.data.content || data.data.body}_${data.data.timestamp}_${data.data.direction}`;
            
            if (!processedMessageIds.current.has(messageHash)) {
              processedMessageIds.current.add(messageHash);
              setRealtimeMessages(prev => [...prev, data.data]);
            }
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      socket.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          console.log("Attempting to reconnect...");
          connectWebSocket();
        }, 1000);
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsConnected(false);
      };
    };

    connectWebSocket();

    return () => {
      if (socket) {
        socket.close();
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [selectedConnectionId]);

  // Fetch conversations
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['conversations', selectedConnectionId],
    queryFn: async () => {
      if (!selectedConnectionId) return [];
      const response = await fetch(`/api/connections/${selectedConnectionId}/conversations`);
      if (!response.ok) throw new Error('Failed to fetch conversations');
      return response.json();
    },
    enabled: !!selectedConnectionId
  });

  // Fetch messages
  const { data: chatMessages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', selectedConnectionId, selectedConversation],
    queryFn: async () => {
      if (!selectedConnectionId || !selectedConversation) return [];
      const response = await fetch(`/api/connections/${selectedConnectionId}/messages/${selectedConversation}`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    enabled: !!selectedConnectionId && !!selectedConversation
  });

  // Combine API messages with real-time messages
  const allMessages = [
    ...(Array.isArray(chatMessages) ? chatMessages : []),
    ...realtimeMessages.filter((rtMsg: any) => 
      rtMsg.from === selectedConversation || rtMsg.to === selectedConversation
    )
  ].sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Filter conversations
  const filteredConversations = conversations.filter((conv: any) =>
    (conv.contactName || conv.phoneNumber).toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Auto scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [allMessages]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, to }: { message: string; to: string }) => {
      const response = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: selectedConnectionId,
          to,
          message
        })
      });
      if (!response.ok) throw new Error('Failed to send message');
      return response.json();
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConnectionId, selectedConversation] });
    }
  });

  // Archive chat function
  const handleArchiveChat = async (phoneNumber: string) => {
    if (!selectedConnectionId) return;
    
    try {
      const response = await fetch(`/api/connections/${selectedConnectionId}/archive-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          archiveReason: 'Arquivado pelo usuário',
          archivedBy: 'Sistema'
        })
      });

      if (response.ok) {
        alert('✅ Conversa arquivada com sucesso!');
        queryClient.invalidateQueries({ queryKey: ['conversations', selectedConnectionId] });
        setSelectedConversation("");
      } else {
        alert('❌ Erro ao arquivar conversa. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao arquivar:', error);
      alert('❌ Erro ao arquivar conversa. Tente novamente.');
    }
  };

  const formatTime = (date: Date) => {
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return 'Ontem';
    } else {
      return format(date, 'dd/MM');
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Conversas */}
      <div className="w-1/3 border-r border-border">
        <Card className="h-full rounded-none border-0">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Conversas</span>
              {isConnected && (
                <Badge variant="outline" className="text-xs">
                  Online
                </Badge>
              )}
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversas..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-200px)]">
              {/* Conversas Ativas */}
              {filteredConversations.map((conv: any) => (
                <div
                  key={conv.phoneNumber}
                  className={`group p-4 border-b hover:bg-muted transition-colors ${
                    selectedConversation === conv.phoneNumber ? 'bg-muted' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setSelectedConversation(conv.phoneNumber)}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">
                          {conv.contactName || conv.phoneNumber}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(new Date(conv.lastMessageTime))}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.lastMessage}
                      </p>
                      {conv.unreadCount > 0 && (
                        <Badge variant="default" className="mt-1">
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchiveChat(conv.phoneNumber);
                      }}
                      className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Arquivar conversa"
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Seção de Conversas Arquivadas */}
              <ArchivedConversationsSection 
                connectionId={selectedConnectionId}
                onChatSelect={(phoneNumber) => setSelectedConversation(phoneNumber)}
              />
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Header do Chat */}
            <Card className="rounded-none border-0 border-b">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">
                        {filteredConversations.find((c: any) => c.phoneNumber === selectedConversation)?.contactName || selectedConversation}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedConversation}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleArchiveChat(selectedConversation)}
                      className="flex items-center space-x-1 text-orange-600 hover:text-orange-700"
                    >
                      <Archive className="h-4 w-4" />
                      <span>Arquivar</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Mensagens */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {allMessages.map((message: any, index: number) => (
                  <div
                    key={`${message.id || index}_${message.timestamp}`}
                    className={`flex ${message.direction === 'sent' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.direction === 'sent'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm">{message.content || message.body}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {formatTime(new Date(message.timestamp))}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input de Mensagem */}
            <Card className="rounded-none border-0 border-t">
              <CardContent className="p-4">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !sendMessageMutation.isPending) {
                        e.preventDefault();
                        if (newMessage.trim()) {
                          sendMessageMutation.mutate({
                            message: newMessage.trim(),
                            to: selectedConversation
                          });
                        }
                      }
                    }}
                    disabled={sendMessageMutation.isPending}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => {
                      if (newMessage.trim()) {
                        sendMessageMutation.mutate({
                          message: newMessage.trim(),
                          to: selectedConversation
                        });
                      }
                    }}
                    disabled={sendMessageMutation.isPending || !newMessage.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="h-full rounded-none border-0">
            <CardContent className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Selecione uma conversa para começar</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}