"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Overlay de chargement affiché pendant l'enregistrement d'une réservation.
 *
 * L'enregistrement enchaîne plusieurs appels réseau (réservation, documents,
 * dépenses, finalisation) et peut durer plusieurs secondes : sans retour
 * visuel, l'utilisateur ne sait pas où en est le traitement. L'overlay bloque
 * les interactions et montre l'étape en cours.
 */

export type SubmitStep = "reservation" | "documents" | "finalisation" | "done"

const STEP_ORDER: SubmitStep[] = ["reservation", "documents", "finalisation", "done"]

const LABELS: Record<"create" | "edit", { title: string; steps: Record<SubmitStep, string> }> = {
  create: {
    title: "Enregistrement de la réservation",
    steps: {
      reservation: "Création du dossier",
      documents: "Envoi des documents",
      finalisation: "Finalisation du dossier",
      done: "Réservation enregistrée",
    },
  },
  edit: {
    title: "Modification de la réservation",
    steps: {
      reservation: "Mise à jour du dossier",
      documents: "Envoi des documents",
      finalisation: "Finalisation des modifications",
      done: "Modifications enregistrées",
    },
  },
}

interface SubmitOverlayProps {
  open: boolean
  /** Étape en cours ; les étapes précédentes sont affichées comme terminées. */
  step: SubmitStep
  mode?: "create" | "edit"
}

export function SubmitOverlay({ open, step, mode = "create" }: SubmitOverlayProps) {
  if (!open) return null

  const { title, steps } = LABELS[mode]
  const currentIndex = Math.max(0, STEP_ORDER.indexOf(step))
  const isDone = step === "done"
  const progress = ((currentIndex + (isDone ? 1 : 0.5)) / STEP_ORDER.length) * 100

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      role="alertdialog"
      aria-busy={!isDone}
      aria-live="polite"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <Card className="relative mx-4 w-full max-w-sm border-0 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center">
            <div className="relative flex h-14 w-14 items-center justify-center">
              <span
                className={cn(
                  "absolute inset-0 rounded-full border-2",
                  isDone ? "border-emerald-500/30" : "border-primary/20"
                )}
              />
              {isDone ? (
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                  <Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                </span>
              ) : (
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              )}
            </div>

            <h2 className="mt-3 text-base font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isDone ? "Redirection en cours..." : "Merci de ne pas fermer cette page."}
            </p>
          </div>

          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500 ease-out",
                isDone ? "bg-emerald-500" : "bg-primary"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>

          <ul className="mt-4 space-y-2">
            {STEP_ORDER.map((key, index) => {
              const completed = index < currentIndex || isDone
              const active = index === currentIndex && !isDone

              return (
                <li
                  key={key}
                  className={cn(
                    "flex items-center gap-3 text-sm transition-colors",
                    active && "font-medium text-foreground",
                    completed && "text-muted-foreground",
                    !active && !completed && "text-muted-foreground/50"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                      completed && "border-emerald-500 bg-emerald-500 text-white",
                      active && "border-primary",
                      !active && !completed && "border-muted-foreground/30"
                    )}
                  >
                    {completed ? (
                      <Check className="h-3 w-3" />
                    ) : active ? (
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    ) : null}
                  </span>
                  {steps[key]}
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

export default SubmitOverlay
