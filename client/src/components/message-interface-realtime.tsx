import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, Send, Phone, Clock, User, Search } from "lucide-react";
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
  const [selectedConversation, setSelectedConversation] = useState<string>("");
  const [newMessage, setNewMessage] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  
  // Estados para tempo real conforme especificação
  const [webSocket, setWebSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);

  // WebSocket para Evolution API - Tempo Real conforme especificação
  useEffect(() => {
    if (!selectedConversation || !selectedConnectionId) return;

    console.log(`🔌 Conectando WebSocket para o chat ${selectedConversation}!`);
    
    const wsUrl = `wss://${window.location.host}/api/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log(`✅ WebSocket conectado para o chat ${selectedConversation}!`);
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("📨 WebSocket evento recebido:", data);

        // MENSAGENS EM TEMPO REAL - PROCESSAR QUALQUER TIPO DE MENSAGEM
        if (data.type === "newMessage" || (data.data && data.data.content)) {
          console.log("🎯 Detectada nova mensagem:", data);
          
          // Extrair dados da mensagem do formato correto
          const messageData = data.data || data;
          
          console.log(`🔍 Verificando mensagem para conexão ${selectedConnectionId} e chat ${selectedConversation}`);
          console.log(`🔍 Mensagem é da conexão ${messageData.connectionId} e chat ${messageData.phoneNumber}`);
          
          // Só processa se for da conexão ativa e chat selecionado
          if (messageData.connectionId === selectedConnectionId && 
              messageData.phoneNumber === selectedConversation) {
            
            console.log(`🔥 PROCESSANDO MENSAGEM PARA CHAT ATIVO: ${selectedConversation}`);
            
            setMessages((prevMessages) => {
              // Evitar duplicação com base no ID ou conteúdo+timestamp
              const messageId = messageData.id || `${messageData.content}-${messageData.timestamp}`;
              const exists = prevMessages.some((m: any) => 
                m.id === messageId || 
                (m.content === messageData.content && Math.abs(new Date(m.timestamp).getTime() - new Date(messageData.timestamp).getTime()) < 1000)
              );
              
              if (exists) {
                console.log("🔁 Mensagem duplicada ignorada");
                return prevMessages;
              }
              
              // Adiciona nova mensagem FORÇANDO RENDER
              const newMessage = {
                id: messageId,
                content: messageData.content,
                phoneNumber: messageData.phoneNumber,
                direction: messageData.direction,
                timestamp: new Date(messageData.timestamp),
                status: messageData.direction === 'sent' ? 'sent' : 'received'
              };
              
              console.log(`✅ TEMPO REAL INSTANTÂNEO: "${messageData.content}" adicionada!`);
              console.log(`🚀 FORÇANDO RENDER - Nova lista terá ${prevMessages.length + 1} mensagens`);
              
              // FORÇA ATUALIZAÇÃO IMEDIATA
              const newList = [...prevMessages, newMessage];
              return newList;
            });
          } else {
            console.log(`⚠️ Mensagem ignorada - não é para este chat ativo`);
          }
        }

        // STATUS "DIGITANDO..." EM TEMPO REAL
        if (data.type === "typing" && data.phoneNumber === selectedConversation) {
          console.log(`✍️ ${data.phoneNumber} está digitando...`);
          setTyping(true);
          setTimeout(() => setTyping(false), 2000);
        }
      } catch (error) {
        console.error("❌ Erro ao processar mensagem WebSocket:", error);
      }
    };

    socket.onclose = () => {
      console.log("WebSocket desconectado.");
      setIsConnected(false);
    };

    socket.onerror = (error) => {
      console.error("❌ Erro no WebSocket:", error);
    };

    setWebSocket(socket);

    return () => {
      socket.close();
    };
  }, [selectedConversation, selectedConnectionId]);

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
      // Adiciona mensagem localmente para feedback instantâneo
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          content: message,
          phoneNumber: selectedConversation,
          timestamp: new Date(),
          direction: 'sent',
          status: 'sending'
        },
      ]);

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

  // Combina mensagens da API com mensagens em tempo real
  const allMessages = [...chatMessages, ...messages.filter(m => m.phoneNumber === selectedConversation)];

  const filteredConversations = conversations.filter((conv: any) =>
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
            <CardTitle className="text-lg">Conversas</CardTitle>
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
                  onClick={() => setSelectedConversation(conv.phoneNumber)}
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
                      {conversations.find((c: any) => c.phoneNumber === selectedConversation)?.contactName || selectedConversation}
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
                {allMessages.map((message, index) => {
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
                      <div className="flex items-center justify-end space-x-1 mt-1">
                        <Clock className="h-3 w-3 opacity-70" />
                        <span className="text-xs opacity-70">
                          {formatTime(new Date(message.timestamp))}
                        </span>
                      </div>
                    </div>
                  </div>
                  );
                })}
                
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
                      sendTypingNotification();
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