import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertConnectionSchema, sendMessageSchema } from "@shared/schema";

interface WhatsAppSession {
  client: any;
  connection: any;
  qrTimer?: NodeJS.Timeout;
  status: string;
}

const sessions = new Map<number, WhatsAppSession>();
const clients = new Set<WebSocket>();

function broadcast(data: any) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Generate a realistic QR code for WhatsApp Web simulation
function generateQRCode(): string {
  const timestamp = Date.now();
  
  // Create a more realistic QR code SVG
  const qrSize = 256;
  const cellSize = 8;
  const cells = qrSize / cellSize;
  
  let svg = `<svg width="${qrSize}" height="${qrSize}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="white"/>`;
  
  // Generate a pseudo-random pattern that looks like a QR code
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const hash = ((x * 7 + y * 13 + timestamp) % 97) / 97;
      if (hash > 0.5) {
        svg += `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
      }
    }
  }
  
  // Add positioning markers (corners)
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
  
  svg += '</svg>';
  
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

async function initializeWhatsAppSession(connectionId: number, sessionName: string) {
  try {
    console.log(`Initializing WhatsApp session for connection ${connectionId}`);
    
    await storage.updateConnection(connectionId, { status: "connecting" });
    broadcast({ type: "connectionStatusChanged", data: { id: connectionId, status: "connecting" }});

    // Simulate QR code generation
    setTimeout(async () => {
      const qrCode = generateQRCode();
      const qrExpiry = new Date(Date.now() + 60000); // 1 minute expiration
      
      await storage.updateConnection(connectionId, { 
        status: "waiting_qr", 
        qrCode,
        qrExpiry 
      });
      
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
          await storage.updateConnection(connectionId, { 
            status: "disconnected",
            qrCode: null,
            qrExpiry: null 
          });
          broadcast({ type: "connectionStatusChanged", data: { id: connectionId, status: "disconnected" }});
        }
      }, 60000);

      // Store session
      sessions.set(connectionId, {
        client: null,
        connection: await storage.getConnection(connectionId),
        qrTimer,
        status: "waiting_qr"
      });

      // Simulate successful connection after 10 seconds (user would scan QR in real scenario)
      setTimeout(async () => {
        const session = sessions.get(connectionId);
        if (session && session.status === "waiting_qr") {
          if (session.qrTimer) {
            clearTimeout(session.qrTimer);
          }
          
          await storage.updateConnection(connectionId, { 
            status: "connected",
            qrCode: null,
            qrExpiry: null,
            lastActivity: new Date(),
            phoneNumber: "+5511999999999" // Simulated phone number
          });
          
          session.status = "connected";
          sessions.set(connectionId, session);
          
          broadcast({ type: "connectionStatusChanged", data: { id: connectionId, status: "connected" }});
          console.log(`Connection ${connectionId} established successfully`);
        }
      }, 10000);
      
    }, 2000);
    
  } catch (error) {
    console.error(`Error initializing WhatsApp session for connection ${connectionId}:`, error);
    
    await storage.updateConnection(connectionId, { status: "disconnected" });
    broadcast({ type: "connectionStatusChanged", data: { id: connectionId, status: "disconnected" }});
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
      
      const session = sessions.get(connectionId);
      const connection = await storage.getConnection(connectionId);
      
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      if (connection.status !== "connected") {
        return res.status(400).json({ error: "Connection is not active" });
      }

      // Store message in database
      const messageRecord = await storage.createMessage({
        connectionId,
        from: connection.phoneNumber || "system",
        to,
        body: message,
        direction: "sent",
      });

      // Simulate sending message (in real implementation, this would use WhatsApp Web API)
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
    console.log('Client connected to WebSocket');

    ws.on('close', () => {
      clients.delete(ws);
      console.log('Client disconnected from WebSocket');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });

    // Send welcome message
    ws.send(JSON.stringify({ type: "connected", data: { message: "WebSocket connected" } }));
  });

  return httpServer;
}