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

function broadcast(data: any) {
  const message = JSON.stringify({ ...data, timestamp: new Date().toISOString() });
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
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
        
        await storage.updateConnection(connectionId, { 
          status: "waiting_qr", 
          qrCode,
          qrExpiry,
          sessionData: instanceName
        });
        
        console.log(`📱 QR Code REAL do WhatsApp gerado para conexão ${connectionId}!`);
        
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
  
  app.get("/api/connections", async (req, res) => {
    try {
      const connections = await storage.getAllConnections();
      res.json(connections);
    } catch (error) {
      console.error("Error fetching connections:", error);
      res.status(500).json({ error: "Failed to fetch connections" });
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

      console.log(`📤 Enviando mensagem REAL via Evolution API conexão ${connectionId} para ${to}: ${message}`);

      const instanceName = connection.sessionData;
      if (!instanceName) {
        return res.status(400).json({ error: "Connection session not found" });
      }

      const messageRecord = await storage.createMessage({
        connectionId,
        from: connection.phoneNumber || "system",
        to,
        body: message,
        direction: "sent",
      });

      try {
        const result = await evolutionAPI.sendMessage(instanceName, to, message);
        
        await storage.updateMessage(messageRecord.id, { status: "sent" });
        
        await storage.updateConnection(connectionId, { 
          lastActivity: new Date()
        });

        broadcast({ 
          type: "messageSent", 
          data: {
            ...messageRecord,
            status: "sent"
          }
        });

        console.log(`✅ Mensagem real enviada com sucesso via Evolution API!`, result);
        
      } catch (error) {
        console.error(`❌ Erro ao enviar mensagem via Evolution API:`, error);
        await storage.updateMessage(messageRecord.id, { status: "failed" });
      }

      res.json({ success: true, message: messageRecord });
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

  return httpServer;
}