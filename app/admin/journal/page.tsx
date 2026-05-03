'use client';

import { useCallback, useEffect, useState } from 'react';
import RoleProtectedRoute from '../../components/RoleProtectedRoute';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollText, ChevronLeft, ChevronRight, Eye } from 'lucide-react';

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
  actor: JournalActor | null;
}

const ACTION_LABELS: Record<string, string> = {
  RESERVATION_DELETED: 'Réservation supprimée',
  ROOM_DELETED: 'Chambre(s) supprimée(s)',
  PROGRAM_SOFT_DELETED: 'Programme masqué (soft)',
  PROGRAM_HARD_DELETED: 'Programme supprimé définitivement',
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

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(limit) });
      const res = await api.request(`/api/journal-suppressions?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erreur ${res.status}`);
      }
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? p);
    } catch (e) {
      console.error(e);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <RoleProtectedRoute allowedRoles={['ADMIN']}>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-24 pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-2xl bg-amber-100 text-amber-800">
              <ScrollText className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Journal des suppressions</h1>
              <p className="text-gray-600 text-sm mt-1">
                Historique des réservations, chambres, programmes, charges fixes et désactivations
                d&apos;agents (consultation admin uniquement).
              </p>
            </div>
          </div>

          <Card className="border border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Entrées récentes</CardTitle>
              <CardDescription>
                {total} événement(s) enregistré(s). Les détails complets sont disponibles pour chaque
                ligne.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-gray-500 py-8 text-center">Chargement…</p>
              ) : items.length === 0 ? (
                <p className="text-gray-500 py-8 text-center">Aucune entrée pour le moment.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-600">
                        <th className="pb-2 pr-4 font-medium">Date</th>
                        <th className="pb-2 pr-4 font-medium">Action</th>
                        <th className="pb-2 pr-4 font-medium">Entité</th>
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
                          <td className="py-3 pr-4 text-gray-700">
                            {row.entityType}
                            {row.entityId != null ? ` #${row.entityId}` : ''}
                          </td>
                          <td className="py-3 pr-4 text-gray-600 max-w-md truncate" title={row.summary || ''}>
                            {row.summary || '—'}
                          </td>
                          <td className="py-3 pr-4 text-gray-700">
                            {row.actor ? row.actor.nom : <span className="text-gray-400">—</span>}
                            <span className="text-xs text-gray-400 ml-1">
                              ({row.actorRoleSnapshot})
                            </span>
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
                      onClick={() => fetchPage(page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => fetchPage(page + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
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
