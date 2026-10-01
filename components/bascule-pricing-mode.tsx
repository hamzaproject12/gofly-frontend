"use client"

import { useState } from "react"
import { Calculator, Loader2, Table2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export type PricingMode = "CALCUL" | "GRILLE"

/**
 * Bascule de l'ORIGINE DU PRIX DE VENTE d'un programme.
 *
 * - CALCUL : prix dérivé du vol + visa + hôtels + profit (comportement historique) ;
 * - GRILLE : prix de la brochure publiée, saisi formule par formule.
 *
 * La bascule vers GRILLE est refusée tant que la grille ne porte aucun prix :
 * un programme en GRILLE sans prix laisserait les futures réservations sans
 * référence. Dans les deux sens, les réservations DÉJÀ enregistrées gardent leur
 * prix et leur réduction — la confirmation le dit explicitement.
 */
export function BasculePricingMode({
  mode,
  onChange,
  grilleAUnPrix,
  disabled = false,
  enCours = false,
}: {
  mode: PricingMode
  onChange: (mode: PricingMode) => void | Promise<void>
  /** Vrai si au moins une formule de la grille porte au moins un prix. */
  grilleAUnPrix: boolean
  disabled?: boolean
  /** Bascule en cours côté serveur. */
  enCours?: boolean
}) {
  const [confirmation, setConfirmation] = useState(false)

  const versGrille = mode === "CALCUL"
  const basculeImpossible = versGrille && !grilleAUnPrix

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-violet-200 bg-violet-50/60 p-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium text-violet-900">
          {mode === "GRILLE" ? (
            <>
              <Table2 className="h-4 w-4 shrink-0" />
              Prix de vente : grille tarifaire (brochure)
            </>
          ) : (
            <>
              <Calculator className="h-4 w-4 shrink-0" />
              Prix de vente : calcul automatique
            </>
          )}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-violet-700/80">
          {mode === "GRILLE"
            ? "Les nouvelles réservations prennent le prix saisi dans la grille."
            : "Les nouvelles réservations prennent le prix calculé (vol + visa + hôtels + profit)."}
        </p>
        {basculeImpossible && (
          <p className="mt-1 text-xs font-medium text-amber-700">
            Saisissez au moins un prix dans la grille pour pouvoir l&apos;utiliser.
          </p>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || enCours || basculeImpossible}
        onClick={() => setConfirmation(true)}
        className="h-9 shrink-0 border-violet-300 text-violet-700 hover:bg-violet-100"
      >
        {enCours && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
        {versGrille ? "Utiliser la grille tarifaire" : "Revenir au prix calculé"}
      </Button>

      <AlertDialog open={confirmation} onOpenChange={setConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {versGrille
                ? "Utiliser la grille tarifaire comme prix de vente ?"
                : "Revenir au prix calculé automatiquement ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {versGrille ? (
                <>
                  Les nouvelles réservations de ce programme prendront le prix de la brochure.
                  <br />
                  Les réservations <strong>déjà enregistrées gardent leur prix et leur
                  réduction</strong> : rien n&apos;est recalculé.
                </>
              ) : (
                <>
                  Les nouvelles réservations repasseront au calcul vol + visa + hôtels + profit. La
                  grille est conservée, elle cesse simplement de servir de prix de vente.
                  <br />
                  Les réservations <strong>déjà enregistrées gardent leur prix et leur
                  réduction</strong>.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmation(false)
                void onChange(versGrille ? "GRILLE" : "CALCUL")
              }}
            >
              {versGrille ? "Utiliser la grille" : "Revenir au calcul"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
