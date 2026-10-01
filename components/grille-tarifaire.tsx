"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, Info, Plus, Table2, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { formatMontant, formatNombre } from "@/lib/format"
import {
  COLONNES_GRILLE,
  FormuleForm,
  HotelGrilleOption,
  LIBELLE_TYPE,
  ParamsCoutProgramme,
  RoomTypeKey,
  VilleHotel,
  estimerCoutCase,
  formuleVide,
  prixCase,
  validerGrille,
} from "@/lib/grilleTarifaire"

/**
 * Saisie de la GRILLE TARIFAIRE d'un programme, présentée comme la brochure :
 * un tableau `formules × types de chambre`.
 *
 * Sous chaque case, le COÛT estimé par personne (vol + visa + hôtels de la
 * formule, sans aucune marge) aide le gérant à fixer son prix. Une fourchette
 * s'affiche quand une ville offre le choix entre plusieurs hôtels. La marge
 * (prix − coût) est purement informative : elle n'empêche JAMAIS d'enregistrer,
 * vendre à perte reste une décision du gérant.
 */

const VILLES_ORDRE: VilleHotel[] = ["Madina", "Makkah", "Autre"]

/** Fourchette formatée : « 11 200 DH » ou « 11 200 – 11 850 DH ». */
function formatFourchette(min: number, max: number): string {
  if (min === max) return formatMontant(min)
  return `${formatNombre(min)} – ${formatMontant(max)}`
}

/** Marge signée : « +1 700 DH », ou « −1 050 – +1 700 DH » sur une fourchette. */
function formatMarge(basse: number, haute: number): string {
  const signe = (n: number) => `${n < 0 ? "−" : "+"}${formatNombre(Math.abs(n))}`
  if (basse === haute) return `${signe(basse)} DH`
  return `${signe(basse)} – ${signe(haute)} DH`
}

export function GrilleTarifaire({
  formules,
  onChange,
  hotelsDuProgramme,
  params,
  disabled = false,
}: {
  formules: FormuleForm[]
  onChange: (formules: FormuleForm[]) => void
  hotelsDuProgramme: HotelGrilleOption[]
  params: ParamsCoutProgramme
  disabled?: boolean
}) {
  /** Formule dont la suppression attend confirmation (elle contient des prix saisis). */
  const [formuleASupprimer, setFormuleASupprimer] = useState<FormuleForm | null>(null)

  const hotelsParVille = useMemo(() => {
    const map = new Map<VilleHotel, HotelGrilleOption[]>()
    for (const ville of VILLES_ORDRE) {
      const liste = hotelsDuProgramme.filter((h) => h.city === ville)
      if (liste.length > 0) map.set(ville, liste)
    }
    return map
  }, [hotelsDuProgramme])

  /** Vrai dès qu'une ville propose au moins deux hôtels : le « ou » est alors possible. */
  const villeAvecPlusieursHotels = useMemo(
    () => Array.from(hotelsParVille.values()).some((liste) => liste.length > 1),
    [hotelsParVille]
  )

  const raisons = useMemo(
    () => validerGrille(formules, hotelsDuProgramme),
    [formules, hotelsDuProgramme]
  )

  const majFormule = (cle: string, patch: Partial<FormuleForm>) => {
    onChange(formules.map((f) => (f.cle === cle ? { ...f, ...patch } : f)))
  }

  const majPrix = (cle: string, roomType: RoomTypeKey, valeur: string) => {
    // Seuls des chiffres : un prix de brochure est un montant entier en dirhams,
    // et un prix négatif ne peut donc même pas être saisi.
    const propre = valeur.replace(/[^0-9]/g, "")
    onChange(
      formules.map((f) =>
        f.cle === cle ? { ...f, prix: { ...f.prix, [roomType]: propre } } : f
      )
    )
  }

  const basculerHotel = (cle: string, cleHotelOption: string) => {
    onChange(
      formules.map((f) => {
        if (f.cle !== cle) return f
        const hotels = f.hotels.includes(cleHotelOption)
          ? f.hotels.filter((h) => h !== cleHotelOption)
          : [...f.hotels, cleHotelOption]
        return { ...f, hotels }
      })
    )
  }

  const deplacer = (index: number, sens: -1 | 1) => {
    const cible = index + sens
    if (cible < 0 || cible >= formules.length) return
    const copie = [...formules]
    const [retiree] = copie.splice(index, 1)
    copie.splice(cible, 0, retiree)
    onChange(copie)
  }

  const supprimer = (cle: string) => {
    onChange(formules.filter((f) => f.cle !== cle))
    setFormuleASupprimer(null)
  }

  const demanderSuppression = (formule: FormuleForm) => {
    const aDesPrix = COLONNES_GRILLE.some((t) => prixCase(formule, t) !== null)
    if (aDesPrix) {
      setFormuleASupprimer(formule)
      return
    }
    supprimer(formule.cle)
  }

  const ajouter = () => onChange([...formules, formuleVide()])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="flex items-center gap-2 font-medium text-violet-800">
            <Table2 className="h-4 w-4" />
            Grille tarifaire
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-violet-700/80">
            Le tableau de votre brochure : une ligne par formule d&apos;hôtels, une colonne par
            type de chambre. Prix <strong>par personne</strong>, en dirhams. Une case laissée
            vide signifie <strong>non proposé</strong>.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={ajouter}
          disabled={disabled}
          className="h-9 shrink-0 border-violet-300 text-violet-700 hover:bg-violet-50"
        >
          <Plus className="mr-1 h-4 w-4" />
          Ajouter une formule
        </Button>
      </div>

      {hotelsDuProgramme.length === 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Ajoutez d&apos;abord les hôtels du programme ci-dessus : une formule se compose des
            hôtels autorisés, et le coût estimé s&apos;appuie sur le prix de leurs chambres.
          </span>
        </div>
      )}

      {formules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-violet-300 bg-violet-50/40 p-3 text-center text-sm text-violet-700">
          Aucune formule. Ajoutez la première ligne de votre brochure.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-violet-200 bg-white">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="bg-violet-50/80 text-violet-900">
                <th className="w-[320px] border-b border-violet-200 p-3 text-left font-medium">
                  Formule (hôtels)
                </th>
                {COLONNES_GRILLE.map((roomType) => (
                  <th
                    key={roomType}
                    className="border-b border-l border-violet-200 p-3 text-center font-medium"
                  >
                    {LIBELLE_TYPE[roomType]}
                  </th>
                ))}
                <th className="w-16 border-b border-l border-violet-200 p-3" />
              </tr>
            </thead>
            <tbody>
              {formules.map((formule, index) => (
                <tr key={formule.cle} className="align-top">
                  <td className="border-b border-violet-100 p-3">
                    <Input
                      value={formule.label}
                      onChange={(e) => majFormule(formule.cle, { label: e.target.value })}
                      placeholder="Ex. Al Markaziya + Abraj Al Kiswah"
                      disabled={disabled}
                      className="h-9"
                      aria-label={`Libellé de la formule ${index + 1}`}
                    />
                    <Input
                      value={formule.note}
                      onChange={(e) => majFormule(formule.cle, { note: e.target.value })}
                      placeholder="Mention (facultatif) : + petit-déjeuner, 400 m du Haram…"
                      disabled={disabled}
                      className="mt-2 h-8 text-xs"
                      aria-label={`Mention de la formule ${index + 1}`}
                    />
                    <div className="mt-3 space-y-2">
                      {Array.from(hotelsParVille.entries()).map(([ville, hotels]) => (
                        <div key={ville}>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                            {ville}
                            {ville === "Autre" && (
                              <span className="ml-1 normal-case tracking-normal text-gray-400">
                                (étape facultative)
                              </span>
                            )}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {hotels.map((hotel) => {
                              const actif = formule.hotels.includes(hotel.cle)
                              return (
                                <button
                                  key={hotel.cle}
                                  type="button"
                                  onClick={() => basculerHotel(formule.cle, hotel.cle)}
                                  disabled={disabled}
                                  aria-pressed={actif}
                                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-60 ${
                                    actif
                                      ? "border-violet-400 bg-violet-100 text-violet-800"
                                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                                  }`}
                                >
                                  {hotel.name}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                      {villeAvecPlusieursHotels && (
                        <p className="text-[11px] leading-snug text-gray-500">
                          Plusieurs hôtels cochés dans une même ville = un choix (« ou »). Le coût
                          s&apos;affiche alors en fourchette.
                        </p>
                      )}
                    </div>
                  </td>

                  {COLONNES_GRILLE.map((roomType) => {
                    const prix = prixCase(formule, roomType)
                    const cout = estimerCoutCase(formule, roomType, hotelsDuProgramme, params)
                    const margeBasse = prix !== null && cout ? prix - cout.max : null
                    const margeHaute = prix !== null && cout ? prix - cout.min : null
                    return (
                      <td
                        key={roomType}
                        className="border-b border-l border-violet-100 p-3 text-center"
                      >
                        <Input
                          value={formule.prix[roomType] ?? ""}
                          onChange={(e) => majPrix(formule.cle, roomType, e.target.value)}
                          inputMode="numeric"
                          placeholder="—"
                          disabled={disabled}
                          className="h-9 w-24 text-center tabular-nums"
                          aria-label={`Prix ${LIBELLE_TYPE[roomType]} — ${
                            formule.label.trim() || `formule ${index + 1}`
                          }`}
                        />
                        <p
                          className={`mt-1.5 text-[10px] leading-tight ${
                            cout ? "text-gray-500" : "text-amber-700"
                          }`}
                        >
                          {cout ? `Coût est. ${formatFourchette(cout.min, cout.max)}` : "Coût incomplet"}
                        </p>
                        {margeBasse !== null && margeHaute !== null && (
                          <p
                            className={`text-[10px] font-semibold leading-tight ${
                              margeBasse < 0 ? "text-red-600" : "text-emerald-700"
                            }`}
                          >
                            Marge {formatMarge(margeBasse, margeHaute)}
                          </p>
                        )}
                      </td>
                    )
                  })}

                  <td className="border-b border-l border-violet-100 p-3">
                    <div className="flex flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() => deplacer(index, -1)}
                        disabled={disabled || index === 0}
                        title="Monter la formule"
                        aria-label={`Monter la formule ${index + 1}`}
                        className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deplacer(index, 1)}
                        disabled={disabled || index === formules.length - 1}
                        title="Descendre la formule"
                        aria-label={`Descendre la formule ${index + 1}`}
                        className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => demanderSuppression(formule)}
                        disabled={disabled}
                        title="Supprimer la formule"
                        aria-label={`Supprimer la formule ${index + 1}`}
                        className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {raisons.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            À compléter avant d&apos;enregistrer la grille
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-6">
            {raisons.map((raison) => (
              <li key={raison}>{raison}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-gray-500">
        Le coût estimé est une aide à la décision : vol + visa + hôtels de la formule, sans aucune
        marge. La marge affichée n&apos;empêche jamais d&apos;enregistrer, même négative.
      </p>

      <AlertDialog
        open={formuleASupprimer !== null}
        onOpenChange={(ouvert) => {
          if (!ouvert) setFormuleASupprimer(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette formule ?</AlertDialogTitle>
            <AlertDialogDescription>
              La formule «&nbsp;{formuleASupprimer?.label.trim() || "sans libellé"}&nbsp;» contient
              des prix saisis. Ils seront perdus. Les réservations déjà enregistrées ne sont pas
              modifiées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => formuleASupprimer && supprimer(formuleASupprimer.cle)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
