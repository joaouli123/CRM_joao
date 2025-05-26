import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const connections = pgTable("connections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  status: text("status").notNull().default("disconnected"), // connected, disconnected, connecting, waiting_qr
  phoneNumber: text("phone_number"),
  qrCode: text("qr_code"),
  qrExpiry: timestamp("qr_expiry"),
  sessionData: text("session_data"),
  lastActivity: timestamp("last_activity"),
  messageCount: integer("message_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").notNull(),
  from: text("from").notNull(),
  to: text("to").notNull(),
  body: text("body").notNull(),
  direction: text("direction").notNull(), // sent, received
  status: text("status").notNull().default("pending"), // pending, sent, delivered, read, failed
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertConnectionSchema = createInsertSchema(connections).pick({
  name: true,
  description: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  connectionId: true,
  from: true,
  to: true,
  body: true,
  direction: true,
});

export const sendMessageSchema = z.object({
  connectionId: z.number(),
  to: z.string().min(1),
  message: z.string().min(1),
});

export type InsertConnection = z.infer<typeof insertConnectionSchema>;
export type Connection = typeof connections.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type SendMessage = z.infer<typeof sendMessageSchema>;

// Conversation type for organizing messages by contact/group
export interface Conversation {
  phoneNumber: string;
  contactName?: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  messageCount: number;
}

// Tabela para arquivamento de conversas
export const archivedChats = pgTable("archived_chats", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").notNull(),
  chatId: text("chat_id").notNull(), // ID único da conversa
  phoneNumber: text("phone_number").notNull(),
  contactName: text("contact_name"),
  archiveDate: timestamp("archive_date").defaultNow().notNull(),
  archiveReason: text("archive_reason").default("User requested"),
  archivedBy: text("archived_by").notNull(),
  totalMessages: integer("total_messages").default(0),
  lastMessageDate: timestamp("last_message_date"),
  isArchived: boolean("is_archived").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Tabela para metadados de mensagens arquivadas
export const archivedMessages = pgTable("archived_messages", {
  id: serial("id").primaryKey(),
  archivedChatId: integer("archived_chat_id").notNull(),
  messageId: text("message_id").notNull(),
  content: text("content").notNull(),
  senderId: text("sender_id").notNull(),
  recipientId: text("recipient_id").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  direction: text("direction").notNull(), // 'sent' ou 'received'
  status: text("status").notNull(),
  messageType: text("message_type").default("text"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Schemas para inserção
export const insertArchivedChatSchema = createInsertSchema(archivedChats).pick({
  connectionId: true,
  chatId: true,
  phoneNumber: true,
  contactName: true,
  archiveReason: true,
  archivedBy: true,
  totalMessages: true,
  lastMessageDate: true
});

export const insertArchivedMessageSchema = createInsertSchema(archivedMessages).pick({
  archivedChatId: true,
  messageId: true,
  content: true,
  senderId: true,
  recipientId: true,
  timestamp: true,
  direction: true,
  status: true,
  messageType: true
});

// Tipos TypeScript
export type ArchivedChat = typeof archivedChats.$inferSelect;
export type InsertArchivedChat = z.infer<typeof insertArchivedChatSchema>;
export type ArchivedMessage = typeof archivedMessages.$inferSelect;
export type InsertArchivedMessage = z.infer<typeof insertArchivedMessageSchema>;
