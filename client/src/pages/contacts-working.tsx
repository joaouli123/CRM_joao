import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Phone, MessageSquare, Calendar, Users, Activity, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface Contact {
  id: number;
  name: string;
  phoneNumber: string;
  email?: string;
  observation?: string;
  tag?: string;
  origem?: string;
  createdAt: string;
}

interface ContactStats {
  total: number;
  today: number;
  lastUpdate: string;
}

export default function ContactsWorking() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<ContactStats>({ total: 0, today: 0, lastUpdate: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Estados para modais
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactOptionsOpen, setContactOptionsOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    tag: '',
    origem: '',
    observation: ''
  });
  
  const { toast } = useToast();

  useEffect(() => {
    loadContacts();
    loadStats();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredContacts(contacts);
    } else {
      const filtered = contacts.filter(contact => 
        contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.phoneNumber.includes(searchTerm) ||
        (contact.email && contact.email.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredContacts(filtered);
    }
  }, [searchTerm, contacts]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/contacts');
      const data = await response.json();

      if (data && data.contacts && Array.isArray(data.contacts)) {
        setContacts(data.contacts);
        setFilteredContacts(data.contacts);
      }
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/contacts/stats');
      const data = await response.json();
      if (data) {
        setStats(data);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('55')) {
      const countryCode = cleaned.slice(0, 2);
      const areaCode = cleaned.slice(2, 4);
      const number = cleaned.slice(4);
      return `+${countryCode} (${areaCode}) ${number.slice(0, 5)}-${number.slice(5)}`;
    }
    return phone;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  // Funções para edição
  const handleEditContact = (contact: Contact) => {
    setSelectedContact(contact);
    setEditForm({
      name: contact.name,
      phoneNumber: contact.phoneNumber,
      email: contact.email || '',
      tag: contact.tag || '',
      origem: contact.origem || 'whatsapp',
      observation: contact.observation || ''
    });
    setEditDialogOpen(true);
  };

  const handleUpdateContact = async () => {
    if (!selectedContact) return;

    try {
      // Mapear os campos para os nomes que o backend espera
      const mappedData = {
        ...editForm,
        email: editForm.email || null,
        observacao: editForm.observation || null, // Backend espera 'observacao'
        etiqueta: editForm.tag || null, // Backend espera 'etiqueta'
        origem: editForm.origem // Backend já espera 'origem'
      };
      
      console.log('🔧 DADOS MAPEADOS SENDO ENVIADOS:', mappedData);
      
      const response = await fetch(`/api/contacts/${selectedContact.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mappedData),
      });

      if (response.ok) {
        await loadContacts();
        setEditDialogOpen(false);
        setSelectedContact(null);
        toast({
          title: "Contato atualizado!",
          description: "As informações foram salvas com sucesso.",
        });
      } else {
        throw new Error('Erro ao atualizar contato');
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o contato.",
        variant: "destructive",
      });
    }
  };

  // Funções para exclusão
  const handleDeleteContact = (contact: Contact) => {
    setSelectedContact(contact);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteContact = async () => {
    if (!selectedContact) return;

    try {
      const response = await fetch(`/api/contacts/${selectedContact.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadContacts();
        setDeleteDialogOpen(false);
        setSelectedContact(null);
        toast({
          title: "Contato excluído!",
          description: "O contato foi removido com sucesso.",
        });
      } else {
        throw new Error('Erro ao excluir contato');
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o contato.",
        variant: "destructive",
      });
    }
  };

  // Função para verificar WhatsApp e abrir conversa
  const handleOpenConversation = async (contact: Contact) => {
    setSelectedContact(contact);
    
    // Verifica se a origem é WhatsApp - se for, abre direto a conversa
    if (contact.origem === 'whatsapp') {
      // Aqui você pode navegar para a página de conversa
      toast({
        title: "Abrindo conversa",
        description: `Iniciando conversa com ${contact.name}`,
      });
      // Implementar navegação para conversa
    } else {
      // Se não for WhatsApp, mostra opções de contato
      setContactOptionsOpen(true);
    }
  };

  // Função para ligar para o contato
  const handleCallContact = () => {
    if (selectedContact) {
      window.open(`tel:${selectedContact.phoneNumber}`, '_self');
      setContactOptionsOpen(false);
    }
  };

  // Função para enviar email
  const handleEmailContact = () => {
    if (selectedContact && selectedContact.email) {
      window.open(`mailto:${selectedContact.email}`, '_self');
      setContactOptionsOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Carregando Contatos...</h3>
          <p className="text-gray-500">Aguarde enquanto carregamos seus contatos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header com Estatísticas */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Gerenciar Contatos</h1>
          <p className="text-gray-600">Visualize e gerencie todos os seus contatos do WhatsApp</p>
        </div>

        {/* Dashboard de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Contatos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">contatos salvos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Novos Hoje</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.today}</div>
              <p className="text-xs text-muted-foreground">adicionados hoje</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Última Atualização</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Agora</div>
              <p className="text-xs text-muted-foreground">sincronizado</p>
            </CardContent>
          </Card>
        </div>

        {/* Busca e Ações */}
        <div className="flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Buscar contatos por nome, telefone ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="text-sm text-gray-500">
            {filteredContacts.length} de {contacts.length} contatos
          </div>
        </div>
      </div>

      {/* Lista de Contatos */}
      <div className="flex-1 overflow-auto">
        {filteredContacts.length > 0 ? (
          <div className="bg-white">
            {/* Header da Tabela */}
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-200 bg-gray-50 text-sm font-medium text-gray-700">
              <div className="col-span-2">Nome</div>
              <div className="col-span-2">Telefone</div>
              <div className="col-span-2">Email</div>
              <div className="col-span-2">Tag</div>
              <div className="col-span-2">Origem</div>
              <div className="col-span-1">Data</div>
              <div className="col-span-1">Ações</div>
            </div>

            {/* Linhas de Contatos */}
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                className="grid grid-cols-12 gap-4 p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="col-span-2 flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{contact.name}</h3>
                    {contact.observation && (
                      <p className="text-xs text-gray-500 truncate">{contact.observation}</p>
                    )}
                  </div>
                </div>

                <div className="col-span-2 flex items-center">
                  <div>
                    <p className="text-sm text-gray-900">{formatPhoneNumber(contact.phoneNumber)}</p>
                    <p className="text-xs text-gray-500">WhatsApp</p>
                  </div>
                </div>

                <div className="col-span-2 flex items-center">
                  <p className="text-sm text-gray-900 truncate">{contact.email || '-'}</p>
                </div>

                <div className="col-span-2 flex items-center">
                  {contact.tag ? (
                    <Badge variant="outline" className="text-xs">
                      {contact.tag}
                    </Badge>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </div>

                <div className="col-span-2 flex items-center">
                  {contact.origem ? (
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        contact.origem === 'whatsapp' ? 'bg-green-100 text-green-800 border-green-300' :
                        contact.origem === 'site' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                        contact.origem === 'organico' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                        contact.origem === 'indicacao' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                        contact.origem === 'publicidade' ? 'bg-red-100 text-red-800 border-red-300' :
                        'bg-gray-100 text-gray-800 border-gray-300'
                      }`}
                    >
                      {contact.origem === 'whatsapp' ? 'WhatsApp' :
                       contact.origem === 'site' ? 'Site' :
                       contact.origem === 'organico' ? 'Orgânico' :
                       contact.origem === 'indicacao' ? 'Indicação' :
                       contact.origem === 'publicidade' ? 'Publicidade' :
                       contact.origem}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                      WhatsApp
                    </Badge>
                  )}
                </div>

                <div className="col-span-1 flex items-center">
                  <p className="text-xs text-gray-500">{formatDate(contact.createdAt)}</p>
                </div>

                <div className="col-span-1 flex items-center space-x-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-600 border-green-600 hover:bg-green-50"
                    title={contact.origem === 'whatsapp' ? "Abrir conversa no WhatsApp" : "Opções de contato"}
                    onClick={() => handleOpenConversation(contact)}
                  >
                    <MessageSquare className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-blue-600 border-blue-600 hover:bg-blue-50"
                    title="Editar contato"
                    onClick={() => handleEditContact(contact)}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-600 hover:bg-red-50"
                    title="Excluir contato"
                    onClick={() => handleDeleteContact(contact)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? 'Nenhum contato encontrado' : 'Nenhum contato disponível'}
              </h3>
              <p className="text-gray-500">
                {searchTerm ? 'Tente buscar com outros termos' : 'Seus contatos aparecerão aqui'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Contato</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Nome
              </Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">
                Telefone
              </Label>
              <Input
                id="phone"
                value={editForm.phoneNumber}
                onChange={(e) => setEditForm({...editForm, phoneNumber: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="tag" className="text-right">
                Etiqueta
              </Label>
              <Input
                id="tag"
                value={editForm.tag}
                onChange={(e) => setEditForm({...editForm, tag: e.target.value})}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="origem" className="text-right">
                Origem
              </Label>
              <Select value={editForm.origem} onValueChange={(value) => setEditForm({...editForm, origem: value})}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="observation" className="text-right">
                Observação
              </Label>
              <Textarea
                id="observation"
                value={editForm.observation}
                onChange={(e) => setEditForm({...editForm, observation: e.target.value})}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleUpdateContact}>
              <Save className="w-4 h-4 mr-2" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              Tem certeza que deseja excluir o contato <strong>{selectedContact?.name}</strong>?
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Esta ação não poderá ser desfeita.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDeleteContact}>
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Opções de Contato */}
      <Dialog open={contactOptionsOpen} onOpenChange={setContactOptionsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Como deseja entrar em contato?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 mb-4">
              <strong>{selectedContact?.name}</strong> não possui WhatsApp cadastrado.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Escolha uma das opções abaixo para entrar em contato:
            </p>
            
            <div className="space-y-3">
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={handleCallContact}
              >
                <Phone className="w-4 h-4 mr-3" />
                Ligar para {formatPhoneNumber(selectedContact?.phoneNumber || '')}
              </Button>
              
              {selectedContact?.email && (
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={handleEmailContact}
                >
                  <MessageSquare className="w-4 h-4 mr-3" />
                  Enviar email para {selectedContact.email}
                </Button>
              )}
              
              {!selectedContact?.email && (
                <p className="text-sm text-gray-400 text-center py-2">
                  Nenhum email cadastrado para este contato
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactOptionsOpen(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}