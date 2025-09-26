import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedExpenses() {
  try {
    console.log('🌱 Seeding expenses...');

    // Récupérer les programmes existants
    const programs = await prisma.program.findMany();
    
    if (programs.length === 0) {
      console.log('❌ No programs found. Please seed programs first.');
      return;
    }

    // Créer des dépenses de test
    const expenses = [
      {
        description: "Réservation Groupe Imane - Madina",
        amount: 25000,
        type: "Hôtel",
        programId: programs[0]?.id,
        date: new Date('2024-01-20')
      },
      {
        description: "Billets d'avion groupe 15 personnes",
        amount: 45000,
        type: "Vol",
        programId: programs[0]?.id,
        date: new Date('2024-01-18')
      },
      {
        description: "Réservation Swissôtel Al Maqam - Makkah",
        amount: 18000,
        type: "Hôtel",
        programId: programs[1]?.id || programs[0]?.id,
        date: new Date('2024-06-15')
      },
      {
        description: "Frais de visa consulat",
        amount: 3500,
        type: "Autre",
        programId: null,
        date: new Date('2024-01-12')
      },
      {
        description: "Modification billets d'avion",
        amount: 2800,
        type: "Vol",
        programId: programs[2]?.id || programs[0]?.id,
        date: new Date('2024-05-10')
      },
      {
        description: "Réservation Borj Al Deafah - Makkah",
        amount: 32000,
        type: "Hôtel",
        programId: programs[1]?.id || programs[0]?.id,
        date: new Date('2024-06-20')
      },
      {
        description: "Billets d'avion groupe 20 personnes",
        amount: 60000,
        type: "Vol",
        programId: programs[2]?.id || programs[0]?.id,
        date: new Date('2024-04-25')
      },
      {
        description: "Réservation Emaar Grand - Makkah",
        amount: 28000,
        type: "Hôtel",
        programId: programs[2]?.id || programs[0]?.id,
        date: new Date('2024-05-30')
      }
    ];

    // Supprimer les dépenses existantes
    await prisma.expense.deleteMany();

    // Créer les nouvelles dépenses
    for (const expense of expenses) {
      await prisma.expense.create({
        data: expense
      });
    }

    console.log(`✅ Created ${expenses.length} expenses`);

  } catch (error) {
    console.error('❌ Error seeding expenses:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedExpenses();
