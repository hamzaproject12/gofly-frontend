'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Plane, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    motDePasse: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        router.push('/');
        router.refresh();
      } else {
        setError(data.error || 'Erreur de connexion');
      }
    } catch (error) {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex">
      {/* Panneau gauche - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Fond avec effet de grille */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(44.38deg_86.67%_61.76%)]/20 via-transparent to-transparent"></div>
        
        {/* Cercles décoratifs animés */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-[hsl(44.38deg_86.67%_61.76%)]/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-[hsl(44.38deg_86.67%_61.76%)]/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        
        {/* Contenu */}
        <div className="relative z-10 flex flex-col justify-center items-center w-full px-12 text-white">
          <div className="mb-8 transform hover:scale-105 transition-transform duration-300">
            <Image 
              src="/logo-gofly.png" 
              alt="GoFly Logo" 
              width={180} 
              height={180}
              className="drop-shadow-2xl"
              priority
            />
          </div>
          
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-white to-[hsl(44.38deg_86.67%_61.76%)] bg-clip-text text-transparent">
            Bienvenue sur GoFly
          </h1>
          
          <p className="text-xl text-gray-300 mb-8 text-center max-w-md">
            Votre partenaire de confiance pour organiser vos voyages spirituels
          </p>
          
          <div className="flex items-center gap-3 text-[hsl(44.38deg_86.67%_61.76%)]">
            <Plane className="w-6 h-6 animate-bounce" />
            <Sparkles className="w-5 h-5 animate-pulse" />
            <span className="text-sm font-medium">Gestion simplifiée • Suivi en temps réel</span>
          </div>
        </div>
      </div>

      {/* Panneau droit - Formulaire de connexion */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="lg:hidden flex justify-center mb-8">
            <Image 
              src="/logo-gofly.png" 
              alt="GoFly Logo" 
              width={120} 
              height={120}
              className="drop-shadow-2xl"
              priority
            />
          </div>

          {/* Card de connexion */}
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 transform hover:scale-[1.02] transition-all duration-300">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold text-white mb-3">
                Connexion
              </h2>
              <p className="text-gray-400 text-sm">
                Accédez à votre espace de gestion
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Champ Email */}
              <div className="group">
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Adresse email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-[hsl(44.38deg_86.67%_61.76%)] transition-colors" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[hsl(44.38deg_86.67%_61.76%)] focus:border-transparent transition-all"
                    placeholder="exemple@email.com"
                  />
                </div>
              </div>

              {/* Champ Mot de passe */}
              <div className="group">
                <label htmlFor="motDePasse" className="block text-sm font-medium text-gray-300 mb-2">
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-[hsl(44.38deg_86.67%_61.76%)] transition-colors" />
                  <input
                    id="motDePasse"
                    name="motDePasse"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={formData.motDePasse}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[hsl(44.38deg_86.67%_61.76%)] focus:border-transparent transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* Message d'erreur */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 animate-shake">
                  <p className="text-sm text-red-400 text-center">{error}</p>
                </div>
              )}

              {/* Bouton de connexion */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[hsl(44.38deg_86.67%_61.76%)] to-[hsl(44.38deg_86.67%_51.76%)] text-black font-semibold py-3 px-6 rounded-xl hover:from-[hsl(44.38deg_86.67%_71.76%)] hover:to-[hsl(44.38deg_86.67%_61.76%)] focus:outline-none focus:ring-2 focus:ring-[hsl(44.38deg_86.67%_61.76%)] focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                    <span>Connexion...</span>
                  </>
                ) : (
                  <>
                    <span>Se connecter</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-gray-500 text-xs mt-8">
            © 2025 GoFly. Tous droits réservés.
          </p>
        </div>
      </div>
    </div>
  );
}
