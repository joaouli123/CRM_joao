import { apiRequest } from "./queryClient";

export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  todayMessages: number;
  lastActivity: Date | null;
}

export interface Connection {
  id: number;
  name: string;
  description?: string;
  status: "connected" | "disconnected" | "connecting" | "waiting_qr";
  phoneNumber?: string;
  qrCode?: string;
  qrExpiry?: Date;
  messageCount: number;
  lastActivity?: Date;
  createdAt: Date;
}

export interface Message {
  id: number;
  connectionId: number;
  direction: "sent" | "received";
  phoneNumber: string;
  content: string;
  status: "pending" | "sent" | "delivered" | "failed";
  timestamp: Date;
}

export const api = {
  // Connection endpoints
  getConnections: (): Promise<Connection[]> =>
    fetch("/api/connections", { credentials: "include" }).then(res => res.json()),

  createConnection: (data: { name: string; description?: string }) =>
    apiRequest("POST", "/api/connections", data),

  startConnection: (id: number) =>
    apiRequest("POST", `/api/connections/${id}/start`),

  deleteConnection: (id: number) =>
    apiRequest("DELETE", `/api/connections/${id}`),

  sendMessage: (id: number, data: { phoneNumber: string; message: string }) =>
    apiRequest("POST", `/api/connections/${id}/send`, data),

  getMessages: (id: number, limit = 50): Promise<Message[]> =>
    fetch(`/api/connections/${id}/messages?limit=${limit}`, { credentials: "include" }).then(res => res.json()),

  // Stats endpoint
  getStats: (): Promise<ConnectionStats> =>
    fetch("/api/stats", { credentials: "include" }).then(res => res.json()),
};
