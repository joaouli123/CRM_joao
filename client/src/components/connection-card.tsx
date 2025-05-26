import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, MoreVertical, QrCode, RotateCcw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Connection } from "@shared/schema";

interface ConnectionCardProps {
  connection: Connection;
  onShowQR: (connection: Connection) => void;
  onOpenMessages: (connectionId: number) => void;
}

export default function ConnectionCard({ connection, onShowQR, onOpenMessages }: ConnectionCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const reconnectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/connections/${connection.id}/reconnect`);
    },
    onSuccess: () => {
      toast({
        title: "Reconectando",
        description: "Tentativa de reconexão iniciada",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao reconectar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/connections/${connection.id}`);
    },
    onSuccess: () => {
      toast({
        title: "Conexão removida",
        description: "Conexão foi removida com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover conexão",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = () => {
    switch (connection.status) {
      case "connected":
        return <Badge className="bg-green-100 text-secondary">Conectado</Badge>;
      case "qr_pending":
        return <Badge className="bg-orange-100 text-warning">Aguardando QR</Badge>;
      case "connecting":
        return <Badge className="bg-blue-100 text-primary">Conectando</Badge>;
      default:
        return <Badge variant="secondary">Desconectado</Badge>;
    }
  };

  const formatLastActivity = (date: Date | null) => {
    if (!date) return "Nunca";
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) return "Agora";
    if (minutes < 60) return `${minutes} min atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    return `${days}d atrás`;
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-gray-900">{connection.name}</h4>
          {getStatusBadge()}
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Status:</span>
            <span className={`font-medium ${
              connection.status === 'connected' ? 'text-secondary' : 
              connection.status === 'qr_pending' ? 'text-warning' : 'text-error'
            }`}>
              {connection.status === 'connected' ? 'Online' : 
               connection.status === 'qr_pending' ? 'Aguardando scan' : 'Offline'}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Mensagens:</span>
            <span className="text-gray-900 font-medium">{connection.messageCount || 0} total</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Última atividade:</span>
            <span className="text-gray-900 font-medium">
              {formatLastActivity(connection.lastActivity)}
            </span>
          </div>
        </div>

        <div className="flex space-x-2 mt-4">
          {connection.status === 'connected' && (
            <Button 
              className="flex-1" 
              onClick={() => onOpenMessages(connection.id)}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Mensagens
            </Button>
          )}
          
          {connection.status === 'qr_pending' && connection.qrCode && (
            <Button 
              className="flex-1 bg-warning hover:bg-orange-600" 
              onClick={() => onShowQR(connection)}
            >
              <QrCode className="w-4 h-4 mr-2" />
              Ver QR Code
            </Button>
          )}
          
          {connection.status === 'disconnected' && (
            <Button 
              className="flex-1" 
              onClick={() => reconnectMutation.mutate()}
              disabled={reconnectMutation.isPending}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {reconnectMutation.isPending ? 'Conectando...' : 'Reconectar'}
            </Button>
          )}
          
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => {
              if (confirm('Tem certeza que deseja remover esta conexão?')) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
