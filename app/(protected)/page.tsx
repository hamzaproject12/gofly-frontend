'use client';

import { useState, useEffect } from 'react';

interface Agent {
  id: number;
  nom: string;
  email: string;
  isActive: boolean;
  createdAt: string;
}

export default function HomePage() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/auth/profile', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setAgent(data.agent);
      }
    } catch (error) {
      console.error('Erreur de récupération du profil:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                Bienvenue sur GoodFly
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                Système de gestion des voyages Omra
              </p>
              
              {agent && (
                <div className="bg-white rounded-lg shadow p-6 max-w-md mx-auto">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Informations du compte
                  </h2>
                  <div className="space-y-2">
                    <p><span className="font-medium">Nom:</span> {agent.nom}</p>
                    <p><span className="font-medium">Email:</span> {agent.email}</p>
                    <p><span className="font-medium">Statut:</span> 
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                        agent.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {agent.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </p>
                    <p><span className="font-medium">Membre depuis:</span> {new Date(agent.createdAt).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
