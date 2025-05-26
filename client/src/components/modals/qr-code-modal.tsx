import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, Clock, RotateCcw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  connection: {
    id: number;
    name: string;
    qrCode?: string;
    qrExpiry?: Date;
  } | null;
}

export function QRCodeModal({ isOpen, onClose, connection }: QRCodeModalProps) {
  const [timeLeft, setTimeLeft] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const startConnectionMutation = useMutation({
    mutationFn: api.startConnection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
      toast({
        title: "Conexão iniciada",
        description: "Aguardando escaneamento do QR Code",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao iniciar conexão",
        variant: "destructive",
      });
    },
  });

  const handleRefreshQR = () => {
    if (connection) {
      startConnectionMutation.mutate(connection.id);
    }
  };

  useEffect(() => {
    if (!connection?.qrExpiry || !isOpen) {
      setTimeLeft(0);
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(connection.qrExpiry!).getTime();
      const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [connection?.qrExpiry, isOpen]);

  if (!connection) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar WhatsApp - {connection.name}</DialogTitle>
        </DialogHeader>
        
        <div className="text-center space-y-4">
          <div className="w-64 h-64 bg-gray-100 rounded-lg mx-auto flex items-center justify-center border-2 border-dashed border-gray-300">
            {connection.qrCode ? (
              <img
                src={connection.qrCode}
                alt="QR Code"
                className="max-w-full max-h-full"
              />
            ) : (
              <div className="text-center">
                <QrCode className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">QR Code será exibido aqui</p>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <p className="font-medium text-gray-900">Escaneie o QR Code</p>
            <p className="text-sm text-gray-600">
              Abra o WhatsApp no seu celular e escaneie este código
            </p>
            {timeLeft > 0 && (
              <div className="flex items-center justify-center space-x-2 text-sm">
                <Clock className="h-4 w-4 text-warning" />
                <span className="text-warning font-medium">
                  Expira em: {timeLeft}s
                </span>
              </div>
            )}
          </div>
          
          <Button
            onClick={handleRefreshQR}
            disabled={startConnectionMutation.isPending}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <RotateCcw className="h-4 w-4" />
            <span>
              {startConnectionMutation.isPending ? "Atualizando..." : "Atualizar QR Code"}
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
