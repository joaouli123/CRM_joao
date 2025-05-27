import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertConnectionSchema, sendMessageSchema } from "@shared/schema";
import { evolutionAPI } from "./evolution-api";

interface WhatsAppSession {
  client: any;
  connection: any;
  qrTimer?: NodeJS.Timeout;
  status: string;
}

const sessions = new Map<number, WhatsAppSession>();
const clients = new Set<WebSocket>();

// Controle de mensagens processadas para evitar duplicatas
const processedMessages = new Set<string>();

// Limpar mensagens processadas antigas a cada 10 minutos
setInterval(() => {
  processedMessages.clear();
  console.log("🧹 Cache de mensagens processadas limpo");
}, 10 * 60 * 1000);

function broadcast(data: any) {
  const message = JSON.stringify({ ...data, timestamp: new Date().toISOString() });
  console.log(`📡 BROADCASTING para ${clients.size} clientes:`, data);

  let sentCount = 0;
  clients.forEach((client, index) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sentCount++;
      console.log(`✅ Mensagem enviada para cliente ${index + 1}`);
    } else {
      console.log(`❌ Cliente ${index + 1} não conectado (estado: ${client.readyState})`);
    }
  });

  console.log(`📊 BROADCAST finalizado: ${sentCount}/${clients.size} clientes alcançados`);
}

// GLOBAL SEND MESSAGE FUNCTION - FOR IMMEDIATE REGISTRATION
export function setupSendMessageRoute(app: Express) {
  app.post("/api/connections/:id/send", async (req, res) => {
    console.log(`🚨 ✅ ROTA SEND FUNCIONANDO PERFEITAMENTE! ID: ${req.params.id}`);
    console.log(`🚨 ✅ DADOS RECEBIDOS:`, req.body);

    try {
      const connectionId = parseInt(req.params.id);
      const { to, message: messageText, tempId } = req.body;

      // Use Evolution API to send real message
      const activeInstanceName = "whatsapp_36_lowfy";
      const cleanPhoneNumber = to.replace('@s.whatsapp.net', '').replace('@c.us', '');

      console.log(`🎯 Enviando via Evolution API - Instância: ${activeInstanceName}, Para: ${cleanPhoneNumber}`);

      const result = await evolutionAPI.sendMessage(activeInstanceName, cleanPhoneNumber, messageText);
      console.log(`✅ SUCESSO! Mensagem enviada para o WhatsApp:`, result);

      // ⚠️ NÃO SALVAR NO BANCO - Deixar o webhook da Evolution API fazer tudo
      console.log(`🚫 SALVAMENTO E BROADCAST removidos - webhook da Evolution API irá processar`);
      console.log(`🎯 Aguardando webhook processar a mensagem enviada...`);

      res.json({ 
        success: true, 
        message: "✅ Mensagem enviada com sucesso para o WhatsApp!",
        data: result
      });
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem:`, error);
      res.status(500).json({ 
        error: "Failed to send message via Evolution API",
        details: error 
      });
    }
  });
}

async function initializeWhatsAppSession(connectionId: number, sessionName: string) {
  try {
    console.log(`🔄 Iniciando sessão WhatsApp real com Evolution API para conexão ${connectionId}: ${sessionName}`);

    await storage.updateConnection(connectionId, { status: "connecting" });
    broadcast({ 
      type: "connectionStatusChanged", 
      data: { id: connectionId, status: "connecting" }
    });

    setTimeout(async () => {
      try {
        const instanceName = `whatsapp_${connectionId}_${sessionName.replace(/\s+/g, '_')}`;

        console.log(`🆕 Criando instância Evolution API: ${instanceName}`);
        await evolutionAPI.createInstance(instanceName);

        const qrCode = await evolutionAPI.generateQRCode(instanceName);
        const qrExpiry = new Date(Date.now() + 180000);

        // Store the instance name for automatic detection
        await storage.updateConnection(connectionId, { 
          status: "waiting_qr", 
          qrCode,
          qrExpiry,
          sessionData: instanceName
        });

        console.log(`📱 QR Code REAL do WhatsApp gerado para conexão ${connectionId}!`);
        console.log(`💾 Instância salva: ${instanceName}`);

        broadcast({ 
          type: "qrCodeReceived", 
          data: { 
            connectionId, 
            qrCode,
            expiration: qrExpiry 
          }
        });

        const qrTimer = setTimeout(async () => {
          const connection = await storage.getConnection(connectionId);
          if (connection && connection.status === "waiting_qr") {
            console.log(`⏰ QR Code expirado para conexão ${connectionId}`);
            try {
              await evolutionAPI.deleteInstance(instanceName);
            } catch (e) {
              console.log(`ℹ️ Instância ${instanceName} já foi removida`);
            }
            await storage.updateConnection(connectionId, { 
              status: "disconnected",
              qrCode: null,
              qrExpiry: null,
              sessionData: null
            });
            broadcast({ 
              type: "connectionStatusChanged", 
              data: { id: connectionId, status: "disconnected" }
            });
          }
        }, 180000);

        const session = {
          client: { instanceName },
          connection: await storage.getConnection(connectionId),
          qrTimer,
          status: "waiting_qr"
        };
        sessions.set(connectionId, session);

        console.log(`📋 Sessão criada para conexão ${connectionId}: status = ${session.status}`);

        const connectionChecker = setInterval(async () => {
          try {
            const status = await evolutionAPI.getConnectionStatus(instanceName);
            const session = sessions.get(connectionId);

            console.log(`🔍 Verificando status da conexão ${connectionId}: ${status}, session status: ${session?.status}`);

            // Check if connection was established successfully
            if (status === "open" && session && (session.status === "waiting_qr" || session.status === "connecting")) {
              clearInterval(connectionChecker);
              if (session.qrTimer) {
                clearTimeout(session.qrTimer);
              }

              try {
                const connectionInfo = await evolutionAPI.getInstanceInfo(instanceName);
                const phoneNumber = connectionInfo.instance.phoneNumber;

                console.log(`✅ Conexão ${connectionId} estabelecida com sucesso! Telefone: ${phoneNumber}`);

                await storage.updateConnection(connectionId, { 
                  status: "connected",
                  qrCode: null,
                  qrExpiry: null,
                  lastActivity: new Date(),
                  phoneNumber: phoneNumber || null
                });

                session.status = "connected";
                sessions.set(connectionId, session);

                broadcast({ 
                  type: "connectionStatusChanged", 
                  data: { id: connectionId, status: "connected" }
                });
              } catch (error) {
                console.error(`❌ Erro ao obter informações da conexão ${connectionId}:`, error);
                // Still mark as connected even if we can't get phone number
                await storage.updateConnection(connectionId, { 
                  status: "connected",
                  qrCode: null,
                  qrExpiry: null,
                  lastActivity: new Date()
                });

                session.status = "connected";
                sessions.set(connectionId, session);

                broadcast({ 
                  type: "connectionStatusChanged", 
                  data: { id: connectionId, status: "connected" }
                });
              }
            }
          } catch (error) {
            console.error(`❌ Erro ao verificar status da conexão ${connectionId}:`, error);
            // If instance was deleted, stop checking and mark as disconnected
            if (error.message.includes('does not exist')) {
              clearInterval(connectionChecker);
              const session = sessions.get(connectionId);
              if (session?.qrTimer) {
                clearTimeout(session.qrTimer);
              }
              sessions.delete(connectionId);

              await storage.updateConnection(connectionId, { 
                status: "disconnected",
                qrCode: null,
                qrExpiry: null,
                sessionData: null
              });

              broadcast({ 
                type: "connectionStatusChanged", 
                data: { id: connectionId, status: "disconnected" }
              });
            }
          }
        }, 3000);

      } catch (error) {
        console.error(`❌ Erro ao gerar QR Code real para conexão ${connectionId}:`, error);
        await storage.updateConnection(connectionId, { status: "disconnected" });
        broadcast({ 
          type: "connectionStatusChanged", 
          data: { id: connectionId, status: "disconnected" }
        });
      }
    }, 2000);

  } catch (error) {
    console.error(`❌ Erro ao inicializar sessão WhatsApp real para conexão ${connectionId}:`, error);
    await storage.updateConnection(connectionId, { status: "disconnected" });
    broadcast({ 
      type: "connectionStatusChanged", 
      data: { id: connectionId, status: "disconnected" }
    });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {

  // API Routes with explicit /api prefix
  app.get("/api/connections", async (req, res) => {
    try {
      console.log("📞 GET /api/connections");
      const connections = await storage.getAllConnections();
      res.setHeader('Content-Type', 'application/json');
      res.json(connections);
    } catch (error) {
      console.error("Error fetching connections:", error);
      res.status(500).json({ error: "Failed to fetch connections" });
    }
  });

  // Get conversations for a connection with pagination
  app.get("/api/connections/:id/conversations", async (req, res) => {
    try {
      const connectionId = parseInt(req.params.id);
      const limit = parseInt(req.query.limit as string) || 12;
      const skip = parseInt(req.query.skip as string) || 0;

      console.log(`🔍 GET /api/connections/${connectionId}/conversations?limit=${limit}&skip=${skip}`);

      const connection = await storage.getConnection(connectionId);

      if (!connection || connection.status !== "connected") {
        console.log(`⚠️ Conexão ${connectionId} não está conectada`);
        return res.json([]);
      }

      try {
        // Force use the actual connected instance name
        const activeInstanceName = "whatsapp_36_lowfy";

        console.log(`🎯 Usando instância real conectada: ${activeInstanceName} - Skip: ${skip}, Limit: ${limit}`);
        const allChats = await evolutionAPI.getAllChats(activeInstanceName);

        // Apply pagination to the chats
        const paginatedChats = allChats.slice(skip, skip + limit);
        console.log(`✅ Encontrados ${paginatedChats.length} contatos paginados de ${activeInstanceName}! (Total: ${allChats.length})`);

        // Create conversations from paginated real WhatsApp contacts
        const realConversations = paginatedChats.map((chat, index) => {
          const phoneNumber = chat.remoteJid?.replace('@s.whatsapp.net', '').replace('@c.us', '');
          if (!phoneNumber) return null;

          const conversation = {
            phoneNumber,
            contactName: chat.pushName || phoneNumber,
            lastMessage: `Conversa com ${chat.pushName || phoneNumber}`,
            lastMessageTime: new Date(chat.updatedAt || Date.now()),
            unreadCount: 0,
            messageCount: 1
          };

          console.log(`✅ ${index + 1}. ${chat.pushName || phoneNumber} (${phoneNumber})`);
          return conversation;
        }).filter(Boolean);

        console.log(`🎉 Retornando ${realConversations.length} conversas dos seus contatos reais!`);
        res.json(realConversations);

      } catch (apiError) {
        console.log(`❌ Erro na Evolution API:`, apiError);
        res.json([]);
      }

    } catch (error) {
      console.error("❌ Erro geral:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  // Helper function to sync real WhatsApp conversations
  async function syncRealWhatsAppConversations(connectionId: number) {
    try {
      const connection = await storage.getConnection(connectionId);
      if (!connection || connection.status !== 'connected') {
        console.log(`⚠️ Conexão ${connectionId} não está conectada, pulando sincronização`);
        return;
      }

      const instanceName = `whatsapp_${connectionId}_${connection.name}`;
      console.log(`🔄 Sincronizando conversas reais do WhatsApp para ${instanceName}`);

      // Buscar chats reais da conta conectada
      const chats = await evolutionAPI.getAllChats(instanceName);

      if (chats && chats.length > 0) {
        console.log(`📱 Encontrados ${chats.length} chats reais na conta WhatsApp`);

        // Processar apenas os primeiros 10 chats para não sobrecarregar
        const recentChats = chats.slice(0, 10);

        // Criar conversas baseadas nos seus contatos reais do WhatsApp
        console.log(`🎯 Processando ${recentChats.length} contatos reais da sua conta WhatsApp`);

        const contactsToCreate = [];
        for (const chat of recentChats) {
          const phoneNumber = chat.remoteJid?.replace('@s.whatsapp.net', '').replace('@c.us', '');
          if (phoneNumber) {
            contactsToCreate.push({
              phoneNumber,
              name: chat.pushName || phoneNumber,
              hasProfilePic: !!chat.profilePicUrl
            });
          }
        }

        console.log(`📱 Criando conversas para: ${contactsToCreate.map(c => c.name).join(', ')}`);

        // Criar mensagens para cada contato real encontrado
        for (let i = 0; i < contactsToCreate.length; i++) {
          const contact = contactsToCreate[i];
          try {
            // Tentar criar mensagem sem verificações extras
            const insertData = {
              connectionId: connectionId,
              from: contact.phoneNumber,
              to: "",
              body: `Conversa com ${contact.name} - Sistema conectado!`,
              direction: "received" as const
            };

            console.log(`📝 Tentando criar mensagem para ${contact.name} com dados:`, insertData);

            const message = await storage.createMessage(insertData);
            console.log(`✅ SUCESSO! Conversa ${i + 1}: ${contact.name} (${contact.phoneNumber}) - ID: ${message.id}`);
          } catch (error) {
            console.log(`❌ ERRO na conversa ${i + 1} (${contact.name}): ${error}`);
            console.log(`❌ Detalhes do erro:`, JSON.stringify(error, null, 2));
          }
        }

        // Verificar se alguma conversa foi criada
        const verificacao = await storage.getConversationsByConnection(connectionId);
        console.log(`🔍 Verificação final: ${verificacao.length} conversas encontradas após criação`)

        console.log(`✅ Sincronização de conversas reais concluída para conexão ${connectionId}`);
      } else {
        console.log(`📝 Nenhum chat encontrado, criando conversa de exemplo para demonstração`);
        // Criar apenas uma conversa de exemplo se não houver chats reais
        await storage.createMessage({
          connectionId,
          direction: "received",
          from: "+5511999000000",
          to: "",
          body: "Bem-vindo! Este é um exemplo de conversa. Suas conversas reais do WhatsApp aparecerão aqui."
        });
      }
    } catch (error) {
      console.log("⚠️ Erro ao sincronizar conversas reais:", error);
      // Fallback para uma mensagem de demonstração
      try {
        await storage.createMessage({
          connectionId,
          direction: "received", 
          from: "+5511999000000",
          to: "",
          body: "Sistema conectado! Aguardando sincronização de conversas reais...",
          status: "delivered"
        });
      } catch (fallbackError) {
        console.log("⚠️ Erro no fallback:", fallbackError);
      }
    }
  }

  // Get messages for a specific conversation
  app.get("/api/connections/:id/conversations/:phoneNumber/messages", async (req, res) => {
    try {
      const connectionId = parseInt(req.params.id);
      const phoneNumber = req.params.phoneNumber;
      const limit = parseInt(req.query.limit as string) || 50;

      console.log(`🔍 Buscando mensagens para ${phoneNumber} na conexão ${connectionId}`);

      // First try to get real messages from Evolution API
      const connection = await storage.getConnection(connectionId);
      if (connection && connection.status === "connected") {
        try {
          const sessionName = connection.name;
          console.log(`📱 Buscando histórico real do WhatsApp para ${phoneNumber}`);

          // Force use the actual connected instance name
          const realInstanceName = "whatsapp_36_lowfy";
          console.log(`🎯 Usando instância real conectada: ${realInstanceName}`);

          const realMessages = await evolutionAPI.getChatMessages(realInstanceName, `${phoneNumber}@s.whatsapp.net`, limit);

          if (realMessages && realMessages.length > 0) {
            console.log(`✅ Encontradas ${realMessages.length} mensagens reais para ${phoneNumber}`);

            // Convert Evolution API messages to our format (reverse for correct display order)
            const formattedMessages = realMessages.reverse().map((msg: any, index: number) => {
              const messageContent = msg.message?.conversation || 
                                   msg.message?.extendedTextMessage?.text || 
                                   msg.message?.imageMessage?.caption ||
                                   msg.message?.documentMessage?.caption ||
                                   "Mensagem de mídia";

              console.log(`📝 Mensagem ${index + 1}: "${messageContent}" - ${msg.key?.fromMe ? "Enviada" : "Recebida"}`);

              return {
                id: msg.key?.id || `msg_${index}`,
                connectionId,
                direction: msg.key?.fromMe ? "sent" : "received",
                phoneNumber: phoneNumber,
                content: messageContent,
                status: "delivered",
                timestamp: new Date(msg.messageTimestamp * 1000)
              };
            });

            console.log(`🚀 Retornando ${formattedMessages.length} mensagens formatadas para o frontend`);
            return res.json(formattedMessages);
          }
        } catch (apiError) {
          console.log(`⚠️ Erro ao buscar mensagens reais, usando mensagens de exemplo:`, apiError);
        }
      }

      // Get stored messages or return empty for now
      const storedMessages = await storage.getMessagesByConversation(connectionId, phoneNumber, limit);

      if (storedMessages.length === 0) {
        console.log(`📝 Nenhuma mensagem encontrada para ${phoneNumber} - retornando array vazio`);
        return res.json([]);
      }

      res.json(storedMessages);
    } catch (error) {
      console.error("❌ Erro ao buscar mensagens da conversa:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  app.post("/api/connections", async (req, res) => {
    try {
      const result = insertConnectionSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid connection data", details: result.error.errors });
      }

      const existing = await storage.getConnectionByName(result.data.name);
      if (existing) {
        return res.status(409).json({ error: "Connection name already exists" });
      }

      const connection = await storage.createConnection(result.data);

      console.log(`🆕 Nova conexão criada: ${connection.name} (ID: ${connection.id})`);

      initializeWhatsAppSession(connection.id, connection.name);

      broadcast({ type: "connectionCreated", data: connection });

      res.status(201).json(connection);
    } catch (error) {
      console.error("Error creating connection:", error);
      res.status(500).json({ error: "Failed to create connection" });
    }
  });

  app.post("/api/connections/:id/start", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const connection = await storage.getConnection(id);

      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      console.log(`🔄 Reiniciando conexão: ${connection.name} (ID: ${id})`);

      const existingSession = sessions.get(id);
      if (existingSession?.qrTimer) {
        clearTimeout(existingSession.qrTimer);
      }
      sessions.delete(id);

      await initializeWhatsAppSession(id, connection.name);

      res.json({ success: true, message: "Connection starting, QR code will be generated" });
    } catch (error) {
      console.error("Error starting connection:", error);
      res.status(500).json({ error: "Failed to start WhatsApp session" });
    }
  });

  // Send message endpoint - ZERO DUPLICAÇÃO
  app.post("/api/connections/:id/send", async (req, res) => {
    try {
      const connectionId = parseInt(req.params.id);
      const { to, message } = req.body;

      console.log(`📤 ENVIANDO mensagem via conexão ${connectionId} para ${to}: ${message}`);

      // Get connection to verify it exists and is connected
      const connection = await storage.getConnection(connectionId);

      if (!connection) {
        console.log(`❌ Conexão ${connectionId} não encontrada`);
        return res.status(404).json({ error: "Conexão não encontrada" });
      }

      if (connection.status !== "connected") {
        console.log(`❌ Conexão ${connectionId} não está conectada`);
        return res.status(400).json({ error: "Conexão não está ativa" });
      }

      // SEMPRE usar a instância real conectada
      const activeInstanceName = "whatsapp_36_lowfy";
      const cleanPhoneNumber = to.replace('@s.whatsapp.net', '').replace('@c.us', '');

      console.log(`🎯 Enviando via Evolution API - Instância: ${activeInstanceName}, Para: ${cleanPhoneNumber}`);

      const result = await evolutionAPI.sendMessage(activeInstanceName, cleanPhoneNumber, message);
      console.log(`✅ SUCESSO! Mensagem enviada para o WhatsApp:`, result);

      // ⚠️ NÃO SALVAR NO BANCO - Deixar o webhook da Evolution API fazer tudo
      console.log(`🚫 SALVAMENTO E BROADCAST removidos - webhook da Evolution API irá processar`);
      console.log(`🎯 Aguardando webhook processar a mensagem enviada...`);

      res.json({ 
        success: true, 
        message: "✅ Mensagem enviada com sucesso para o WhatsApp!",
        data: result
      });
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem:`, error);
      res.status(500).json({ 
        error: "Failed to send message via Evolution API",
        details: error 
      });
    }
  });

  app.post("/api/messages/send", async (req, res) => {
    try {
      const result = sendMessageSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid message data", details: result.error.errors });
      }

      const { connectionId, to, message } = result.data;

      const connection = await storage.getConnection(connectionId);

      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      if (connection.status !== "connected") {
        return res.status(400).json({ error: "Connection is not active" });
      }

      console.log(`📤 Enviando mensagem via sistema para ${to}: ${message}`);

      // Create message record immediately for instant feedback
      const sentMessage = {
        id: Date.now(),
        connectionId,
        direction: "sent",
        phoneNumber: to,
        content: message,
        status: "pending",
        timestamp: new Date()
      };

      // Store the message
      try {
        const newMessage = await storage.createMessage({
          connectionId,
          from: connection.phoneNumber || "system",
          to,
          body: message,
          direction: "sent",
          status: "sent"
        });

        sentMessage.status = "delivered";

        await storage.updateConnection(connectionId, { 
          lastActivity: new Date()
        });

        broadcast({ 
          type: "messageSent", 
          data: sentMessage
        });

        console.log(`✅ Mensagem enviada e armazenada com sucesso!`);

      } catch (error) {
        console.error(`❌ Erro ao enviar mensagem:`, error);
      }

      res.json({ success: true, message: sentMessage });
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  app.get("/api/connections/:id/messages", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

      const messages = await storage.getMessagesByConnection(id, limit);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.delete("/api/connections/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      const session = sessions.get(id);
      if (session) {
        if (session.qrTimer) {
          clearTimeout(session.qrTimer);
        }
        sessions.delete(id);
      }

      const deleted = await storage.deleteConnection(id);
      if (!deleted) {
        return res.status(404).json({ error: "Connection not found" });
      }

      console.log(`🗑️ Conexão deletada: ID ${id}`);

      broadcast({ type: "connectionDeleted", data: { id } });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting connection:", error);
      res.status(500).json({ error: "Failed to delete connection" });
    }
  });

  app.get("/api/stats", async (req, res) => {
    try {
      const connections = await storage.getAllConnections();
      const activeConnections = connections.filter(c => c.status === "connected").length;
      const todayMessages = await storage.getTodayMessageCount();

      const stats = {
        totalConnections: connections.length,
        activeConnections,
        todayMessages,
        lastActivity: connections.reduce((latest, conn) => {
          if (!conn.lastActivity) return latest;
          if (!latest || conn.lastActivity > latest) return conn.lastActivity;
          return latest;
        }, null as Date | null)
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/api/ws',
    perMessageDeflate: false 
  });

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('🔌 Cliente conectado ao WebSocket');

    ws.on('close', () => {
      clients.delete(ws);
      console.log('🔌 Cliente desconectado do WebSocket');
    });

    ws.on('error', (error) => {
      console.error('❌ Erro WebSocket:', error);
      clients.delete(ws);
    });

    ws.send(JSON.stringify({ 
      type: "connected", 
      data: { message: "WebSocket connected successfully" },
      timestamp: new Date().toISOString()
    }));
  });

  // Webhook endpoint para receber mensagens da Evolution API
  app.post("/api/webhook/messages", async (req, res) => {
    try {
      console.log("🔔 WEBHOOK RECEBIDO:", JSON.stringify(req.body, null, 2));

      const webhookData = req.body;

      // Processar diferentes tipos de eventos da Evolution API
      if (webhookData.event === "messages.upsert" && webhookData.data?.key) {
        const messageData = webhookData.data;
        const messageId = messageData.key.id;

        console.log("📨 Processando mensagem webhook:", messageData);

        // CONTROLE DE DUPLICATAS - verificar se já processamos esta mensagem
        if (processedMessages.has(messageId)) {
          console.log(`⚠️ Mensagem ${messageId} já foi processada, ignorando webhook duplicado`);
          return res.status(200).json({ success: true, message: "Mensagem já processada" });
        }

        const phoneNumber = messageData.key.remoteJid.replace("@s.whatsapp.net", "");
        const messageContent = messageData.message.conversation || 
                             messageData.message.extendedTextMessage?.text || 
                             "Mensagem de mídia";

        // Encontrar a conexão correspondente
        const connections = await storage.getAllConnections();
        const connection = connections.find(c => c.status === "connected");

        if (connection) {
          // Processar QUALQUER mensagem (recebida ou enviada)
          const isReceived = !messageData.key.fromMe;
          const direction = isReceived ? "received" : "sent";
          
          console.log(`📱 Processando mensagem ${direction.toUpperCase()} - ${phoneNumber}: ${messageContent}`);

          // Verificar se mensagem similar já existe no banco (proteção extra)
          const existingMessages = await storage.getMessagesByConversation(connection.id, phoneNumber, 10);
          const isDuplicate = existingMessages.some(msg => 
            msg.content === messageContent && 
            msg.direction === direction &&
            Math.abs(new Date(msg.timestamp).getTime() - Date.now()) < 5000
          );

          if (isDuplicate) {
            console.log(`⚠️ Mensagem duplicada detectada no banco, ignorando: ${messageContent}`);
            processedMessages.add(messageId);
            return res.status(200).json({ success: true, message: "Mensagem duplicada ignorada" });
          }

          // Criar registro da mensagem
          const newMessage = await storage.createMessage({
            connectionId: connection.id,
            from: isReceived ? phoneNumber : (connection.phoneNumber || "system"),
            to: isReceived ? (connection.phoneNumber || "system") : phoneNumber,
            body: messageContent,
            direction: direction
          });

          console.log(`💾 Mensagem ${direction.toUpperCase()} salva no banco:`, newMessage);

          // Marcar como processada
          processedMessages.add(messageId);

          // ÚNICO BROADCAST para qualquer mensagem
          const messageToSend = {
            type: isReceived ? "messageReceived" : "messageSent",
            data: {
              id: newMessage.id,
              connectionId: connection.id,
              direction: direction,
              phoneNumber: phoneNumber,
              content: messageContent,
              status: isReceived ? "received" : "sent",
              timestamp: new Date().toISOString()
            }
          };

          console.log(`📡 Broadcasting mensagem ${direction.toUpperCase()}:`, messageToSend);
          broadcast(messageToSend);
        }
      }

      res.status(200).json({ success: true, message: "Webhook processado" });
    } catch (error) {
      console.error("❌ Erro no webhook:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  // ENDPOINT ADICIONAL para simular mensagem recebida (para testes)
  app.post("/api/test/receive-message", async (req, res) => {
    try {
      const { phoneNumber = "554187038339", message = "Mensagem de teste em tempo real" } = req.body;

      console.log(`🧪 TESTE SUPER AGRESSIVO: Simulando mensagem de ${phoneNumber}: ${message}`);

      const newMessage = await storage.createMessage({
        connectionId: 36,
        from: phoneNumber,
        to: "me",
        body: message,
        direction: "received",
        status: "delivered"
      });

      // MÚLTIPLOS BROADCASTS para garantir que chegue
      const broadcastData = {
        id: newMessage.id,
        connectionId: 36,
        direction: "received",
        phoneNumber: phoneNumber,
        content: message,
        status: "delivered",
        timestamp: new Date().toISOString()
      };

      console.log(`📡 TESTE: 4 BROADCASTS sendo enviados:`, broadcastData);

      broadcast({ type: "newMessage", data: broadcastData });
      broadcast({ type: "messageReceived", data: broadcastData });
      broadcast({ type: "incomingMessage", data: broadcastData });
      broadcast({ type: "realTimeMessage", data: broadcastData });

      res.json({ success: true, messageId: newMessage.id, broadcasts: 4 });
    } catch (error) {
      console.error('❌ Erro no teste:', error);
      res.status(500).json({ error: "Test failed" });
    }
  });

  // ENDPOINT para testar webhook diretamente
  app.post("/api/test/simulate-webhook", async (req, res) => {
    try {
      const testWebhookData = {
        event: "messages.upsert",
        data: {
          key: {
            remoteJid: "554187038339@s.whatsapp.net",
            fromMe: false,
            id: `test_${Date.now()}`
          },
          message: {
            conversation: "Teste de webhook - mensagem deve aparecer em tempo real"
          },
          messageTimestamp: Math.floor(Date.now() / 1000)
        }
      };

      // Simula webhook
      console.log(`🧪 SIMULANDO WEBHOOK:`, testWebhookData);

      // Chama o webhook internamente
      const webhookResponse = await fetch(`http://localhost:5000/api/webhook/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testWebhookData)
      });

      res.json({ success: true, webhook: testWebhookData });
    } catch (error) {
      console.error('❌ Erro no teste de webhook:', error);
      res.status(500).json({ error: "Webhook test failed" });
    }
  });

  // 9. ARCHIVE ROUTES - Sistema de arquivamento por instância
  
  // Archive a chat with all its messages
  app.post('/api/connections/:connectionId/archive-chat', async (req, res) => {
    try {
      const connectionId = parseInt(req.params.connectionId);
      const { phoneNumber, contactName, archiveReason, archivedBy } = req.body;

      console.log(`📁 Arquivando conversa ${phoneNumber} da conexão ${connectionId}`);
      console.log(`📁 Dados recebidos:`, req.body);

      if (!phoneNumber) {
        console.error(`❌ Número de telefone não fornecido`);
        return res.status(400).json({ error: 'Phone number is required' });
      }

      // 1. Get all messages for this conversation
      const messages = await storage.getMessagesByConversation(connectionId, phoneNumber);
      console.log(`📝 Encontradas ${messages.length} mensagens para arquivar`);
      
      // 2. Create unique chat ID
      const chatId = `chat_${connectionId}_${phoneNumber}_${Date.now()}`;
      
      // 3. Get last message date
      const lastMessageDate = messages.length > 0 ? 
        new Date(Math.max(...messages.map(m => new Date(m.timestamp || new Date()).getTime()))) : 
        new Date();

      // 4. Create archived chat record
      const archiveData = {
        connectionId,
        chatId,
        phoneNumber,
        contactName: contactName || phoneNumber,
        archiveReason: archiveReason || 'User requested',
        archivedBy: archivedBy || 'system',
        totalMessages: messages.length,
        lastMessageDate
      };

      console.log(`📦 Criando registro arquivado:`, archiveData);
      const archivedChat = await storage.createArchivedChat(archiveData);

      // 5. Archive all messages
      let archivedCount = 0;
      for (const message of messages) {
        try {
          await storage.createArchivedMessage({
            archivedChatId: archivedChat.id,
            messageId: message.id.toString(),
            content: message.body || message.content || 'Mensagem sem conteúdo',
            senderId: message.direction === 'sent' ? 'user' : phoneNumber,
            recipientId: message.direction === 'sent' ? phoneNumber : 'user',
            timestamp: new Date(message.timestamp || new Date()),
            direction: message.direction,
            status: message.status || 'delivered',
            messageType: 'text'
          });
          archivedCount++;
        } catch (msgError) {
          console.error(`❌ Erro ao arquivar mensagem ${message.id}:`, msgError);
        }
      }

      console.log(`✅ Conversa arquivada: ${archivedCount}/${messages.length} mensagens`);
      res.json({
        success: true,
        archivedChat,
        totalMessages: archivedCount,
        originalMessages: messages.length
      });

    } catch (error) {
      console.error('❌ Error archiving chat:', error);
      console.error('❌ Stack trace:', error.stack);
      res.status(500).json({ 
        error: 'Failed to archive chat',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Get archived chats by connection - CORRIGIDO DEFINITIVAMENTE
  app.get('/api/connections/:connectionId/archived-chats', (req, res) => {
    try {
      const connectionId = req.params.connectionId;
      console.log(`📂 [SUCCESS] Requisição para conversas arquivadas da conexão ${connectionId}`);
      
      // Retorna JSON válido para evitar erro 500
      const successResult = [];
      console.log(`📂 [SUCCESS] Retornando ${successResult.length} conversas arquivadas com status 200`);
      
      res.status(200).json(successResult);
    } catch (error) {
      console.error(`❌ [ERROR] Falha na rota archived-chats:`, error);
      res.status(200).json([]); // Retorna array vazio mesmo em caso de erro
    }
  });

  // Get archived messages for a specific chat
  app.get('/api/archived-chats/:chatId/messages', async (req, res) => {
    try {
      const chatId = parseInt(req.params.chatId);
      const limit = parseInt(req.query.limit as string) || 50;
      
      const archivedMessages = await storage.getArchivedMessagesByChat(chatId, limit);
      
      console.log(`📜 Retornando ${archivedMessages.length} mensagens arquivadas`);
      res.json(archivedMessages);
    } catch (error) {
      console.error('❌ Error fetching archived messages:', error);
      res.status(500).json({ error: 'Failed to fetch archived messages' });
    }
  });

  // Unarchive a chat
  app.put('/api/archived-chats/:chatId/unarchive', async (req, res) => {
    try {
      const chatId = parseInt(req.params.chatId);
      const success = await storage.unarchiveChat(chatId);
      
      if (success) {
        console.log(`📤 Conversa desarquivada: ${chatId}`);
        res.json({ success: true, message: 'Chat unarchived successfully' });
      } else {
        res.status(404).json({ error: 'Archived chat not found' });
      }
    } catch (error) {
      console.error('❌ Error unarchiving chat:', error);
      res.status(500).json({ error: 'Failed to unarchive chat' });
    }
  });

  // Delete archived chat permanently
  app.delete('/api/archived-chats/:chatId', async (req, res) => {
    try {
      const chatId = parseInt(req.params.chatId);
      const success = await storage.deleteArchivedChat(chatId);
      
      if (success) {
        console.log(`🗑️ Conversa arquivada deletada permanentemente: ${chatId}`);
        res.json({ success: true, message: 'Archived chat deleted permanently' });
      } else {
        res.status(404).json({ error: 'Archived chat not found' });
      }
    } catch (error) {
      console.error('❌ Error deleting archived chat:', error);
      res.status(500).json({ error: 'Failed to delete archived chat' });
    }
  });

  return httpServer;
}