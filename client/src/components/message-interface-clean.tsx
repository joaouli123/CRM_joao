import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Send, User, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

interface Connection {
  id: number;
  name: string;
  status: string;
  profileName?: string;
  phoneNumber?: string;
}

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

export default function MessageInterface({ 
  connections, 
  selectedConnectionId, 
  onSelectConnection 
}: MessageInterfaceProps) {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [realtimeMessages, setRealtimeMessages] = useState<RealtimeMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // WebSocket para mensagens em tempo real
  useEffect(() => {
    let socket: WebSocket;
    let reconnectTimer: NodeJS.Timeout;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/ws`;
      console.log(`🔌 Conectando WebSocket em: ${wsUrl}`);

      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        if (reconnectTimer) clearTimeout(reconnectTimer);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("WebSocket message received:", data);

          if (data.type === "newMessage" && data.data) {
            const msgData = data.data;

            if (msgData.connectionId === selectedConnectionId) {
              console.log(`📨 NOVA MENSAGEM: ${msgData.content} | Direção: ${msgData.direction}`);
              
              setRealtimeMessages((prev) => {
                const allMessagesMap = new Map();

                // Adicionar mensagens existentes ao Map
                prev.forEach((msg) => {
                  const key = msg.tempId || msg.id;
                  allMessagesMap.set(key, msg);
                });

                // Se a mensagem tem ID oficial, processar substituição
                if (msgData.id) {
                  // Verificar se já existe mensagem com este ID
                  if (allMessagesMap.has(msgData.id)) {
                    console.log(`⚠️ Mensagem ${msgData.id} JÁ EXISTE, ignorando duplicação`);
                    return prev;
                  }

                  // Se tem tempId, substituir mensagem temporária
                  if (msgData.tempId && allMessagesMap.has(msgData.tempId)) {
                    console.log(`🔄 SUBSTITUINDO tempId=${msgData.tempId} por id=${msgData.id}`);
                    allMessagesMap.delete(msgData.tempId);
                    allMessagesMap.set(msgData.id, {
                      id: msgData.id,
                      content: msgData.content,
                      phoneNumber: msgData.phoneNumber,
                      direction: msgData.direction,
                      timestamp: new Date(msgData.timestamp),
                      status: 'sent'
                    });
                  } else {
                    // Nova mensagem oficial
                    console.log(`➕ ADICIONANDO nova mensagem: ${msgData.id}`);
                    allMessagesMap.set(msgData.id, {
                      id: msgData.id,
                      content: msgData.content,
                      phoneNumber: msgData.phoneNumber,
                      direction: msgData.direction,
                      timestamp: new Date(msgData.timestamp),
                      status: msgData.direction === 'sent' ? 'sent' : 'received'
                    });
                  }
                }

                return Array.from(allMessagesMap.values());
              });
            }
          }

          // Atualização de status de entrega
          if (data.type === 'messageReceived' && data.data) {
            const msgData = data.data;
            console.log(`📬 CONFIRMAÇÃO DE ENTREGA: ${msgData.id}`);
            
            setRealtimeMessages((prev) => 
              prev.map((msg) => 
                msg.id === msgData.id 
                  ? { ...msg, status: 'delivered' }
                  : msg
              )
            );
          }

          // Status de falha
          if (data.type === 'messageFailed' && data.data) {
            const msgData = data.data;
            console.log(`❌ FALHA NA ENTREGA: ${msgData.id}`);
            
            setRealtimeMessages((prev) => 
              prev.map((msg) => 
                msg.id === msgData.id 
                  ? { ...msg, status: 'failed' }
                  : msg
              )
            );
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
    };

    if (selectedConnectionId) {
      connectWebSocket();
    }

    return () => {
      if (socket) {
        socket.close();
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [selectedConnectionId]);

  // Buscar conversas
  const { data: conversations = [], isLoading: isLoadingConversations } = useQuery({
    queryKey: [`/api/connections/${selectedConnectionId}/conversations`],
    enabled: !!selectedConnectionId,
    refetchInterval: 5000
  });

  // Buscar mensagens do chat selecionado
  const { data: chatMessages = [], isLoading: isLoadingMessages } = useQuery({
    queryKey: [`/api/connections/${selectedConnectionId}/messages/${selectedConversation}`],
    enabled: !!selectedConnectionId && !!selectedConversation,
    refetchInterval: 2000,
    refetchIntervalInBackground: true
  });

  // Combinar mensagens sem duplicação
  const allMessagesMap = new Map();

  [
    ...(Array.isArray(chatMessages) ? chatMessages : []),
    ...realtimeMessages.filter((m) => m.phoneNumber === selectedConversation)
  ].forEach((msg) => {
    const key = `${msg.id || msg.tempId}`;
    // Priorizar mensagens com ID real
    if (!allMessagesMap.has(key) || (msg.id && !allMessagesMap.get(key).id)) {
      allMessagesMap.set(key, msg);
    }
  });

  const allMessages = Array.from(allMessagesMap.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Auto scroll com verificação de segurança
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [allMessages]);

  // Enviar mensagem
  const sendMessage = async (message: string) => {
    if (!selectedConversation || !selectedConnectionId || !message.trim()) return;

    const tempId = crypto.randomUUID();
    const tempMessage = {
      id: tempId,
      tempId,
      content: message.trim(),
      phoneNumber: selectedConversation,
      direction: 'sent' as const,
      timestamp: new Date(),
      status: 'pending' as const
    };

    // Adicionar mensagem temporária
    setRealtimeMessages((prev) => [...prev, tempMessage]);
    setNewMessage('');
    console.log(`⏳ MENSAGEM TEMPORÁRIA: ${tempId}`);

    try {
      const response = await fetch(`/api/connections/${selectedConnectionId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedConversation,
          message: message.trim(),
          tempId
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
        console.log(`✅ MENSAGEM ENVIADA: ${tempId}`);
      } else {
        setRealtimeMessages((prev) => 
          prev.map((msg) => 
            msg.tempId === tempId 
              ? { ...msg, status: 'failed' }
              : msg
          )
        );
      }
    } catch (error) {
      setRealtimeMessages((prev) => 
        prev.map((msg) => 
          msg.tempId === tempId 
            ? { ...msg, status: 'failed' }
            : msg
        )
      );
      console.error('❌ Erro ao enviar:', error);
    }
  };

  const filteredConversations = (conversations as any[]).filter((conv: any) =>
    conv.contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.phoneNumber?.includes(searchTerm)
  );

  const formatTime = (date: Date) => {
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return format(date, "'Ontem' HH:mm", { locale: pt });
    } else {
      return format(date, 'dd/MM/yyyy HH:mm', { locale: pt });
    }
  };

  if (!selectedConnectionId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <User className="h-12 w-12 mb-2" />
        <p>Selecione uma conexão para ver as mensagens</p>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white">
      {/* Sidebar de Conversas */}
      <div className="w-1/3 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b bg-gray-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar conversas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoadingConversations ? (
            <div className="p-4 text-center text-gray-500">
              Carregando conversas...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              Nenhuma conversa encontrada
            </div>
          ) : (
            filteredConversations.map((conversation: any) => (
              <div
                key={conversation.phoneNumber}
                onClick={() => setSelectedConversation(conversation.phoneNumber)}
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                  selectedConversation === conversation.phoneNumber ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">
                      {conversation.contactName || conversation.phoneNumber}
                    </h4>
                    <p className="text-sm text-gray-600 truncate mt-1">
                      {conversation.lastMessage}
                    </p>
                  </div>
                  <div className="text-xs text-gray-500 ml-2">
                    {formatTime(new Date(conversation.lastMessageTime))}
                  </div>
                </div>
                {conversation.unreadCount > 0 && (
                  <div className="mt-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-500 text-white">
                      {conversation.unreadCount}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Área de Mensagens */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Header */}
            <div className="p-4 border-b bg-gray-50 flex items-center">
              <div className="flex-1">
                <h3 className="font-medium">
                  {filteredConversations.find(c => c.phoneNumber === selectedConversation)?.contactName || selectedConversation}
                </h3>
                <p className="text-sm text-gray-500">
                  {isConnected ? '🟢 Online' : '🔴 Desconectado'}
                </p>
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoadingMessages ? (
                <div className="text-center text-gray-500">
                  Carregando mensagens...
                </div>
              ) : allMessages.length === 0 ? (
                <div className="text-center text-gray-500">
                  Nenhuma mensagem ainda
                </div>
              ) : (
                allMessages.map((message) => (
                  <div
                    key={message.id || message.tempId}
                    className={`flex ${message.direction === 'sent' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.direction === 'sent'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-900'
                      }`}
                    >
                      <p className="break-words">{message.content}</p>
                      <div className="flex items-center justify-end mt-1 space-x-1">
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
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de Mensagem */}
            <div className="p-4 border-t bg-gray-50">
              <div className="flex space-x-2">
                <Input
                  placeholder="Digite sua mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(newMessage);
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={() => sendMessage(newMessage)}
                  disabled={!newMessage.trim()}
                  className="px-4"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <User className="h-12 w-12 mx-auto mb-2" />
              <p>Selecione uma conversa para começar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}