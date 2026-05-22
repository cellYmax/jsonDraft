import { ClipboardCopy } from "lucide-react";

type CurrentPathPanelProps = {
  currentPath: string;
  onCopyCurrentPath: () => void;
};

export function CurrentPathPanel({
  currentPath,
  onCopyCurrentPath,
}: CurrentPathPanelProps) {
  return (
    <section className="side-panel">
      <div className="panel-title with-action">
        <div>
          <ClipboardCopy size={17} aria-hidden="true" />
          <h2>当前位置</h2>
        </div>
        <button type="button" onClick={onCopyCurrentPath} title="复制路径">
          <ClipboardCopy size={15} aria-hidden="true" />
        </button>
      </div>
      <code className="json-path">{currentPath}</code>
    </section>
  );
}
