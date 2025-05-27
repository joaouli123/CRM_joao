import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Phone, Mail, User, Search, Plus, Edit, Trash2, ChevronLeft, ChevronRight, Users, Tag, MessageCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import type { Contact } from '@shared/schema';

interface ContactsResponse {
  contacts: Contact[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface ContactsPageProps {
  onOpenChat?: (phoneNumber: string, contactName: string) => void;
}

interface ContactFormData {
  name: string;
  phoneNumber: string;
  email: string;
  observacao: string;
  etiqueta: string;
}

const ETIQUETAS = [
  { value: 'lead', label: 'Lead', color: 'bg-blue-500' },
  { value: 'qualificado', label: 'Qualificado', color: 'bg-green-500' },
  { value: 'desqualificado', label: 'Desqualificado', color: 'bg-red-500' },
  { value: 'cliente', label: 'Cliente', color: 'bg-purple-500' },
  { value: 'prospect', label: 'Prospect', color: 'bg-yellow-500' },
  { value: 'importante', label: 'Importante', color: 'bg-orange-500' }
];

export default function ContactsPage({ onOpenChat }: ContactsPageProps = {}) {
  const [selectedConnection] = useState(36); // Conexão padrão
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    phoneNumber: '',
    email: '',
    observacao: '',
    etiqueta: ''
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const limit = 20;

  // Query para buscar contatos
  const { data: contactsData, isLoading, error } = useQuery<ContactsResponse>({
    queryKey: ['contacts', selectedConnection, currentPage, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(searchTerm && { search: searchTerm })
      });
      
      const response = await fetch(`/api/connections/${selectedConnection}/contacts?${params}`);
      if (!response.ok) {
        throw new Error('Erro ao carregar contatos');
      }
      return response.json();
    }
  });

  // Mutation para criar contato
  const createContactMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      const response = await fetch(`/api/connections/${selectedConnection}/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar contato');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsAddModalOpen(false);
      resetForm();
      toast({
        title: "Sucesso!",
        description: "Contato criado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar contato",
        variant: "destructive",
      });
    }
  });

  // Mutation para atualizar contato
  const updateContactMutation = useMutation({
    mutationFn: async (data: ContactFormData & { id: number }) => {
      const response = await fetch(`/api/contacts/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar contato');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setEditingContact(null);
      resetForm();
      toast({
        title: "Sucesso!",
        description: "Contato atualizado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar contato",
        variant: "destructive",
      });
    }
  });

  // Mutation para deletar contato
  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: number) => {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao deletar contato');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast({
        title: "Sucesso!",
        description: "Contato excluído com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir contato",
        variant: "destructive",
      });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      phoneNumber: '',
      email: '',
      observacao: '',
      etiqueta: ''
    });
  };

  const handleEditClick = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      phoneNumber: contact.phoneNumber,
      email: contact.email || '',
      observacao: contact.observacao || '',
      etiqueta: contact.etiqueta || ''
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.phoneNumber.trim()) {
      toast({
        title: "Erro",
        description: "Nome e telefone são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (editingContact) {
      updateContactMutation.mutate({ ...formData, id: editingContact.id });
    } else {
      createContactMutation.mutate(formData);
    }
  };

  const handleDeleteContact = (contactId: number) => {
    deleteContactMutation.mutate(contactId);
  };

  const getEtiquetaConfig = (etiqueta: string | null) => {
    if (!etiqueta) return null;
    return ETIQUETAS.find(e => e.value === etiqueta);
  };

  // Debounce da busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1); // Reset para primeira página ao buscar
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const totalPages = contactsData?.pagination.pages || 1;
  const contacts = contactsData?.contacts || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Contatos
          </h1>
          <p className="text-muted-foreground">
            Gerencie todos os seus contatos do WhatsApp
          </p>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Contatos</p>
                <p className="text-2xl font-bold">{contactsData?.pagination.total || 0}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Leads</p>
                <p className="text-2xl font-bold">
                  {contacts.filter(c => c.etiqueta === 'lead').length}
                </p>
              </div>
              <Tag className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Clientes</p>
                <p className="text-2xl font-bold">
                  {contacts.filter(c => c.etiqueta === 'cliente').length}
                </p>
              </div>
              <User className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de ações */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou etiqueta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Novo Contato
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Novo Contato</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome completo"
                  required
                />
              </div>

              <div>
                <Label htmlFor="phoneNumber">Telefone *</Label>
                <Input
                  id="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  placeholder="55XX XXXXX-XXXX"
                  required
                />
              </div>

              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                />
              </div>

              <div>
                <Label htmlFor="etiqueta">Etiqueta</Label>
                <Select value={formData.etiqueta} onValueChange={(value) => setFormData(prev => ({ ...prev, etiqueta: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma etiqueta" />
                  </SelectTrigger>
                  <SelectContent>
                    {ETIQUETAS.map((etiqueta) => (
                      <SelectItem key={etiqueta.value} value={etiqueta.value}>
                        {etiqueta.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="observacao">Observação</Label>
                <Textarea
                  id="observacao"
                  value={formData.observacao}
                  onChange={(e) => setFormData(prev => ({ ...prev, observacao: e.target.value }))}
                  placeholder="Anotações sobre o contato..."
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createContactMutation.isPending}>
                  {createContactMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de contatos */}
      <Card>
        <CardHeader>
          <CardTitle>
            Lista de Contatos ({contactsData?.pagination.total || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              Erro ao carregar contatos
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'Nenhum contato encontrado para sua busca' : 'Nenhum contato cadastrado ainda'}
            </div>
          ) : (
            <div className="space-y-4">
              {contacts.map((contact) => {
                const etiquetaConfig = getEtiquetaConfig(contact.etiqueta);
                
                return (
                  <div key={contact.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">{contact.name}</h3>
                        {etiquetaConfig && (
                          <Badge variant="secondary" className={`${etiquetaConfig.color} text-white`}>
                            {etiquetaConfig.label}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          {contact.phoneNumber}
                        </div>
                        {contact.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-4 w-4" />
                            {contact.email}
                          </div>
                        )}
                      </div>
                      
                      {contact.observacao && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {contact.observacao}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Botão para abrir conversa */}
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          if (onOpenChat) {
                            onOpenChat(contact.phoneNumber, contact.name);
                          } else {
                            toast({
                              title: "Conversa",
                              description: `Abrindo conversa com ${contact.name}`,
                            });
                          }
                        }}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditClick(contact)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Editar Contato</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                              <Label htmlFor="edit-name">Nome *</Label>
                              <Input
                                id="edit-name"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Nome completo"
                                required
                              />
                            </div>

                            <div>
                              <Label htmlFor="edit-phoneNumber">Telefone *</Label>
                              <Input
                                id="edit-phoneNumber"
                                value={formData.phoneNumber}
                                onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                                placeholder="55XX XXXXX-XXXX"
                                required
                              />
                            </div>

                            <div>
                              <Label htmlFor="edit-email">E-mail</Label>
                              <Input
                                id="edit-email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                placeholder="email@exemplo.com"
                              />
                            </div>

                            <div>
                              <Label htmlFor="edit-etiqueta">Etiqueta</Label>
                              <Select value={formData.etiqueta} onValueChange={(value) => setFormData(prev => ({ ...prev, etiqueta: value }))}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione uma etiqueta" />
                                </SelectTrigger>
                                <SelectContent>
                                  {ETIQUETAS.map((etiqueta) => (
                                    <SelectItem key={etiqueta.value} value={etiqueta.value}>
                                      {etiqueta.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <Label htmlFor="edit-observacao">Observação</Label>
                              <Textarea
                                id="edit-observacao"
                                value={formData.observacao}
                                onChange={(e) => setFormData(prev => ({ ...prev, observacao: e.target.value }))}
                                placeholder="Anotações sobre o contato..."
                                rows={3}
                              />
                            </div>

                            <DialogFooter>
                              <Button type="button" variant="outline" onClick={() => setEditingContact(null)}>
                                Cancelar
                              </Button>
                              <Button type="submit" disabled={updateContactMutation.isPending}>
                                {updateContactMutation.isPending ? 'Salvando...' : 'Atualizar'}
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir o contato <strong>{contact.name}</strong>?
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteContact(contact.id)}
                              className="bg-red-500 hover:bg-red-600"
                              disabled={deleteContactMutation.isPending}
                            >
                              {deleteContactMutation.isPending ? 'Excluindo...' : 'Excluir'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages} ({contactsData?.pagination.total} contatos)
              </p>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}