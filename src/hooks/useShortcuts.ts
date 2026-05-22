import { useEffect } from "react";

export type ShortcutHandlers = {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onFormat: () => void;
  onMinify: () => void;
  onEscape: () => void;
  onUnescape: () => void;
};

export function useShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const primary = event.metaKey || event.ctrlKey;

      if (!primary || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "o") {
        event.preventDefault();
        handlers.onOpen();
        return;
      }

      if (key === "n") {
        event.preventDefault();
        handlers.onNew();
        return;
      }

      if (key === "s") {
        event.preventDefault();
        if (event.shiftKey) {
          handlers.onSaveAs();
        } else {
          handlers.onSave();
        }
        return;
      }

      if (key === "enter" && !event.shiftKey) {
        event.preventDefault();
        handlers.onFormat();
        return;
      }

      if (event.shiftKey && key === "m") {
        event.preventDefault();
        handlers.onMinify();
        return;
      }

      if (event.shiftKey && key === "e") {
        event.preventDefault();
        handlers.onEscape();
        return;
      }

      if (event.shiftKey && key === "u") {
        event.preventDefault();
        handlers.onUnescape();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handlers]);
}
