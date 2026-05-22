import { useEffect, useMemo, useRef, useState } from "react";
import {
  Braces,
  ChevronDown,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import {
  filterTreeNodes,
  type JsonTreeNode,
  type RootType,
} from "../lib/jsonTools";

const TREE_TYPE_LABELS: Record<RootType, string> = {
  object: "对象",
  array: "数组",
  string: "文本",
  number: "数字",
  boolean: "布尔",
  null: "空",
  unknown: "?",
};

type TreePanelProps = {
  isValid: boolean;
  tree: JsonTreeNode[];
  treeTruncated: boolean;
  currentPath: string;
  onJumpToTreeNode: (node: JsonTreeNode) => void;
};

export function TreePanel({
  isValid,
  tree,
  treeTruncated,
  currentPath,
  onJumpToTreeNode,
}: TreePanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const treeNodeRefs = useRef(new Map<string, HTMLButtonElement>());

  const visibleNodes = useMemo(
    () => filterTreeNodes(tree, search),
    [tree, search],
  );

  useEffect(() => {
    if (collapsed) {
      return;
    }
    const button = treeNodeRefs.current.get(currentPath);
    button?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [collapsed, currentPath, visibleNodes]);

  return (
    <section
      className={`side-panel tree-panel ${collapsed ? "collapsed" : ""}`}
    >
      <div className="panel-title with-action">
        <div>
          <Braces size={17} aria-hidden="true" />
          <h2>树形导航</h2>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((current) => !current)}
          title={collapsed ? "展开树形导航" : "收起树形导航"}
        >
          {collapsed ? (
            <ChevronRight size={15} aria-hidden="true" />
          ) : (
            <ChevronDown size={15} aria-hidden="true" />
          )}
        </button>
      </div>
      {collapsed ? null : !isValid ? (
        <p className="empty-state">修复错误后显示结构</p>
      ) : tree.length === 0 ? (
        <p className="empty-state">没有可导航节点</p>
      ) : (
        <>
          <div className="tree-search">
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索键、路径或值"
              aria-label="搜索树节点"
            />
            {search ? (
              <button
                type="button"
                className="tree-search-clear"
                onClick={() => setSearch("")}
                title="清空搜索"
                aria-label="清空搜索"
              >
                <X size={13} aria-hidden="true" />
              </button>
            ) : null}
          </div>
          {visibleNodes.length === 0 ? (
            <p className="empty-state">没有匹配节点</p>
          ) : (
            <ul className="tree-list">
              {visibleNodes.map((node) => (
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
                    className={node.path === currentPath ? "active" : ""}
                    onClick={() => onJumpToTreeNode(node)}
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
          {treeTruncated ? (
            <p className="tree-note">仅显示前 250 个节点</p>
          ) : null}
        </>
      )}
    </section>
  );
}
