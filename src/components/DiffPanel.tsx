import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { ArrowLeftRight, X } from "lucide-react";
import {
  ParseError,
  findNodeAtLocation,
  parse,
  parseTree,
} from "jsonc-parser";
import {
  diffJson,
  summarizeDiff,
  type DiffEntry,
  type DiffKind,
  type DiffSegment,
} from "../lib/jsonDiff";

const KIND_LABELS: Record<DiffKind, string> = {
  added: "新增",
  removed: "删除",
  changed: "变更",
  unchanged: "相同",
};

type ParseAttempt =
  | { ok: true; value: unknown }
  | { ok: false; message: string };

const PARSE_OPTIONS = {
  allowTrailingComma: true,
  disallowComments: false,
};

const editorOptions: Monaco.editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  fontFamily: "JetBrains Mono, SFMono-Regular, Menlo, Consolas, monospace",
  fontLigatures: false,
  fontSize: 13,
  lineHeight: 20,
  minimap: { enabled: false },
  padding: { top: 8, bottom: 8 },
  renderLineHighlight: "gutter",
  scrollBeyondLastLine: false,
  tabSize: 2,
  wordWrap: "on",
};

type DiffPanelProps = {
  initialLeft?: string;
  initialRight?: string;
  onClose: () => void;
};

type EditorInstance = Monaco.editor.IStandaloneCodeEditor;

export function DiffPanel({
  initialLeft = "",
  initialRight = "",
  onClose,
}: DiffPanelProps) {
  const [left, setLeft] = useState(initialLeft);
  const [right, setRight] = useState(initialRight);

  const leftEditor = useRef<EditorInstance | null>(null);
  const rightEditor = useRef<EditorInstance | null>(null);
  const isSyncing = useRef(false);

  const leftParse = useMemo(() => parseInput(left), [left]);
  const rightParse = useMemo(() => parseInput(right), [right]);

  const result = useMemo(() => {
    if (!leftParse.ok || !rightParse.ok) {
      return null;
    }
    return diffJson(leftParse.value, rightParse.value);
  }, [leftParse, rightParse]);

  const summary = useMemo(
    () => (result ? summarizeDiff(result) : null),
    [result],
  );

  const swap = useCallback(() => {
    setLeft(right);
    setRight(left);
  }, [left, right]);

  const wireScrollSync = useCallback(
    (source: EditorInstance, target: EditorInstance) => {
      return source.onDidScrollChange((event) => {
        if (isSyncing.current) {
          return;
        }
        isSyncing.current = true;
        try {
          target.setScrollPosition(
            { scrollTop: event.scrollTop, scrollLeft: event.scrollLeft },
            1, // ScrollType.Immediate
          );
        } finally {
          isSyncing.current = false;
        }
      });
    },
    [],
  );

  useEffect(() => {
    const a = leftEditor.current;
    const b = rightEditor.current;
    if (!a || !b) {
      return;
    }
    const leftDispose = wireScrollSync(a, b);
    const rightDispose = wireScrollSync(b, a);
    return () => {
      leftDispose.dispose();
      rightDispose.dispose();
    };
  }, [wireScrollSync, left, right]);

  const onLeftMount: OnMount = (editor) => {
    leftEditor.current = editor;
  };

  const onRightMount: OnMount = (editor) => {
    rightEditor.current = editor;
  };

  const focusEntry = useCallback((entry: DiffEntry) => {
    revealEntrySide(leftEditor.current, left, entry.segments, entry.kind, "left");
    revealEntrySide(
      rightEditor.current,
      right,
      entry.segments,
      entry.kind,
      "right",
    );
  }, [left, right]);

  return (
    <section className="diff-panel" aria-label="JSON Diff">
      <header className="diff-toolbar">
        <div className="diff-title">
          <h2>JSON Diff</h2>
          {summary ? (
            <span className="diff-summary">
              <span className="diff-stat added">+{summary.added}</span>
              <span className="diff-stat removed">-{summary.removed}</span>
              <span className="diff-stat changed">~{summary.changed}</span>
              {summary.added + summary.removed + summary.changed === 0 ? (
                <span className="diff-stat clean">两侧完全一致</span>
              ) : null}
            </span>
          ) : null}
        </div>
        <div className="diff-actions">
          <button type="button" onClick={swap} title="左右互换">
            <ArrowLeftRight size={15} aria-hidden="true" />
            互换
          </button>
          <button type="button" onClick={onClose} title="关闭 Diff">
            <X size={15} aria-hidden="true" />
            关闭
          </button>
        </div>
      </header>

      <div className="diff-inputs">
        <DiffInputArea
          label="左侧"
          value={left}
          onChange={setLeft}
          parse={leftParse}
          editorPath="diff://left.jsonc"
          onMount={onLeftMount}
        />
        <DiffInputArea
          label="右侧"
          value={right}
          onChange={setRight}
          parse={rightParse}
          editorPath="diff://right.jsonc"
          onMount={onRightMount}
        />
      </div>

      <div className="diff-results">
        {!leftParse.ok || !rightParse.ok ? (
          <p className="empty-state">两侧都是合法 JSON 后才会展示差异。</p>
        ) : result && result.length === 0 ? (
          <p className="empty-state">两侧 JSON 完全一致。</p>
        ) : result ? (
          <ul className="diff-list">
            {result.map((entry, index) => (
              <li key={`${entry.path}-${index}`}>
                <button
                  type="button"
                  className="diff-row-button"
                  onClick={() => focusEntry(entry)}
                  title="跳转到两侧对应位置"
                >
                  <DiffRow entry={entry} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

type DiffInputAreaProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  parse: ParseAttempt;
  editorPath: string;
  onMount: OnMount;
};

function DiffInputArea({
  label,
  value,
  onChange,
  parse,
  editorPath,
  onMount,
}: DiffInputAreaProps) {
  return (
    <section className="diff-input">
      <div className="diff-input-header">
        <span>{label}</span>
        {parse.ok ? (
          <span className="diff-input-status valid">已解析</span>
        ) : (
          <span className="diff-input-status invalid" title={parse.message}>
            {parse.message}
          </span>
        )}
      </div>
      <div className="diff-input-editor">
        <Editor
          height="100%"
          language="json"
          onChange={(next) => onChange(next ?? "")}
          onMount={onMount}
          options={editorOptions}
          path={editorPath}
          theme="vs"
          value={value}
        />
      </div>
    </section>
  );
}

function DiffRow({ entry }: { entry: DiffEntry }) {
  return (
    <div className={`diff-row diff-${entry.kind}`}>
      <div className="diff-row-head">
        <span className={`diff-tag ${entry.kind}`}>
          {KIND_LABELS[entry.kind]}
        </span>
        <code className="diff-path">{entry.path}</code>
      </div>
      <div className="diff-row-body">
        {entry.kind !== "added" ? (
          <pre className="diff-value left">{previewValue(entry.leftValue)}</pre>
        ) : null}
        {entry.kind !== "removed" ? (
          <pre className="diff-value right">
            {previewValue(entry.rightValue)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

function parseInput(input: string): ParseAttempt {
  if (input.trim().length === 0) {
    return { ok: false, message: "等待输入" };
  }

  const errors: ParseError[] = [];
  const value = parse(input, errors, PARSE_OPTIONS);
  if (errors.length > 0) {
    return { ok: false, message: "JSON 无法解析" };
  }
  return { ok: true, value };
}

function previewValue(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function revealEntrySide(
  editor: EditorInstance | null,
  source: string,
  segments: DiffSegment[],
  kind: DiffKind,
  side: "left" | "right",
) {
  if (!editor) {
    return;
  }

  if (
    (kind === "added" && side === "left") ||
    (kind === "removed" && side === "right")
  ) {
    return;
  }

  const errors: ParseError[] = [];
  const tree = parseTree(source, errors, PARSE_OPTIONS);
  if (!tree) {
    return;
  }

  const node = segments.length === 0 ? tree : findNodeAtLocation(tree, segments);
  if (!node) {
    return;
  }

  const model = editor.getModel();
  if (!model) {
    return;
  }

  const start = model.getPositionAt(node.offset);
  const end = model.getPositionAt(node.offset + node.length);
  editor.revealRangeInCenter(
    {
      startLineNumber: start.lineNumber,
      startColumn: start.column,
      endLineNumber: end.lineNumber,
      endColumn: end.column,
    },
    1, // ScrollType.Immediate
  );
  editor.setSelection({
    startLineNumber: start.lineNumber,
    startColumn: start.column,
    endLineNumber: end.lineNumber,
    endColumn: end.column,
  });
}
