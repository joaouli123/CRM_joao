// Evolution API WhatsApp Integration

import { WebSocket } from 'ws';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "https://evolution.lowfy.com.br";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";

if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
  throw new Error('EVOLUTION_API_URL and EVOLUTION_API_KEY must be set');
}

interface EvolutionInstance {
  instance: {
    instanceName: string;
    status: string;
  };
}

interface EvolutionQRResponse {
  qrcode: {
    code: string;
    base64: string;
  };
}

interface EvolutionConnectionInfo {
  instance: {
    instanceName: string;
    status: string;
    profileName?: string;
    profilePictureUrl?: string;
    phoneNumber?: string;
  };
}

class EvolutionAPI {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = EVOLUTION_API_URL;
    this.apiKey = EVOLUTION_API_KEY;

    console.log("✅ Evolution API configurada com URL:", this.baseUrl);
  }

  private async makeRequest(endpoint: string, method: string = 'GET', data?: any) {
    const url = `${this.baseUrl}${endpoint}`;

    const options: any = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.apiKey
      }
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    console.log(`🌐 Evolution API Request: ${method} ${url}`);

    try {
      const response = await fetch(url, options);

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.error(`❌ Evolution API Request Failed: ${method} ${url}`);
        console.error(`❌ Expected JSON but got: ${contentType}`);
        console.error(`❌ Response text: ${textResponse.substring(0, 200)}...`);
        throw new Error(`Evolution API returned non-JSON response: ${contentType}`);
      }

      const result = await response.json();

      if (!response.ok) {
        console.error(`❌ Evolution API Error: ${response.status}`, result);
        throw new Error(`Evolution API Error: ${response.status} - ${JSON.stringify(result)}`);
      }

      console.log(`✅ Evolution API Response:`, result);
      return result;
    } catch (error) {
      console.error(`❌ Evolution API Request Failed:`, error);
      throw error;
    }
  }

  async createInstance(instanceName: string): Promise<EvolutionInstance> {
    console.log(`🆕 Criando instância Evolution API: ${instanceName}`);

    const data = {
      instanceName,
      token: this.apiKey,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS"
    };

    const result = await this.makeRequest('/instance/create', 'POST', data);
    return result;
  }

  async getInstanceInfo(instanceName: string): Promise<EvolutionConnectionInfo> {
    return await this.makeRequest(`/instance/connectionState/${instanceName}`);
  }

  async generateQRCode(instanceName: string): Promise<string> {
    console.log(`📱 Gerando QR Code para instância: ${instanceName}`);

    try {
      const response = await this.makeRequest(`/instance/connect/${instanceName}`, 'GET');

      let qrBase64 = null;

      if (response.qrcode?.base64) {
        qrBase64 = response.qrcode.base64;
      } else if (response.base64) {
        qrBase64 = response.base64;
      } else if (response.qr) {
        qrBase64 = response.qr;
      }

      if (qrBase64) {
        const cleanBase64 = qrBase64.replace(/^data:image\/png;base64,/, '');
        console.log(`✅ QR Code gerado com sucesso para ${instanceName}`);
        return `data:image/png;base64,${cleanBase64}`;
      }

      console.error('❌ Formato de resposta inesperado da Evolution API:', response);
      throw new Error('QR code not found in response');
    } catch (error) {
      console.error(`❌ Erro ao gerar QR Code:`, error);
      throw new Error('Failed to generate QR code - check Evolution API credentials');
    }
  }

  async getConnectionStatus(instanceName: string): Promise<string> {
    try {
      const info = await this.getInstanceInfo(instanceName);
      return info.instance.state || info.instance.status || 'disconnected';
    } catch (error) {
      console.error(`❌ Erro ao verificar status da instância ${instanceName}:`, error);
      return 'disconnected';
    }
  }

  async sendMessage(instanceName: string, to: string, message: string): Promise<any> {
    console.log(`📤 Enviando mensagem via ${instanceName} para ${to}: ${message}`);

    const data = {
      number: to.replace(/\D/g, ''),
      text: message
    };

    return await this.makeRequest(`/message/sendText/${instanceName}`, 'POST', data);
  }

  async sendAudio(instanceName: string, to: string, audioData: string): Promise<any> {
    console.log(`🎵 Enviando áudio via ${instanceName} para ${to}`);

    const data = {
      number: to.replace(/\D/g, ''),
      audioMessage: {
        audio: audioData
      }
    };

    return await this.makeRequest(`/message/sendWhatsAppAudio/${instanceName}`, 'POST', data);
  }

  async sendImage(instanceName: string, to: string, imageData: string, caption?: string): Promise<any> {
    console.log(`📸 Enviando imagem via ${instanceName} para ${to}`);

    const data = {
      number: to.replace(/\D/g, ''),
      mediaMessage: {
        media: imageData,
        caption: caption || '',
        mediaType: 'image'
      }
    };

    return await this.makeRequest(`/message/sendMedia/${instanceName}`, 'POST', data);
  }

  async sendDocument(instanceName: string, to: string, documentData: string, fileName: string): Promise<any> {
    console.log(`📄 Enviando documento via ${instanceName} para ${to}: ${fileName}`);

    const data = {
      number: to.replace(/\D/g, ''),
      mediaMessage: {
        media: documentData,
        fileName: fileName,
        mediaType: 'document'
      }
    };

    return await this.makeRequest(`/message/sendMedia/${instanceName}`, 'POST', data);
  }

  async deleteInstance(instanceName: string): Promise<void> {
    console.log(`🗑️ Deletando instância Evolution API: ${instanceName}`);
    await this.makeRequest(`/instance/delete/${instanceName}`, 'DELETE');
  }

  async restartInstance(instanceName: string): Promise<void> {
    console.log(`🔄 Reiniciando instância Evolution API: ${instanceName}`);
    await this.makeRequest(`/instance/restart/${instanceName}`, 'PUT');
  }

  async logoutInstance(instanceName: string): Promise<void> {
    console.log(`🚪 Desconectando instância Evolution API: ${instanceName}`);
    await this.makeRequest(`/instance/logout/${instanceName}`, 'DELETE');
  }

  async getContactInfo(instanceName: string, phoneNumber: string): Promise<any> {
    try {
      console.log(`📇 Buscando informações do contato ${phoneNumber}`);
      const response = await this.makeRequest(`/chat/findContacts/${instanceName}`, 'POST', {
        where: {
          number: phoneNumber
        }
      });
      return response;
    } catch (error) {
      console.log(`⚠️ Erro ao buscar contato ${phoneNumber}:`, error);
      return null;
    }
  }

  async getAllChats(instanceName: string): Promise<any> {
    try {
      console.log(`📱 Carregando contatos da instância ${instanceName}`);

      const response = await this.makeRequest(`/chat/findMany/${instanceName}`, 'GET');

      if (response && Array.isArray(response)) {
        console.log(`✅ ${response.length} contatos carregados`);
        return response;
      }

      console.log(`🏁 Nenhum contato encontrado`);
      return [];

    } catch (error) {
      console.log(`⚠️ Erro ao buscar chats:`, error);
      return [];
    }
  }

  async getChatMessages(instanceName: string, chatId: string, limit: number = 50): Promise<any> {
    try {
      const phoneNumber = chatId.replace('@s.whatsapp.net', '').replace('@c.us', '');

      console.log(`📱 Buscando mensagens do chat ${phoneNumber} (limit: ${limit})`);

      const response = await this.makeRequest(`/chat/findMessages/${instanceName}/${chatId}?limit=${limit}`, 'GET');

      console.log(`✅ Mensagens encontradas para ${phoneNumber}:`, response?.length || 0);

      return response || [];
    } catch (error) {
      console.log(`⚠️ Erro ao buscar mensagens do chat ${chatId}:`, error);
      return [];
    }
  }

  async getProfilePicture(instanceName: string, phoneNumber: string): Promise<string | null> {
    try {
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      console.log(`📸 Buscando foto de perfil para ${cleanNumber}`);

      const response = await this.makeRequest(`/chat/fetchProfilePictureUrl/${instanceName}`, 'POST', {
        number: cleanNumber
      });

      if (response?.profilePictureUrl) {
        console.log(`✅ Foto encontrada para ${cleanNumber}`);
        return response.profilePictureUrl;
      }

      return null;
    } catch (error) {
      console.log(`📸 Sem foto disponível para ${phoneNumber}`);
      return null;
    }
  }
}

export const evolutionAPI = new EvolutionAPI();

// Configure WebSocket methods
evolutionAPI.setWebSocket = async function(instanceName: string): Promise<any> {
  try {
    const response = await this.makeRequest(`/websocket/set/${instanceName}`, 'POST', {
      enabled: true,
      events: [
        "MESSAGES_UPSERT",
        "MESSAGES_UPDATE", 
        "SEND_MESSAGE",
        "CONTACTS_UPDATE",
        "CHATS_UPDATE",
        "CONNECTION_UPDATE"
      ]
    });
    console.log(`🔌 WebSocket configurado para ${instanceName}:`, response);
    return response;
  } catch (error) {
    console.error(`Erro ao configurar WebSocket para ${instanceName}:`, error);
    throw error;
  }
};

evolutionAPI.findWebSocket = async function(instanceName: string): Promise<any> {
  try {
    const response = await this.makeRequest(`/websocket/find/${instanceName}`, 'GET');
    console.log(`📡 Status WebSocket ${instanceName}:`, response);
    return response;
  } catch (error) {
    console.error(`Erro ao verificar WebSocket ${instanceName}:`, error);
    throw error;
  }
};

evolutionAPI.configureWebhook = async function(instanceName: string): Promise<any> {
  try {
    const currentUrl = process.env.REPL_URL || 
                      `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` ||
                      'https://7c6685d5-f6f3-4410-ab06-262cdc778d87-00-2dsysyogtq3zv.riker.replit.dev';

    const webhookUrl = `${currentUrl}/api/webhook/messages`;
    console.log(`🔗 Configurando webhook para ${instanceName}: ${webhookUrl}`);

    const response = await this.makeRequest(`/webhook/set/${instanceName}`, 'POST', {
      webhook: {
        url: webhookUrl,
        enabled: true,
        webhookByEvents: true,
        events: [
          "MESSAGES_UPSERT",
          "MESSAGES_UPDATE", 
          "SEND_MESSAGE",
          "CONNECTION_UPDATE",
          "QRCODE_UPDATED",
          "CHATS_UPDATE",
          "CONTACTS_UPDATE"
        ]
      }
    });

    console.log(`✅ Webhook configurado para ${instanceName}:`, response);
    return response;
  } catch (error) {
    console.error(`❌ Erro ao configurar webhook para ${instanceName}:`, error);
    throw error;
  }
};

export { EvolutionAPI };