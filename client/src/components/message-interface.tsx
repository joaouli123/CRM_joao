import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  // Get conversations for current instance
  const conversations = chatsByInstance[instanceKey] || [];
  const currentMessages = selectedConversation && instanceKey 
    ? messagesByInstance[instanceKey]?.[selectedConversation] || []
    : [];

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
    enabled: !!selectedConnectionId && !!selectedConversation,
  });

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conv => {
    if (!conv) return false;
    
    const searchLower = searchFilter.toLowerCase();
    const contactName = conv.contactName || "";
    const phoneNumber = conv.phoneNumber || "";
    const lastMessage = conv.lastMessage || "";
    
    return contactName.toLowerCase().includes(searchLower) ||
           phoneNumber.includes(searchFilter) ||
           lastMessage.toLowerCase().includes(searchLower);
  });

  // Paginate filtered conversations - show 8 per page
  const paginatedConversations = filteredConversations.slice(0, conversationsPage * conversationsPerPage);
  const hasMoreConversations = filteredConversations.length > conversationsPage * conversationsPerPage;

  const formatTime = (date: Date | string) => {
    try {
      const dateObj = typeof date === 'string' ? parseISO(date) : date;
      return format(dateObj, "HH:mm");
    } catch {
      return "";
    }
  };

  const formatConversationDate = (date: Date | string | null | undefined) => {
    try {
      if (!date) return "Agora";
      
      // Se for string, tenta converter para Date
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      
      // Verifica se a data é válida
      if (isNaN(dateObj.getTime())) return "Agora";
      
      if (isToday(dateObj)) return "Hoje";
      if (isYesterday(dateObj)) return "Ontem";
      
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays < 7) {
        const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        return dayNames[dateObj.getDay()];
      }
      return format(dateObj, "dd/MM/yyyy");
    } catch (error) {
      console.log("Erro ao formatar data:", error, "Data recebida:", date);
      return "Agora";
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConnectionId || !selectedConversation) return;
    
    try {
      // TODO: Implement send message API call
      console.log("Enviando mensagem:", {
        connectionId: selectedConnectionId,
        to: selectedConversation,
        message: newMessage
      });
      setNewMessage("");
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Layout tipo WhatsApp Web */}
      <div className="flex w-full max-w-7xl mx-auto bg-white shadow-xl">
        
        {/* Sidebar - Lista de Conversas */}
        <div className="w-80 border-r border-gray-200 flex flex-col">
          {/* Header com seletor de conexão */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-green-600" />
                Mensagens WhatsApp
              </h2>
              
              {/* Seletor de Conexão */}
              <Select
                value={selectedConnectionId?.toString() || ""}
                onValueChange={(value) => {
                  onSelectConnection(parseInt(value));
                  setSelectedConversation(null);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione uma conexão WhatsApp">
                    {selectedConnectionId && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>{connectedConnections.find(c => c.id === selectedConnectionId)?.name}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {connectedConnections.length === 0 ? (
                    <div className="p-3 text-center text-gray-500">
                      <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhuma conexão ativa</p>
                      <p className="text-xs">Conecte um WhatsApp primeiro</p>
                    </div>
                  ) : (
                    connectedConnections.map((connection) => (
                      <SelectItem key={connection.id} value={connection.id.toString()}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <div>
                            <div className="font-medium">{connection.name}</div>
                            <div className="text-xs text-gray-500">
                              {connection.phoneNumber || "WhatsApp Conectado"}
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Campo de busca */}
          {selectedConnectionId && (
            <div className="p-3 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar conversas..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          )}

          {/* Lista de conversas */}
          <ScrollArea className="flex-1">
            {!selectedConnectionId ? (
              <div className="p-6 text-center text-gray-500">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Selecione uma conexão para ver as conversas</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                {searchFilter ? (
                  <>
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma conversa encontrada</p>
                    <p className="text-xs">Tente buscar por outro termo</p>
                  </>
                ) : (
                  <>
                    <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma conversa encontrada</p>
                    <p className="text-xs">As conversas aparecerão aqui</p>
                  </>
                )}
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
                            {formatConversationDate(conversation.lastMessageTime)}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-600 truncate flex-1">
                            {conversation.lastMessage}
                          </p>
                          
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <Badge variant="secondary" className="text-xs px-2 py-0">
                              {conversation.messageCount || 1}
                            </Badge>
                            {conversation.unreadCount > 0 && (
                              <Badge className="text-xs px-2 py-0 bg-green-600">
                                {conversation.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
                
                {/* Botão Carregar Mais */}
                {hasMoreConversations && (
                  <div className="p-4 border-t border-gray-200">
                    <Button
                      onClick={() => setConversationsPage(prev => prev + 1)}
                      variant="outline"
                      className="w-full"
                      disabled={conversationsLoading}
                    >
                      {conversationsLoading ? "Carregando..." : `Carregar mais (+${Math.min(conversationsPerPage, filteredConversations.length - paginatedConversations.length)})`}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Painel Principal - Chat */}
        <div className="flex-1 flex flex-col">
          {!selectedConnectionId ? (
            <div className="h-full flex items-center justify-center bg-gray-50">
              <div className="text-center text-gray-500">
                <MessageCircle className="h-20 w-20 mx-auto mb-4 opacity-30" />
                <h3 className="text-xl font-medium mb-2">Bem-vindo ao WhatsApp Hub</h3>
                <p className="text-sm">Selecione uma conexão WhatsApp para começar</p>
              </div>
            </div>
          ) : !selectedConversation ? (
            <div className="h-full flex items-center justify-center bg-gray-50">
              <div className="text-center text-gray-500">
                <User className="h-20 w-20 mx-auto mb-4 opacity-30" />
                <h3 className="text-xl font-medium mb-2">Selecione uma conversa</h3>
                <p className="text-sm">Escolha um contato na lista para visualizar as mensagens</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header da conversa */}
              <div className="bg-gray-50 border-b border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-gray-300 text-gray-600">
                      <User className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">
                      {filteredConversations.find(c => c.phoneNumber === selectedConversation)?.contactName || selectedConversation}
                    </h3>
                    <p className="text-sm text-gray-500 flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {selectedConversation}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="text-xs">
                      {filteredConversations.find(c => c.phoneNumber === selectedConversation)?.messageCount || 0} mensagens
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Área de mensagens */}
              <ScrollArea className="flex-1 p-4 bg-gray-25" style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg width="100" height="100" xmlns="http://www.w3.org/2000/svg"%3e%3cdefs%3e%3cpattern id="bg" width="60" height="60" patternUnits="userSpaceOnUse"%3e%3cpath d="M54 54L6 6M54 6l-48 48" stroke="%23f0f0f0" stroke-width="1" fill="none"/%3e%3c/pattern%3e%3c/defs%3e%3crect width="100%" height="100%" fill="url(%23bg)"/%3e%3c/svg%3e")' }}>
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium mb-2">Conversa iniciada</p>
                    <p className="text-sm">As mensagens desta conversa aparecerão aqui</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-w-4xl mx-auto">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.direction === "sent" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-sm lg:max-w-md px-4 py-2 rounded-lg shadow-sm ${
                            message.direction === "sent"
                              ? "bg-green-500 text-white rounded-br-none"
                              : "bg-white text-gray-900 rounded-bl-none border"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {message.content}
                          </p>
                          <div className="flex items-center justify-between mt-1 gap-2">
                            <span className={`text-xs ${message.direction === "sent" ? "text-green-100" : "text-gray-500"}`}>
                              {formatTime(message.timestamp)}
                            </span>
                            {message.direction === "sent" && (
                              <div className="flex items-center">
                                {message.status === "pending" && (
                                  <Clock className="h-3 w-3 text-green-200" />
                                )}
                                {message.status === "sent" && (
                                  <span className="text-green-200">✓</span>
                                )}
                                {message.status === "delivered" && (
                                  <span className="text-green-200">✓✓</span>
                                )}
                                {message.status === "failed" && (
                                  <span className="text-red-300">✗</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Campo de envio de mensagem */}
              <div className="bg-gray-50 border-t border-gray-200 p-4">
                <div className="flex gap-3 max-w-4xl mx-auto">
                  <Input
                    placeholder="Digite uma mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="flex-1 bg-white"
                  />
                  <Button 
                    onClick={handleSendMessage} 
                    disabled={!newMessage.trim()}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}