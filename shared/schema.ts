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
