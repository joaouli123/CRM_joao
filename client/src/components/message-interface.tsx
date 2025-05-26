import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, Send, Phone, Clock, User } from "lucide-react";
import { Connection, Conversation, Message } from "@/lib/api";

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

  // Get connected connections only
  const connectedConnections = connections.filter(conn => conn.status === "connected");

  // Fetch conversations for selected connection
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/connections", selectedConnectionId, "conversations"],
    enabled: !!selectedConnectionId,
  });

  // Fetch messages for selected conversation
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/connections", selectedConnectionId, "conversations", selectedConversation, "messages"],
    enabled: !!selectedConnectionId && !!selectedConversation,
  });

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString("pt-BR", { 
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffDays = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Ontem";
    if (diffDays < 7) return `${diffDays} dias atrás`;
    return messageDate.toLocaleDateString("pt-BR");
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConnectionId || !selectedConversation) return;
    
    try {
      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: selectedConnectionId,
          to: selectedConversation,
          message: newMessage,
        }),
      });
      
      if (response.ok) {
        setNewMessage("");
        // Messages will be updated via WebSocket
      }
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
    }
  };

  return (
    <div className="flex h-[calc(100vh-200px)] gap-4">
      {/* Connection Selector */}
      <Card className="w-80">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Conexões WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {connectedConnections.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma conexão ativa</p>
                <p className="text-sm">Conecte um WhatsApp primeiro</p>
              </div>
            ) : (
              connectedConnections.map((connection) => (
                <Button
                  key={connection.id}
                  variant={selectedConnectionId === connection.id ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => {
                    onSelectConnection(connection.id);
                    setSelectedConversation(null);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <div className="text-left">
                      <div className="font-medium">{connection.name}</div>
                      <div className="text-xs text-gray-500">
                        {connection.phoneNumber || "WhatsApp Conectado"}
                      </div>
                    </div>
                  </div>
                </Button>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Conversations List */}
      {selectedConnectionId && (
        <Card className="w-80">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Conversas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {conversations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma conversa encontrada</p>
                  </div>
                ) : (
                  conversations.map((conversation) => (
                    <Button
                      key={conversation.phoneNumber}
                      variant={selectedConversation === conversation.phoneNumber ? "default" : "ghost"}
                      className="w-full p-3 h-auto justify-start"
                      onClick={() => setSelectedConversation(conversation.phoneNumber)}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            <User className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="font-medium truncate">
                              {conversation.contactName}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime(conversation.lastMessageTime)}
                            </div>
                          </div>
                          <div className="text-sm text-gray-500 truncate">
                            {conversation.lastMessage}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {conversation.messageCount} mensagens
                            </Badge>
                            {conversation.unreadCount > 0 && (
                              <Badge className="text-xs">
                                {conversation.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </Button>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Messages Area */}
      {selectedConnectionId && selectedConversation && (
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              {selectedConversation}
            </CardTitle>
            <Separator />
          </CardHeader>
          <CardContent className="flex flex-col h-[500px]">
            {/* Messages List */}
            <ScrollArea className="flex-1 mb-4">
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma mensagem encontrada</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.direction === "sent" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] p-3 rounded-lg ${
                          message.direction === "sent"
                            ? "bg-blue-500 text-white"
                            : "bg-gray-100 text-gray-900"
                        }`}
                      >
                        <div className="text-sm">{message.content}</div>
                        <div className="flex items-center justify-between mt-1">
                          <div
                            className={`text-xs ${
                              message.direction === "sent"
                                ? "text-blue-100"
                                : "text-gray-500"
                            }`}
                          >
                            {formatTime(message.timestamp)}
                          </div>
                          {message.direction === "sent" && (
                            <Badge
                              variant={message.status === "delivered" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {message.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="flex gap-2">
              <Input
                placeholder="Digite sua mensagem..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                className="flex-1"
              />
              <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Welcome State */}
      {!selectedConnectionId && (
        <Card className="flex-1">
          <CardContent className="flex items-center justify-center h-[500px]">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">Bem-vindo ao WhatsApp Hub</h3>
              <p className="text-gray-500 mb-4">
                Selecione uma conexão WhatsApp para ver suas conversas e mensagens
              </p>
              <p className="text-sm text-gray-400">
                Todas as suas mensagens serão atualizadas em tempo real
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}