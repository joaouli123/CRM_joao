import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, Clock, RotateCcw } from "lucide-react";

interface QRCodeModalProps {
  open: boolean;
  onClose: () => void;
  qrData: {
    connectionId: number;
    qrCode: string;
    expiration: Date;
  } | null;
}

export default function QRCodeModal({ open, onClose, qrData }: QRCodeModalProps) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!qrData || !open) {
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
  }, [qrData, open]);

  if (!qrData) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar WhatsApp</DialogTitle>
        </DialogHeader>
        
        <div className="text-center space-y-4">
          <div className="w-64 h-64 bg-gray-100 rounded-lg mx-auto flex items-center justify-center border-2 border-dashed border-gray-300">
            {qrData.qrCode ? (
              <img 
                src={qrData.qrCode} 
                alt="QR Code" 
                className="w-full h-full object-contain rounded-lg"
              />
            ) : (
              <div className="text-center">
                <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">QR Code será exibido aqui</p>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <p className="font-medium text-gray-900">Escaneie o QR Code</p>
            <p className="text-sm text-gray-600">
              Abra o WhatsApp no seu celular e escaneie este código
            </p>
            
            <div className="flex items-center justify-center space-x-2 text-sm">
              <Clock className="w-4 h-4 text-warning" />
              <span className={`font-medium ${timeLeft > 10 ? 'text-warning' : 'text-error'}`}>
                Expira em: {timeLeft}s
              </span>
            </div>
            
            {timeLeft === 0 && (
              <p className="text-error text-sm">QR Code expirado. Feche e tente novamente.</p>
            )}
          </div>
        </div>

        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={onClose}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
