import type {
  JsonMode,
  JsonSummary,
  JsonTreeNode,
  ParseIssue,
} from "../lib/jsonTools";
import type { RecentFile } from "../lib/recentFiles";
import { CopyPanel } from "./CopyPanel";
import { CurrentPathPanel } from "./CurrentPathPanel";
import { HealthPanel } from "./HealthPanel";
import { IssuePanel } from "./IssuePanel";
import { RecentFilesPanel } from "./RecentFilesPanel";
import { SummaryPanel } from "./SummaryPanel";
import { TreePanel } from "./TreePanel";

type SidebarProps = {
  mode: JsonMode;
  isValid: boolean;
  issues: ParseIssue[];
  summary: JsonSummary;
  sizeBytes: number;
  tree: JsonTreeNode[];
  treeTruncated: boolean;
  recentFiles: RecentFile[];
  onJumpToIssue: (issue: ParseIssue) => void;
  onJumpToTreeNode: (node: JsonTreeNode) => void;
  onCopyCurrentPath: () => void;
  onCopyDerived: (kind: "minified" | "escaped") => void;
  onOpenRecentFile: (recentFile: RecentFile) => void;
  onClearRecentFiles: () => void;
};

export function Sidebar({
  mode,
  isValid,
  issues,
  summary,
  sizeBytes,
  tree,
  treeTruncated,
  recentFiles,
  onJumpToIssue,
  onJumpToTreeNode,
  onCopyCurrentPath,
  onCopyDerived,
  onOpenRecentFile,
  onClearRecentFiles,
}: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="JSON 信息">
      <HealthPanel
        isValid={isValid}
        issueCount={issues.length}
        mode={mode}
      />
      <IssuePanel
        isValid={isValid}
        issues={issues}
        onJumpToIssue={onJumpToIssue}
      />
      <SummaryPanel summary={summary} sizeBytes={sizeBytes} />
      <TreePanel
        isValid={isValid}
        tree={tree}
        treeTruncated={treeTruncated}
        currentPath={summary.currentPath}
        onJumpToTreeNode={onJumpToTreeNode}
      />
      <CurrentPathPanel
        currentPath={summary.currentPath}
        onCopyCurrentPath={onCopyCurrentPath}
      />
      <CopyPanel isValid={isValid} onCopy={onCopyDerived} />
      <RecentFilesPanel
        recentFiles={recentFiles}
        onOpenRecentFile={onOpenRecentFile}
        onClearRecentFiles={onClearRecentFiles}
      />
    </aside>
  );
}
