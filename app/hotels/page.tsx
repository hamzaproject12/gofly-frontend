'use client';

import { useState, useEffect } from 'react';
import RoleProtectedRoute from '../components/RoleProtectedRoute';

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
            <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-gray-900">Liste des Hôtels</h2>
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  {showCreateForm ? 'Annuler' : 'Nouvel Hôtel'}
                </button>
              </div>

              {/* Create/Edit Form */}
              {(showCreateForm || editingHotel) && (
                <form onSubmit={editingHotel ? handleUpdateHotel : handleCreateHotel} className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {editingHotel ? 'Modifier l\'hôtel' : 'Créer un nouvel hôtel'}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Nom de l'hôtel</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Ex: Hôtel Al Madinah Munawwarah"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Ville</label>
                      <select
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value as 'Madina' | 'Makkah' })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      >
                        <option value="Madina">🕌 Madina</option>
                        <option value="Makkah">🕋 Makkah</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false);
                        setEditingHotel(null);
                        setFormData({ name: '', city: 'Madina' });
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {loading ? 'En cours...' : (editingHotel ? 'Mettre à jour' : 'Créer')}
                    </button>
                  </div>
                </form>
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
                          <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getCityBadgeColor(hotel.city)}`}>
                            {getCityIcon(hotel.city)} {hotel.city}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {hotel.programsMadina?.length || 0} programme(s)
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {hotel.programsMakkah?.length || 0} programme(s)
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => startEdit(hotel)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDeleteHotel(hotel)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Supprimer
                          </button>
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
