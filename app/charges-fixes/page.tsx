'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import RoleProtectedRoute from '../components/RoleProtectedRoute';
import { api } from '@/lib/api';
import { formatMontant, classeTailleMontant } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DeleteConfirmation } from '@/components/ui/delete-confirmation';
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
  CalendarClock,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Receipt,
  Wallet,
  Search,
  Filter,
  Home,
  Users,
  MoreHorizontal,
  CheckCircle,
  AlertCircle,
  ListChecks,
  FileSpreadsheet,
} from 'lucide-react';

const CATEGORIES = ['LOYER', 'SALAIRE', 'CHARGES_DIVERSES', 'AUTRE'] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<Category, string> = {
  LOYER: 'Loyer',
  SALAIRE: 'Salaire',
  CHARGES_DIVERSES: 'Charges diverses',
  AUTRE: 'Autre',
};

// Même code couleur que les badges de type des pages Dépenses / Paiements :
// une catégorie garde la même teinte partout dans l'application.
const CATEGORY_COLORS: Record<Category, string> = {
  LOYER: 'bg-blue-100 text-blue-800',
  SALAIRE: 'bg-green-100 text-green-800',
  CHARGES_DIVERSES: 'bg-purple-100 text-purple-800',
  AUTRE: 'bg-gray-100 text-gray-800',
};

function categoryIcon(category: Category) {
  switch (category) {
    case 'LOYER':
      return <Home className="h-4 w-4" />;
    case 'SALAIRE':
      return <Users className="h-4 w-4" />;
    case 'CHARGES_DIVERSES':
      return <Receipt className="h-4 w-4" />;
    default:
      return <MoreHorizontal className="h-4 w-4" />;
  }
}

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

/** "2026-08" -> "août 2026" (libellé lisible pour les en-têtes de cartes). */
function labelMois(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  if (!y || !m) return yearMonth;
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });
}

const normalizeText = (value: string | null | undefined) =>
  (value || '').trim().toLowerCase();

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

  // Filtres de la liste des modèles
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('tous');
  const [statutFilter, setStatutFilter] = useState<string>('tous');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FixedChargeRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    label: '',
    amount: '',
    category: 'LOYER' as Category,
    agentId: '' as string,
    isActive: true,
  });

  const [deleteTarget, setDeleteTarget] = useState<FixedChargeRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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
    setSaving(true);
    try {
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
    } finally {
      setSaving(false);
    }
  };

  const removeCharge = async () => {
    if (!deleteTarget) return;
    setMessage('');
    setError('');
    setDeleteBusy(true);
    try {
      const res = await api.request(`${api.endpoints.fixedCharges}/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || 'Suppression impossible');
        return;
      }
      const j = await res.json().catch(() => ({}));
      setMessage(j.message || 'OK');
      setDeleteTarget(null);
      await loadCharges();
    } finally {
      setDeleteBusy(false);
    }
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

  const filteredCharges = useMemo(() => {
    return fixedCharges.filter((row) => {
      const searchMatch =
        normalizeText(row.label).includes(normalizeText(searchQuery)) ||
        normalizeText(CATEGORY_LABELS[row.category]).includes(normalizeText(searchQuery)) ||
        normalizeText(row.agent?.nom).includes(normalizeText(searchQuery));
      const categoryMatch = categoryFilter === 'tous' || row.category === categoryFilter;
      const statutMatch =
        statutFilter === 'tous' ||
        (statutFilter === 'actif' ? row.isActive : !row.isActive);
      return searchMatch && categoryMatch && statutMatch;
    });
  }, [fixedCharges, searchQuery, categoryFilter, statutFilter]);

  const chargesActives = fixedCharges.filter((c) => c.isActive);
  const totalMensuelActif = chargesActives.reduce((sum, c) => sum + c.amount, 0);
  const totalGenereMois = occurrences.reduce((sum, o) => sum + o.amount, 0);

  const filtresActifs =
    searchQuery !== '' || categoryFilter !== 'tous' || statutFilter !== 'tous';

  return (
    <RoleProtectedRoute minRole="ADMIN">
      <div
        data-skip-unsaved-dirty
        className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* En-tête */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900">Gestion des Charges Fixes</h1>
              <p className="text-sm text-gray-600">
                Modèles mensuels : une dépense est créée automatiquement chaque mois (cron le 1er à
                06:00). Les lignes apparaissent aussi dans{' '}
                <Link href="/depenses" className="text-blue-600 hover:underline font-medium">
                  Dépenses
                </Link>
                .
              </p>
            </div>
            <Button onClick={openCreate} className="shrink-0">
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle Charge
            </Button>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-3 bg-red-50 border-2 border-red-200 rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                {error}
              </div>
            </div>
          )}
          {message && (
            <div className="mb-3 bg-green-50 border-2 border-green-200 rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-green-800">
                <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                {message}
              </div>
            </div>
          )}

          {/* Statistiques */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-blue-100 text-sm font-medium">Total mensuel</p>
                    <p
                      className={`${classeTailleMontant(totalMensuelActif)} font-bold leading-tight tabular-nums`}
                      title={formatMontant(totalMensuelActif)}
                    >
                      {formatMontant(totalMensuelActif)}
                    </p>
                    <p className="text-xs text-blue-100">charges actives</p>
                  </div>
                  <Wallet className="h-6 w-6 text-blue-200 shrink-0" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-green-100 text-sm font-medium">Charges actives</p>
                    <p className="text-xl font-bold leading-tight tabular-nums">
                      {chargesActives.length}
                    </p>
                    <p className="text-xs text-green-100">
                      sur {fixedCharges.length} modèle{fixedCharges.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  <ListChecks className="h-6 w-6 text-green-200 shrink-0" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-purple-100 text-sm font-medium">Généré ce mois</p>
                    <p
                      className={`${classeTailleMontant(totalGenereMois)} font-bold leading-tight tabular-nums`}
                      title={formatMontant(totalGenereMois)}
                    >
                      {formatMontant(totalGenereMois)}
                    </p>
                    <p className="text-xs text-purple-100 capitalize truncate">
                      {labelMois(yearMonth)}
                    </p>
                  </div>
                  <Receipt className="h-6 w-6 text-purple-200 shrink-0" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white">
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-orange-100 text-sm font-medium">Dépenses générées</p>
                    <p className="text-xl font-bold leading-tight tabular-nums">
                      {occurrences.length}
                    </p>
                    <p className="text-xs text-orange-100 capitalize truncate">
                      {labelMois(yearMonth)}
                    </p>
                  </div>
                  <FileSpreadsheet className="h-6 w-6 text-orange-200 shrink-0" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Génération manuelle */}
          <Card className="mb-4 border-none shadow-lg">
            <CardHeader className="px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-base text-gray-800">
                <CalendarClock className="h-4 w-4" />
                Générer les dépenses d&apos;un mois
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="space-y-1">
                  <label htmlFor="gen-month" className="text-sm font-medium text-gray-700">
                    Mois (AAAA-MM)
                  </label>
                  <Input
                    id="gen-month"
                    type="month"
                    value={genMonth}
                    onChange={(e) => setGenMonth(e.target.value)}
                    className="w-full sm:w-48 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <Button onClick={runGenerate} disabled={genBusy} className="shrink-0">
                  <RefreshCw className={`h-4 w-4 mr-2 ${genBusy ? 'animate-spin' : ''}`} />
                  {genBusy ? 'Génération…' : 'Générer'}
                </Button>
                <p className="text-xs text-gray-500 sm:ml-2 sm:pb-2">
                  Les dépenses déjà présentes pour ce mois ne sont jamais dupliquées.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Filtres */}
          <Card className="mb-4 border-none shadow-lg">
            <CardHeader className="px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-base text-gray-800">
                <Filter className="h-4 w-4" />
                Filtres
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Recherche</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Libellé, catégorie, agent..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Catégorie</label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tous">Toutes les catégories</SelectItem>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Statut</label>
                  <Select value={statutFilter} onValueChange={setStatutFilter}>
                    <SelectTrigger className="border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tous">Tous les statuts</SelectItem>
                      <SelectItem value="actif">Actif</SelectItem>
                      <SelectItem value="inactif">Inactif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Modèles de charges */}
          <Card className="mb-4 border-none shadow-lg">
            <CardHeader className="px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-base text-gray-800">
                <Wallet className="h-4 w-4" />
                Modèles de charges ({filteredCharges.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              {loading ? (
                <div className="py-12 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
                  <p className="text-gray-600 text-sm">Chargement des charges fixes...</p>
                </div>
              ) : filteredCharges.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-4">
                    <Wallet className="h-6 w-6 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Aucune charge fixe trouvée
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {filtresActifs
                      ? 'Aucune charge ne correspond aux filtres appliqués.'
                      : 'Commencez par créer un modèle de charge mensuelle.'}
                  </p>
                  {!filtresActifs && (
                    <Button onClick={openCreate}>
                      <Plus className="mr-2 h-4 w-4" />
                      Ajouter une charge
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Libellé
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Catégorie
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Montant
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Agent
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Statut
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Générations
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredCharges.map((row) => (
                        <tr
                          key={row.id}
                          className={`hover:bg-blue-50/50 transition-colors ${row.isActive ? '' : 'opacity-70'}`}
                        >
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                            {row.label}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Badge
                              className={`inline-flex items-center gap-1.5 font-semibold border-0 ${CATEGORY_COLORS[row.category]}`}
                            >
                              {categoryIcon(row.category)}
                              {CATEGORY_LABELS[row.category]}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap font-bold text-blue-900 tabular-nums">
                            {formatMontant(row.amount)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                            {row.agent?.nom ?? '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {row.isActive ? (
                              <Badge className="bg-green-100 text-green-800 border-0 font-semibold">
                                Actif
                              </Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-700 border-0 font-semibold">
                                Inactif
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-700 tabular-nums">
                            {row._count.occurrences}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                onClick={() => openEdit(row)}
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 rounded-lg font-medium transition-all duration-200"
                              >
                                <Pencil className="h-3 w-3 mr-1" />
                                Modifier
                              </Button>
                              <Button
                                onClick={() => setDeleteTarget(row)}
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 rounded-lg font-medium transition-all duration-200"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Supprimer
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dépenses générées */}
          <Card className="border-none shadow-lg">
            <CardHeader className="px-4 py-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base text-gray-800">
                  <Receipt className="h-4 w-4" />
                  Dépenses générées ({occurrences.length})
                  <span className="font-normal text-gray-500 capitalize">
                    — {labelMois(yearMonth)}
                  </span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Label htmlFor="occ-month" className="text-sm font-medium text-gray-700">
                    Mois
                  </Label>
                  <Input
                    id="occ-month"
                    type="month"
                    value={yearMonth}
                    onChange={(e) => setYearMonth(e.target.value)}
                    className="w-44 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              {occLoading ? (
                <div className="py-12 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
                  <p className="text-gray-600 text-sm">Chargement des dépenses générées...</p>
                </div>
              ) : occurrences.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-4">
                    <Receipt className="h-6 w-6 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Aucune dépense générée
                  </h3>
                  <p className="text-gray-500">
                    Aucune dépense n&apos;a encore été générée pour {labelMois(yearMonth)}.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Charge
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Catégorie
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Montant
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Dépense
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {occurrences.map((o) => (
                        <tr key={o.id} className="hover:bg-blue-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="text-sm font-semibold text-gray-900">
                              {o.fixedCharge.label}
                            </div>
                            <div className="text-xs text-gray-500">{o.expense.description}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Badge
                              className={`inline-flex items-center gap-1.5 font-semibold border-0 ${CATEGORY_COLORS[o.fixedCharge.category]}`}
                            >
                              {categoryIcon(o.fixedCharge.category)}
                              {CATEGORY_LABELS[o.fixedCharge.category]}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap font-bold text-blue-900 tabular-nums">
                            {formatMontant(o.amount)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Badge className="bg-blue-100 text-blue-800 border-0 font-semibold">
                              #{o.expense.id}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td
                          colSpan={2}
                          className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                        >
                          Total du mois
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-blue-900 tabular-nums">
                          {formatMontant(totalGenereMois)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Formulaire création / modification */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-blue-600" />
                  {editing ? 'Modifier la charge' : 'Nouvelle charge fixe'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1">
                  <Label htmlFor="fc-label" className="text-sm font-medium text-gray-700">
                    Libellé
                  </Label>
                  <Input
                    id="fc-label"
                    value={form.label}
                    onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                    placeholder="Ex. Loyer bureau"
                    className="border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fc-amount" className="text-sm font-medium text-gray-700">
                    Montant (DH)
                  </Label>
                  <Input
                    id="fc-amount"
                    type="text"
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0"
                    className="border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-gray-700">Catégorie</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm((f) => ({ ...f, category: v as Category }))}
                  >
                    <SelectTrigger className="border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
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
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-gray-700">
                    Agent (optionnel, ex. salaire)
                  </Label>
                  <Select
                    value={form.agentId || '__none__'}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, agentId: v === '__none__' ? '' : v }))
                    }
                  >
                    <SelectTrigger className="border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
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
                <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-gray-200 px-3 py-2">
                  <div className="min-w-0">
                    <Label htmlFor="fc-active" className="text-sm font-medium text-gray-700">
                      Charge active
                    </Label>
                    <p className="text-xs text-gray-500">
                      Participe à la génération mensuelle automatique.
                    </p>
                  </div>
                  <Switch
                    id="fc-active"
                    checked={form.isActive}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                  Annuler
                </Button>
                <Button onClick={saveCharge} disabled={saving}>
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Enregistrement...
                    </>
                  ) : (
                    'Enregistrer'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Confirmation de suppression */}
          <DeleteConfirmation
            isOpen={deleteTarget !== null}
            onClose={() => setDeleteTarget(null)}
            onConfirm={removeCharge}
            loading={deleteBusy}
            title="Supprimer la charge fixe"
            description={
              deleteTarget && deleteTarget._count.occurrences > 0
                ? 'Cette charge a déjà généré des dépenses : elle sera désactivée et cessera de générer de nouvelles lignes.'
                : 'Cette charge n’a généré aucune dépense : elle sera supprimée définitivement.'
            }
            itemName={deleteTarget?.label ?? ''}
            isHardDelete={deleteTarget ? deleteTarget._count.occurrences === 0 : false}
          />
        </div>
      </div>
    </RoleProtectedRoute>
  );
}
