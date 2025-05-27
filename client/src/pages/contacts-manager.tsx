import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, MessageSquare, Mail, Tag, FileText, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

interface ContactsManagerProps {
  activeConnectionId: number;
}

export default function ContactsManager({ activeConnectionId }: ContactsManagerProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    observation: '',
    tag: ''
  });
  
  const { toast } = useToast();
  const contactsPerPage = 12;

  // Carregar contatos do WhatsApp e do banco de dados
  const loadContacts = async () => {
    if (!activeConnectionId) return;

    try {
      setLoading(true);
      
      // Primeiro, buscar contatos do WhatsApp
      const whatsappResponse = await fetch(`/api/connections/${activeConnectionId}/conversations`);
      const whatsappContacts = await whatsappResponse.json();

      // Depois, buscar contatos salvos no banco usando a rota correta
      const dbResponse = await fetch(`/api/connections/${activeConnectionId}/contacts?page=${currentPage}&limit=${contactsPerPage}`);
      const dbData = await dbResponse.json();

      // Combinar e sincronizar contatos
      const combinedContacts = await syncContacts(whatsappContacts, dbData.contacts || []);
      
      setContacts(combinedContacts);
      setFilteredContacts(combinedContacts);
      setTotalPages(Math.ceil((dbData.total || combinedContacts.length) / contactsPerPage));
      
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

  // Sincronizar contatos do WhatsApp com o banco de dados
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
      const response = await fetch(`/api/connections/${activeConnectionId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: whatsappContact.contactName || whatsappContact.phoneNumber,
          phoneNumber: whatsappContact.phoneNumber,
          profilePictureUrl: whatsappContact.profilePicture,
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

  // Adicionar novo contato
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
      const response = await fetch(`/api/connections/${activeConnectionId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newContact,
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
      // Mapear os campos para os nomes que o backend espera
      const mappedData = {
        ...updates,
        observacao: updates.observation, // Backend espera 'observacao'
        etiqueta: updates.tag, // Backend espera 'etiqueta'
        origem: updates.origem // Backend já espera 'origem'
      };
      
      console.log('🔧 DADOS MAPEADOS SENDO ENVIADOS:', mappedData);
      
      const response = await fetch(`/api/contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mappedData)
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

  // Pesquisa em tempo real
  useEffect(() => {
    const filtered = contacts.filter(contact =>
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phoneNumber.includes(searchTerm) ||
      contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.tag?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredContacts(filtered);
  }, [searchTerm, contacts]);

  // Carregar contatos quando a conexão muda
  useEffect(() => {
    if (activeConnectionId) {
      loadContacts();
    }
  }, [activeConnectionId, currentPage]);

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
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gerenciar Contatos</h1>
            <p className="text-gray-600">Organize e gerencie seus contatos do WhatsApp</p>
          </div>
          
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-orange-600 hover:bg-orange-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Novo Contato
              </Button>
            </DialogTrigger>
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
                  <Input
                    id="tag"
                    value={newContact.tag}
                    onChange={(e) => setNewContact(prev => ({ ...prev, tag: e.target.value }))}
                    placeholder="cliente, lead, parceiro..."
                  />
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
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Pesquisar contatos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-gray-200 focus:border-orange-300 focus:ring-orange-200"
            />
          </div>
          <Button 
            onClick={loadContacts}
            variant="outline"
            className="text-orange-600 border-orange-200 hover:bg-orange-50"
          >
            Atualizar
          </Button>
        </div>
      </div>

      {/* Contacts Grid */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            <span className="ml-2 text-gray-600">Carregando contatos...</span>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum contato encontrado</h3>
            <p className="text-gray-500">Adicione contatos ou ajuste sua pesquisa</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredContacts.map((contact) => (
              <Card key={contact.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={contact.profilePictureUrl} />
                        <AvatarFallback className="bg-orange-100 text-orange-600">
                          {contact.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{contact.name}</h3>
                        <p className="text-sm text-gray-600 truncate">{contact.phoneNumber}</p>
                      </div>
                    </div>
                  </div>

                  {contact.email && (
                    <div className="flex items-center space-x-2 mb-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600 truncate">{contact.email}</span>
                    </div>
                  )}

                  {contact.tag && (
                    <div className="mb-3">
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                        <Tag className="w-3 h-3 mr-1" />
                        {contact.tag}
                      </Badge>
                    </div>
                  )}

                  {contact.observation && (
                    <div className="mb-3">
                      <p className="text-sm text-gray-600 line-clamp-2">{contact.observation}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
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
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteContact(contact.id)}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white border-t border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Página {currentPage} de {totalPages}
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Próxima
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
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
                <Input
                  id="edit-tag"
                  value={selectedContact.tag || ''}
                  onChange={(e) => setSelectedContact(prev => prev ? { ...prev, tag: e.target.value } : null)}
                />
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