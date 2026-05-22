import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { writeText as writeTauriClipboardText } from "@tauri-apps/plugin-clipboard-manager";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type * as Monaco from "monaco-editor";
import {
  AlertCircle,
  Braces,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
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
import "./App.css";
import {
  analyzeJson,
  escapeMinifiedJsonContent,
  formatJsonContent,
  minifyJsonContent,
  type JsonTreeNode,
  type ParseIssue,
  unescapeJsonContent,
  type FormatState,
  type JsonMode,
  type RootType,
} from "./lib/jsonTools";
import {
  applySaveResult,
  createBlankFileState,
  createDemoFileState,
  fileStateFromPayload,
  formatBytes,
  updateFileContent,
  type FilePayload,
  type FileState,
  type SaveResult,
} from "./lib/fileState";

type CursorState = {
  line: number;
  column: number;
  offset: number;
};

type JsonDefaults = {
  setDiagnosticsOptions(options: {
    allowComments: boolean;
    comments: "error" | "warning" | "ignore";
    enableSchemaRequest: boolean;
    schemaValidation: "error" | "warning" | "ignore";
    trailingCommas: "error" | "warning" | "ignore";
    validate: boolean;
  }): void;
};

type MonacoWithJson = typeof Monaco & {
  languages: typeof Monaco.languages & {
    json?: {
      jsonDefaults: JsonDefaults;
    };
  };
};

type RecentFile = {
  path: string;
  name: string;
};

const ROOT_LABELS: Record<RootType, string> = {
  object: "对象",
  array: "数组",
  string: "字符串",
  number: "数字",
  boolean: "布尔值",
  null: "空值",
  unknown: "未知",
};

const TREE_TYPE_LABELS: Record<RootType, string> = {
  object: "对象",
  array: "数组",
  string: "文本",
  number: "数字",
  boolean: "布尔",
  null: "空",
  unknown: "?",
};

const FORMAT_LABELS: Record<FormatState, string> = {
  formatted: "已格式化",
  minified: "已压缩",
  custom: "自定义排版",
  invalid: "无法判断",
};

const editorOptions: Monaco.editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  fontFamily: "JetBrains Mono, SFMono-Regular, Menlo, Consolas, monospace",
  fontLigatures: false,
  fontSize: 14,
  lineHeight: 22,
  minimap: { enabled: false },
  padding: { top: 16, bottom: 16 },
  renderLineHighlight: "gutter",
  scrollBeyondLastLine: false,
  tabSize: 2,
  wordWrap: "on",
};

const RECENT_FILES_KEY = "jsonDraft.recentFiles";
const MAX_RECENT_FILES = 5;

async function writeClipboardText(text: string) {
  if (isTauri()) {
    await writeTauriClipboardText(text);
    return;
  }

  try {
    await Promise.race([
      navigator.clipboard.writeText(text),
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error("Clipboard timeout")), 800);
      }),
    ]);
    return;
  } catch {
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
}

function loadRecentFiles(): RecentFile[] {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(RECENT_FILES_KEY) ?? "[]",
    );

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (item): item is RecentFile =>
          typeof item?.path === "string" && typeof item?.name === "string",
      )
      .slice(0, MAX_RECENT_FILES);
  } catch {
    return [];
  }
}

function saveRecentFiles(files: RecentFile[]) {
  window.localStorage.setItem(
    RECENT_FILES_KEY,
    JSON.stringify(files.slice(0, MAX_RECENT_FILES)),
  );
}

function addRecentFile(files: RecentFile[], file: RecentFile): RecentFile[] {
  return [
    file,
    ...files.filter((candidate) => candidate.path !== file.path),
  ].slice(0, MAX_RECENT_FILES);
}

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

function App() {
  const [file, setFile] = useState<FileState>(() => createDemoFileState());
  const [mode, setMode] = useState<JsonMode>("json");
  const [cursor, setCursor] = useState<CursorState>({
    line: 1,
    column: 1,
    offset: 0,
  });
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>(() =>
    loadRecentFiles(),
  );
  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const [notice, setNotice] = useState("准备就绪");
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);

  const parseResult = useMemo(
    () => analyzeJson(file.content, mode, cursor.offset),
    [cursor.offset, file.content, mode],
  );

  const configureJsonDiagnostics = useCallback(
    (monaco: typeof Monaco) => {
      const jsonDefaults = (monaco as MonacoWithJson).languages.json
        ?.jsonDefaults;

      jsonDefaults?.setDiagnosticsOptions({
        allowComments: mode === "jsonc",
        comments: mode === "jsonc" ? "ignore" : "error",
        enableSchemaRequest: false,
        schemaValidation: "ignore",
        trailingCommas: mode === "jsonc" ? "ignore" : "error",
        validate: true,
      });
    },
    [mode],
  );

  useEffect(() => {
    if (monacoRef.current) {
      configureJsonDiagnostics(monacoRef.current);
    }
  }, [configureJsonDiagnostics]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!file.dirty) {
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
              file.dirty &&
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
  }, [file.dirty]);

  const updateCursorFromEditor = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor) => {
      const position = editor.getPosition();
      const model = editor.getModel();

      if (!position || !model) {
        return;
      }

      setCursor({
        line: position.lineNumber,
        column: position.column,
        offset: model.getOffsetAt(position),
      });
    },
    [],
  );

  const beforeMount: BeforeMount = (monaco) => {
    monacoRef.current = monaco;
    configureJsonDiagnostics(monaco);
  };

  const onMount: OnMount = (editor) => {
    editorRef.current = editor;
    updateCursorFromEditor(editor);
    editor.onDidChangeCursorPosition(() => updateCursorFromEditor(editor));
  };

  const confirmDiscard = useCallback(() => {
    return (
      !file.dirty ||
      window.confirm("当前文件有未保存修改，继续操作会丢失这些修改。")
    );
  }, [file.dirty]);

  const handleCommandError = useCallback((error: unknown, fallback: string) => {
    const message = String(error);
    if (message.includes("CANCELLED")) {
      setNotice("操作已取消");
      return;
    }
    setNotice(message || fallback);
  }, []);

  const rememberFile = useCallback((payload: FilePayload | SaveResult) => {
    const updated = addRecentFile(loadRecentFiles(), {
      path: payload.path,
      name: payload.name,
    });
    saveRecentFiles(updated);
    setRecentFiles(updated);
  }, []);

  const resetCursor = useCallback(() => {
    setCursor({ line: 1, column: 1, offset: 0 });
    window.setTimeout(() => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      const position = { lineNumber: 1, column: 1 };
      editor.setPosition(position);
      editor.revealPositionInCenter(position);
      editor.focus();
    }, 0);
  }, []);

  const newBlankFile = useCallback(() => {
    if (!confirmDiscard()) {
      return;
    }

    setFile(createBlankFileState());
    resetCursor();
    setNotice("已新建空白 JSON");
  }, [confirmDiscard, resetCursor]);

  const restoreDemoFile = useCallback(() => {
    if (!confirmDiscard()) {
      return;
    }

    setFile(createDemoFileState());
    setMode("json");
    resetCursor();
    setNotice("已恢复示例文件");
  }, [confirmDiscard, resetCursor]);

  const openFile = useCallback(async () => {
    if (!confirmDiscard()) {
      return;
    }

    try {
      const payload = await invoke<FilePayload>("open_json_file");
      setFile(fileStateFromPayload(payload));
      rememberFile(payload);
      setNotice(`已打开 ${payload.name}`);
      resetCursor();
    } catch (error) {
      handleCommandError(error, "打开失败");
    }
  }, [confirmDiscard, handleCommandError, rememberFile, resetCursor]);

  const openRecentFile = useCallback(
    async (recentFile: RecentFile) => {
      if (!confirmDiscard()) {
        return;
      }

      try {
        const payload = await invoke<FilePayload>("open_json_file_at", {
          path: recentFile.path,
        });
        setFile(fileStateFromPayload(payload));
        rememberFile(payload);
        setNotice(`已打开 ${payload.name}`);
        resetCursor();
      } catch (error) {
        setRecentFiles((prev) => {
          const updated = prev.filter(
            (candidate) => candidate.path !== recentFile.path,
          );
          saveRecentFiles(updated);
          return updated;
        });
        handleCommandError(error, "打开最近文件失败");
      }
    },
    [confirmDiscard, handleCommandError, rememberFile, resetCursor],
  );

  const clearRecentFiles = useCallback(() => {
    saveRecentFiles([]);
    setRecentFiles([]);
    setNotice("已清空最近文件");
  }, []);

  const applySavedResult = useCallback(
    (result: SaveResult | FilePayload, savedContent: string) => {
      setFile((current) => applySaveResult(current, result, savedContent));
      setNotice(`已保存 ${result.name}`);
    },
    [],
  );

  const saveFileAs = useCallback(async () => {
    const content = file.content;

    try {
      const payload = await invoke<FilePayload>("save_json_file_as", {
        content,
      });
      applySavedResult(payload, content);
      rememberFile(payload);
    } catch (error) {
      handleCommandError(error, "另存为失败");
    }
  }, [applySavedResult, file.content, handleCommandError, rememberFile]);

  const saveFile = useCallback(async () => {
    if (!file.path) {
      await saveFileAs();
      return;
    }

    const content = file.content;

    try {
      const result = await invoke<SaveResult>("save_json_file", {
        path: file.path,
        content,
      });
      applySavedResult(result, content);
      rememberFile(result);
    } catch (error) {
      handleCommandError(error, "保存失败");
    }
  }, [
    applySavedResult,
    file.content,
    file.path,
    handleCommandError,
    rememberFile,
    saveFileAs,
  ]);

  const formatContent = useCallback(() => {
    try {
      const formatted = formatJsonContent(file.content, mode);
      setFile((current) => updateFileContent(current, formatted));
      setNotice("已格式化");
    } catch (error) {
      handleCommandError(error, "格式化失败");
    }
  }, [file.content, handleCommandError, mode]);

  const minifyContent = useCallback(() => {
    try {
      const minified = minifyJsonContent(file.content, mode);
      setFile((current) => updateFileContent(current, minified));
      setNotice(mode === "jsonc" ? "已压缩为标准 JSON" : "已压缩");
    } catch (error) {
      handleCommandError(error, "压缩失败");
    }
  }, [file.content, handleCommandError, mode]);

  const escapeContent = useCallback(() => {
    try {
      const escaped = escapeMinifiedJsonContent(file.content, mode);
      setFile((current) => updateFileContent(current, escaped));
      setNotice("已压缩并转义为 JSON 字符串");
    } catch (error) {
      handleCommandError(error, "压缩转义失败");
    }
  }, [file.content, handleCommandError, mode]);

  const unescapeContent = useCallback(() => {
    try {
      const unescaped = unescapeJsonContent(file.content, mode);
      setFile((current) => updateFileContent(current, unescaped));
      setNotice("已去除转义并格式化");
    } catch (error) {
      handleCommandError(error, "去除转义失败");
    }
  }, [file.content, handleCommandError, mode]);

  const copyDerivedContent = useCallback(
    async (kind: "minified" | "escaped") => {
      try {
        const result =
          kind === "minified"
            ? minifyJsonContent(file.content, mode)
            : escapeMinifiedJsonContent(file.content, mode);

        await writeClipboardText(result);
        setNotice(kind === "minified" ? "已复制压缩结果" : "已复制转义结果");
      } catch (error) {
        handleCommandError(
          error,
          kind === "minified" ? "复制压缩结果失败" : "复制转义结果失败",
        );
      }
    },
    [file.content, handleCommandError, mode],
  );

  const copyCurrentPath = useCallback(async () => {
    try {
      await writeClipboardText(parseResult.summary.currentPath);
      setNotice("已复制当前路径");
    } catch {
      setNotice("复制失败");
    }
  }, [parseResult.summary.currentPath]);

  const jumpToIssue = useCallback((issue: ParseIssue) => {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    const position = {
      lineNumber: issue.line,
      column: issue.column,
    };

    editor.setPosition(position);
    editor.revealPositionInCenter(position);
    editor.focus();
    setNotice(`已定位到 ${issue.line}:${issue.column}`);
  }, []);

  const jumpToTreeNode = useCallback((node: JsonTreeNode) => {
    const editor = editorRef.current;
    const model = editor?.getModel();

    if (!editor || !model) {
      return;
    }

    const position = model.getPositionAt(node.offset);
    editor.setPosition(position);
    editor.revealPositionInCenter(position);
    editor.focus();
    setNotice(`已定位到 ${node.path}`);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const primary = event.metaKey || event.ctrlKey;

      if (!primary || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "o") {
        event.preventDefault();
        void openFile();
        return;
      }

      if (key === "n") {
        event.preventDefault();
        newBlankFile();
        return;
      }

      if (key === "s") {
        event.preventDefault();
        void (event.shiftKey ? saveFileAs() : saveFile());
        return;
      }

      if (key === "enter" && !event.shiftKey) {
        event.preventDefault();
        formatContent();
        return;
      }

      if (event.shiftKey && key === "m") {
        event.preventDefault();
        minifyContent();
        return;
      }

      if (event.shiftKey && key === "e") {
        event.preventDefault();
        escapeContent();
        return;
      }

      if (event.shiftKey && key === "u") {
        event.preventDefault();
        unescapeContent();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    escapeContent,
    formatContent,
    minifyContent,
    newBlankFile,
    openFile,
    saveFile,
    saveFileAs,
    unescapeContent,
  ]);

  const onEditorChange = (value: string | undefined) => {
    setFile((current) => updateFileContent(current, value ?? ""));
    if (editorRef.current) {
      updateCursorFromEditor(editorRef.current);
    }
  };

  const issueCount = parseResult.issues.length;
  const isValid = parseResult.summary.valid;
  const itemCountLabel =
    parseResult.summary.itemCount === null
      ? "不适用"
      : `${parseResult.summary.itemCount}`;

  return (
    <main className="app-shell">
      <header className="toolbar">
        <div className="brand">
          <FileJson size={24} aria-hidden="true" />
          <div>
            <h1>jsonDraft</h1>
            <span>{file.path ?? "本地草稿"}</span>
          </div>
        </div>

        <div className="toolbar-actions" aria-label="文件操作">
          <button type="button" onClick={newBlankFile} title="新建文件">
            <Plus size={17} aria-hidden="true" />
            新建
          </button>
          <button type="button" onClick={openFile} title="打开文件">
            <FolderOpen size={17} aria-hidden="true" />
            打开
          </button>
          <button
            type="button"
            onClick={saveFile}
            disabled={!file.dirty && Boolean(file.path)}
            title="保存文件"
          >
            <Save size={17} aria-hidden="true" />
            保存
          </button>
          <button type="button" onClick={saveFileAs} title="另存为">
            <SaveAll size={17} aria-hidden="true" />
            另存为
          </button>
          <button type="button" onClick={restoreDemoFile} title="恢复示例">
            <FileJson size={17} aria-hidden="true" />
            示例
          </button>
          <span className="toolbar-divider" aria-hidden="true" />
          <button
            type="button"
            onClick={formatContent}
            disabled={!isValid}
            title="格式化"
          >
            <Wand2 size={17} aria-hidden="true" />
            格式化
          </button>
          <button
            type="button"
            onClick={minifyContent}
            disabled={!isValid}
            title="压缩"
          >
            <Minimize2 size={17} aria-hidden="true" />
            压缩
          </button>
          <button
            type="button"
            onClick={escapeContent}
            disabled={!isValid}
            title="压缩并转义"
          >
            <Quote size={17} aria-hidden="true" />
            压缩转义
          </button>
          <button type="button" onClick={unescapeContent} title="去除转义">
            <RotateCcw size={17} aria-hidden="true" />
            去转义
          </button>
        </div>

        <div className="mode-switch" aria-label="JSON 模式">
          <button
            type="button"
            className={mode === "json" ? "active" : ""}
            onClick={() => {
              setMode("json");
              setNotice("已切换到严格 JSON");
            }}
          >
            JSON
          </button>
          <button
            type="button"
            className={mode === "jsonc" ? "active" : ""}
            onClick={() => {
              setMode("jsonc");
              setNotice("已切换到 JSONC");
            }}
          >
            JSONC
          </button>
        </div>
      </header>

      <section className="workspace">
        <div className="editor-pane">
          <Editor
            beforeMount={beforeMount}
            height="100%"
            language="json"
            onChange={onEditorChange}
            onMount={onMount}
            options={editorOptions}
            path={file.path ?? file.name}
            theme="vs"
            value={file.content}
          />
        </div>

        <aside className="sidebar" aria-label="JSON 信息">
          <section className={`health ${isValid ? "valid" : "invalid"}`}>
            {isValid ? (
              <CheckCircle2 size={22} aria-hidden="true" />
            ) : (
              <AlertCircle size={22} aria-hidden="true" />
            )}
            <div>
              <strong>{isValid ? "校验通过" : `发现 ${issueCount} 个错误`}</strong>
              <span>{mode === "json" ? "严格 JSON" : "JSONC"}</span>
            </div>
          </section>

          <section className="side-panel">
            <div className="panel-title">
              <AlertCircle size={17} aria-hidden="true" />
              <h2>错误</h2>
            </div>
            {isValid ? (
              <p className="empty-state">没有解析错误</p>
            ) : (
              <ul className="issue-list">
                {parseResult.issues.map((issue) => (
                  <li key={`${issue.offset}-${issue.message}`}>
                    <button
                      type="button"
                      className="issue-button"
                      onClick={() => jumpToIssue(issue)}
                      title="跳转到错误位置"
                    >
                      <strong>
                        {issue.line}:{issue.column}
                      </strong>
                      <span>{issue.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="side-panel">
            <div className="panel-title">
              <Braces size={17} aria-hidden="true" />
              <h2>结构</h2>
            </div>
            <dl className="summary-grid">
              <div>
                <dt>根类型</dt>
                <dd>{ROOT_LABELS[parseResult.summary.rootType]}</dd>
              </div>
              <div>
                <dt>条目数</dt>
                <dd>{itemCountLabel}</dd>
              </div>
              <div>
                <dt>排版</dt>
                <dd>{FORMAT_LABELS[parseResult.summary.formatState]}</dd>
              </div>
              <div>
                <dt>大小</dt>
                <dd>{formatBytes(file.sizeBytes)}</dd>
              </div>
            </dl>
          </section>

          <section
            className={`side-panel tree-panel ${treeCollapsed ? "collapsed" : ""}`}
          >
            <div className="panel-title with-action">
              <div>
                <Braces size={17} aria-hidden="true" />
                <h2>树形导航</h2>
              </div>
              <button
                type="button"
                onClick={() => setTreeCollapsed((current) => !current)}
                title={treeCollapsed ? "展开树形导航" : "收起树形导航"}
              >
                {treeCollapsed ? (
                  <ChevronRight size={15} aria-hidden="true" />
                ) : (
                  <ChevronDown size={15} aria-hidden="true" />
                )}
              </button>
            </div>
            {treeCollapsed ? null : !isValid ? (
              <p className="empty-state">修复错误后显示结构</p>
            ) : parseResult.tree.length === 0 ? (
              <p className="empty-state">没有可导航节点</p>
            ) : (
              <>
                <ul className="tree-list">
                  {parseResult.tree.map((node) => (
                    <li key={node.id}>
                      <button
                        type="button"
                        className={
                          node.path === parseResult.summary.currentPath
                            ? "active"
                            : ""
                        }
                        onClick={() => jumpToTreeNode(node)}
                        style={{
                          paddingLeft: `${8 + Math.min(node.depth, 8) * 10}px`,
                        }}
                        title={node.path}
                      >
                        <span className={`tree-type ${node.type}`}>
                          {TREE_TYPE_LABELS[node.type]}
                        </span>
                        <span className="tree-label">{node.label}</span>
                        <span className="tree-preview">{node.preview}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {parseResult.treeTruncated ? (
                  <p className="tree-note">仅显示前 250 个节点</p>
                ) : null}
              </>
            )}
          </section>

          <section className="side-panel">
            <div className="panel-title with-action">
              <div>
                <ClipboardCopy size={17} aria-hidden="true" />
                <h2>当前位置</h2>
              </div>
              <button type="button" onClick={copyCurrentPath} title="复制路径">
                <ClipboardCopy size={15} aria-hidden="true" />
              </button>
            </div>
            <code className="json-path">{parseResult.summary.currentPath}</code>
          </section>

          <section className="side-panel">
            <div className="panel-title">
              <ClipboardCopy size={17} aria-hidden="true" />
              <h2>快速复制</h2>
            </div>
            <div className="copy-actions">
              <button
                type="button"
                onClick={() => copyDerivedContent("minified")}
                disabled={!isValid}
                title="复制压缩后的 JSON"
              >
                <Minimize2 size={15} aria-hidden="true" />
                压缩
              </button>
              <button
                type="button"
                onClick={() => copyDerivedContent("escaped")}
                disabled={!isValid}
                title="复制压缩并转义后的 JSON 字符串"
              >
                <Quote size={15} aria-hidden="true" />
                转义
              </button>
            </div>
          </section>

          <section className="side-panel">
            <div className="panel-title with-action">
              <div>
                <FolderOpen size={17} aria-hidden="true" />
                <h2>最近文件</h2>
              </div>
              {recentFiles.length > 0 ? (
                <button type="button" onClick={clearRecentFiles} title="清空">
                  清空
                </button>
              ) : null}
            </div>
            {recentFiles.length === 0 ? (
              <p className="empty-state">还没有最近文件</p>
            ) : (
              <ul className="recent-list">
                {recentFiles.map((recentFile) => (
                  <li key={recentFile.path}>
                    <button
                      type="button"
                      onClick={() => openRecentFile(recentFile)}
                      title={recentFile.path}
                    >
                      <strong>{recentFile.name}</strong>
                      <span>{recentFile.path}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </section>

      <footer className="statusbar">
        <span className={file.dirty ? "dirty-dot active" : "dirty-dot"} />
        <span>{file.name}</span>
        <span>{file.dirty ? "未保存" : "已保存"}</span>
        <span>
          行 {cursor.line}，列 {cursor.column}
        </span>
        <span>{formatBytes(file.sizeBytes)}</span>
        <span className={isValid ? "status-ok" : "status-error"}>
          {isValid ? "有效" : "无效"}
        </span>
        <span className="notice">{notice}</span>
      </footer>
    </main>
  );
}

export default App;
