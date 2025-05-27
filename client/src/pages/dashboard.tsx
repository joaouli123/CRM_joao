import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Sidebar from "@/components/sidebar";
import MessageInterface from "@/components/message-interface-final";
import { Connection, ConnectionStats } from "@/lib/api";
import { Plus, Wifi, WifiOff, Users, MessageSquare, Activity, Clock } from "lucide-react";
import { NewConnectionModal } from "@/components/modals/new-connection-modal";
import { QRCodeModal } from "@/components/modals/qr-code-modal";

type TabType = 'dashboard' | 'connections' | 'messages' | 'settings';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('messages');
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | null>(null);
  const [showNewConnectionModal, setShowNewConnectionModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedConnectionForQR, setSelectedConnectionForQR] = useState<Connection | null>(null);
  const queryClient = useQueryClient();

  // Buscar conexões
  const { data: connections = [], isLoading: connectionsLoading } = useQuery({
    queryKey: ['/api/connections'],
  });

  // Buscar estatísticas do dashboard
  const { data: stats } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    enabled: activeTab === 'dashboard',
  });

  // Selecionar primeira conexão automaticamente
  useEffect(() => {
    if (connections.length > 0 && !selectedConnectionId) {
      setSelectedConnectionId(connections[0].id);
    }
  }, [connections, selectedConnectionId]);

  // Mutation para excluir conexão
  const deleteConnectionMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/connections/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete connection');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      if (selectedConnectionId === deleteConnectionMutation.variables) {
        setSelectedConnectionId(null);
      }
    },
  });

  const handleShowQR = (connection: Connection) => {
    setSelectedConnectionForQR(connection);
    setShowQRModal(true);
  };

  const getStatusColor = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'disconnected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return <Wifi className="h-4 w-4" />;
      case 'connecting':
        return <Clock className="h-4 w-4" />;
      case 'disconnected':
        return <WifiOff className="h-4 w-4" />;
      default:
        return <WifiOff className="h-4 w-4" />;
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <div className="max-w-6xl space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Conexões</p>
                      <p className="text-2xl font-bold text-gray-900">{stats?.totalConnections || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Wifi className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Conectadas</p>
                      <p className="text-2xl font-bold text-gray-900">{stats?.connectedConnections || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <MessageSquare className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Mensagens</p>
                      <p className="text-2xl font-bold text-gray-900">{stats?.totalMessages || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Activity className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Hoje</p>
                      <p className="text-2xl font-bold text-gray-900">{stats?.todayMessages || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Conexões Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {connections.slice(0, 5).map((connection: Connection) => (
                    <div key={connection.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(connection.status)}`} />
                        <div>
                          <p className="font-medium">{connection.name}</p>
                          <p className="text-sm text-gray-500">{connection.phoneNumber}</p>
                        </div>
                      </div>
                      <Badge variant={connection.status === 'connected' ? 'default' : 'secondary'}>
                        {connection.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "connections":
        return (
          <div className="max-w-6xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Gerenciar Conexões</h3>
              <Button onClick={() => setShowNewConnectionModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Conexão
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {connectionsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                connections.map((connection: Connection) => (
                  <Card key={connection.id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(connection.status)}`} />
                          <h4 className="font-medium">{connection.name}</h4>
                        </div>
                        <Badge 
                          variant={connection.status === 'connected' ? 'default' : 'secondary'}
                          className="flex items-center space-x-1"
                        >
                          {getStatusIcon(connection.status)}
                          <span>{connection.status}</span>
                        </Badge>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="text-sm">
                          <span className="text-gray-500">Telefone:</span>
                          <span className="ml-2 font-medium">{connection.phoneNumber || 'Não configurado'}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-500">Instância:</span>
                          <span className="ml-2 font-medium">{connection.instanceName}</span>
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        {connection.status === 'disconnected' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleShowQR(connection)}
                          >
                            Conectar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteConnectionMutation.mutate(connection.id)}
                          disabled={deleteConnectionMutation.isPending}
                        >
                          Excluir
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        );

      case "messages":
        return (
          <div className="h-full w-full">
            <MessageInterface
              connections={connections}
              selectedConnectionId={selectedConnectionId}
              onSelectConnection={setSelectedConnectionId}
            />
          </div>
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
                    <Input defaultValue="WhatsApp Hub" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Porta da API</label>
                    <Input type="number" defaultValue="5000" />
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <Button>Salvar Configurações</Button>
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
    <div className="h-screen w-screen flex overflow-hidden bg-gray-50">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        onNewConnection={() => setShowNewConnectionModal(true)}
      />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
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
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600">Sistema Online</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden p-6">
          {renderContent()}
        </main>
      </div>

      {/* Modals */}
      <NewConnectionModal
        isOpen={showNewConnectionModal}
        onClose={() => setShowNewConnectionModal(false)}
      />

      <QRCodeModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        connection={selectedConnectionForQR}
      />
    </div>
  );
}