'use client';

import { useState, useEffect } from 'react';
import RoleProtectedRoute from '../components/RoleProtectedRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Building2, 
  MapPin, 
  X,
  Check,
  AlertCircle
} from 'lucide-react';

interface Hotel {
  id: number;
  name: string;
  city: 'Madina' | 'Makkah';
  programsMadina?: any[];
  programsMakkah?: any[];
}

export default function GestionHotelsPage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    city: 'Madina' as 'Madina' | 'Makkah'
  });

  useEffect(() => {
    fetchHotels();
  }, []);

  const fetchHotels = async () => {
    try {
      const response = await fetch('/api/hotels', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setHotels(data);
      } else {
        setError('Erreur lors du chargement des hôtels');
      }
    } catch (error) {
      console.error('Erreur:', error);
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/hotels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setHotels([data, ...hotels]);
        setShowCreateForm(false);
        setFormData({ name: '', city: 'Madina' });
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

  const handleUpdateHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHotel) return;

    setLoading(true);

    try {
      const response = await fetch(`/api/hotels/${editingHotel.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name,
          city: formData.city
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setHotels(hotels.map(hotel => 
          hotel.id === editingHotel.id ? data : hotel
        ));
        setEditingHotel(null);
        setFormData({ name: '', city: 'Madina' });
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

  const handleDeleteHotel = async (hotel: Hotel) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'hôtel "${hotel.name}" ?`)) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/hotels/${hotel.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setHotels(hotels.filter(h => h.id !== hotel.id));
        setError(''); // Clear any previous errors
      } else {
        const errorData = await response.json();
        if (errorData.error === 'Cannot delete hotel. It is used in programs.') {
          setError('Impossible de supprimer cet hôtel car il est utilisé dans des programmes.');
        } else {
          setError(errorData.error || 'Erreur lors de la suppression');
        }
      }
    } catch (error) {
      console.error('Erreur:', error);
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (hotel: Hotel) => {
    setEditingHotel(hotel);
    setFormData({
      name: hotel.name,
      city: hotel.city
    });
  };

  const getCityBadgeColor = (city: string) => {
    return city === 'Madina' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-blue-100 text-blue-800';
  };

  const getCityIcon = (city: string) => {
    return city === 'Madina' ? '🕌' : '🕋';
  };

  return (
    <RoleProtectedRoute allowedRoles={['ADMIN', 'AGENT']}>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Gestion des Hôtels</h1>
            <p className="mt-2 text-gray-600">Gérez les hôtels disponibles pour les programmes Omra</p>
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
                  <Building2 className="h-5 w-5 text-blue-600" />
                  Liste des Hôtels
                </h2>
                <Button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {showCreateForm ? 'Annuler' : 'Nouvel Hôtel'}
                </Button>
              </div>

              {/* Create/Edit Form */}
              {(showCreateForm || editingHotel) && (
                <Card className="mb-6 border-2 border-blue-100 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
                    <CardTitle className="flex items-center gap-2 text-blue-900">
                      <Building2 className="h-5 w-5" />
                      {editingHotel ? 'Modifier l\'hôtel' : 'Créer un nouvel hôtel'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <form onSubmit={editingHotel ? handleUpdateHotel : handleCreateHotel} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="hotel-name" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Nom de l'hôtel
                          </Label>
                          <Input
                            id="hotel-name"
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="h-12 text-base border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 shadow-sm"
                            placeholder="Ex: Hôtel Al Madinah Munawwarah"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="hotel-city" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Ville
                          </Label>
                          <select
                            id="hotel-city"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value as 'Madina' | 'Makkah' })}
                            className="h-12 w-full text-base border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 shadow-sm bg-white px-3"
                          >
                            <option value="Madina">🕌 Madina</option>
                            <option value="Makkah">🕋 Makkah</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="flex justify-end space-x-3 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowCreateForm(false);
                            setEditingHotel(null);
                            setFormData({ name: '', city: 'Madina' });
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
                              {editingHotel ? 'Mettre à jour' : 'Créer'}
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Hotels Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ville</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Programmes Madina</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Programmes Makkah</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {hotels.map((hotel) => (
                      <tr key={hotel.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {hotel.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge 
                            variant="secondary" 
                            className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${getCityBadgeColor(hotel.city)} border-0`}
                          >
                            {getCityIcon(hotel.city)} {hotel.city}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {hotel.programsMadina?.length || 0} programme(s)
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {hotel.programsMakkah?.length || 0} programme(s)
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <Button
                              onClick={() => startEdit(hotel)}
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 rounded-lg font-medium transition-all duration-200"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Modifier
                            </Button>
                            <Button
                              onClick={() => handleDeleteHotel(hotel)}
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

              {hotels.length === 0 && !loading && (
                <div className="text-center py-8">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100">
                    <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun hôtel</h3>
                  <p className="mt-1 text-sm text-gray-500">Commencez par créer un nouvel hôtel.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </RoleProtectedRoute>
  );
}
