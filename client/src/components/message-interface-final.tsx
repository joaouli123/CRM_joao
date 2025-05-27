import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, Send, Phone, Clock, User, Search, Archive, MoreVertical, Trash2, Volume, VolumeX, Tag, Bell, BellOff } from "lucide-react";
import { Connection, Conversation, Message } from "@/lib/api";
import { format, isToday, isYesterday } from "date-fns";
import ArchivedConversationsSection from "./archived-conversations-section";

interface MessageInterfaceProps {
  connections: Connection[];
  selectedConnectionId: number | null;
  onSelectConnection: (id: number) => void;
}

export default function MessageInterface({ 
  connections, 
  selectedConnectionId, 
  onSelectConnection 
}: MessageInterfaceProps) {
  const [selectedConversation, setSelectedConversation] = useState<string>("");
  const [newMessage, setNewMessage] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [realtimeMessages, setRealtimeMessages] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [chatMuted, setChatMuted] = useState(false);
  const [chatTags, setChatTags] = useState<string[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // SET para controlar IDs únicos e evitar duplicação
  const processedMessageIds = useRef(new Set<string>());

  // WebSocket para mensagens em tempo real
  useEffect(() => {
    if (!selectedConnectionId) return;

    console.log(`🔌 INICIANDO WEBSOCKET para conexão ${selectedConnectionId}`);

    let socket: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connectWebSocket = () => {
      try {
        const wsUrl = `wss://${window.location.host}/api/ws`;
        console.log(`📡 Conectando WebSocket: ${wsUrl}`);

        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          console.log(`✅ WEBSOCKET CONECTADO! Conexão: ${selectedConnectionId}`);
          setIsConnected(true);
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log(`📨 WEBSOCKET EVENTO RECEBIDO:`, data);

            // Processar APENAS UM evento por mensagem para evitar duplicação
            if ((data.type === "newMessage") && data.data) {
              const msgData = data.data;

              // Só processar se for para a conexão ativa
              if (msgData.connectionId === selectedConnectionId) {
                console.log(`📨 NOVA MENSAGEM: ${msgData.content} | Direção: ${msgData.direction}`);

                setRealtimeMessages((prev) => {
                  const messageKey = `${msgData.id || msgData.tempId}`;

                  // 1. VERIFICAÇÃO RIGOROSA - Se já foi processada, ignorar completamente
                  if (processedMessageIds.current.has(messageKey)) {
                    console.log(`🚫 DUPLICAÇÃO DETECTADA - Ignorando mensagem já processada: ${messageKey}`);
                    return prev;
                  }

                  // 2. Marcar como processada ANTES de qualquer operação
                  processedMessageIds.current.add(messageKey);

                  // 3. Substituição de mensagem temporária com tempId
                  if (msgData.direction === 'sent' && msgData.tempId) {
                    console.log(`🔍 BUSCANDO mensagem temporária para ${msgData.content}`);

                    let tempIndex = prev.findIndex((m: any) => m.tempId === msgData.tempId);

                    if (tempIndex !== -1) {
                      console.log(`🔄 SUBSTITUINDO mensagem temporária (tempId: ${msgData.tempId}) por oficial (id: ${msgData.id})`);
                      // Remover tempId do conjunto e adicionar ID oficial
                      processedMessageIds.current.delete(msgData.tempId);
                      processedMessageIds.current.add(msgData.id);

                      const newMessages = [...prev];
                      newMessages[tempIndex] = {
                        id: msgData.id,
                        content: msgData.content,
                        phoneNumber: msgData.phoneNumber,
                        direction: msgData.direction,
                        timestamp: new Date(msgData.timestamp),
                        status: 'sent',
                        tempId: undefined, // Remove tempId na mensagem oficial
                      };
                      return newMessages;
                    }
                  }

                  // 4. Se não encontrou mensagem temporária, adicionar normalmente
                  const newMsg = {
                    id: msgData.id,
                    content: msgData.content,
                    phoneNumber: msgData.phoneNumber,
                    direction: msgData.direction,
                    timestamp: new Date(msgData.timestamp),
                    status: msgData.direction === 'sent' ? 'sent' : 'received'
                  };
                  console.log(`✅ ADICIONANDO nova mensagem ${msgData.id}: "${msgData.content}"`);
                  return [...prev, newMsg];
                });
              }
            }

            // 4. ATUALIZAÇÃO DE STATUS DE ENTREGA (messageReceived)
            if (data.type === 'messageReceived' && data.data) {
              const msgData = data.data;
              console.log(`📬 CONFIRMAÇÃO DE ENTREGA recebida para mensagem ${msgData.id}`);

              setRealtimeMessages((prev) => 
                prev.map((msg) => 
                  msg.id === msgData.id 
                    ? { ...msg, status: 'delivered' } // ✔✔ Atualizar para 'delivered'
                    : msg
                )
              );
              return; // Evitar processamento adicional
            }

            // 5. STATUS DE FALHA NA ENTREGA
            if (data.type === 'messageFailed' && data.data) {
              const msgData = data.data;
              console.log(`❌ FALHA NA ENTREGA para mensagem ${msgData.id}`);

              setRealtimeMessages((prev) => 
                prev.map((msg) => 
                  msg.id === msgData.id 
                    ? { ...msg, status: 'failed' } // ❌ Marcar como falha
                    : msg
                )
              );
              return; // Evitar processamento adicional
            }

            // Ignorar outros eventos duplicados
            if (data.type === "messageSent") {
              console.log(`🔇 Ignorando evento duplicado: ${data.type}`);
            }
          } catch (error) {
            console.error("❌ Erro ao processar WebSocket:", error);
          }
        };

        socket.onerror = (error) => {
          console.error("❌ WebSocket erro:", error);
          setIsConnected(false);
        };

        socket.onclose = () => {
          console.log("🔴 WebSocket fechado, tentando reconectar...");
          setIsConnected(false);
          reconnectTimer = setTimeout(connectWebSocket, 3000);
        };

      } catch (error) {
        console.error("❌ Erro ao criar WebSocket:", error);
        reconnectTimer = setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) socket.close();
    };
  }, [selectedConnectionId]);

  // Buscar conversas
  const { data: conversations = [] } = useQuery({
    queryKey: [`/api/connections/${selectedConnectionId}/conversations`],
    enabled: !!selectedConnectionId,
  });

  // Buscar mensagens do chat selecionado COM ATUALIZAÇÃO AUTOMÁTICA
  const { data: chatMessages = [] } = useQuery({
    queryKey: [`/api/connections/${selectedConnectionId}/conversations/${selectedConversation}/messages`],
    enabled: !!selectedConnectionId && !!selectedConversation,
    refetchInterval: 2000, // Verificar novas mensagens a cada 2 segundos
    refetchIntervalInBackground: true
  });

  // DEDUPLICAÇÃO ROBUSTA - Combinar mensagens sem duplicatas
  const allMessagesMap = new Map();
  const contentHashes = new Set(); // Para detectar duplicatas por conteúdo + timestamp

  // Função para criar hash único baseado em conteúdo + timestamp + telefone
  const createContentHash = (msg: any) => {
    const timestamp = new Date(msg.timestamp).getTime();
    return `${msg.content}_${msg.phoneNumber}_${msg.direction}_${Math.floor(timestamp / 1000)}`;
  };

  // 1. PRIMEIRO: Adicionar mensagens da API (sempre prioridade)
  (Array.isArray(chatMessages) ? chatMessages : []).forEach((msg) => {
    if (msg.id) {
      const contentHash = createContentHash(msg);
      allMessagesMap.set(msg.id, msg);
      contentHashes.add(contentHash);
    }
  });

  // 2. SEGUNDO: Adicionar mensagens do WebSocket com verificação rigorosa
  realtimeMessages
    .filter((m) => m.phoneNumber === selectedConversation)
    .forEach((msg) => {
      const contentHash = createContentHash(msg);

      // Evitar duplicatas por conteúdo
      if (contentHashes.has(contentHash)) {
        console.log(`🚫 DUPLICATA DETECTADA POR CONTEÚDO: ${msg.content}`);
        return;
      }

      if (msg.id && !allMessagesMap.has(msg.id)) {
        // Mensagem oficial nova
        allMessagesMap.set(msg.id, msg);
        contentHashes.add(contentHash);
      } else if (msg.tempId && !msg.id && !allMessagesMap.has(msg.tempId)) {
        // Mensagem temporária nova
        allMessagesMap.set(msg.tempId, msg);
        contentHashes.add(contentHash);
      }
    });

  const allMessages = Array.from(allMessagesMap.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Função para rolar automaticamente para o final do chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Rolar automaticamente quando mensagens mudarem
  useEffect(() => {
    scrollToBottom();
  }, [allMessages]);

  // Debug - mostrar contagem de mensagens
  useEffect(() => {
    console.log(`📊 CONTAGEM MENSAGENS: API=${chatMessages.length}, Tempo Real=${realtimeMessages.length}, Total=${allMessages.length}`);
  }, [chatMessages.length, realtimeMessages.length, allMessages.length]);

  // Funções de ação do chat
  const handleArchiveChat = async () => {
    if (!currentConversation?.phoneNumber || !connectionId) {
      console.error('❌ Dados insuficientes para arquivar:', { currentConversation, connectionId });
      alert('❌ Erro: dados da conversa não disponíveis');
      return;
    }

    try {
      console.log(`📁 Iniciando arquivamento da conversa:`, currentConversation);

      const archiveData = {
        phoneNumber: currentConversation.phoneNumber,
        contactName: currentConversation.contactName || currentConversation.phoneNumber,
        archiveReason: 'User requested archival',
        archivedBy: 'user'
      };

      console.log(`📤 Enviando dados para arquivamento:`, archiveData);

      const response = await fetch(`/api/connections/${connectionId}/archive-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(archiveData),
      });

      console.log(`📊 Resposta do servidor:`, response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Arquivamento bem-sucedido:`, result);

        setShowArchiveModal(false);
        // Refresh conversations list
        queryClient.invalidateQueries({ queryKey: ['conversations', selectedConnectionId] });
        setSelectedConversation("");
        alert('✅ Conversa arquivada com sucesso!');
      } else {
        const errorData = await response.text();
        console.error(`❌ Erro no servidor:`, errorData);
        throw new Error(`Server error: ${response.status} - ${errorData}`);
      }
    } catch (error) {
      console.error('❌ Error archiving conversation:', error);
      alert(`❌ Erro ao arquivar conversa: ${error.message}`);
    }
  };

  const handleDeleteChat = async (phoneNumber: string) => {
    if (!selectedConnectionId) return;

    try {
      const response = await fetch(`/api/connections/${selectedConnectionId}/messages/${phoneNumber}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        alert('🗑️ Conversa deletada com sucesso!');
        queryClient.invalidateQueries({ queryKey: ['conversations', selectedConnectionId] });
        setSelectedConversation("");
        setShowDeleteConfirm(false);
      } else {
        alert('❌ Erro ao deletar conversa. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao deletar:', error);
      alert('❌ Erro ao deletar conversa. Tente novamente.');
    }
  };

  const handleMuteChat = () => {
    setChatMuted(!chatMuted);
    const status = !chatMuted ? 'silenciada' : 'reativada';
    alert(`🔕 Conversa ${status} com sucesso!`);
  };

  const handleAddTag = () => {
    if (newTag.trim() && !chatTags.includes(newTag.trim())) {
      setChatTags([...chatTags, newTag.trim()]);
      setNewTag("");
      alert('🏷️ Etiqueta adicionada com sucesso!');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setChatTags(chatTags.filter(tag => tag !== tagToRemove));
  };

  // Enviar mensagem
  const sendMessage = async (message: string) => {
    if (!selectedConversation || !selectedConnectionId || !message.trim()) return;

    // 1. Criar mensagem temporária com tempId
    const tempId = crypto.randomUUID();
    const tempMessage = {
      id: tempId, // ID temporário para renderização
      tempId: tempId, // Campo específico para identificar mensagens temporárias
      content: message.trim(),
      phoneNumber: selectedConversation,
      direction: 'sent',
      timestamp: new Date(),
      status: 'pending'
    };

    // 2. Adicionar mensagem temporária IMEDIATAMENTE
    setRealtimeMessages((prev) => [...prev, tempMessage]);
    setNewMessage('');
    console.log(`⏳ MENSAGEM TEMPORÁRIA ADICIONADA: ${tempId}`, tempMessage);

    try {
      const response = await fetch(`/api/connections/${selectedConnectionId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedConversation,
          message: message.trim(),
          tempId: tempId
        })
      });

      if (response.ok) {
        // 3. Se enviou com sucesso, marcar como 'sent' imediatamente
        setRealtimeMessages((prev) => 
          prev.map((msg) => 
            msg.tempId === tempId 
              ? { ...msg, status: 'sent' }
              : msg
          )
        );
        console.log(`✅ MENSAGEM ENVIADA COM SUCESSO - Atualizando status para 'sent'`);
      } else {
        // 4. Em caso de erro, marcar como falha
        setRealtimeMessages((prev) => 
          prev.map((msg) => 
            msg.tempId === tempId 
              ? { ...msg, status: 'failed' }
              : msg
          )
        );
        console.error('❌ Erro ao enviar mensagem');
      }
    } catch (error) {
      // 5. Em caso de erro de rede, marcar como falha
      setRealtimeMessages((prev) => 
        prev.map((msg) => 
          msg.tempId === tempId 
            ? { ...msg, status: 'failed' }
            : msg
        )
      );
      console.error('❌ Erro de rede:', error);
    }
  };

  const filteredConversations = (conversations as any[]).filter((conv: any) =>
    conv.contactName?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    conv.phoneNumber.includes(searchFilter)
  );

  const formatTime = (date: Date) => {
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return 'Ontem';
    } else {
      return format(date, 'dd/MM');
    }
  };

  if (!selectedConnectionId) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Selecione uma conexão para ver as mensagens</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex h-full">
      {/* Lista de Conversas */}
      <div className="w-1/3 border-r">
        <Card className="h-full rounded-none border-0">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              Conversas
              {isConnected && (
                <Badge variant="outline" className="text-xs bg-green-100">
                  Online
                </Badge>
              )}
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversas..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-200px)]">
              {filteredConversations.map((conv: any) => (
                <div
                  key={conv.phoneNumber}
                  className={`group p-4 border-b hover:bg-muted transition-colors ${
                    selectedConversation === conv.phoneNumber ? 'bg-muted' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => {
                        console.log(`📱 SELECIONANDO CONVERSA: ${conv.phoneNumber}`);
                        setSelectedConversation(conv.phoneNumber);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">
                          {conv.contactName || conv.phoneNumber}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(new Date(conv.lastMessageTime))}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.lastMessage}
                      </p>
                      {conv.unreadCount > 0 && (
                        <Badge variant="default" className="mt-1">
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowArchiveModal(true)
                        //handleArchiveChat(conv.phoneNumber);
                      }}
                      className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Arquivar conversa"
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Seção de Conversas Arquivadas */}
              <ArchivedConversationsSection 
                connectionId={selectedConnectionId}
                onChatSelect={(phoneNumber) => setSelectedConversation(phoneNumber)}
              />
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Header do Chat */}
            <Card className="rounded-none border-0 border-b">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">
                        {filteredConversations.find((c: any) => c.phoneNumber === selectedConversation)?.contactName || selectedConversation}
                      </CardTitle>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{selectedConversation}</span>
                        {isConnected && (
                          <Badge variant="outline" className="text-xs">
                            Online
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Botões de Ação */}
                  <div className="flex items-center space-x-2">
                    {/* Etiquetas */}
                    {chatTags.length > 0 && (
                      <div className="flex items-center space-x-1">
                        {chatTags.map((tag, index) => (
                          <Badge 
                            key={index} 
                            variant="secondary" 
                            className="text-xs bg-blue-100 text-blue-700 cursor-pointer"
                            onClick={() => handleRemoveTag(tag)}
                          >
                            {tag} ×
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Status de Silenciado */}
                    {chatMuted && (
                      <Badge variant="outline" className="text-xs text-gray-500">
                        <VolumeX className="h-3 w-3 mr-1" />
                        Silenciado
                      </Badge>
                    )}

                    {/* Botão Arquivar */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowArchiveModal(true)}
                      className="flex items-center space-x-1 text-orange-600 hover:text-orange-700 border-orange-200 hover:border-orange-300"
                    >
                      <Archive className="h-4 w-4" />
                      <span>Arquivar</span>
                    </Button>

                    {/* Menu de Ações */}
                    <div className="relative">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                        className="flex items-center space-x-1"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>

                      {showActionsDropdown && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                          <div className="py-1">
                            <button
                              onClick={() => {
                                handleMuteChat();
                                setShowActionsDropdown(false);
                              }}
                              className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              {chatMuted ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                              <span>{chatMuted ? 'Reativar' : 'Silenciar'}</span>
                            </button>

                            <button
                              onClick={() => {
                                setShowTagModal(true);
                                setShowActionsDropdown(false);
                              }}
                              className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              <Tag className="h-4 w-4" />
                              <span>Adicionar Etiqueta</span>
                            </button>

                            <button
                              onClick={() => {
                                setShowDeleteConfirm(true);
                                setShowActionsDropdown(false);
                              }}
                              className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span>Excluir Conversa</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Mensagens */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {allMessages.map((message, index) => (
                  <div
                    key={`${message.id || index}-${message.timestamp}`}
                    className={`flex ${message.direction === 'sent' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-3 py-2 ${
                        message.direction === 'sent'
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <div className="flex items-center justify-end space-x-1 mt-1">
                        <Clock className="h-3 w-3 opacity-70" />
                        <span className="text-xs opacity-70">
                          {formatTime(new Date(message.timestamp))}
                        </span>
                        {message.direction === 'sent' && (
                          <span className="text-xs ml-1">
                            {message.status === 'pending' && '⏳'}
                            {message.status === 'sent' && '✔'}
                            {message.status === 'delivered' && '✔✔'}
                            {message.status === 'failed' && '❌'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Indicador "Digitando..." */}
                {typing && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 text-gray-900 rounded-lg px-3 py-2 max-w-[70%]">
                      <p className="text-sm italic">O contato está digitando...</p>
                    </div>
                  </div>
                )}

                {/* Referência para scroll automático */}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input de Mensagem */}
            <Card className="rounded-none border-0 border-t">
              <CardContent className="p-4">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        sendMessage(newMessage);
                      }
                    }}
                    className="flex-1"
                  />
                  <Button 
                    onClick={() => sendMessage(newMessage)}
                    disabled={!newMessage.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="h-full rounded-none border-0">
            <CardContent className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Selecione uma conversa para começar</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de Etiquetas */}
      {showTagModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              🏷️ Adicionar Etiqueta
            </h3>
            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Nome da etiqueta..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddTag();
                  }
                }}
                className="w-full"
              />

              {/* Etiquetas existentes */}
              {chatTags.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Etiquetas atuais:</p>
                  <div className="flex flex-wrap gap-2">
                    {chatTags.map((tag, index) => (
                      <Badge 
                        key={index} 
                        variant="secondary" 
                        className="bg-blue-100 text-blue-700 cursor-pointer"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        {tag} ×
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex space-x-3 mt-6">
              <Button
                onClick={() => {
                  setShowTagModal(false);
                  setNewTag("");
                }}
                variant="outline"
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAddTag}
                disabled={!newTag.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Adicionar
              </Button>
            </div>
          </div>
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
                  Excluir Conversa
                </h3>
                <p className="text-sm text-gray-600">
                  Esta ação não pode ser desfeita
                </p>
              </div>
            </div>

            <p className="text-gray-600 mb-6">
              Tem certeza que deseja excluir permanentemente todas as mensagens desta conversa com{' '}
              <span className="font-medium">
                {filteredConversations.find((c: any) => c.phoneNumber === selectedConversation)?.contactName || selectedConversation}
              </span>?
            </p>

            <div className="flex space-x-3">
              <Button
                onClick={() => setShowDeleteConfirm(false)}
                variant="outline"
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => handleDeleteChat(selectedConversation)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Excluir Permanentemente
              </Button>
            </div>
          </div>
        </div>
      )}
              {showArchiveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <Archive className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Arquivar Conversa
                </h3>
                <p className="text-sm text-gray-600">
                  Tem certeza que deseja arquivar esta conversa?
                </p>
              </div>
            </div>

            <p className="text-gray-600 mb-6">
              A conversa com{' '}
              <span className="font-medium">
                {filteredConversations.find((c: any) => c.phoneNumber === selectedConversation)?.contactName || selectedConversation}
              </span>{' '}
              será movida para a seção de arquivados.
            </p>

            <div className="flex space-x-3">
              <Button
                onClick={() => setShowArchiveModal(false)}
                variant="outline"
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleArchiveChat}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
              >
                Arquivar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}