import { WebSocketServer, WebSocket } from "ws";
import { evolutionAPI } from "./evolution-api";
import { storage } from "./storage";

let wss: WebSocketServer;

interface SyncJob {
  connectionId: number;
  instanceName: string;
  lastSync: Date;
}

const activeSyncJobs = new Map<number, SyncJob>();

export function setupRealtimeSync(server: any) {
  // Configurar WebSocket Server
  wss = new WebSocketServer({ server, path: '/ws' });
  
  wss.on('connection', (ws) => {
    console.log('🔌 Cliente conectado ao WebSocket - Sincronização em tempo real ativada');
    
    ws.on('close', () => {
      console.log('🔌 Cliente desconectado do WebSocket');
    });
    
    ws.on('error', (error) => {
      console.log('⚠️ Erro WebSocket:', error.message);
    });
  });

  // Iniciar sincronização automática a cada 10 segundos
  setInterval(async () => {
    await syncAllConnections();
  }, 10000); // 10 segundos

  console.log('🚀 Sincronização em tempo real configurada!');
}

async function syncAllConnections() {
  try {
    const connections = await storage.getAllConnections();
    
    for (const connection of connections) {
      if (connection.status === 'connected') {
        await syncConnection(connection.id, connection.name);
      }
    }
  } catch (error) {
    console.log('⚠️ Erro na sincronização geral:', error);
  }
}

async function syncConnection(connectionId: number, connectionName: string) {
  try {
    const instanceName = `whatsapp_${connectionId}_${connectionName}`;
    
    // Verificar se já existe um job de sincronização
    const existingJob = activeSyncJobs.get(connectionId);
    const now = new Date();
    
    // Se sincronizou recentemente (menos de 8 segundos), pular
    if (existingJob && (now.getTime() - existingJob.lastSync.getTime()) < 8000) {
      return;
    }

    console.log(`🔄 Sincronizando conexão ${connectionId} (${instanceName})`);

    // Buscar chats recentes da Evolution API
    const recentChats = await evolutionAPI.getAllChats(instanceName);
    
    if (recentChats && recentChats.length > 0) {
      let newMessagesCount = 0;
      
      // Sincronizar os 3 chats mais recentes
      for (const chat of recentChats.slice(0, 3)) {
        try {
          // Extrair número do telefone do chat ID
          const phoneNumber = chat.remoteJid.replace('@s.whatsapp.net', '');
          
          // Buscar mensagens recentes (últimas 5)
          const messages = await evolutionAPI.getChatMessages(instanceName, chat.id, 5);
          
          if (messages && messages.length > 0) {
            // Salvar apenas mensagens novas
            for (const msg of messages) {
              const existingMessages = await storage.getMessagesByConnection(connectionId);
              const messageExists = existingMessages.some(m => 
                m.body === msg.body && 
                Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp || now).getTime()) < 5000
              );
              
              if (!messageExists) {
                await storage.createMessage({
                  connectionId,
                  direction: msg.fromMe ? 'sent' : 'received',
                  from: msg.fromMe ? 'me' : phoneNumber,
                  to: msg.fromMe ? phoneNumber : 'me',
                  body: msg.body || msg.text || ''
                });
                
                newMessagesCount++;
                console.log(`📨 Nova mensagem sincronizada de ${phoneNumber}: ${msg.body?.substring(0, 30)}...`);
                
                // Broadcast para clientes WebSocket
                broadcastNewMessage({
                  type: 'new_message',
                  connectionId,
                  phoneNumber,
                  message: msg.body || msg.text || '',
                  direction: msg.fromMe ? 'sent' : 'received',
                  timestamp: new Date()
                });
              }
            }
          }
        } catch (chatError: any) {
          console.log(`⚠️ Erro ao sincronizar chat:`, chatError.message);
        }
      }
      
      if (newMessagesCount > 0) {
        console.log(`✅ ${newMessagesCount} novas mensagens sincronizadas para conexão ${connectionId}`);
        
        // Broadcast atualização da lista de conversas
        broadcastConversationUpdate(connectionId);
      }
    }

    // Atualizar job de sincronização
    activeSyncJobs.set(connectionId, {
      connectionId,
      instanceName,
      lastSync: now
    });

  } catch (error: any) {
    console.log(`⚠️ Erro ao sincronizar conexão ${connectionId}:`, error.message);
  }
}

function broadcastNewMessage(data: any) {
  if (wss) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }
}

function broadcastConversationUpdate(connectionId: number) {
  if (wss) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'conversation_update',
          connectionId
        }));
      }
    });
  }
}

export function broadcast(data: any) {
  broadcastNewMessage(data);
}