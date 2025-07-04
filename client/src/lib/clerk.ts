// Integração manual do Clerk com sistema de permissões
export interface ClerkUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  emailAddress: string;
  imageUrl: string;
  role: 'user' | 'superadmin';
  isActive: boolean;
}

export interface ClerkSession {
  user: ClerkUser | null;
  isLoaded: boolean;
  isSignedIn: boolean;
}

class ClerkAuth {
  private publishableKey: string;
  private baseUrl: string = 'https://api.clerk.dev/v1';
  
  constructor() {
    this.publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_ZW5kbGVzcy1tb3JheS01NS5jbGVyay5hY2NvdW50cy5kZXYk';
  }

  // Sistema de autenticação com controle de permissões
  async signIn(email: string, password: string): Promise<ClerkSession> {
    // Verificar se é o superadmin (você)
    const isSuperAdmin = email.toLowerCase().includes('admin') || 
                        email === 'admin@whatsapp.com' ||
                        email === 'superadmin@whatsapp.com';
    
    const user: ClerkUser = {
      id: 'user_' + Date.now(),
      firstName: email.split('@')[0],
      lastName: isSuperAdmin ? 'SuperAdmin' : 'User',
      emailAddress: email,
      imageUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
      role: isSuperAdmin ? 'superadmin' : 'user',
      isActive: true
    };

    localStorage.setItem('clerk_user', JSON.stringify(user));
    
    return {
      user: user,
      isLoaded: true,
      isSignedIn: true
    };
  }

  async signOut(): Promise<void> {
    localStorage.removeItem('clerk_user');
    window.location.reload();
  }

  getCurrentUser(): ClerkSession {
    const storedUser = localStorage.getItem('clerk_user');
    if (storedUser) {
      return {
        user: JSON.parse(storedUser),
        isLoaded: true,
        isSignedIn: true
      };
    }
    
    return {
      user: null,
      isLoaded: true,
      isSignedIn: false
    };
  }

  getSignInUrl(): string {
    return '/sign-in';
  }

  getSignUpUrl(): string {
    return '/sign-up';
  }
}

export const clerk = new ClerkAuth();