import { PrismaClient, RoomType, City } from '@prisma/client';
import { ensureWallet } from '../src/services/creditService';

const prisma = new PrismaClient();

async function main() {
  // Wallet de crédits prépayés : singleton (findFirst-or-create).
  // À la création uniquement : crédits de bienvenue (WELCOME_CREDITS, défaut 10)
  // + ligne BONUS. Si le wallet existe déjà, ne modifie rien (idempotent).
  const existingWallet = await prisma.wallet.findFirst();
  if (!existingWallet) {
    const wallet = await ensureWallet(prisma);
    console.log('Wallet crédits créé, id:', wallet.id, '- solde initial (bienvenue):', wallet.balance);
  } else {
    console.log('Wallet crédits déjà présent, id:', existingWallet.id, '- solde:', existingWallet.balance, '(aucune modification)');
  }

  // Création des hôtels
  // const hotels = await Promise.all([
  //   prisma.hotel.create({
  //     data: {
  //       name: 'Hôtel Al-Madinah',
  //       city: City.Madina,
  //     },
  //   }),
  //   prisma.hotel.create({
  //     data: {
  //       name: 'Hôtel Al-Nabawi',
  //       city: City.Madina,
  //     },
  //   }),
  //   prisma.hotel.create({
  //     data: {
  //       name: 'Hôtel Al-Makkah',
  //       city: City.Makkah,
  //     },
  //   }),
  //   prisma.hotel.create({
  //     data: {
  //       name: 'Hôtel Al-Haram',
  //       city: City.Makkah,
  //     },
  //   }),
  // ]);

  // Création des programmes avec la nouvelle structure
  // const programs = await Promise.all([
  //   prisma.program.create({
  //     data: {
  //       name: 'Programme Standard',
  //       nbJoursMadina: 4,
  //       nbJoursMakkah: 8,
  //       exchange: 1.0,
  //       prixAvionDH: 8000,
  //       prixVisaRiyal: 2000,
  //       profit: 5000,
  //     },
  //   }),
  //   prisma.program.create({
  //     data: {
  //       name: 'Programme Premium',
  //       nbJoursMadina: 5,
  //       nbJoursMakkah: 10,
  //       exchange: 1.0,
  //       prixAvionDH: 10000,
  //       prixVisaRiyal: 2500,
  //       profit: 8000,
  //     },
  //   }),
  //   prisma.program.create({
  //     data: {
  //       name: 'Programme VIP',
  //       nbJoursMadina: 6,
  //       nbJoursMakkah: 12,
  //       exchange: 1.0,
  //       prixAvionDH: 12000,
  //       prixVisaRiyal: 3000,
  //       profit: 12000,
  //     },
  //   }),
  //   prisma.program.create({
  //     data: {
  //       name: 'Programme Économique',
  //       nbJoursMadina: 3,
  //       nbJoursMakkah: 6,
  //       exchange: 1.0,
  //       prixAvionDH: 6000,
  //       prixVisaRiyal: 1500,
  //       profit: 3000,
  //     },
  //   }),
  //   prisma.program.create({
  //     data: {
  //       name: 'Programme Famille',
  //       nbJoursMadina: 4,
  //       nbJoursMakkah: 8,
  //       exchange: 1.0,
  //       prixAvionDH: 9000,
  //       prixVisaRiyal: 2200,
  //       profit: 6000,
  //     },
  //   }),
  // ]);

  // console.log('Hôtels créés avec succès:', hotels);
  // console.log('Programmes créés avec succès:', programs);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 