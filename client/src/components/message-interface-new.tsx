import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, Send, User, Search } from "lucide-react";
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
  status: string;
  messageHash?: string;
  tempId?: string;
}

export default function MessageInterface({ 
  connections, 
  selectedConnectionId, 
  onSelectConnection 
}: MessageInterfaceProps) {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  // Estados FORÇADOS para mensagens em tempo real
  const [realtimeMessages, setRealtimeMessages] = useState<RealtimeMessage[]>([]);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [conversationsList, setConversationsList] = useState<any[]>([]);

  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Conjunto para rastrear hashes de mensagens processadas
  const [processedMessageHashes, setProcessedMessageHashes] = useState<Set<string>>(new Set());

  // SCROLL AUTOMÁTICO para última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [realtimeMessages]);

    // Função para gerar um hash único para cada mensagem
  const generateMessageHash = (content: string, phoneNumber: string, direction: string, timestamp: Date): string => {
    const hash = `${content}-${phoneNumber}-${direction}-${timestamp.getTime()}`;
    return btoa(hash); // Codifica em Base64 para garantir que seja uma string válida
  };

  // WEBSOCKET FORÇADO - GARANTIDO PARA FUNCIONAR
  useEffect(() => {
    if (!selectedConnectionId) return;

    console.log(`🔌 INICIANDO WEBSOCKET FORÇADO para conexão ${selectedConnectionId}`);

    let reconnectTimer: NodeJS.Timeout | null = null;
    let shouldReconnect = true;

    const connectWebSocket = () => {
      if (!shouldReconnect) return;

      try {
        const wsUrl = `wss://${window.location.host}/api/ws`;
        console.log(`📡 Conectando WebSocket FORÇADO: ${wsUrl}`);

        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          console.log(`✅ WEBSOCKET FORÇADO CONECTADO! Conexão: ${selectedConnectionId}`);
          setIsWebSocketConnected(true);

          // REGISTRAR para receber mensagens desta conexão
          socket.send(JSON.stringify({
            type: "register",
            connectionId: selectedConnectionId
          }));
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log(`📨 WEBSOCKET RECEBEU:`, data);

              // PROCESSA APENAS messageSent e messageReceived - SEM DUPLICAÇÃO
              const validTypes = ["messageSent", "messageReceived"];

              if (validTypes.includes(data.type) && data.data) {
                const msgData = data.data;

                // Verifica se é para esta conexão E se é para a conversa atual
                if (msgData.connectionId === selectedConnectionId && msgData.phoneNumber === selectedConversation) {
                  console.log(`🎯 PROCESSANDO ${data.type}: "${msgData.content}" para chat ${msgData.phoneNumber}`);

                  // Gerar hash único para esta mensagem
                  const messageTimestamp = new Date(msgData.timestamp);
                  const messageHash = generateMessageHash(msgData.content, msgData.phoneNumber, msgData.direction, messageTimestamp);

                  // Verificar se já processamos esta mensagem
                  if (processedMessageHashes.has(messageHash)) {
                    console.log(`⚠️ MENSAGEM JÁ PROCESSADA (hash: ${messageHash}), ignorando duplicata:`, msgData.content);
                    return;
                  }

                  // CRIA mensagem com ID único baseado no banco de dados
                  const newMsg: RealtimeMessage = {
                    id: msgData.id.toString(),
                    content: msgData.content,
                    phoneNumber: msgData.phoneNumber,
                    direction: msgData.direction,
                    timestamp: messageTimestamp,
                    status: msgData.status || 'delivered',
                    messageHash: messageHash
                  };

                  console.log(`🚀 NOVA MENSAGEM CRIADA (hash: ${messageHash}):`, newMsg);

                  // Adicionar hash ao conjunto de mensagens processadas
                  setProcessedMessageHashes(prev => new Set([...prev, messageHash]));

                  // VERIFICAÇÃO FINAL ANTI-DUPLICAÇÃO
                  setRealtimeMessages(prev => {
                    // Verificar por ID único
                    const existsById = prev.some(m => m.id === newMsg.id);

                    // Verificar por hash
                    const existsByHash = prev.some(m => m.messageHash === messageHash);

                    if (existsById) {
                      console.log("⚠️ Mensagem duplicada (ID já existe):", newMsg.id);
                      return prev;
                    }

                    if (existsByHash) {
                      console.log("⚠️ Mensagem duplicada (hash já existe):", messageHash);
                      return prev;
                    }

                    console.log(`✅ MENSAGEM ADICIONADA COM SUCESSO: "${newMsg.content}" (ID: ${newMsg.id}, Hash: ${messageHash})`);
                    return [...prev, newMsg];
                  });

                // ATUALIZA lista de conversas
                setConversationsList(prevConvs => {
                  const updated = prevConvs.map(conv => {
                    if (conv.phoneNumber === newMsg.phoneNumber) {
                      return {
                        ...conv,
                        lastMessage: newMsg.content,
                        lastMessageTime: newMsg.timestamp
                      };
                    }
                    return conv;
                  });

                  // Se conversa não existe, adiciona
                  const conversationExists = updated.some(conv => conv.phoneNumber === newMsg.phoneNumber);
                  if (!conversationExists) {
                    updated.push({
                      phoneNumber: newMsg.phoneNumber,
                      contactName: newMsg.phoneNumber,
                      lastMessage: newMsg.content,
                      lastMessageTime: newMsg.timestamp,
                      unreadCount: newMsg.direction === 'received' ? 1 : 0,
                      messageCount: 1
                    });
                  }

                  return updated;
                });

                // FORÇA scroll para baixo
                setTimeout(scrollToBottom, 100);
              }
            }
          } catch (error) {
            console.error("❌ Erro ao processar WebSocket:", error);
          }
        };

        socket.onerror = (error) => {
          console.error("❌ WebSocket erro:", error);
          setIsWebSocketConnected(false);
        };

        socket.onclose = () => {
          console.log("🔴 WebSocket FORÇADO fechado, tentando reconectar...");
          setIsWebSocketConnected(false);

          if (shouldReconnect) {
            reconnectTimer = setTimeout(connectWebSocket, 2000);
          }
        };

      } catch (error) {
        console.error("❌ Erro ao criar WebSocket:", error);
        if (shouldReconnect) {
          reconnectTimer = setTimeout(connectWebSocket, 2000);
        }
      }
    };

    connectWebSocket();

    return () => {
      console.log("🔌 Limpando WebSocket FORÇADO");
      shouldReconnect = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [selectedConnectionId, selectedConversation, generateMessageHash]);

  // BUSCAR CONVERSAS
  const { data: fetchedConversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: [`/api/connections/${selectedConnectionId}/conversations`],
    queryFn: async () => {
      if (!selectedConnectionId) return [];
      const response = await fetch(`/api/connections/${selectedConnectionId}/conversations?limit=50&skip=0`);
      return response.json();
    },
    enabled: !!selectedConnectionId,
    refetchOnWindowFocus: false
  });

  // ATUALIZAR lista de conversas quando carregar
  useEffect(() => {
    if (fetchedConversations.length > 0) {
      setConversationsList(fetchedConversations);
    }
  }, [fetchedConversations]);

  // BUSCAR MENSAGENS da conversa selecionada
  const { data: apiMessages = [] } = useQuery({
    queryKey: [`/api/connections/${selectedConnectionId}/conversations/${selectedConversation}/messages`],
    queryFn: async () => {
      if (!selectedConnectionId || !selectedConversation) return [];
      const response = await fetch(`/api/connections/${selectedConnectionId}/conversations/${selectedConversation}/messages`);
      return response.json();
    },
    enabled: !!selectedConnectionId && !!selectedConversation,
    refetchOnWindowFocus: false
  });

  // Limpar mensagens em tempo real quando trocar de conversa
  useEffect(() => {
    if (selectedConversation) {
      console.log(`🔄 Trocando para conversa ${selectedConversation}, limpando mensagens em tempo real`);
      setRealtimeMessages(prev => prev.filter(msg => msg.phoneNumber === selectedConversation));
      setProcessedMessageHashes(new Set()); // Limpa os hashes ao trocar de conversa
    }
  }, [selectedConversation]);

  // COMBINAR mensagens da API com mensagens em tempo real
  const allMessages = [
    ...apiMessages.map((msg: any) => ({
      id: msg.id,
      content: msg.content,
      phoneNumber: msg.phoneNumber,
      direction: msg.direction,
      timestamp: new Date(msg.timestamp),
      status: msg.status || 'delivered'
    })),
    ...realtimeMessages.filter(msg => msg.phoneNumber === selectedConversation)
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Função para adicionar mensagens localmente (feedback imediato)
  const addLocalMessage = (message: Omit<RealtimeMessage, 'id' | 'messageHash'>) => {
    setRealtimeMessages(prev => {
      const newMsg: RealtimeMessage = {
        ...message,
        id: message.tempId || `temp-${Date.now()}`, // Usar tempId como ID temporário
        status: 'pending',
        messageHash: generateMessageHash(message.content, message.phoneNumber, message.direction, message.timestamp)
      };
      return [...prev, newMsg];
    });

    // ATUALIZA lista de conversas
    setConversationsList(prevConvs => {
      const updated = prevConvs.map(conv => {
        if (conv.phoneNumber === message.phoneNumber) {
          return {
            ...conv,
            lastMessage: message.content,
            lastMessageTime: message.timestamp
          };
        }
        return conv;
      });

      // Se conversa não existe, adiciona
      const conversationExists = updated.some(conv => conv.phoneNumber === message.phoneNumber);
      if (!conversationExists) {
        updated.push({
          phoneNumber: message.phoneNumber,
          contactName: message.phoneNumber,
          lastMessage: message.content,
          lastMessageTime: message.timestamp,
          unreadCount: message.direction === 'received' ? 1 : 0,
          messageCount: 1
        });
      }

      return updated;
    });
  };

  // FUNÇÃO PARA ENVIAR MENSAGEM COM FEEDBACK IMEDIATO
  const sendMessageForced = async () => {
    if (!newMessage.trim() || !selectedConversation || !selectedConnectionId) return;

    const messageText = newMessage.trim();
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // ADICIONAR MENSAGEM LOCAL IMEDIATAMENTE PARA FEEDBACK
    addLocalMessage({
      tempId,
      content: messageText,
      phoneNumber: selectedConversation,
      direction: 'sent',
      timestamp: new Date(),
      status: 'pending'
    });

    // Limpar input imediatamente
    setNewMessage('');

    try {
      console.log(`📤 ENVIANDO MENSAGEM para ${selectedConversation}: ${messageText} (tempId: ${tempId})`);

      // ENVIAR para o servidor
      const response = await fetch(`/api/connections/${selectedConnectionId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedConversation,
          message: messageText,
          tempId // Enviar tempId para o backend poder associar
        })
      });

      if (response.ok) {
        console.log(`✅ Mensagem enviada com sucesso! WebSocket irá confirmar... (tempId: ${tempId})`);
      } else {
        console.error(`❌ Erro ao enviar mensagem:`, response.status);

        // Atualizar status da mensagem local para falha
        setRealtimeMessages(prev => prev.map(msg => 
          msg.tempId === tempId || msg.id === tempId 
            ? { ...msg, status: 'failed' as const }
            : msg
        ));
      }
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);

      // Atualizar status da mensagem local para falha
      setRealtimeMessages(prev => prev.map(msg => 
        msg.tempId === tempId || msg.id === tempId 
          ? { ...msg, status: 'failed' as const }
          : msg
      ));
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

  // FILTRAR conversas
  const filteredConversations = conversationsList.filter(conv => 
    conv.contactName?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    conv.phoneNumber.includes(searchFilter)
  );

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
      {/* LISTA DE CONVERSAS */}
      <div className="w-1/3 border-r flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Conversas
            <Badge variant={isWebSocketConnected ? "default" : "destructive"} className="ml-auto">
              {isWebSocketConnected ? "Online" : "Offline"}
            </Badge>
          </CardTitle>
        </CardHeader>

        {/* PESQUISA */}
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

        {/* LISTA DE CONVERSAS */}
        <ScrollArea className="flex-1">
          {filteredConversations.length === 0 && !conversationsLoading ? (
            <div className="p-6 text-center text-gray-500">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma conversa encontrada</p>
            </div>
          ) : (
            <div className="space-y-0">
              {filteredConversations.map((conversation, index) => (
                <button
                  key={conversation.phoneNumber || `conversation-${index}`}
                  onClick={() => setSelectedConversation(conversation.phoneNumber)}
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

                      <p className="text-sm text-gray-600 truncate">
                        {conversation.lastMessage}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ÁREA DE CHAT */}
      <div className="flex-1 flex flex-col">
        {!selectedConversation ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Nenhuma conversa selecionada</p>
              <p className="text-sm">Clique em uma conversa para começar</p>
            </div>
          </div>
        ) : (
          <>
            {/* HEADER DO CHAT */}
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

            {/* MENSAGENS */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {allMessages.map((message, index) => (
                  <div
                    key={`${message.id}-${index}`}
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
                        {message.direction === 'sent' && (
                          <span className="ml-1">
                            {message.status === 'sending' ? '⏳' : (message.status === 'failed' ? '❌' : '✓')}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* INPUT DE MENSAGEM */}
            <div className="p-4 border-t bg-white">
              <div className="flex gap-2">
                <Input
                  placeholder="Digite sua mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessageForced()}
                  className="flex-1"
                />
                <Button 
                  onClick={sendMessageForced} 
                  disabled={!newMessage.trim() || !isWebSocketConnected}
                >
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