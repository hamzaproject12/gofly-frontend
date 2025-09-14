import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    
    const response = await fetch(`${process.env.BACKEND_URL || 'https://gofly-backend-production.up.railway.app'}/api/admin/agents`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
      credentials: 'include',
    });

    const data = await response.json();
    
    // Forward the response with proper headers
    const nextResponse = NextResponse.json(data, { status: response.status });
    
    // Forward any Set-Cookie headers from the backend
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      nextResponse.headers.set('Set-Cookie', setCookieHeader);
    }
    
    return nextResponse;
  } catch (error) {
    console.error('Get agents API error:', error);
    return NextResponse.json(
      { error: 'Erreur de connexion au serveur' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cookieHeader = request.headers.get('cookie') || '';
    
    const response = await fetch(`${process.env.BACKEND_URL || 'https://gofly-backend-production.up.railway.app'}/api/admin/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    // Forward the response with proper headers
    const nextResponse = NextResponse.json(data, { status: response.status });
    
    // Forward any Set-Cookie headers from the backend
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      nextResponse.headers.set('Set-Cookie', setCookieHeader);
    }
    
    return nextResponse;
  } catch (error) {
    console.error('Create agent API error:', error);
    return NextResponse.json(
      { error: 'Erreur de connexion au serveur' },
      { status: 500 }
    );
  }
}
