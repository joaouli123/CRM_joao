import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ContactAvatar } from "@/components/ui/contact-avatar";
import { MessageCircle, Send, Phone, Clock, User, Search } from "lucide-react";
import { Connection, Conversation, Message } from "@/lib/api";
import { format, isToday, isYesterday } from "date-fns";

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
  const [selectedConversation, setSelectedConversation] = useState<string>("");
  const [newMessage, setNewMessage] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [realtimeMessages, setRealtimeMessages] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [conversationsLimit, setConversationsLimit] = useState(10);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // SET para controlar IDs únicos e evitar duplicação
  const processedMessageIds = useRef(new Set<string>());

  // Cleanup quando componente desmonta
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  // WebSocket para mensagens em tempo real
  useEffect(() => {
    if (!selectedConnectionId || !mountedRef.current) return;

    console.log(`🔌 INICIANDO WEBSOCKET para conexão ${selectedConnectionId}`);

    let shouldReconnect = true;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const connectWebSocket = () => {
      if (!mountedRef.current || !shouldReconnect) return;

      try {
        const wsUrl = `wss://${window.location.host}/api/ws`;
        console.log(`📡 Conectando WebSocket: ${wsUrl}`);

        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          if (!mountedRef.current) return;
          console.log(`✅ WEBSOCKET CONECTADO! Conexão: ${selectedConnectionId}`);
          setIsConnected(true);
          reconnectAttempts = 0;
        };

        socket.onmessage = (event) => {
          if (!mountedRef.current) return;

          try {
            const data = JSON.parse(event.data);
            console.log(`📨 WEBSOCKET EVENTO RECEBIDO:`, data);

            // Processar APENAS UM evento por mensagem para evitar duplicação
            if ((data.type === "newMessage") && data.data) {
              const msgData = data.data;

              // Só processar se for para a conexão ativa
              if (msgData.connectionId === selectedConnectionId) {
                console.log(`📨 NOVA MENSAGEM: ${msgData.content} | Direção: ${msgData.direction}`);

                setRealtimeMessages((prev) => {
                  if (!mountedRef.current) return prev;

                  const messageKey = `${msgData.id || msgData.tempId}`;

                  // 1. VERIFICAÇÃO RIGOROSA - Se já foi processada, ignorar completamente
                  if (processedMessageIds.current.has(messageKey)) {
                    console.log(`🚫 DUPLICAÇÃO DETECTADA - Ignorando mensagem já processada: ${messageKey}`);
                    return prev;
                  }

                  // 2. Marcar como processada ANTES de qualquer operação
                  processedMessageIds.current.add(messageKey);

                  // 3. Substituição de mensagem temporária com tempId
                  if (msgData.direction === 'sent' && msgData.tempId) {
                    console.log(`🔍 BUSCANDO mensagem temporária para ${msgData.content}`);

                    let tempIndex = prev.findIndex((m: any) => m.tempId === msgData.tempId);

                    if (tempIndex !== -1) {
                      console.log(`🔄 SUBSTITUINDO mensagem temporária (tempId: ${msgData.tempId}) por oficial (id: ${msgData.id})`);
                      // Remover tempId do conjunto e adicionar ID oficial
                      processedMessageIds.current.delete(msgData.tempId);
                      processedMessageIds.current.add(msgData.id);

                      const newMessages = [...prev];
                      newMessages[tempIndex] = {
                        id: msgData.id,
                        content: msgData.content,
                        phoneNumber: msgData.phoneNumber,
                        direction: msgData.direction,
                        timestamp: new Date(msgData.timestamp),
                        status: 'sent',
                        tempId: undefined,
                      };
                      return newMessages;
                    }
                  }

                  // 4. Se não encontrou mensagem temporária, adicionar normalmente
                  const newMsg = {
                    id: msgData.id,
                    content: msgData.content,
                    phoneNumber: msgData.phoneNumber,
                    direction: msgData.direction,
                    timestamp: new Date(msgData.timestamp),
                    status: msgData.direction === 'sent' ? 'sent' : 'received'
                  };
                  console.log(`✅ ADICIONANDO nova mensagem ${msgData.id}: "${msgData.content}"`);
                  return [...prev, newMsg];
                });
              }
            }

            // Atualização de status de entrega
            if (data.type === 'messageReceived' && data.data) {
              const msgData = data.data;
              console.log(`📬 CONFIRMAÇÃO DE ENTREGA recebida para mensagem ${msgData.id}`);

              setRealtimeMessages((prev) => {
                if (!mountedRef.current) return prev;
                return prev.map((msg) => 
                  msg.id === msgData.id 
                    ? { ...msg, status: 'delivered' }
                    : msg
                );
              });
            }

            // Status de falha na entrega
            if (data.type === 'messageFailed' && data.data) {
              const msgData = data.data;
              console.log(`❌ FALHA NA ENTREGA para mensagem ${msgData.id}`);

              setRealtimeMessages((prev) => {
                if (!mountedRef.current) return prev;
                return prev.map((msg) => 
                  msg.id === msgData.id 
                    ? { ...msg, status: 'failed' }
                    : msg
                );
              });
            }

          } catch (error) {
            console.error("❌ Erro ao processar WebSocket:", error);
          }
        };

        socket.onerror = (error) => {
          console.error("❌ WebSocket erro:", error);
          if (mountedRef.current) {
            setIsConnected(false);
          }
        };

        socket.onclose = () => {
          if (!mountedRef.current) return;

          console.log("🔴 WebSocket fechado");
          setIsConnected(false);

          if (shouldReconnect && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            console.log(`🔄 Tentando reconectar em ${delay}ms (tentativa ${reconnectAttempts}/${maxReconnectAttempts})`);

            reconnectTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current && shouldReconnect) {
                connectWebSocket();
              }
            }, delay);
          } else {
            console.log("❌ Máximo de tentativas de reconexão atingido");
          }
        };

      } catch (error) {
        console.error("❌ Erro ao criar WebSocket:", error);

        if (shouldReconnect && reconnectAttempts < maxReconnectAttempts && mountedRef.current) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current && shouldReconnect) {
              connectWebSocket();
            }
          }, delay);
        }
      }
    };

    connectWebSocket();

    return () => {
      shouldReconnect = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [selectedConnectionId]);

  // Buscar conversas com paginação
  const { data: conversations = [], error: conversationsError } = useQuery({
    queryKey: [`/api/connections/${selectedConnectionId}/conversations?limit=${conversationsLimit}`],
    enabled: !!selectedConnectionId,
    retry: 3,
    retryDelay: 1000,
  });

  // Log das conversas quando carregarem
  useEffect(() => {
    if (conversations && conversations.length > 0) {
      console.log("📸 DADOS DAS CONVERSAS RECEBIDAS:", conversations);
      conversations.forEach((conv: any, index: number) => {
        console.log(`📱 Conversa ${index + 1}: ${conv.contactName || conv.phoneNumber} - Foto: ${conv.profilePicture ? '✅' : '❌'}`);
        if (conv.profilePicture) {
          console.log(`🖼️ URL da foto: ${conv.profilePicture}`);
        }
      });
    }
  }, [conversations]);

  // Buscar mensagens do chat selecionado
  const { data: chatMessages = [], error: messagesError } = useQuery({
    queryKey: [`/api/connections/${selectedConnectionId}/conversations/${selectedConversation}/messages`],
    enabled: !!selectedConnectionId && !!selectedConversation,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    retry: 3,
    retryDelay: 1000,
  });

  // DEDUPLICAÇÃO ROBUSTA - Combinar mensagens sem duplicatas
  const allMessagesMap = new Map();
  const contentHashes = new Set();

  const createContentHash = (msg: any) => {
    try {
      const timestamp = new Date(msg.timestamp).getTime();
      return `${msg.content}_${msg.phoneNumber}_${msg.direction}_${Math.floor(timestamp / 1000)}`;
    } catch (error) {
      console.warn("Erro ao criar hash do conteúdo:", error);
      return `${msg.content}_${msg.phoneNumber}_${msg.direction}_${Date.now()}`;
    }
  };

  // 1. PRIMEIRO: Adicionar mensagens da API
  try {
    (Array.isArray(chatMessages) ? chatMessages : []).forEach((msg) => {
      if (msg && msg.id) {
        const contentHash = createContentHash(msg);
        allMessagesMap.set(msg.id, msg);
        contentHashes.add(contentHash);
      }
    });
  } catch (error) {
    console.error("Erro ao processar mensagens da API:", error);
  }

  // 2. SEGUNDO: Adicionar mensagens do WebSocket
  try {
    realtimeMessages
      .filter((m) => m && m.phoneNumber === selectedConversation)
      .forEach((msg) => {
        const contentHash = createContentHash(msg);

        if (contentHashes.has(contentHash)) {
          console.log(`🚫 DUPLICATA DETECTADA POR CONTEÚDO: ${msg.content}`);
          return;
        }

        if (msg.id && !allMessagesMap.has(msg.id)) {
          allMessagesMap.set(msg.id, msg);
          contentHashes.add(contentHash);
        } else if (msg.tempId && !msg.id && !allMessagesMap.has(msg.tempId)) {
          allMessagesMap.set(msg.tempId, msg);
          contentHashes.add(contentHash);
        }
      });
  } catch (error) {
    console.error("Erro ao processar mensagens em tempo real:", error);
  }

  const allMessages = Array.from(allMessagesMap.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Função para rolar automaticamente para o final do chat
  const scrollToBottom = () => {
    try {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (error) {
      console.warn("Erro ao rolar para o final:", error);
    }
  };

  // Rolar automaticamente quando mensagens mudarem
  useEffect(() => {
    const timeout = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeout);
  }, [allMessages]);

  // Enviar mensagem
  const sendMessage = async (message: string) => {
    if (!selectedConversation || !selectedConnectionId || !message.trim()) return;

    const tempId = crypto.randomUUID();
    const tempMessage = {
      id: tempId,
      tempId: tempId,
      content: message.trim(),
      phoneNumber: selectedConversation,
      direction: 'sent',
      timestamp: new Date(),
      status: 'pending'
    };

    setRealtimeMessages((prev) => [...prev, tempMessage]);
    setNewMessage('');
    console.log(`⏳ MENSAGEM TEMPORÁRIA ADICIONADA: ${tempId}`, tempMessage);

    try {
      const response = await fetch(`/api/connections/${selectedConnectionId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedConversation,
          message: message.trim(),
          tempId: tempId
        })
      });

      if (response.ok) {
        setRealtimeMessages((prev) => 
          prev.map((msg) => 
            msg.tempId === tempId 
              ? { ...msg, status: 'sent' }
              : msg
          )
        );
        console.log(`✅ MENSAGEM ENVIADA COM SUCESSO`);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      setRealtimeMessages((prev) => 
        prev.map((msg) => 
          msg.tempId === tempId 
            ? { ...msg, status: 'failed' }
            : msg
        )
      );
    }
  };

  const filteredConversations = (conversations as any[]).filter((conv: any) => {
    try {
      return conv && (
        (conv.contactName && conv.contactName.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (conv.phoneNumber && conv.phoneNumber.includes(searchFilter))
      );
    } catch (error) {
      console.warn("Erro ao filtrar conversa:", error);
      return false;
    }
  });

  const formatTime = (date: Date) => {
    try {
      if (isToday(date)) {
        return format(date, 'HH:mm');
      } else if (isYesterday(date)) {
        return 'Ontem';
      } else {
        return format(date, 'dd/MM');
      }
    } catch (error) {
      console.warn("Erro ao formatar data:", error);
      return '';
    }
  };

  if (!selectedConnectionId) {
    return (
      <div className="h-full bg-white rounded-lg shadow-sm border flex items-center justify-center">
        <div className="text-center">
          <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Selecione uma conexão para ver as mensagens</p>
        </div>
      </div>
    );
  }

  // Mostrar erro se houver
  if (conversationsError || messagesError) {
    return (
      <div className="h-full bg-white rounded-lg shadow-sm border flex items-center justify-center">
        <div className="text-center">
          <MessageCircle className="h-12 w-12 text-red-300 mx-auto mb-4" />
          <p className="text-red-500">Erro ao carregar dados</p>
          <p className="text-sm text-gray-400">Verifique a conexão</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg shadow-lg border overflow-hidden">
      {/* Lista de Conversas */}
      <div className="w-80 min-w-[280px] max-w-[400px] border-r border-gray-300 flex flex-col h-full bg-gradient-to-b from-gray-800 to-gray-900">
        {/* Header das Conversas */}
        <div className="p-4 bg-gray-800 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Conversas</h3>
            {isConnected && (
              <Badge variant="outline" className="text-xs bg-green-500 text-white border-green-400 px-2 py-1">
                Online
              </Badge>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar conversas..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-10 h-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:bg-gray-600 focus:border-gray-500"
            />
          </div>
        </div>

        {/* Lista de conversas */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                {searchFilter ? (
                  <>
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma conversa encontrada</p>
                  </>
                ) : (
                  <>
                    <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma conversa encontrada</p>
                  </>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {filteredConversations.map((conv: any) => (
                  <div
                    key={conv.phoneNumber}
                    className={`p-4 cursor-pointer hover:bg-gray-700 transition-all duration-200 ${
                      selectedConversation === conv.phoneNumber 
                        ? 'bg-orange-500 border-l-4 border-l-orange-300 shadow-lg' 
                        : 'hover:border-l-4 hover:border-l-gray-600'
                    }`}
                    onClick={() => {
                      console.log(`📱 SELECIONANDO CONVERSA: ${conv.phoneNumber}`);
                      setSelectedConversation(conv.phoneNumber);
                    }}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <ContactAvatar 
                          profilePicture={conv.profilePicture}
                          contactName={conv.contactName}
                          phoneNumber={conv.phoneNumber}
                          size="md"
                        />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between">
                          <h4 className={`text-sm font-medium truncate pr-2 ${
                            selectedConversation === conv.phoneNumber 
                              ? 'text-white' 
                              : 'text-gray-100'
                          }`}>
                            {conv.contactName || conv.phoneNumber}
                          </h4>
                          {conv.lastMessageTime && (
                            <span className={`text-xs flex-shrink-0 ${
                              selectedConversation === conv.phoneNumber 
                                ? 'text-orange-100' 
                                : 'text-gray-400'
                            }`}>
                              {formatTime(new Date(conv.lastMessageTime))}
                            </span>
                          )}
                        </div>
                        
                        <p className={`text-sm line-clamp-2 break-words ${
                          selectedConversation === conv.phoneNumber 
                            ? 'text-orange-100' 
                            : 'text-gray-300'
                        }`}>
                          {conv.lastMessage || 'Nenhuma mensagem'}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <span className={`text-xs truncate ${
                            selectedConversation === conv.phoneNumber 
                              ? 'text-orange-200' 
                              : 'text-gray-500'
                          }`}>
                            {conv.phoneNumber}
                          </span>
                          {conv.unreadCount > 0 && (
                            <Badge variant="default" className="bg-orange-500 text-white text-xs border-orange-400">
                              {conv.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Botão Carregar Mais */}
        {Array.isArray(conversations) && conversations.length >= conversationsLimit && (
          <div className="p-3 bg-gray-800 border-t border-gray-700 flex-shrink-0">
            <Button 
              variant="default" 
              size="sm"
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-medium py-2.5 shadow-lg transform transition-all duration-200 hover:scale-105 border border-orange-400"
              onClick={async () => {
                setLoadingMoreConversations(true);
                setConversationsLimit(prev => prev + 10);
                setTimeout(() => setLoadingMoreConversations(false), 1000);
              }}
              disabled={loadingMoreConversations}
            >
              {loadingMoreConversations ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Carregando...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <MessageCircle className="w-4 h-4" />
                  <span>Carregar Mais</span>
                </div>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-gray-50 to-white">
        {selectedConversation ? (
          <>
            {/* Header do Chat */}
            <div className="p-4 bg-white border-b border-gray-200 flex-shrink-0 shadow-sm">
              <div className="flex items-center space-x-4">
                <ContactAvatar 
                  profilePicture={filteredConversations.find((c: any) => c.phoneNumber === selectedConversation)?.profilePicture}
                  contactName={filteredConversations.find((c: any) => c.phoneNumber === selectedConversation)?.contactName}
                  phoneNumber={selectedConversation}
                  size="md"
                />
                <div>
                  <h4 className="text-lg font-bold text-gray-800">
                    {filteredConversations.find((c: any) => c.phoneNumber === selectedConversation)?.contactName || selectedConversation}
                  </h4>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Phone className="h-4 w-4" />
                    <span>{selectedConversation}</span>
                    {isConnected && (
                      <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300 ml-2">
                        Online
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-hidden bg-gradient-to-b from-gray-50 to-gray-100">
              <ScrollArea className="h-full p-6">
                <div className="space-y-6">
                  {allMessages.map((message, index) => (
                    <div
                      key={`${message.id || message.tempId || index}-${message.timestamp}`}
                      className={`flex ${message.direction === 'sent' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-5 py-3 shadow-lg ${
                          message.direction === 'sent'
                            ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white border border-orange-400'
                            : 'bg-white text-gray-800 border border-gray-200 shadow-md'
                        }`}
                      >
                        <p className="text-sm leading-relaxed font-medium">{message.content}</p>
                        <div className="flex items-center justify-end space-x-2 mt-2">
                          <Clock className="h-3 w-3 opacity-60" />
                          <span className="text-xs opacity-80">
                            {formatTime(new Date(message.timestamp))}
                          </span>
                          {message.direction === 'sent' && (
                            <span className="text-xs ml-1 opacity-80">
                              {message.status === 'pending' && '⏳'}
                              {message.status === 'sent' && '✔'}
                              {message.status === 'delivered' && '✔✔'}
                              {message.status === 'failed' && '❌'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {typing && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 text-gray-900 rounded-2xl px-4 py-3 max-w-[70%]">
                        <p className="text-sm italic">O contato está digitando...</p>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </div>

            {/* Input de Mensagem */}
            <div className="p-4 bg-white border-t border-gray-200 flex-shrink-0 shadow-lg">
              <div className="flex space-x-3">
                <Input
                  placeholder="Digite sua mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      sendMessage(newMessage);
                    }
                  }}
                  className="flex-1 h-12 px-5 bg-gray-50 border-gray-300 rounded-2xl focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-800 font-medium"
                />
                <Button 
                  onClick={() => sendMessage(newMessage)}
                  disabled={!newMessage.trim()}
                  className="h-12 w-12 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-300 disabled:to-gray-400 border border-orange-400 shadow-lg transform transition-all duration-200 hover:scale-105"
                  size="sm"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="text-center">
              <MessageCircle className="h-20 w-20 text-gray-400 mx-auto mb-6" />
              <p className="text-xl text-gray-600 font-bold mb-2">Selecione uma conversa</p>
              <p className="text-sm text-gray-500">Escolha um contato para começar a conversar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}