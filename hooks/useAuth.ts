import { useState, useEffect } from 'react';
import { auMoins, type AgentRole } from '@/lib/roles';

interface User {
  agentId: number;
  email: string;
  nom: string;
  role: AgentRole;
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

  // Les droits sont hiérarchiques : un gérant peut tout ce que peut un admin,
  // sinon le patron aurait moins d'accès que ses propres employés.
  const isAdmin = auMoins(user?.role, 'ADMIN');
  const isGerant = auMoins(user?.role, 'GERANT');
  const isAgent = user?.role === 'AGENT';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  /** Créer des comptes et réinitialiser les mots de passe : gérant et au-delà. */
  const peutGererUtilisateurs = isGerant;

  return {
    user,
    loading,
    isAdmin,
    isAgent,
    isGerant,
    isSuperAdmin,
    peutGererUtilisateurs,
    isAuthenticated: !!user
  };
}
