'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { 
  Hotel, 
  Users, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  MapPin,
  Bed,
  UserCheck,
  UserX
} from 'lucide-react';

interface Agent {
  id: number;
  nom: string;
  email: string;
  isActive: boolean;
  createdAt: string;
}

interface Room {
  id: number;
  roomType: string;
  gender: string;
  totalPlaces: number;
  placesRestantes: number;
  placesOccupees: number;
  prixRoom: number;
  visualPlaces: Array<{
    isOccupied: boolean;
    color: 'green' | 'red';
  }>;
}

interface HotelData {
  hotelName: string;
  rooms: Room[];
}

interface Program {
  id: number;
  name: string;
  created_at: string;
  statistics: {
    totalRooms: number;
    totalPlaces: number;
    placesOccupees: number;
    placesRestantes: number;
    occupancyRate: string;
  };
  hotels: HotelData[];
}

interface RoomAvailabilityData {
  success: boolean;
  data: Program[];
  summary: {
    totalPrograms: number;
    totalRooms: number;
    totalPlaces: number;
    totalOccupied: number;
    totalAvailable: number;
  };
}

export default function HomePage() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [roomData, setRoomData] = useState<RoomAvailabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Récupérer les données du profil et la disponibilité des chambres en parallèle
      const [profileResponse, roomResponse] = await Promise.all([
        fetch('/api/auth/profile', { credentials: 'include' }),
        fetch(api.url(api.endpoints.roomAvailability))
      ]);

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        setAgent(profileData.agent);
      }

      if (roomResponse.ok) {
        const roomData = await roomResponse.json();
        setRoomData(roomData);
      } else {
        throw new Error('Erreur lors du chargement de la disponibilité des chambres');
      }
    } catch (error) {
      console.error('Erreur de récupération des données:', error);
      setError(error instanceof Error ? error.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const getRoomTypeIcon = (roomType: string) => {
    switch (roomType) {
      case 'SINGLE': return '🏠';
      case 'DOUBLE': return '🏘️';
      case 'TRIPLE': return '🏢';
      case 'QUAD': return '🏬';
      default: return '🏨';
    }
  };

  const getRoomTypeStyle = (roomType: string) => {
    switch (roomType) {
      case 'SINGLE':
        return {
          borderColor: 'border-blue-500',
          bgColor: 'bg-blue-50',
          textColor: 'text-blue-700',
          badgeColor: 'bg-blue-100 text-blue-800'
        };
      case 'DOUBLE':
        return {
          borderColor: 'border-green-500',
          bgColor: 'bg-green-50',
          textColor: 'text-green-700',
          badgeColor: 'bg-green-100 text-green-800'
        };
      case 'TRIPLE':
        return {
          borderColor: 'border-purple-500',
          bgColor: 'bg-purple-50',
          textColor: 'text-purple-700',
          badgeColor: 'bg-purple-100 text-purple-800'
        };
      case 'QUAD':
        return {
          borderColor: 'border-orange-500',
          bgColor: 'bg-orange-50',
          textColor: 'text-orange-700',
          badgeColor: 'bg-orange-100 text-orange-800'
        };
      default:
        return {
          borderColor: 'border-gray-500',
          bgColor: 'bg-gray-50',
          textColor: 'text-gray-700',
          badgeColor: 'bg-gray-100 text-gray-800'
        };
    }
  };

  const getGenderIcon = (gender: string) => {
    return gender === 'Homme' ? '👨' : gender === 'Femme' ? '👩' : '👥';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement de la disponibilité des chambres...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Erreur</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={fetchData}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header avec informations de l'agent */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                🏨 GoodFly Dashboard
              </h1>
              <p className="text-lg text-gray-600">
                Gestion des programmes Omra - Disponibilité des chambres
              </p>
            </div>
            {agent && (
              <div className="text-right">
                <p className="text-sm text-gray-500">Connecté en tant que</p>
                <p className="font-semibold text-gray-900">{agent.nom}</p>
                <Badge variant={agent.isActive ? "default" : "destructive"} className="mt-1">
                  {agent.isActive ? '🟢 Actif' : '🔴 Inactif'}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Légende des types de chambres */}
        <Card className="border-0 shadow-lg mb-6">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-blue-50">
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">🎨</span>
              <span>Légende des Types de Chambres</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-3 bg-blue-50 border-2 border-blue-500 rounded-lg">
                <span className="text-lg">🏠</span>
                <div>
                  <p className="font-medium text-blue-700">SINGLE</p>
                  <p className="text-xs text-blue-600">1 personne</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-green-50 border-2 border-green-500 rounded-lg">
                <span className="text-lg">🏘️</span>
                <div>
                  <p className="font-medium text-green-700">DOUBLE</p>
                  <p className="text-xs text-green-600">2 personnes</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-purple-50 border-2 border-purple-500 rounded-lg">
                <span className="text-lg">🏢</span>
                <div>
                  <p className="font-medium text-purple-700">TRIPLE</p>
                  <p className="text-xs text-purple-600">3 personnes</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-orange-50 border-2 border-orange-500 rounded-lg">
                <span className="text-lg">🏬</span>
                <div>
                  <p className="font-medium text-orange-700">QUAD</p>
                  <p className="text-xs text-orange-600">4 personnes</p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-green-600"></div>
                <span className="text-gray-600">Occupé</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-red-600"></div>
                <span className="text-gray-600">Libre</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistiques globales */}
        {roomData?.summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Programmes Actifs</p>
                    <p className="text-2xl font-bold text-indigo-600">{roomData.summary.totalPrograms}</p>
                  </div>
                  <Calendar className="h-8 w-8 text-indigo-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Chambres</p>
                    <p className="text-2xl font-bold text-blue-600">{roomData.summary.totalRooms}</p>
                  </div>
                  <Hotel className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Places Occupées</p>
                    <p className="text-2xl font-bold text-green-600">{roomData.summary.totalOccupied}</p>
                  </div>
                  <UserCheck className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Places Disponibles</p>
                    <p className="text-2xl font-bold text-red-600">{roomData.summary.totalAvailable}</p>
                  </div>
                  <UserX className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Liste des programmes */}
        <div className="space-y-6">
          {roomData?.data.map((program) => (
            <Card key={program.id} className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🎯</span>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{program.name}</h2>
                      <p className="text-sm text-gray-600">
                        Créé le {new Date(program.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-lg px-3 py-1">
                      {program.statistics.placesRestantes} / {program.statistics.totalPlaces}
                    </Badge>
                    <p className="text-sm text-gray-600 mt-1">
                      Taux d'occupation: {program.statistics.occupancyRate}%
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {program.hotels.map((hotel, hotelIndex) => (
                    <div key={hotelIndex} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center gap-2 mb-3">
                        <MapPin className="h-5 w-5 text-blue-500" />
                        <h3 className="font-semibold text-gray-900">{hotel.hotelName}</h3>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {hotel.rooms.map((room) => {
                          const roomStyle = getRoomTypeStyle(room.roomType);
                          return (
                            <div 
                              key={room.id} 
                              className={`${roomStyle.bgColor} rounded-lg p-4 border-2 ${roomStyle.borderColor} shadow-sm hover:shadow-md transition-shadow`}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{getRoomTypeIcon(room.roomType)}</span>
                                  <span className={`font-medium ${roomStyle.textColor}`}>
                                    {room.roomType} {getGenderIcon(room.gender)}
                                  </span>
                                </div>
                                <Badge className={`text-xs ${roomStyle.badgeColor}`}>
                                  {room.placesOccupees}/{room.totalPlaces}
                                </Badge>
                              </div>
                              
                              {/* Affichage visuel des places */}
                              <div className="flex items-center gap-1 mb-3">
                                {room.visualPlaces.map((place, index) => (
                                  <div
                                    key={index}
                                    className={`w-6 h-6 rounded-full border-2 ${
                                      place.color === 'green' 
                                        ? 'bg-green-500 border-green-600' 
                                        : 'bg-red-500 border-red-600'
                                    }`}
                                    title={place.isOccupied ? 'Occupé' : 'Libre'}
                                  />
                                ))}
                              </div>
                              
                              <div className="flex items-center justify-between text-sm">
                                <span className={roomStyle.textColor}>
                                  {room.placesOccupees} occupé{room.placesOccupees > 1 ? 's' : ''}
                                </span>
                                <span className={`font-medium ${roomStyle.textColor}`}>
                                  {room.prixRoom.toLocaleString()} DH
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {roomData?.data.length === 0 && (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-12 text-center">
              <div className="text-6xl mb-4">🏨</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Aucun programme trouvé</h3>
              <p className="text-gray-600">Aucun programme avec des chambres n'est disponible pour le moment.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}