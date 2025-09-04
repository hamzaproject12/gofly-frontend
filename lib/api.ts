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
    // Add other endpoints as needed
  }
};
