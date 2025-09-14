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
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        setAgent(null);
        router.push('/login');
        router.refresh();
      }
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
    }
  };

  if (loading) {
    return (
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
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
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
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
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-semibold text-gray-900">
              GoodFly
            </Link>
          </div>
          
          {/* Navigation links for authenticated users */}
          <div className="hidden md:flex items-center space-x-6">
            {/* Dashboard - Direct link */}
            <Link
              href="/"
              className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
            >
              Dashboard
            </Link>

            {/* Commercial Dropdown */}
            <div className="relative dropdown-menu">
              <button
                onClick={() => setShowCommercialMenu(!showCommercialMenu)}
                className="flex items-center text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Commercial
                <svg className="ml-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              {showCommercialMenu && (
                <div className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 dropdown-menu">
                  <Link
                    href="/reservations/nouvelle"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setShowCommercialMenu(false)}
                  >
                    Nouvelle Réservation
                  </Link>
                  <Link
                    href="/reservations"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setShowCommercialMenu(false)}
                  >
                    Réservations
                  </Link>
                  <Link
                    href="/programmes"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setShowCommercialMenu(false)}
                  >
                    Programmes
                  </Link>
                  <Link
                    href="/hotels"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setShowCommercialMenu(false)}
                  >
                    Hôtels
                  </Link>
                </div>
              )}
            </div>

            {/* Finances Dropdown */}
            <div className="relative dropdown-menu">
              <button
                onClick={() => setShowFinancesMenu(!showFinancesMenu)}
                className="flex items-center text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Finances
                <svg className="ml-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              {showFinancesMenu && (
                <div className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 dropdown-menu">
                  <Link
                    href="/depenses"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setShowFinancesMenu(false)}
                  >
                    Dépenses
                  </Link>
                  <Link
                    href="/paiements"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setShowFinancesMenu(false)}
                  >
                    Paiements
                  </Link>
                  {/* Admin only - Solde Caisse */}
                  {agent.role === 'ADMIN' && (
                    <Link
                      href="/solde"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setShowFinancesMenu(false)}
                    >
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
                  onClick={() => setShowAdminMenu(!showAdminMenu)}
                  className="flex items-center text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Administration
                  <svg className="ml-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                {showAdminMenu && (
                  <div className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 dropdown-menu">
                    <Link
                      href="/admin/utilisateurs"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setShowAdminMenu(false)}
                    >
                      Gestion Utilisateurs
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 p-2"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowProfile(!showProfile)}
                className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <div className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center">
                  <span className="text-white font-medium">
                    {agent.nom.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="ml-2 text-gray-700 hidden sm:block">{agent.nom}</span>
                <svg className="ml-1 h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {showProfile && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                  <div className="px-4 py-2 text-sm text-gray-700 border-b">
                    <div className="font-medium">{agent.nom}</div>
                    <div className="text-gray-500">{agent.email}</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
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

            {/* Commercial Section */}
            <div className="border-t border-gray-200 pt-2">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Commercial
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
