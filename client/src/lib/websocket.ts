
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

interface UseWebSocketOptions {
  onQRCodeReceived?: (data: { connectionId: number; qrCode: string; expiration: Date }) => void;
  onConnectionStatusChanged?: (data: { id: number; status: string }) => void;
  onMessageReceived?: (data: any) => void;
  onMessageSent?: (data: any) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = () => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host || "localhost:5000";
      const wsUrl = `${protocol}//${host}/api/ws`;
      
      console.log(`🔌 Conectando WebSocket em: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log("WebSocket message received:", message);

          switch (message.type) {
            case "connected":
              // Just acknowledge connection, don't treat as unknown
              break;
              
            case "qrCodeReceived":
              console.log("QR Code received:", message.data);
              options.onQRCodeReceived?.(message.data);
              break;
              
            case "connectionStatusChanged":
              options.onConnectionStatusChanged?.(message.data);
              // Invalidate connections cache to refresh status
              queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
              queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
              break;
              
            case "messageReceived":
              console.log("📨 Nova mensagem recebida:", message.data);
              options.onMessageReceived?.(message.data);
              // Invalidate both messages and conversations for the specific connection
              queryClient.invalidateQueries({ 
                queryKey: ["/api/connections", message.data.connectionId, "conversations"] 
              });
              queryClient.invalidateQueries({ 
                queryKey: ["/api/connections", message.data.connectionId, "messages"] 
              });
              queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
              break;
              
            case "messageSent":
              console.log("📤 Mensagem enviada:", message.data);
              options.onMessageSent?.(message.data);
              // Invalidate both messages and conversations for the specific connection
              queryClient.invalidateQueries({ 
                queryKey: ["/api/connections", message.data.connectionId, "conversations"] 
              });
              queryClient.invalidateQueries({ 
                queryKey: ["/api/connections", message.data.connectionId, "messages"] 
              });
              queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
              break;
              
            case "connectionCreated":
            case "connectionDeleted":
              queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
              queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
              break;
              
            default:
              console.log("Unknown WebSocket message type:", message.type);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        wsRef.current = null;
        
        // Attempt to reconnect
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`Attempting to reconnect in ${delay}ms...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else {
          console.error("Max reconnection attempts reached");
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

    } catch (error) {
      console.error("Error creating WebSocket connection:", error);
    }
  };

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const sendMessage = (type: string, data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data, timestamp: new Date().toISOString() }));
    } else {
      console.warn("WebSocket is not connected");
    }
  };

  return {
    sendMessage,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
}
