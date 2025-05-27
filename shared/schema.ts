import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Tabela de usuários com sistema de permissões
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: text("role").notNull().default("user"), // user, superadmin
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  lastLogin: timestamp("last_login"),
});

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

// Tabela de contatos com todas as funcionalidades solicitadas
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").notNull(),
  name: text("name").notNull(),
  phoneNumber: text("phone_number").notNull(),
  email: text("email"),
  observation: text("observation"),
  tag: text("tag"),
  origem: text("origem").default("whatsapp"), // whatsapp, site, organico, indicacao, publicidade, outros
  profilePictureUrl: text("profile_picture_url"),
  isActive: boolean("is_active").notNull().default(true),
  // isWhatsAppOriginal: boolean("is_whatsapp_original").notNull().default(false), // true = dados protegidos do WhatsApp
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Schemas para validação
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

// Schemas para contatos
export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateContactSchema = createInsertSchema(contacts).omit({
  id: true,
  connectionId: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export const sendMessageSchema = z.object({
  connectionId: z.number(),
  to: z.string().min(1),
  message: z.string().min(1),
});

// Schemas para usuários
export const insertUserSchema = createInsertSchema(users).pick({
  clerkId: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
});

export const updateUserSchema = createInsertSchema(users).pick({
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
}).partial();

// Tipos
export type InsertConnection = z.infer<typeof insertConnectionSchema>;
export type Connection = typeof connections.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UpdateUser = z.infer<typeof updateUserSchema>;

// Enums para roles
export const UserRole = {
  USER: 'user' as const,
  SUPERADMIN: 'superadmin' as const,
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type SendMessage = z.infer<typeof sendMessageSchema>;

// Tipos para contatos
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type UpdateContact = z.infer<typeof updateContactSchema>;

// Conversation type for organizing messages by contact/group
export interface Conversation {
  phoneNumber: string;
  contactName?: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  messageCount: number;
  profilePicture?: string | null;
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

export type InsertContactType = z.infer<typeof insertContactSchema>;
