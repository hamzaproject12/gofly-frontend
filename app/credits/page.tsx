'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import RoleProtectedRoute from '../components/RoleProtectedRoute';
import { api } from '@/lib/api';
import { creditsConfig } from '@/lib/config';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Coins,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';

interface LedgerEntry {
  id: number;
  walletId: number;
  type: 'ACHAT_PACK' | 'CONSOMMATION' | 'REMBOURSEMENT' | 'AJUSTEMENT' | 'BONUS';
  amount: number;
  balanceAfter: number;
  reservationId: number | null;
  packLabel: string | null;
  paymentRef: string | null;
  note: string | null;
  createdBy: string;
  createdAt: string;
}

const TYPE_LABELS: Record<LedgerEntry['type'], string> = {
  ACHAT_PACK: 'Achat de pack',
  CONSOMMATION: 'Consommation',
  REMBOURSEMENT: 'Remboursement',
  AJUSTEMENT: 'Ajustement',
  BONUS: 'Crédits de bienvenue',
};

const TYPE_BADGE_CLASSES: Record<LedgerEntry['type'], string> = {
  ACHAT_PACK: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  CONSOMMATION: 'bg-blue-100 text-blue-700 border-blue-200',
  REMBOURSEMENT: 'bg-amber-100 text-amber-700 border-amber-200',
  AJUSTEMENT: 'bg-purple-100 text-purple-700 border-purple-200',
  BONUS: 'bg-sky-100 text-sky-700 border-sky-200',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function CreditsPageContent() {
  const { isSuperAdmin } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [items, setItems] = useState<LedgerEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLedger = useCallback(
    async (p: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(p), limit: String(limit) });
        const res = await api.request(`${api.endpoints.creditsLedger}?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Erreur ${res.status}`);
        }
        const data = await res.json();
        setItems(Array.isArray(data.items) ? data.items : []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
        setBalance(typeof data.balance === 'number' ? data.balance : null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors du chargement de l'historique");
      } finally {
        setLoading(false);
      }
    },
    [limit]
  );

  useEffect(() => {
    fetchLedger(page);
  }, [fetchLedger, page]);

  const soldeColor =
    balance !== null && balance <= 10
      ? 'text-red-600'
      : balance !== null && balance <= 20
        ? 'text-orange-600'
        : 'text-emerald-600';

  const whatsappHref = (packLabel: string, credits: number) => {
    const prixDh = credits * creditsConfig.prixCreditDh;
    const message = `Bonjour, je souhaite recharger mon compte GoFly avec le ${packLabel} (${credits} crédits, ${prixDh.toLocaleString('fr-FR')} DH). Merci.`;
    return `https://wa.me/${creditsConfig.whatsappNumber}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Solde en grand */}
        <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
          <CardContent className="py-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-800 flex items-center justify-center">
                  <Coins className="h-7 w-7 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Solde de crédits (1 crédit = 1 pèlerin)</p>
                  <p className={`text-5xl font-bold ${soldeColor}`}>
                    {balance !== null ? balance : '—'}
                  </p>
                </div>
              </div>
              {isSuperAdmin && (
                <Link href="/admin/recharge">
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Recharge / Ajustement (Super admin)
                  </Button>
                </Link>
              )}
            </div>
            {balance !== null && balance === 0 && (
              <p className="mt-4 text-sm font-medium text-red-600">
                Votre solde est à 0 : la création de nouveaux dossiers est bloquée. Rechargez pour continuer.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recharger : packs + WhatsApp */}
        <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
              Recharger
            </CardTitle>
            <CardDescription>
              Choisissez un pack et contactez-nous sur WhatsApp. Après réception du paiement, les
              crédits sont ajoutés à votre compte.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {creditsConfig.packs.map((pack) => (
                <div
                  key={pack.label}
                  className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col items-center text-center shadow-sm"
                >
                  <p className="text-lg font-bold text-gray-900">{pack.label}</p>
                  <p className="text-3xl font-bold text-blue-700 mt-1">{pack.credits}</p>
                  <p className="text-xs text-gray-500">crédits</p>
                  <p className="text-sm font-medium text-gray-700 mt-2">
                    {(pack.credits * creditsConfig.prixCreditDh).toLocaleString('fr-FR')} DH
                  </p>
                  <a
                    href={whatsappHref(pack.label, pack.credits)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 w-full"
                  >
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Commander sur WhatsApp
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Historique du ledger */}
        <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Historique des crédits</CardTitle>
            <CardDescription>
              {total} mouvement{total > 1 ? 's' : ''} — le plus récent en premier. Cet historique
              est infalsifiable : aucune ligne n&apos;est jamais modifiée ni supprimée.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <p className="text-sm text-red-600 mb-4">{error}</p>
            )}
            {loading ? (
              <div className="py-12 text-center text-gray-500">Chargement…</div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center text-gray-500">Aucun mouvement pour le moment.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wider text-gray-500">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4 text-right">Montant</th>
                      <th className="py-2 pr-4 text-right">Solde après</th>
                      <th className="py-2 pr-4">Auteur</th>
                      <th className="py-2">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((entry) => (
                      <tr key={entry.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2 pr-4 whitespace-nowrap text-gray-700">
                          {formatDate(entry.createdAt)}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge variant="outline" className={TYPE_BADGE_CLASSES[entry.type]}>
                            {TYPE_LABELS[entry.type] ?? entry.type}
                          </Badge>
                        </td>
                        <td
                          className={`py-2 pr-4 text-right font-semibold ${
                            entry.amount < 0 ? 'text-red-600' : 'text-emerald-600'
                          }`}
                        >
                          {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                        </td>
                        <td className="py-2 pr-4 text-right font-medium text-gray-900">
                          {entry.balanceAfter}
                        </td>
                        <td className="py-2 pr-4 text-gray-700">{entry.createdBy}</td>
                        <td className="py-2 text-gray-600">
                          {[
                            entry.packLabel,
                            entry.paymentRef ? `Réf. ${entry.paymentRef}` : null,
                            entry.reservationId ? `Dossier #${entry.reservationId}` : null,
                            entry.note,
                          ]
                            .filter(Boolean)
                            .join(' — ') || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Précédent
                </Button>
                <span className="text-sm text-gray-600">
                  Page {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Suivant
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function CreditsPage() {
  return (
    <RoleProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
      <CreditsPageContent />
    </RoleProtectedRoute>
  );
}
