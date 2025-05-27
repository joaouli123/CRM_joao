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
  
  // Setup contacts API fix
  const { setupContactsFix } = await import("./contacts-fix");
  setupContactsFix(app);
  
  // Register ALL API routes BEFORE Vite middleware
  await registerRoutes(app);
  
  // Set up Vite or serve static files AFTER API routes registration
  let server;
  if (app.get("env") === "development") {
    server = await setupVite(app, undefined as any);
  } else {
    serveStatic(app);
    const http = await import('http');
    server = http.createServer(app);
  }
  
  // Ensure server is defined
  if (!server) {
    const http = await import('http');
    server = http.createServer(app);
  }
  
  // Add logging middleware AFTER routes are registered
  app.use('/api/*', (req, res, next) => {
    console.log(`🔧 API Request processed: ${req.method} ${req.originalUrl}`);
    next();
  });

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