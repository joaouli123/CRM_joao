import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, MessageCircle, Download, Search, MoreHorizontal, Filter } from 'lucide-react';
import { format, parseISO, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Contact {
  id: number;
  connectionId: number;
  name: string;
  phoneNumber: string;
  email?: string;
  observation?: string;
  tag?: string;
  profilePictureUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ContactStats {
  totalContacts: number;
  todayContacts: number;
  lastUpdate: string;
}

interface ContactsTableProps {
  activeConnectionId: number;
}

export default function ContactsTable({ activeConnectionId }: ContactsTableProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<ContactStats>({ totalContacts: 0, todayContacts: 0, lastUpdate: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Filtros
  const [searchName, setSearchName] = useState('');
  const [searchTag, setSearchTag] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month
  const [sortOrder, setSortOrder] = useState('recent'); // recent, oldest, name
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    observation: '',
    tag: 'lead'
  });

  const { toast } = useToast();
  const contactsPerPage = 10;

  // Carregar contatos
  const loadContacts = async () => {
    if (!activeConnectionId) return;

    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: contactsPerPage.toString(),
        search: searchName,
        tag: searchTag,
        dateFilter,
        sort: sortOrder
      });

      const response = await fetch(`/api/connections/${activeConnectionId}/contacts?${params}`);
      const data = await response.json();

      if (response.ok) {
        setContacts(data.contacts || []);
        setTotalPages(Math.ceil((data.total || 0) / contactsPerPage));
        
        // Calcular estatísticas
        const today = new Date();
        const todayCount = (data.contacts || []).filter((contact: Contact) => 
          isToday(parseISO(contact.createdAt))
        ).length;

        setStats({
          totalContacts: data.total || 0,
          todayContacts: todayCount,
          lastUpdate: format(today, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
        });
      }
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar contatos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, [activeConnectionId, currentPage, searchName, searchTag, dateFilter, sortOrder]);

  // Adicionar contato
  const handleAddContact = async () => {
    if (!formData.name || !formData.phoneNumber) {
      toast({
        title: "Erro",
        description: "Nome e telefone são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/connections/${activeConnectionId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast({
          title: "Sucesso!",
          description: "Contato adicionado com sucesso",
        });
        setIsAddModalOpen(false);
        setFormData({ name: '', phoneNumber: '', email: '', observation: '', tag: 'lead' });
        loadContacts();
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao adicionar contato",
        variant: "destructive",
      });
    }
  };

  // Editar contato
  const handleEditContact = async () => {
    if (!editingContact || !formData.name || !formData.phoneNumber) return;

    try {
      const response = await fetch(`/api/contacts/${editingContact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast({
          title: "Sucesso!",
          description: "Contato atualizado com sucesso",
        });
        setIsEditModalOpen(false);
        setEditingContact(null);
        loadContacts();
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar contato",
        variant: "destructive",
      });
    }
  };

  // Excluir contato
  const handleDeleteContact = async (contactId: number) => {
    if (!confirm('Tem certeza que deseja excluir este contato?')) return;

    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: "Sucesso!",
          description: "Contato excluído com sucesso",
        });
        loadContacts();
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao excluir contato",
        variant: "destructive",
      });
    }
  };

  // Exportar dados
  const handleExportContacts = () => {
    const csvContent = [
      ['Nome', 'Telefone', 'Email', 'Etiqueta', 'Data de Adição'],
      ...contacts.map(contact => [
        contact.name,
        contact.phoneNumber,
        contact.email || '',
        contact.tag || '',
        format(parseISO(contact.createdAt), 'dd/MM/yyyy', { locale: ptBR })
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `contatos_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  // Abrir chat
  const handleOpenChat = (phoneNumber: string) => {
    // Implementar navegação para o chat
    toast({
      title: "Abrindo conversa",
      description: `Abrindo chat com ${phoneNumber}`,
    });
  };

  const openEditModal = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      phoneNumber: contact.phoneNumber,
      email: contact.email || '',
      observation: contact.observation || '',
      tag: contact.tag || 'lead'
    });
    setIsEditModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Contatos</h1>
              <p className="text-sm text-gray-500">Gerencie seus contatos do WhatsApp</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleExportContacts}>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Contato
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Novo Contato</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Nome *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Nome do contato"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Telefone *</Label>
                      <Input
                        id="phone"
                        value={formData.phoneNumber}
                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                        placeholder="5511999999999"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="tag">Etiqueta</Label>
                      <Select value={formData.tag} onValueChange={(value) => setFormData({ ...formData, tag: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lead">Lead</SelectItem>
                          <SelectItem value="qualificado">Qualificado</SelectItem>
                          <SelectItem value="cliente">Cliente</SelectItem>
                          <SelectItem value="desqualificado">Desqualificado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleAddContact} className="w-full">
                      Adicionar Contato
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Search and Filters Bar */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  className="pl-10 bg-white"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  placeholder="Buscar contatos..."
                />
              </div>
            </div>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
            <Select value={searchTag} onValueChange={setSearchTag}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="qualificado">Qualificado</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-gray-200">
                <TableHead className="w-12"></TableHead>
                <TableHead className="font-semibold text-gray-900">NOME</TableHead>
                <TableHead className="font-semibold text-gray-900">TELEFONE</TableHead>
                <TableHead className="font-semibold text-gray-900">EMAIL</TableHead>
                <TableHead className="font-semibold text-gray-900">STATUS</TableHead>
                <TableHead className="font-semibold text-gray-900 text-right">AÇÕES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id} className="border-gray-100 hover:bg-gray-50">
                  <TableCell>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={contact.profilePictureUrl} />
                      <AvatarFallback className="bg-blue-100 text-blue-600 text-xs font-medium">
                        {contact.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-gray-900">{contact.name}</div>
                    <div className="text-sm text-gray-500">
                      {format(parseISO(contact.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600">{contact.phoneNumber}</TableCell>
                  <TableCell className="text-gray-600">{contact.email || '-'}</TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline"
                      className={`${
                        contact.tag === 'cliente' ? 'bg-green-50 text-green-700 border-green-200' :
                        contact.tag === 'qualificado' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        contact.tag === 'lead' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                        'bg-gray-50 text-gray-700 border-gray-200'
                      }`}
                    >
                      ● {contact.tag === 'cliente' ? 'Ativo' : contact.tag || 'Novo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenChat(contact.phoneNumber)}
                        className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditModal(contact)}
                        className="h-8 w-8 p-0 text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteContact(contact.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Exibindo {Math.min((currentPage - 1) * contactsPerPage + 1, stats.totalContacts)} a {Math.min(currentPage * contactsPerPage, stats.totalContacts)} de {stats.totalContacts} contatos
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="text-gray-600"
              >
                Anterior
              </Button>
              
              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 p-0 ${
                        currentPage === pageNum 
                          ? "bg-blue-600 text-white" 
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="text-gray-600"
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Edição */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Contato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Nome *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-phone">Telefone *</Label>
              <Input
                id="edit-phone"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-tag">Etiqueta</Label>
              <Select value={formData.tag} onValueChange={(value) => setFormData({ ...formData, tag: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="qualificado">Qualificado</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="desqualificado">Desqualificado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-observation">Observação</Label>
              <Input
                id="edit-observation"
                value={formData.observation}
                onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
              />
            </div>
            <Button onClick={handleEditContact} className="w-full">
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}