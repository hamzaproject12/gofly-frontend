'use client';

import { useCallback, useEffect, useState } from 'react';
import RoleProtectedRoute from '../../components/RoleProtectedRoute';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollText, ChevronLeft, ChevronRight, Eye, Calendar, X } from 'lucide-react';

interface JournalActor {
  id: number;
  nom: string;
  email: string | null;
}

interface JournalEntry {
  id: number;
  createdAt: string;
  actorId: number | null;
  actorRoleSnapshot: string;
  action: string;
  entityType: string;
  entityId: number | null;
  summary: string | null;
  detailText: string;
  parDisplay: string | null;
  actor: JournalActor | null;
}

interface DayExpense {
  id: number;
  date: string;
  amount: number;
  type: string;
  program: { id: number; name: string } | null;
  agent?: { id: number; nom: string } | null;
  reservation: {
    id: number;
    firstName: string;
    lastName: string;
    agent: { id: number; nom: string } | null;
  } | null;
}

interface DayPayment {
  id: number;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  description?: string | null;
  program?: { id: number; name: string } | null;
  reservation: {
    id: number;
    firstName: string;
    lastName: string;
    program: { id: number; name: string } | null;
    agent: { id: number; nom: string } | null;
  } | null;
  agent: { id: number; nom: string } | null;
}

function paymentAgentLabel(p: DayPayment): string {
  return p.agent?.nom ?? p.reservation?.agent?.nom ?? '—';
}

function paymentProgramLabel(p: DayPayment): string {
  return p.program?.name ?? p.reservation?.program?.name ?? '—';
}

function paymentReservationLabel(p: DayPayment): string {
  if (p.reservation) {
    return `${p.reservation.firstName} ${p.reservation.lastName}`;
  }
  if (p.description) {
    const short = p.description.length > 48 ? `${p.description.slice(0, 48)}…` : p.description;
    return short;
  }
  return '—';
}

function expenseAgentLabel(e: DayExpense): string {
  return e.agent?.nom ?? e.reservation?.agent?.nom ?? '—';
}

/** Jour civil local (YYYY-MM-DD) pour le champ date et le paramètre API `day` (UTC). */
function localTodayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

const ACTION_LABELS: Record<string, string> = {
  RESERVATION_DELETED: 'Réservation supprimée',
  RESERVATION_UPDATED: 'Réservation modifiée',
  ROOM_DELETED: 'Chambre(s) supprimée(s)',
  PROGRAM_SOFT_DELETED: 'Programme masqué (soft)',
  PROGRAM_HARD_DELETED: 'Programme supprimé définitivement',
  PROGRAM_UPDATED: 'Programme / chambres modifiés',
  FIXED_CHARGE_DELETED: 'Charge fixe supprimée',
  AGENT_DEACTIVATED: 'Agent désactivé',
};

export default function JournalSuppressionsPage() {
  const [items, setItems] = useState<JournalEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<JournalEntry | null>(null);
  const [filterDay, setFilterDay] = useState<string>(localTodayISO);
  const [expensesOfDay, setExpensesOfDay] = useState<DayExpense[]>([]);
  const [paymentsOfDay, setPaymentsOfDay] = useState<DayPayment[]>([]);
  const [expensesTotal, setExpensesTotal] = useState(0);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [activeDayLabel, setActiveDayLabel] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (p: number, day: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(p), limit: String(limit) });
        if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
          params.set('day', day);
        }
        const res = await api.request(`/api/journal-suppressions?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Erreur ${res.status}`);
        }
        const data = await res.json();
        setItems(data.items || []);
        setTotal(data.total ?? 0);
        setPage(data.page ?? p);
        setExpensesOfDay(Array.isArray(data.expensesOfDay) ? data.expensesOfDay : []);
        setPaymentsOfDay(Array.isArray(data.paymentsOfDay) ? data.paymentsOfDay : []);
        setExpensesTotal(typeof data.expensesTotal === 'number' ? data.expensesTotal : 0);
        setPaymentsTotal(typeof data.paymentsTotal === 'number' ? data.paymentsTotal : 0);
        setActiveDayLabel(data.day ?? null);
      } catch (e) {
        console.error(e);
        setItems([]);
        setTotal(0);
        setExpensesOfDay([]);
        setPaymentsOfDay([]);
        setExpensesTotal(0);
        setPaymentsTotal(0);
        setActiveDayLabel(null);
      } finally {
        setLoading(false);
      }
    },
    [limit]
  );

  useEffect(() => {
    fetchPage(1, filterDay);
  }, [fetchPage, filterDay]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const formatMoney = (n: number) =>
    n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' DH';

  return (
    <RoleProtectedRoute allowedRoles={['ADMIN']}>
      <div
        className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-24 pb-16 px-4"
        data-skip-unsaved-dirty
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-3 rounded-2xl bg-amber-100 text-amber-800">
              <ScrollText className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Journal d&apos;activité</h1>
              <p className="text-gray-600 text-sm mt-1">
                Filtre jour (UTC) : journal + dépenses et paiements alignés sur la même date.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-5 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <Calendar className="h-4 w-4 text-slate-500 shrink-0 hidden sm:block" />
            <span className="text-sm text-gray-600 shrink-0">Jour</span>
            <Input
              id="journal-day"
              type="date"
              value={filterDay}
              onChange={(e) => {
                setFilterDay(e.target.value);
                setPage(1);
              }}
              className="h-9 w-[158px] shrink-0"
            />
            {filterDay ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 gap-1 text-gray-600"
                onClick={() => {
                  setFilterDay('');
                  setPage(1);
                }}
              >
                <X className="h-4 w-4" />
                Tout
              </Button>
            ) : null}
          </div>

          <Card className="border border-slate-200 shadow-sm mb-6">
            <CardHeader>
              <CardTitle>Journal (actions enregistrées)</CardTitle>
              <CardDescription>
                {activeDayLabel
                  ? `Jour sélectionné : ${new Date(activeDayLabel + 'T12:00:00Z').toLocaleDateString('fr-FR')} — ${total} événement(s) sur cette date.`
                  : `${total} événement(s) (toutes dates) — utilisez le filtre ci-dessus pour une journée précise.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-gray-500 py-8 text-center">Chargement…</p>
              ) : items.length === 0 ? (
                <p className="text-gray-500 py-8 text-center">
                  Aucune entrée de journal {activeDayLabel ? 'pour ce jour' : 'pour le moment'}.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-600">
                        <th className="pb-2 pr-4 font-medium">Date</th>
                        <th className="pb-2 pr-4 font-medium">Action</th>
                        <th className="pb-2 pr-4 font-medium">Résumé</th>
                        <th className="pb-2 pr-4 font-medium">Par</th>
                        <th className="pb-2 font-medium w-24"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row) => (
                        <tr key={row.id} className="border-b border-gray-100 hover:bg-slate-50/80">
                          <td className="py-3 pr-4 whitespace-nowrap text-gray-800">
                            {new Date(row.createdAt).toLocaleString('fr-FR')}
                          </td>
                          <td className="py-3 pr-4">
                            <Badge variant="outline" className="font-normal">
                              {ACTION_LABELS[row.action] || row.action}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4 text-gray-600 max-w-md truncate" title={row.summary || ''}>
                            {row.summary || '—'}
                          </td>
                          <td className="py-3 pr-4 text-gray-700">
                            {(() => {
                              const label = row.parDisplay || row.actor?.nom;
                              const role =
                                row.actorRoleSnapshot &&
                                row.actorRoleSnapshot !== 'UNKNOWN'
                                  ? row.actorRoleSnapshot
                                  : null;
                              return (
                                <>
                                  {label ?? <span className="text-gray-400">—</span>}
                                  {role && label === row.actor?.nom && (
                                    <span className="text-xs text-gray-400 ml-1">({role})</span>
                                  )}
                                </>
                              );
                            })()}
                          </td>
                          <td className="py-3">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8"
                              onClick={() => {
                                setSelected(row);
                                setDetailOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Détail
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!loading && totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    Page {page} / {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => fetchPage(page - 1, filterDay)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => fetchPage(page + 1, filterDay)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {activeDayLabel && (
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border border-red-100 bg-red-50/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-red-900">
                    Dépenses du {new Date(activeDayLabel + 'T12:00:00Z').toLocaleDateString('fr-FR')}
                  </CardTitle>
                  <CardDescription>
                    Total : <span className="font-semibold text-red-800">{formatMoney(expensesTotal)}</span>{' '}
                    · {expensesOfDay.length} ligne(s)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {expensesOfDay.length === 0 ? (
                    <p className="text-sm text-gray-500">Aucune dépense ce jour-là.</p>
                  ) : (
                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-gray-600 border-b">
                            <th className="pb-1 pr-2">Type</th>
                            <th className="pb-1 pr-2">Programme</th>
                            <th className="pb-1 pr-2">Agent</th>
                            <th className="pb-1 pr-2">Montant</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expensesOfDay.map((e) => (
                            <tr key={e.id} className="border-b border-red-100/80">
                              <td className="py-1 pr-2 whitespace-nowrap">{e.type}</td>
                              <td className="py-1 pr-2">{e.program?.name ?? '—'}</td>
                              <td className="py-1 pr-2">{expenseAgentLabel(e)}</td>
                              <td className="py-1 pr-2 whitespace-nowrap">{formatMoney(e.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-emerald-100 bg-emerald-50/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-emerald-900">
                    Paiements du {new Date(activeDayLabel + 'T12:00:00Z').toLocaleDateString('fr-FR')}
                  </CardTitle>
                  <CardDescription>
                    Total :{' '}
                    <span className="font-semibold text-emerald-800">{formatMoney(paymentsTotal)}</span>{' '}
                    · {paymentsOfDay.length} ligne(s)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {paymentsOfDay.length === 0 ? (
                    <p className="text-sm text-gray-500">Aucun paiement ce jour-là.</p>
                  ) : (
                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-gray-600 border-b">
                            <th className="pb-1 pr-2">Réservation</th>
                            <th className="pb-1 pr-2">Programme</th>
                            <th className="pb-1 pr-2">Méthode</th>
                            <th className="pb-1 pr-2">Agent</th>
                            <th className="pb-1 pr-2">Montant</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paymentsOfDay.map((p) => (
                            <tr key={p.id} className="border-b border-emerald-100/80">
                              <td className="py-1 pr-2 max-w-[180px]" title={p.description ?? undefined}>
                                {paymentReservationLabel(p)}
                              </td>
                              <td className="py-1 pr-2">{paymentProgramLabel(p)}</td>
                              <td className="py-1 pr-2">{p.paymentMethod}</td>
                              <td className="py-1 pr-2">{paymentAgentLabel(p)}</td>
                              <td className="py-1 pr-2 whitespace-nowrap">{formatMoney(p.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Détail du journal</DialogTitle>
            </DialogHeader>
            {selected && (
              <div className="space-y-3 overflow-hidden flex flex-col min-h-0">
                <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                  <Badge>{ACTION_LABELS[selected.action] || selected.action}</Badge>
                  <span>{new Date(selected.createdAt).toLocaleString('fr-FR')}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-800">Résumé : </span>
                  {selected.summary || '—'}
                </div>
                <pre className="text-xs bg-slate-900 text-slate-100 p-4 rounded-lg overflow-auto flex-1 whitespace-pre-wrap font-mono leading-relaxed max-h-[60vh]">
                  {selected.detailText}
                </pre>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </RoleProtectedRoute>
  );
}
