const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://gofly-backend-production.up.railway.app';

export const api = {
  url: (endpoint: string) => {
    return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  },
  // Fonction pour faire des requêtes avec les cookies d'authentification
  request: async (url: string, options: RequestInit = {}) => {
    const defaultOptions: RequestInit = {
      credentials: 'include', // Inclure les cookies automatiquement
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };
    
    return fetch(url, { ...defaultOptions, ...options });
  },
  endpoints: {
    programs: '/api/programs',
    reservations: '/api/reservations',
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
    // Add other endpoints as needed
  }
};
