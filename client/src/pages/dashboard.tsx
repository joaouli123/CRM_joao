import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Sidebar from "@/components/sidebar";
import MessageInterface from "@/components/message-interface-final";
import Contacts from "@/pages/contacts";
import ContactsManager from "@/pages/contacts-manager";
import ContactsWorking from "@/pages/contacts-working";
import { Connection, ConnectionStats } from "@/lib/api";
import { Plus, Wifi, WifiOff, Users, MessageSquare, Activity, Clock, Contact, Search, Filter, Download, Upload, UserPlus, Edit3, Trash2, Calendar as CalendarIcon, Tag, Phone, Mail, ChevronLeft, ChevronRight, Smartphone, QrCode, RotateCcw, Power, Settings } from "lucide-react";
import { NewConnectionModal } from "@/components/modals/new-connection-modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';


type TabType = 'dashboard' | 'connections' | 'messages' | 'contacts' | 'contacts-manager' | 'contacts-dashboard' | 'contacts-management' | 'settings';

// Interface para contatos
interface ContactData {
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

// Componente de Gerenciamento de Contatos Integrado
function ContactsManagementIntegrated() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estados para filtros e paginação
  const [searchTerm, setSearchTerm] = useState('');
  const [tagFilter, setTagFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactData | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<ContactData | null>(null);
  
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
  const totalContacts = contactsResponse?.total || 0;
  const totalPages = Math.ceil(totalContacts / itemsPerPage);

  // Filtrar contatos
  const filteredContacts = contacts.filter((contact: ContactData) => {
    const matchesSearch = contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.phoneNumber.includes(searchTerm);
    const matchesTag = tagFilter === 'all' || contact.tag === tagFilter;
    const matchesDate = !dateRange.from || !dateRange.to || 
                       isWithinInterval(new Date(contact.createdAt), { start: dateRange.from, end: dateRange.to });
    
    return matchesSearch && matchesTag && matchesDate;
  });

  // Ordenar contatos
  const sortedContacts = [...filteredContacts].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'recent':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'oldest':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      default:
        return 0;
    }
  });

  // Paginação
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedContacts = sortedContacts.slice(startIndex, startIndex + itemsPerPage);

  // Tags únicas para o filtro
  const uniqueTags = [...new Set(contacts.map((c: ContactData) => c.tag).filter(Boolean))];

  // Funções de CRUD
  const handleAddContact = async () => {
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, connectionId: 36 })
      });
      
      if (response.ok) {
        toast({ title: 'Contato adicionado com sucesso!' });
        setIsAddDialogOpen(false);
        setFormData({ name: '', phoneNumber: '', email: '', tag: '', origem: '', observation: '' });
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
      }
    } catch (error) {
      toast({ title: 'Erro ao adicionar contato', variant: 'destructive' });
    }
  };

  const handleEditContact = async () => {
    if (!editingContact) return;
    
    try {
      const response = await fetch(`/api/contacts/${editingContact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        toast({ title: 'Contato atualizado com sucesso!' });
        setEditingContact(null);
        setFormData({ name: '', phoneNumber: '', email: '', tag: '', origem: '', observation: '' });
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
      }
    } catch (error) {
      toast({ title: 'Erro ao atualizar contato', variant: 'destructive' });
    }
  };

  const handleDeleteContact = async () => {
    if (!contactToDelete) return;
    
    try {
      const response = await fetch(`/api/contacts/${contactToDelete.id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        toast({ title: 'Contato excluído com sucesso!' });
        setContactToDelete(null);
        setIsDeleteDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
      }
    } catch (error) {
      toast({ title: 'Erro ao excluir contato', variant: 'destructive' });
    }
  };

  // Exportar CSV
  const handleExportCSV = () => {
    const csvContent = "NOME;TELEFONE;EMAIL;TAG;ORIGEM;DATA\n" +
      sortedContacts.map((contact: ContactData) => 
        `${contact.name};${contact.phoneNumber};${contact.email || ''};${contact.tag || ''};${contact.origem || ''};${format(new Date(contact.createdAt), 'dd/MM/yyyy', { locale: ptBR })}`
      ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `contatos_${format(new Date(), 'dd-MM-yyyy')}.csv`;
    link.click();
  };

  // Limpar filtros
  const clearFilters = () => {
    setSearchTerm('');
    setTagFilter('all');
    setSortBy('recent');
    setDateRange({});
    setCurrentPage(1);
  };

  return (
    <div className="max-w-7xl space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-panel border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total de Contatos</p>
                <p className="text-2xl font-bold text-green-600">{stats?.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-panel border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Hoje</p>
                <p className="text-2xl font-bold text-blue-600">{stats?.today || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-panel border-orange-200">
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Última Atualização</p>
                <p className="text-sm font-bold text-orange-600">
                  {stats?.lastUpdate ? format(new Date(stats.lastUpdate), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Ações */}
      <Card className="glass-panel border-green-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-green-800 flex items-center">
            <Filter className="mr-2" />
            Ações e Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Linha 1: Filtros principais */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-green-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Contato</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Nome ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Tag</label>
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as tags</SelectItem>
                  {uniqueTags.map((tag) => (
                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ordenar por</label>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar período'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange as any}
                    onSelect={setDateRange as any}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Linha 2: Botões de filtro rápido */}
          <div className="flex flex-wrap gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}
              className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
            >
              Últimos 7 dias
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}
              className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
            >
              Último mês
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={clearFilters}
              className="bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
            >
              Limpar filtros
            </Button>
          </div>

          {/* Linha 3: Ações principais */}
          <div className="flex flex-wrap gap-3 pt-4 border-t border-green-200">
            <Button 
              onClick={() => setIsAddDialogOpen(true)}
              className="bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Adicionar Contato
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleExportCSV}
              className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
            
            <Button 
              variant="outline"
              className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
            >
              <Upload className="mr-2 h-4 w-4" />
              Importar CSV/Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Contatos */}
      <Card className="glass-panel">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-green-50">
                    <TableHead>Contato</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Tag</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedContacts.map((contact: ContactData) => (
                    <TableRow key={contact.id} className="hover:bg-green-50/50">
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={contact.profilePictureUrl} />
                            <AvatarFallback className="bg-green-100 text-green-700">
                              {contact.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-gray-900">{contact.name}</p>
                            {contact.email && (
                              <p className="text-sm text-gray-500 flex items-center">
                                <Mail className="h-3 w-3 mr-1" />
                                {contact.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-gray-700">
                          <Phone className="h-4 w-4 mr-2 text-green-600" />
                          {contact.phoneNumber}
                        </div>
                      </TableCell>
                      <TableCell>
                        {contact.tag && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            <Tag className="h-3 w-3 mr-1" />
                            {contact.tag}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-600">{contact.origem || '-'}</TableCell>
                      <TableCell className="text-gray-600">
                        {format(new Date(contact.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`https://wa.me/${contact.phoneNumber.replace(/\D/g, '')}`, '_blank')}
                            className="h-8 w-8 p-0 bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingContact(contact);
                              setFormData({
                                name: contact.name,
                                phoneNumber: contact.phoneNumber,
                                email: contact.email || '',
                                tag: contact.tag || '',
                                origem: contact.origem || '',
                                observation: contact.observation || ''
                              });
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setContactToDelete(contact);
                              setIsDeleteDialogOpen(true);
                            }}
                            className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
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
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, totalContacts)} de {totalContacts} contatos
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-gray-600">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de Adicionar/Editar Contato */}
      <Dialog open={isAddDialogOpen || !!editingContact} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false);
          setEditingContact(null);
          setFormData({ name: '', phoneNumber: '', email: '', tag: '', origem: '', observation: '' });
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Editar Contato' : 'Adicionar Novo Contato'}</DialogTitle>
            <DialogDescription>
              {editingContact ? 'Atualize as informações do contato.' : 'Preencha os dados do novo contato.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <Label htmlFor="phoneNumber">Telefone *</Label>
                <Input
                  id="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tag">Tag</Label>
                  <Input
                    id="tag"
                    value={formData.tag}
                    onChange={(e) => setFormData({...formData, tag: e.target.value})}
                    placeholder="cliente, lead, etc."
                  />
                </div>
                <div>
                  <Label htmlFor="origem">Origem</Label>
                  <Input
                    id="origem"
                    value={formData.origem}
                    onChange={(e) => setFormData({...formData, origem: e.target.value})}
                    placeholder="site, indicação, etc."
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="observation">Observação</Label>
                <Textarea
                  id="observation"
                  value={formData.observation}
                  onChange={(e) => setFormData({...formData, observation: e.target.value})}
                  placeholder="Observações adicionais..."
                  rows={3}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button
              type="button"
              onClick={editingContact ? handleEditContact : handleAddContact}
              disabled={!formData.name || !formData.phoneNumber}
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white"
            >
              {editingContact ? 'Atualizar' : 'Adicionar'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setEditingContact(null);
                setFormData({ name: '', phoneNumber: '', email: '', tag: '', origem: '', observation: '' });
              }}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o contato "{contactToDelete?.name}"? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setContactToDelete(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteContact}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('messages');
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | null>(null);
  const [showNewConnectionModal, setShowNewConnectionModal] = useState(false);
  const [showQRSection, setShowQRSection] = useState(false);
  const [selectedConnectionForQR, setSelectedConnectionForQR] = useState<Connection | null>(null);
  const [qrData, setQrData] = useState<{qrCode: string, expiration: string} | null>(null);
  const queryClient = useQueryClient();

  // Buscar conexões - CORRIGINDO PARA MOSTRAR SUA CONEXÃO LOWFY
  const { data: connections = [], isLoading: connectionsLoading } = useQuery({
    queryKey: ['/api/connections'],
    queryFn: async () => {
      console.log('🔍 BUSCANDO SUAS CONEXÕES...');
      const response = await fetch('/api/connections');
      const data = await response.json();
      console.log('✅ CONEXÕES ENCONTRADAS:', data);
      return data;
    },
  });

  // Buscar estatísticas do dashboard
  const { data: stats } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    enabled: activeTab === 'dashboard',
  });

  // Selecionar primeira conexão automaticamente
  useEffect(() => {
    if (connections.length > 0 && !selectedConnectionId) {
      setSelectedConnectionId(connections[0].id);
    }
  }, [connections, selectedConnectionId]);

  // Mutation para excluir conexão
  const deleteConnectionMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/connections/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete connection');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      if (selectedConnectionId === deleteConnectionMutation.variables) {
        setSelectedConnectionId(null);
      }
    },
  });

  const handleShowQR = async (connection: Connection) => {
    try {
      const response = await fetch(`/api/connections/${connection.id}/qr`);
      if (response.ok) {
        const qrResponse = await response.json();
        setSelectedConnectionForQR(connection);
        setQrData({
          qrCode: qrResponse.qrCode,
          expiration: qrResponse.expiration
        });
        setShowQRSection(true);
      }
    } catch (error) {
      console.error('❌ Erro ao buscar QR Code:', error);
    }
  };

  const getStatusColor = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'disconnected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return <Wifi className="h-4 w-4" />;
      case 'connecting':
        return <Clock className="h-4 w-4" />;
      case 'disconnected':
        return <WifiOff className="h-4 w-4" />;
      default:
        return <WifiOff className="h-4 w-4" />;
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <div className="max-w-7xl space-y-8 animate-slide-up">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Card de Conexões - Design Sofisticado Verde */}
            <div className="card-sophisticated hover:scale-105 transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="text-sm font-medium text-slate-600">
                    Conexões Ativas
                  </CardTitle>
                  <div className="text-3xl font-bold text-gradient-green mt-2">
                    {stats?.activeConnections || 0}
                  </div>
                </div>
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                  <Wifi className="h-6 w-6 text-white" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    Total: {stats?.totalConnections || 0}
                  </p>
                  <div className="badge-success text-xs">
                    Online
                  </div>
                </div>
              </CardContent>
            </div>

            {/* Card de Mensagens Hoje - Design Sofisticado */}
            <div className="card-sophisticated hover:scale-105 transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="text-sm font-medium text-slate-600">
                    Mensagens Hoje
                  </CardTitle>
                  <div className="text-3xl font-bold text-gradient-green mt-2">
                    {stats?.messagesToday || 0}
                  </div>
                </div>
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-white" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    +{Math.round((stats?.messagesToday || 0) * 0.1)} desde ontem
                  </p>
                  <div className="badge-info text-xs">
                    Ativo
                  </div>
                </div>
              </CardContent>
            </div>

            {/* Card de Usuários Online */}
            <Card className="border-l-4 border-l-orange-400 shadow-lg hover:shadow-xl transition-all duration-200 bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Usuários Online
                </CardTitle>
                <Users className="h-5 w-5 text-orange-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-500">
                  {stats?.usersOnline}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Últimas 24h
                </p>
              </CardContent>
            </Card>

            {/* Card de Taxa de Entrega */}
            <Card className="border-l-4 border-l-gray-500 shadow-lg hover:shadow-xl transition-all duration-200 bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Taxa de Entrega
                </CardTitle>
                <Activity className="h-5 w-5 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-700">
                  {stats?.deliveryRate}%
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Últimas 24h
                </p>
              </CardContent>
            </Card>
          </div>

            <Card>
              <CardHeader>
                <CardTitle>Conexões Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {connections.slice(0, 5).map((connection: Connection) => (
                    <div key={connection.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(connection.status)}`} />
                        <div>
                          <p className="font-medium">{connection.name}</p>
                          <p className="text-sm text-gray-500">{connection.phoneNumber}</p>
                        </div>
                      </div>
                      <Badge variant={connection.status === 'connected' ? 'default' : 'secondary'}>
                        {connection.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "connections":
        return (
          <div className="max-w-6xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Gerenciar Conexões</h3>
              <Button onClick={() => setShowNewConnectionModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Conexão
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {connectionsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                connections.map((connection: Connection) => (
                  <Card key={connection.id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(connection.status)}`} />
                          <h4 className="font-medium">{connection.name}</h4>
                        </div>
                        <Badge 
                          variant={connection.status === 'connected' ? 'default' : 'secondary'}
                          className="flex items-center space-x-1"
                        >
                          {getStatusIcon(connection.status)}
                          <span>{connection.status}</span>
                        </Badge>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="text-sm">
                          <span className="text-gray-500">Telefone:</span>
                          <span className="ml-2 font-medium">{connection.phoneNumber || 'Não configurado'}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-500">Instância:</span>
                          <span className="ml-2 font-medium">{connection.instanceName}</span>
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        {connection.status === 'disconnected' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleShowQR(connection)}
                          >
                            Conectar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteConnectionMutation.mutate(connection.id)}
                          disabled={deleteConnectionMutation.isPending}
                        >
                          Excluir
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        );

      case "messages":
        return (
          <div className="h-full w-full">
            <MessageInterface
              connections={connections}
              selectedConnectionId={selectedConnectionId}
              onSelectConnection={setSelectedConnectionId}
            />
          </div>
        );

      case "contacts":
        return (
          <div className="h-full">
            <Contacts activeConnectionId={selectedConnectionId || 36} />
          </div>
        );

      case "contacts-manager":
        return (
          <div className="h-full">
            <ContactsManager activeConnectionId={selectedConnectionId || 36} />
          </div>
        );

      case "contacts-management":
        return <ContactsManagementIntegrated />;

      case "settings":
        return (
          <div className="max-w-4xl space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Configurações do Sistema</h3>

            <Card>
              <CardContent className="p-6">
                <h4 className="font-medium text-gray-900 mb-4">Configurações Gerais</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Sistema</label>
                    <Input defaultValue="WhatsApp Hub" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Porta da API</label>
                    <Input type="number" defaultValue="5000" />
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <Button>Salvar Configurações</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-gradient-to-br from-slate-50 via-green-50/30 to-emerald-50/40 fixed inset-0">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        onNewConnection={() => setShowNewConnectionModal(true)}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header Sofisticado */}
        <header className="glass-panel border-b border-white/20 px-8 py-6 flex-shrink-0 animate-slide-up">
          <div className="flex items-center justify-between h-full">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gradient-green">
                  {activeTab === 'dashboard' && 'Dashboard'}
                  {activeTab === 'connections' && 'Conexões'}
                  {activeTab === 'messages' && 'Mensagens'}
                  {activeTab === 'contacts' && 'Contatos'}
                  {activeTab === 'contacts-manager' && 'Gerenciar Contatos'}
                  {activeTab === 'contacts-management' && 'Gerenciamento de Contatos'}
                  {activeTab === 'contacts-dashboard' && 'Dashboard de Contatos'}
                  {activeTab === 'settings' && 'Configurações'}
                </h2>
                <p className="text-slate-600 text-sm">
                  {activeTab === 'dashboard' && 'Sistema de comunicação integrado'}
                  {activeTab === 'connections' && 'Gerencie suas conexões WhatsApp'}
                  {activeTab === 'messages' && 'Interface de mensagens em tempo real'}
                  {activeTab === 'contacts' && 'Central de gerenciamento de contatos'}
                  {activeTab === 'contacts-manager' && 'Ferramentas avançadas de gestão'}
                  {activeTab === 'settings' && 'Personalize sua experiência'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="badge-success animate-scale-in">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                Sistema Online
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden p-2">
          {/* QR Code Section - Inline */}
          {showQRSection && selectedConnectionForQR && qrData && (
            <div className="mb-4 bg-gradient-to-br from-orange-50 to-white border border-orange-200 rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">🔗 Conectar WhatsApp</h2>
                    <p className="text-orange-100">Escaneie o QR Code para conectar {selectedConnectionForQR.name}</p>
                  </div>
                  <button 
                    onClick={() => setShowQRSection(false)}
                    className="text-white hover:bg-orange-400 rounded-lg p-2 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* QR Code */}
                  <div className="flex flex-col items-center">
                    <div className="bg-white p-6 rounded-xl border-2 border-orange-300 shadow-lg">
                      <img 
                        src={qrData.qrCode} 
                        alt="QR Code WhatsApp" 
                        className="w-64 h-64"
                      />
                    </div>
                    <div className="mt-4 text-center">
                      <div className="text-sm text-gray-600 mb-2">
                        ⏰ QR Code expira em: <span className="font-mono font-semibold">3:00</span>
                      </div>
                      <button 
                        onClick={async () => {
                          if (selectedConnectionForQR) {
                            try {
                              const response = await fetch(`/api/connections/${selectedConnectionForQR.id}/qr`);
                              if (response.ok) {
                                const newQrData = await response.json();
                                setQrData(newQrData);
                              }
                            } catch (error) {
                              console.error('Erro ao atualizar QR:', error);
                            }
                          }
                        }}
                        className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors font-medium"
                      >
                        🔄 Atualizar QR Code
                      </button>
                    </div>
                  </div>
                  
                  {/* Instructions */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">📱 Como conectar:</h3>
                    
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3">
                        <div className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
                        <div>
                          <p className="font-medium text-gray-800">Abra o WhatsApp no celular</p>
                          <p className="text-sm text-gray-600">Certifique-se que está conectado à internet</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start space-x-3">
                        <div className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
                        <div>
                          <p className="font-medium text-gray-800">Vá em Configurações</p>
                          <p className="text-sm text-gray-600">Toque nos três pontos (⋮) → "Aparelhos conectados"</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start space-x-3">
                        <div className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
                        <div>
                          <p className="font-medium text-gray-800">Conectar dispositivo</p>
                          <p className="text-sm text-gray-600">Toque em "Conectar um dispositivo"</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start space-x-3">
                        <div className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">4</div>
                        <div>
                          <p className="font-medium text-gray-800">Escaneie o QR Code</p>
                          <p className="text-sm text-gray-600">Aponte a câmera para o código ao lado</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-blue-500">💡</span>
                        <span className="font-semibold text-blue-800">Dica importante</span>
                      </div>
                      <p className="text-blue-700 text-sm">
                        O QR Code expira automaticamente em 3 minutos por segurança. 
                        Se expirar, clique em "Atualizar QR Code" para gerar um novo.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {renderContent()}
        </main>
      </div>

      {/* Modals */}
      <NewConnectionModal
        isOpen={showNewConnectionModal}
        onClose={() => setShowNewConnectionModal(false)}
        onConnectionCreated={async (connectionId) => {
          console.log('🔄 Exibindo QR Code inline para conexão:', connectionId);
          
          // Aguardar um pouco e atualizar as conexões
          await new Promise(resolve => setTimeout(resolve, 500));
          await queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
          
          // Buscar QR Code e exibir na página
          try {
            const response = await fetch(`/api/connections/${connectionId}/qr`);
            if (response.ok) {
              const qrResponse = await response.json();
              console.log('✅ QR Code obtido:', qrResponse);
              
              setSelectedConnectionForQR({
                id: connectionId,
                name: `Conexão ${connectionId}`,
                status: 'waiting_qr'
              } as any);
              setQrData({
                qrCode: qrResponse.qrCode,
                expiration: qrResponse.expiration
              });
              setShowQRSection(true);
            }
          } catch (error) {
            console.error('❌ Erro ao buscar QR Code:', error);
          }
        }}
      />


    </div>
  );
}