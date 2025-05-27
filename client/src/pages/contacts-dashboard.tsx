import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, MessageSquare, Download, Filter, Calendar, Users, TrendingUp, Clock, Tag, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/hooks/use-toast';

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

interface ContactsDashboardProps {
  activeConnectionId: number;
}

export default function ContactsDashboard({ activeConnectionId }: ContactsDashboardProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'name'>('recent');
  const [currentPage, setCurrentPage] = useState(1);
  const [contactsPerPage] = useState(20);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [newContact, setNewContact] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    observation: '',
    tag: ''
  });

  const { toast } = useToast();

  // Estatísticas do dashboard
  const [stats, setStats] = useState({
    totalContacts: 0,
    newToday: 0,
    lastUpdate: new Date(),
    activeContacts: 0
  });

  // Tags disponíveis
  const availableTags = ['lead', 'qualificado', 'cliente', 'parceiro', 'prospect', 'inativo'];

  // Carregar contatos
  const loadContacts = async () => {
    if (!activeConnectionId) return;

    try {
      setLoading(true);

      // Buscar contatos do WhatsApp
      const whatsappResponse = await fetch(`/api/connections/${activeConnectionId}/conversations`);
      const whatsappContacts = await whatsappResponse.json();

      // Buscar contatos salvos no banco
      const dbResponse = await fetch(`/api/contacts?connectionId=${activeConnectionId}`);
      const dbContacts = await dbResponse.json();

      // Combinar contatos
      const combinedContacts = await syncContacts(whatsappContacts, dbContacts.contacts || []);
      
      setContacts(combinedContacts);
      setFilteredContacts(combinedContacts);
      
      // Calcular estatísticas
      calculateStats(combinedContacts);

      toast({
        title: "Contatos carregados!",
        description: `${combinedContacts.length} contatos encontrados`,
      });
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
      toast({
        title: "Erro ao carregar contatos",
        description: "Tente novamente em alguns instantes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Sincronizar contatos
  const syncContacts = async (whatsappContacts: any[], dbContacts: Contact[]) => {
    const synced: Contact[] = [];
    
    for (const whatsapp of whatsappContacts) {
      const existing = dbContacts.find(db => db.phoneNumber === whatsapp.phoneNumber);
      
      if (existing) {
        // Atualizar foto se mudou
        if (existing.profilePictureUrl !== whatsapp.profilePicture) {
          await updateContact(existing.id, { profilePictureUrl: whatsapp.profilePicture });
          existing.profilePictureUrl = whatsapp.profilePicture;
        }
        synced.push(existing);
      } else {
        // Criar novo contato
        const newContact = await createContactFromWhatsApp(whatsapp);
        if (newContact) synced.push(newContact);
      }
    }
    
    return synced;
  };

  // Criar contato a partir do WhatsApp
  const createContactFromWhatsApp = async (whatsappContact: any) => {
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: activeConnectionId,
          name: whatsappContact.contactName || whatsappContact.phoneNumber,
          phoneNumber: whatsappContact.phoneNumber,
          profilePictureUrl: whatsappContact.profilePicture,
          tag: 'lead',
          isActive: true
        })
      });
      
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Erro ao criar contato:', error);
    }
    return null;
  };

  // Calcular estatísticas
  const calculateStats = (contactsList: Contact[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const newToday = contactsList.filter(contact => {
      const createdDate = new Date(contact.createdAt);
      createdDate.setHours(0, 0, 0, 0);
      return createdDate.getTime() === today.getTime();
    }).length;

    const activeContacts = contactsList.filter(contact => contact.isActive).length;

    setStats({
      totalContacts: contactsList.length,
      newToday,
      lastUpdate: new Date(),
      activeContacts
    });
  };

  // Filtrar contatos
  useEffect(() => {
    let filtered = [...contacts];

    // Filtro por termo de pesquisa
    if (searchTerm) {
      filtered = filtered.filter(contact =>
        contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.phoneNumber.includes(searchTerm) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro por tag
    if (selectedTag !== 'all') {
      filtered = filtered.filter(contact => contact.tag === selectedTag);
    }

    // Filtro por data
    if (dateRange.from) {
      filtered = filtered.filter(contact => {
        const contactDate = new Date(contact.createdAt);
        return contactDate >= dateRange.from!;
      });
    }
    if (dateRange.to) {
      filtered = filtered.filter(contact => {
        const contactDate = new Date(contact.createdAt);
        return contactDate <= dateRange.to!;
      });
    }

    // Ordenação
    switch (sortBy) {
      case 'recent':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    setFilteredContacts(filtered);
    setCurrentPage(1);
  }, [contacts, searchTerm, selectedTag, dateRange, sortBy]);

  // Adicionar contato
  const addContact = async () => {
    if (!newContact.name || !newContact.phoneNumber) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome e telefone são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newContact,
          connectionId: activeConnectionId,
          isActive: true
        })
      });

      if (response.ok) {
        const contact = await response.json();
        setContacts(prev => [contact, ...prev]);
        setNewContact({ name: '', phoneNumber: '', email: '', observation: '', tag: '' });
        setIsAddModalOpen(false);
        
        toast({
          title: "Contato adicionado!",
          description: `${contact.name} foi adicionado com sucesso`,
        });
      }
    } catch (error) {
      console.error('Erro ao adicionar contato:', error);
      toast({
        title: "Erro ao adicionar contato",
        description: "Tente novamente",
        variant: "destructive",
      });
    }
  };

  // Atualizar contato
  const updateContact = async (id: number, updates: Partial<Contact>) => {
    try {
      const response = await fetch(`/api/contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const updatedContact = await response.json();
        setContacts(prev => prev.map(c => c.id === id ? updatedContact : c));
        return updatedContact;
      }
    } catch (error) {
      console.error('Erro ao atualizar contato:', error);
    }
  };

  // Excluir contato
  const deleteContact = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este contato?')) return;

    try {
      const response = await fetch(`/api/contacts/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setContacts(prev => prev.filter(c => c.id !== id));
        toast({
          title: "Contato excluído!",
          description: "Contato removido com sucesso",
        });
      }
    } catch (error) {
      console.error('Erro ao excluir contato:', error);
      toast({
        title: "Erro ao excluir contato",
        description: "Tente novamente",
        variant: "destructive",
      });
    }
  };

  // Exportar contatos
  const exportContacts = () => {
    const csvContent = [
      ['Nome', 'Telefone', 'Email', 'Etiqueta', 'Observação', 'Data de Criação'],
      ...filteredContacts.map(contact => [
        contact.name,
        contact.phoneNumber,
        contact.email || '',
        contact.tag || '',
        contact.observation || '',
        new Date(contact.createdAt).toLocaleDateString('pt-BR')
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contatos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Arquivo exportado!",
      description: "Lista de contatos baixada com sucesso",
    });
  };

  // Abrir conversa no WhatsApp
  const openWhatsAppChat = (phoneNumber: string) => {
    // Implementar abertura do chat na aba de mensagens
    // Por enquanto mostra apenas notificação
    toast({
      title: "Abrindo conversa",
      description: `Iniciando conversa com ${phoneNumber}`,
    });
  };

  // Paginação
  const indexOfLastContact = currentPage * contactsPerPage;
  const indexOfFirstContact = indexOfLastContact - contactsPerPage;
  const currentContacts = filteredContacts.slice(indexOfFirstContact, indexOfLastContact);
  const totalPages = Math.ceil(filteredContacts.length / contactsPerPage);

  // Carregar contatos quando a conexão muda
  useEffect(() => {
    if (activeConnectionId) {
      loadContacts();
    }
  }, [activeConnectionId]);

  if (!activeConnectionId) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Selecione uma Conexão</h3>
          <p className="text-gray-500">Escolha uma conexão WhatsApp para gerenciar os contatos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Dashboard Statistics */}
      <div className="bg-white border-b border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard de Contatos</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total de Contatos</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalContacts}</p>
                </div>
                <Users className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Novos Hoje</p>
                  <p className="text-2xl font-bold text-green-600">{stats.newToday}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Contatos Ativos</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.activeContacts}</p>
                </div>
                <Eye className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Última Atualização</p>
                  <p className="text-sm font-semibold text-gray-700">
                    {stats.lastUpdate.toLocaleTimeString('pt-BR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-orange-600 hover:bg-orange-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Contato
              </Button>
            </DialogTrigger>
          </Dialog>

          <Button variant="outline" onClick={exportContacts} className="text-green-600 border-green-200 hover:bg-green-50">
            <Download className="w-4 h-4 mr-2" />
            Exportar Lista
          </Button>

          <Button variant="outline" onClick={loadContacts} className="text-blue-600 border-blue-200 hover:bg-blue-50">
            <Users className="w-4 h-4 mr-2" />
            Sincronizar
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Pesquisar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={selectedTag} onValueChange={setSelectedTag}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por etiqueta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as etiquetas</SelectItem>
              {availableTags.map(tag => (
                <SelectItem key={tag} value={tag}>
                  {tag.charAt(0).toUpperCase() + tag.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger>
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="oldest">Mais antigos</SelectItem>
              <SelectItem value="name">Nome (A-Z)</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" className="w-full">
            <Filter className="w-4 h-4 mr-2" />
            Filtro por Data
          </Button>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            <span className="ml-2 text-gray-600">Carregando contatos...</span>
          </div>
        ) : currentContacts.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum contato encontrado</h3>
            <p className="text-gray-500">Adicione contatos ou ajuste seus filtros</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contato
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data de Adição
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Etiqueta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentContacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={contact.profilePictureUrl} />
                            <AvatarFallback className="bg-orange-100 text-orange-600">
                              {contact.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{contact.name}</div>
                            <div className="text-sm text-gray-500">{contact.phoneNumber}</div>
                            {contact.email && (
                              <div className="text-xs text-gray-400">{contact.email}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(contact.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {contact.tag && (
                          <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                            <Tag className="w-3 h-3 mr-1" />
                            {contact.tag}
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openWhatsAppChat(contact.phoneNumber)}
                            className="text-green-600 border-green-200 hover:bg-green-50"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedContact(contact);
                              setIsEditModalOpen(true);
                            }}
                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteContact(contact.id)}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white border-t border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Mostrando {indexOfFirstContact + 1} a {Math.min(indexOfLastContact, filteredContacts.length)} de {filteredContacts.length} contatos
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <span className="px-3 py-1 text-sm text-gray-500">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Novo Contato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={newContact.name}
                onChange={(e) => setNewContact(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nome do contato"
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefone *</Label>
              <Input
                id="phone"
                value={newContact.phoneNumber}
                onChange={(e) => setNewContact(prev => ({ ...prev, phoneNumber: e.target.value }))}
                placeholder="5511999999999"
              />
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={newContact.email}
                onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <Label htmlFor="tag">Etiqueta</Label>
              <Select value={newContact.tag} onValueChange={(value) => setNewContact(prev => ({ ...prev, tag: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma etiqueta" />
                </SelectTrigger>
                <SelectContent>
                  {availableTags.map(tag => (
                    <SelectItem key={tag} value={tag}>
                      {tag.charAt(0).toUpperCase() + tag.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="observation">Observação</Label>
              <Textarea
                id="observation"
                value={newContact.observation}
                onChange={(e) => setNewContact(prev => ({ ...prev, observation: e.target.value }))}
                placeholder="Anotações sobre o contato..."
                rows={3}
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={addContact} className="flex-1 bg-orange-600 hover:bg-orange-700">
                Adicionar
              </Button>
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="flex-1">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Contact Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Contato</DialogTitle>
          </DialogHeader>
          {selectedContact && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Nome</Label>
                <Input
                  id="edit-name"
                  value={selectedContact.name}
                  onChange={(e) => setSelectedContact(prev => prev ? { ...prev, name: e.target.value } : null)}
                />
              </div>
              <div>
                <Label htmlFor="edit-email">E-mail</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={selectedContact.email || ''}
                  onChange={(e) => setSelectedContact(prev => prev ? { ...prev, email: e.target.value } : null)}
                />
              </div>
              <div>
                <Label htmlFor="edit-tag">Etiqueta</Label>
                <Select 
                  value={selectedContact.tag || ''} 
                  onValueChange={(value) => setSelectedContact(prev => prev ? { ...prev, tag: value } : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma etiqueta" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTags.map(tag => (
                      <SelectItem key={tag} value={tag}>
                        {tag.charAt(0).toUpperCase() + tag.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-observation">Observação</Label>
                <Textarea
                  id="edit-observation"
                  value={selectedContact.observation || ''}
                  onChange={(e) => setSelectedContact(prev => prev ? { ...prev, observation: e.target.value } : null)}
                  rows={3}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={async () => {
                    if (selectedContact) {
                      await updateContact(selectedContact.id, selectedContact);
                      setIsEditModalOpen(false);
                      toast({
                        title: "Contato atualizado!",
                        description: "As alterações foram salvas com sucesso",
                      });
                    }
                  }}
                  className="flex-1 bg-orange-600 hover:bg-orange-700"
                >
                  Salvar
                </Button>
                <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="flex-1">
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}