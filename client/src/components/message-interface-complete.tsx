import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  MessageCircle, 
  Send, 
  User, 
  Search, 
  MoreVertical, 
  Archive, 
  Trash2, 
  Volume2, 
  VolumeX, 
  Tag, 
  ChevronDown, 
  ChevronRight,
  ArchiveRestore,
  Clock
} from "lucide-react";
import { Connection, Conversation, Message } from "@/lib/api";
import { format, isToday, isYesterday, parseISO } from "date-fns";

interface MessageInterfaceProps {
  connections: Connection[];
  selectedConnectionId: number | null;
  onSelectConnection: (id: number) => void;
}

interface RealtimeMessage {
  id: string;
  content: string;
  phoneNumber: string;
  direction: 'sent' | 'received';
  timestamp: Date;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  tempId?: string;
}



export default function CompleteMessageInterface({ 
  connections, 
  selectedConnectionId, 
  onSelectConnection 
}: MessageInterfaceProps) {
  const [selectedConversation, setSelectedConversation] = useState<string>("");
  const [newMessage, setNewMessage] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [realtimeMessages, setRealtimeMessages] = useState<RealtimeMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState<string | null>(null);
  const [chatMuted, setChatMuted] = useState(false);
  const [chatTags, setChatTags] = useState<string[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const processedMessageIds = useRef(new Set<string>());

  // Fetch conversations for selected connection
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['conversations', selectedConnectionId],
    queryFn: async () => {
      if (!selectedConnectionId) return [];
      const response = await fetch(`/api/connections/${selectedConnectionId}/conversations`);
      if (!response.ok) throw new Error('Failed to fetch conversations');
      return response.json() as Promise<Conversation[]>;
    },
    enabled: !!selectedConnectionId
  });



  // Fetch messages for selected conversation - COM LOGS DETALHADOS
  const { data: chatMessages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', selectedConnectionId, selectedConversation],
    queryFn: async () => {
      if (!selectedConnectionId || !selectedConversation) {
        console.log(`⚠️ Parâmetros faltando - connectionId: ${selectedConnectionId}, conversation: ${selectedConversation}`);
        return [];
      }
      
      console.log(`📨 Carregando mensagens para conexão ${selectedConnectionId}, contato ${selectedConversation}`);
      
      try {
        const response = await fetch(`/api/connections/${selectedConnectionId}/messages/${selectedConversation}`);
        console.log(`📨 Response status: ${response.status}`);
        
        if (!response.ok) {
          console.error(`❌ Erro na API de mensagens: ${response.status} ${response.statusText}`);
          return [];
        }
        
        // Verificar se a resposta é JSON válido
        const contentType = response.headers.get("Content-Type");
        console.log(`📨 Content-Type: ${contentType}`);
        
        if (contentType && contentType.includes("application/json")) {
          const messages = await response.json();
          console.log(`✅ Mensagens carregadas: ${messages.length} mensagens`);
          return messages as Message[];
        } else {
          console.error(`❌ Resposta não é JSON válido - Content-Type: ${contentType}`);
          return [];
        }
      } catch (error) {
        console.error(`❌ Erro ao carregar mensagens:`, error);
        return [];
      }
    },
    enabled: !!selectedConnectionId && !!selectedConversation
  });

  // WebSocket para mensagens em tempo real
  useEffect(() => {
    if (!selectedConnectionId) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/ws`;
      console.log(`🔌 Conectando WebSocket para conexão ${selectedConnectionId}`);

      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log("✅ WebSocket connected");
        setIsConnected(true);
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("📨 WebSocket message received:", data);

          if (data.type === 'message' && data.data) {
            const msgData = data.data;
            
            // Gerar hash único para evitar duplicação
            const messageHash = `${msgData.content}_${msgData.timestamp}_${msgData.direction}`;
            
            if (!processedMessageIds.current.has(messageHash)) {
              processedMessageIds.current.add(messageHash);
              
              const newMsg: RealtimeMessage = {
                id: msgData.id || crypto.randomUUID(),
                content: msgData.content || msgData.body || 'Mensagem sem conteúdo',
                phoneNumber: msgData.phoneNumber || msgData.from || msgData.to,
                direction: msgData.direction || 'received',
                timestamp: new Date(msgData.timestamp || Date.now()),
                status: msgData.status || 'delivered'
              };

              setRealtimeMessages(prev => {
                const filtered = prev.filter(m => m.id !== newMsg.id);
                return [...filtered, newMsg].sort((a, b) => 
                  new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                );
              });

              console.log(`✅ Nova mensagem adicionada: ${newMsg.phoneNumber}`);
            } else {
              console.log(`⚠️ Mensagem duplicada ignorada: ${messageHash}`);
            }
          }
        } catch (error) {
          console.error('❌ Erro ao processar mensagem WebSocket:', error);
        }
      };

      socket.onclose = () => {
        console.log("🔌 WebSocket disconnected");
        setIsConnected(false);
        
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            console.log("🔄 Tentando reconectar WebSocket...");
            connectWebSocket();
          }, 3000);
        }
      };

      socket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setIsConnected(false);
      };
    };

    connectWebSocket();

    return () => {
      if (socket) {
        socket.close();
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [selectedConnectionId]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, realtimeMessages]);

  // Handle send message - COM LOGS DETALHADOS
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConnectionId || !selectedConversation) {
      console.log(`⚠️ Envio cancelado - mensagem: "${newMessage}", conexão: ${selectedConnectionId}, contato: ${selectedConversation}`);
      return;
    }

    console.log(`📤 Enviando mensagem: "${newMessage}" para ${selectedConversation} via conexão ${selectedConnectionId}`);

    const tempId = crypto.randomUUID();
    const tempMessage: RealtimeMessage = {
      id: tempId,
      content: newMessage,
      phoneNumber: selectedConversation,
      direction: 'sent',
      timestamp: new Date(),
      status: 'pending',
      tempId
    };

    // Add temp message immediately
    setRealtimeMessages(prev => [...prev, tempMessage]);
    const messageToSend = newMessage;
    setNewMessage("");

    try {
      console.log(`📤 Fazendo POST para /api/send-message`);
      const response = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: selectedConnectionId,
          phoneNumber: selectedConversation,
          message: messageToSend
        })
      });

      console.log(`📤 Response status: ${response.status}`);

      if (response.ok) {
        console.log(`✅ Mensagem enviada com sucesso!`);
        // Update temp message status
        setRealtimeMessages(prev => 
          prev.map(msg => 
            msg.tempId === tempId 
              ? { ...msg, status: 'sent' as const }
              : msg
          )
        );
      } else {
        // Mark as failed
        setRealtimeMessages(prev => 
          prev.map(msg => 
            msg.tempId === tempId 
              ? { ...msg, status: 'failed' as const }
              : msg
          )
        );
      }
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      setRealtimeMessages(prev => 
        prev.map(msg => 
          msg.tempId === tempId 
            ? { ...msg, status: 'failed' as const }
            : msg
        )
      );
    }
  };

  // Handle archive conversation
  const handleArchiveConversation = async (phoneNumber: string) => {
    if (!selectedConnectionId) return;

    try {
      const response = await fetch('/api/archive-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: selectedConnectionId,
          phoneNumber,
          archiveReason: 'User requested'
        })
      });

      if (response.ok) {
        console.log(`✅ Conversa ${phoneNumber} arquivada com sucesso`);
        queryClient.invalidateQueries({ queryKey: ['conversations', selectedConnectionId] });
        queryClient.invalidateQueries({ queryKey: ['archived-chats', selectedConnectionId] });
        setSelectedConversation("");
      } else {
        console.error('❌ Erro ao arquivar conversa');
      }
    } catch (error) {
      console.error('❌ Erro ao arquivar conversa:', error);
    }
  };

  // Handle unarchive conversation
  const handleUnarchiveConversation = async (archivedChatId: number) => {
    try {
      const response = await fetch(`/api/archived-chats/${archivedChatId}/unarchive`, {
        method: 'POST'
      });

      if (response.ok) {
        console.log(`✅ Conversa desarquivada com sucesso`);
        queryClient.invalidateQueries({ queryKey: ['conversations', selectedConnectionId] });
        queryClient.invalidateQueries({ queryKey: ['archived-chats', selectedConnectionId] });
      } else {
        console.error('❌ Erro ao desarquivar conversa');
      }
    } catch (error) {
      console.error('❌ Erro ao desarquivar conversa:', error);
    }
  };

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conv =>
    conv.contactName?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    conv.phoneNumber.includes(searchFilter)
  );

  // Filter archived chats based on search
  const filteredArchivedChats = archivedChats.filter(chat =>
    chat.contactName?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    chat.phoneNumber.includes(searchFilter)
  );

  // Combine and sort all messages
  const allMessages = [
    ...chatMessages.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp || Date.now()),
      direction: msg.direction as 'sent' | 'received'
    })),
    ...realtimeMessages
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (!selectedConnectionId) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center text-gray-500">
            <MessageCircle className="mx-auto mb-4 h-12 w-12" />
            <p>Selecione uma conexão para ver as mensagens</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex h-full gap-4">
      {/* Conversations List */}
      <Card className="w-1/3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Conversas
            {isConnected && (
              <Badge variant="outline" className="ml-auto">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                Online
              </Badge>
            )}
          </CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar conversas..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-200px)]">
            {/* SEÇÃO DE CONVERSAS ARQUIVADAS - POSICIONADA ACIMA DAS ATIVAS */}
            <div className="border-b">
              <Button
                variant="ghost"
                onClick={() => setShowArchivedSection(!showArchivedSection)}
                className="w-full justify-between p-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <Archive className="h-4 w-4" />
                  <span>Conversas Arquivadas ({archivedChats.length})</span>
                </div>
                {showArchivedSection ? 
                  <ChevronDown className="h-4 w-4" /> : 
                  <ChevronRight className="h-4 w-4" />
                }
              </Button>
              
              {showArchivedSection && (
                <div className="bg-gray-50 dark:bg-gray-800">
                  {archivedLoading ? (
                    <div className="p-4 text-center text-gray-500">
                      Carregando arquivados...
                    </div>
                  ) : archivedError ? (
                    <div className="p-4 text-center text-red-500">
                      ❌ Erro ao carregar conversas arquivadas
                      <div className="text-xs mt-1">
                        Verifique se a API está funcionando corretamente
                      </div>
                    </div>
                  ) : filteredArchivedChats.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      Nenhuma conversa arquivada
                    </div>
                  ) : (
                    filteredArchivedChats.map((chat) => (
                      <div
                        key={chat.id}
                        className="flex items-center justify-between p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-600"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {chat.contactName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{chat.contactName}</p>
                              <Archive className="h-3 w-3 text-gray-400" />
                            </div>
                            <p className="text-sm text-gray-500 truncate">{chat.phoneNumber}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <Clock className="h-3 w-3" />
                              <span>{format(new Date(chat.archivedAt), 'dd/MM/yyyy')}</span>
                              <span>•</span>
                              <span>{chat.totalMessages} mensagens</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnarchiveConversation(chat.id)}
                            className="p-1"
                          >
                            <ArchiveRestore className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* CONVERSAS ATIVAS */}
            <div>
              {conversationsLoading ? (
                <div className="p-4 text-center text-gray-500">
                  Carregando conversas...
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  Nenhuma conversa encontrada
                </div>
              ) : (
                filteredConversations.map((conversation) => (
                  <div
                    key={conversation.phoneNumber}
                    onClick={() => setSelectedConversation(conversation.phoneNumber)}
                    className={`flex items-center justify-between p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-600 group ${
                      selectedConversation === conversation.phoneNumber ? 'bg-blue-50 dark:bg-blue-900' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {conversation.contactName?.charAt(0).toUpperCase() || 
                           conversation.phoneNumber.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">
                            {conversation.contactName || conversation.phoneNumber}
                          </p>
                          {chatMuted && <VolumeX className="h-3 w-3 text-gray-400" />}
                          {chatTags.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {chatTags[0]}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">{conversation.phoneNumber}</p>
                        {conversation.lastMessage && (
                          <p className="text-sm text-gray-400 truncate">
                            {conversation.lastMessage.content}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {conversation.lastMessage && (
                        <span className="text-xs text-gray-400">
                          {format(new Date(conversation.lastMessage.timestamp || Date.now()), 'HH:mm')}
                        </span>
                      )}
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowActionsDropdown(
                              showActionsDropdown === conversation.phoneNumber ? null : conversation.phoneNumber
                            );
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                        {showActionsDropdown === conversation.phoneNumber && (
                          <div className="absolute right-0 top-8 bg-white dark:bg-gray-800 border rounded-lg shadow-lg z-10 py-1 min-w-[150px]">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleArchiveConversation(conversation.phoneNumber)}
                              className="w-full justify-start p-2 text-left"
                            >
                              <Archive className="h-4 w-4 mr-2" />
                              Arquivar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setChatMuted(!chatMuted)}
                              className="w-full justify-start p-2 text-left"
                            >
                              {chatMuted ? (
                                <>
                                  <Volume2 className="h-4 w-4 mr-2" />
                                  Reativar som
                                </>
                              ) : (
                                <>
                                  <VolumeX className="h-4 w-4 mr-2" />
                                  Silenciar
                                </>
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowTagModal(true)}
                              className="w-full justify-start p-2 text-left"
                            >
                              <Tag className="h-4 w-4 mr-2" />
                              Etiquetar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowDeleteConfirm(conversation.phoneNumber)}
                              className="w-full justify-start p-2 text-left text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            <CardHeader className="border-b">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {selectedConversation.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">{selectedConversation}</h3>
                  <p className="text-sm text-gray-500">
                    {isConnected ? 'Online' : 'Conectando...'}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messagesLoading ? (
                    <div className="text-center text-gray-500">
                      Carregando mensagens...
                    </div>
                  ) : allMessages.length === 0 ? (
                    <div className="text-center text-gray-500">
                      Nenhuma mensagem encontrada
                    </div>
                  ) : (
                    allMessages.map((message, index) => (
                      <div
                        key={`${message.id}-${index}`}
                        className={`flex ${message.direction === 'sent' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 ${
                            message.direction === 'sent'
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 dark:bg-gray-800'
                          }`}
                        >
                          <p>{message.content || (message as any).body}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs opacity-70">
                              {format(new Date(message.timestamp), 'HH:mm')}
                            </span>
                            {message.direction === 'sent' && (
                              <span className="text-xs ml-2">
                                {message.status === 'pending' ? '⏳' :
                                 message.status === 'sent' ? '✓' :
                                 message.status === 'delivered' ? '✓✓' :
                                 message.status === 'failed' ? '❌' : '✓'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1"
                  />
                  <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <MessageCircle className="mx-auto mb-4 h-12 w-12" />
              <p>Selecione uma conversa para começar</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Conversa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Tem certeza que deseja excluir esta conversa? Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={() => setShowDeleteConfirm(null)}>
                Excluir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tag Modal */}
      <Dialog open={showTagModal} onOpenChange={setShowTagModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Etiqueta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Nome da etiqueta..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowTagModal(false)}>
                Cancelar
              </Button>
              <Button onClick={() => {
                if (newTag.trim()) {
                  setChatTags([...chatTags, newTag.trim()]);
                  setNewTag("");
                  setShowTagModal(false);
                }
              }}>
                Adicionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}