import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, RefreshCw, Smartphone, Wifi, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { Link } from "wouter";

interface ConnectionData {
  id: number;
  name: string;
  status: string;
  qrCode?: string;
  qrExpiry?: string;
  phoneNumber?: string;
}

export default function QRConnectionPage() {
  const [match, params] = useRoute("/qr/:id");
  const [connection, setConnection] = useState<ConnectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const [progress, setProgress] = useState(100);

  const connectionId = params?.id;

  // Buscar dados da conexão
  useEffect(() => {
    if (!connectionId) return;

    const fetchConnection = async () => {
      try {
        setLoading(true);
        
        // Buscar dados da conexão
        const connectionResponse = await fetch(`/api/connections/${connectionId}`);
        const connectionData = await connectionResponse.json();
        
        // Buscar QR Code
        const qrResponse = await fetch(`/api/connections/${connectionId}/qr`);
        const qrData = await qrResponse.json();
        
        setConnection({
          ...connectionData,
          qrCode: qrData.qrCode,
          qrExpiry: qrData.expiration
        });
        
      } catch (error) {
        console.error('Erro ao buscar conexão:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConnection();
  }, [connectionId]);

  // Timer para expiração do QR Code
  useEffect(() => {
    if (!connection?.qrExpiry) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(connection.qrExpiry!).getTime();
      const timeLeft = Math.max(0, expiry - now);
      
      setTimeLeft(timeLeft);
      setProgress((timeLeft / (3 * 60 * 1000)) * 100); // 3 minutos
      
      if (timeLeft <= 0) {
        // QR Code expirou, recarregar
        window.location.reload();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [connection?.qrExpiry]);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'connected':
        return {
          color: 'bg-green-500',
          text: 'Conectado',
          icon: CheckCircle,
          description: 'WhatsApp conectado com sucesso!'
        };
      case 'waiting_qr':
        return {
          color: 'bg-orange-500',
          text: 'Aguardando Conexão',
          icon: Clock,
          description: 'Escaneie o QR Code com seu WhatsApp'
        };
      case 'disconnected':
        return {
          color: 'bg-red-500',
          text: 'Desconectado',
          icon: AlertCircle,
          description: 'Conexão perdida'
        };
      default:
        return {
          color: 'bg-gray-500',
          text: 'Desconhecido',
          icon: AlertCircle,
          description: 'Status não identificado'
        };
    }
  };

  const refreshQR = async () => {
    if (!connectionId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/connections/${connectionId}/qr`, {
        method: 'POST'
      });
      const qrData = await response.json();
      
      setConnection(prev => prev ? {
        ...prev,
        qrCode: qrData.qrCode,
        qrExpiry: qrData.expiration
      } : null);
    } catch (error) {
      console.error('Erro ao atualizar QR Code:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando conexão...</p>
        </div>
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle>Conexão não encontrada</CardTitle>
            <CardDescription>
              A conexão solicitada não foi encontrada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusInfo = getStatusInfo(connection.status);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Conectar WhatsApp</h1>
                <p className="text-gray-600">Conexão: {connection.name}</p>
              </div>
            </div>
            <Badge className={`${statusInfo.color} text-white`}>
              <StatusIcon className="h-4 w-4 mr-1" />
              {statusInfo.text}
            </Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* QR Code Card */}
          <Card className="bg-white shadow-xl border-0 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">QR Code WhatsApp</CardTitle>
                  <CardDescription className="text-orange-100">
                    Escaneie com seu celular
                  </CardDescription>
                </div>
                <Smartphone className="h-8 w-8" />
              </div>
            </CardHeader>
            
            <CardContent className="p-8">
              {connection.status === 'connected' ? (
                <div className="text-center">
                  <CheckCircle className="h-24 w-24 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-green-700 mb-2">
                    WhatsApp Conectado!
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Sua conexão está ativa e funcionando.
                  </p>
                  {connection.phoneNumber && (
                    <p className="text-sm text-gray-500">
                      Número: {connection.phoneNumber}
                    </p>
                  )}
                </div>
              ) : connection.qrCode ? (
                <div className="text-center">
                  {/* QR Code Image */}
                  <div className="bg-white p-4 rounded-lg border-2 border-orange-200 inline-block mb-4">
                    <img 
                      src={connection.qrCode} 
                      alt="QR Code WhatsApp"
                      className="w-64 h-64 mx-auto"
                    />
                  </div>
                  
                  {/* Timer */}
                  {timeLeft > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                        <span>Tempo restante:</span>
                        <span className="font-mono font-semibold">{formatTime(timeLeft)}</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  )}
                  
                  {/* Refresh Button */}
                  <Button 
                    onClick={refreshQR}
                    variant="outline"
                    className="w-full"
                    disabled={loading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar QR Code
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <AlertCircle className="h-24 w-24 text-orange-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    QR Code não disponível
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Clique em atualizar para gerar um novo QR Code.
                  </p>
                  <Button onClick={refreshQR} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Gerar QR Code
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Instructions Card */}
          <Card className="bg-white shadow-xl border-0">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
              <CardTitle className="text-xl">Como conectar</CardTitle>
              <CardDescription className="text-blue-100">
                Siga os passos abaixo
              </CardDescription>
            </CardHeader>
            
            <CardContent className="p-6">
              <div className="space-y-6">
                <div className="flex items-start space-x-3">
                  <div className="bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Abra o WhatsApp</h4>
                    <p className="text-gray-600 text-sm">
                      No seu celular, abra o aplicativo WhatsApp
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Acesse as configurações</h4>
                    <p className="text-gray-600 text-sm">
                      Toque nos três pontos (⋮) e selecione "Aparelhos conectados"
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Conectar dispositivo</h4>
                    <p className="text-gray-600 text-sm">
                      Toque em "Conectar um dispositivo" e depois em "OK, entendi"
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Escaneie o QR Code</h4>
                    <p className="text-gray-600 text-sm">
                      Aponte a câmera para o QR Code ao lado e aguarde a conexão
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-2">
                  <Wifi className="h-5 w-5 text-blue-500" />
                  <h5 className="font-semibold text-blue-900">Dica importante</h5>
                </div>
                <p className="text-blue-700 text-sm mt-2">
                  Certifique-se de que seu celular está conectado à internet. 
                  O QR Code expira em 3 minutos por questões de segurança.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}