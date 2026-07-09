export const siteConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME || 'GoFly App',
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'Application de gestion pour agence de voyage Omra',
  logo: process.env.NEXT_PUBLIC_APP_LOGO || '/logo-gofly.png', // Default logo
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contact@gofly.com',
};

/** Système de crédits prépayés (1 crédit = 1 pèlerin enregistré). */
export const creditsConfig = {
  /** Numéro WhatsApp du fournisseur (format international sans +, pour wa.me). */
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '212659607213',
  /** Prix d'un crédit en DH (placeholder configurable). */
  prixCreditDh: Number(process.env.NEXT_PUBLIC_CREDIT_PRICE_DH || '10'),
  /** Packs proposés sur la page /credits. */
  packs: [
    { label: 'Pack 50', credits: 50 },
    { label: 'Pack 150', credits: 150 },
    { label: 'Pack 500', credits: 500 },
  ],
};
