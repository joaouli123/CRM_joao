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
  
  // Estados para tempo real conforme especificação
  const [webSocket, setWebSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  
  // Multi-instance state management
  const [chatsByInstance, setChatsByInstance] = useState<Record<string, Conversation[]>>({});
  const [messagesByInstance, setMessagesByInstance] = useState<Record<string, Record<string, Message[]>>>({});
  const [skipByInstance, setSkipByInstance] = useState<Record<string, number>>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreChats, setHasMoreChats] = useState<Record<string, boolean>>({});

  // Get current instance info
  const selectedConnection = connections.find(conn => conn.id === selectedConnectionId);
  const instanceKey = selectedConnection ? `${selectedConnection.id}_${selectedConnection.name}` : '';

  // WebSocket FORÇADO para mensagens em tempo real
  useEffect(() => {
    if (!selectedConnectionId) return;

    console.log(`🔌 INICIANDO WebSocket FORÇADO para conexão ${selectedConnectionId}`);
    
    let reconnectTimer: NodeJS.Timeout | null = null;
    let socket: WebSocket | null = null;

    const connectWebSocket = () => {
      try {
        const wsUrl = `wss://${window.location.host}/api/ws`;
        console.log(`📡 Conectando WebSocket FORÇADO: ${wsUrl}`);
        
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          console.log(`✅ WebSocket FORÇADO conectado! Conexão: ${selectedConnectionId}`);
          setIsConnected(true);
          
          // FORÇA o registro para receber mensagens
          socket?.send(JSON.stringify({
            type: "register",
            connectionId: selectedConnectionId
          }));
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log(`📨 WEBSOCKET RECEBEU:`, data);

            // FORÇA o processamento de QUALQUER mensagem relacionada à conexão
            if (data.data && data.data.connectionId === selectedConnectionId) {
              const msgData = data.data;
              const chatPhone = msgData.phoneNumber || msgData.from || msgData.to;
              
              console.log(`🎯 PROCESSANDO MENSAGEM FORÇADA: ${msgData.content || msgData.body} para chat ${chatPhone}`);
              
              // FORÇAR atualização imediata das mensagens
              setMessagesByInstance((prevMessages) => {
                const currentMessages = prevMessages[instanceKey]?.[chatPhone] || [];
                
                // Anti-duplicação
                const messageId = msgData.id || `msg_${Date.now()}_${Math.random()}`;
                const exists = currentMessages.some((m: any) => m.id === messageId);
                if (exists) {
                  console.log("⚠️ Mensagem duplicada ignorada");
                  return prevMessages;
                }
                
                // NOVA MENSAGEM FORÇADA
                const newMessage = {
                  id: messageId,
                  content: msgData.content || msgData.body || msgData.message || "Nova mensagem",
                  phoneNumber: chatPhone,
                  direction: msgData.direction || (msgData.fromMe ? "sent" : "received"),
                  timestamp: new Date(msgData.timestamp || Date.now()),
                  status: msgData.status || 'delivered'
                };
                
                console.log(`🚀 ADICIONANDO MENSAGEM FORÇADA: "${newMessage.content}" para ${chatPhone}`);
                console.log(`📊 Total mensagens antes: ${currentMessages.length}, depois: ${currentMessages.length + 1}`);
                
                return {
                  ...prevMessages,
                  [instanceKey]: {
                    ...prevMessages[instanceKey],
                    [chatPhone]: [...currentMessages, newMessage]
                  }
                };
              });

              // FORÇAR atualização da lista de conversas
              setChatsByInstance(prev => {
                const currentChats = prev[instanceKey] || [];
                const updatedChats = currentChats.map(chat => {
                  if (chat.phoneNumber === chatPhone) {
                    return {
                      ...chat,
                      lastMessage: msgData.content || msgData.body || "Nova mensagem",
                      lastMessageTime: new Date(msgData.timestamp || Date.now()),
                      unreadCount: msgData.direction === 'received' && selectedConversation !== chatPhone 
                        ? (chat.unreadCount || 0) + 1 
                        : chat.unreadCount || 0
                    };
                  }
                  return chat;
                });
                
                return {
                  ...prev,
                  [instanceKey]: updatedChats
                };
              });
            }

            // STATUS "DIGITANDO..."
            if (data.type === "typing" && data.phoneNumber === selectedConversation) {
              setTyping(true);
              setTimeout(() => setTyping(false), 2000);
            }
          } catch (error) {
            console.error("❌ Erro ao processar WebSocket:", error);
          }
        };

        socket.onerror = (error) => {
          console.error("❌ WebSocket erro:", error);
        };

        socket.onclose = () => {
          console.log("🔴 WebSocket FORÇADO fechado, tentando reconectar...");
          setIsConnected(false);
          
          // Reconexão automática
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connectWebSocket, 2000);
        };

      } catch (error) {
        console.error("❌ Erro ao criar WebSocket:", error);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connectWebSocket, 2000);
      }
    };

    connectWebSocket();

    return () => {
      console.log("🔌 Limpando WebSocket FORÇADO");
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) socket.close();
    };
  }, [selectedConnectionId, instanceKey]);

  // Função para enviar notificação de digitando
  const sendTypingNotification = () => {
    if (webSocket && webSocket.readyState === WebSocket.OPEN) {
      webSocket.send(
        JSON.stringify({
          type: "typing",
          phoneNumber: selectedConversation,
        })
      );
    }
  };

  // Função para enviar mensagens em tempo real
  const sendMessage = async (message: string) => {
    if (!selectedConversation || !selectedConnectionId || !message.trim()) return;

    try {
      const response = await fetch(`/api/connections/${selectedConnectionId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedConversation,
          message: message.trim()
        })
      });

      if (response.ok) {
        console.log(`✅ Mensagem "${message}" enviada com sucesso!`);
        setNewMessage(''); // Limpa o input
      } else {
        console.error('Erro ao enviar mensagem');
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  };

      
  
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

  // POLLING FORÇADO para garantir mensagens em tempo real
  useEffect(() => {
    if (!selectedConversation || !selectedConnectionId) return;

    console.log(`⏰ INICIANDO POLLING FORÇADO para ${selectedConversation}`);

    const pollMessages = async () => {
      try {
        const response = await fetch(`/api/connections/${selectedConnectionId}/conversations/${selectedConversation}/messages`);
        const serverMessages = await response.json();

        if (serverMessages.length > 0) {
          const currentMessages = messagesByInstance[instanceKey]?.[selectedConversation] || [];
          
          // Verificar se há mensagens novas no servidor
          const newestServerMessage = serverMessages[serverMessages.length - 1];
          const newestClientMessage = currentMessages[currentMessages.length - 1];

          if (!newestClientMessage || 
              newestServerMessage.id !== newestClientMessage.id ||
              serverMessages.length !== currentMessages.length) {
            
            console.log(`🔄 POLLING: Atualizando mensagens para ${selectedConversation}`);
            console.log(`📊 Servidor: ${serverMessages.length}, Cliente: ${currentMessages.length}`);

            setMessagesByInstance(prev => ({
              ...prev,
              [instanceKey]: {
                ...prev[instanceKey],
                [selectedConversation]: serverMessages
              }
            }));
          }
        }
      } catch (error) {
        console.error('❌ Erro no polling:', error);
      }
    };

    // Polling a cada 2 segundos
    const pollInterval = setInterval(pollMessages, 2000);
    
    // Executar imediatamente
    pollMessages();

    return () => {
      console.log(`⏰ PARANDO POLLING para ${selectedConversation}`);
      clearInterval(pollInterval);
    };
  }, [selectedConversation, selectedConnectionId, instanceKey]);

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

  // Send message function - messages will be added via WebSocket
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !selectedConnectionId) return;

    const messageText = newMessage;
    setNewMessage(''); // Clear input immediately

    try {
      console.log(`📤 Enviando mensagem para ${selectedConversation}: ${messageText}`);
      
      const response = await fetch(`/api/connections/${selectedConnectionId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedConversation,
          message: messageText
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Mensagem enviada com sucesso:`, result);
        
        // Adicionar mensagem imediatamente na UI para feedback visual
        const sentMessage = {
          id: `sent_${Date.now()}_${Math.random()}`,
          content: messageText,
          phoneNumber: selectedConversation,
          direction: 'sent' as const,
          timestamp: new Date(),
          status: 'sent'
        };

        setMessagesByInstance(prev => ({
          ...prev,
          [instanceKey]: {
            ...prev[instanceKey],
            [selectedConversation]: [...(prev[instanceKey]?.[selectedConversation] || []), sentMessage]
          }
        }));

        // Atualizar lista de conversas
        setChatsByInstance(prev => ({
          ...prev,
          [instanceKey]: (prev[instanceKey] || []).map(chat => 
            chat.phoneNumber === selectedConversation 
              ? { ...chat, lastMessage: messageText, lastMessageTime: new Date() }
              : chat
          )
        }));
        
      } else {
        console.error(`❌ Erro ao enviar mensagem:`, response.status);
        setNewMessage(messageText); // Restore message on error
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setNewMessage(messageText); // Restore message on error
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
                {currentMessages.map((message, index) => {
                  // CHAVE ABSOLUTAMENTE ÚNICA - RESOLVE PROBLEMA DE DUPLICAÇÃO DEFINITIVAMENTE
                  const uniqueKey = `message-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                  
                  return (
                    <div
                      key={uniqueKey}
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
                  );
                })}
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