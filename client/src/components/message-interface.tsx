import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, ArrowRight, ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Connection, Message } from "@shared/schema";

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
  const [phoneNumber, setPhoneNumber] = useState("");
  const [messageText, setMessageText] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const selectedConnection = connections.find(c => c.id === selectedConnectionId);

  // Fetch messages for selected connection
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/connections", selectedConnectionId, "messages"],
    enabled: !!selectedConnectionId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { connectionId: number; to: string; message: string }) => {
      return apiRequest('POST', '/api/messages/send', data);
    },
    onSuccess: () => {
      toast({
        title: "Mensagem enviada",
        description: "Mensagem foi enviada com sucesso",
      });
      setMessageText("");
      queryClient.invalidateQueries({ 
        queryKey: ["/api/connections", selectedConnectionId, "messages"] 
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!selectedConnectionId || !phoneNumber.trim() || !messageText.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o número e a mensagem",
        variant: "destructive",
      });
      return;
    }

    sendMessageMutation.mutate({
      connectionId: selectedConnectionId,
      to: phoneNumber,
      message: messageText,
    });
  };

  const formatTime = (date: Date | null) => {
    if (!date) return "";
    return new Date(date).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatPhoneNumber = (phone: string) => {
    // Remove country code and format for Brazilian numbers
    return phone.replace(/^\+55/, "").replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  };

  return (
    <div className="flex h-full space-x-6">
      {/* Connection List */}
      <div className="w-1/3 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Conexões Ativas</h3>
        
        {connections.length > 0 ? (
          <div className="space-y-3">
            {connections.map((connection) => (
              <div
                key={connection.id}
                onClick={() => onSelectConnection(connection.id)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedConnectionId === connection.id
                    ? "bg-blue-50 border-l-4 border-primary"
                    : "bg-gray-50 hover:bg-gray-100"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900">{connection.name}</h4>
                  <Badge variant="secondary" className="bg-green-100 text-secondary text-xs">
                    Online
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {connection.messageCount || 0} mensagens
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Nenhuma conexão ativa</p>
          </div>
        )}
      </div>

      {/* Message Interface */}
      <div className="flex-1 flex flex-col space-y-6">
        {selectedConnection ? (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Teste de Mensagens</h3>
              <Badge className="bg-green-100 text-secondary">
                {selectedConnection.name} - Online
              </Badge>
            </div>

            {/* Send Message Form */}
            <Card>
              <CardContent className="p-6">
                <h4 className="font-medium text-gray-900 mb-4">Enviar Mensagem de Teste</h4>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="phone">Número de Destino</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+55 (11) 99999-9999"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="message">Mensagem</Label>
                    <Textarea
                      id="message"
                      rows={3}
                      placeholder="Digite sua mensagem aqui..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      className="mt-1 resize-none"
                    />
                  </div>
                  <Button 
                    onClick={handleSendMessage}
                    disabled={sendMessageMutation.isPending || !phoneNumber.trim() || !messageText.trim()}
                    className="flex items-center space-x-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {sendMessageMutation.isPending ? "Enviando..." : "Enviar Mensagem"}
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Message History */}
            <Card className="flex-1">
              <CardContent className="p-6 flex flex-col h-full">
                <h4 className="font-medium text-gray-900 mb-4">
                  Histórico de Mensagens (Últimas 24h)
                </h4>
                <div className="flex-1 space-y-3 overflow-y-auto">
                  {messages.length > 0 ? (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex items-start space-x-3 p-3 rounded-lg ${
                          message.direction === "sent" ? "bg-blue-50" : "bg-gray-50"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          message.direction === "sent" ? "bg-primary" : "bg-green-500"
                        }`}>
                          {message.direction === "sent" ? (
                            <ArrowRight className="text-white text-xs" />
                          ) : (
                            <ArrowLeft className="text-white text-xs" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900">
                              {message.direction === "sent" 
                                ? formatPhoneNumber(message.to)
                                : formatPhoneNumber(message.from)
                              }
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatTime(message.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mt-1">{message.body}</p>
                          <span className={`text-xs mt-1 inline-block ${
                            message.status === "sent" ? "text-secondary" :
                            message.status === "delivered" ? "text-blue-600" :
                            message.status === "failed" ? "text-error" : "text-gray-500"
                          }`}>
                            {message.status === "sent" && "Enviada"}
                            {message.status === "delivered" && "Entregue"}
                            {message.status === "read" && "Lida"}
                            {message.status === "failed" && "Falhou"}
                            {message.status === "pending" && "Pendente"}
                            {message.direction === "received" && "Recebida"}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Nenhuma mensagem encontrada</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Selecione uma conexão
              </h3>
              <p className="text-gray-500">
                Escolha uma conexão ativa para enviar mensagens de teste
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
