import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertConnectionSchema, sendMessageSchema } from "@shared/schema";
import { evolutionAPI } from "./evolution-api";

const connections = new Map<WebSocket, any>();
let wss: WebSocketServer;

// Session management
const sessions = new Map<number, any>();

function broadcast(data: any) {
  const message = JSON.stringify(data);
  connections.forEach((_, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
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

    // Create Evolution API instance and generate real QR code
    setTimeout(async () => {
      try {
        const instanceName = `whatsapp_${connectionId}_${sessionName.replace(/\s+/g, '_')}`;

        // Create Evolution API instance
        console.log(`🆕 Criando instância Evolution API: ${instanceName}`);
        await evolutionAPI.createInstance(instanceName);

        // Generate real WhatsApp QR code
        const qrCode = await evolutionAPI.generateQRCode(instanceName);
        const qrExpiry = new Date(Date.now() + 180000); // 3 minutes expiration

        await storage.updateConnection(connectionId, { 
          status: "waiting_qr", 
          qrCode,
          qrExpiry,
          sessionData: instanceName
        });

        console.log(`📱 QR Code REAL do WhatsApp gerado para conexão ${connectionId}!`);
        console.log(`🔗 Instância Evolution API: ${instanceName}`);

        broadcast({ 
          type: "qrCodeReceived", 
          data: { 
            connectionId, 
            qrCode,
            expiration: qrExpiry 
          }
        });

        // Set timer to expire QR code
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

        // Store session
        sessions.set(connectionId, {
          client: { instanceName },
          connection: await storage.getConnection(connectionId),
          qrTimer,
          status: "waiting_qr"
        });

        // Check for connection status every 3 seconds
        const connectionChecker = setInterval(async () => {
          try {
            const status = await evolutionAPI.getConnectionStatus(instanceName);
            const session = sessions.get(connectionId);

            console.log(`🔍 Verificando status da instância ${instanceName}: ${status}`);

            if (status === "open" && session && session.status === "waiting_qr") {
              clearInterval(connectionChecker);
              if (session.qrTimer) {
                clearTimeout(session.qrTimer);
              }

              // Get connection info
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
            }
          } catch (error) {
            console.error(`❌ Erro ao verificar status da conexão ${instanceName}:`, error);
          }
        }, 3000);

      } catch (error) {
        console.error(`❌ Erro ao criar instância Evolution API:`, error);
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
    }, 1000);

  } catch (error) {
    console.error(`❌ Erro ao inicializar sessão WhatsApp:`, error);
    await storage.updateConnection(connectionId, { status: "disconnected" });
    broadcast({ 
      type: "connectionStatusChanged", 
      data: { id: connectionId, status: "disconnected" }
    });
  }
}

export function setupRoutes(app: Express): Server {
  const server = createServer(app);

  // Setup WebSocket
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    console.log("🔌 Cliente conectado ao WebSocket");
    connections.set(ws, {});

    ws.send(JSON.stringify({
      type: "connected",
      data: { message: "WebSocket connected successfully" },
      timestamp: new Date().toISOString()
    }));

    ws.on("close", () => {
      console.log("🔌 Cliente desconectado do WebSocket");
      connections.delete(ws);
    });
  });

  // Get all connections
  app.get("/api/connections", async (req, res) => {
    try {
      const connections = await storage.getConnections();
      res.json(connections);
    } catch (error) {
      console.error("Error fetching connections:", error);
      res.status(500).json({ error: "Failed to fetch connections" });
    }
  });

  // Create new connection
  app.post("/api/connections", async (req, res) => {
    try {
      const data = insertConnectionSchema.parse(req.body);
      const connection = await storage.createConnection(data);

      broadcast({ 
        type: "connectionCreated", 
        data: connection,
        timestamp: new Date().toISOString()
      });

      res.json(connection);
    } catch (error) {
      console.error("Error creating connection:", error);
      res.status(500).json({ error: "Failed to create connection" });
    }
  });

  // Start connection
  app.post("/api/connections/:id/start", async (req, res) => {
    try {
      const connectionId = parseInt(req.params.id);
      const connection = await storage.getConnection(connectionId);

      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      console.log(`🚀 Iniciando conexão ${connectionId}: ${connection.name}`);

      // Initialize WhatsApp session with Evolution API
      await initializeWhatsAppSession(connectionId, connection.name);

      res.json({ success: true });
    } catch (error) {
      console.error("Error starting connection:", error);
      res.status(500).json({ error: "Failed to start connection" });
    }
  });

  // Delete connection
  app.delete("/api/connections/:id", async (req, res) => {
    try {
      const connectionId = parseInt(req.params.id);
      const connection = await storage.getConnection(connectionId);

      if (connection && connection.sessionData) {
        try {
          await evolutionAPI.deleteInstance(connection.sessionData);
        } catch (e) {
          console.log(`ℹ️ Instância ${connection.sessionData} já foi removida`);
        }
      }

      // Clear session
      const session = sessions.get(connectionId);
      if (session && session.qrTimer) {
        clearTimeout(session.qrTimer);
      }
      sessions.delete(connectionId);

      await storage.deleteConnection(connectionId);

      broadcast({ 
        type: "connectionDeleted", 
        data: { id: connectionId },
        timestamp: new Date().toISOString()
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting connection:", error);
      res.status(500).json({ error: "Failed to delete connection" });
    }
  });

  // Send message
  app.post("/api/connections/:id/messages", async (req, res) => {
    try {
      const connectionId = parseInt(req.params.id);
      const { to, message } = sendMessageSchema.parse(req.body);

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

      // Store message in database
      const messageRecord = await storage.createMessage({
        connectionId,
        from: connection.phoneNumber || "system",
        to,
        body: message,
        direction: "sent",
      });

      // Send real message via Evolution API
      try {
        const result = await evolutionAPI.sendMessage(instanceName, to, message);

        await storage.updateMessage(messageRecord.id, { status: "sent" });

        // Update connection stats
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

        res.json(messageRecord);

      } catch (error) {
        console.error(`❌ Erro ao enviar mensagem via Evolution API:`, error);
        await storage.updateMessage(messageRecord.id, { status: "failed" });
        res.status(500).json({ error: "Failed to send message" });
      }

    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Get messages for a connection
  app.get("/api/connections/:id/messages", async (req, res) => {
    try {
      const connectionId = parseInt(req.params.id);
      const messages = await storage.getMessages(connectionId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Get stats
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  return server;
}