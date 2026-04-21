'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import RoleProtectedRoute from '../components/RoleProtectedRoute';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CalendarClock, Plus, Pencil, Trash2, RefreshCw, Receipt } from 'lucide-react';

const CATEGORIES = ['LOYER', 'SALAIRE', 'CHARGES_DIVERSES', 'AUTRE'] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<Category, string> = {
  LOYER: 'Loyer',
  SALAIRE: 'Salaire',
  CHARGES_DIVERSES: 'Charges diverses',
  AUTRE: 'Autre',
};

type AgentBrief = { id: number; nom: string; email: string | null };

type FixedChargeRow = {
  id: number;
  label: string;
  amount: number;
  category: Category;
  agentId: number | null;
  isActive: boolean;
  agent: AgentBrief | null;
  _count: { occurrences: number };
};

type OccurrenceRow = {
  id: number;
  yearMonth: string;
  amount: number;
  generatedAt: string;
  fixedCharge: {
    label: string;
    category: Category;
    agent: { id: number; nom: string } | null;
  };
  expense: { id: number; description: string; amount: number; type: string };
};

function formatYearMonthInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function ChargesFixesPage() {
  const [fixedCharges, setFixedCharges] = useState<FixedChargeRow[]>([]);
  const [agents, setAgents] = useState<AgentBrief[]>([]);
  const [occurrences, setOccurrences] = useState<OccurrenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [occLoading, setOccLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [yearMonth, setYearMonth] = useState(() => formatYearMonthInput(new Date()));
  const [genMonth, setGenMonth] = useState(() => formatYearMonthInput(new Date()));
  const [genBusy, setGenBusy] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FixedChargeRow | null>(null);
  const [form, setForm] = useState({
    label: '',
    amount: '',
    category: 'LOYER' as Category,
    agentId: '' as string,
    isActive: true,
  });

  const loadCharges = useCallback(async () => {
    const res = await api.request(api.endpoints.fixedCharges);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || 'Chargement impossible');
    }
    const data = await res.json();
    setFixedCharges(data.fixedCharges);
  }, []);

  const loadAgents = useCallback(async () => {
    const res = await api.request('/api/admin/agents');
    if (!res.ok) return;
    const data = await res.json();
    setAgents(data.agents || []);
  }, []);

  const loadOccurrences = useCallback(async () => {
    setOccLoading(true);
    try {
      const res = await api.request(`${api.endpoints.fixedCharges}/occurrences?yearMonth=${encodeURIComponent(yearMonth)}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Occurrences introuvables');
      }
      const data = await res.json();
      setOccurrences(data.occurrences || []);
    } catch (e) {
      console.error(e);
    } finally {
      setOccLoading(false);
    }
  }, [yearMonth]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        await Promise.all([loadCharges(), loadAgents()]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCharges, loadAgents]);

  useEffect(() => {
    loadOccurrences();
  }, [loadOccurrences]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      label: '',
      amount: '',
      category: 'LOYER',
      agentId: '',
      isActive: true,
    });
    setDialogOpen(true);
  };

  const openEdit = (row: FixedChargeRow) => {
    setEditing(row);
    setForm({
      label: row.label,
      amount: String(row.amount),
      category: row.category,
      agentId: row.agentId != null ? String(row.agentId) : '',
      isActive: row.isActive,
    });
    setDialogOpen(true);
  };

  const saveCharge = async () => {
    setError('');
    setMessage('');
    const payload: Record<string, unknown> = {
      label: form.label.trim(),
      amount: parseFloat(form.amount.replace(',', '.')),
      category: form.category,
      isActive: form.isActive,
    };
    if (form.agentId) payload.agentId = Number(form.agentId);
    else payload.agentId = null;

    const url = editing
      ? `${api.endpoints.fixedCharges}/${editing.id}`
      : api.endpoints.fixedCharges;
    const res = await api.request(url, {
      method: editing ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || 'Enregistrement refusé');
      return;
    }
    setDialogOpen(false);
    setMessage(editing ? 'Charge mise à jour.' : 'Charge créée.');
    await loadCharges();
  };

  const removeCharge = async (row: FixedChargeRow) => {
    if (!confirm(`Supprimer ou désactiver « ${row.label} » ?`)) return;
    setMessage('');
    setError('');
    const res = await api.request(`${api.endpoints.fixedCharges}/${row.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || 'Suppression impossible');
      return;
    }
    const j = await res.json().catch(() => ({}));
    setMessage(j.message || 'OK');
    await loadCharges();
  };

  const runGenerate = async () => {
    setGenBusy(true);
    setMessage('');
    setError('');
    try {
      const res = await api.request(`${api.endpoints.fixedCharges}/generate-month`, {
        method: 'POST',
        body: JSON.stringify({ yearMonth: genMonth }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || 'Génération échouée');
        return;
      }
      setMessage(
        `Mois ${j.yearMonth}: ${j.created} dépense(s) créée(s), ${j.skipped} déjà présente(s).`
      );
      await loadCharges();
      if (genMonth === yearMonth) await loadOccurrences();
    } finally {
      setGenBusy(false);
    }
  };

  return (
    <RoleProtectedRoute allowedRoles={['ADMIN']}>
      <div
        data-skip-unsaved-dirty
        className="max-w-6xl mx-auto px-4 py-8 space-y-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Charges fixes</h1>
            <p className="text-sm text-gray-600 mt-1">
              Modèles mensuels : une dépense est créée automatiquement chaque mois (cron 1er du mois
              06:00, et au démarrage du serveur si manquant). Les lignes apparaissent aussi dans{' '}
              <Link href="/depenses" className="text-blue-600 hover:underline">
                Dépenses
              </Link>
              .
            </p>
          </div>
          <Button onClick={openCreate} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle charge
          </Button>
        </div>

        {error ? (
          <div className="rounded-lg bg-red-50 text-red-800 px-4 py-3 text-sm">{error}</div>
        ) : null}
        {message ? (
          <div className="rounded-lg bg-green-50 text-green-800 px-4 py-3 text-sm">{message}</div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarClock className="h-5 w-5" />
              Générer les dépenses pour un mois
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="gen-month">Mois (AAAA-MM)</Label>
              <Input
                id="gen-month"
                type="month"
                value={genMonth}
                onChange={(e) => setGenMonth(e.target.value)}
                className="w-44"
              />
            </div>
            <Button onClick={runGenerate} disabled={genBusy}>
              <RefreshCw className={`h-4 w-4 mr-2 ${genBusy ? 'animate-spin' : ''}`} />
              Générer
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Modèles de charges</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500 text-sm">Chargement…</p>
            ) : fixedCharges.length === 0 ? (
              <p className="text-gray-500 text-sm">Aucune charge fixe. Créez-en une ci-dessus.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Libellé</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-center">Générations</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fixedCharges.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell>{CATEGORY_LABELS[row.category]}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}{' '}
                        MAD
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {row.agent?.nom ?? '—'}
                      </TableCell>
                      <TableCell>
                        {row.isActive ? (
                          <Badge className="bg-green-100 text-green-800">Actif</Badge>
                        ) : (
                          <Badge variant="secondary">Inactif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{row._count.occurrences}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeCharge(row)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Receipt className="h-5 w-5" />
              Dépenses générées
            </CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="occ-month" className="sr-only sm:not-sr-only">
                Mois
              </Label>
              <Input
                id="occ-month"
                type="month"
                value={yearMonth}
                onChange={(e) => setYearMonth(e.target.value)}
                className="w-44"
              />
            </div>
          </CardHeader>
          <CardContent>
            {occLoading ? (
              <p className="text-gray-500 text-sm">Chargement…</p>
            ) : occurrences.length === 0 ? (
              <p className="text-gray-500 text-sm">Aucune dépense générée pour ce mois.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Charge</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Dépense #</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {occurrences.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <div className="font-medium">{o.fixedCharge.label}</div>
                        <div className="text-xs text-gray-500">
                          {o.expense.description}
                        </div>
                      </TableCell>
                      <TableCell>{CATEGORY_LABELS[o.fixedCharge.category]}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {o.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-sm text-blue-600">#{o.expense.id}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? 'Modifier la charge' : 'Nouvelle charge fixe'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="fc-label">Libellé</Label>
                <Input
                  id="fc-label"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Ex. Loyer bureau"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fc-amount">Montant (MAD)</Label>
                <Input
                  id="fc-amount"
                  type="text"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v as Category }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Agent (optionnel, ex. salaire)</Label>
                <Select
                  value={form.agentId || '__none__'}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, agentId: v === '__none__' ? '' : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucun</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="fc-active"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="fc-active" className="font-normal cursor-pointer">
                  Actif (participe à la génération mensuelle)
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={saveCharge}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleProtectedRoute>
  );
}
