const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://gofly-backend-production.up.railway.app';

export const api = {
  url: (endpoint: string) => {
    return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  },
  endpoints: {
    programs: '/api/programs',
    reservations: '/api/reservations',
    expenses: '/api/expenses',
    upload: '/api/upload',
    hotels: '/api/hotels',
    payments: '/api/payments',
    health: '/health',
    test: '/api/test',
    // Program overview endpoints
    programOverview: (id: number) => `/api/programs/${id}/overview`,
    allProgramsOverview: '/api/programs/overview/all',
    globalStats: '/api/programs/stats/global',
    // Add other endpoints as needed
  }
};
