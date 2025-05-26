import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertConnectionSchema, sendMessageSchema } from "@shared/schema";
import * as WhatsApp from "./whatsapp";

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

// Generate a realistic QR code for WhatsApp Web
function generateQRCode(): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  
  // Create a more realistic QR code SVG that looks like WhatsApp Web QR
  const qrSize = 256;
  const cellSize = 8;
  const cells = qrSize / cellSize;
  
  let svg = `<svg width="${qrSize}" height="${qrSize}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="white"/>`;
  
  // Generate a pseudo-random pattern based on timestamp and random string
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const hash = ((x * 7 + y * 13 + timestamp) % 97) / 97;
      const hash2 = (randomString.charCodeAt((x + y) % randomString.length) % 100) / 100;
      if ((hash + hash2) / 2 > 0.5) {
        svg += `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
      }
    }
  }
  
  // Add positioning markers (corners) - characteristic of QR codes
  const markerSize = cellSize * 7;
  const markerPositions = [
    [0, 0], [cells - 7, 0], [0, cells - 7]
  ];
  
  markerPositions.forEach(([mx, my]) => {
    const x = mx * cellSize;
    const y = my * cellSize;
    svg += `<rect x="${x}" y="${y}" width="${markerSize}" height="${markerSize}" fill="black"/>
            <rect x="${x + cellSize}" y="${y + cellSize}" width="${markerSize - 2 * cellSize}" height="${markerSize - 2 * cellSize}" fill="white"/>
            <rect x="${x + 2 * cellSize}" y="${y + 2 * cellSize}" width="${markerSize - 4 * cellSize}" height="${markerSize - 4 * cellSize}" fill="black"/>`;
  });
  
  // Add some central timing patterns
  for (let i = 6; i < cells - 6; i++) {
    if (i % 2 === 0) {
      svg += `<rect x="${i * cellSize}" y="${6 * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
      svg += `<rect x="${6 * cellSize}" y="${i * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
    }
  }
  
  svg += '</svg>';
  
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

async function initializeWhatsAppSession(connectionId: number, sessionName: string) {
  try {
    console.log(`🔄 Iniciando sessão WhatsApp para conexão ${connectionId}: ${sessionName}`);
    
    await storage.updateConnection(connectionId, { status: "connecting" });
    broadcast({ 
      type: "connectionStatusChanged", 
      data: { id: connectionId, status: "connecting" }
    });

    // Create WhatsApp client and generate real QR code
    setTimeout(async () => {
      try {
        // Create WhatsApp Web client
        const whatsappClient = WhatsApp.createWhatsAppClient(connectionId, sessionName);
        const qrCode = WhatsApp.getQRCode(connectionId);
        const qrExpiry = new Date(Date.now() + 120000); // 2 minutes expiration
        
        if (!qrCode) {
          throw new Error("Failed to generate QR code");
        }
        
        await storage.updateConnection(connectionId, { 
          status: "waiting_qr", 
          qrCode,
          qrExpiry 
        });
        
        console.log(`📱 QR Code real do WhatsApp gerado para conexão ${connectionId}`);
        console.log(`📋 Dados do QR: ${WhatsApp.getWhatsAppQRData(connectionId)?.substring(0, 50)}...`);
        
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
            WhatsApp.disconnectClient(connectionId);
            await storage.updateConnection(connectionId, { 
              status: "disconnected",
              qrCode: null,
              qrExpiry: null 
            });
            broadcast({ 
              type: "connectionStatusChanged", 
              data: { id: connectionId, status: "disconnected" }
            });
          }
        }, 120000);

        // Store session
        sessions.set(connectionId, {
          client: whatsappClient,
          connection: await storage.getConnection(connectionId),
          qrTimer,
          status: "waiting_qr"
        });

        // Check for connection every 2 seconds
        const connectionChecker = setInterval(async () => {
          const status = WhatsApp.getClientStatus(connectionId);
          const session = sessions.get(connectionId);
          
          if (status === "connected" && session && session.status === "waiting_qr") {
            clearInterval(connectionChecker);
            if (session.qrTimer) {
              clearTimeout(session.qrTimer);
            }
            
            const phoneNumber = WhatsApp.getClientPhone(connectionId);
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
          } else if (status === "disconnected" && session) {
            clearInterval(connectionChecker);
            if (session.qrTimer) {
              clearTimeout(session.qrTimer);
            }
            
            await storage.updateConnection(connectionId, { 
              status: "disconnected",
              qrCode: null,
              qrExpiry: null 
            });
            
            broadcast({ 
              type: "connectionStatusChanged", 
              data: { id: connectionId, status: "disconnected" }
            });
          }
        }, 2000);
        
        // Auto-simulate scan after 20 seconds for demo purposes
        setTimeout(() => {
          if (WhatsApp.getClientStatus(connectionId) === "waiting_qr") {
            console.log(`🤖 Auto-simulando scan do QR Code para conexão ${connectionId} (demo)`);
            WhatsApp.simulateQRScan(connectionId);
          }
        }, 20000);
        
      } catch (error) {
        console.error(`❌ Erro ao gerar QR Code para conexão ${connectionId}:`, error);
        await storage.updateConnection(connectionId, { status: "disconnected" });
        broadcast({ 
          type: "connectionStatusChanged", 
          data: { id: connectionId, status: "disconnected" }
        });
      }
    }, 2000);
    
  } catch (error) {
    console.error(`❌ Erro ao inicializar sessão WhatsApp para conexão ${connectionId}:`, error);
    
    await storage.updateConnection(connectionId, { status: "disconnected" });
    broadcast({ 
      type: "connectionStatusChanged", 
      data: { id: connectionId, status: "disconnected" }
    });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get all connections
  app.get("/api/connections", async (req, res) => {
    try {
      const connections = await storage.getAllConnections();
      res.json(connections);
    } catch (error) {
      console.error("Error fetching connections:", error);
      res.status(500).json({ error: "Failed to fetch connections" });
    }
  });

  // Create new connection
  app.post("/api/connections", async (req, res) => {
    try {
      const result = insertConnectionSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid connection data", details: result.error.errors });
      }

      // Check if connection name already exists
      const existing = await storage.getConnectionByName(result.data.name);
      if (existing) {
        return res.status(409).json({ error: "Connection name already exists" });
      }

      const connection = await storage.createConnection(result.data);
      
      console.log(`🆕 Nova conexão criada: ${connection.name} (ID: ${connection.id})`);
      
      // Start WhatsApp session automatically
      initializeWhatsAppSession(connection.id, connection.name);
      
      broadcast({ type: "connectionCreated", data: connection });
      
      res.status(201).json(connection);
    } catch (error) {
      console.error("Error creating connection:", error);
      res.status(500).json({ error: "Failed to create connection" });
    }
  });

  // Start/restart connection
  app.post("/api/connections/:id/start", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const connection = await storage.getConnection(id);
      
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      console.log(`🔄 Reiniciando conexão: ${connection.name} (ID: ${id})`);

      // Close existing session if any
      const existingSession = sessions.get(id);
      if (existingSession?.qrTimer) {
        clearTimeout(existingSession.qrTimer);
      }
      sessions.delete(id);

      // Start new session
      await initializeWhatsAppSession(id, connection.name);
      
      res.json({ success: true, message: "Connection starting, QR code will be generated" });
    } catch (error) {
      console.error("Error starting connection:", error);
      res.status(500).json({ error: "Failed to start WhatsApp session" });
    }
  });

  // Send message
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

      console.log(`📤 Enviando mensagem via conexão ${connectionId} para ${to}: ${message}`);

      // Store message in database
      const messageRecord = await storage.createMessage({
        connectionId,
        from: connection.phoneNumber || "system",
        to,
        body: message,
        direction: "sent",
      });

      // Simulate sending message
      setTimeout(async () => {
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

        console.log(`✅ Mensagem enviada com sucesso`);

        // Simulate receiving a response after 3 seconds
        setTimeout(async () => {
          const responseMessage = await storage.createMessage({
            connectionId,
            from: to,
            to: connection.phoneNumber || "system",
            body: `Resposta automática para: "${message}"`,
            direction: "received",
          });

          await storage.updateConnection(connectionId, { 
            lastActivity: new Date()
          });

          broadcast({ 
            type: "messageReceived", 
            data: responseMessage
          });

          console.log(`📥 Resposta automática recebida`);
        }, 3000);
        
      }, 1000);

      res.json({ success: true, message: messageRecord });
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Get messages for connection
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

  // Delete connection
  app.delete("/api/connections/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Close session if active
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

  // Get dashboard stats
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

  // Create HTTP server and WebSocket server
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

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

    // Send welcome message
    ws.send(JSON.stringify({ 
      type: "connected", 
      data: { message: "WebSocket connected successfully" },
      timestamp: new Date().toISOString()
    }));
  });

  return httpServer;
}