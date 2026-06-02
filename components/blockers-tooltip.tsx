"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface BlockersTooltipProps {
  /** Liste des raisons pour lesquelles l'action est indisponible (vide = action possible) */
  blockers: string[]
  /** Message affiché au survol quand l'action est disponible (optionnel) */
  enabledHint?: string
  /** Titre affiché au-dessus de la liste des raisons */
  title?: string
  /** Classe appliquée au wrapper (utile pour conserver une largeur pleine) */
  className?: string
  children: ReactNode
}

/**
 * Enveloppe un bouton (ou tout élément) et affiche au survol la liste des raisons
 * pour lesquelles il est désactivé. Le wrapper <span> capte le survol même lorsque
 * le bouton interne est `disabled` (un bouton désactivé a `pointer-events: none`,
 * donc le survol remonte au span parent).
 */
export function BlockersTooltip({
  blockers,
  enabledHint,
  title = "Action indisponible :",
  className,
  children,
}: BlockersTooltipProps) {
  const hasBlockers = blockers.length > 0
  const showContent = hasBlockers || Boolean(enabledHint)

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-block",
              hasBlockers && "cursor-not-allowed",
              className,
            )}
          >
            {children}
          </span>
        </TooltipTrigger>
        {showContent && (
          <TooltipContent side="top" className="max-w-xs">
            {hasBlockers ? (
              <div className="space-y-1">
                <p className="font-semibold">{title}</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  {blockers.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p>{enabledHint}</p>
            )}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  )
}
