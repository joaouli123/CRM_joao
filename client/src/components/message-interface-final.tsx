
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
  const [historyPage, setHistoryPage] = useState(1);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [historyMessages, setHistoryMessages] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // SET para controlar IDs únicos e evitar duplicação
  const processedMessageIds = useRef(new Set<string>());

  // WebSocket para mensagens em tempo real
  useEffect(() => {
    if (!selectedConnectionId) return;

    console.log(`🔌 INICIANDO WEBSOCKET para conexão ${selectedConnectionId}`);

    let socket: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connectWebSocket = () => {
      try {
        const wsUrl = `wss://${window.location.host}/api/ws`;
        console.log(`📡 Conectando WebSocket: ${wsUrl}`);

        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          console.log(`✅ WEBSOCKET CONECTADO! Conexão: ${selectedConnectionId}`);
          setIsConnected(true);
        };

        socket.onmessage = (event) => {
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
                        tempId: undefined, // Remove tempId na mensagem oficial
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

            // 4. ATUALIZAÇÃO DE STATUS DE ENTREGA (messageReceived)
            if (data.type === 'messageReceived' && data.data) {
              const msgData = data.data;
              console.log(`📬 CONFIRMAÇÃO DE ENTREGA recebida para mensagem ${msgData.id}`);

              setRealtimeMessages((prev) => 
                prev.map((msg) => 
                  msg.id === msgData.id 
                    ? { ...msg, status: 'delivered' } // ✔✔ Atualizar para 'delivered'
                    : msg
                )
              );
              return; // Evitar processamento adicional
            }

            // 5. STATUS DE FALHA NA ENTREGA
            if (data.type === 'messageFailed' && data.data) {
              const msgData = data.data;
              console.log(`❌ FALHA NA ENTREGA para mensagem ${msgData.id}`);

              setRealtimeMessages((prev) => 
                prev.map((msg) => 
                  msg.id === msgData.id 
                    ? { ...msg, status: 'failed' } // ❌ Marcar como falha
                    : msg
                )
              );
              return; // Evitar processamento adicional
            }

            // Ignorar outros eventos duplicados
            if (data.type === "messageSent") {
              console.log(`🔇 Ignorando evento duplicado: ${data.type}`);
            }
          } catch (error) {
            console.error("❌ Erro ao processar WebSocket:", error);
          }
        };

        socket.onerror = (error) => {
          console.error("❌ WebSocket erro:", error);
          setIsConnected(false);
        };

        socket.onclose = () => {
          console.log("🔴 WebSocket fechado, tentando reconectar...");
          setIsConnected(false);
          reconnectTimer = setTimeout(connectWebSocket, 3000);
        };

      } catch (error) {
        console.error("❌ Erro ao criar WebSocket:", error);
        reconnectTimer = setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) socket.close();
    };
  }, [selectedConnectionId]);

  // Buscar conversas com paginação
  const { data: conversations = [] } = useQuery({
    queryKey: [`/api/connections/${selectedConnectionId}/conversations?limit=${conversationsLimit}`],
    enabled: !!selectedConnectionId,
  });

  // Log das conversas quando carregarem
  React.useEffect(() => {
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

  // Buscar mensagens do chat selecionado COM ATUALIZAÇÃO EM TEMPO REAL
  const { data: chatMessages = [] } = useQuery({
    queryKey: [`/api/connections/${selectedConnectionId}/conversations/${selectedConversation}/messages`],
    enabled: !!selectedConnectionId && !!selectedConversation,
    refetchInterval: 2000, // Verificar novas mensagens a cada 2 segundos
    refetchIntervalInBackground: true
  });

  // DEDUPLICAÇÃO ROBUSTA - Combinar mensagens sem duplicatas
  const allMessagesMap = new Map();
  const contentHashes = new Set(); // Para detectar duplicatas por conteúdo + timestamp

  // Função para criar hash único baseado em conteúdo + timestamp + telefone
  const createContentHash = (msg: any) => {
    const timestamp = new Date(msg.timestamp).getTime();
    return `${msg.content}_${msg.phoneNumber}_${msg.direction}_${Math.floor(timestamp / 1000)}`;
  };

  // 1. PRIMEIRO: Adicionar mensagens da API (sempre prioridade)
  (Array.isArray(chatMessages) ? chatMessages : []).forEach((msg) => {
    if (msg.id) {
      const contentHash = createContentHash(msg);
      allMessagesMap.set(msg.id, msg);
      contentHashes.add(contentHash);
    }
  });

  // 2. SEGUNDO: Adicionar mensagens do WebSocket com verificação rigorosa
  realtimeMessages
    .filter((m) => m.phoneNumber === selectedConversation)
    .forEach((msg) => {
      const contentHash = createContentHash(msg);

      // Evitar duplicatas por conteúdo
      if (contentHashes.has(contentHash)) {
        console.log(`🚫 DUPLICATA DETECTADA POR CONTEÚDO: ${msg.content}`);
        return;
      }

      if (msg.id && !allMessagesMap.has(msg.id)) {
        // Mensagem oficial nova
        allMessagesMap.set(msg.id, msg);
        contentHashes.add(contentHash);
      } else if (msg.tempId && !msg.id && !allMessagesMap.has(msg.tempId)) {
        // Mensagem temporária nova
        allMessagesMap.set(msg.tempId, msg);
        contentHashes.add(contentHash);
      }
    });

  const allMessages = Array.from(allMessagesMap.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Função para rolar automaticamente para o final do chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Rolar automaticamente quando mensagens mudarem
  useEffect(() => {
    scrollToBottom();
  }, [allMessages]);

  // Debug - mostrar contagem de mensagens
  useEffect(() => {
    console.log(`📊 CONTAGEM MENSAGENS: API=${chatMessages.length}, Tempo Real=${realtimeMessages.length}, Total=${allMessages.length}`);
  }, [chatMessages.length, realtimeMessages.length, allMessages.length]);

  // Enviar mensagem
  const sendMessage = async (message: string) => {
    if (!selectedConversation || !selectedConnectionId || !message.trim()) return;

    // 1. Criar mensagem temporária com tempId
    const tempId = crypto.randomUUID();
    const tempMessage = {
      id: tempId, // ID temporário para renderização
      tempId: tempId, // Campo específico para identificar mensagens temporárias
      content: message.trim(),
      phoneNumber: selectedConversation,
      direction: 'sent',
      timestamp: new Date(),
      status: 'pending'
    };

    // 2. Adicionar mensagem temporária IMEDIATAMENTE
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
        // 3. Se enviou com sucesso, marcar como 'sent' imediatamente
        setRealtimeMessages((prev) => 
          prev.map((msg) => 
            msg.tempId === tempId 
              ? { ...msg, status: 'sent' }
              : msg
          )
        );
        console.log(`✅ MENSAGEM ENVIADA COM SUCESSO - Atualizando status para 'sent'`);
      } else {
        // 4. Em caso de erro, marcar como falha
        setRealtimeMessages((prev) => 
          prev.map((msg) => 
            msg.tempId === tempId 
              ? { ...msg, status: 'failed' }
              : msg
          )
        );
        console.error('❌ Erro ao enviar mensagem');
      }
    } catch (error) {
      // 5. Em caso de erro de rede, marcar como falha
      setRealtimeMessages((prev) => 
        prev.map((msg) => 
          msg.tempId === tempId 
            ? { ...msg, status: 'failed' }
            : msg
        )
      );
      console.error('❌ Erro de rede:', error);
    }
  };

  const filteredConversations = (conversations as any[]).filter((conv: any) =>
    conv.contactName?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    conv.phoneNumber.includes(searchFilter)
  );

  const formatTime = (date: Date) => {
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return 'Ontem';
    } else {
      return format(date, 'dd/MM');
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

  const isLoadingConversations = false;

  return (
    <div className="h-full w-full flex bg-white rounded-lg shadow-sm border overflow-hidden">
      {/* Lista de Conversas */}
      <div className="w-80 border-r border-gray-200 flex flex-col h-full bg-gray-50">
        {/* Header das Conversas */}
        <div className="p-4 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Conversas</h3>
            {isConnected && (
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
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
              className="pl-10 h-9 bg-gray-50 border-gray-200 focus:bg-white"
            />
          </div>
        </div>

        {/* Lista de conversas */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {isLoadingConversations ? (
              <div className="p-6 text-center text-gray-500">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Carregando conversas...</p>
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
              <div className="divide-y divide-gray-100">
                {filteredConversations.map((conv: any) => (
                  <div
                    key={conv.phoneNumber}
                    className={`p-4 cursor-pointer hover:bg-white transition-colors duration-150 ${
                      selectedConversation === conv.phoneNumber 
                        ? 'bg-blue-50 border-r-3 border-r-blue-500' 
                        : ''
                    }`}
                    onClick={() => {
                      console.log(`📱 SELECIONANDO CONVERSA: ${conv.phoneNumber}`);
                      setSelectedConversation(conv.phoneNumber);
                    }}
                  >
                    <div className="flex items-center space-x-3">
                      <ContactAvatar 
                        profilePicture={conv.profilePicture}
                        contactName={conv.contactName}
                        phoneNumber={conv.phoneNumber}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {conv.contactName || conv.phoneNumber}
                          </p>
                          <span className="text-xs text-gray-500">
                            {formatTime(new Date(conv.lastMessageTime))}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {conv.lastMessage}
                        </p>
                        {conv.unreadCount > 0 && (
                          <Badge variant="default" className="mt-1 bg-blue-500">
                            {conv.unreadCount}
                          </Badge>
                        )}
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
          <div className="p-4 bg-white border-t border-gray-200 flex-shrink-0">
            <Button 
              variant="default" 
              size="sm"
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-medium py-2 shadow-md transform transition-all duration-200 hover:scale-105"
              onClick={async () => {
                setLoadingMoreConversations(true);
                setConversationsLimit(prev => prev + 10);
                setTimeout(() => setLoadingMoreConversations(false), 1000);
              }}
              disabled={loadingMoreConversations}
            >
              {loadingMoreConversations ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Carregando...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <MessageCircle className="w-4 h-4" />
                  <span>Carregar Mais</span>
                </div>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col h-full bg-white">
        {selectedConversation ? (
          <>
            {/* Header do Chat */}
            <div className="p-4 bg-white border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center space-x-3">
                <ContactAvatar 
                  profilePicture={filteredConversations.find((c: any) => c.phoneNumber === selectedConversation)?.profilePicture}
                  contactName={filteredConversations.find((c: any) => c.phoneNumber === selectedConversation)?.contactName}
                  phoneNumber={selectedConversation}
                  size="md"
                />
                <div>
                  <h4 className="text-base font-semibold text-gray-900">
                    {filteredConversations.find((c: any) => c.phoneNumber === selectedConversation)?.contactName || selectedConversation}
                  </h4>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <Phone className="h-3 w-3" />
                    <span>{selectedConversation}</span>
                    {isConnected && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        Online
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full p-4">
                <div className="space-y-4">
                  {allMessages.map((message, index) => (
                    <div
                      key={`${message.id || index}-${message.timestamp}`}
                      className={`flex ${message.direction === 'sent' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                          message.direction === 'sent'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{message.content}</p>
                        <div className="flex items-center justify-end space-x-1 mt-2">
                          <Clock className="h-3 w-3 opacity-70" />
                          <span className="text-xs opacity-70">
                            {formatTime(new Date(message.timestamp))}
                          </span>
                          {message.direction === 'sent' && (
                            <span className="text-xs ml-1">
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

                  {/* Indicador "Digitando..." */}
                  {typing && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 text-gray-900 rounded-2xl px-4 py-3 max-w-[70%]">
                        <p className="text-sm italic">O contato está digitando...</p>
                      </div>
                    </div>
                  )}

                  {/* Referência para scroll automático */}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </div>

            {/* Input de Mensagem */}
            <div className="p-4 bg-white border-t border-gray-200 flex-shrink-0">
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
                  className="flex-1 h-10 px-4 bg-gray-50 border-gray-200 rounded-full focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Button 
                  onClick={() => sendMessage(newMessage)}
                  disabled={!newMessage.trim()}
                  className="h-10 w-10 rounded-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300"
                  size="sm"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg text-gray-500 font-medium">Selecione uma conversa</p>
              <p className="text-sm text-gray-400">Escolha um contato para começar a conversar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
