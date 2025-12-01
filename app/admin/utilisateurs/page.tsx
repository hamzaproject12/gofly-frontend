'use client';

import { useState, useEffect } from 'react';
import RoleProtectedRoute from '../../components/RoleProtectedRoute';
import { api } from "@/lib/api";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  UserX
} from 'lucide-react';

interface Agent {
  id: number;
  nom: string;
  email: string;
  role: 'ADMIN' | 'AGENT';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function GestionUtilisateursPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    nom: '',
    email: '',
    motDePasse: '',
    role: 'AGENT' as 'ADMIN' | 'AGENT'
  });

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await fetch(api.url('/api/admin/agents'), {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setAgents(data.agents);
      } else {
        setError('Erreur lors du chargement des utilisateurs');
      }
    } catch (error) {
      console.error('Erreur:', error);
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(api.url('/api/admin/agents'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setAgents([data.agent, ...agents]);
        setShowCreateForm(false);
        setFormData({ nom: '', email: '', motDePasse: '', role: 'AGENT' });
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Erreur lors de la création');
      }
    } catch (error) {
      console.error('Erreur:', error);
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent) return;

    setLoading(true);

    try {
      const response = await fetch(api.url(`/api/admin/agents/${editingAgent.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          nom: formData.nom,
          email: formData.email,
          role: formData.role,
          isActive: editingAgent.isActive
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAgents(agents.map(agent => 
          agent.id === editingAgent.id ? data.agent : agent
        ));
        setEditingAgent(null);
        setFormData({ nom: '', email: '', motDePasse: '', role: 'AGENT' });
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Erreur:', error);
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (agent: Agent) => {
    setLoading(true);

    try {
      const response = await fetch(api.url(`/api/admin/agents/${agent.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          isActive: !agent.isActive
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAgents(agents.map(a => 
          a.id === agent.id ? data.agent : a
        ));
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Erreur:', error);
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAgent = async (agent: Agent) => {
    if (!confirm(`Êtes-vous sûr de vouloir désactiver ${agent.nom} ?`)) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(api.url(`/api/admin/agents/${agent.id}`), {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setAgents(agents.map(a => 
          a.id === agent.id ? { ...a, isActive: false } : a
        ));
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Erreur:', error);
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      nom: agent.nom,
      email: agent.email,
      motDePasse: '',
      role: agent.role
    });
  };

  return (
    <RoleProtectedRoute allowedRoles={['ADMIN']}>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Gestion des Utilisateurs</h1>
            <p className="mt-2 text-gray-600">Gérez les comptes utilisateurs et leurs rôles</p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 text-red-500" />
                {error}
              </div>
            </div>
          )}

          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  Liste des Utilisateurs
                </h2>
                <Button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {showCreateForm ? 'Annuler' : 'Nouvel Utilisateur'}
                </Button>
              </div>

              {/* Create/Edit Form */}
              {(showCreateForm || editingAgent) && (
                <Card className="mb-6 border-2 border-blue-100 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
                    <CardTitle className="flex items-center gap-2 text-blue-900">
                      <Users className="h-5 w-5" />
                    {editingAgent ? 'Modifier l\'utilisateur' : 'Créer un nouvel utilisateur'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <form onSubmit={editingAgent ? handleUpdateAgent : handleCreateAgent} className="space-y-6">
                  
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
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
                            className="h-12 text-base border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 shadow-sm"
                            placeholder="Ex: Jean Dupont"
                      />
                    </div>
                    
                        <div className="space-y-2">
                          <Label htmlFor="user-email" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Email
                          </Label>
                          <Input
                            id="user-email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="h-12 text-base border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 shadow-sm"
                            placeholder="Ex: jean.dupont@example.com"
                      />
                    </div>
                    
                        <div className="space-y-2">
                          <Label htmlFor="user-password" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                        Mot de passe {editingAgent && '(laisser vide pour ne pas changer)'}
                          </Label>
                          <Input
                            id="user-password"
                        type="password"
                        required={!editingAgent}
                        value={formData.motDePasse}
                        onChange={(e) => setFormData({ ...formData, motDePasse: e.target.value })}
                            className="h-12 text-base border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 shadow-sm"
                            placeholder="••••••••"
                      />
                    </div>
                    
                        <div className="space-y-2">
                          <Label htmlFor="user-role" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Rôle
                          </Label>
                      <select
                            id="user-role"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value as 'ADMIN' | 'AGENT' })}
                            className="h-12 w-full text-base border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 shadow-sm bg-white px-3"
                      >
                        <option value="AGENT">Agent</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </div>
                  </div>
                  
                      <div className="flex justify-end space-x-3 pt-4">
                        <Button
                      type="button"
                          variant="outline"
                      onClick={() => {
                        setShowCreateForm(false);
                        setEditingAgent(null);
                        setFormData({ nom: '', email: '', motDePasse: '', role: 'AGENT' });
                      }}
                          className="h-11 px-6 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 rounded-xl font-medium transition-all duration-200"
                    >
                          <X className="h-4 w-4 mr-2" />
                      Annuler
                        </Button>
                        <Button
                      type="submit"
                      disabled={loading}
                          className="h-11 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
                        >
                          {loading ? (
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

              {/* Users Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rôle</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Créé le</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {agents.map((agent) => (
                      <tr key={agent.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {agent.nom}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {agent.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge 
                            variant="secondary" 
                            className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${
                            agent.role === 'ADMIN' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-blue-100 text-blue-800'
                            } border-0`}
                          >
                            <Shield className="h-3 w-3 mr-1" />
                            {agent.role}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge 
                            variant="secondary" 
                            className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${
                            agent.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                            } border-0`}
                          >
                            {agent.isActive ? (
                              <UserCheck className="h-3 w-3 mr-1" />
                            ) : (
                              <UserX className="h-3 w-3 mr-1" />
                            )}
                            {agent.isActive ? 'Actif' : 'Inactif'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(agent.createdAt).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <Button
                            onClick={() => startEdit(agent)}
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 rounded-lg font-medium transition-all duration-200"
                          >
                              <Edit className="h-3 w-3 mr-1" />
                            Modifier
                            </Button>
                            <Button
                            onClick={() => handleToggleActive(agent)}
                              variant="outline"
                              size="sm"
                              className={`h-8 px-3 rounded-lg font-medium transition-all duration-200 ${
                              agent.isActive 
                                  ? 'text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300' 
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
                            onClick={() => handleDeleteAgent(agent)}
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
            </div>
          </div>
        </div>
      </div>
    </RoleProtectedRoute>
  );
}
