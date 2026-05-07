/** Backend Express par défaut (évite d’appeler le domaine Next par erreur). */
const DEFAULT_BACKEND_URL = 'https://gofly-backend-production.up.railway.app';

/**
 * URL de base de l’API Express.
 * Si `NEXT_PUBLIC_API_URL` pointe vers le **même origine** que la page (erreur fréquente sur Railway :
 * front et variable d’env copiée sur l’URL du front), les requêtes partent vers Next sans le middleware JWT
 * → 401 « Access token required ». On retombe alors sur le backend par défaut.
 */
function stripWww(host: string): string {
  return host.replace(/^www\./i, '').toLowerCase();
}

/** True si l’URL API configurée pointe vers le même site que la page (Next), pas Express. */
function apiUrlTargetsCurrentAppHost(normalized: string): boolean {
  if (typeof window === 'undefined' || !window.location?.hostname) return false;
  try {
    const absolute = normalized.startsWith('http') ? normalized : `https://${normalized}`;
    const apiHost = stripWww(new URL(absolute).hostname);
    const pageHost = stripWww(window.location.hostname);
    if (apiHost === pageHost) return true;
    // Hébergements type *-frontend* vs *-backend* : éviter d’appeler le host « front » par erreur
    if (apiHost.includes('frontend') && !apiHost.includes('backend')) return true;
  } catch {
    return false;
  }
  return false;
}

export function resolveApiBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (!raw || raw === '/') return DEFAULT_BACKEND_URL;

  const normalized = raw.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    try {
      const absolute = normalized.startsWith('http') ? normalized : `https://${normalized}`;
      const apiOrigin = new URL(absolute).origin;
      if (apiOrigin === window.location.origin || apiUrlTargetsCurrentAppHost(normalized)) {
        console.warn(
          '[api] URL API = même site que le front (ou host « frontend») ; utilisation du backend par défaut:',
          DEFAULT_BACKEND_URL
        );
        return DEFAULT_BACKEND_URL;
      }
    } catch {
      return DEFAULT_BACKEND_URL;
    }
  }

  return normalized;
}

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
    const base = resolveApiBaseUrl();
    return `${base}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  },
  // Fonction pour faire des requêtes avec l'authentification
  request: async (endpoint: string, options: RequestInit = {}) => {
    // Construit l'URL complète si ce n'est pas déjà une URL absolue
    const url = endpoint.startsWith('http') ? endpoint : api.url(endpoint);
    const token = getAuthToken();
    
    console.log(`🌐 API Config Base URL: ${resolveApiBaseUrl()}`);
    console.log(`🚀 API Request to: ${url}`);
    console.log(`🔑 Token available: ${!!token}`);
    
    const method = (options.method || 'GET').toUpperCase();
    const hasBody = options.body != null;
    const bodyIsFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const bodyIsBlob = typeof Blob !== 'undefined' && options.body instanceof Blob;
    const bodyIsUrlEncoded =
      typeof URLSearchParams !== 'undefined' && options.body instanceof URLSearchParams;

    const headers: Record<string, string> = {
      ...options.headers as Record<string, string>,
    };

    // Éviter d'imposer Content-Type sur GET/HEAD (important pour les exports fichiers).
    // Pour les requêtes JSON classiques, garder l'en-tête par défaut.
    if (
      !headers['Content-Type'] &&
      !headers['content-type'] &&
      hasBody &&
      method !== 'GET' &&
      method !== 'HEAD' &&
      !bodyIsFormData &&
      !bodyIsBlob &&
      !bodyIsUrlEncoded
    ) {
      headers['Content-Type'] = 'application/json';
    }
    
    // Ajouter le token dans l'Authorization header si disponible
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const defaultOptions: RequestInit = {
      credentials: 'include', // Inclure les cookies aussi
      headers,
    };

    // Important: si `options.headers` est fourni (POST/PUT fréquents),
    // on fusionne explicitement pour ne pas perdre Authorization injecté ci-dessus.
    const mergedOptions: RequestInit = {
      ...defaultOptions,
      ...options,
      headers: {
        ...(defaultOptions.headers as Record<string, string>),
        ...((options.headers as Record<string, string>) || {}),
      },
    };
    
    return fetch(url, mergedOptions);
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
