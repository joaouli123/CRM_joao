import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Send, Phone, Video, MoreVertical, Paperclip, Smile, Mic, Image as ImageIcon, FileText, Search, Archive, Star, Info, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useWebSocket } from "@/hooks/use-websocket";
import { Separator } from "@/components/ui/separator";

interface Message {
  id: number;
  body: string;
  direction: 'sent' | 'received';
  from: string;
  to: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: Date | null;
  connectionId: number;
}

interface Conversation {
  phoneNumber: string;
  contactName: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messageCount: number;
  profilePicture?: string;
}

interface ModernMessageInterfaceProps {
  activeConnectionId: number;
}

export default function ModernMessageInterface({ activeConnectionId }: ModernMessageInterfaceProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isConnected } = useWebSocket(activeConnectionId);

  // Carregar conversas
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setLoading(true);
        
        // Usar o endpoint correto que já existe no backend
        const response = await fetch(`/api/connections/${activeConnectionId}/conversations`);
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Conversas carregadas:', data);
          setConversations(data);
        } else {
          console.log('❌ Erro ao carregar conversas:', response.status);
          setConversations([]);
        }
      } catch (error) {
        console.error('Erro ao carregar conversas:', error);
        setConversations([]);
      } finally {
        setLoading(false);
      }
    };

    if (activeConnectionId) {
      fetchConversations();
    }
  }, [activeConnectionId]);

  // Carregar mensagens da conversa selecionada
  useEffect(() => {
    if (selectedConversation) {
      const fetchMessages = async () => {
        try {
          const response = await fetch(`/api/messages/${activeConnectionId}/${selectedConversation}`);
          if (response.ok) {
            const data = await response.json();
            setMessages(data);
          }
        } catch (error) {
          console.error('Erro ao carregar mensagens:', error);
        }
      };

      fetchMessages();
    }
  }, [selectedConversation, activeConnectionId]);

  // Auto scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Enviar mensagem
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const response = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: activeConnectionId,
          to: selectedConversation,
          message: newMessage
        })
      });

      if (response.ok) {
        setNewMessage('');
        // Adicionar mensagem temporária
        const tempMessage: Message = {
          id: Date.now(),
          body: newMessage,
          direction: 'sent',
          from: 'me',
          to: selectedConversation,
          status: 'pending',
          timestamp: new Date(),
          connectionId: activeConnectionId
        };
        setMessages(prev => [...prev, tempMessage]);
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  };

  // Filtrar conversas
  const filteredConversations = conversations.filter(conv =>
    conv.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.phoneNumber.includes(searchQuery)
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'read': return 'text-blue-500';
      case 'delivered': return 'text-green-500';
      case 'sent': return 'text-gray-500';
      case 'pending': return 'text-yellow-500';
      case 'failed': return 'text-red-500';
      default: return 'text-gray-400';
    }
  };

  const selectedConv = conversations.find(c => c.phoneNumber === selectedConversation);

  return (
    <div className="flex h-full bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      {/* Lista de Conversas */}
      <div className="w-1/3 bg-white/80 backdrop-blur-sm border-r border-green-200 flex flex-col">
        {/* Header da Lista */}
        <div className="p-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Conversas</h2>
            <Badge variant="secondary" className="bg-white/20 text-white">
              {conversations.length}
            </Badge>
          </div>
          
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-300" />
            <Input
              placeholder="Buscar conversas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/20 border-white/30 text-white placeholder:text-green-200 focus:bg-white/30"
            />
          </div>
        </div>

        {/* Lista de Conversas */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              </div>
            ) : filteredConversations.length > 0 ? (
              filteredConversations.map((conversation) => (
                <Card
                  key={conversation.phoneNumber}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                    selectedConversation === conversation.phoneNumber
                      ? 'bg-gradient-to-r from-green-100 to-emerald-100 border-green-300 shadow-md'
                      : 'bg-white/60 hover:bg-white/80 border-green-100'
                  }`}
                  onClick={() => setSelectedConversation(conversation.phoneNumber)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Avatar className="h-12 w-12 border-2 border-green-200">
                          <AvatarImage src={conversation.profilePicture} alt={conversation.contactName} />
                          <AvatarFallback className="bg-gradient-to-br from-green-400 to-emerald-500 text-white font-semibold">
                            {conversation.contactName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {conversation.unreadCount > 0 && (
                          <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 bg-red-500 text-white text-xs flex items-center justify-center">
                            {conversation.unreadCount}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {conversation.contactName}
                          </h3>
                          <span className="text-xs text-gray-500">
                            {format(new Date(conversation.lastMessageTime), 'HH:mm', { locale: ptBR })}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-600 truncate mt-1">
                          {conversation.lastMessage}
                        </p>
                        
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-500">
                            {conversation.phoneNumber}
                          </span>
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            {conversation.messageCount} msgs
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center p-8 text-gray-500">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Nenhuma conversa encontrada</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Área de Chat */}
      <div className="flex-1 flex flex-col">
        {selectedConversation && selectedConv ? (
          <>
            {/* Header do Chat */}
            <div className="bg-white/90 backdrop-blur-sm border-b border-green-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10 border-2 border-green-200">
                    <AvatarImage src={selectedConv.profilePicture} alt={selectedConv.contactName} />
                    <AvatarFallback className="bg-gradient-to-br from-green-400 to-emerald-500 text-white">
                      {selectedConv.contactName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedConv.contactName}</h3>
                    <p className="text-sm text-gray-600">{selectedConv.phoneNumber}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button size="sm" variant="ghost" className="text-green-600 hover:bg-green-50">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-green-600 hover:bg-green-50">
                    <Video className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-green-600 hover:bg-green-50">
                    <Info className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-green-600 hover:bg-green-50">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Mensagens */}
            <ScrollArea className="flex-1 p-4 bg-gradient-to-b from-green-25 to-emerald-25">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.direction === 'sent' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl shadow-sm ${
                        message.direction === 'sent'
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                          : 'bg-white border border-green-100'
                      }`}
                    >
                      <p className="text-sm">{message.body}</p>
                      <div className={`flex items-center justify-between mt-1 text-xs ${
                        message.direction === 'sent' ? 'text-green-100' : 'text-gray-500'
                      }`}>
                        <span>
                          {message.timestamp ? format(new Date(message.timestamp), 'HH:mm', { locale: ptBR }) : ''}
                        </span>
                        {message.direction === 'sent' && (
                          <span className={getStatusColor(message.status)}>
                            {message.status === 'read' && '✓✓'}
                            {message.status === 'delivered' && '✓✓'}
                            {message.status === 'sent' && '✓'}
                            {message.status === 'pending' && '⏳'}
                            {message.status === 'failed' && '❌'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input de Mensagem */}
            <div className="bg-white/90 backdrop-blur-sm border-t border-green-200 p-4">
              <div className="flex items-center space-x-2">
                <Button size="sm" variant="ghost" className="text-green-600 hover:bg-green-50">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="text-green-600 hover:bg-green-50">
                  <ImageIcon className="h-4 w-4" />
                </Button>
                
                <div className="flex-1">
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="border-green-200 focus:border-green-400 focus:ring-green-400"
                  />
                </div>
                
                <Button size="sm" variant="ghost" className="text-green-600 hover:bg-green-50">
                  <Smile className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" className="text-green-600 hover:bg-green-50">
                  <Mic className="h-4 w-4" />
                </Button>
                
                <Button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-md"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          // Estado vazio
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50">
            <div className="text-center">
              <div className="bg-gradient-to-br from-green-100 to-emerald-100 rounded-full p-8 mx-auto mb-4 w-24 h-24 flex items-center justify-center">
                <MessageSquare className="h-12 w-12 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Selecione uma conversa
              </h3>
              <p className="text-gray-600 max-w-sm">
                Escolha uma conversa da lista para começar a enviar e receber mensagens
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}