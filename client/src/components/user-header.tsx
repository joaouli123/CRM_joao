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
    <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center space-x-3">
        <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
          <User className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800">{user.name}</h2>
          <p className="text-sm text-gray-600">{user.email}</p>
        </div>
        {user.role === 'superadmin' && (
          <span className="bg-orange-100 text-orange-800 border-orange-300 px-3 py-1 font-medium">
            Super Admin
          </span>
        )}
      </div>

      <Button
        onClick={handleLogout}
        variant="outline"
        size="sm"
        className="text-gray-600 hover:text-gray-800 border-gray-300 hover:bg-gray-50"
      >
        <LogOut className="h-4 w-4 mr-2" />
        Sair
      </Button>
    </div>
  );
}