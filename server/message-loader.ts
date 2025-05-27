import { storage } from "./storage";
import { broadcast } from "./routes";

// 💬 SISTEMA DE CARREGAMENTO DE MENSAGENS EM TEMPO REAL
export class MessageLoader {
  
  // Criar mensagens de exemplo para demonstrar o sistema funcionando
  async createSampleMessages(connectionId: number, phoneNumber: string, contactName: string): Promise<void> {
    try {
      console.log(`💬 Criando mensagens de exemplo para ${contactName} (${phoneNumber})`);
      
      // Mensagem recebida
      const receivedMessage = await storage.createMessage({
        connectionId,
        direction: 'received',
        from: phoneNumber,
        to: 'me',
        body: `Olá! Esta é uma mensagem de ${contactName}. Sistema funcionando em tempo real! 🎉`
      });

      // Mensagem enviada
      const sentMessage = await storage.createMessage({
        connectionId,
        direction: 'sent',
        from: 'me',
        to: phoneNumber,
        body: 'Oi! Como você está? O sistema está funcionando perfeitamente!'
      });

      // Broadcast das mensagens para o frontend
      broadcast({
        type: "new_message",
        data: {
          ...receivedMessage,
          connectionId,
          phoneNumber
        }
      });

      broadcast({
        type: "new_message", 
        data: {
          ...sentMessage,
          connectionId,
          phoneNumber
        }
      });

      console.log(`✅ Mensagens criadas e transmitidas para ${contactName}`);
    } catch (error) {
      console.log(`⚠️ Erro ao criar mensagens para ${contactName}:`, error);
    }
  }

  // Carregar mensagens existentes do banco de dados
  async loadExistingMessages(connectionId: number): Promise<any[]> {
    try {
      const messages = await storage.getMessagesByConnection(connectionId);
      console.log(`📥 ${messages.length} mensagens carregadas do banco de dados`);
      return messages;
    } catch (error) {
      console.log(`⚠️ Erro ao carregar mensagens:`, error);
      return [];
    }
  }

  // Simular mensagem nova chegando
  async simulateNewMessage(connectionId: number, phoneNumber: string, message: string): Promise<void> {
    try {
      const newMessage = await storage.createMessage({
        connectionId,
        direction: 'received',
        from: phoneNumber,
        to: 'me',
        body: message
      });

      // Broadcast imediato para o frontend
      broadcast({
        type: "new_message",
        data: {
          ...newMessage,
          connectionId,
          phoneNumber
        }
      });

      console.log(`📥 Nova mensagem simulada de ${phoneNumber}: ${message}`);
    } catch (error) {
      console.log(`⚠️ Erro ao simular mensagem:`, error);
    }
  }
}

export const messageLoader = new MessageLoader();