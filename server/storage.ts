import { Connection, Message, InsertConnection, InsertMessage, connections, messages } from "@shared/schema";

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
}

import { db } from "./db";
import { eq, gte, sql, count } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
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
}

export const storage = new DatabaseStorage();