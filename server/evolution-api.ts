// Evolution API WhatsApp Integration

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "https://evolution.lowfy.com.br";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "011dA95bf60bb215afd8cce1e01f99598A";

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

  // 📝 ENVIAR TEMPLATE
  async sendTemplate(instanceName: string, to: string, templateData: any): Promise<any> {
    const correctInstanceName = "whatsapp_36_lowfy";
    console.log(`📝 Enviando template via ${correctInstanceName} para ${to}`);
    
    const data = {
      number: to.replace(/\D/g, ''),
      template: templateData
    };

    return await this.makeRequest(`/message/sendTemplate/${correctInstanceName}`, 'POST', data);
  }

  // 📊 ENVIAR STATUS/STORY
  async sendStatus(instanceName: string, statusData: any): Promise<any> {
    const correctInstanceName = "whatsapp_36_lowfy";
    console.log(`📊 Enviando status via ${correctInstanceName}`);
    
    return await this.makeRequest(`/message/sendStatus/${correctInstanceName}`, 'POST', statusData);
  }

  // 🎵 ENVIAR ÁUDIO WHATSAPP
  async sendAudio(instanceName: string, to: string, audioData: string): Promise<any> {
    const correctInstanceName = "whatsapp_36_lowfy";
    console.log(`🎵 Enviando áudio WhatsApp via ${correctInstanceName} para ${to}`);
    
    const data = {
      number: to.replace(/\D/g, ''),
      audioMessage: {
        audio: audioData
      }
    };

    return await this.makeRequest(`/message/sendWhatsAppAudio/${correctInstanceName}`, 'POST', data);
  }

  // 📸 ENVIAR MÍDIA (IMAGEM/VÍDEO/DOCUMENTO)
  async sendMedia(instanceName: string, to: string, mediaData: string, mediaType: string, caption?: string, fileName?: string): Promise<any> {
    const correctInstanceName = "whatsapp_36_lowfy";
    console.log(`📸 Enviando mídia ${mediaType} via ${correctInstanceName} para ${to}`);
    
    const data = {
      number: to.replace(/\D/g, ''),
      mediaMessage: {
        media: mediaData,
        mediaType: mediaType, // image, video, document
        caption: caption || '',
        fileName: fileName || undefined
      }
    };

    return await this.makeRequest(`/message/sendMedia/${correctInstanceName}`, 'POST', data);
  }

  // 🎭 ENVIAR STICKER
  async sendSticker(instanceName: string, to: string, stickerData: string): Promise<any> {
    const correctInstanceName = "whatsapp_36_lowfy";
    console.log(`🎭 Enviando sticker via ${correctInstanceName} para ${to}`);
    
    const data = {
      number: to.replace(/\D/g, ''),
      stickerMessage: {
        sticker: stickerData
      }
    };

    return await this.makeRequest(`/message/sendSticker/${correctInstanceName}`, 'POST', data);
  }

  // 📍 ENVIAR LOCALIZAÇÃO
  async sendLocation(instanceName: string, to: string, latitude: number, longitude: number, name?: string, address?: string): Promise<any> {
    const correctInstanceName = "whatsapp_36_lowfy";
    console.log(`📍 Enviando localização via ${correctInstanceName} para ${to}`);
    
    const data = {
      number: to.replace(/\D/g, ''),
      locationMessage: {
        latitude: latitude,
        longitude: longitude,
        name: name || '',
        address: address || ''
      }
    };

    return await this.makeRequest(`/message/sendLocation/${correctInstanceName}`, 'POST', data);
  }

  // 👤 ENVIAR CONTATO
  async sendContact(instanceName: string, to: string, contactData: any): Promise<any> {
    const correctInstanceName = "whatsapp_36_lowfy";
    console.log(`👤 Enviando contato via ${correctInstanceName} para ${to}`);
    
    const data = {
      number: to.replace(/\D/g, ''),
      contactMessage: contactData
    };

    return await this.makeRequest(`/message/sendContact/${correctInstanceName}`, 'POST', data);
  }

  // 😀 ENVIAR REAÇÃO
  async sendReaction(instanceName: string, messageId: string, emoji: string): Promise<any> {
    const correctInstanceName = "whatsapp_36_lowfy";
    console.log(`😀 Enviando reação ${emoji} via ${correctInstanceName}`);
    
    const data = {
      reactionMessage: {
        key: { id: messageId },
        reaction: emoji
      }
    };

    return await this.makeRequest(`/message/sendReaction/${correctInstanceName}`, 'POST', data);
  }

  // 📊 ENVIAR ENQUETE
  async sendPoll(instanceName: string, to: string, question: string, options: string[], multipleAnswers: boolean = false): Promise<any> {
    const correctInstanceName = "whatsapp_36_lowfy";
    console.log(`📊 Enviando enquete via ${correctInstanceName} para ${to}`);
    
    const data = {
      number: to.replace(/\D/g, ''),
      pollMessage: {
        name: question,
        selectableOptionsCount: multipleAnswers ? options.length : 1,
        values: options
      }
    };

    return await this.makeRequest(`/message/sendPoll/${correctInstanceName}`, 'POST', data);
  }

  // 📋 ENVIAR LISTA
  async sendList(instanceName: string, to: string, listData: any): Promise<any> {
    const correctInstanceName = "whatsapp_36_lowfy";
    console.log(`📋 Enviando lista via ${correctInstanceName} para ${to}`);
    
    const data = {
      number: to.replace(/\D/g, ''),
      listMessage: listData
    };

    return await this.makeRequest(`/message/sendList/${correctInstanceName}`, 'POST', data);
  }

  // 📸 ENVIAR IMAGEM (compatibilidade)
  async sendImage(instanceName: string, to: string, imageData: string, caption?: string): Promise<any> {
    return await this.sendMedia(instanceName, to, imageData, 'image', caption);
  }

  // 📄 ENVIAR DOCUMENTO (compatibilidade)
  async sendDocument(instanceName: string, to: string, documentData: string, fileName: string): Promise<any> {
    return await this.sendMedia(instanceName, to, documentData, 'document', '', fileName);
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
      console.log(`📱 Forçando carregamento COMPLETO da instância ${correctInstanceName} - TODOS OS CONTATOS!`);
      
      let allChats: any[] = [];
      let page = 1;
      const limit = 75; // Limite máximo que a API aceita
      let hasMore = true;
      
      // Buscar página por página até esgotar TODOS os contatos
      while (hasMore && page <= 50) { // Máximo 50 páginas para evitar loop infinito
        console.log(`🔄 PÁGINA ${page}: Buscando ${limit} contatos (offset: ${(page-1) * limit})`);
        
        const response = await this.makeRequest(`/chat/findChats/${correctInstanceName}`, 'POST', {
          where: {},
          limit: limit,
          offset: (page - 1) * limit
        });
        
        if (response && Array.isArray(response) && response.length > 0) {
          // Evitar duplicatas usando remoteJid como chave única
          const newChats = response.filter(chat => 
            !allChats.some(existing => existing.remoteJid === chat.remoteJid)
          );
          allChats = allChats.concat(newChats);
          page++;
          
          console.log(`✅ PÁGINA ${page-1} processada: +${newChats.length} novos contatos (Total: ${allChats.length})`);
          
          // Se retornou menos que o limite, chegamos ao fim
          if (response.length < limit) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }
      
      console.log(`🎉 CARREGAMENTO COMPLETO! ${allChats.length} contatos únicos carregados (TODOS DISPONÍVEIS)`);
      return allChats;
    } catch (error) {
      console.log(`⚠️ Erro ao buscar chats:`, error);
      return [];
    }
  }

  async getChatMessages(instanceName: string, chatId: string, limit: number = 50): Promise<any> {
    try {
      // Extract phone number from chatId (remove @s.whatsapp.net or @c.us)
      const phoneNumber = chatId.replace('@s.whatsapp.net', '').replace('@c.us', '');
      
      console.log(`📱 Buscando mensagens do chat ${phoneNumber} (limit: ${limit})`);
      
      // Use the correct Evolution API endpoint for finding messages
      const correctInstanceName = "whatsapp_36_lowfy";
      const response = await this.makeRequest(`/chat/findMessages/${correctInstanceName}`, 'POST', {
        where: {
          key: {
            remoteJid: chatId
          }
        },
        limit: limit
      });
      
      console.log(`✅ Mensagens encontradas para ${phoneNumber}:`, response?.length || 0);
      
      return response || [];
    } catch (error) {
      console.log(`⚠️ Erro ao buscar mensagens do chat ${chatId}:`, error);
      // Retornar mensagens vazias em caso de erro para não quebrar o sistema
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

// 🔌 CONFIGURAR WEBSOCKET SEGUINDO DOCUMENTAÇÃO OFICIAL
evolutionAPI.setWebSocket = async function(instanceName: string): Promise<any> {
  try {
    const realInstanceName = "whatsapp_36_lowfy";
    console.log(`🔌 Configurando WebSocket para ${realInstanceName}`);
    
    const response = await this.makeRequest(`/websocket/set/${realInstanceName}`, 'POST', {
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
    
    console.log(`✅ WebSocket Evolution API configurado:`, response);
    return response;
  } catch (error) {
    console.error(`❌ Erro ao configurar WebSocket:`, error);
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