import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Routes publiques qui ne nécessitent pas d'authentification
  const publicRoutes = ['/login', '/register'];
  
  // Vérifier si la route est publique
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Vérifier la présence du cookie d'authentification
  const authToken = request.cookies.get('authToken');
  
  if (!authToken) {
    // Rediriger vers la page de connexion si pas de token
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login, register (public routes)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login|register).*)',
  ],
};
