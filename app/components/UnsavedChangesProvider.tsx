"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";

/** Message affiché avant de quitter une page avec des données saisies */
export const UNSAVED_LEAVE_PROMPT =
  "Vous avez saisi des informations qui ne sont pas encore enregistrées. Voulez-vous vraiment quitter cette page ?";

type UnsavedCtx = {
  isDirty: boolean;
  setDirty: (value: boolean) => void;
  clearDirty: () => void;
};

const UnsavedChangesContext = createContext<UnsavedCtx | null>(null);

export function useUnsavedChanges(): UnsavedCtx {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) {
    throw new Error("useUnsavedChanges must be used within UnsavedChangesProvider");
  }
  return ctx;
}

/** Optionnel : pages hors provider (login, etc.) */
export function useUnsavedChangesOptional(): UnsavedCtx | null {
  return useContext(UnsavedChangesContext);
}

export function UnsavedChangesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isDirty, setDirtyState] = useState(false);
  const pathname = usePathname();
  const isDirtyRef = useRef(false);

  const setDirty = useCallback((value: boolean) => {
    setDirtyState(value);
    isDirtyRef.current = value;
  }, []);

  const clearDirty = useCallback(() => {
    setDirtyState(false);
    isDirtyRef.current = false;
  }, []);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  /** Après navigation réussie (changement de route), repartir sur un état propre */
  useEffect(() => {
    clearDirty();
  }, [pathname, clearDirty]);

  /** Fermeture / rechargement onglet */
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  /** Toute saisie dans la zone protégée (hors navbar) marque le formulaire comme modifié */
  useEffect(() => {
    const markDirty = (e: Event) => {
      const el = e.target;
      if (!(el instanceof Element)) return;
      if (el.closest("[data-skip-unsaved-dirty]")) return;
      setDirty(true);
    };
    document.addEventListener("input", markDirty, true);
    document.addEventListener("change", markDirty, true);
    return () => {
      document.removeEventListener("input", markDirty, true);
      document.removeEventListener("change", markDirty, true);
    };
  }, [setDirty]);

  /** Liens internes : confirmation avant navigation client */
  useEffect(() => {
    const onClickCapture = (e: MouseEvent) => {
      if (!isDirtyRef.current) return;
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.button !== 0) return;

      const target = e.target as HTMLElement | null;
      const a = target?.closest?.("a[href]");
      if (!a) return;
      if (a.closest("[data-skip-unsaved-leave-prompt]")) return;

      const hrefAttr = a.getAttribute("href");
      if (
        !hrefAttr ||
        hrefAttr.startsWith("#") ||
        hrefAttr.startsWith("mailto:") ||
        hrefAttr.startsWith("tel:")
      ) {
        return;
      }

      if (a.target === "_blank" || a.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(hrefAttr, window.location.origin);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;

      const current = new URL(window.location.href);
      if (
        url.pathname === current.pathname &&
        url.search === current.search
      ) {
        return;
      }

      if (!window.confirm(UNSAVED_LEAVE_PROMPT)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, []);

  const value = useMemo(
    () => ({
      isDirty,
      setDirty,
      clearDirty,
    }),
    [isDirty, setDirty, clearDirty]
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}
