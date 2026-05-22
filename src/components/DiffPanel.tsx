import { useMemo, useState } from "react";
import { ArrowLeftRight, X } from "lucide-react";
import { ParseError, parse } from "jsonc-parser";
import {
  diffJson,
  summarizeDiff,
  type DiffEntry,
  type DiffKind,
} from "../lib/jsonDiff";

const KIND_LABELS: Record<DiffKind, string> = {
  added: "新增",
  removed: "删除",
  changed: "变更",
  unchanged: "相同",
};

type DiffPanelProps = {
  initialLeft?: string;
  initialRight?: string;
  onClose: () => void;
};

type ParseAttempt =
  | { ok: true; value: unknown }
  | { ok: false; message: string };

const PARSE_OPTIONS = {
  allowTrailingComma: true,
  disallowComments: false,
};

export function DiffPanel({
  initialLeft = "",
  initialRight = "",
  onClose,
}: DiffPanelProps) {
  const [left, setLeft] = useState(initialLeft);
  const [right, setRight] = useState(initialRight);

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

  const swap = () => {
    setLeft(right);
    setRight(left);
  };

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
        />
        <DiffInputArea
          label="右侧"
          value={right}
          onChange={setRight}
          parse={rightParse}
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
                <DiffRow entry={entry} />
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
};

function DiffInputArea({ label, value, onChange, parse }: DiffInputAreaProps) {
  return (
    <label className="diff-input">
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
      <textarea
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="粘贴或输入 JSON / JSONC"
      />
    </label>
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
