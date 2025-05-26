import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import ConnectionCard from "@/components/connection-card";
import MessageInterface from "@/components/message-interface";
import NewConnectionModal from "@/components/new-connection-modal";
import QRCodeModal from "@/components/qr-code-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, MessageSquare, Clock, Zap } from "lucide-react";
import { useWebSocket } from "@/lib/websocket";
import { useToast } from "@/hooks/use-toast";
import type { Connection } from "@shared/schema";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedConnection, setSelectedConnection] = useState<number | null>(null);
  const [showNewConnectionModal, setShowNewConnectionModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrData, setQrData] = useState<{ connectionId: number; qrCode: string; expiration: Date } | null>(null);
  const { toast } = useToast();

  // Real-time WebSocket connection
  useWebSocket({
    onQRCodeReceived: (data) => {
      setQrData(data);
      setShowQRModal(true);
    },
    onConnectionStatusChanged: (data) => {
      // Refetch connections when status changes
      refetchConnections();
      
      // Check if connection was established successfully
      if (data.status === 'connected' || data.status === 'open') {
        // Close QR modal if it's open for this connection
        if (qrData && qrData.connectionId === data.id) {
          setShowQRModal(false);
          setQrData(null);
        }
        
        // Show success notification
        toast({
          title: "WhatsApp Conectado!",
          description: `Conexão estabelecida com sucesso.`,
          variant: "default",
        });
      }
    },
  });

  // Fetch connections
  const { data: connections = [], refetch: refetchConnections } = useQuery<Connection[]>({
    queryKey: ["/api/connections"],
  });

  // Fetch dashboard stats
  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
  });

  const formatLastActivity = (date: Date | null) => {
    if (!date) return "Nunca";
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) return "Agora";
    if (minutes < 60) return `${minutes} min atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    return `${days}d atrás`;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total de Conexões</p>
                      <p className="text-3xl font-bold text-gray-900">{stats?.totalConnections || 0}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Zap className="text-primary text-xl" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Conexões Ativas</p>
                      <p className="text-3xl font-bold text-secondary">{stats?.activeConnections || 0}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="text-secondary text-xl" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Mensagens Hoje</p>
                      <p className="text-3xl font-bold text-gray-900">{stats?.todayMessages || 0}</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                      <MessageSquare className="text-warning text-xl" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Última Atividade</p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatLastActivity(stats?.lastActivity)}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Clock className="text-purple-600 text-xl" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Conexões Recentes</h3>
                <div className="space-y-4">
                  {connections.slice(0, 5).map((connection) => (
                    <div key={connection.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        connection.status === 'connected' ? 'bg-secondary' : 
                        connection.status === 'qr_pending' ? 'bg-warning' : 'bg-gray-400'
                      }`}>
                        <MessageSquare className="text-white text-sm" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{connection.name}</p>
                        <p className="text-sm text-gray-500">
                          Status: {connection.status === 'connected' ? 'Conectado' : 
                                  connection.status === 'qr_pending' ? 'Aguardando QR' : 'Desconectado'}
                        </p>
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatLastActivity(connection.lastActivity)}
                      </div>
                    </div>
                  ))}
                  {connections.length === 0 && (
                    <p className="text-gray-500 text-center py-8">Nenhuma conexão encontrada</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "connections":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Gerenciar Conexões</h3>
              <Button 
                onClick={() => setShowNewConnectionModal(true)}
                className="flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Conexão</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {connections.map((connection) => (
                <ConnectionCard 
                  key={connection.id} 
                  connection={connection}
                  onShowQR={(conn) => {
                    if (conn.qrCode) {
                      setQrData({
                        connectionId: conn.id,
                        qrCode: conn.qrCode,
                        expiration: conn.qrExpiry || new Date()
                      });
                      setShowQRModal(true);
                    }
                  }}
                  onOpenMessages={(connId) => {
                    setSelectedConnection(connId);
                    setActiveTab("messages");
                  }}
                />
              ))}
              {connections.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma conexão</h3>
                  <p className="text-gray-500 mb-4">Crie sua primeira conexão WhatsApp para começar</p>
                  <Button onClick={() => setShowNewConnectionModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Conexão
                  </Button>
                </div>
              )}
            </div>
          </div>
        );

      case "messages":
        return (
          <MessageInterface 
            connections={connections.filter(c => c.status === 'connected')}
            selectedConnectionId={selectedConnection}
            onSelectConnection={setSelectedConnection}
          />
        );

      case "settings":
        return (
          <div className="max-w-4xl space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Configurações do Sistema</h3>
            
            <Card>
              <CardContent className="p-6">
                <h4 className="font-medium text-gray-900 mb-4">Configurações Gerais</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Sistema</label>
                    <input 
                      type="text" 
                      defaultValue="WhatsApp Hub" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Porta da API</label>
                    <input 
                      type="number" 
                      defaultValue="5000" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h4 className="font-medium text-gray-900 mb-4">Configurações do QR Code</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tempo de Expiração (segundos)</label>
                    <input 
                      type="number" 
                      defaultValue="60" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tentativas de Reconexão</label>
                    <input 
                      type="number" 
                      defaultValue="3" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        onNewConnection={() => setShowNewConnectionModal(true)}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-surface border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {activeTab === 'dashboard' && 'Dashboard'}
                {activeTab === 'connections' && 'Conexões'}
                {activeTab === 'messages' && 'Mensagens'}
                {activeTab === 'settings' && 'Configurações'}
              </h2>
              <p className="text-sm text-gray-500">
                {activeTab === 'dashboard' && 'Visão geral do sistema'}
                {activeTab === 'connections' && 'Gerenciar conexões WhatsApp'}
                {activeTab === 'messages' && 'Enviar e receber mensagens'}
                {activeTab === 'settings' && 'Configurações do sistema'}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600">Sistema Online</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          {renderTabContent()}
        </main>
      </div>

      {/* Modals */}
      <NewConnectionModal 
        open={showNewConnectionModal}
        onClose={() => setShowNewConnectionModal(false)}
        onSuccess={() => {
          setShowNewConnectionModal(false);
          refetchConnections();
        }}
      />

      <QRCodeModal 
        open={showQRModal}
        onClose={() => setShowQRModal(false)}
        qrData={qrData}
      />
    </div>
  );
}
