"use client"

import { CalendarCheck, CalendarClock, CalendarX } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDateFr } from "@/lib/format"
import {
  PASSPORT_MIN_VALIDITY_MONTHS,
  passportExpiryStatus,
  type OcrAlert,
  type PassportExpiryStatus,
} from "@/lib/passportOcr"

/**
 * Bloc affiché en tête de la modale « Valider les données extraites du
 * passeport » : la date d'expiration lue sur la MRZ, en vert quand le document
 * couvre les 6 mois de validité exigés pour le visa, en rouge sinon, suivie du
 * détail de l'alerte.
 *
 * Le composant est partagé par les cinq écrans de réservation (nouvelle /
 * nouvelle-chambre / modifier / modifier-simple / modifier-chambre) pour que
 * l'agent voie exactement le même verdict partout.
 */

const STATUTS: Record<
  PassportExpiryStatus,
  { icon: typeof CalendarCheck; box: string; libelle: string }
> = {
  ok: {
    icon: CalendarCheck,
    box: "text-emerald-700 bg-emerald-50 border-emerald-200",
    libelle: `Valide plus de ${PASSPORT_MIN_VALIDITY_MONTHS} mois`,
  },
  insufficient: {
    icon: CalendarClock,
    box: "text-red-700 bg-red-50 border-red-200",
    libelle: `Expire dans moins de ${PASSPORT_MIN_VALIDITY_MONTHS} mois`,
  },
  expired: {
    icon: CalendarX,
    box: "text-red-700 bg-red-50 border-red-200",
    libelle: "Document expiré",
  },
  unknown: {
    icon: CalendarClock,
    box: "text-amber-700 bg-amber-50 border-amber-200",
    libelle: "Date non détectée — à vérifier sur le document",
  },
}

type PassportOcrSummaryProps = {
  expiryDate?: string
  alert?: OcrAlert | null
}

export function PassportOcrSummary({ expiryDate, alert }: PassportOcrSummaryProps) {
  const statut = passportExpiryStatus(expiryDate)
  const { icon: Icon, box, libelle } = STATUTS[statut]

  return (
    <div className="space-y-2">
      <div className={cn("flex items-start gap-2 rounded-md border p-2 text-xs", box)}>
        <Icon className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium">Expiration du passeport</span>
            <span className="font-semibold tabular-nums">
              {formatDateFr(expiryDate) || "—"}
            </span>
          </div>
          <p className="mt-0.5 opacity-90">{libelle}</p>
        </div>
      </div>
      {alert && (
        <p
          className={cn(
            "text-xs border rounded-md p-2",
            alert.level === "error"
              ? "text-red-700 bg-red-50 border-red-200 font-medium"
              : "text-amber-700 bg-amber-50 border-amber-200"
          )}
        >
          {alert.message}
        </p>
      )}
    </div>
  )
}
