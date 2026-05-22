import { FolderOpen } from "lucide-react";
import type { RecentFile } from "../lib/recentFiles";

type RecentFilesPanelProps = {
  recentFiles: RecentFile[];
  onOpenRecentFile: (recentFile: RecentFile) => void;
  onClearRecentFiles: () => void;
};

export function RecentFilesPanel({
  recentFiles,
  onOpenRecentFile,
  onClearRecentFiles,
}: RecentFilesPanelProps) {
  return (
    <section className="side-panel">
      <div className="panel-title with-action">
        <div>
          <FolderOpen size={17} aria-hidden="true" />
          <h2>最近文件</h2>
        </div>
        {recentFiles.length > 0 ? (
          <button type="button" onClick={onClearRecentFiles} title="清空">
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
                onClick={() => onOpenRecentFile(recentFile)}
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
  );
}
