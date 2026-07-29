"use client"

import { Lock, Archive } from "lucide-react"

type Status = "ACTIF" | "CLOTURE" | "ARCHIVE" | undefined | null

/**
 * Bandeau d'information affiché en tête des pages détail/édition d'une réservation
 * selon le statut du cycle de vie du programme lié.
 * - CLOTURE : encaissements et statuts fournisseur encore possibles.
 * - ARCHIVE : lecture seule.
 * N'affiche rien pour un programme ACTIF (ou statut inconnu).
 */
export default function ProgramStatusBanner({ status }: { status: Status }) {
  if (status === "CLOTURE") {
    return (
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
        <Lock className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Programme clôturé — encaissements et statuts fournisseur encore possibles.</span>
      </div>
    )
  }
  if (status === "ARCHIVE") {
    return (
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-gray-300 bg-gray-100 px-4 py-3 text-sm text-gray-700">
        <Archive className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Programme archivé — lecture seule, aucune modification possible.</span>
      </div>
    )
  }
  return null
}
