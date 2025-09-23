import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${process.env.BACKEND_URL || 'https://gofly-backend-production.up.railway.app'}/api/hotels`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Get hotels API error:', error);
    return NextResponse.json(
      { error: 'Erreur de connexion au serveur' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cookieHeader = request.headers.get('Cookie');
    
    console.log('🏗️ Création d\'hôtel - Données:', body);
    console.log('🍪 Cookies reçus:', cookieHeader);
    
    const response = await fetch(`${process.env.BACKEND_URL || 'https://gofly-backend-production.up.railway.app'}/api/hotels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader || '',
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    const data = await response.json();
    console.log('📤 Réponse backend:', { status: response.status, data });
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Create hotel API error:', error);
    return NextResponse.json(
      { error: 'Erreur de connexion au serveur' },
      { status: 500 }
    );
  }
}
