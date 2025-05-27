import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LogOut, Settings, User } from 'lucide-react';
import { clerk } from '@/lib/clerk';

export function UserHeader() {
  const session = clerk.getCurrentUser();

  if (!session.isSignedIn || !session.user) {
    return null;
  }

  const { user } = session;
  const displayName = user.firstName && user.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user.firstName || user.emailAddress;

  const initials = user.firstName && user.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user.firstName 
    ? user.firstName[0]
    : user.emailAddress[0];

  const handleLogout = async () => {
    await clerk.signOut();
  };

  return (
    <div className="flex items-center justify-between p-6 glass-panel border-b border-white/20 shadow-lg">
      <div className="flex items-center space-x-4">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg">
          <User className="h-6 w-6 text-white" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-gradient-green">{displayName}</h2>
          <p className="text-sm text-slate-600">{user.emailAddress}</p>
        </div>
        {user.emailAddress?.includes('admin') && (
          <span className="badge-success">
            Super Admin
          </span>
        )}
      </div>

      <Button
        onClick={handleLogout}
        variant="outline"
        size="sm"
        className="btn-secondary"
      >
        <LogOut className="h-4 w-4 mr-2" />
        Sair
      </Button>
    </div>
  );
}