import { useCallback, useEffect, useState } from "react";

export type NoticeTone = "info" | "success" | "error";

export type Notice = {
  tone: NoticeTone;
  message: string;
};

export const READY_NOTICE: Notice = { tone: "info", message: "准备就绪" };
export const NOTICE_AUTO_CLEAR_MS = 4000;

export function useNotice() {
  const [notice, setNotice] = useState<Notice>(READY_NOTICE);

  const notifyInfo = useCallback((message: string) => {
    setNotice({ tone: "info", message });
  }, []);
  const notifySuccess = useCallback((message: string) => {
    setNotice({ tone: "success", message });
  }, []);
  const notifyError = useCallback((message: string) => {
    setNotice({ tone: "error", message });
  }, []);

  useEffect(() => {
    if (notice.tone === "error" || notice === READY_NOTICE) {
      return;
    }
    const handle = window.setTimeout(() => {
      setNotice(READY_NOTICE);
    }, NOTICE_AUTO_CLEAR_MS);
    return () => window.clearTimeout(handle);
  }, [notice]);

  return { notice, notifyInfo, notifySuccess, notifyError };
}
