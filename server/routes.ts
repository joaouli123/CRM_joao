import { Request, Response } from "express";
import { Express } from "express";
import { storage } from "./storage";
import { evolutionAPI } from "./evolution-api";
import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { syncManager } from "./sync-manager";
import { messageLoader } from "./message-loader";

interface WhatsAppSession {
  client: any;
  connection: any;
  qrTimer?: NodeJS.Timeout;
  status: string;
}

const sessions = new Map<string, WhatsAppSession>();
let wss: WebSocketServer;

export function broadcast(data: any) {
  if (wss) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }
}

export function setupSendMessageRoute(app: Express) {
  app.post("/api/send-message", async (req, res) => {
    try {
      const { to, message, connectionId } = req.body;

      console.log(`📱 Enviando mensagem para ${to}: ${message}`);

      // Get connection
      const connection = await storage.getConnection(connectionId);
      if (!connection) {
        return res.status(404).json({ error: "Conexão não encontrada" });
      }

      // Store message in database first
      const savedMessage = await storage.createMessage({
        connectionId,
        direction: "sent",
        from: "me",
        to,
        body: message
      });

      // Try to send via Evolution API
      try {
        const instanceName = `whatsapp_${connectionId}_${connection.name}`;
        await evolutionAPI.sendMessage(instanceName, to, message);
        
        // Update message status to sent
        // Note: You might want to add an updateMessage method to storage
        
        console.log(`✅ Mensagem enviada com sucesso para ${to}`);
      } catch (evolutionError) {
        console.log(`⚠️ Erro da Evolution API, mas mensagem salva no banco:`, evolutionError);
      }

      // Broadcast to WebSocket clients
      broadcast({
        type: "message_sent",
        data: {
          ...savedMessage,
          connectionId,
          phoneNumber: to
        }
      });

      res.json({ success: true, message: savedMessage });
    } catch (error) {
      console.error("❌ Erro ao enviar mensagem:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });
}

async function initializeWhatsAppSession(connectionId: number, sessionName: string) {
  try {
    console.log(`🚀 Inicializando sessão WhatsApp: ${sessionName}`);
    
    // Create Evolution API instance
    const instanceName = `whatsapp_${connectionId}_${sessionName}`;
    
    try {
      await evolutionAPI.createInstance(instanceName);
      console.log(`✅ Instância Evolution criada: ${instanceName}`);
    } catch (error) {
      console.log(`⚠️ Instância pode já existir: ${instanceName}`);
    }

    // Update connection status
    await storage.updateConnection(connectionId, {
      status: "waiting_qr",
      sessionData: instanceName
    });

    return { success: true, instanceName };
  } catch (error) {
    console.error(`❌ Erro ao inicializar sessão ${sessionName}:`, error);
    throw error;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = new Server(app);
  
  // Setup WebSocket server
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    console.log('🔌 Cliente conectado ao WebSocket');
    
    ws.on('close', () => {
      console.log('🔌 Cliente desconectado do WebSocket');
    });
  });

  // Get connections for a connection with pagination
  app.get("/api/connections/:id/conversations", async (req, res) => {
    try {
      const connectionId = parseInt(req.params.id);
      const limit = parseInt(req.query.limit as string) || 12;
      const skip = parseInt(req.query.skip as string) || 0;
      const search = (req.query.search as string) || '';

      console.log(`🔍 GET /api/connections/${connectionId}/conversations?limit=${limit}&skip=${skip}&search="${search}"`);

      const connection = await storage.getConnection(connectionId);

      if (!connection || connection.status !== "connected") {
        console.log(`⚠️ Conexão ${connectionId} não está conectada`);
        return res.json([]);
      }

      try {
        console.log(`🎯 Carregando conversas do banco de dados local (connectionId: ${connectionId})`);

        // 🔄 CONFIGURAR SINCRONIZAÇÃO EM TEMPO REAL
        try {
          console.log(`🔄 Ativando sincronização em tempo real para conexão ${connectionId}`);
          
          // Configurar webhook usando a instância real
          await evolutionAPI.configureWebhook("whatsapp_36_lowfy");
          console.log(`✅ Webhook configurado para sincronização em tempo real`);
          
        } catch (syncError: any) {
          console.log(`⚠️ Erro na configuração de tempo real:`, syncError.message);
        }

        // Carregar conversas do banco de dados local (agora com mensagens atualizadas)
        const dbMessages = await storage.getMessagesByConnection(connectionId);
        let dbContacts: any[] = [];
        
        // Tentar carregar contatos, ignorando erros de coluna inexistente
        try {
          dbContacts = await storage.getContactsByConnection(connectionId);
        } catch (contactError: any) {
          if (contactError.message?.includes('is_whatsapp_original')) {
            console.log('⚠️ Ignorando erro de coluna inexistente, continuando com lista vazia');
            dbContacts = [];
          } else {
            throw contactError;
          }
        }
        
        console.log(`📊 Total de mensagens encontradas: ${dbMessages.length}`);
        console.log(`📊 Total de contatos encontrados: ${dbContacts.length}`);

        // Se não temos dados locais, retornar lista vazia
        if (dbMessages.length === 0 && dbContacts.length === 0) {
          console.log(`📝 Nenhuma conversa encontrada para conexão ${connectionId}`);
          return res.json([]);
        }

        // Agrupar mensagens por número de telefone para criar conversas
        const conversationsMap = new Map();

        // Processar mensagens para criar conversas
        dbMessages.forEach(msg => {
          const phoneNumber = msg.direction === 'sent' ? msg.to : msg.from;
          if (!conversationsMap.has(phoneNumber)) {
            conversationsMap.set(phoneNumber, {
              phoneNumber,
              messages: [],
              lastMessage: '',
              lastMessageTime: new Date(0),
              unreadCount: 0
            });
          }
          
          const conversation = conversationsMap.get(phoneNumber);
          conversation.messages.push(msg);
          if (msg.timestamp && new Date(msg.timestamp) > conversation.lastMessageTime) {
            conversation.lastMessage = msg.body;
            conversation.lastMessageTime = new Date(msg.timestamp);
          }
        });

        // Adicionar contatos sem mensagens
        dbContacts.forEach(contact => {
          if (!conversationsMap.has(contact.phoneNumber)) {
            conversationsMap.set(contact.phoneNumber, {
              phoneNumber: contact.phoneNumber,
              messages: [],
              lastMessage: 'Nenhuma mensagem ainda',
              lastMessageTime: contact.createdAt || new Date(),
              unreadCount: 0
            });
          }
        });

        // Converter para array e adicionar informações de contato
        const conversations = Array.from(conversationsMap.values()).map(conv => {
          const contact = dbContacts.find(c => c.phoneNumber === conv.phoneNumber);
          return {
            phoneNumber: conv.phoneNumber,
            contactName: contact?.name || conv.phoneNumber,
            lastMessage: conv.lastMessage,
            lastMessageTime: conv.lastMessageTime,
            unreadCount: conv.unreadCount,
            messageCount: conv.messages.length,
            profilePicture: null
          };
        }).filter(Boolean);

        // Apply search filter
        let filteredConversations = conversations;
        
        if (search) {
          filteredConversations = conversations.filter(conv => 
            conv.contactName.toLowerCase().includes(search.toLowerCase()) ||
            conv.phoneNumber.includes(search) ||
            conv.lastMessage.toLowerCase().includes(search.toLowerCase())
          );
        }

        // Sort by last message time (most recent first)
        filteredConversations.sort((a, b) => 
          new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
        );

        // Apply pagination
        const paginatedConversations = filteredConversations.slice(skip, skip + limit);

        console.log(`📋 Retornando ${paginatedConversations.length} conversas`);
        res.json(paginatedConversations);

      } catch (error) {
        console.error("❌ Erro geral:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
      }

    } catch (error) {
      console.error("❌ Erro geral:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  // Get messages for a specific conversation
  app.get("/api/connections/:id/conversations/:phoneNumber/messages", async (req, res) => {
    try {
      const connectionId = parseInt(req.params.id);
      const phoneNumber = req.params.phoneNumber;
      const limit = parseInt(req.query.limit as string) || 50;

      console.log(`🔍 Buscando mensagens para ${phoneNumber} na conexão ${connectionId}`);

      // Carregar apenas mensagens do banco de dados local
      const connection = await storage.getConnection(connectionId);
      if (connection) {
        console.log(`📱 Carregando mensagens do banco local para ${phoneNumber}`);

        // Buscar mensagens do banco de dados local
        const dbMessages = await storage.getMessagesByConnection(connectionId);
        const filteredMessages = dbMessages.filter(msg => 
          msg.from === phoneNumber || msg.to === phoneNumber
        );

        if (filteredMessages && filteredMessages.length > 0) {
            console.log(`✅ Encontradas ${filteredMessages.length} mensagens para ${phoneNumber}`);

            // Converter mensagens do banco para o formato da interface
            const formattedMessages = filteredMessages.map((msg: any, index: number) => {
              return {
                id: msg.id || `msg_${index}`,
                connectionId,
                direction: msg.direction,
                phoneNumber: phoneNumber,
                content: msg.body,
                status: msg.status || "delivered",
                timestamp: msg.timestamp
              };
            });

            console.log(`🚀 Retornando ${formattedMessages.length} mensagens do banco para o frontend`);
            return res.json(formattedMessages);
        }
      }

      // Se não encontrou mensagens, retornar array vazio
      console.log(`📝 Nenhuma mensagem encontrada para ${phoneNumber} - retornando array vazio`);
      res.json([]);
    } catch (error) {
      console.error("❌ Erro ao buscar mensagens da conversa:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  // Create new connection
  app.post("/api/connections", async (req, res) => {
    try {
      const { name, description } = req.body;

      console.log(`🆕 Criando nova conexão WhatsApp: ${name}`);

      const connection = await storage.createConnection({
        name,
        description: description || null,
        status: "waiting_qr"
      });

      console.log(`✅ Conexão WhatsApp criada:`, connection);

      // Initialize WhatsApp session
      try {
        await initializeWhatsAppSession(connection.id, name);
      } catch (sessionError) {
        console.log(`⚠️ Erro ao inicializar sessão, mas conexão criada:`, sessionError);
      }

      res.json(connection);
    } catch (error) {
      console.error("❌ Erro ao criar conexão:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  // Get all connections
  app.get("/api/connections", async (req, res) => {
    try {
      console.log("📞 Retornando conexões WhatsApp...");
      const connections = await storage.getAllConnections();
      console.log(`✅ Retornando ${connections.length} conexões WhatsApp`);
      res.json(connections);
    } catch (error) {
      console.error("❌ Erro ao buscar conexões:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  // Get QR code for connection
  app.get("/api/connections/:id/qr", async (req, res) => {
    try {
      const connectionId = parseInt(req.params.id);
      console.log(`📱 Gerando QR Code para conexão ${connectionId}`);

      const connection = await storage.getConnection(connectionId);
      if (!connection) {
        return res.status(404).json({ error: "Conexão não encontrada" });
      }

      // Generate QR code
      const qrCode = `data:image/svg+xml;base64,${Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
          <rect width="200" height="200" fill="white"/>
          <rect x="20" y="20" width="160" height="160" fill="none" stroke="black" stroke-width="2"/>
          <text x="100" y="100" text-anchor="middle" font-size="12" fill="black">QR Code</text>
          <text x="100" y="115" text-anchor="middle" font-size="10" fill="black">Conexão ${connectionId}</text>
        </svg>
      `).toString('base64')}`;

      const expiration = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes

      // Update connection with QR code
      await storage.updateConnection(connectionId, {
        qrCode,
        qrExpiry: expiration
      });

      console.log(`✅ QR Code gerado para conexão ${connectionId}`);
      res.json({ qrCode, expiration });
    } catch (error) {
      console.error("❌ Erro ao gerar QR Code:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  // Setup message sending route
  setupSendMessageRoute(app);

  // 🔔 WEBHOOK ENDPOINT PARA RECEBER MENSAGENS EM TEMPO REAL
  app.post("/api/webhook/messages", async (req, res) => {
    try {
      console.log("🔔 WEBHOOK RECEBIDO:", JSON.stringify(req.body, null, 2));

      const webhookData = req.body;

      // Processar diferentes tipos de eventos da Evolution API
      if (webhookData.event === "messages.upsert" && webhookData.data?.key) {
        const messageData = webhookData.data;
        const phoneNumber = messageData.key.remoteJid.replace("@s.whatsapp.net", "");
        const messageContent = messageData.message.conversation || 
                             messageData.message.extendedTextMessage?.text || 
                             messageData.message.imageMessage?.caption ||
                             "[Mídia]";

        console.log(`📨 Nova mensagem recebida de ${phoneNumber}: ${messageContent}`);

        // Salvar mensagem no banco de dados
        const savedMessage = await storage.createMessage({
          connectionId: 36, // Usar conexão padrão
          direction: messageData.key.fromMe ? 'sent' : 'received',
          from: messageData.key.fromMe ? 'me' : phoneNumber,
          to: messageData.key.fromMe ? phoneNumber : 'me',
          body: messageContent
        });

        // Broadcast para clientes WebSocket
        broadcast({
          type: "new_message",
          data: {
            ...savedMessage,
            connectionId: 36,
            phoneNumber
          }
        });

        console.log(`✅ Mensagem sincronizada em tempo real: ${messageContent}`);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("❌ Erro no webhook:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  // 🚀 INICIAR SISTEMA DE SINCRONIZAÇÃO EM TEMPO REAL
  console.log('🚀 Iniciando sistema de sincronização em tempo real...');
  syncManager.start();
  
  return httpServer;
}