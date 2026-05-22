import { Braces } from "lucide-react";
import type { FormatState, JsonSummary, RootType } from "../lib/jsonTools";
import { formatBytes } from "../lib/fileState";

const ROOT_LABELS: Record<RootType, string> = {
  object: "对象",
  array: "数组",
  string: "字符串",
  number: "数字",
  boolean: "布尔值",
  null: "空值",
  unknown: "未知",
};

const FORMAT_LABELS: Record<FormatState, string> = {
  formatted: "已格式化",
  minified: "已压缩",
  custom: "自定义排版",
  invalid: "无法判断",
};

type SummaryPanelProps = {
  summary: JsonSummary;
  sizeBytes: number;
};

export function SummaryPanel({ summary, sizeBytes }: SummaryPanelProps) {
  const itemCountLabel =
    summary.itemCount === null ? "不适用" : `${summary.itemCount}`;

  return (
    <section className="side-panel">
      <div className="panel-title">
        <Braces size={17} aria-hidden="true" />
        <h2>结构</h2>
      </div>
      <dl className="summary-grid">
        <div>
          <dt>根类型</dt>
          <dd>{ROOT_LABELS[summary.rootType]}</dd>
        </div>
        <div>
          <dt>条目数</dt>
          <dd>{itemCountLabel}</dd>
        </div>
        <div>
          <dt>排版</dt>
          <dd>{FORMAT_LABELS[summary.formatState]}</dd>
        </div>
        <div>
          <dt>大小</dt>
          <dd>{formatBytes(sizeBytes)}</dd>
        </div>
      </dl>
    </section>
  );
}
