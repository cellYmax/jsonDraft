import { isTauri } from "@tauri-apps/api/core";
import { writeText as writeTauriClipboardText } from "@tauri-apps/plugin-clipboard-manager";

export async function writeClipboardText(text: string): Promise<void> {
  if (isTauri()) {
    await writeTauriClipboardText(text);
    return;
  }

  try {
    await Promise.race([
      navigator.clipboard.writeText(text),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("Clipboard timeout")), 800);
      }),
    ]);
    return;
  } catch {
    fallbackCopy(text);
  }
}

function fallbackCopy(text: string) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "true");
  textArea.style.left = "-9999px";
  textArea.style.position = "fixed";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(textArea);

  if (!copied) {
    throw new Error("复制失败。");
  }
}
