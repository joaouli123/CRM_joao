import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
  lastMessage: string;
  unreadCount: number;
}

export default function ContactsSimple() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      
      // Tentar carregar conversas do WhatsApp
      const response = await fetch('/api/connections/36/conversations?limit=50');
      if (response.ok) {
        const data = await response.json();
        
        if (Array.isArray(data)) {
          const contactsData = data.map((conv: any) => ({
            id: conv.id || conv.phoneNumber,
            name: conv.name || conv.phoneNumber,
            phoneNumber: conv.phoneNumber,
            lastMessage: conv.lastMessage || 'Sem mensagens',
            unreadCount: conv.unreadCount || 0
          }));
          
          setContacts(contactsData);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phoneNumber.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Carregando contatos...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Contatos do WhatsApp
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar contatos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>

        <CardContent>
          {filteredContacts.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">
                Nenhum contato encontrado
              </h3>
              <p className="text-gray-500">
                Seus contatos do WhatsApp aparecerão aqui
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  {/* Avatar */}
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-orange-600 font-medium">
                      {contact.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Info do Contato */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {contact.name}
                      </h3>
                      {contact.unreadCount > 0 && (
                        <Badge className="bg-orange-500 text-white ml-2">
                          {contact.unreadCount}
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-gray-600 mb-1">
                      {contact.phoneNumber}
                    </p>

                    <p className="text-xs text-gray-500 truncate">
                      {contact.lastMessage}
                    </p>
                  </div>

                  {/* Botão de Ação */}
                  <Button variant="ghost" size="sm" className="ml-2">
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}