import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('API Logout: Début de la déconnexion');
    const cookieHeader = request.headers.get('cookie') || '';
    console.log('Cookies reçus:', cookieHeader);

    const response = await fetch(`${process.env.BACKEND_URL || 'https://gofly-backend-production.up.railway.app'}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
      credentials: 'include',
    });

    console.log('Réponse backend:', response.status, response.ok);

    const data = await response.json();
    console.log('Données backend:', data);

    // Créer une réponse avec les cookies
    const nextResponse = NextResponse.json(data, { status: response.status });
    
    // Copier les cookies du backend vers la réponse Next.js
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      console.log('Cookies à définir:', setCookieHeader);
      nextResponse.headers.set('set-cookie', setCookieHeader);
    }

    // Forcer la suppression du cookie côté client aussi
    nextResponse.headers.set('set-cookie', 'authToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict');

    console.log('API Logout: Déconnexion terminée');
    return nextResponse;
  } catch (error) {
    console.error('Logout API error:', error);
    return NextResponse.json(
      { error: 'Erreur de connexion au serveur' },
      { status: 500 }
    );
  }
}
