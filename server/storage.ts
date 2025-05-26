import { connections, messages, type Connection, type InsertConnection, type Message, type InsertMessage } from "@shared/schema";

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
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: number, updates: Partial<Message>): Promise<Message | undefined>;
  getTodayMessageCount(): Promise<number>;
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
  }

  // Connection methods
  async getConnection(id: number): Promise<Connection | undefined> {
    return this.connections.get(id);
  }

  async getConnectionByName(name: string): Promise<Connection | undefined> {
    return Array.from(this.connections.values()).find(
      (connection) => connection.name === name,
    );
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
      sessionData: null,
      qrCode: null,
      qrExpiration: null,
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
    
    const updatedConnection = { ...connection, ...updates };
    this.connections.set(id, updatedConnection);
    return updatedConnection;
  }

  async deleteConnection(id: number): Promise<boolean> {
    return this.connections.delete(id);
  }

  // Message methods
  async getMessage(id: number): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async getMessagesByConnection(connectionId: number, limit: number = 50): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.connectionId === connectionId)
      .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
      .slice(0, limit);
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
      connection.lastActivity = new Date();
    }
    
    return message;
  }

  async updateMessage(id: number, updates: Partial<Message>): Promise<Message | undefined> {
    const message = this.messages.get(id);
    if (!message) return undefined;
    
    const updatedMessage = { ...message, ...updates };
    this.messages.set(id, updatedMessage);
    return updatedMessage;
  }

  async getTodayMessageCount(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return Array.from(this.messages.values())
      .filter(message => {
        const messageDate = message.timestamp || new Date(0);
        return messageDate >= today;
      }).length;
  }
}

export const storage = new MemStorage();
