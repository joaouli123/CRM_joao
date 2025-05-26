import React, { useState, useEffect } from 'react';
import { Archive, Search, Eye, RotateCcw, Trash2, Calendar, User, MessageCircle, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ArchivedChat {
  id: number;
  connectionId: number;
  chatId: string;
  phoneNumber: string;
  contactName?: string;
  archiveDate: string;
  archiveReason: string;
  archivedBy: string;
  totalMessages: number;
  lastMessageDate: string;
  isArchived: boolean;
}

interface ArchivedMessage {
  id: number;
  content: string;
  senderId: string;
  recipientId: string;
  timestamp: string;
  direction: 'sent' | 'received';
  status: string;
  messageType: string;
}

interface ArchivedChatsProps {
  connectionId: number;
  connectionName: string;
}

export default function ArchivedChats({ connectionId, connectionName }: ArchivedChatsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChat, setSelectedChat] = useState<ArchivedChat | null>(null);
  const [showMessages, setShowMessages] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  
  const queryClient = useQueryClient();

  // Fetch archived chats
  const { data: archivedChats, isLoading } = useQuery({
    queryKey: ['archived-chats', connectionId],
    queryFn: async () => {
      const response = await fetch(`/api/connections/${connectionId}/archived-chats`);
      if (!response.ok) throw new Error('Failed to fetch archived chats');
      return response.json() as Promise<ArchivedChat[]>;
    }
  });

  // Fetch messages for selected chat
  const { data: chatMessages } = useQuery({
    queryKey: ['archived-messages', selectedChat?.id],
    queryFn: async () => {
      if (!selectedChat) return [];
      const response = await fetch(`/api/archived-chats/${selectedChat.id}/messages`);
      if (!response.ok) throw new Error('Failed to fetch archived messages');
      return response.json() as Promise<ArchivedMessage[]>;
    },
    enabled: !!selectedChat && showMessages
  });

  // Unarchive mutation
  const unarchiveMutation = useMutation({
    mutationFn: async (chatId: number) => {
      const response = await fetch(`/api/archived-chats/${chatId}/unarchive`, {
        method: 'PUT'
      });
      if (!response.ok) throw new Error('Failed to unarchive chat');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archived-chats', connectionId] });
      alert('✅ Conversa desarquivada com sucesso!');
    },
    onError: () => {
      alert('❌ Erro ao desarquivar conversa. Tente novamente.');
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (chatId: number) => {
      const response = await fetch(`/api/archived-chats/${chatId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete chat');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archived-chats', connectionId] });
      setShowDeleteConfirm(null);
      alert('🗑️ Conversa deletada permanentemente!');
    },
    onError: () => {
      alert('❌ Erro ao deletar conversa. Tente novamente.');
    }
  });

  // Filter chats based on search
  const filteredChats = archivedChats?.filter(chat =>
    chat.contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.phoneNumber.includes(searchTerm)
  ) || [];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (showMessages && selectedChat) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-gray-900">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowMessages(false)}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                ← Voltar
              </button>
              <div>
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                  {selectedChat.contactName || selectedChat.phoneNumber}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Arquivada em {formatDate(selectedChat.archiveDate)} • {selectedChat.totalMessages} mensagens
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => unarchiveMutation.mutate(selectedChat.id)}
                disabled={unarchiveMutation.isPending}
                className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Desarquivar</span>
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {chatMessages?.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.direction === 'sent' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs px-4 py-2 rounded-lg ${
                  message.direction === 'sent'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <p className="text-xs opacity-70 mt-1">
                  {formatDate(message.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Archive className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Conversas Arquivadas
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {connectionName} • {filteredChats.length} conversas arquivadas
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar conversas arquivadas por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="text-center py-12">
            <Archive className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchTerm ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa arquivada'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm 
                ? 'Tente buscar com outros termos'
                : 'As conversas arquivadas aparecerão aqui'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredChats.map((chat) => (
              <div
                key={chat.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {chat.contactName || chat.phoneNumber}
                      </h4>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>Arquivada em {formatDate(chat.archiveDate)}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <MessageCircle className="w-3 h-3" />
                          <span>{chat.totalMessages} mensagens</span>
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Motivo: {chat.archiveReason}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setSelectedChat(chat);
                        setShowMessages(true);
                      }}
                      className="flex items-center space-x-1 px-3 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Visualizar</span>
                    </button>
                    
                    <button
                      onClick={() => unarchiveMutation.mutate(chat.id)}
                      disabled={unarchiveMutation.isPending}
                      className="flex items-center space-x-1 px-3 py-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Desarquivar</span>
                    </button>
                    
                    <button
                      onClick={() => setShowDeleteConfirm(chat.id)}
                      className="flex items-center space-x-1 px-3 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Deletar</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Confirmar Exclusão
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Tem certeza que deseja deletar esta conversa permanentemente? Esta ação não pode ser desfeita.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate(showDeleteConfirm)}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deletando...' : 'Deletar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}