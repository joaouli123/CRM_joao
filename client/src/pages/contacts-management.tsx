import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { format, subDays, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Users, 
  UserPlus, 
  Edit3, 
  Trash2, 
  MessageCircle, 
  Download, 
  Calendar as CalendarIcon,
  Search,
  Filter,
  Clock,
  Tag,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface Contact {
  id: number;
  name: string;
  phoneNumber: string;
  email?: string;
  profilePictureUrl?: string;
  tag?: string;
  origem?: string;
  observation?: string;
  createdAt: string;
  connectionId: number;
}

interface ContactStats {
  total: number;
  today: number;
  lastUpdate: string;
}

export default function ContactsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estados para filtros e paginação
  const [searchTerm, setSearchTerm] = useState('');
  const [tagFilter, setTagFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  
  const itemsPerPage = 10;

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    tag: '',
    origem: '',
    observation: ''
  });

  // Buscar estatísticas dos contatos
  const { data: stats } = useQuery<ContactStats>({
    queryKey: ['contacts-stats'],
    queryFn: async () => {
      const response = await fetch('/api/contacts/stats');
      return response.json();
    }
  });

  // Buscar contatos com filtros
  const { data: contactsResponse, isLoading } = useQuery({
    queryKey: ['contacts', searchTerm, tagFilter, sortBy, currentPage],
    queryFn: async () => {
      const response = await fetch('/api/contacts');
      return response.json();
    }
  });

  const contacts = contactsResponse?.contacts || [];
  const totalPages = Math.ceil((contactsResponse?.total || 0) / itemsPerPage);

  // Mutações
  const createContactMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/contacts', { method: 'POST', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts/stats'] });
      toast({ title: 'Contato adicionado com sucesso!' });
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erro ao adicionar contato', variant: 'destructive' });
    }
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      // Mapear os campos para os nomes que o backend espera
      const mappedData = {
        ...data,
        observacao: data.observation, // Backend espera 'observacao'
        etiqueta: data.tag, // Backend espera 'etiqueta'
        origem: data.origem // Backend já espera 'origem'
      };
      
      console.log('🔧 DADOS MAPEADOS SENDO ENVIADOS:', mappedData);
      
      const response = await fetch(`/api/contacts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mappedData),
      });
      
      if (!response.ok) {
        throw new Error('Erro ao atualizar contato');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({ title: 'Contato atualizado com sucesso!' });
      setEditingContact(null);
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar contato', variant: 'destructive' });
    }
  });

  const deleteContactMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/contacts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts/stats'] });
      toast({ title: 'Contato excluído com sucesso!' });
      setIsDeleteDialogOpen(false);
      setContactToDelete(null);
    },
    onError: () => {
      toast({ title: 'Erro ao excluir contato', variant: 'destructive' });
    }
  });

  // Funções auxiliares
  const resetForm = () => {
    setFormData({
      name: '',
      phoneNumber: '',
      email: '',
      tag: '',
      origem: '',
      observation: ''
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('📤 DADOS DO FORMULÁRIO SENDO ENVIADOS:');
    console.log('   Dados completos:', formData);
    console.log('   Tag:', formData.tag);
    console.log('   Origem:', formData.origem);
    console.log('   Observação:', formData.observation);
    
    if (editingContact) {
      const dataToSend = { id: editingContact.id, ...formData };
      console.log('📤 DADOS FINAIS PARA UPDATE:', dataToSend);
      updateContactMutation.mutate(dataToSend);
    } else {
      const dataToSend = { ...formData, connectionId: 36 };
      console.log('📤 DADOS FINAIS PARA CREATE:', dataToSend);
      createContactMutation.mutate(dataToSend);
    }
  };



  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      phoneNumber: contact.phoneNumber, // Preservado mas não editável
      email: contact.email || '',
      tag: contact.tag || '',
      origem: contact.origem || '',
      observation: contact.observation || ''
    });
  };

  const handleDelete = (contact: Contact) => {
    // 🔒 PROTEÇÃO: Verificar se é contato original do WhatsApp
    if (contact.origem === 'whatsapp') {
      toast({
        title: "⚠️ Ação não permitida",
        description: "Contatos originais do WhatsApp não podem ser deletados. Apenas dados adicionais podem ser removidos.",
        variant: "destructive",
      });
      return;
    }
    
    setContactToDelete(contact);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (contactToDelete) {
      deleteContactMutation.mutate(contactToDelete.id);
    }
  };

  // 💬 ABRIR CONVERSA WHATSAPP
  const openWhatsApp = (phoneNumber: string) => {
    // Redirecionar para a aba de mensagens com o contato selecionado
    const event = new CustomEvent('openWhatsAppChat', {
      detail: { phoneNumber: phoneNumber.replace(/\D/g, '') }
    });
    window.dispatchEvent(event);
    
    // Notificar usuário
    toast({
      title: "Redirecionando para WhatsApp",
      description: `Abrindo conversa com ${phoneNumber}`,
    });
  };

  const handleExport = () => {
    // Exportação CSV no padrão solicitado: NOME;TELEFONE;EMAIL;TAG;ORIGEM;DATA
    const csvContent = "data:text/csv;charset=utf-8," 
      + "NOME;TELEFONE;EMAIL;TAG;ORIGEM;DATA\n"
      + contacts.map(contact => 
          `${contact.name};${contact.phoneNumber};${contact.email || ''};${contact.tag || ''};${contact.origem || ''};${format(new Date(contact.createdAt), 'dd/MM/yyyy', { locale: ptBR })}`
        ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `contatos_${format(new Date(), 'dd-MM-yyyy')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: 'Lista de contatos exportada com sucesso!' });
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        // Suporte tanto vírgula quanto ponto e vírgula como separador
        const separator = lines[0].includes(';') ? ';' : ',';
        const headers = lines[0].split(separator).map(h => h.replace(/"/g, '').trim().toLowerCase());
        
        const importedContacts = [];
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const values = line.split(separator).map(v => v.replace(/"/g, '').trim());
          const contact: any = { connectionId: 36 };
          
          headers.forEach((header, index) => {
            const value = values[index] || '';
            switch (header) {
              case 'nome':
              case 'name':
                contact.name = value;
                break;
              case 'telefone':
              case 'phone':
              case 'phoneNumber':
                contact.phoneNumber = value;
                break;
              case 'email':
                contact.email = value;
                break;
              case 'tag':
              case 'etiqueta':
                contact.tag = value;
                break;
              case 'origem':
              case 'origin':
                contact.origem = value;
                break;
              case 'data':
              case 'date':
                // Ignorar campo de data na importação (será criado automaticamente)
                break;
              case 'observação':
              case 'observacao':
              case 'observation':
                contact.observation = value;
                break;
            }
          });
          
          if (contact.name && contact.phoneNumber) {
            importedContacts.push(contact);
          }
        }
        
        // Importar contatos em lote
        Promise.all(
          importedContacts.map(contact => 
            createContactMutation.mutateAsync(contact)
          )
        ).then(() => {
          toast({ 
            title: `${importedContacts.length} contatos importados com sucesso!`,
            description: `Arquivo: ${file.name}`
          });
        }).catch(() => {
          toast({ 
            title: 'Erro ao importar alguns contatos', 
            variant: 'destructive',
            description: 'Verifique o formato do arquivo e tente novamente.'
          });
        });
        
      } catch (error) {
        toast({ 
          title: 'Erro ao processar arquivo', 
          variant: 'destructive',
          description: 'Verifique se o arquivo está no formato correto.'
        });
      }
    };
    
    reader.readAsText(file);
    // Limpar o input para permitir reimportar o mesmo arquivo
    event.target.value = '';
  };

  const getTagColor = (tag: string) => {
    const colors: { [key: string]: string } = {
      'lead': 'bg-blue-100 text-blue-800',
      'qualificado': 'bg-green-100 text-green-800',
      'desqualificado': 'bg-red-100 text-red-800',
      'cliente': 'bg-purple-100 text-purple-800',
      'prospect': 'bg-yellow-100 text-yellow-800'
    };
    return colors[tag?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-emerald-50/40 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header Sofisticado */}
        <div className="glass-panel p-8 rounded-2xl animate-slide-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-xl">
                <Users className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gradient-green">Gerenciamento de Contatos</h1>
                <p className="text-slate-600 text-lg">Sistema avançado de gestão inteligente</p>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Cards Sofisticados */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Card className="glass-card animate-scale-in">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700">Total de Contatos</CardTitle>
              <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gradient-green">{stats?.total || 0}</div>
              <p className="text-sm text-slate-600">Contatos cadastrados</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-800">Adicionados Hoje</CardTitle>
              <UserPlus className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900">{stats?.today || 0}</div>
              <p className="text-xs text-green-700">Novos contatos</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-800">Última Atualização</CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold text-blue-900">
                {stats?.lastUpdate ? format(new Date(stats.lastUpdate), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'Nunca'}
              </div>
              <p className="text-xs text-blue-700">Sistema atualizado</p>
            </CardContent>
          </Card>
        </div>

        {/* Ações e Filtros */}
        <Card>
          <CardHeader>
            <CardTitle>Ações e Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filtros de Pesquisa Avançados */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 p-6 bg-gradient-to-r from-slate-50 to-green-50 rounded-xl border border-green-200">
              {/* Busca por Nome/Telefone */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Buscar Contato</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Nome ou telefone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white border-slate-300 focus:border-green-500 focus:ring-green-500"
                  />
                </div>
              </div>

              {/* Filtro por Tag */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Filtrar por Tag</Label>
                <Select value={tagFilter} onValueChange={setTagFilter}>
                  <SelectTrigger className="bg-white border-slate-300 focus:border-green-500">
                    <SelectValue placeholder="Todas as tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as tags</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="qualificado">Qualificado</SelectItem>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="desqualificado">Desqualificado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Ordenação */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Ordenar por</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="bg-white border-slate-300 focus:border-green-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Mais recentes</SelectItem>
                    <SelectItem value="name">Nome A-Z</SelectItem>
                    <SelectItem value="oldest">Mais antigos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro por Data */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Período</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left bg-white border-slate-300 hover:bg-slate-50"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          `${format(dateRange.from, "dd/MM/yy")} - ${format(dateRange.to, "dd/MM/yy")}`
                        ) : (
                          format(dateRange.from, "dd/MM/yy")
                        )
                      ) : (
                        "Selecionar período"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Filtros Rápidos */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}
                className="border-green-300 text-green-700 hover:bg-green-50"
              >
                Últimos 7 dias
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}
                className="border-green-300 text-green-700 hover:bg-green-50"
              >
                Último mês
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setTagFilter('all');
                  setSortBy('recent');
                  setDateRange({});
                }}
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Limpar filtros
              </Button>
            </div>

            {/* Botões de Ação */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-200">
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="btn-primary">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Adicionar Contato
                  </Button>
                </DialogTrigger>
                
              <Button
                onClick={handleExport}
                variant="outline"
                className="btn-secondary border-green-500 text-green-700 hover:bg-green-50"
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </Button>

              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleImport}
                className="hidden"
                id="import-file"
              />
              <Button
                onClick={() => document.getElementById('import-file')?.click()}
                variant="outline"
                className="btn-secondary border-blue-500 text-blue-700 hover:bg-blue-50"
              >
                <Download className="mr-2 h-4 w-4 rotate-180" />
                Importar CSV/Excel
              </Button>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>{editingContact ? 'Editar Contato' : 'Adicionar Novo Contato'}</DialogTitle>
                    <DialogDescription>
                      Preencha as informações do contato abaixo.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phoneNumber">Telefone *</Label>
                        <Input
                          id="phoneNumber"
                          value={formData.phoneNumber}
                          onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tag">Etiqueta</Label>
                        <Select 
                          value={formData.tag} 
                          onValueChange={(value) => {
                            console.log('🏷️ TAG SELECIONADA:', value);
                            setFormData({ ...formData, tag: value });
                            console.log('📝 FORM DATA APÓS TAG:', { ...formData, tag: value });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma etiqueta" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lead">Lead</SelectItem>
                            <SelectItem value="qualificado">Qualificado</SelectItem>
                            <SelectItem value="desqualificado">Desqualificado</SelectItem>
                            <SelectItem value="cliente">Cliente</SelectItem>
                            <SelectItem value="prospect">Prospect</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="origem">Origem</Label>
                        <Select 
                          value={formData.origem} 
                          onValueChange={(value) => {
                            console.log('🌐 ORIGEM SELECIONADA:', value);
                            setFormData({ ...formData, origem: value });
                            console.log('📝 FORM DATA APÓS ORIGEM:', { ...formData, origem: value });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a origem" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="site">Site</SelectItem>
                            <SelectItem value="organico">Orgânico</SelectItem>
                            <SelectItem value="indicacao">Indicação</SelectItem>
                            <SelectItem value="publicidade">Publicidade</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="observation">Observações</Label>
                      <Textarea
                        id="observation"
                        value={formData.observation}
                        onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => {
                        setIsAddDialogOpen(false);
                        setEditingContact(null);
                        resetForm();
                      }}>
                        Cancelar
                      </Button>
                      <Button 
                        type="submit" 
                        className="bg-orange-600 hover:bg-orange-700"
                        disabled={createContactMutation.isPending || updateContactMutation.isPending}
                      >
                        {editingContact ? 'Atualizar' : 'Adicionar'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </Button>
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="search">Pesquisar por nome</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Digite o nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Filtrar por etiqueta</Label>
                <Select value={tagFilter} onValueChange={setTagFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as etiquetas</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="qualificado">Qualificado</SelectItem>
                    <SelectItem value="desqualificado">Desqualificado</SelectItem>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Ordenar por</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Mais recentes</SelectItem>
                    <SelectItem value="oldest">Mais antigos</SelectItem>
                    <SelectItem value="name">Nome A-Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Período</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "dd/MM", { locale: ptBR })} -{" "}
                            {format(dateRange.to, "dd/MM", { locale: ptBR })}
                          </>
                        ) : (
                          format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                        )
                      ) : (
                        "Selecionar período"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={1}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Contatos */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Contatos ({contactsResponse?.total || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="text-gray-500">Carregando contatos...</div>
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-semibold text-gray-900">Nenhum contato encontrado</h3>
                <p className="mt-1 text-sm text-gray-500">Comece adicionando um novo contato.</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contato</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Etiqueta</TableHead>
                      <TableHead>Data de Adição</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={contact.profilePictureUrl} />
                              <AvatarFallback className="bg-orange-100 text-orange-800">
                                {contact.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-gray-900">{contact.name}</div>
                              {contact.observation && (
                                <div className="text-sm text-gray-500 truncate max-w-xs">{contact.observation}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Phone className="h-4 w-4 text-gray-400" />
                            <span>{contact.phoneNumber}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {contact.email && (
                            <div className="flex items-center space-x-1">
                              <Mail className="h-4 w-4 text-gray-400" />
                              <span className="text-sm">{contact.email}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {contact.tag && (
                            <Badge className={getTagColor(contact.tag)}>
                              {contact.tag}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {format(new Date(contact.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => openWhatsApp(contact.phoneNumber)}
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => handleEdit(contact)}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDelete(contact)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-gray-700">
                      Página {currentPage} de {totalPages} ({contactsResponse?.total} contatos)
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                      >
                        Próxima
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Confirmação de Exclusão */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Exclusão</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir o contato "{contactToDelete?.name}"? 
                Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmDelete}
                disabled={deleteContactMutation.isPending}
              >
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Edição */}
        <Dialog open={!!editingContact} onOpenChange={(open) => {
          if (!open) {
            setEditingContact(null);
            resetForm();
          }
        }}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Editar Contato</DialogTitle>
              <DialogDescription>
                Atualize as informações do contato abaixo.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nome *</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phoneNumber">📱 Telefone WhatsApp (Protegido)</Label>
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="font-mono text-green-800 font-medium">{formData.phoneNumber}</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full ml-auto">
                      Original do WhatsApp
                    </span>
                  </div>
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    🔒 Este número é protegido e não pode ser alterado
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-tag">Etiqueta</Label>
                  <Select value={formData.tag || ''} onValueChange={(value) => setFormData({ ...formData, tag: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma etiqueta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="qualificado">Qualificado</SelectItem>
                      <SelectItem value="desqualificado">Desqualificado</SelectItem>
                      <SelectItem value="cliente">Cliente</SelectItem>
                      <SelectItem value="prospect">Prospect</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Nova linha com Origem */}
              <div className="space-y-2">
                <Label htmlFor="edit-origem">Origem</Label>
                <Select value={formData.origem || ''} onValueChange={(value) => setFormData({ ...formData, origem: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="site">Site</SelectItem>
                    <SelectItem value="organico">Orgânico</SelectItem>
                    <SelectItem value="indicacao">Indicação</SelectItem>
                    <SelectItem value="publicidade">Publicidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-observation">Observações</Label>
                <Textarea
                  id="edit-observation"
                  value={formData.observation}
                  onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setEditingContact(null);
                  resetForm();
                }}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-orange-600 hover:bg-orange-700"
                  disabled={updateContactMutation.isPending}
                >
                  Atualizar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}