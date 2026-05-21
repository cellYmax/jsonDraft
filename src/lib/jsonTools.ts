import {
  applyEdits,
  format as formatJsonc,
  getLocation,
  getNodeValue,
  parse,
  parseTree,
} from "jsonc-parser";
import type { Node, ParseError } from "jsonc-parser";

export type JsonMode = "json" | "jsonc";
export type RootType =
  | "object"
  | "array"
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "unknown";

export type FormatState = "formatted" | "minified" | "custom" | "invalid";

export type ParseIssue = {
  message: string;
  line: number;
  column: number;
  offset: number;
  severity: "error";
};

export type JsonSummary = {
  valid: boolean;
  rootType: RootType;
  itemCount: number | null;
  currentPath: string;
  formatState: FormatState;
};

export type ParseResult = {
  value: unknown;
  issues: ParseIssue[];
  summary: JsonSummary;
  tree: JsonTreeNode[];
  treeTruncated: boolean;
};

export type JsonTreeNode = {
  id: string;
  label: string;
  path: string;
  type: RootType;
  preview: string;
  depth: number;
  offset: number;
  length: number;
};

const MAX_TREE_NODES = 250;

const parseOptions = {
  json: { allowTrailingComma: false, disallowComments: true },
  jsonc: { allowTrailingComma: true, disallowComments: false },
} satisfies Record<JsonMode, Parameters<typeof parse>[2]>;

const PARSE_ERROR = {
  InvalidSymbol: 1,
  InvalidNumberFormat: 2,
  PropertyNameExpected: 3,
  ValueExpected: 4,
  ColonExpected: 5,
  CommaExpected: 6,
  CloseBraceExpected: 7,
  CloseBracketExpected: 8,
  EndOfFileExpected: 9,
  InvalidCommentToken: 10,
  UnexpectedEndOfComment: 11,
  UnexpectedEndOfString: 12,
  UnexpectedEndOfNumber: 13,
  InvalidUnicode: 14,
  InvalidEscapeCharacter: 15,
  InvalidCharacter: 16,
} as const;

export function analyzeJson(
  content: string,
  mode: JsonMode,
  cursorOffset = 0,
): ParseResult {
  const safeOffset = Math.max(0, Math.min(cursorOffset, content.length));
  const currentPath = pathToString(getLocation(content, safeOffset).path);

  if (content.trim().length === 0) {
    return {
      value: undefined,
      issues: [
        {
          message: "内容为空，请输入 JSON。",
          line: 1,
          column: 1,
          offset: 0,
          severity: "error",
        },
      ],
      summary: {
        valid: false,
        rootType: "unknown",
        itemCount: null,
        currentPath,
        formatState: "invalid",
      },
      tree: [],
      treeTruncated: false,
    };
  }

  const errors: ParseError[] = [];
  const tree = parseTree(content, errors, parseOptions[mode]);
  const issues = errors.map((error) => toIssue(content, error));

  if (!tree || issues.length > 0) {
    return {
      value: undefined,
      issues,
      summary: {
        valid: false,
        rootType: "unknown",
        itemCount: null,
        currentPath,
        formatState: "invalid",
      },
      tree: [],
      treeTruncated: false,
    };
  }

  const value = parse(content, [], parseOptions[mode]);
  const rootType = getRootType(value);
  const treeInfo = buildTree(tree);

  return {
    value,
    issues: [],
    summary: {
      valid: true,
      rootType,
      itemCount: getItemCount(value),
      currentPath,
      formatState: detectFormatState(content, mode, value),
    },
    tree: treeInfo.nodes,
    treeTruncated: treeInfo.truncated,
  };
}

export function formatJsonContent(content: string, mode: JsonMode): string {
  assertValid(content, mode);

  if (mode === "json") {
    return `${JSON.stringify(JSON.parse(content), null, 2)}\n`;
  }

  const edits = formatJsonc(content, undefined, {
    eol: "\n",
    insertSpaces: true,
    tabSize: 2,
  });
  return ensureTrailingNewline(applyEdits(content, edits));
}

export function minifyJsonContent(content: string, mode: JsonMode): string {
  assertValid(content, mode);
  const value = parse(content, [], parseOptions[mode]);
  return JSON.stringify(value);
}

export function escapeMinifiedJsonContent(
  content: string,
  mode: JsonMode,
): string {
  return JSON.stringify(minifyJsonContent(content, mode));
}

export function unescapeJsonContent(content: string, mode: JsonMode): string {
  const unescaped = decodeEscapedJsonText(content);

  try {
    return formatJsonContent(unescaped, mode);
  } catch {
    if (mode === "json") {
      try {
        return formatJsonContent(unescaped, "jsonc");
      } catch {
        // Fall through to the user-facing error below.
      }
    }
  }

  throw new Error("去除转义后的内容不是有效 JSON。");
}

export function pathToString(path: (string | number)[]): string {
  if (path.length === 0) {
    return "$";
  }

  return path.reduce<string>((result, segment) => {
    if (typeof segment === "number") {
      return `${result}[${segment}]`;
    }

    if (/^[A-Za-z_$][\w$]*$/.test(segment)) {
      return `${result}.${segment}`;
    }

    return `${result}[${JSON.stringify(segment)}]`;
  }, "$");
}

function buildTree(root: Node): { nodes: JsonTreeNode[]; truncated: boolean } {
  const nodes: JsonTreeNode[] = [];
  let truncated = false;

  const pushNode = (
    node: Node,
    label: string,
    path: (string | number)[],
    depth: number,
  ) => {
    if (nodes.length >= MAX_TREE_NODES) {
      truncated = true;
      return;
    }

    nodes.push({
      id: `${node.offset}-${node.length}-${pathToString(path)}`,
      label,
      path: pathToString(path),
      type: getNodeRootType(node),
      preview: getNodePreview(node),
      depth,
      offset: node.offset,
      length: node.length,
    });

    if (node.type === "object") {
      node.children?.forEach((propertyNode) => {
        if (propertyNode.type !== "property") {
          return;
        }

        const keyNode = propertyNode.children?.[0];
        const valueNode = propertyNode.children?.[1];

        if (!keyNode || !valueNode) {
          return;
        }

        const key = String(keyNode.value);
        pushNode(valueNode, key, [...path, key], depth + 1);
      });
      return;
    }

    if (node.type === "array") {
      node.children?.forEach((child, index) => {
        pushNode(child, `[${index}]`, [...path, index], depth + 1);
      });
    }
  };

  pushNode(root, "$", [], 0);

  return { nodes, truncated };
}

function getNodeRootType(node: Node): RootType {
  if (node.type === "property") {
    return "unknown";
  }
  return node.type;
}

function getNodePreview(node: Node): string {
  if (node.type === "object") {
    return `{${node.children?.length ?? 0}}`;
  }

  if (node.type === "array") {
    return `[${node.children?.length ?? 0}]`;
  }

  const value = getNodeValue(node);
  const preview = JSON.stringify(value);
  if (!preview) {
    return "";
  }

  return preview.length > 42 ? `${preview.slice(0, 39)}...` : preview;
}

function decodeEscapedJsonText(content: string): string {
  const trimmed = content.trim();

  if (!trimmed) {
    throw new Error("没有可去除转义的内容。");
  }

  try {
    const decoded = JSON.parse(trimmed);
    if (typeof decoded === "string") {
      return decoded;
    }
  } catch {
    // Try again below for strings pasted without surrounding quotes.
  }

  try {
    const decoded = JSON.parse(`"${trimmed}"`);
    if (typeof decoded === "string") {
      return decoded;
    }
  } catch {
    // Fall through to the user-facing error below.
  }

  throw new Error("当前内容不是可去除转义的 JSON 字符串。");
}

function assertValid(content: string, mode: JsonMode) {
  const result = analyzeJson(content, mode);
  if (!result.summary.valid) {
    throw new Error(result.issues[0]?.message ?? "JSON 无法解析。");
  }
}

function detectFormatState(
  content: string,
  mode: JsonMode,
  value: unknown,
): FormatState {
  const trimmed = content.trim();
  const minified = JSON.stringify(value);

  if (trimmed === minified) {
    return "minified";
  }

  try {
    const formatted =
      mode === "json"
        ? JSON.stringify(JSON.parse(content), null, 2)
        : applyEdits(
            content,
            formatJsonc(content, undefined, {
              eol: "\n",
              insertSpaces: true,
              tabSize: 2,
            }),
          ).trim();

    if (trimmed === formatted.trim()) {
      return "formatted";
    }
  } catch {
    return "custom";
  }

  return "custom";
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function getRootType(value: unknown): RootType {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (typeof value === "object") {
    return "object";
  }
  if (typeof value === "string") {
    return "string";
  }
  if (typeof value === "number") {
    return "number";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  return "unknown";
}

function getItemCount(value: unknown): number | null {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (value && typeof value === "object") {
    return Object.keys(value).length;
  }
  return null;
}

function toIssue(content: string, error: ParseError): ParseIssue {
  const position = offsetToPosition(content, error.offset);
  return {
    message: errorMessage(error.error),
    line: position.line,
    column: position.column,
    offset: error.offset,
    severity: "error",
  };
}

function offsetToPosition(content: string, offset: number) {
  let line = 1;
  let column = 1;

  for (let index = 0; index < offset && index < content.length; index += 1) {
    if (content[index] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { line, column };
}

function errorMessage(code: number): string {
  switch (code) {
    case PARSE_ERROR.InvalidSymbol:
      return "发现无效符号。";
    case PARSE_ERROR.InvalidNumberFormat:
      return "数字格式无效。";
    case PARSE_ERROR.PropertyNameExpected:
      return "对象键名必须使用双引号。";
    case PARSE_ERROR.ValueExpected:
      return "缺少 JSON 值。";
    case PARSE_ERROR.ColonExpected:
      return "对象键名后缺少冒号。";
    case PARSE_ERROR.CommaExpected:
      return "缺少逗号分隔符。";
    case PARSE_ERROR.CloseBraceExpected:
      return "对象缺少右花括号。";
    case PARSE_ERROR.CloseBracketExpected:
      return "数组缺少右方括号。";
    case PARSE_ERROR.EndOfFileExpected:
      return "根 JSON 值后存在多余内容。";
    case PARSE_ERROR.InvalidCommentToken:
    case PARSE_ERROR.UnexpectedEndOfComment:
      return "注释语法无效。";
    case PARSE_ERROR.InvalidCharacter:
    case PARSE_ERROR.InvalidEscapeCharacter:
    case PARSE_ERROR.InvalidUnicode:
    case PARSE_ERROR.UnexpectedEndOfString:
      return "字符串未正确闭合。";
    case PARSE_ERROR.UnexpectedEndOfNumber:
      return "数字未正确结束。";
    default:
      return `未知解析错误 (${code})。`;
  }
}
