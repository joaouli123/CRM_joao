import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, Clock, RotateCcw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface QRCodeModalProps {
  open: boolean;
  onClose: () => void;
  qrData: {
    connectionId: number;
    qrCode: string;
    expiration: Date;
  } | null;
}

export function QRCodeModal({ open, onClose, qrData }: QRCodeModalProps) {
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
    if (qrData) {
      startConnectionMutation.mutate(qrData.connectionId);
    }
  };

  useEffect(() => {
    if (!qrData?.expiration || !open) {
      setTimeLeft(0);
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(qrData.expiration).getTime();
      const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [qrData?.expiration, open]);

  if (!qrData) return null;

  // Clean QR code to prevent double base64 prefix
  const cleanQrCode = qrData.qrCode.replace(/^data:image\/png;base64,data:image\/png;base64,/, 'data:image/png;base64,');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar WhatsApp - Conexão #{qrData.connectionId}</DialogTitle>
        </DialogHeader>
        
        <div className="text-center space-y-4">
          <div className="w-64 h-64 bg-gray-100 rounded-lg mx-auto flex items-center justify-center border-2 border-dashed border-gray-300">
            {cleanQrCode ? (
              <img
                src={cleanQrCode}
                alt="QR Code WhatsApp"
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  console.error('Erro ao carregar QR Code:', e);
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="text-center">
                <QrCode className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Gerando QR Code...</p>
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
            {timeLeft === 0 && qrData && (
              <div className="text-sm text-red-600">
                QR Code expirado - clique em "Atualizar QR Code"
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
