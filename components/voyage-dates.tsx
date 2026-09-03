"use client"

import { PlaneTakeoff, PlaneLanding, CalendarClock } from "lucide-react"
import { formatDateFr } from "@/lib/format"
import {
  JOURS_ALERTE_VOYAGE,
  JOURS_VIGILANCE_VOYAGE,
  estImminente,
  joursAvant,
  libelleEcheance,
} from "@/lib/voyage"

/**
 * Pastille d'une date de voyage. Elle vire au rouge clignotant quand le départ
 * approche et à l'ambre quand c'est l'arrivée — même code couleur que les bandeaux
 * d'alerte du dashboard.
 */
export function DateVoyageChip({
  type,
  value,
}: {
  type: "depart" | "arrivee"
  value?: string | null
}) {
  const jours = joursAvant(value)
  const imminente = estImminente(jours)
  const Icon = type === "depart" ? PlaneTakeoff : PlaneLanding
  const label = type === "depart" ? "Départ" : "Arrivée"
  const tone = !imminente
    ? "bg-slate-100 text-slate-700 ring-slate-200"
    : type === "depart"
      ? "bg-red-100 text-red-800 ring-red-300 animate-pulse"
      : "bg-amber-100 text-amber-900 ring-amber-300"

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tone}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span>
        {label} : {value ? formatDateFr(value) : "—"}
      </span>
      {imminente && <span className="font-bold">· {libelleEcheance(jours)}</span>}
    </span>
  )
}

/**
 * Jours restants avant le départ, en clair sur chaque programme : « 5j », « 7j »…
 * La couleur suit l'urgence : rouge clignotant sous {@link JOURS_ALERTE_VOYAGE} jours
 * (même seuil que la super alerte), ambre sous une semaine, indigo au-delà.
 */
export function CompteARebours({ dateDepart }: { dateDepart?: string | null }) {
  const jours = joursAvant(dateDepart)

  // Date absente ou départ déjà passé : rien à décompter, on reste neutre.
  const neutre = {
    tone: "bg-slate-100 border-slate-300",
    iconTone: "text-slate-500",
    labelTone: "text-slate-600",
  }
  const urgent = {
    tone: "bg-red-100 border-red-400 ring-2 ring-red-300 animate-pulse",
    iconTone: "text-red-700",
    labelTone: "text-red-800",
  }

  const { valeur, tone, iconTone, labelTone } =
    jours === null
      ? { valeur: "Non définie", ...neutre }
      : jours < 0
        ? { valeur: "Parti", ...neutre }
        : jours === 0
          ? { valeur: "Aujourd'hui", ...urgent }
          : jours <= JOURS_ALERTE_VOYAGE
            ? { valeur: `${jours}j`, ...urgent }
            : jours <= JOURS_VIGILANCE_VOYAGE
              ? {
                  valeur: `${jours}j`,
                  tone: "bg-amber-100 border-amber-400",
                  iconTone: "text-amber-700",
                  labelTone: "text-amber-800",
                }
              : {
                  valeur: `${jours}j`,
                  tone: "bg-indigo-100 border-indigo-300",
                  iconTone: "text-indigo-700",
                  labelTone: "text-indigo-800",
                }

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${tone}`}>
      <CalendarClock className={`h-4 w-4 shrink-0 ${iconTone}`} />
      <div>
        <p className={`text-xs font-medium ${labelTone}`}>Avant départ</p>
        <p className={`text-base font-bold leading-tight ${labelTone}`}>{valeur}</p>
      </div>
    </div>
  )
}
