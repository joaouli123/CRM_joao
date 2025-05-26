// Evolution API WhatsApp Integration

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

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
    // Use suas credenciais reais da Evolution API - URL corrigida sem /manager/
    this.baseUrl = "https://evolution.lowfy.com.br";
    this.apiKey = "011dA95bf60bb215afd8cce1e01f99598A";
    
    console.log("✅ Evolution API configurada com URL corrigida:", this.baseUrl);
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

    return await this.makeRequest('/instance/create', 'POST', data);
  }

  async getInstanceInfo(instanceName: string): Promise<EvolutionConnectionInfo> {
    return await this.makeRequest(`/instance/connectionState/${instanceName}`);
  }

  async generateQRCode(instanceName: string): Promise<string> {
    console.log(`📱 Gerando QR Code para instância: ${instanceName}`);
    
    try {
      const response = await this.makeRequest(`instance/connect/${instanceName}`, 'GET');
      
      // Handle different possible response formats from Evolution API
      let qrBase64 = null;
      
      if (response.qrcode?.base64) {
        qrBase64 = response.qrcode.base64;
      } else if (response.base64) {
        qrBase64 = response.base64;
      } else if (response.qr) {
        qrBase64 = response.qr;
      }
      
      if (qrBase64) {
        // Clean any existing data URL prefix to avoid duplication
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
      // Evolution API returns 'state' field, not 'status'
      return info.instance.state || info.instance.status || 'disconnected';
    } catch (error) {
      console.error(`❌ Erro ao verificar status da instância ${instanceName}:`, error);
      return 'disconnected';
    }
  }

  async sendMessage(instanceName: string, to: string, message: string): Promise<any> {
    // Always use the correct instanceName for REST API calls
    const correctInstanceName = "whatsapp_36_lowfy";
    console.log(`📤 Enviando mensagem via ${correctInstanceName} para ${to}: ${message}`);
    
    const data = {
      number: to.replace(/\D/g, ''), // Remove non-digits
      text: message
    };

    return await this.makeRequest(`/message/sendText/${correctInstanceName}`, 'POST', data);
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
      // Always use the correct instanceName for REST API calls
      const correctInstanceName = "whatsapp_36_lowfy";
      console.log(`📱 Buscando todos os chats reais da instância ${correctInstanceName}`);
      const response = await this.makeRequest(`/chat/findChats/${correctInstanceName}`, 'POST', {
        where: {}
      });
      console.log(`✅ Encontrados ${response?.length || 0} chats reais`);
      return response;
    } catch (error) {
      console.log(`⚠️ Erro ao buscar chats:`, error);
      return [];
    }
  }

  async getChatMessages(instanceName: string, chatId: string, limit: number = 50): Promise<any> {
    try {
      // Always use the correct instanceName for REST API calls
      const correctInstanceName = "whatsapp_36_lowfy";
      console.log(`💬 Buscando mensagens reais do chat ${chatId} com instanceName ${correctInstanceName}`);
      const response = await this.makeRequest(`/chat/findMessages/${correctInstanceName}`, 'POST', {
        where: {
          key: {
            remoteJid: chatId
          }
        },
        limit,
        sort: { messageTimestamp: -1 }
      });
      
      // Extract messages from the correct format: response.messages.records
      if (response && response.messages && response.messages.records) {
        console.log(`✅ Extraindo ${response.messages.records.length} mensagens reais`);
        return response.messages.records;
      }
      
      return [];
    } catch (error) {
      console.log(`⚠️ Erro ao buscar mensagens do chat ${chatId}:`, error);
      return [];
    }
  }
}

export const evolutionAPI = new EvolutionAPI();
export { EvolutionAPI };