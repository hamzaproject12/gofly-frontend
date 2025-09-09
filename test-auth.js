// Script de test pour l'authentification
const BASE_URL = 'http://localhost:5000';

async function testAuth() {
  console.log('🧪 Test du système d\'authentification...\n');

  try {
    // Test 1: Inscription
    console.log('1️⃣ Test d\'inscription...');
    const registerResponse = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nom: 'Agent Test',
        email: 'test@example.com',
        motDePasse: 'password123'
      })
    });

    const registerData = await registerResponse.json();
    console.log('✅ Inscription:', registerResponse.ok ? 'Succès' : 'Échec');
    console.log('📄 Réponse:', registerData);

    if (!registerResponse.ok) {
      console.log('❌ Erreur d\'inscription:', registerData.error);
      return;
    }

    // Test 2: Connexion
    console.log('\n2️⃣ Test de connexion...');
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        motDePasse: 'password123'
      })
    });

    const loginData = await loginResponse.json();
    console.log('✅ Connexion:', loginResponse.ok ? 'Succès' : 'Échec');
    console.log('📄 Réponse:', loginData);

    if (!loginResponse.ok) {
      console.log('❌ Erreur de connexion:', loginData.error);
      return;
    }

    // Récupérer le cookie d'authentification
    const authCookie = loginResponse.headers.get('set-cookie');
    console.log('🍪 Cookie d\'authentification:', authCookie ? 'Présent' : 'Absent');

    // Test 3: Profil (avec cookie)
    console.log('\n3️⃣ Test du profil...');
    const profileResponse = await fetch(`${BASE_URL}/api/auth/profile`, {
      method: 'GET',
      headers: {
        'Cookie': authCookie || '',
      }
    });

    const profileData = await profileResponse.json();
    console.log('✅ Profil:', profileResponse.ok ? 'Succès' : 'Échec');
    console.log('📄 Réponse:', profileData);

    // Test 4: Déconnexion
    console.log('\n4️⃣ Test de déconnexion...');
    const logoutResponse = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Cookie': authCookie || '',
      }
    });

    const logoutData = await logoutResponse.json();
    console.log('✅ Déconnexion:', logoutResponse.ok ? 'Succès' : 'Échec');
    console.log('📄 Réponse:', logoutData);

    console.log('\n🎉 Tous les tests sont terminés !');

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error.message);
  }
}

// Exécuter les tests
testAuth();
