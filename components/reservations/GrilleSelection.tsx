"use client"

import Link from "next/link"
import { AlertTriangle, Table2 } from "lucide-react"
import { formatMontant } from "@/lib/format"
import { LIBELLE_TYPE, RoomTypeKey } from "@/lib/grilleTarifaire"
import {
  FormuleApi,
  colonnesVente,
  formulesTriees,
  grilleExploitable,
  typesProposes,
} from "@/lib/grilleReservation"

/**
 * Tableau de vente de la GRILLE TARIFAIRE, présenté comme la brochure.
 *
 * Cliquer une case choisit la formule ET le type de chambre d'un coup — c'est
 * exactement le geste que fait l'agent avec la brochure papier sous les yeux.
 * Une case non proposée est désactivée : rien ne laisse croire qu'on peut la
 * vendre.
 *
 * Quand la grille est vide, ce composant le DIT et renvoie vers l'édition du
 * programme. Jamais de repli silencieux sur le calcul automatique : vendre au
 * prix calculé un programme censé suivre la brochure, c'est vendre au mauvais prix.
 */
export function GrilleSelection({
  formules,
  programId,
  formuleId,
  roomType,
  onSelect,
  /** Formules à mettre en avant (pré-remplissage : l'hôtel cliqué n'est que dans celles-là). */
  formulesEnAvant,
  disabled = false,
}: {
  formules: FormuleApi[]
  programId: string | number
  formuleId: number | null
  roomType: string | null
  onSelect: (formuleId: number, roomType: RoomTypeKey, prixVente: number) => void
  formulesEnAvant?: number[]
  disabled?: boolean
}) {
  const liste = formulesTriees(formules)

  if (!grilleExploitable(liste)) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <p className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          La grille tarifaire de ce programme est incomplète
        </p>
        <p className="mt-1 leading-relaxed">
          Aucun prix n&apos;y est saisi : impossible de vendre ce programme tant que la brochure
          n&apos;est pas renseignée.
        </p>
        <Link
          href={`/programmes/modifier/${programId}`}
          className="mt-2 inline-block font-medium text-amber-900 underline underline-offset-2 hover:text-amber-700"
        >
          Compléter la grille tarifaire du programme
        </Link>
      </div>
    )
  }

  const colonnes = colonnesVente(liste)
  const miseEnAvant = new Set(formulesEnAvant ?? [])

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-medium text-violet-900">
        <Table2 className="h-4 w-4 shrink-0" />
        Grille tarifaire — cliquez la case vendue
      </p>
      {miseEnAvant.size > 0 && (
        <p className="rounded border border-violet-200 bg-violet-50 px-2 py-1 text-xs text-violet-800">
          L&apos;hôtel d&apos;origine appartient à plusieurs formules : choisissez celle qui a été
          vendue.
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-violet-200 bg-white">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="bg-violet-50/80 text-violet-900">
              <th className="border-b border-violet-200 p-2.5 text-left font-medium">
                Formule (hôtels)
              </th>
              {colonnes.map((type) => (
                <th
                  key={type}
                  className="border-b border-l border-violet-200 p-2.5 text-center font-medium"
                >
                  {LIBELLE_TYPE[type]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {liste.map((formule) => {
              const proposes = typesProposes(formule)
              const estEnAvant = miseEnAvant.size === 0 || miseEnAvant.has(formule.id)
              return (
                <tr
                  key={formule.id}
                  className={estEnAvant ? "" : "opacity-45"}
                >
                  <td className="border-b border-violet-100 p-2.5 align-top">
                    <p className="font-medium text-gray-900">{formule.label}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-gray-500">
                      {formule.hotels.length > 0
                        ? formule.hotels.map((h) => `${h.name} (${h.city})`).join(" · ")
                        : "Aucun hôtel rattaché"}
                    </p>
                  </td>
                  {colonnes.map((type) => {
                    const cellule = formule.prix.find((p) => p.roomType === type)
                    const proposee = proposes.includes(type) && cellule !== undefined
                    const choisie = formuleId === formule.id && roomType === type
                    if (!proposee) {
                      return (
                        <td
                          key={type}
                          className="border-b border-l border-violet-100 p-2.5 text-center text-gray-300"
                          aria-label={`${LIBELLE_TYPE[type]} non proposé pour ${formule.label}`}
                        >
                          —
                        </td>
                      )
                    }
                    return (
                      <td
                        key={type}
                        className="border-b border-l border-violet-100 p-1.5 text-center"
                      >
                        <button
                          type="button"
                          disabled={disabled}
                          aria-pressed={choisie}
                          onClick={() => onSelect(formule.id, type, cellule.prixVente)}
                          className={`w-full rounded-md border px-2 py-1.5 text-sm font-semibold tabular-nums transition-colors disabled:opacity-50 ${
                            choisie
                              ? "border-violet-500 bg-violet-600 text-white shadow"
                              : "border-violet-200 bg-white text-violet-900 hover:bg-violet-50"
                          }`}
                        >
                          {formatMontant(cellule.prixVente)}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-500">
        Prix par personne. Une case «&nbsp;—&nbsp;» n&apos;est pas proposée par la formule.
      </p>
    </div>
  )
}
