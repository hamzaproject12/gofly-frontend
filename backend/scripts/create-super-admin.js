/**
 * Création du compte SUPER_ADMIN (fournisseur du logiciel).
 *
 * Ce compte n'est PAS créable via l'API (rejeté volontairement) : il se crée
 * uniquement avec ce script, une fois par instance.
 *
 * Variables d'environnement requises (JAMAIS de valeur en dur, JAMAIS committées) :
 *   SUPER_ADMIN_EMAIL      email du compte fournisseur
 *   SUPER_ADMIN_PASSWORD   mot de passe (min. 8 caractères)
 *
 * Lancement sur Railway (depuis le service backend) :
 *   - via le shell Railway (onglet du service → Shell) :
 *       SUPER_ADMIN_EMAIL=fournisseur@exemple.com SUPER_ADMIN_PASSWORD='MotDePasseBidon!42' node scripts/create-super-admin.js
 *   - ou depuis votre machine avec la CLI Railway (utilise le DATABASE_URL du service) :
 *       railway run --service backend node scripts/create-super-admin.js
 *     (définissez SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD comme variables temporaires,
 *      puis SUPPRIMEZ-LES des variables du service après exécution)
 *
 * Lancement en local (depuis le dossier backend/, DATABASE_URL lu depuis .env) :
 *   SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... node scripts/create-super-admin.js
 *
 * Idempotent : si un compte avec cet email existe déjà, le script ne modifie rien
 * et sort en succès.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !email.includes('@')) {
    console.error('❌ SUPER_ADMIN_EMAIL manquant ou invalide.');
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error('❌ SUPER_ADMIN_PASSWORD manquant ou trop court (min. 8 caractères).');
    process.exit(1);
  }

  const existing = await prisma.agent.findUnique({ where: { email } });
  if (existing) {
    console.log(`SUPER_ADMIN existe déjà (email ${email}) — aucune modification.`);
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  const agent = await prisma.agent.create({
    data: {
      nom: 'Fournisseur GoFly',
      email,
      motDePasse: hashed,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
    select: { id: true, nom: true, email: true, role: true },
  });

  console.log(`✅ Compte SUPER_ADMIN créé : id=${agent.id}, email=${agent.email}, nom="${agent.nom}".`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors de la création du SUPER_ADMIN :', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
