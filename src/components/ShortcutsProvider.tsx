import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Keys } from "@/components/Kbd";
import { cycleTheme } from "@/hooks/useTheme";
import { jumpToSection, scrollToTop } from "@/lib/jumpTo";
import {
  EVENT_OPEN_HELP,
  EVENT_OPEN_SEARCH,
  GO_PREFIX,
  SEQUENCE_WINDOW_MS,
  SHORTCUTS,
  hrefFor,
  type Shortcut,
  type ShortcutGroup,
} from "@/lib/shortcuts";

const isTypingTarget = (t: EventTarget | null): boolean => {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable || el.getAttribute("role") === "textbox" || el.getAttribute("role") === "combobox";
};

/** True while a dialog or menu is open (the help dialog itself included). */
const overlayOpen = (): boolean =>
  !!document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]');

/**
 * Mounted once in App. Handles every key in the registry, scrolls to #section after navigation,
 * and renders the help dialog.
 */
export const ShortcutsProvider = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [helpOpen, setHelpOpen] = useState(false);
  const pending = useRef<{ key: string; at: number } | null>(null);

  // Scroll to the hash target after any navigation; go to the top when there is no hash.
  useEffect(() => {
    if (location.hash) jumpToSection(decodeURIComponent(location.hash.slice(1)));
    else scrollToTop();
  }, [location.pathname, location.hash]);

  const run = useCallback(
    (s: Shortcut) => {
      if (s.action === "open-search") {
        window.dispatchEvent(new CustomEvent(EVENT_OPEN_SEARCH));
        return;
      }
      if (s.action === "cycle-theme") {
        cycleTheme();
        return;
      }
      if (s.action === "open-help") {
        setHelpOpen(true);
        return;
      }
      const route = s.route ?? "/";
      if (route === window.location.pathname) {
        // Same page: the location may not change, so scroll directly.
        if (s.section) {
          history.replaceState(null, "", hrefFor(s));
          jumpToSection(s.section);
        } else {
          history.replaceState(null, "", route);
          scrollToTop();
        }
      } else {
        navigate(hrefFor(s));
      }
    },
    [navigate]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
      if (isTypingTarget(e.target) || overlayOpen()) {
        pending.current = null;
        return;
      }
      if (e.key === "Escape") {
        pending.current = null;
        return;
      }
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      // Second key of a sequence
      const p = pending.current;
      pending.current = null;
      if (p && Date.now() - p.at <= SEQUENCE_WINDOW_MS) {
        const hit = SHORTCUTS.find((s) => s.keys.length === 2 && s.keys[0] === p.key && s.keys[1] === key);
        if (hit) {
          e.preventDefault();
          run(hit);
          return;
        }
      }

      if (key === GO_PREFIX) {
        pending.current = { key, at: Date.now() };
        return;
      }
      const single = SHORTCUTS.find((s) => s.keys.length === 1 && s.keys[0] === e.key);
      if (single) {
        e.preventDefault();
        run(single);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  useEffect(() => {
    const open = () => setHelpOpen(true);
    window.addEventListener(EVENT_OPEN_HELP, open);
    return () => window.removeEventListener(EVENT_OPEN_HELP, open);
  }, []);

  const groups: ShortcutGroup[] = ["Navigate", "Actions"];

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Press <span className="font-mono">g</span> then a letter. Shortcuts are off while you type in a field.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g}</h3>
              <ul className="divide-y divide-border rounded-md border border-border">
                {SHORTCUTS.filter((s) => s.group === g).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                    <span>{s.label}</span>
                    <Keys keys={s.keys} />
                  </li>
                ))}
                {g === "Actions" && (
                  <li className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                    <span>Close this dialog</span>
                    <Keys keys={["Esc"]} />
                  </li>
                )}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
