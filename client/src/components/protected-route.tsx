import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { clerk } from '@/lib/clerk';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  const session = clerk.getCurrentUser();

  useEffect(() => {
    if (session.isLoaded && !session.isSignedIn) {
      setLocation('/sign-in');
    }
  }, [session.isLoaded, session.isSignedIn, setLocation]);

  if (!session.isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!session.isSignedIn) {
    return null;
  }

  return <>{children}</>;
}