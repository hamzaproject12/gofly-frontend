'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_BADGE_CLASSES } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Check, KeyRound, Shield, User, X } from 'lucide-react';

/** Aligné sur la règle serveur (authController.MOT_DE_PASSE_MIN). */
const MOT_DE_PASSE_MIN = 8;

export default function MonComptePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmation('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword) {
      setError('Mot de passe actuel et nouveau mot de passe requis');
      return;
    }
    if (newPassword.length < MOT_DE_PASSE_MIN) {
      setError(`Le nouveau mot de passe doit contenir au moins ${MOT_DE_PASSE_MIN} caractères`);
      return;
    }
    if (newPassword === currentPassword) {
      setError('Le nouveau mot de passe doit être différent de l\'actuel');
      return;
    }
    if (newPassword !== confirmation) {
      setError('La confirmation ne correspond pas au nouveau mot de passe');
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.request('/api/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (response.ok) {
        reset();
        setError('');
        toast({
          title: 'Mot de passe modifié',
          description: 'Utilisez le nouveau mot de passe à votre prochaine connexion.',
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || 'Erreur lors du changement de mot de passe');
      }
    } catch (err) {
      console.error('Erreur:', err);
      setError('Erreur de connexion au serveur');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-4">
        <div className="max-w-2xl mx-auto px-3 sm:px-4">
          <div className="h-40 rounded-xl bg-gray-100 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Mon compte</h1>
          <p className="mt-1 text-sm text-gray-600">
            Vos informations et votre mot de passe personnel
          </p>
        </div>

        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-3 bg-red-50 border-2 border-red-200 rounded-xl p-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => setError('')}
                aria-label="Masquer le message d'erreur"
                className="text-red-500 hover:text-red-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <Card className="mb-4 border-2 border-gray-100 shadow-sm">
          <CardHeader className="p-3 border-b border-gray-100">
            <CardTitle className="flex items-center gap-2 text-base text-gray-900">
              <User className="h-5 w-5 text-blue-600" />
              Informations
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-gray-500">Nom</span>
              <span className="text-sm font-medium text-gray-900">{user?.nom ?? '—'}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-gray-500">Email</span>
              <span className="text-sm font-medium text-gray-900">{user?.email ?? '—'}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-gray-500">Rôle</span>
              {user?.role ? (
                <Badge
                  variant="secondary"
                  className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border-0 ${ROLE_BADGE_CLASSES[user.role]}`}
                >
                  <Shield className="h-3 w-3 mr-1" />
                  {ROLE_LABELS[user.role]}
                </Badge>
              ) : (
                <span className="text-sm text-gray-400">—</span>
              )}
            </div>
            {user?.role && (
              <p className="text-xs text-gray-500 pt-1">{ROLE_DESCRIPTIONS[user.role]}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-100 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 p-3">
            <CardTitle className="flex items-center gap-2 text-base text-blue-900">
              <KeyRound className="h-5 w-5" />
              Changer mon mot de passe
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="current-password" className="text-sm font-semibold text-gray-700">
                  Mot de passe actuel
                </Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="h-9 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-sm font-semibold text-gray-700">
                  Nouveau mot de passe
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  aria-describedby="new-password-help"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-9 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="••••••••"
                />
                <p id="new-password-help" className="text-xs text-gray-500">
                  {MOT_DE_PASSE_MIN} caractères minimum.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-sm font-semibold text-gray-700">
                  Confirmer le nouveau mot de passe
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  className="h-9 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="••••••••"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    reset();
                    setError('');
                  }}
                  className="h-9 px-4 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl font-medium"
                >
                  <X className="h-4 w-4 mr-2" />
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-9 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-medium shadow-lg disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      En cours...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Modifier
                    </>
                  )}
                </Button>
              </div>
            </form>

            <p className="mt-4 text-xs text-gray-500">
              Mot de passe oublié ? Seul le gérant de l&apos;agence peut le réinitialiser.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
