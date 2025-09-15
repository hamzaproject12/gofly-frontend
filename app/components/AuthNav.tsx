'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Agent {
  id: number;
  nom: string;
  email: string;
  role: 'ADMIN' | 'AGENT';
  isActive: boolean;
  createdAt: string;
}

export default function AuthNav() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showCommercialMenu, setShowCommercialMenu] = useState(false);
  const [showFinancesMenu, setShowFinancesMenu] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-menu')) {
        setShowCommercialMenu(false);
        setShowFinancesMenu(false);
        setShowAdminMenu(false);
        setShowProfile(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/profile', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setAgent(data.agent);
      }
    } catch (error) {
      console.error('Erreur de vérification auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      console.log('Déconnexion en cours...');
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      console.log('Réponse de déconnexion:', response.status, response.ok);

      if (response.ok) {
        console.log('Déconnexion réussie, redirection...');
        setAgent(null);
        setShowProfile(false);
        // Forcer la redirection
        window.location.href = '/login';
      } else {
        console.error('Erreur de déconnexion:', response.status);
        const errorData = await response.json();
        console.error('Détails de l\'erreur:', errorData);
      }
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
      // Même en cas d'erreur, on force la déconnexion côté client
      setAgent(null);
      setShowProfile(false);
      window.location.href = '/login';
    }
  };

  if (loading) {
    return (
      <nav className="bg-white/95 backdrop-blur-lg shadow-xl border-b border-blue-100 fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">GoodFly</h1>
            </div>
            <div className="flex items-center">
              <div className="animate-pulse bg-gray-200 h-8 w-24 rounded"></div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  if (!agent) {
    return (
      <nav className="bg-white/95 backdrop-blur-lg shadow-xl border-b border-blue-100 fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">GoodFly</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/login"
                className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Connexion
              </Link>
              <Link
                href="/register"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Inscription
              </Link>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-white/95 backdrop-blur-lg shadow-xl border-b border-blue-100 fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 flex items-center justify-center">
                <img src="/logo-gofly.png" alt="Logo GoFly" className="h-10 w-10 object-contain rounded-xl" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-700 to-blue-900 bg-clip-text text-transparent">
                  GoFly
                </h1>
                <p className="text-xs text-gray-500">Gestion Omra</p>
              </div>
            </div>
          </div>

          {/* Navigation links for authenticated users */}
          <div className="hidden md:flex items-center space-x-1">
            {/* Dashboard - Direct link */}
            <Link href="/">
              <button className="font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-all rounded-xl px-4 py-2 flex items-center">
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
                </svg>
                Dashboard
              </button>
            </Link>

            {/* Opérations Dropdown */}
            <div className="relative dropdown-menu">
              <button
                onClick={() => {
                  setShowCommercialMenu(!showCommercialMenu);
                  setShowFinancesMenu(false);
                  setShowAdminMenu(false);
                }}
                className="font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-all rounded-xl px-4 py-2 flex items-center"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Opérations
                <svg className="ml-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              {showCommercialMenu && (
                <div className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 dropdown-menu">
                  <Link
                    href="/reservations/nouvelle"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    onClick={() => setShowCommercialMenu(false)}
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Nouvelle Réservation
                  </Link>
                  <Link
                    href="/reservations"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    onClick={() => setShowCommercialMenu(false)}
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Réservations
                  </Link>
                  <Link
                    href="/programmes"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    onClick={() => setShowCommercialMenu(false)}
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Programmes
                  </Link>
                  <Link
                    href="/hotels"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    onClick={() => setShowCommercialMenu(false)}
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Hôtels
                  </Link>
                </div>
              )}
            </div>

            {/* Finances Dropdown */}
            <div className="relative dropdown-menu">
              <button
                onClick={() => {
                  setShowFinancesMenu(!showFinancesMenu);
                  setShowCommercialMenu(false);
                  setShowAdminMenu(false);
                }}
                className="font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-all rounded-xl px-4 py-2 flex items-center"
              >
                <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
                Finances
                <svg className="ml-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              {showFinancesMenu && (
                <div className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 dropdown-menu">
                  <Link
                    href="/depenses"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    onClick={() => setShowFinancesMenu(false)}
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Dépenses
                  </Link>
                  <Link
                    href="/paiements"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    onClick={() => setShowFinancesMenu(false)}
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Paiements
                  </Link>
                  {/* Admin only - Solde Caisse */}
                  {agent.role === 'ADMIN' && (
                    <Link
                      href="/solde"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      onClick={() => setShowFinancesMenu(false)}
                    >
                      <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Solde Caisse
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Admin Dropdown - Admin only */}
            {agent.role === 'ADMIN' && (
              <div className="relative dropdown-menu">
                <button
                  onClick={() => {
                    setShowAdminMenu(!showAdminMenu);
                    setShowCommercialMenu(false);
                    setShowFinancesMenu(false);
                  }}
                  className="font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-all rounded-xl px-4 py-2 flex items-center"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Administration
                  <svg className="ml-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                {showAdminMenu && (
                  <div className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 dropdown-menu">
                    <Link
                      href="/admin/utilisateurs"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      onClick={() => setShowAdminMenu(false)}
                    >
                      <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                      Gestion Utilisateurs
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 p-2 rounded-xl"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>

            {/* Role Indicator */}
            <div className="flex items-center space-x-2">
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                agent.role === 'ADMIN' 
                  ? 'bg-red-100 text-red-700 border border-red-200' 
                  : 'bg-blue-100 text-blue-700 border border-blue-200'
              }`}>
                {agent.role === 'ADMIN' ? 'ADMINISTRATEUR' : 'AGENT'}
              </div>
            </div>

            {/* Profile Dropdown */}
            <div className="relative dropdown-menu">
              <button
                onClick={() => setShowProfile(!showProfile)}
                className="flex items-center text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 p-2 hover:bg-blue-50 transition-all"
              >
                <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-600 to-blue-800 flex items-center justify-center">
                  <span className="text-white font-medium text-sm">
                    {agent.nom.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="ml-2 text-gray-700 hidden sm:block font-medium">{agent.nom}</span>
                <svg className="ml-1 h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {showProfile && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg py-2 z-50 dropdown-menu">
                  <div className="px-4 py-3 text-sm text-gray-700 border-b border-gray-100">
                    <div className="font-medium text-gray-900">{agent.nom}</div>
                    <div className="text-gray-500 text-xs">{agent.email}</div>
                    <div className="text-xs text-blue-600 font-medium mt-1">
                      {agent.role === 'ADMIN' ? 'Administrateur' : 'Agent'}
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <svg className="h-4 w-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {showMobileMenu && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-gray-50 border-t">
            {/* Dashboard */}
            <Link
              href="/"
              className="text-gray-700 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium"
              onClick={() => setShowMobileMenu(false)}
            >
              Dashboard
            </Link>

            {/* Opérations Section */}
            <div className="border-t border-gray-200 pt-2">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Opérations
              </div>
              <Link
                href="/reservations/nouvelle"
                className="text-gray-700 hover:text-gray-900 block px-6 py-2 rounded-md text-base font-medium"
                onClick={() => setShowMobileMenu(false)}
              >
                Nouvelle Réservation
              </Link>
              <Link
                href="/reservations"
                className="text-gray-700 hover:text-gray-900 block px-6 py-2 rounded-md text-base font-medium"
                onClick={() => setShowMobileMenu(false)}
              >
                Réservations
              </Link>
              <Link
                href="/programmes"
                className="text-gray-700 hover:text-gray-900 block px-6 py-2 rounded-md text-base font-medium"
                onClick={() => setShowMobileMenu(false)}
              >
                Programmes
              </Link>
              <Link
                href="/hotels"
                className="text-gray-700 hover:text-gray-900 block px-6 py-2 rounded-md text-base font-medium"
                onClick={() => setShowMobileMenu(false)}
              >
                Hôtels
              </Link>
            </div>

            {/* Finances Section */}
            <div className="border-t border-gray-200 pt-2">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Finances
              </div>
              <Link
                href="/depenses"
                className="text-gray-700 hover:text-gray-900 block px-6 py-2 rounded-md text-base font-medium"
                onClick={() => setShowMobileMenu(false)}
              >
                Dépenses
              </Link>
              <Link
                href="/paiements"
                className="text-gray-700 hover:text-gray-900 block px-6 py-2 rounded-md text-base font-medium"
                onClick={() => setShowMobileMenu(false)}
              >
                Paiements
              </Link>
              {/* Admin only - Solde Caisse */}
              {agent.role === 'ADMIN' && (
                <Link
                  href="/solde"
                  className="text-gray-700 hover:text-gray-900 block px-6 py-2 rounded-md text-base font-medium"
                  onClick={() => setShowMobileMenu(false)}
                >
                  Solde Caisse
                </Link>
              )}
            </div>

            {/* Admin Section - Admin only */}
            {agent.role === 'ADMIN' && (
              <div className="border-t border-gray-200 pt-2">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Administration
                </div>
                <Link
                  href="/admin/utilisateurs"
                  className="text-gray-700 hover:text-gray-900 block px-6 py-2 rounded-md text-base font-medium"
                  onClick={() => setShowMobileMenu(false)}
                >
                  Gestion Utilisateurs
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
