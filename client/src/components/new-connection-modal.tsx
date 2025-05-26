import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertConnectionSchema, type InsertConnection } from "@shared/schema";

interface NewConnectionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewConnectionModal({ open, onClose, onSuccess }: NewConnectionModalProps) {
  const { toast } = useToast();
  
  const form = useForm<InsertConnection>({
    resolver: zodResolver(insertConnectionSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertConnection) => {
      return apiRequest('POST', '/api/connections', data);
    },
    onSuccess: () => {
      toast({
        title: "Conexão criada",
        description: "Nova conexão WhatsApp foi criada com sucesso",
      });
      form.reset();
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar conexão",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertConnection) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Conexão WhatsApp</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome da Conexão</Label>
            <Input
              id="name"
              placeholder="Ex: Vendas, Suporte, Marketing..."
              {...form.register("name")}
              className="mt-1"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-error mt-1">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Descrição (Opcional)</Label>
            <Textarea
              id="description"
              placeholder="Breve descrição do uso desta conexão..."
              rows={2}
              {...form.register("description")}
              className="mt-1 resize-none"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Criando..." : "Criar Conexão"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
