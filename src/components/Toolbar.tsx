import {
  FileJson,
  FolderOpen,
  Minimize2,
  Plus,
  Quote,
  RotateCcw,
  Save,
  SaveAll,
  Wand2,
} from "lucide-react";
import type { JsonMode } from "../lib/jsonTools";

type ToolbarProps = {
  filePath: string | null;
  fileDirty: boolean;
  isValid: boolean;
  mode: JsonMode;
  onNewBlankFile: () => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  onSaveFileAs: () => void;
  onRestoreDemo: () => void;
  onFormat: () => void;
  onMinify: () => void;
  onEscape: () => void;
  onUnescape: () => void;
  onModeChange: (next: JsonMode) => void;
};

export function Toolbar({
  filePath,
  fileDirty,
  isValid,
  mode,
  onNewBlankFile,
  onOpenFile,
  onSaveFile,
  onSaveFileAs,
  onRestoreDemo,
  onFormat,
  onMinify,
  onEscape,
  onUnescape,
  onModeChange,
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="brand">
        <FileJson size={24} aria-hidden="true" />
        <div>
          <h1>jsonDraft</h1>
          <span>{filePath ?? "本地草稿"}</span>
        </div>
      </div>

      <div className="toolbar-actions" aria-label="文件操作">
        <button type="button" onClick={onNewBlankFile} title="新建文件">
          <Plus size={17} aria-hidden="true" />
          新建
        </button>
        <button type="button" onClick={onOpenFile} title="打开文件">
          <FolderOpen size={17} aria-hidden="true" />
          打开
        </button>
        <button
          type="button"
          onClick={onSaveFile}
          disabled={!fileDirty && Boolean(filePath)}
          title="保存文件"
        >
          <Save size={17} aria-hidden="true" />
          保存
        </button>
        <button type="button" onClick={onSaveFileAs} title="另存为">
          <SaveAll size={17} aria-hidden="true" />
          另存为
        </button>
        <button type="button" onClick={onRestoreDemo} title="恢复示例">
          <FileJson size={17} aria-hidden="true" />
          示例
        </button>
        <span className="toolbar-divider" aria-hidden="true" />
        <button
          type="button"
          onClick={onFormat}
          disabled={!isValid}
          title="格式化"
        >
          <Wand2 size={17} aria-hidden="true" />
          格式化
        </button>
        <button
          type="button"
          onClick={onMinify}
          disabled={!isValid}
          title="压缩"
        >
          <Minimize2 size={17} aria-hidden="true" />
          压缩
        </button>
        <button
          type="button"
          onClick={onEscape}
          disabled={!isValid}
          title="压缩并转义"
        >
          <Quote size={17} aria-hidden="true" />
          压缩转义
        </button>
        <button type="button" onClick={onUnescape} title="去除转义">
          <RotateCcw size={17} aria-hidden="true" />
          去转义
        </button>
      </div>

      <div className="mode-switch" aria-label="JSON 模式">
        <button
          type="button"
          className={mode === "json" ? "active" : ""}
          onClick={() => onModeChange("json")}
        >
          JSON
        </button>
        <button
          type="button"
          className={mode === "jsonc" ? "active" : ""}
          onClick={() => onModeChange("jsonc")}
        >
          JSONC
        </button>
      </div>
    </header>
  );
}
