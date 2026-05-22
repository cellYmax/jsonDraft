import { AlertCircle } from "lucide-react";
import type { ParseIssue } from "../lib/jsonTools";

type IssuePanelProps = {
  isValid: boolean;
  issues: ParseIssue[];
  onJumpToIssue: (issue: ParseIssue) => void;
};

export function IssuePanel({ isValid, issues, onJumpToIssue }: IssuePanelProps) {
  return (
    <section className="side-panel">
      <div className="panel-title">
        <AlertCircle size={17} aria-hidden="true" />
        <h2>错误</h2>
      </div>
      {isValid ? (
        <p className="empty-state">没有解析错误</p>
      ) : (
        <ul className="issue-list">
          {issues.map((issue) => (
            <li key={`${issue.offset}-${issue.message}`}>
              <button
                type="button"
                className="issue-button"
                onClick={() => onJumpToIssue(issue)}
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
  );
}
