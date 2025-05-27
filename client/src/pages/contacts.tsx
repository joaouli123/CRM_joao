import React, { useState, useEffect } from 'react';
import { Search, Phone, MessageSquare, Archive, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
  profilePictureUrl?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  status?: 'online' | 'offline' | 'typing';
}

interface ContactsProps {
  activeConnectionId?: number;
}

export default function Contacts({ activeConnectionId }: ContactsProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Buscar todos os contatos da conexão ativa
  const loadContacts = async () => {
    if (!activeConnectionId) return;

    try {
      setLoading(true);
      const response = await api.get(`/api/connections/${activeConnectionId}/conversations`);

      if (response.data && Array.isArray(response.data)) {
        const contactsData = response.data.map((conv: any) => ({
          id: conv.phoneNumber || conv.id,
          name: conv.contactName || conv.pushName || conv.phoneNumber || 'Contato sem nome',
          phoneNumber: conv.phoneNumber || conv.id,
          profilePictureUrl: conv.profilePictureUrl,
          lastMessage: conv.lastMessage?.body || 'Sem mensagens',
          lastMessageTime: conv.lastMessage?.timestamp,
          unreadCount: conv.unreadCount || 0,
          status: 'offline'
        }));

        setContacts(contactsData);
        setFilteredContacts(contactsData);
      }
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar contatos com base na pesquisa
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredContacts(contacts);
    } else {
      const filtered = contacts.filter(contact => 
        contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.phoneNumber.includes(searchTerm)
      );
      setFilteredContacts(filtered);
    }
  }, [searchTerm, contacts]);

  // Carregar contatos quando a conexão mudar
  useEffect(() => {
    loadContacts();
  }, [activeConnectionId]);

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

  const formatLastMessageTime = (timestamp: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
  };

  if (!activeConnectionId) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Phone className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Selecione uma Conexão</h3>
          <p className="text-gray-500">Escolha uma conexão WhatsApp para ver os contatos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Contatos</h1>
          <Button 
            onClick={loadContacts}
            variant="outline"
            size="sm"
            className="text-orange-600 border-orange-200 hover:bg-orange-50"
          >
            Atualizar
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Pesquisar contatos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 border-gray-200 focus:border-orange-300 focus:ring-orange-200"
          />
        </div>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
            <p className="text-gray-500 mt-2">Carregando contatos...</p>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? 'Nenhum contato encontrado' : 'Nenhum contato disponível'}
            </h3>
            <p className="text-gray-500">
              {searchTerm 
                ? 'Tente ajustar sua pesquisa' 
                : 'Inicie uma conversa para ver contatos aqui'
              }
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {filteredContacts.map((contact) => (
              <Card 
                key={contact.id}
                className={`cursor-pointer transition-all hover:shadow-md border-gray-200 ${
                  selectedContact?.id === contact.id ? 'ring-2 ring-orange-200 border-orange-300' : ''
                }`}
                onClick={() => setSelectedContact(contact)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    {/* Avatar */}
                    <Avatar className="w-12 h-12 flex-shrink-0">
                      <AvatarImage 
                        src={contact.profilePictureUrl} 
                        alt={contact.name}
                      />
                      <AvatarFallback className="bg-orange-100 text-orange-600 font-medium">
                        {contact.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {/* Contact Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {contact.name}
                        </h3>
                        <div className="flex items-center space-x-2">
                          {contact.unreadCount > 0 && (
                            <Badge className="bg-orange-500 text-white">
                              {contact.unreadCount}
                            </Badge>
                          )}
                          <span className="text-xs text-gray-500">
                            {formatLastMessageTime(contact.lastMessageTime)}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-gray-600 mb-1">
                        {formatPhoneNumber(contact.phoneNumber)}
                      </p>

                      <p className="text-xs text-gray-500 truncate">
                        {contact.lastMessage}
                      </p>
                    </div>

                    {/* Status Indicator */}
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        contact.status === 'online' ? 'bg-green-400' : 
                        contact.status === 'typing' ? 'bg-orange-400' : 'bg-gray-300'
                      }`} />

                      <Button variant="ghost" size="sm" className="p-1">
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Contact Details Panel (quando um contato for selecionado) */}
      {selectedContact && (
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="w-10 h-10">
                <AvatarImage 
                  src={selectedContact.profilePictureUrl} 
                  alt={selectedContact.name}
                />
                <AvatarFallback className="bg-orange-100 text-orange-600 font-medium">
                  {selectedContact.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h4 className="text-sm font-medium text-gray-900">{selectedContact.name}</h4>
                <p className="text-xs text-gray-500">{formatPhoneNumber(selectedContact.phoneNumber)}</p>
              </div>
            </div>

            <div className="flex space-x-2">
              <Button 
                size="sm" 
                variant="outline"
                className="text-orange-600 border-orange-200 hover:bg-orange-50"
              >
                <MessageSquare className="w-4 h-4 mr-1" />
                Conversar
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                className="text-gray-600 border-gray-200 hover:bg-gray-50"
              >
                <Archive className="w-4 h-4 mr-1" />
                Arquivar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}