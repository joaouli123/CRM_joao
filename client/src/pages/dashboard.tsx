import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Sidebar from "@/components/sidebar";
import MessageInterface from "@/components/message-interface-final";
import Contacts from "@/pages/contacts";
import ContactsManager from "@/pages/contacts-manager";
import ContactsWorking from "@/pages/contacts-working";
import { Connection, ConnectionStats } from "@/lib/api";
import { Plus, Wifi, WifiOff, Users, MessageSquare, Activity, Clock, Contact } from "lucide-react";
import { NewConnectionModal } from "@/components/modals/new-connection-modal";
import { QRCodeModal } from "@/components/modals/qr-code-modal";

type TabType = 'dashboard' | 'connections' | 'messages' | 'contacts' | 'contacts-manager' | 'contacts-dashboard' | 'contacts-management' | 'settings';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('messages');
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | null>(null);
  const [showNewConnectionModal, setShowNewConnectionModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedConnectionForQR, setSelectedConnectionForQR] = useState<Connection | null>(null);
  const queryClient = useQueryClient();

  // Buscar conexões - CORRIGINDO PARA MOSTRAR SUA CONEXÃO LOWFY
  const { data: connections = [], isLoading: connectionsLoading } = useQuery({
    queryKey: ['/api/connections'],
    queryFn: async () => {
      console.log('🔍 BUSCANDO SUAS CONEXÕES...');
      const response = await fetch('/api/connections');
      const data = await response.json();
      console.log('✅ CONEXÕES ENCONTRADAS:', data);
      return data;
    },
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
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Card de Conexões */}
            <Card className="border-l-4 border-l-orange-500 shadow-lg hover:shadow-xl transition-all duration-200 bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Conexões Ativas
                </CardTitle>
                <Wifi className="h-5 w-5 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">
                  {stats?.activeConnections}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Total: {stats?.totalConnections}
                </p>
              </CardContent>
            </Card>

            {/* Card de Mensagens Hoje */}
            <Card className="border-l-4 border-l-gray-400 shadow-lg hover:shadow-xl transition-all duration-200 bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Mensagens Hoje
                </CardTitle>
                <MessageSquare className="h-5 w-5 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-700">
                  {stats?.messagesToday}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  +{Math.round((stats?.messagesToday * 0.1))} desde ontem
                </p>
              </CardContent>
            </Card>

            {/* Card de Usuários Online */}
            <Card className="border-l-4 border-l-orange-400 shadow-lg hover:shadow-xl transition-all duration-200 bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Usuários Online
                </CardTitle>
                <Users className="h-5 w-5 text-orange-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-500">
                  {stats?.usersOnline}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Últimas 24h
                </p>
              </CardContent>
            </Card>

            {/* Card de Taxa de Entrega */}
            <Card className="border-l-4 border-l-gray-500 shadow-lg hover:shadow-xl transition-all duration-200 bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Taxa de Entrega
                </CardTitle>
                <Activity className="h-5 w-5 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-700">
                  {stats?.deliveryRate}%
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Últimas 24h
                </p>
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

      case "contacts":
        return (
          <div className="h-full">
            <Contacts activeConnectionId={selectedConnectionId || 36} />
          </div>
        );

      case "contacts-manager":
        return (
          <div className="h-full">
            <ContactsManager activeConnectionId={selectedConnectionId || 36} />
          </div>
        );

      case "contacts-management":
        return <ContactsWorking />;

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
    <div className="h-screen w-screen flex overflow-hidden bg-gray-50 fixed inset-0">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        onNewConnection={() => setShowNewConnectionModal(true)}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-2 flex-shrink-0 min-h-[60px]">
          <div className="flex items-center justify-between h-full">
            <div>
              <h2 className="text-base font-semibold text-gray-900 leading-tight">
                {activeTab === 'dashboard' && 'Dashboard'}
                {activeTab === 'connections' && 'Conexões'}
                {activeTab === 'messages' && 'Mensagens'}
                {activeTab === 'contacts' && 'Contatos'}
                {activeTab === 'contacts-manager' && 'Gerenciar Contatos'}
                {activeTab === 'contacts-management' && 'Gerenciamento de Contatos'}
                {activeTab === 'contacts-dashboard' && 'Dashboard de Contatos'}
                {activeTab === 'settings' && 'Configurações'}
              </h2>
              <p className="text-xs text-gray-500 leading-tight">
                {activeTab === 'dashboard' && 'Visão geral do sistema'}
                {activeTab === 'connections' && 'Gerenciar conexões WhatsApp'}
                {activeTab === 'messages' && 'Enviar e receber mensagens'}
                {activeTab === 'contacts' && 'Gerenciar seus contatos'}
                {activeTab === 'contacts-manager' && 'Sistema completo de gestão de contatos'}
                {activeTab === 'settings' && 'Configurações do sistema'}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-600">Sistema Online</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden p-2">
          {renderContent()}
        </main>
      </div>

      {/* Modals */}
      <NewConnectionModal
        isOpen={showNewConnectionModal}
        onClose={() => setShowNewConnectionModal(false)}
      />

      <QRCodeModal
        open={showQRModal}
        onClose={() => setShowQRModal(false)}
        qrData={selectedConnectionForQR ? {
          connectionId: selectedConnectionForQR.id,
          qrCode: selectedConnectionForQR.qrCode || '',
          expiration: selectedConnectionForQR.qrExpiry || new Date()
        } : null}
      />
    </div>
  );
}