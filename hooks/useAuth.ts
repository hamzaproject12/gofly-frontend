import { useState, useEffect } from 'react';

interface User {
  agentId: number;
  email: string;
  nom: string;
  role: 'ADMIN' | 'AGENT' | 'SUPER_ADMIN';
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    
    if (token) {
      try {
        // Décoder le JWT token pour extraire les informations utilisateur
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({
          agentId: payload.agentId,
          email: payload.email,
          nom: payload.nom,
          role: payload.role
        });
      } catch (error) {
        console.error('Erreur lors du décodage du token:', error);
        localStorage.removeItem('authToken');
      }
    }
    
    setLoading(false);
  }, []);

  const isAdmin = user?.role === 'ADMIN';
  const isAgent = user?.role === 'AGENT';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return {
    user,
    loading,
    isAdmin,
    isAgent,
    isSuperAdmin,
    isAuthenticated: !!user
  };
}
