
import { MessageSquare, Plug, Settings, BarChart3, Plus, Contact, Users } from "lucide-react";
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
    { id: "contacts-management", label: "Gerenciar Contatos", icon: Users },
    { id: "settings", label: "Configurações", icon: Settings },
  ];

  return (
    <div className="w-60 h-full glass-panel border-r border-white/20 flex flex-col flex-shrink-0 animate-slide-right">
      {/* Header Sofisticado */}
      <div className="p-6 border-b border-white/20 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg animate-scale-in">
            <MessageSquare className="text-white text-xl" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gradient-green">WhatsApp Hub</h1>
            <p className="text-xs text-slate-600">Sistema Inteligente</p>
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
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 interactive-element ${
                  isActive
                    ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg"
                    : "text-slate-700 hover:bg-white/50 hover:text-green-600"
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
      <div className="p-6 border-t border-white/20 flex-shrink-0">
        <Button 
          onClick={onNewConnection}
          className="w-full button-primary flex items-center justify-center space-x-3 py-3 text-sm font-semibold"
        >
          <Plus className="w-5 h-5" />
          <span>Nova Conexão</span>
        </Button>
      </div>
    </div>
  );
}
