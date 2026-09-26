"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const approvedNavigations = new WeakSet<Event>();

/** Holds no form data outside the component. Navigation warnings never imply autosave. */
export function useWorkProtection(value: string, error = "") {
  const [savedValue, setSavedValue] = useState(value);
  const bypass = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const attachRoot = useCallback((element: HTMLDivElement | null) => {
    root.current = element;
  }, []);
  const dirty = value !== savedValue;
  useEffect(() => {
    if (!dirty) return;
    bypass.current = false;
    const unload = (event: BeforeUnloadEvent) => {
      if (!bypass.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || approvedNavigations.has(event)) return;
      const anchor = (event.target as HTMLElement).closest?.("a[href]");
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.button !== 0
      )
        return;
      const target = new URL(anchor.href);
      if (target.pathname === location.pathname && target.search === location.search) return;
      if (!bypass.current) {
        if (window.confirm("You have unsaved changes. Leave this page and discard them?"))
          approvedNavigations.add(event);
        else {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty, value]);
  useEffect(() => {
    if (!error || !root.current) return;
    const container = root.current.closest("form, section") ?? root.current;
    const field = container.querySelector<HTMLElement>('[aria-invalid="true"]');
    const feedback = container.querySelector<HTMLElement>(
      '[role="alert"], .form-errors, .form-feedback.error',
    );
    const target = field ?? feedback;
    if (target) {
      let parent = target.parentElement;
      while (parent && parent !== container) {
        if (parent instanceof HTMLDetailsElement) parent.open = true;
        parent = parent.parentElement;
      }
      if (!field) target.tabIndex = -1;
      target.focus();
    }
  }, [error]);
  return {
    root: attachRoot,
    dirty,
    markSaved: (next = value) => {
      bypass.current = true;
      setSavedValue(next);
    },
    status: (
      <p className="work-save-status" role="status">
        {dirty
          ? "Unsaved changes — keep this page open until you save or submit."
          : "No unsaved changes."}
      </p>
    ),
  };
}
