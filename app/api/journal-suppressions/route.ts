import { NextRequest, NextResponse } from 'next/server';

function backendUrl() {
  return process.env.BACKEND_URL || 'https://gofly-backend-production.up.railway.app';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.toString();
    const url = `${backendUrl()}/api/journal-suppressions${q ? `?${q}` : ''}`;

    const authHeader = request.headers.get('authorization');
    const cookieHeader = request.headers.get('cookie') || '';

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      credentials: 'include',
    });

    const data = await response.json();
    const nextResponse = NextResponse.json(data, { status: response.status });
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      nextResponse.headers.set('Set-Cookie', setCookieHeader);
    }
    return nextResponse;
  } catch (error) {
    console.error('journal-suppressions proxy:', error);
    return NextResponse.json({ error: 'Erreur de connexion au serveur' }, { status: 500 });
  }
}
