import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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
  Search,
  Wand2,
  X,
} from "lucide-react";
import "./App.css";
import {
  analyzeJson,
  escapeMinifiedJsonContent,
  filterTreeNodes,
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

type NoticeTone = "info" | "success" | "error";

type Notice = {
  tone: NoticeTone;
  message: string;
};

const READY_NOTICE: Notice = { tone: "info", message: "准备就绪" };
const NOTICE_AUTO_CLEAR_MS = 4000;

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
  const [treeSearch, setTreeSearch] = useState("");
  const [notice, setNotice] = useState<Notice>(READY_NOTICE);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const treeNodeRefs = useRef(new Map<string, HTMLButtonElement>());

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

  const deferredContent = useDeferredValue(file.content);
  const deferredCursorOffset = useDeferredValue(cursor.offset);

  const parseResult = useMemo(
    () => analyzeJson(deferredContent, mode, deferredCursorOffset),
    [deferredContent, deferredCursorOffset, mode],
  );

  const isParsePending =
    deferredContent !== file.content || deferredCursorOffset !== cursor.offset;

  const visibleTreeNodes = useMemo(
    () => filterTreeNodes(parseResult.tree, treeSearch),
    [parseResult.tree, treeSearch],
  );

  useEffect(() => {
    if (treeCollapsed) {
      return;
    }
    const button = treeNodeRefs.current.get(parseResult.summary.currentPath);
    button?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [parseResult.summary.currentPath, treeCollapsed, visibleTreeNodes]);

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

  const handleCommandError = useCallback(
    (error: unknown, fallback: string) => {
      const message = String(error);
      if (message.includes("CANCELLED")) {
        notifyInfo("操作已取消");
        return;
      }
      notifyError(message || fallback);
    },
    [notifyError, notifyInfo],
  );

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
    notifySuccess("已新建空白 JSON");
  }, [confirmDiscard, notifySuccess, resetCursor]);

  const restoreDemoFile = useCallback(() => {
    if (!confirmDiscard()) {
      return;
    }

    setFile(createDemoFileState());
    setMode("json");
    resetCursor();
    notifySuccess("已恢复示例文件");
  }, [confirmDiscard, notifySuccess, resetCursor]);

  const openFile = useCallback(async () => {
    if (!confirmDiscard()) {
      return;
    }

    try {
      const payload = await invoke<FilePayload>("open_json_file");
      setFile(fileStateFromPayload(payload));
      rememberFile(payload);
      notifySuccess(`已打开 ${payload.name}`);
      resetCursor();
    } catch (error) {
      handleCommandError(error, "打开失败");
    }
  }, [
    confirmDiscard,
    handleCommandError,
    notifySuccess,
    rememberFile,
    resetCursor,
  ]);

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
        notifySuccess(`已打开 ${payload.name}`);
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
    [
      confirmDiscard,
      handleCommandError,
      notifySuccess,
      rememberFile,
      resetCursor,
    ],
  );

  const clearRecentFiles = useCallback(() => {
    saveRecentFiles([]);
    setRecentFiles([]);
    notifyInfo("已清空最近文件");
  }, [notifyInfo]);

  const applySavedResult = useCallback(
    (result: SaveResult | FilePayload, savedContent: string) => {
      setFile((current) => applySaveResult(current, result, savedContent));
      notifySuccess(`已保存 ${result.name}`);
    },
    [notifySuccess],
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
      notifySuccess("已格式化");
    } catch (error) {
      handleCommandError(error, "格式化失败");
    }
  }, [file.content, handleCommandError, mode, notifySuccess]);

  const minifyContent = useCallback(() => {
    try {
      const minified = minifyJsonContent(file.content, mode);
      setFile((current) => updateFileContent(current, minified));
      notifySuccess(mode === "jsonc" ? "已压缩为标准 JSON" : "已压缩");
    } catch (error) {
      handleCommandError(error, "压缩失败");
    }
  }, [file.content, handleCommandError, mode, notifySuccess]);

  const escapeContent = useCallback(() => {
    try {
      const escaped = escapeMinifiedJsonContent(file.content, mode);
      setFile((current) => updateFileContent(current, escaped));
      notifySuccess("已压缩并转义为 JSON 字符串");
    } catch (error) {
      handleCommandError(error, "压缩转义失败");
    }
  }, [file.content, handleCommandError, mode, notifySuccess]);

  const unescapeContent = useCallback(() => {
    try {
      const unescaped = unescapeJsonContent(file.content, mode);
      setFile((current) => updateFileContent(current, unescaped));
      notifySuccess("已去除转义并格式化");
    } catch (error) {
      handleCommandError(error, "去除转义失败");
    }
  }, [file.content, handleCommandError, mode, notifySuccess]);

  const copyDerivedContent = useCallback(
    async (kind: "minified" | "escaped") => {
      try {
        const result =
          kind === "minified"
            ? minifyJsonContent(file.content, mode)
            : escapeMinifiedJsonContent(file.content, mode);

        await writeClipboardText(result);
        notifySuccess(kind === "minified" ? "已复制压缩结果" : "已复制转义结果");
      } catch (error) {
        handleCommandError(
          error,
          kind === "minified" ? "复制压缩结果失败" : "复制转义结果失败",
        );
      }
    },
    [file.content, handleCommandError, mode, notifySuccess],
  );

  const copyCurrentPath = useCallback(async () => {
    try {
      await writeClipboardText(parseResult.summary.currentPath);
      notifySuccess("已复制当前路径");
    } catch {
      notifyError("复制失败");
    }
  }, [notifyError, notifySuccess, parseResult.summary.currentPath]);

  const jumpToIssue = useCallback(
    (issue: ParseIssue) => {
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
      notifyInfo(`已定位到 ${issue.line}:${issue.column}`);
    },
    [notifyInfo],
  );

  const jumpToTreeNode = useCallback(
    (node: JsonTreeNode) => {
      const editor = editorRef.current;
      const model = editor?.getModel();

      if (!editor || !model) {
        return;
      }

      const position = model.getPositionAt(node.offset);
      editor.setPosition(position);
      editor.revealPositionInCenter(position);
      editor.focus();
      notifyInfo(`已定位到 ${node.path}`);
    },
    [notifyInfo],
  );

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
              notifyInfo("已切换到严格 JSON");
            }}
          >
            JSON
          </button>
          <button
            type="button"
            className={mode === "jsonc" ? "active" : ""}
            onClick={() => {
              setMode("jsonc");
              notifyInfo("已切换到 JSONC");
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
                <div className="tree-search">
                  <Search size={14} aria-hidden="true" />
                  <input
                    type="search"
                    value={treeSearch}
                    onChange={(event) => setTreeSearch(event.target.value)}
                    placeholder="搜索键、路径或值"
                    aria-label="搜索树节点"
                  />
                  {treeSearch ? (
                    <button
                      type="button"
                      className="tree-search-clear"
                      onClick={() => setTreeSearch("")}
                      title="清空搜索"
                      aria-label="清空搜索"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                {visibleTreeNodes.length === 0 ? (
                  <p className="empty-state">没有匹配节点</p>
                ) : (
                  <ul className="tree-list">
                    {visibleTreeNodes.map((node) => (
                      <li key={node.id}>
                        <button
                          type="button"
                          ref={(element) => {
                            const map = treeNodeRefs.current;
                            if (element) {
                              map.set(node.path, element);
                            } else {
                              map.delete(node.path);
                            }
                          }}
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
                )}
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
          {isParsePending ? "解析中…" : isValid ? "有效" : "无效"}
        </span>
        <span className={`notice notice-${notice.tone}`}>{notice.message}</span>
      </footer>
    </main>
  );
}

export default App;
