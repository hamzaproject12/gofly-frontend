const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://gofly-backend-production.up.railway.app';

// Fonction pour récupérer le token depuis localStorage
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const token = localStorage.getItem('authToken');
    if (token) {
      console.log('🔑 Token récupéré depuis localStorage:', token.substring(0, 20) + '...');
      return token;
    }
  } catch (error) {
    console.warn('⚠️ Erreur lors de la récupération du token:', error);
  }
  
  return null;
}

export const api = {
  url: (endpoint: string) => {
    return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  },
  // Fonction pour faire des requêtes avec l'authentification
  request: async (endpoint: string, options: RequestInit = {}) => {
    // Construit l'URL complète si ce n'est pas déjà une URL absolue
    const url = endpoint.startsWith('http') ? endpoint : api.url(endpoint);
    const token = getAuthToken();
    
    console.log(`🌐 API Config Base URL: ${API_BASE_URL}`);
    console.log(`🚀 API Request to: ${url}`);
    console.log(`🔑 Token available: ${!!token}`);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    // Ajouter le token dans l'Authorization header si disponible
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const defaultOptions: RequestInit = {
      credentials: 'include', // Inclure les cookies aussi
      headers,
    };
    
    return fetch(url, { ...defaultOptions, ...options });
  },
  endpoints: {
    programs: '/api/programs',
    reservations: '/api/reservations',
    /** Création transactionnelle leader + accompagnants (chambre privée) */
    reservationGroup: '/api/reservations/group',
    expenses: '/api/expenses',
    upload: '/api/upload',
    uploadCloudinary: '/api/upload-cloudinary',
    hotels: '/api/hotels',
    payments: '/api/payments',
    balance: '/api/balance',
    analytics: '/api/analytics',
    roomAvailability: '/api/room-availability',
    health: '/health',
    test: '/api/test',
    // Program overview endpoints
    programOverview: (id: number) => `/api/programs/${id}/overview`,
    allProgramsOverview: '/api/programs/overview/all',
    globalStats: '/api/programs/stats/global',
    /** Export Excel format agence (feuille par programme) */
    exportReservationsAgency: '/api/export/reservations/agency',
    /** Charges fixes mensuelles (admin) */
    fixedCharges: '/api/fixed-charges',
    // Add other endpoints as needed
  }
};
