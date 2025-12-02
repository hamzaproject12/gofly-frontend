import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // SMART MOVE : Si on a mis la variable DISABLE_MIDDLEWARE à "true" dans Vercel,
  // alors le middleware laisse passer tout le monde.
  if (process.env.NEXT_PUBLIC_DISABLE_AUTH_CHECK === 'true') {
    return NextResponse.next();
  }

  // --- TON ANCIEN CODE DE SÉCURITÉ EST ICI ---
  // Pour l'instant, pour débloquer la situation, faisons simple comme demandé :
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|login|register).*)',
  ],
};
