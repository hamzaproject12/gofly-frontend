/**
 * Hiérarchie des rôles — miroir de `backend/src/services/roleService.ts`.
 * Toute modification ici doit être répercutée côté serveur : le client ne fait
 * que masquer des boutons, la règle qui fait foi est celle du backend.
 */

export type AgentRole = 'AGENT' | 'ADMIN' | 'GERANT' | 'SUPER_ADMIN';

export const RANG_ROLE: Record<AgentRole, number> = {
  AGENT: 0,
  ADMIN: 1,
  GERANT: 2,
  SUPER_ADMIN: 3,
};

/** Libellés affichés : les codes de la base ne sont jamais montrés bruts. */
export const ROLE_LABELS: Record<AgentRole, string> = {
  AGENT: 'Agent',
  ADMIN: 'Administrateur',
  GERANT: 'Gérant',
  SUPER_ADMIN: 'Super admin',
};

/** Une phrase pour expliquer le rôle au moment de le choisir. */
export const ROLE_DESCRIPTIONS: Record<AgentRole, string> = {
  AGENT: 'Réservations et paiements au quotidien.',
  ADMIN: "Pilote l'exploitation : programmes, finances, dépenses. Ne gère aucun compte.",
  GERANT: "Le patron de l'agence : crée les comptes et réinitialise les mots de passe.",
  SUPER_ADMIN: 'Fournisseur du logiciel.',
};

export const ROLE_BADGE_CLASSES: Record<AgentRole, string> = {
  AGENT: 'bg-blue-100 text-blue-800',
  ADMIN: 'bg-purple-100 text-purple-800',
  GERANT: 'bg-emerald-100 text-emerald-800',
  SUPER_ADMIN: 'bg-amber-100 text-amber-800',
};

export const rangRole = (role: AgentRole): number => RANG_ROLE[role] ?? 0;

/** Vrai si `role` est au moins au niveau `minimum`. */
export const auMoins = (role: AgentRole | undefined | null, minimum: AgentRole): boolean =>
  role ? rangRole(role) >= rangRole(minimum) : false;

/**
 * On n'agit sur un compte que s'il est de rang strictement inférieur au sien.
 * Deux gérants sont pairs : ils ne peuvent rien l'un sur l'autre.
 */
export const peutAgirSur = (acteur: AgentRole | undefined | null, cible: AgentRole): boolean =>
  acteur ? rangRole(acteur) > rangRole(cible) : false;

/** On n'attribue qu'un rôle de rang inférieur ou égal au sien. */
export const peutAttribuerRole = (
  acteur: AgentRole | undefined | null,
  role: AgentRole
): boolean => (acteur ? rangRole(acteur) >= rangRole(role) : false);

/** Rôles qu'un acteur peut attribuer, du plus faible au plus élevé. */
export const rolesAttribuablesPar = (acteur: AgentRole | undefined | null): AgentRole[] =>
  (Object.keys(RANG_ROLE) as AgentRole[])
    .filter((role) => peutAttribuerRole(acteur, role))
    .sort((a, b) => rangRole(a) - rangRole(b));
