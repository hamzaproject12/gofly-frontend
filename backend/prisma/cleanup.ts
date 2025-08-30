import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupHotels() {
  try {
    console.log('🧹 Début du nettoyage de la base de données...');

    // Récupérer tous les hôtels
    const allHotels = await prisma.hotel.findMany({
      orderBy: [
        { name: 'asc' },
        { city: 'asc' },
        { id: 'asc' }
      ]
    });

    console.log(`📊 Total d'hôtels trouvés: ${allHotels.length}`);

    // Identifier les doublons
    const seen = new Set<string>();
    const hotelsToDelete: number[] = [];

    for (const hotel of allHotels) {
      const key = `${hotel.name}-${hotel.city}`;
      if (seen.has(key)) {
        hotelsToDelete.push(hotel.id);
        console.log(`🗑️  Hôtel à supprimer: ${hotel.name} (${hotel.city}) - ID: ${hotel.id}`);
      } else {
        seen.add(key);
        console.log(`✅ Hôtel conservé: ${hotel.name} (${hotel.city}) - ID: ${hotel.id}`);
      }
    }

    if (hotelsToDelete.length > 0) {
      console.log(`\n🗑️  Suppression de ${hotelsToDelete.length} hôtels en double...`);
      
      // Supprimer les doublons
      await prisma.hotel.deleteMany({
        where: {
          id: {
            in: hotelsToDelete
          }
        }
      });

      console.log('✅ Doublons supprimés avec succès!');
    } else {
      console.log('✅ Aucun doublon trouvé!');
    }

    // Afficher le résultat final
    const finalHotels = await prisma.hotel.findMany({
      orderBy: [
        { city: 'asc' },
        { name: 'asc' }
      ]
    });

    console.log('\n📋 Hôtels finaux:');
    console.log('Madina:');
    finalHotels.filter(h => h.city === 'Madina').forEach(h => {
      console.log(`  - ${h.name} (ID: ${h.id})`);
    });
    
    console.log('Makkah:');
    finalHotels.filter(h => h.city === 'Makkah').forEach(h => {
      console.log(`  - ${h.name} (ID: ${h.id})`);
    });

    console.log(`\n🎉 Nettoyage terminé! ${finalHotels.length} hôtels uniques conservés.`);

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupHotels();
