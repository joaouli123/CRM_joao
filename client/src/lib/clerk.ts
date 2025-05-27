// Integração manual do Clerk
export interface ClerkUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  emailAddress: string;
  imageUrl: string;
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

  // Simular autenticação enquanto aguardamos instalação completa
  async signIn(email: string, password: string): Promise<ClerkSession> {
    // Por enquanto, vamos simular uma autenticação bem-sucedida
    // Quando o Clerk estiver totalmente integrado, isso será substituído
    const mockUser: ClerkUser = {
      id: 'user_' + Date.now(),
      firstName: email.split('@')[0],
      lastName: 'User',
      emailAddress: email,
      imageUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
    };

    localStorage.setItem('clerk_user', JSON.stringify(mockUser));
    
    return {
      user: mockUser,
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