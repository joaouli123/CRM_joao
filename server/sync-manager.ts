import { evolutionAPI } from "./evolution-api";
import { storage } from "./storage";
import { broadcast } from "./routes";

class SyncManager {
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  // Iniciar sincronização em tempo real
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🚀 Iniciando sincronização em tempo real...');
    
    // Sincronizar a cada 5 segundos
    this.syncInterval = setInterval(async () => {
      await this.syncAllConnections();
    }, 5000);
  }

  // Parar sincronização
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    console.log('⏹️ Sincronização em tempo real parada');
  }

  // Sincronizar todas as conexões ativas
  private async syncAllConnections() {
    try {
      const connections = await storage.getAllConnections();
      
      for (const connection of connections) {
        if (connection.status === 'connected') {
          await this.syncConnection(connection.id, connection.name);
        }
      }
    } catch (error) {
      console.log('⚠️ Erro na sincronização:', error);
    }
  }

  // Sincronizar uma conexão específica
  private async syncConnection(connectionId: number, connectionName: string) {
    try {
      const instanceName = "whatsapp_36_lowfy"; // Usar instância real
      
      // Buscar chats mais recentes
      const recentChats = await evolutionAPI.getAllChats(instanceName);
      
      if (recentChats && recentChats.length > 0) {
        let newMessagesCount = 0;
        
        // Verificar os 5 chats mais ativos
        for (const chat of recentChats.slice(0, 5)) {
          const phoneNumber = chat.remoteJid?.replace('@s.whatsapp.net', '') || chat.id;
          
          // Simular busca de mensagens recentes (adaptado para sua API)
          try {
            // Verificar se há mensagens novas neste chat
            const existingMessages = await storage.getMessagesByConnection(connectionId);
            const chatMessages = existingMessages.filter(m => 
              m.from === phoneNumber || m.to === phoneNumber
            );
            
            // Se o chat foi atualizado recentemente, pode haver mensagens novas
            const lastUpdate = new Date(chat.updatedAt || new Date());
            const oneMinuteAgo = new Date(Date.now() - 60000);
            
            if (lastUpdate > oneMinuteAgo) {
              console.log(`🔄 Chat ${phoneNumber} foi atualizado recentemente, verificando mensagens...`);
              
              // Broadcast atualização para o frontend
              broadcast({
                type: "conversation_update",
                connectionId,
                phoneNumber,
                timestamp: new Date()
              });
            }
            
          } catch (chatError) {
            console.log(`⚠️ Erro ao verificar chat ${phoneNumber}:`, (chatError as Error).message);
          }
        }
        
        if (newMessagesCount > 0) {
          console.log(`✅ ${newMessagesCount} atualizações de chat sincronizadas`);
        }
      }
      
    } catch (error) {
      console.log(`⚠️ Erro ao sincronizar conexão ${connectionId}:`, (error as Error).message);
    }
  }

  // Método para adicionar mensagem manualmente (para testes)
  async addTestMessage(connectionId: number, phoneNumber: string, message: string, direction: 'sent' | 'received' = 'received') {
    try {
      const savedMessage = await storage.createMessage({
        connectionId,
        direction,
        from: direction === 'sent' ? 'me' : phoneNumber,
        to: direction === 'sent' ? phoneNumber : 'me',
        body: message
      });

      // Broadcast para clientes
      broadcast({
        type: "new_message",
        data: {
          ...savedMessage,
          connectionId,
          phoneNumber
        }
      });

      console.log(`✅ Mensagem de teste adicionada: ${message}`);
      return savedMessage;
    } catch (error) {
      console.log(`❌ Erro ao adicionar mensagem de teste:`, error);
    }
  }
}

export const syncManager = new SyncManager();