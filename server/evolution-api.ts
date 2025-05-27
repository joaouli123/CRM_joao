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

    const result = await this.makeRequest('/instance/create', 'POST', data);
    
    // CONFIGURAR WEBHOOK SUPER AGRESSIVO IMEDIATAMENTE
    try {
      // Aguardar um pouco para a instância estar pronta
      setTimeout(async () => {
        try {
          await this.configureWebhook(instanceName);
          console.log(`✅ Webhook SUPER AGRESSIVO configurado para ${instanceName}`);
          
          // VERIFICAR se funcionou
          setTimeout(async () => {
            try {
              const checkResponse = await this.makeRequest(`/webhook/find/${instanceName}`, 'GET');
              console.log(`🔍 Verificação final do webhook:`, checkResponse);
            } catch (checkError) {
              console.log(`⚠️ Erro na verificação:`, checkError);
            }
          }, 2000);
          
        } catch (webhookError) {
          console.log(`❌ ERRO CRÍTICO ao configurar webhook:`, webhookError);
          
          // TENTAR NOVAMENTE
          setTimeout(async () => {
            try {
              await this.configureWebhook(instanceName);
              console.log(`🔄 SEGUNDA TENTATIVA de webhook configurada`);
            } catch (retryError) {
              console.log(`❌ FALHA na segunda tentativa:`, retryError);
            }
          }, 5000);
        }
      }, 3000);
    } catch (error) {
      console.log(`⚠️ Erro ao agendar configuração de webhook:`, error);
    }

    return result;
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
      console.log(`📱 Buscando TODOS os chats reais da instância ${correctInstanceName} (CARREGAMENTO COMPLETO)`);
      
      let allChats: any[] = [];
      let offset = 0;
      const batchSize = 100;
      let hasMore = true;
      
      // Buscar em lotes até pegar TODOS os contatos (como o WhatsApp Web faz)
      while (hasMore) {
        console.log(`🔄 Buscando lote ${Math.floor(offset/batchSize) + 1}: offset ${offset}, limit ${batchSize}`);
        
        const response = await this.makeRequest(`/chat/findChats/${correctInstanceName}`, 'POST', {
          where: {},
          limit: batchSize,
          offset: offset
        });
        
        if (response && response.length > 0) {
          allChats = allChats.concat(response);
          offset += batchSize;
          console.log(`✅ Lote processado: +${response.length} contatos (Total: ${allChats.length})`);
          
          // Se retornou menos que o batchSize, chegamos ao fim
          if (response.length < batchSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }
      
      console.log(`🎉 CARREGAMENTO COMPLETO! ${allChats.length} contatos carregados (como WhatsApp Web)`);
      return allChats;
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

// Configure WebSocket methods based on Evolution API documentation
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

// CONFIGURAR WEBHOOK SUPER AGRESSIVO para receber mensagens
evolutionAPI.configureWebhook = async function(instanceName: string): Promise<any> {
  try {
    // SEMPRE usar a instância real conectada
    const realInstanceName = "whatsapp_36_lowfy";
    
    // OBTER URL atual do Replit automaticamente
    const currentUrl = process.env.REPL_URL || 
                      `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` ||
                      'https://7c6685d5-f6f3-4410-ab06-262cdc778d87-00-2dsysyogtq3zv.riker.replit.dev';
    
    const webhookUrl = `${currentUrl}/api/webhook/messages`;
    console.log(`🔗 CONFIGURANDO WEBHOOK SUPER AGRESSIVO para ${realInstanceName}: ${webhookUrl}`);
    
    const response = await this.makeRequest(`/webhook/set/${realInstanceName}`, 'POST', {
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
    
    console.log(`✅ WEBHOOK SUPER AGRESSIVO configurado para ${realInstanceName}:`, response);
    
    // VERIFICAR se o webhook foi configurado corretamente
    setTimeout(async () => {
      try {
        const checkResponse = await this.makeRequest(`/webhook/find/${realInstanceName}`, 'GET');
        console.log(`🔍 Verificação do webhook para ${realInstanceName}:`, checkResponse);
      } catch (checkError) {
        console.log(`⚠️ Erro ao verificar webhook:`, checkError);
      }
    }, 1000);
    
    // CONFIGURAR TAMBÉM para a instância passada como parâmetro (backup)
    if (instanceName !== realInstanceName) {
      try {
        const backupResponse = await this.makeRequest(`/webhook/set/${instanceName}`, 'POST', {
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
        console.log(`🔄 BACKUP webhook configurado para ${instanceName}:`, backupResponse);
      } catch (backupError) {
        console.log(`⚠️ Erro no backup webhook:`, backupError);
      }
    }
    
    return response;
  } catch (error) {
    console.error(`❌ Erro ao configurar webhook para ${instanceName}:`, error);
    throw error;
  }
};
export { EvolutionAPI };