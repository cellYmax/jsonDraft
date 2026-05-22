import type { Notice } from "../hooks/useNotice";
import { formatBytes } from "../lib/fileState";

type StatusBarProps = {
  fileName: string;
  dirty: boolean;
  cursorLine: number;
  cursorColumn: number;
  sizeBytes: number;
  isValid: boolean;
  isParsePending: boolean;
  notice: Notice;
};

export function StatusBar({
  fileName,
  dirty,
  cursorLine,
  cursorColumn,
  sizeBytes,
  isValid,
  isParsePending,
  notice,
}: StatusBarProps) {
  return (
    <footer className="statusbar">
      <span className={dirty ? "dirty-dot active" : "dirty-dot"} />
      <span>{fileName}</span>
      <span>{dirty ? "未保存" : "已保存"}</span>
      <span>
        行 {cursorLine}，列 {cursorColumn}
      </span>
      <span>{formatBytes(sizeBytes)}</span>
      <span className={isValid ? "status-ok" : "status-error"}>
        {isParsePending ? "解析中…" : isValid ? "有效" : "无效"}
      </span>
      <span className={`notice notice-${notice.tone}`}>{notice.message}</span>
    </footer>
  );
}
