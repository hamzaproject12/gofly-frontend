'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowRight, Plane, Sparkles, MapPin } from 'lucide-react';
import { api } from "@/lib/api";
import { siteConfig } from "@/lib/config";

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
      const response = await fetch(api.url('/api/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        // Stocker le token dans localStorage pour l'utiliser dans les requêtes API
        if (data.token) {
          localStorage.setItem('authToken', data.token);
          console.log('✅ Token stocké dans localStorage:', data.token.substring(0, 20) + '...');
        }
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
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
      {/* Image de fond - Kaaba/La Mecque */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-black/75 via-black/65 to-black/80 z-10"></div>
        <img
          src="https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?q=80&w=2070&auto=format&fit=crop"
          alt="Masjid al-Nabawi Background"
          className="w-full h-full object-cover"
          loading="eager"
        />
        {/* Overlay de points dorés */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,204,102,0.15)_0%,transparent_60%)] z-10"></div>
      </div>

      {/* Particules flottantes */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 animate-float animation-delay-500">
          <Sparkles className="w-6 h-6 text-[hsl(44.38deg_86.67%_61.76%)]/60" />
        </div>
        <div className="absolute top-1/3 right-1/3 animate-float animation-delay-1000">
          <Plane className="w-8 h-8 text-[hsl(44.38deg_86.67%_61.76%)]/50 rotate-45" />
        </div>
        <div className="absolute bottom-1/3 left-1/3 animate-float animation-delay-1500">
          <MapPin className="w-7 h-7 text-[hsl(44.38deg_86.67%_61.76%)]/40" />
        </div>
        <div className="absolute top-2/3 right-1/4 animate-float">
          <Sparkles className="w-5 h-5 text-[hsl(44.38deg_86.67%_61.76%)]/70" />
        </div>
      </div>

      {/* Logo en haut à gauche */}
      <div className="absolute top-6 left-6 z-30 animate-slide-down">
        <div className="relative group">
          <div className="absolute -inset-4 bg-[hsl(44.38deg_86.67%_61.76%)]/30 rounded-full blur-2xl animate-pulse group-hover:bg-[hsl(44.38deg_86.67%_61.76%)]/50 transition-all duration-500"></div>
          <div className="relative bg-white/10 backdrop-blur-md rounded-2xl p-2 border border-white/20">
            <img
              src={siteConfig.logo}
              alt={`${siteConfig.name} Logo`}
              className="relative w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-[0_0_25px_rgba(255,204,102,0.6)] animate-logo-glow"
              loading="eager"
            />
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="relative z-30 w-full max-w-md px-6">
        {/* Titre principal */}
        <div className="text-center mb-8 animate-slide-up">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-white via-[hsl(44.38deg_86.67%_61.76%)] to-white bg-clip-text text-transparent animate-gradient leading-tight">
            {siteConfig.name}
          </h1>
          <p className="text-gray-300 text-lg">
            Votre voyage spirituel commence ici
          </p>
          <div className="flex items-center justify-center gap-3 mt-4 text-[hsl(44.38deg_86.67%_61.76%)]">
            <Plane className="w-5 h-5" />
            <span className="text-sm font-medium">Omra & Hajj</span>
            <div className="w-1.5 h-1.5 rounded-full bg-[hsl(44.38deg_86.67%_61.76%)]"></div>
            <MapPin className="w-5 h-5" />
            <span className="text-sm font-medium">Makkah • Madinah</span>
          </div>
        </div>

        {/* Card de connexion */}
        <div className="bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/20 p-8 shadow-2xl animate-scale-in">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-white mb-2">
              Connexion
          </h2>
            <p className="text-gray-400 text-sm">
              Accédez à votre espace de gestion
          </p>
        </div>

          <form onSubmit={handleSubmit} className="space-y-5" autoComplete="on">
            {/* Champ Email */}
            <div className="group">
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Adresse email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-[hsl(44.38deg_86.67%_61.76%)] transition-colors duration-300" />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                  className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[hsl(44.38deg_86.67%_61.76%)] focus:border-transparent transition-all duration-300 hover:bg-white/10"
                  placeholder="votre@email.com"
              />
            </div>
            </div>

            {/* Champ Mot de passe */}
            <div className="group">
              <label htmlFor="motDePasse" className="block text-sm font-medium text-gray-300 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-[hsl(44.38deg_86.67%_61.76%)] transition-colors duration-300" />
              <input
                id="motDePasse"
                name="motDePasse"
                type="password"
                autoComplete="current-password"
                required
                value={formData.motDePasse}
                onChange={handleChange}
                  className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[hsl(44.38deg_86.67%_61.76%)] focus:border-transparent transition-all duration-300 hover:bg-white/10"
                  placeholder="••••••••••"
              />
            </div>
          </div>

            {/* Message d'erreur */}
          {error && (
              <div className="bg-red-500/20 border-2 border-red-500/50 rounded-xl p-4 animate-shake">
                <p className="text-sm text-red-300 text-center font-medium">{error}</p>
            </div>
          )}

            {/* Bouton de connexion */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[hsl(44.38deg_86.67%_61.76%)] via-[hsl(44.38deg_86.67%_71.76%)] to-[hsl(44.38deg_86.67%_61.76%)] bg-[length:200%_100%] text-black font-bold py-4 px-6 rounded-xl hover:bg-right-bottom focus:outline-none focus:ring-4 focus:ring-[hsl(44.38deg_86.67%_61.76%)]/50 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3 group shadow-lg shadow-[hsl(44.38deg_86.67%_61.76%)]/30"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-3 border-black/30 border-t-black rounded-full animate-spin"></div>
                  <span>Connexion en cours...</span>
                </>
              ) : (
                <>
                  <span>Se connecter</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" />
                </>
              )}
            </button>
        </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 space-y-2 animate-fade-in">
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} {siteConfig.name}
          </p>
          <p className="text-gray-500 text-xs">
            Agence spécialisée Omra & Hajj
          </p>
        </div>
      </div>
    </div>
  );
}
