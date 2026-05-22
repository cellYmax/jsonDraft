import { useEffect } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

function canUseTauriWindowApi() {
  return Boolean(
    isTauri() &&
      (
        globalThis as typeof globalThis & {
          __TAURI_INTERNALS__?: { metadata?: unknown };
        }
      ).__TAURI_INTERNALS__?.metadata,
  );
}

export function useCloseProtection(dirty: boolean) {
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);

    const unlisten = canUseTauriWindowApi()
      ? getCurrentWindow()
          .onCloseRequested((event) => {
            if (
              dirty &&
              !window.confirm("当前文件有未保存修改，确定要关闭吗？")
            ) {
              event.preventDefault();
            }
          })
          .catch(() => undefined)
      : Promise.resolve(undefined);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      unlisten.then((dispose) => dispose?.());
    };
  }, [dirty]);
}
