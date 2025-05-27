import React, { useState, useEffect } from 'react';
import { Search, Phone, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
  observation?: string;
  tag?: string;
}

export default function ContactsSimple() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContacts();
  }, []);

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

  const loadContacts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/contacts');
      const data = await response.json();

      if (data && data.contacts && Array.isArray(data.contacts)) {
        const contactsData = data.contacts.map((contact: any) => ({
          id: contact.id.toString(),
          name: contact.name || contact.phoneNumber,
          phoneNumber: contact.phoneNumber,
          observation: contact.observation,
          tag: contact.tag
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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Phone className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Carregando Contatos...</h3>
          <p className="text-gray-500">Aguarde enquanto carregamos seus contatos salvos</p>
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
          <div className="text-sm text-gray-500">
            {filteredContacts.length} de {contacts.length} contatos
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="text"
            placeholder="Buscar contatos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {filteredContacts.length > 0 ? (
          <div className="bg-white">
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                className="p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {contact.name}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatPhoneNumber(contact.phoneNumber)}
                      </p>
                      {contact.observation && (
                        <p className="text-xs text-gray-600 mt-1">
                          {contact.observation}
                        </p>
                      )}
                      {contact.tag && (
                        <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mt-1">
                          {contact.tag}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 border-green-600 hover:bg-green-50"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Phone className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? 'Nenhum contato encontrado' : 'Nenhum contato disponível'}
              </h3>
              <p className="text-gray-500">
                {searchTerm ? 'Tente buscar com outros termos' : 'Adicione contatos para começar'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}