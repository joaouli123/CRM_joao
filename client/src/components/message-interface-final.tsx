import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

            // APENAS processar mensagens RECEBIDAS do servidor (não enviadas)
            if (data.type === "messageReceived" && data.data) {
              const msgData = data.data;
              console.log(`📥 MENSAGEM RECEBIDA DO SERVIDOR: ${msgData.content} de ${msgData.phoneNumber}`);
              
              // Só adicionar se for para a conexão ativa E for realmente recebida (não enviada)
              if (msgData.connectionId === selectedConnectionId && msgData.direction === 'received') {
                console.log(`✅ ADICIONANDO MENSAGEM RECEBIDA EM TEMPO REAL!`);
                
                setRealtimeMessages((prev) => {
                  const exists = prev.some((m: any) => m.id === msgData.id);
                  if (exists) {
                    console.log(`⚠️ Mensagem já existe: ${msgData.id}`);
                    return prev;
                  }
                  
                  const newMsg = {
                    id: msgData.id,
                    content: msgData.content,
                    phoneNumber: msgData.phoneNumber,
                    direction: 'received', // Garantir que é recebida
                    timestamp: new Date(msgData.timestamp),
                    status: 'received'
                  };
                  
                  console.log(`🚀 MENSAGEM RECEBIDA ADICIONADA: Total ${prev.length + 1}`);
                  return [...prev, newMsg];
                });
              }
            }
            
            // Para debug - ignorar mensagens enviadas
            if (data.type === "newMessage" || data.type === "messageSent") {
              console.log(`📤 IGNORANDO mensagem enviada: ${data.data?.content}`);
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

  // Buscar conversas
  const { data: conversations = [] } = useQuery({
    queryKey: [`/api/connections/${selectedConnectionId}/conversations`],
    enabled: !!selectedConnectionId,
  });

  // Buscar mensagens do chat selecionado
  const { data: chatMessages = [] } = useQuery({
    queryKey: [`/api/connections/${selectedConnectionId}/conversations/${selectedConversation}/messages`],
    enabled: !!selectedConnectionId && !!selectedConversation,
  });

  // Combinar mensagens da API com mensagens em tempo real
  const allMessages = [
    ...chatMessages,
    ...realtimeMessages.filter((m) => m.phoneNumber === selectedConversation)
  ];

  // Debug - mostrar contagem de mensagens
  useEffect(() => {
    console.log(`📊 CONTAGEM MENSAGENS: API=${chatMessages.length}, Tempo Real=${realtimeMessages.length}, Total=${allMessages.length}`);
  }, [chatMessages.length, realtimeMessages.length, allMessages.length]);

  // Enviar mensagem
  const sendMessage = async (message: string) => {
    if (!selectedConversation || !selectedConnectionId || !message.trim()) return;

    try {
      console.log(`📤 ENVIANDO MENSAGEM: "${message}" para ${selectedConversation}`);
      
      // ADICIONAR MENSAGEM LOCALMENTE PRIMEIRO (para aparecer imediatamente)
      const localMessage = {
        id: `local-${Date.now()}`,
        content: message.trim(),
        phoneNumber: selectedConversation,
        direction: 'sent',
        timestamp: new Date(),
        status: 'sending'
      };
      
      setRealtimeMessages((prev) => [...prev, localMessage]);
      console.log(`🚀 MENSAGEM LOCAL ADICIONADA: ${message}`);
      
      const response = await fetch(`/api/connections/${selectedConnectionId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedConversation,
          message: message.trim()
        })
      });

      if (response.ok) {
        console.log(`✅ MENSAGEM ENVIADA COM SUCESSO!`);
        setNewMessage('');
        
        // Atualizar status da mensagem local para 'sent'
        setRealtimeMessages((prev) => 
          prev.map((msg) => 
            msg.id === localMessage.id 
              ? { ...msg, status: 'sent' }
              : msg
          )
        );
      } else {
        console.error('❌ Erro ao enviar mensagem');
        // Remover mensagem local se falhou
        setRealtimeMessages((prev) => 
          prev.filter((msg) => msg.id !== localMessage.id)
        );
      }
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
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
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Selecione uma conexão para ver as mensagens</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex h-full">
      {/* Lista de Conversas */}
      <div className="w-1/3 border-r">
        <Card className="h-full rounded-none border-0">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              Conversas
              {isConnected && (
                <Badge variant="outline" className="text-xs bg-green-100">
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
              {filteredConversations.map((conv: any) => (
                <div
                  key={conv.phoneNumber}
                  className={`p-4 border-b cursor-pointer hover:bg-muted transition-colors ${
                    selectedConversation === conv.phoneNumber ? 'bg-muted' : ''
                  }`}
                  onClick={() => {
                    console.log(`📱 SELECIONANDO CONVERSA: ${conv.phoneNumber}`);
                    setSelectedConversation(conv.phoneNumber);
                  }}
                >
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
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
                  </div>
                </div>
              ))}
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
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <Avatar>
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">
                      {filteredConversations.find((c: any) => c.phoneNumber === selectedConversation)?.contactName || selectedConversation}
                    </CardTitle>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <span>{selectedConversation}</span>
                      {isConnected && (
                        <Badge variant="outline" className="text-xs">
                          Online
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Mensagens */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {allMessages.map((message, index) => (
                  <div
                    key={`${message.id || index}-${message.timestamp}`}
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
                      <div className="flex items-center justify-end space-x-1 mt-1">
                        <Clock className="h-3 w-3 opacity-70" />
                        <span className="text-xs opacity-70">
                          {formatTime(new Date(message.timestamp))}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Indicador "Digitando..." */}
                {typing && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 text-gray-900 rounded-lg px-3 py-2 max-w-[70%]">
                      <p className="text-sm italic">O contato está digitando...</p>
                    </div>
                  </div>
                )}
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
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        sendMessage(newMessage);
                      }
                    }}
                    className="flex-1"
                  />
                  <Button 
                    onClick={() => sendMessage(newMessage)}
                    disabled={!newMessage.trim()}
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