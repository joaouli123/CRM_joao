import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export function ImportModal() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return apiRequest('/api/contacts/import', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Importação realizada com sucesso!",
        description: `${data.imported} contatos importados.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "❌ Erro na importação",
        description: error.message || "Erro ao processar arquivo",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      toast({
        title: "❌ Formato inválido",
        description: "Por favor, selecione um arquivo CSV ou Excel (.xlsx/.xls)",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho do arquivo (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "❌ Arquivo muito grande",
        description: "O arquivo deve ter no máximo 10MB",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    
    importMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="btn-secondary border-blue-500 text-blue-700 hover:bg-blue-50"
        >
          <Download className="mr-2 h-4 w-4 rotate-180" />
          Importar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-600" />
            Importar Contatos
          </DialogTitle>
          <DialogDescription>
            Faça upload de um arquivo CSV ou Excel com seus contatos.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Instruções */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2">📋 Formato do Arquivo</h4>
            <p className="text-sm text-blue-700 mb-2">Seu arquivo deve conter as seguintes colunas:</p>
            <div className="bg-white p-2 rounded border text-xs font-mono">
              NOME;TELEFONE;EMAIL;TAG;ORIGEM;DATA
            </div>
            <div className="mt-2 text-sm text-blue-600">
              <p>• <strong>NOME:</strong> Nome do contato (obrigatório)</p>
              <p>• <strong>TELEFONE:</strong> Número com DDD (obrigatório)</p>
              <p>• <strong>EMAIL:</strong> Email do contato (opcional)</p>
              <p>• <strong>TAG:</strong> lead, cliente, prospect, etc. (opcional)</p>
              <p>• <strong>ORIGEM:</strong> website, facebook, etc. (opcional)</p>
              <p>• <strong>DATA:</strong> Data no formato dd/MM/yyyy (opcional)</p>
            </div>
          </div>

          {/* Formatos aceitos */}
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h4 className="font-semibold text-green-900 mb-2">✅ Formatos Aceitos</h4>
            <div className="flex gap-3">
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium">.CSV</span>
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium">.XLSX</span>
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium">.XLS</span>
            </div>
          </div>

          {/* Área de Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-2">
              Clique para selecionar ou arraste seu arquivo aqui
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Arquivos CSV, XLSX ou XLS até 10MB
            </p>
            
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              id="import-file-input"
              disabled={importMutation.isPending}
            />
            
            <Button
              onClick={() => document.getElementById('import-file-input')?.click()}
              disabled={importMutation.isPending}
              className="btn-primary"
            >
              {importMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Selecionar Arquivo
                </>
              )}
            </Button>
          </div>

          {/* Exemplo */}
          <div className="bg-gray-50 p-4 rounded-lg border">
            <h4 className="font-semibold text-gray-900 mb-2">💡 Exemplo de linha no CSV:</h4>
            <div className="bg-white p-2 rounded border text-xs font-mono text-gray-700">
              João Silva;11999887766;joao@email.com;cliente;website;27/05/2025
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}