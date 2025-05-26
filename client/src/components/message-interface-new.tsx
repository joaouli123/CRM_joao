import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, Send, Phone, Clock, User, Search, ChevronDown } from "lucide-react";
import { Connection, Conversation, Message } from "@/lib/api";
import { format, isToday, isYesterday, parseISO } from "date-fns";

interface MessageInterfaceProps {
  connections: Connection[];
  selectedConnectionId: number | null;
  onSelectConnection: (id: number) => void;
}

export default function MessageInterface({ 
  connections, 
  selectedConnectionId, 
  onSelectConnection 
}: MessageInterfaceProps) {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  
  // Multi-instance state management
  const [chatsByInstance, setChatsByInstance] = useState<Record<string, Conversation[]>>({});
  const [messagesByInstance, setMessagesByInstance] = useState<Record<string, Record<string, Message[]>>>({});
  const [skipByInstance, setSkipByInstance] = useState<Record<string, number>>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreChats, setHasMoreChats] = useState<Record<string, boolean>>({});

  // Get current instance info
  const selectedConnection = connections.find(conn => conn.id === selectedConnectionId);
  const instanceKey = selectedConnection ? `${selectedConnection.id}_${selectedConnection.name}` : '';
  
  // Load initial chats for current instance
  const { isLoading: conversationsLoading } = useQuery({
    queryKey: [`/api/connections/${selectedConnectionId}/conversations`, 0],
    queryFn: async () => {
      if (!selectedConnectionId || !instanceKey) return [];
      
      const response = await fetch(`/api/connections/${selectedConnectionId}/conversations?limit=12&skip=0`);
      const chats = await response.json();
      
      // Initialize chats for this instance
      setChatsByInstance(prev => ({
        ...prev,
        [instanceKey]: chats
      }));
      
      // Initialize skip counter
      setSkipByInstance(prev => ({
        ...prev,
        [instanceKey]: 0
      }));
      
      // Check if there are more chats
      setHasMoreChats(prev => ({
        ...prev,
        [instanceKey]: chats.length === 12
      }));
      
      console.log(`✅ ${chats.length} contatos carregados para instância ${instanceKey}`);
      return chats;
    },
    enabled: !!selectedConnectionId && !!instanceKey,
  });

  // Load more chats for current instance
  const loadMoreChats = async () => {
    if (!selectedConnectionId || !instanceKey || loadingMore) return;
    
    setLoadingMore(true);
    try {
      const currentSkip = skipByInstance[instanceKey] || 0;
      const newSkip = currentSkip + 12;
      
      const response = await fetch(`/api/connections/${selectedConnectionId}/conversations?limit=12&skip=${newSkip}`);
      const newChats = await response.json();
      
      // Accumulate chats for this instance
      setChatsByInstance(prev => ({
        ...prev,
        [instanceKey]: [...(prev[instanceKey] || []), ...newChats]
      }));
      
      // Update skip for this instance
      setSkipByInstance(prev => ({
        ...prev,
        [instanceKey]: newSkip
      }));
      
      // Check if there are more chats
      setHasMoreChats(prev => ({
        ...prev,
        [instanceKey]: newChats.length === 12
      }));
      
      console.log(`✅ Carregados mais ${newChats.length} contatos para instância ${instanceKey}`);
      
    } catch (error) {
      console.error('Erro ao carregar mais contatos:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Load messages for specific chat on demand
  const loadChatMessages = async (phoneNumber: string) => {
    if (!selectedConnectionId || !instanceKey) return;
    
    try {
      const response = await fetch(`/api/connections/${selectedConnectionId}/conversations/${phoneNumber}/messages`);
      const messages = await response.json();
      
      // Store messages for this instance and chat
      setMessagesByInstance(prev => ({
        ...prev,
        [instanceKey]: {
          ...prev[instanceKey],
          [phoneNumber]: messages
        }
      }));
      
      console.log(`✅ ${messages.length} mensagens carregadas para ${phoneNumber} na instância ${instanceKey}`);
      
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  // Handle conversation selection - load messages on demand
  const handleConversationSelect = (phoneNumber: string) => {
    setSelectedConversation(phoneNumber);
    // Load messages only when chat is opened
    loadChatMessages(phoneNumber);
  };

  // WebSocket for real-time messages per instance
  useEffect(() => {
    if (!selectedConnection || selectedConnection.status !== "connected") return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log(`🔌 WebSocket conectado para instância ${instanceKey}`);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle real-time messages
        if (data.type === "newMessage" && data.data.connectionId === selectedConnectionId) {
          const message = data.data;
          const chatId = message.phoneNumber;
          
          // If this chat is currently open, add message to current view
          if (chatId === selectedConversation && instanceKey) {
            setMessagesByInstance(prev => ({
              ...prev,
              [instanceKey]: {
                ...prev[instanceKey],
                [chatId]: [...(prev[instanceKey]?.[chatId] || []), message]
              }
            }));
          }
          
          // Update chat list preview with new message
          setChatsByInstance(prev => ({
            ...prev,
            [instanceKey]: (prev[instanceKey] || []).map(chat => 
              chat.phoneNumber === chatId 
                ? { ...chat, lastMessage: message.content, lastMessageTime: new Date(message.timestamp) }
                : chat
            )
          }));
          
          console.log(`📨 Nova mensagem em tempo real para ${chatId}: ${message.content}`);
        }
      } catch (error) {
        console.error('Erro ao processar mensagem WebSocket:', error);
      }
    };

    socket.onclose = () => {
      console.log(`🔌 WebSocket desconectado para instância ${instanceKey}`);
    };

    return () => {
      socket.close();
    };
  }, [selectedConnectionId, instanceKey, selectedConversation]);

  // Get conversations for current instance
  const conversations = chatsByInstance[instanceKey] || [];
  const currentMessages = selectedConversation && instanceKey 
    ? messagesByInstance[instanceKey]?.[selectedConversation] || []
    : [];

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conv => 
    conv.contactName?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    conv.phoneNumber.includes(searchFilter)
  );

  // Send message function with immediate UI update
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !selectedConnectionId || !instanceKey) return;

    const messageText = newMessage;
    setNewMessage(''); // Clear input immediately

    // Add message to UI immediately for instant feedback
    const tempMessage = {
      id: Date.now(),
      connectionId: selectedConnectionId,
      direction: "sent" as const,
      phoneNumber: selectedConversation,
      content: messageText,
      status: "pending" as const,
      timestamp: new Date()
    };

    // Update messages immediately in the UI
    setMessagesByInstance(prev => ({
      ...prev,
      [instanceKey]: {
        ...prev[instanceKey],
        [selectedConversation]: [...(prev[instanceKey]?.[selectedConversation] || []), tempMessage]
      }
    }));

    try {
      console.log(`📤 Enviando mensagem para ${selectedConversation}: ${messageText}`);
      
      // Use full backend URL to bypass Vite proxy issues
      const backendUrl = window.location.origin;
      const response = await fetch(`${backendUrl}/api/connections/${selectedConnectionId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedConversation,
          message: messageText
        })
      });

      let result;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        // If response is not JSON, get text for debugging
        const responseText = await response.text();
        console.error(`❌ Resposta não é JSON:`, responseText);
        throw new Error(`Servidor retornou HTML/texto: ${responseText.substring(0, 200)}...`);
      }
      
      if (response.ok) {
        console.log(`✅ Mensagem enviada com sucesso:`, result);
        
        // Update message status to sent
        setMessagesByInstance(prev => ({
          ...prev,
          [instanceKey]: {
            ...prev[instanceKey],
            [selectedConversation]: (prev[instanceKey]?.[selectedConversation] || []).map(msg => 
              msg.id === tempMessage.id ? { ...msg, status: "sent" } : msg
            )
          }
        }));
      } else {
        console.error(`❌ Erro ao enviar mensagem:`, result);
        
        // Remove message from UI if failed
        setMessagesByInstance(prev => ({
          ...prev,
          [instanceKey]: {
            ...prev[instanceKey],
            [selectedConversation]: (prev[instanceKey]?.[selectedConversation] || []).filter(msg => 
              msg.id !== tempMessage.id
            )
          }
        }));
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      
      // Remove message from UI if failed
      setMessagesByInstance(prev => ({
        ...prev,
        [instanceKey]: {
          ...prev[instanceKey],
          [selectedConversation]: (prev[instanceKey]?.[selectedConversation] || []).filter(msg => 
            msg.id !== tempMessage.id
          )
        }
      }));
    }
  };

  const formatTime = (date: Date | string) => {
    const messageDate = typeof date === 'string' ? parseISO(date) : date;
    
    if (isToday(messageDate)) {
      return format(messageDate, 'HH:mm');
    } else if (isYesterday(messageDate)) {
      return 'Ontem';
    } else {
      return format(messageDate, 'dd/MM');
    }
  };

  if (!selectedConnectionId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Sistema de Mensagens WhatsApp</p>
          <p className="text-sm">Selecione uma conexão para começar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Lista de Conversas */}
      <div className="w-1/3 border-r flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Conversas
            {selectedConnection && (
              <Badge variant="outline" className="ml-auto">
                {selectedConnection.name}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>

        {/* Pesquisa */}
        <div className="px-6 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar conversas..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Lista de conversas */}
        <ScrollArea className="flex-1">
          {!selectedConnectionId ? (
            <div className="p-6 text-center text-gray-500">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Selecione uma conexão para ver as conversas</p>
            </div>
          ) : filteredConversations.length === 0 && !conversationsLoading ? (
            <div className="p-6 text-center text-gray-500">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma conversa encontrada</p>
              <p className="text-xs">As conversas aparecerão aqui</p>
            </div>
          ) : (
            <div className="space-y-0">
              {filteredConversations.map((conversation, index) => (
                <button
                  key={conversation.phoneNumber || `conversation-${index}`}
                  onClick={() => handleConversationSelect(conversation.phoneNumber)}
                  className={`w-full p-4 text-left hover:bg-gray-50 border-b border-gray-100 transition-colors ${
                    selectedConversation === conversation.phoneNumber ? 'bg-green-50 border-r-4 border-r-green-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 flex-shrink-0">
                      <AvatarFallback className="bg-gray-200 text-gray-600">
                        <User className="h-6 w-6" />
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {conversation.contactName || conversation.phoneNumber}
                        </h3>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {formatTime(conversation.lastMessageTime)}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600 truncate flex-1">
                          {conversation.lastMessage}
                        </p>
                        {conversation.unreadCount > 0 && (
                          <Badge className="bg-green-500 text-white ml-2 px-2 py-1 text-xs">
                            {conversation.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              
              {/* Botão Carregar Mais */}
              {hasMoreChats[instanceKey] && (
                <div className="p-4">
                  <Button 
                    onClick={loadMoreChats} 
                    disabled={loadingMore}
                    className="w-full"
                    variant="outline"
                  >
                    {loadingMore ? "Carregando..." : "Carregar mais contatos"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Área de Chat */}
      <div className="flex-1 flex flex-col">
        {!selectedConversation ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Nenhuma conversa selecionada</p>
              <p className="text-sm">Clique em uma conversa para começar a conversar</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header do Chat */}
            <div className="p-4 border-b bg-white">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-gray-200 text-gray-600">
                    <User className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {filteredConversations.find(c => c.phoneNumber === selectedConversation)?.contactName || selectedConversation}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {selectedConversation}
                  </p>
                </div>
              </div>
            </div>

            {/* Mensagens */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {currentMessages.map((message, index) => (
                  <div
                    key={message.id || index}
                    className={`flex ${message.direction === 'sent' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-3 py-2 ${
                        message.direction === 'sent'
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.direction === 'sent' ? 'text-green-100' : 'text-gray-500'
                      }`}>
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Input de Mensagem */}
            <div className="p-4 border-t bg-white">
              <div className="flex gap-2">
                <Input
                  placeholder="Digite sua mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  className="flex-1"
                />
                <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}