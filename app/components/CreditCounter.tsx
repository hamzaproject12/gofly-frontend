'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

/** Événement global émis après toute opération qui modifie le solde de crédits. */
export const CREDITS_UPDATED_EVENT = 'gofly:credits-updated';

/** Événement porteur du solde (detail: number), émis après chaque lecture réussie. */
export const CREDITS_BALANCE_EVENT = 'gofly:credits-balance';

/** Dernier solde connu (localStorage) — sert à détecter une recharge entre deux lectures. */
export const LAST_BALANCE_STORAGE_KEY = 'gofly:last-known-credit-balance';

/** Intervalle de rafraîchissement automatique du solde. */
const POLL_INTERVAL_MS = 60_000;

/** À appeler après une recharge / un ajustement pour rafraîchir le compteur du header. */
export function notifyCreditsUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CREDITS_UPDATED_EVENT));
  }
}

/**
 * Compteur « Crédits : X » du header, visible sur toutes les pages.
 * Couleur : normal si > 20, orange si ≤ 20, rouge si ≤ 10 ; à 0 : bouton « Recharger ».
 * Rafraîchi au chargement de page, sur l'événement CREDITS_UPDATED_EVENT et toutes les 60 s.
 * Si le solde a augmenté depuis la dernière lecture mémorisée (recharge côté
 * fournisseur), affiche une seule fois un toast vert « +X crédits ».
 */
export default function CreditCounter() {
  const [balance, setBalance] = useState<number | null>(null);
  const pathname = usePathname();
  const { toast } = useToast();

  const fetchBalance = useCallback(async () => {
    try {
      const res = await api.request(api.endpoints.creditsBalance);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.balance === 'number') {
          const newBalance: number = data.balance;
          const stored = window.localStorage.getItem(LAST_BALANCE_STORAGE_KEY);
          const last = stored === null ? null : Number(stored);
          if (last !== null && Number.isFinite(last) && newBalance > last) {
            toast({
              title: 'Recharge reçue',
              description: `Votre compte a été crédité de +${newBalance - last} crédit(s)`,
              className: 'border-emerald-300 bg-emerald-50 text-emerald-900',
            });
          }
          // Baisse du solde (consommation) : mise à jour silencieuse.
          window.localStorage.setItem(LAST_BALANCE_STORAGE_KEY, String(newBalance));
          setBalance(newBalance);
          window.dispatchEvent(
            new CustomEvent(CREDITS_BALANCE_EVENT, { detail: newBalance })
          );
        }
      }
    } catch {
      // Compteur non bloquant : on garde la dernière valeur connue
    }
  }, [toast]);

  // Rafraîchi au montage et à chaque changement de page
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance, pathname]);

  // Rafraîchi immédiatement après une recharge / un ajustement / une création
  useEffect(() => {
    const handler = () => fetchBalance();
    window.addEventListener(CREDITS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(CREDITS_UPDATED_EVENT, handler);
  }, [fetchBalance]);

  // Rafraîchissement périodique (recharge fournisseur pendant la session)
  useEffect(() => {
    const id = window.setInterval(fetchBalance, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [fetchBalance]);

  if (balance === null) return null;

  const colorClass =
    balance <= 10
      ? 'bg-red-100 text-red-700 border-red-200'
      : balance <= 20
        ? 'bg-orange-100 text-orange-700 border-orange-200'
        : 'bg-emerald-100 text-emerald-700 border-emerald-200';

  return (
    <div className="flex items-center space-x-2">
      <Link
        href="/credits"
        className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${colorClass}`}
        title="Solde de crédits (1 crédit = 1 pèlerin)"
      >
        Crédits : {balance}
      </Link>
      {balance === 0 && (
        <Link
          href="/credits"
          className="px-3 py-1 rounded-full text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors whitespace-nowrap"
        >
          Recharger
        </Link>
      )}
    </div>
  );
}
