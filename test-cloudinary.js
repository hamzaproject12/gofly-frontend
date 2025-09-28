// Test script pour vérifier l'intégration Cloudinary
// À exécuter après le déploiement Railway

const testCloudinaryIntegration = async () => {
  const API_BASE_URL = 'https://gofly-backend-production.up.railway.app';
  
  console.log('🧪 Testing Cloudinary Integration...');
  
  try {
    // Test 1: Vérifier que la route existe
    console.log('1️⃣ Testing route availability...');
    const healthResponse = await fetch(`${API_BASE_URL}/health`);
    if (healthResponse.ok) {
      console.log('✅ Server is running');
    } else {
      throw new Error('Server not responding');
    }
    
    // Test 2: Tester l'upload (avec un fichier de test)
    console.log('2️⃣ Testing Cloudinary upload...');
    
    // Créer un fichier de test simple (1x1 pixel PNG)
    const testFile = new File(['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='], 'test.png', { type: 'image/png' });
    
    const formData = new FormData();
    formData.append('file', testFile);
    formData.append('reservationId', '1'); // Utiliser une réservation existante
    formData.append('fileType', 'payment');
    
    const uploadResponse = await fetch(`${API_BASE_URL}/api/upload-cloudinary`, {
      method: 'POST',
      body: formData
    });
    
    if (uploadResponse.ok) {
      const result = await uploadResponse.json();
      console.log('✅ Upload successful!', result);
      
      // Test 3: Tester la récupération des infos
      if (result.results && result.results.length > 0) {
        const fileId = result.results[0].id;
        console.log('3️⃣ Testing file info retrieval...');
        
        const infoResponse = await fetch(`${API_BASE_URL}/api/upload-cloudinary/${fileId}/info`);
        if (infoResponse.ok) {
          const fileInfo = await infoResponse.json();
          console.log('✅ File info retrieved:', fileInfo);
          
          // Test 4: Tester la suppression
          console.log('4️⃣ Testing file deletion...');
          const deleteResponse = await fetch(`${API_BASE_URL}/api/upload-cloudinary/${fileId}`, {
            method: 'DELETE'
          });
          
          if (deleteResponse.ok) {
            console.log('✅ File deleted successfully');
            console.log('🎉 All Cloudinary tests passed!');
          } else {
            console.error('❌ File deletion failed');
          }
        } else {
          console.error('❌ File info retrieval failed');
        }
      }
    } else {
      const error = await uploadResponse.text();
      console.error('❌ Upload failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Exécuter le test
testCloudinaryIntegration();
