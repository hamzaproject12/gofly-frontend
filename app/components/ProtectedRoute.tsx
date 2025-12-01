'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from "@/lib/api";

interface Agent {
  id: number;
  nom: string;
  email: string;
  role: 'ADMIN' | 'AGENT';
  isActive: boolean;
  createdAt: string;
}

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Pages qui ne nécessitent pas d'authentification
  const publicPages = ['/login', '/register'];
  const isPublicPage = publicPages.includes(pathname);

  useEffect(() => {
    if (isPublicPage) {
      setLoading(false);
      return;
    }
    checkAuthStatus();
  }, [isPublicPage]);

  const checkAuthStatus = async () => {
    try {
      const response = await api.request('/api/auth/profile');

      if (response.ok) {
        const data = await response.json();
        setAgent(data.agent);
      } else {
        // Token invalide ou expiré
        router.push('/login');
      }
    } catch (error) {
      console.error('Erreur de vérification auth:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  // Pour les pages publiques, afficher directement le contenu
  if (isPublicPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Vérification de l'authentification...</p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return null; // Le middleware redirigera vers /login
  }

  if (!agent.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Compte désactivé
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Votre compte a été désactivé. Contactez l'administrateur pour plus d'informations.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
