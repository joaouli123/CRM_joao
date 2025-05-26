import { Connection, Message, InsertConnection, InsertMessage, connections, messages, type Conversation, archivedChats, archivedMessages, type ArchivedChat, type InsertArchivedChat, type ArchivedMessage, type InsertArchivedMessage } from "@shared/schema";

export interface IStorage {
  // Connection methods
  getConnection(id: number): Promise<Connection | undefined>;
  getConnectionByName(name: string): Promise<Connection | undefined>;
  getAllConnections(): Promise<Connection[]>;
  createConnection(connection: InsertConnection): Promise<Connection>;
  updateConnection(id: number, updates: Partial<Connection>): Promise<Connection | undefined>;
  deleteConnection(id: number): Promise<boolean>;
  
  // Message methods
  getMessage(id: number): Promise<Message | undefined>;
  getMessagesByConnection(connectionId: number, limit?: number): Promise<Message[]>;
  getConversationsByConnection(connectionId: number): Promise<Conversation[]>;
  getMessagesByConversation(connectionId: number, phoneNumber: string, limit?: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: number, updates: Partial<Message>): Promise<Message | undefined>;
  getTodayMessageCount(): Promise<number>;
  
  // Archive methods
  getArchivedChatsByConnection(connectionId: number): Promise<ArchivedChat[]>;
  getArchivedChat(id: number): Promise<ArchivedChat | undefined>;
  createArchivedChat(archivedChat: InsertArchivedChat): Promise<ArchivedChat>;
  getArchivedMessagesByChat(archivedChatId: number, limit?: number): Promise<ArchivedMessage[]>;
  createArchivedMessage(archivedMessage: InsertArchivedMessage): Promise<ArchivedMessage>;
  unarchiveChat(id: number): Promise<boolean>;
  deleteArchivedChat(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private connections: Map<number, Connection>;
  private messages: Map<number, Message>;
  private currentConnectionId: number;
  private currentMessageId: number;

  constructor() {
    this.connections = new Map();
    this.messages = new Map();
    this.currentConnectionId = 1;
    this.currentMessageId = 1;
    
    // Adicionar algumas mensagens de exemplo para demonstração
    this.addSampleMessages();
  }

  private addSampleMessages() {
    // Criar mensagens de exemplo para as conexões existentes
    const sampleMessages = [
      {
        connectionId: 30,
        direction: "received" as const,
        from: "+5511999888777",
        to: "",
        body: "Olá! Gostaria de saber mais sobre seus produtos.",
        status: "delivered" as const,
        timestamp: new Date(Date.now() - 3600000) // 1 hora atrás
      },
      {
        connectionId: 30,
        direction: "sent" as const,
        from: "",
        to: "+5511999888777",
        body: "Olá! Claro, ficaremos felizes em ajudar. Que tipo de produto você procura?",
        status: "delivered" as const,
        timestamp: new Date(Date.now() - 3500000)
      },
      {
        connectionId: 30,
        direction: "received" as const,
        from: "+5511987654321",
        to: "",
        body: "Bom dia! Vocês fazem entrega na região central?",
        status: "delivered" as const,
        timestamp: new Date(Date.now() - 1800000) // 30 min atrás
      },
      {
        connectionId: 32,
        direction: "received" as const,
        from: "+5511123456789",
        to: "",
        body: "Oi! Quero fazer um pedido.",
        status: "delivered" as const,
        timestamp: new Date(Date.now() - 900000) // 15 min atrás
      }
    ];

    sampleMessages.forEach(msg => {
      const message: Message = {
        id: this.currentMessageId++,
        connectionId: msg.connectionId,
        direction: msg.direction,
        from: msg.from,
        to: msg.to,
        body: msg.body,
        status: msg.status,
        timestamp: msg.timestamp
      };
      this.messages.set(message.id, message);
    });
  }

  async getConnection(id: number): Promise<Connection | undefined> {
    return this.connections.get(id);
  }

  async getConnectionByName(name: string): Promise<Connection | undefined> {
    for (const connection of this.connections.values()) {
      if (connection.name === name) {
        return connection;
      }
    }
    return undefined;
  }

  async getAllConnections(): Promise<Connection[]> {
    return Array.from(this.connections.values());
  }

  async createConnection(insertConnection: InsertConnection): Promise<Connection> {
    const id = this.currentConnectionId++;
    const connection: Connection = {
      ...insertConnection,
      description: insertConnection.description || null,
      id,
      status: "disconnected",
      phoneNumber: null,
      qrCode: null,
      qrExpiry: null,
      sessionData: null,
      lastActivity: null,
      messageCount: 0,
      createdAt: new Date(),
    };
    this.connections.set(id, connection);
    return connection;
  }

  async updateConnection(id: number, updates: Partial<Connection>): Promise<Connection | undefined> {
    const connection = this.connections.get(id);
    if (!connection) return undefined;
    
    const updated = { ...connection, ...updates };
    this.connections.set(id, updated);
    return updated;
  }

  async deleteConnection(id: number): Promise<boolean> {
    return this.connections.delete(id);
  }

  async getMessage(id: number): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async getMessagesByConnection(connectionId: number, limit: number = 50): Promise<Message[]> {
    const allMessages = Array.from(this.messages.values())
      .filter(msg => msg.connectionId === connectionId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
    
    return allMessages;
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++;
    const message: Message = {
      ...insertMessage,
      id,
      status: "pending",
      timestamp: new Date(),
    };
    this.messages.set(id, message);
    
    // Update connection message count
    const connection = this.connections.get(insertMessage.connectionId);
    if (connection) {
      connection.messageCount = (connection.messageCount || 0) + 1;
      this.connections.set(connection.id, connection);
    }
    
    return message;
  }

  async updateMessage(id: number, updates: Partial<Message>): Promise<Message | undefined> {
    const message = this.messages.get(id);
    if (!message) return undefined;
    
    const updated = { ...message, ...updates };
    this.messages.set(id, updated);
    return updated;
  }

  async getTodayMessageCount(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return Array.from(this.messages.values()).filter(msg => {
      return msg.timestamp >= today;
    }).length;
  }

  async getConversationsByConnection(connectionId: number): Promise<Conversation[]> {
    const connectionMessages = Array.from(this.messages.values())
      .filter(msg => msg.connectionId === connectionId)
      .sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime());

    const conversationsMap = new Map<string, Conversation>();
    
    for (const message of connectionMessages) {
      const phoneNumber = message.direction === "received" ? message.from : message.to;
      if (!phoneNumber) continue;
      
      if (!conversationsMap.has(phoneNumber)) {
        conversationsMap.set(phoneNumber, {
          phoneNumber,
          contactName: phoneNumber,
          lastMessage: message.body,
          lastMessageTime: new Date(message.timestamp!),
          unreadCount: 0,
          messageCount: 1
        });
      } else {
        const conv = conversationsMap.get(phoneNumber)!;
        conv.messageCount++;
      }
    }

    return Array.from(conversationsMap.values())
      .sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());
  }

  async getMessagesByConversation(connectionId: number, phoneNumber: string, limit: number = 50): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(msg => msg.connectionId === connectionId && (msg.from === phoneNumber || msg.to === phoneNumber))
      .sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime())
      .slice(0, limit);
  }
}

import { db } from "./db";
import { eq, gte, sql, count, and, or, asc } from "drizzle-orm";
import { messages as messagesTable } from "@shared/schema";

export class DatabaseStorage implements IStorage {
  async getConversationsByConnection(connectionId: number): Promise<Conversation[]> {
    const messages = await db.select().from(messagesTable).where(eq(messagesTable.connectionId, connectionId));
    
    // Group by phone number
    const conversationMap = new Map<string, Conversation>();
    
    messages.forEach(msg => {
      // Determine phone number based on direction
      const phoneNumber = msg.direction === "sent" ? msg.to : msg.from;
      const content = msg.body || "Mensagem sem conteúdo";
      const timestamp = msg.timestamp || new Date();
      
      if (!conversationMap.has(phoneNumber)) {
        conversationMap.set(phoneNumber, {
          phoneNumber,
          contactName: undefined,
          lastMessage: content,
          lastMessageTime: timestamp,
          unreadCount: 0,
          messageCount: 1
        });
      } else {
        const conv = conversationMap.get(phoneNumber)!;
        conv.messageCount++;
        const msgTime = timestamp.getTime();
        const lastTime = conv.lastMessageTime.getTime();
        if (msgTime > lastTime) {
          conv.lastMessage = content;
          conv.lastMessageTime = timestamp;
        }
      }
    });
    
    return Array.from(conversationMap.values())
      .sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());
  }

  async getMessagesByConversation(connectionId: number, phoneNumber: string, limit: number = 50): Promise<Message[]> {
    const messages = await db.select().from(messagesTable)
      .where(
        and(
          eq(messagesTable.connectionId, connectionId),
          or(
            and(eq(messagesTable.direction, "sent"), eq(messagesTable.to, phoneNumber)),
            and(eq(messagesTable.direction, "received"), eq(messagesTable.from, phoneNumber))
          )
        )
      )
      .orderBy(asc(messagesTable.timestamp))
      .limit(limit);
    
    return messages.map(msg => ({
      id: msg.id,
      connectionId: msg.connectionId,
      direction: msg.direction as "sent" | "received",
      phoneNumber: msg.direction === "sent" ? msg.to : msg.from,
      content: msg.body,
      status: msg.status as "pending" | "sent" | "delivered" | "failed",
      timestamp: msg.timestamp || new Date()
    }));
  }
  async getConnection(id: number): Promise<Connection | undefined> {
    const [connection] = await db.select().from(connections).where(eq(connections.id, id));
    return connection || undefined;
  }

  async getConnectionByName(name: string): Promise<Connection | undefined> {
    const [connection] = await db.select().from(connections).where(eq(connections.name, name));
    return connection || undefined;
  }

  async getAllConnections(): Promise<Connection[]> {
    return await db.select().from(connections);
  }

  async createConnection(insertConnection: InsertConnection): Promise<Connection> {
    const [connection] = await db
      .insert(connections)
      .values(insertConnection)
      .returning();
    return connection;
  }

  async updateConnection(id: number, updates: Partial<Connection>): Promise<Connection | undefined> {
    const [connection] = await db
      .update(connections)
      .set(updates)
      .where(eq(connections.id, id))
      .returning();
    return connection || undefined;
  }

  async deleteConnection(id: number): Promise<boolean> {
    const result = await db.delete(connections).where(eq(connections.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getMessage(id: number): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message || undefined;
  }

  async getMessagesByConnection(connectionId: number, limit: number = 50): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.connectionId, connectionId))
      .orderBy(messages.timestamp)
      .limit(limit);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(insertMessage)
      .returning();
    return message;
  }

  async updateMessage(id: number, updates: Partial<Message>): Promise<Message | undefined> {
    const [message] = await db
      .update(messages)
      .set(updates)
      .where(eq(messages.id, id))
      .returning();
    return message || undefined;
  }

  async getTodayMessageCount(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(gte(messages.timestamp, today));
    
    return result[0]?.count || 0;
  }

  // Archive methods implementation
  async getArchivedChatsByConnection(connectionId: number): Promise<ArchivedChat[]> {
    return await db
      .select()
      .from(archivedChats)
      .where(eq(archivedChats.connectionId, connectionId))
      .orderBy(desc(archivedChats.archiveDate));
  }

  async getArchivedChat(id: number): Promise<ArchivedChat | undefined> {
    const [archivedChat] = await db
      .select()
      .from(archivedChats)
      .where(eq(archivedChats.id, id));
    return archivedChat || undefined;
  }

  async createArchivedChat(insertArchivedChat: InsertArchivedChat): Promise<ArchivedChat> {
    const [archivedChat] = await db
      .insert(archivedChats)
      .values(insertArchivedChat)
      .returning();
    return archivedChat;
  }

  async getArchivedMessagesByChat(archivedChatId: number, limit: number = 50): Promise<ArchivedMessage[]> {
    return await db
      .select()
      .from(archivedMessages)
      .where(eq(archivedMessages.archivedChatId, archivedChatId))
      .orderBy(desc(archivedMessages.timestamp))
      .limit(limit);
  }

  async createArchivedMessage(insertArchivedMessage: InsertArchivedMessage): Promise<ArchivedMessage> {
    const [archivedMessage] = await db
      .insert(archivedMessages)
      .values(insertArchivedMessage)
      .returning();
    return archivedMessage;
  }

  async unarchiveChat(id: number): Promise<boolean> {
    const result = await db
      .update(archivedChats)
      .set({ isArchived: false })
      .where(eq(archivedChats.id, id));
    return (result.rowCount || 0) > 0;
  }

  async deleteArchivedChat(id: number): Promise<boolean> {
    // First delete all archived messages
    await db
      .delete(archivedMessages)
      .where(eq(archivedMessages.archivedChatId, id));
    
    // Then delete the archived chat
    const result = await db
      .delete(archivedChats)
      .where(eq(archivedChats.id, id));
    return (result.rowCount || 0) > 0;
  }
}

// Use database storage for persistence
export const storage = new DatabaseStorage();