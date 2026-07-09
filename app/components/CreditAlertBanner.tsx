'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, X } from 'lucide-react';
import {
  CREDITS_BALANCE_EVENT,
  LAST_BALANCE_STORAGE_KEY,
} from './CreditCounter';

/** Palier refermé pendant cette session (sessionStorage → réapparaît à la prochaine session). */
const DISMISSED_TIER_KEY = 'gofly:credit-banner-dismissed-tier';

type Tier = 'zero' | 'red' | 'orange';

function tierFor(balance: number): Tier | null {
  if (balance === 0) return 'zero';
  if (balance <= 10) return 'red';
  if (balance <= 20) return 'orange';
  return null;
}

/**
 * Bandeau global d'alerte de solde de crédits, affiché sous le header sur
 * toutes les pages authentifiées, pour tous les rôles :
 * - solde ≤ 20 : orange refermable ; solde ≤ 10 : rouge refermable ;
 * - solde = 0 : rouge NON refermable + bouton « Recharger ».
 * Le solde vient du CreditCounter (événement CREDITS_BALANCE_EVENT) ;
 * valeur initiale : dernier solde mémorisé en localStorage.
 */
export default function CreditAlertBanner() {
  const [balance, setBalance] = useState<number | null>(null);
  const [dismissedTier, setDismissedTier] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(LAST_BALANCE_STORAGE_KEY);
    if (stored !== null && Number.isFinite(Number(stored))) {
      setBalance(Number(stored));
    }
    setDismissedTier(window.sessionStorage.getItem(DISMISSED_TIER_KEY));

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === 'number') setBalance(detail);
    };
    window.addEventListener(CREDITS_BALANCE_EVENT, handler);
    return () => window.removeEventListener(CREDITS_BALANCE_EVENT, handler);
  }, []);

  if (balance === null) return null;
  const tier = tierFor(balance);
  if (tier === null) return null;
  if (tier !== 'zero' && dismissedTier === tier) return null;

  const dismiss = () => {
    window.sessionStorage.setItem(DISMISSED_TIER_KEY, tier);
    setDismissedTier(tier);
  };

  if (tier === 'zero') {
    return (
      <div className="bg-red-600 text-white px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Crédits épuisés — la création de nouveaux dossiers est bloquée.
            </span>
          </div>
          <Link
            href="/credits"
            className="px-3 py-1 rounded-md text-xs font-semibold bg-white text-red-700 hover:bg-red-50 transition-colors whitespace-nowrap"
          >
            Recharger
          </Link>
        </div>
      </div>
    );
  }

  const isRed = tier === 'red';
  const bannerClass = isRed
    ? 'bg-red-50 border-red-200 text-red-800'
    : 'bg-orange-50 border-orange-200 text-orange-800';

  return (
    <div className={`border-b px-4 py-2 ${bannerClass}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Il vous reste {balance} crédit{balance > 1 ? 's' : ''}. Pensez à{' '}
            <Link href="/credits" className="underline font-semibold">
              recharger
            </Link>{' '}
            pour ne pas être bloqué.
          </span>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer l'alerte"
          className={`p-1 rounded transition-colors ${
            isRed ? 'hover:bg-red-100' : 'hover:bg-orange-100'
          }`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
