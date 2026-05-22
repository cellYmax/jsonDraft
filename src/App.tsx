import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { invoke } from "@tauri-apps/api/core";
import type * as Monaco from "monaco-editor";
import "./App.css";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { Toolbar } from "./components/Toolbar";
import { useCloseProtection } from "./hooks/useCloseProtection";
import { useNotice } from "./hooks/useNotice";
import { useShortcuts } from "./hooks/useShortcuts";
import { writeClipboardText } from "./lib/clipboard";
import {
  applySaveResult,
  createBlankFileState,
  createDemoFileState,
  fileStateFromPayload,
  updateFileContent,
  type FilePayload,
  type FileState,
  type SaveResult,
} from "./lib/fileState";
import {
  analyzeJson,
  escapeMinifiedJsonContent,
  formatJsonContent,
  minifyJsonContent,
  type JsonMode,
  type JsonTreeNode,
  type ParseIssue,
  unescapeJsonContent,
} from "./lib/jsonTools";
import {
  addRecentFile,
  loadRecentFiles,
  removeRecentFile,
  saveRecentFiles,
  type RecentFile,
} from "./lib/recentFiles";

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
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);

  const { notice, notifyInfo, notifySuccess, notifyError } = useNotice();

  const deferredContent = useDeferredValue(file.content);
  const deferredCursorOffset = useDeferredValue(cursor.offset);

  const parseResult = useMemo(
    () => analyzeJson(deferredContent, mode, deferredCursorOffset),
    [deferredContent, deferredCursorOffset, mode],
  );

  const isParsePending =
    deferredContent !== file.content || deferredCursorOffset !== cursor.offset;

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

  useCloseProtection(file.dirty);

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
    setRecentFiles((prev) => {
      const updated = addRecentFile(prev, {
        path: payload.path,
        name: payload.name,
      });
      saveRecentFiles(updated);
      return updated;
    });
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
          const updated = removeRecentFile(prev, recentFile.path);
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

  const handleModeChange = useCallback(
    (next: JsonMode) => {
      setMode(next);
      notifyInfo(next === "json" ? "已切换到严格 JSON" : "已切换到 JSONC");
    },
    [notifyInfo],
  );

  const shortcutHandlers = useMemo(
    () => ({
      onNew: newBlankFile,
      onOpen: () => {
        void openFile();
      },
      onSave: () => {
        void saveFile();
      },
      onSaveAs: () => {
        void saveFileAs();
      },
      onFormat: formatContent,
      onMinify: minifyContent,
      onEscape: escapeContent,
      onUnescape: unescapeContent,
    }),
    [
      escapeContent,
      formatContent,
      minifyContent,
      newBlankFile,
      openFile,
      saveFile,
      saveFileAs,
      unescapeContent,
    ],
  );

  useShortcuts(shortcutHandlers);

  const onEditorChange = (value: string | undefined) => {
    setFile((current) => updateFileContent(current, value ?? ""));
    if (editorRef.current) {
      updateCursorFromEditor(editorRef.current);
    }
  };

  const isValid = parseResult.summary.valid;

  return (
    <main className="app-shell">
      <Toolbar
        filePath={file.path}
        fileDirty={file.dirty}
        isValid={isValid}
        mode={mode}
        onNewBlankFile={newBlankFile}
        onOpenFile={() => {
          void openFile();
        }}
        onSaveFile={() => {
          void saveFile();
        }}
        onSaveFileAs={() => {
          void saveFileAs();
        }}
        onRestoreDemo={restoreDemoFile}
        onFormat={formatContent}
        onMinify={minifyContent}
        onEscape={escapeContent}
        onUnescape={unescapeContent}
        onModeChange={handleModeChange}
      />

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

        <Sidebar
          mode={mode}
          isValid={isValid}
          issues={parseResult.issues}
          summary={parseResult.summary}
          sizeBytes={file.sizeBytes}
          tree={parseResult.tree}
          treeTruncated={parseResult.treeTruncated}
          recentFiles={recentFiles}
          onJumpToIssue={jumpToIssue}
          onJumpToTreeNode={jumpToTreeNode}
          onCopyCurrentPath={() => {
            void copyCurrentPath();
          }}
          onCopyDerived={(kind) => {
            void copyDerivedContent(kind);
          }}
          onOpenRecentFile={(recentFile) => {
            void openRecentFile(recentFile);
          }}
          onClearRecentFiles={clearRecentFiles}
        />
      </section>

      <StatusBar
        fileName={file.name}
        dirty={file.dirty}
        cursorLine={cursor.line}
        cursorColumn={cursor.column}
        sizeBytes={file.sizeBytes}
        isValid={isValid}
        isParsePending={isParsePending}
        notice={notice}
      />
    </main>
  );
}

export default App;
