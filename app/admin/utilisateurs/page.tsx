'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import RoleProtectedRoute from '../../components/RoleProtectedRoute';
import { api } from "@/lib/api";
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { formatDateFr } from '@/lib/format';
import {
  ROLE_BADGE_CLASSES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  peutAgirSur,
  rolesAttribuablesPar,
  type AgentRole,
} from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Edit,
  Trash2,
  Users,
  Mail,
  Shield,
  X,
  Check,
  AlertCircle,
  UserCheck,
  UserX,
  Search,
} from 'lucide-react';

interface Agent {
  id: number;
  nom: string;
  email: string;
  role: AgentRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Aligné sur la règle serveur (authController.MOT_DE_PASSE_MIN). */
const MOT_DE_PASSE_MIN = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_FORM = { nom: '', email: '', motDePasse: '', role: 'AGENT' as AgentRole };

export default function GestionUtilisateursPage() {
  // Les rôles proposés et les actions possibles découlent du rang de l'appelant
  // (voir lib/roles.ts). Le serveur applique la même règle, seule qui fasse foi.
  const { user } = useAuth();
  const { toast } = useToast();
  const monRole = user?.role;
  const rolesAttribuables = useMemo(() => rolesAttribuablesPar(monRole), [monRole]);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  // Suppression définitive : confirmation explicite avant appel API
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filtres de liste
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | AgentRole>('all');
  const [statutFilter, setStatutFilter] = useState<'all' | 'actif' | 'inactif'>('all');

  const [formData, setFormData] = useState(EMPTY_FORM);
  const formRef = useRef<HTMLDivElement | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.request('/api/admin/agents');

      if (response.ok) {
        const data = await response.json();
        setAgents(data.agents);
        setError('');
      } else {
        setError('Erreur lors du chargement des utilisateurs');
      }
    } catch (error) {
      console.error('Erreur:', error);
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Le formulaire s'ouvre en haut de page : sans ce recentrage, un clic sur
  // « Modifier » depuis le bas de la liste semble sans effet.
  useEffect(() => {
    if (showCreateForm || editingAgent) {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showCreateForm, editingAgent]);

  const resetForm = () => {
    setShowCreateForm(false);
    setEditingAgent(null);
    setFormData(EMPTY_FORM);
  };

  /** Validation client, alignée sur les règles du serveur. Renvoie null si tout est bon. */
  const validerFormulaire = (): string | null => {
    if (!formData.nom.trim()) return 'Le nom est requis';
    if (!EMAIL_REGEX.test(formData.email.trim())) return 'Adresse email invalide';

    const motDePasseRequis = !editingAgent;
    if (motDePasseRequis || formData.motDePasse !== '') {
      if (formData.motDePasse.length < MOT_DE_PASSE_MIN) {
        return `Le mot de passe doit contenir au moins ${MOT_DE_PASSE_MIN} caractères`;
      }
    }
    return null;
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();

    const erreur = validerFormulaire();
    if (erreur) {
      setError(erreur);
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.request('/api/admin/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: formData.nom.trim(),
          email: formData.email.trim(),
          motDePasse: formData.motDePasse,
          role: formData.role,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAgents(prev => [data.agent, ...prev]);
        resetForm();
        setError('');
        toast({
          title: 'Utilisateur créé',
          description: `${data.agent.nom} peut désormais se connecter.`,
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || 'Erreur lors de la création');
      }
    } catch (error) {
      console.error('Erreur:', error);
      setError('Erreur de connexion au serveur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent) return;

    const erreur = validerFormulaire();
    if (erreur) {
      setError(erreur);
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.request(`/api/admin/agents/${editingAgent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: formData.nom.trim(),
          email: formData.email.trim(),
          role: formData.role,
          isActive: editingAgent.isActive,
          // Champ vide = mot de passe inchangé
          ...(formData.motDePasse !== '' && { motDePasse: formData.motDePasse }),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAgents(prev => prev.map(agent => (agent.id === data.agent.id ? data.agent : agent)));
        resetForm();
        setError('');
        toast({
          title: 'Utilisateur mis à jour',
          description:
            formData.motDePasse !== ''
              ? `${data.agent.nom} — informations et mot de passe modifiés.`
              : `${data.agent.nom} — informations modifiées.`,
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Erreur:', error);
      setError('Erreur de connexion au serveur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (agent: Agent) => {
    setSubmitting(true);

    try {
      const response = await api.request(`/api/admin/agents/${agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !agent.isActive }),
      });

      if (response.ok) {
        const data = await response.json();
        setAgents(prev => prev.map(a => (a.id === data.agent.id ? data.agent : a)));
        setError('');
        toast({
          title: data.agent.isActive ? 'Compte activé' : 'Compte désactivé',
          description: data.agent.isActive
            ? `${data.agent.nom} peut de nouveau se connecter.`
            : `${data.agent.nom} ne peut plus se connecter. L'historique est conservé.`,
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Erreur:', error);
      setError('Erreur de connexion au serveur');
    } finally {
      setSubmitting(false);
    }
  };

  // Suppression définitive : le compte disparaît de la base et de la liste.
  const handleConfirmDelete = async () => {
    if (!agentToDelete) return;

    setDeleting(true);

    try {
      const response = await api.request(`/api/admin/agents/${agentToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setAgents(prev => prev.filter(a => a.id !== agentToDelete.id));
        setError('');
        toast({
          title: 'Utilisateur supprimé définitivement',
          description: `Le compte de ${agentToDelete.nom} a été effacé. La suppression est tracée dans le journal.`,
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Erreur:', error);
      setError('Erreur de connexion au serveur');
    } finally {
      setDeleting(false);
      setAgentToDelete(null);
    }
  };

  const startEdit = (agent: Agent) => {
    setShowCreateForm(false);
    setEditingAgent(agent);
    setFormData({
      nom: agent.nom,
      email: agent.email,
      motDePasse: '',
      role: agent.role,
    });
  };

  const filteredAgents = useMemo(() => {
    const recherche = search.trim().toLowerCase();

    return agents.filter(agent => {
      const rechercheOk =
        recherche === '' ||
        agent.nom.toLowerCase().includes(recherche) ||
        (agent.email ?? '').toLowerCase().includes(recherche);

      const roleOk = roleFilter === 'all' || agent.role === roleFilter;
      const statutOk =
        statutFilter === 'all' ||
        (statutFilter === 'actif' && agent.isActive) ||
        (statutFilter === 'inactif' && !agent.isActive);

      return rechercheOk && roleOk && statutOk;
    });
  }, [agents, search, roleFilter, statutFilter]);

  const filtresActifs = search.trim() !== '' || roleFilter !== 'all' || statutFilter !== 'all';

  const renderActions = (agent: Agent) => {
    const estSoiMeme = user?.agentId === agent.id;
    // On n'agit que sur un rang strictement inférieur : deux gérants sont pairs.
    const rangSuffisant = peutAgirSur(monRole, agent.role);
    const motifRangInsuffisant = `${ROLE_LABELS[agent.role]} : compte de rang égal ou supérieur au vôtre, vous ne pouvez pas le modifier`;

    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => startEdit(agent)}
          disabled={!rangSuffisant}
          title={
            estSoiMeme
              ? 'Passez par « Mon compte » pour modifier vos propres informations'
              : rangSuffisant
              ? 'Modifier ce compte'
              : motifRangInsuffisant
          }
          variant="outline"
          size="sm"
          className="h-8 px-3 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 rounded-lg font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Edit className="h-3 w-3 mr-1" />
          Modifier
        </Button>
        <Button
          onClick={() => handleToggleActive(agent)}
          disabled={submitting || estSoiMeme || !rangSuffisant}
          title={
            estSoiMeme
              ? 'Vous ne pouvez pas désactiver votre propre compte'
              : !rangSuffisant
              ? motifRangInsuffisant
              : agent.isActive
              ? 'Bloquer la connexion en conservant l\'historique'
              : 'Rétablir la connexion'
          }
          variant="outline"
          size="sm"
          className={`h-8 px-3 rounded-lg font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
            agent.isActive
              ? 'text-orange-600 border-orange-200 hover:bg-orange-50 hover:border-orange-300'
              : 'text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300'
          }`}
        >
          {agent.isActive ? (
            <>
              <UserX className="h-3 w-3 mr-1" />
              Désactiver
            </>
          ) : (
            <>
              <UserCheck className="h-3 w-3 mr-1" />
              Activer
            </>
          )}
        </Button>
        <Button
          onClick={() => setAgentToDelete(agent)}
          disabled={estSoiMeme || !rangSuffisant}
          title={
            estSoiMeme
              ? 'Vous ne pouvez pas supprimer votre propre compte'
              : !rangSuffisant
              ? motifRangInsuffisant
              : 'Supprimer définitivement cet utilisateur'
          }
          variant="outline"
          size="sm"
          className="h-8 px-3 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 rounded-lg font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Supprimer
        </Button>
      </div>
    );
  };

  const roleBadge = (agent: Agent) => (
    <Badge
      variant="secondary"
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border-0 ${ROLE_BADGE_CLASSES[agent.role]}`}
    >
      <Shield className="h-3 w-3 mr-1" />
      {ROLE_LABELS[agent.role]}
    </Badge>
  );

  const statutBadge = (agent: Agent) => (
    <Badge
      variant="secondary"
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border-0 ${
        agent.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}
    >
      {agent.isActive ? <UserCheck className="h-3 w-3 mr-1" /> : <UserX className="h-3 w-3 mr-1" />}
      {agent.isActive ? 'Actif' : 'Inactif'}
    </Badge>
  );

  return (
    <RoleProtectedRoute minRole="GERANT">
      <div className="min-h-screen bg-gray-50 py-4">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Gestion des Utilisateurs</h1>
            <p className="mt-1 text-sm text-gray-600">
              Réservée au gérant : les administrateurs pilotent l&apos;exploitation mais ne peuvent
              ni créer un compte ni changer le mot de passe d&apos;un collègue.
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

          <div className="bg-white shadow rounded-lg" ref={formRef}>
            <div className="p-3 sm:p-4">
              <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  Liste des Utilisateurs
                  <span className="text-sm font-normal text-gray-500">
                    ({filteredAgents.length}
                    {filtresActifs ? ` sur ${agents.length}` : ''})
                  </span>
                </h2>
                <Button
                  onClick={() => {
                    setEditingAgent(null);
                    setFormData(EMPTY_FORM);
                    setShowCreateForm(!showCreateForm);
                  }}
                  className="h-9 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {showCreateForm ? 'Annuler' : 'Nouvel Utilisateur'}
                </Button>
              </div>

              {/* Create/Edit Form */}
              {(showCreateForm || editingAgent) && (
                <Card className="mb-4 border-2 border-blue-100 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 p-3">
                    <CardTitle className="flex items-center gap-2 text-base text-blue-900">
                      <Users className="h-5 w-5" />
                      {editingAgent ? 'Modifier l\'utilisateur' : 'Créer un nouvel utilisateur'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4">
                    <form
                      onSubmit={editingAgent ? handleUpdateAgent : handleCreateAgent}
                      className="space-y-4"
                      noValidate
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="user-name" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Nom
                          </Label>
                          <Input
                            id="user-name"
                            type="text"
                            required
                            value={formData.nom}
                            onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                            className="h-9 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 shadow-sm"
                            placeholder="Ex: Jean Dupont"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="user-email" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Email
                          </Label>
                          <Input
                            id="user-email"
                            type="email"
                            required
                            autoComplete="off"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="h-9 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 shadow-sm"
                            placeholder="Ex: jean.dupont@example.com"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="user-password" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            {editingAgent ? 'Nouveau mot de passe' : 'Mot de passe'}
                          </Label>
                          <Input
                            id="user-password"
                            type="password"
                            required={!editingAgent}
                            autoComplete="new-password"
                            aria-describedby="user-password-help"
                            value={formData.motDePasse}
                            onChange={(e) => setFormData({ ...formData, motDePasse: e.target.value })}
                            className="h-9 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 shadow-sm"
                            placeholder="••••••••"
                          />
                          <p id="user-password-help" className="text-xs text-gray-500">
                            {editingAgent
                              ? `Laisser vide pour ne pas changer. Sinon ${MOT_DE_PASSE_MIN} caractères minimum.`
                              : `${MOT_DE_PASSE_MIN} caractères minimum.`}
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="user-role" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Rôle
                          </Label>
                          <Select
                            value={formData.role}
                            onValueChange={(value) => setFormData({ ...formData, role: value as AgentRole })}
                          >
                            <SelectTrigger
                              id="user-role"
                              className="h-9 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 shadow-sm bg-white"
                            >
                              <SelectValue placeholder="Choisir un rôle" />
                            </SelectTrigger>
                            <SelectContent>
                              {rolesAttribuables.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {ROLE_LABELS[role]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-gray-500">
                            {ROLE_DESCRIPTIONS[formData.role]}
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={resetForm}
                          className="h-9 px-4 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 rounded-xl font-medium transition-all duration-200"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Annuler
                        </Button>
                        <Button
                          type="submit"
                          disabled={submitting}
                          className="h-9 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
                        >
                          {submitting ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              En cours...
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              {editingAgent ? 'Mettre à jour' : 'Créer'}
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Filtres */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                <div className="lg:col-span-2 space-y-1.5">
                  <Label htmlFor="user-search" className="text-xs font-semibold text-gray-600">
                    Rechercher
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="user-search"
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Nom ou email"
                      className="h-9 pl-9 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-600">Rôle</Label>
                  <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as 'all' | AgentRole)}>
                    <SelectTrigger className="h-9 border-2 border-gray-200 rounded-xl bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les rôles</SelectItem>
                      {rolesAttribuables.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-600">Statut</Label>
                  <Select
                    value={statutFilter}
                    onValueChange={(v) => setStatutFilter(v as 'all' | 'actif' | 'inactif')}
                  >
                    <SelectTrigger className="h-9 border-2 border-gray-200 rounded-xl bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="actif">Actif</SelectItem>
                      <SelectItem value="inactif">Inactif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Chargement */}
              {loading && (
                <div className="space-y-2" aria-busy="true" aria-live="polite">
                  <span className="sr-only">Chargement des utilisateurs…</span>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
                  ))}
                </div>
              )}

              {/* Liste vide */}
              {!loading && filteredAgents.length === 0 && (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
                  <Users className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                  {agents.length === 0 ? (
                    <>
                      <p className="text-sm font-medium text-gray-700">Aucun utilisateur</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Créez un premier compte avec le bouton « Nouvel Utilisateur ».
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-gray-700">Aucun résultat</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Aucun utilisateur ne correspond à votre recherche.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearch('');
                          setRoleFilter('all');
                          setStatutFilter('all');
                        }}
                        className="h-8 mt-3 rounded-lg"
                      >
                        Réinitialiser les filtres
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Cartes (mobile) */}
              {!loading && filteredAgents.length > 0 && (
                <div className="md:hidden space-y-2">
                  {filteredAgents.map((agent) => (
                    <div key={agent.id} className="border border-gray-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{agent.nom}</p>
                          <p className="text-sm text-gray-500 truncate">{agent.email}</p>
                        </div>
                        {statutBadge(agent)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {roleBadge(agent)}
                        <span>Créé le {formatDateFr(agent.createdAt)}</span>
                      </div>
                      {renderActions(agent)}
                    </div>
                  ))}
                </div>
              )}

              {/* Tableau (desktop) */}
              {!loading && filteredAgents.length > 0 && (
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <caption className="sr-only">
                      Liste des comptes utilisateurs avec leur rôle, leur statut et les actions disponibles
                    </caption>
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rôle</th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Créé le</th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredAgents.map((agent) => (
                        <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                          <th scope="row" className="px-3 py-2 whitespace-nowrap text-sm font-medium text-left text-gray-900">
                            {agent.nom}
                            {user?.agentId === agent.id && (
                              <span className="ml-2 text-xs font-normal text-gray-400">(vous)</span>
                            )}
                          </th>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{agent.email}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{roleBadge(agent)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{statutBadge(agent)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                            {formatDateFr(agent.createdAt)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">
                            {renderActions(agent)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Confirmation de suppression définitive */}
        <AlertDialog
          open={agentToDelete !== null}
          onOpenChange={(open) => {
            if (!open && !deleting) setAgentToDelete(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                Supprimer définitivement cet utilisateur ?
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm text-gray-600">
                  <p>
                    Le compte de{' '}
                    <span className="font-semibold text-gray-900">{agentToDelete?.nom}</span>
                    {agentToDelete?.email ? ` (${agentToDelete.email})` : ''} sera{' '}
                    <span className="font-semibold text-red-700">effacé de la base de données</span>{' '}
                    et disparaîtra de cette liste. Cette action est irréversible.
                  </p>
                  <p>
                    Les réservations, paiements et dépenses déjà enregistrés sont conservés, mais ils
                    ne seront plus rattachés à cet utilisateur. La suppression reste tracée dans le
                    journal.
                  </p>
                  <p>
                    Pour simplement bloquer l’accès en gardant l’historique, utilisez plutôt{' '}
                    <span className="font-semibold">Désactiver</span>.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleConfirmDelete();
                }}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
              >
                {deleting ? 'Suppression…' : 'Supprimer définitivement'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </RoleProtectedRoute>
  );
}
