import express from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

async function main() {
  const app = express();
  
  // Middleware
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  
  // CORS middleware
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // Register SEND MESSAGE route with absolute priority BEFORE any middleware
  const { setupSendMessageRoute } = await import("./routes");
  setupSendMessageRoute(app);
  
  // Register simple contacts API for immediate fix - HIGH PRIORITY
  app.get('/api/contacts', async (req, res) => {
    try {
      console.log('📋 API de contatos chamada diretamente');
      const { storage } = await import("./storage");
      const allContacts = await storage.getAllContacts();
      
      const response = {
        contacts: allContacts.map(contact => ({
          id: contact.id,
          name: contact.name,
          phoneNumber: contact.phoneNumber,
          email: contact.email,
          isActive: contact.isActive,
          createdAt: contact.createdAt,
          observation: contact.observation,
          tag: contact.tag,
          profilePictureUrl: contact.profilePictureUrl
        })),
        total: allContacts.length,
        page: 1,
        totalPages: 1
      };
      
      console.log(`✅ Retornando ${allContacts.length} contatos via API direta`);
      res.json(response);
    } catch (error) {
      console.error('❌ Erro na API de contatos:', error);
      res.status(500).json({ error: 'Erro interno' });
    }
  });

  app.get('/api/contacts/stats', async (req, res) => {
    try {
      const { storage } = await import("./storage");
      const allContacts = await storage.getAllContacts();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayContacts = allContacts.filter(contact => 
        contact.createdAt && contact.createdAt >= today
      );
      
      res.json({
        total: allContacts.length,
        today: todayContacts.length,
        lastUpdate: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Erro nas estatísticas:', error);
      res.status(500).json({ error: 'Erro interno' });
    }
  });
  
  // Register ALL API routes FIRST before any other middleware
  const server = await registerRoutes(app);
  
  // Add logging middleware AFTER routes are registered
  app.use('/api/*', (req, res, next) => {
    console.log(`🔧 API Request processed: ${req.method} ${req.originalUrl}`);
    next();
  });

  // Set up Vite or serve static files AFTER API routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Error handling
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Server error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  const port = parseInt(process.env.PORT || "5000", 10);
  
  server.listen(port, "0.0.0.0", () => {
    log(`Server running on port ${port}`);
  });
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});