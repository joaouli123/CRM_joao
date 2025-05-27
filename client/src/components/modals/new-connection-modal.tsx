import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface NewConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewConnectionModal({ isOpen, onClose }: NewConnectionModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Função para gerar QR Code
  const generateQRCode = async (connectionId: number) => {
    try {
      console.log(`🔄 Gerando QR Code para conexão ${connectionId}`);
      const response = await fetch(`/api/connections/${connectionId}/qr`);
      if (response.ok) {
        const qrData = await response.json();
        console.log('✅ QR Code gerado:', qrData);
      }
    } catch (error) {
      console.error('❌ Erro ao gerar QR Code:', error);
    }
  };

  const createConnectionMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      console.log('🔄 Criando nova conexão:', data);
      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Falha ao criar conexão');
      const result = await response.json();
      console.log('✅ Conexão criada:', result);
      return result;
    },
    onSuccess: (newConnection) => {
      queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      
      // Gerar QR Code automaticamente após criar conexão
      generateQRCode(newConnection.id);
      
      toast({
        title: "Conexão criada!",
        description: "QR Code está sendo gerado...",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao criar conexão",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: "Erro",
        description: "Nome da conexão é obrigatório",
        variant: "destructive",
      });
      return;
    }
    
    createConnectionMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Conexão WhatsApp</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome da Conexão</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Vendas, Suporte, Marketing..."
              className="mt-2"
            />
          </div>
          
          <div>
            <Label htmlFor="description">Descrição (Opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição do uso desta conexão..."
              rows={2}
              className="mt-2 resize-none"
            />
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createConnectionMutation.isPending}
              className="bg-primary hover:bg-blue-700"
            >
              {createConnectionMutation.isPending ? "Criando..." : "Criar Conexão"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
