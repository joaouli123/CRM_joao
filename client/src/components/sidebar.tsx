import { MessageSquare, Plug, Settings, BarChart3, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onNewConnection: () => void;
}

export default function Sidebar({ activeTab, onTabChange, onNewConnection }: SidebarProps) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "connections", label: "Conexões", icon: Plug },
    { id: "messages", label: "Mensagens", icon: MessageSquare },
    { id: "settings", label: "Configurações", icon: Settings },
  ];

  return (
    <div className="w-60 h-full bg-surface border-r border-gray-200 flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <MessageSquare className="text-white text-lg" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">WhatsApp Hub</h1>
            <p className="text-xs text-gray-500">Sistema de Automação</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="p-4 flex-1 overflow-y-auto">
        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-primary"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-t border-gray-200 flex-shrink-0">
        <Button 
          onClick={onNewConnection}
          className="w-full bg-primary text-white hover:bg-blue-700 flex items-center justify-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Conexão</span>
        </Button>
      </div>
    </div>
  );
}