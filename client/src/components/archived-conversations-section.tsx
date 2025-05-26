import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Archive, RotateCcw, Trash2, VolumeX, Tag, User, FolderOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { format, isToday, isYesterday } from "date-fns";

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
  lastMessage?: string;
  isArchived: boolean;
}

interface ArchivedConversationsSectionProps {
  connectionId: number | null;
  onChatSelect: (phoneNumber: string) => void;
}

export default function ArchivedConversationsSection({ 
  connectionId, 
  onChatSelect 
}: ArchivedConversationsSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const queryClient = useQueryClient();

  // Fetch archived chats
  const { data: archivedChats, isLoading } = useQuery({
    queryKey: ['archived-chats', connectionId],
    queryFn: async () => {
      if (!connectionId) return [];
      const response = await fetch(`/api/connections/${connectionId}/archived-chats`);
      if (!response.ok) throw new Error('Failed to fetch archived chats');
      return response.json() as Promise<ArchivedChat[]>;
    },
    enabled: !!connectionId && isExpanded
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
      queryClient.invalidateQueries({ queryKey: ['conversations', connectionId] });
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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return 'Ontem';
    } else {
      return format(date, 'dd/MM');
    }
  };

  const formatArchiveDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy');
  };

  if (!connectionId) return null;

  const archivedCount = archivedChats?.length || 0;

  return (
    <div className="border-t border-gray-200">
      {/* Header da Seção Arquivadas */}
      <div 
        className="p-3 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-gray-600">
            <div className="flex items-center space-x-1">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <FolderOpen className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">📂 Conversas Arquivadas</span>
          </div>
          {archivedCount > 0 && (
            <Badge variant="secondary" className="text-xs bg-gray-200 text-gray-600">
              {archivedCount}
            </Badge>
          )}
        </div>
      </div>

      {/* Lista de Conversas Arquivadas */}
      {isExpanded && (
        <div className="bg-gray-25">
          {isLoading ? (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto"></div>
              <p className="text-xs text-gray-500 mt-2">Carregando...</p>
            </div>
          ) : archivedChats && archivedChats.length > 0 ? (
            archivedChats.map((chat) => (
              <div
                key={chat.id}
                className="p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors bg-gray-25"
              >
                <div className="flex items-center space-x-3">
                  <Avatar className="opacity-75">
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => onChatSelect(chat.phoneNumber)}
                  >
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium truncate text-gray-700">
                        {chat.contactName || chat.phoneNumber}
                      </p>
                      <Archive className="h-3 w-3 text-gray-400" />
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {chat.lastMessage || 'Última mensagem não disponível'}
                    </p>
                    <p className="text-xs text-gray-400">
                      Arquivada em {formatArchiveDate(chat.archiveDate)} • {chat.totalMessages} msgs
                    </p>
                  </div>

                  <div className="flex items-center space-x-1">
                    <div className="text-right flex-shrink-0 mr-2">
                      <p className="text-xs text-gray-400">
                        {formatTime(chat.lastMessageDate)}
                      </p>
                    </div>

                    {/* Botões de Ação */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        unarchiveMutation.mutate(chat.id);
                      }}
                      disabled={unarchiveMutation.isPending}
                      className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                      title="Desarquivar conversa"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Placeholder para silenciar
                      }}
                      className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                      title="Silenciar (em breve)"
                    >
                      <VolumeX className="h-3 w-3" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Placeholder para etiquetas
                      }}
                      className="h-6 w-6 p-0 text-blue-400 hover:text-blue-600 hover:bg-blue-50"
                      title="Etiquetas (em breve)"
                    >
                      <Tag className="h-3 w-3" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(chat.id);
                      }}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      title="Excluir permanentemente"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-gray-500">
              <Archive className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">Nenhuma conversa arquivada</p>
            </div>
          )}
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Excluir Conversa Arquivada
                </h3>
                <p className="text-sm text-gray-600">
                  Esta ação não pode ser desfeita
                </p>
              </div>
            </div>
            
            <p className="text-gray-600 mb-6">
              Tem certeza que deseja excluir permanentemente esta conversa arquivada?
              Todas as mensagens serão perdidas para sempre.
            </p>
            
            <div className="flex space-x-3">
              <Button
                onClick={() => setShowDeleteConfirm(null)}
                variant="outline"
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => deleteMutation.mutate(showDeleteConfirm)}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {deleteMutation.isPending ? 'Excluindo...' : 'Excluir Permanentemente'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}