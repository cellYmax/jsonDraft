import { ClipboardCopy, Minimize2, Quote } from "lucide-react";

type CopyPanelProps = {
  isValid: boolean;
  onCopy: (kind: "minified" | "escaped") => void;
};

export function CopyPanel({ isValid, onCopy }: CopyPanelProps) {
  return (
    <section className="side-panel">
      <div className="panel-title">
        <ClipboardCopy size={17} aria-hidden="true" />
        <h2>快速复制</h2>
      </div>
      <div className="copy-actions">
        <button
          type="button"
          onClick={() => onCopy("minified")}
          disabled={!isValid}
          title="复制压缩后的 JSON"
        >
          <Minimize2 size={15} aria-hidden="true" />
          压缩
        </button>
        <button
          type="button"
          onClick={() => onCopy("escaped")}
          disabled={!isValid}
          title="复制压缩并转义后的 JSON 字符串"
        >
          <Quote size={15} aria-hidden="true" />
          转义
        </button>
      </div>
    </section>
  );
}
