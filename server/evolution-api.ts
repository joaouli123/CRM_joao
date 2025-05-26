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
    this.baseUrl = EVOLUTION_API_URL!;
    this.apiKey = EVOLUTION_API_KEY!;
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
    console.log(`📤 Enviando mensagem via ${instanceName} para ${to}: ${message}`);
    
    const data = {
      number: to.replace(/\D/g, ''), // Remove non-digits
      text: message
    };

    return await this.makeRequest(`/message/sendText/${instanceName}`, 'POST', data);
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
}

export const evolutionAPI = new EvolutionAPI();
export { EvolutionAPI };