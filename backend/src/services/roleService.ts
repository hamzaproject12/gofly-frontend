import { Role } from '@prisma/client';

/**
 * Hiérarchie des rôles de l'application.
 *
 * Toutes les règles d'accès aux comptes s'expriment en comparaison de rangs
 * plutôt qu'en énumération de rôles (`role === 'ADMIN' || role === '…'`).
 * Ajouter un rôle demande alors de modifier ce seul fichier, au lieu de
 * retrouver chaque contrôle disséminé dans le code — un oubli donnant soit un
 * compte trop puissant, soit un patron avec moins de droits que ses employés.
 *
 *  - AGENT        : usage quotidien (réservations, paiements).
 *  - ADMIN        : responsable d'exploitation nommé par le gérant. Aucun accès
 *                   à la gestion des comptes.
 *  - GERANT       : le patron de l'agence. Seul à pouvoir créer des comptes et
 *                   réinitialiser les mots de passe de ses employés.
 *  - SUPER_ADMIN  : le fournisseur du logiciel. Invisible pour l'agence.
 */
export const RANG_ROLE: Record<Role, number> = {
  AGENT: 0,
  ADMIN: 1,
  GERANT: 2,
  SUPER_ADMIN: 3,
};

export const rangRole = (role: Role): number => RANG_ROLE[role] ?? 0;

/** Vrai si `role` est au moins au niveau `minimum`. */
export const auMoins = (role: Role, minimum: Role): boolean =>
  rangRole(role) >= rangRole(minimum);

/**
 * On n'agit sur un compte (modification, mot de passe, désactivation,
 * suppression) que s'il est de rang STRICTEMENT inférieur au sien.
 *
 * Conséquence voulue : deux gérants sont pairs et ne peuvent rien l'un sur
 * l'autre. Un gérant ne peut donc pas verrouiller son associé ; retirer un
 * gérant relève du fournisseur.
 */
export const peutAgirSur = (acteur: Role, cible: Role): boolean =>
  rangRole(acteur) > rangRole(cible);

/**
 * On n'attribue qu'un rôle de rang inférieur ou égal au sien : un gérant peut
 * nommer un autre gérant, jamais un super admin.
 */
export const peutAttribuerRole = (acteur: Role, role: Role): boolean =>
  rangRole(acteur) >= rangRole(role);

/** Un compte n'est visible que par un rang au moins égal au sien. */
export const peutVoir = (acteur: Role, cible: Role): boolean =>
  rangRole(acteur) >= rangRole(cible);

/** Rôles qu'un acteur a le droit de voir, pour filtrer une requête Prisma. */
export const rolesVisiblesPar = (acteur: Role): Role[] =>
  (Object.keys(RANG_ROLE) as Role[]).filter((role) => peutVoir(acteur, role));
