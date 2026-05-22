import { describe, expect, it } from "vitest";
import {
  analyzeJson,
  escapeMinifiedJsonContent,
  formatJsonContent,
  minifyJsonContent,
  pathToString,
  unescapeJsonContent,
} from "./jsonTools";

describe("analyzeJson", () => {
  it("accepts valid strict JSON", () => {
    const result = analyzeJson('{"name":"jsonDraft","items":[1,2]}', "json");

    expect(result.summary.valid).toBe(true);
    expect(result.summary.rootType).toBe("object");
    expect(result.summary.itemCount).toBe(2);
    expect(result.issues).toEqual([]);
  });

  it("reports invalid strict JSON with line and column", () => {
    const result = analyzeJson('{\n  "name": "jsonDraft",\n}', "json");

    expect(result.summary.valid).toBe(false);
    expect(result.issues[0]).toMatchObject({
      line: 3,
      column: 1,
      severity: "error",
    });
  });

  it("accepts JSONC comments and trailing commas in JSONC mode", () => {
    const result = analyzeJson(
      '{\n  // comment\n  "name": "jsonDraft",\n}\n',
      "jsonc",
    );

    expect(result.summary.valid).toBe(true);
    expect(result.summary.rootType).toBe("object");
  });

  it("rejects JSONC syntax in strict JSON mode", () => {
    const result = analyzeJson('{\n  // comment\n  "ok": true\n}', "json");

    expect(result.summary.valid).toBe(false);
    expect(result.issues[0].message).toContain("注释");
  });

  it("reports an unterminated string with a dedicated message", () => {
    const result = analyzeJson('{\n  "name": "json', "json");

    expect(result.summary.valid).toBe(false);
    expect(result.issues.map((issue) => issue.message)).toContain(
      "字符串未正确闭合，缺少结束引号。",
    );
  });

  it("reports an invalid unicode escape with a dedicated message", () => {
    const result = analyzeJson('{"name":"\\uZZZZ"}', "json");

    expect(result.summary.valid).toBe(false);
    expect(result.issues.map((issue) => issue.message)).toContain(
      "字符串包含无效的 Unicode 转义序列。",
    );
  });

  it("reports an invalid escape character with a dedicated message", () => {
    const result = analyzeJson('{"name":"oops \\q"}', "json");

    expect(result.summary.valid).toBe(false);
    expect(result.issues.map((issue) => issue.message)).toContain(
      "字符串包含无效的转义字符。",
    );
  });

  it("returns a JSON path for the cursor offset", () => {
    const content = '{\n  "items": [{ "id": 1 }]\n}';
    const offset = content.indexOf("id");
    const result = analyzeJson(content, "json", offset);

    expect(result.summary.currentPath).toBe("$.items[0].id");
  });

  it("builds a flat tree for navigation", () => {
    const result = analyzeJson(
      '{"items":[{"id":1,"name":"Desk"}],"enabled":true}',
      "json",
    );

    expect(result.tree.map((node) => node.path)).toEqual([
      "$",
      "$.items",
      "$.items[0]",
      "$.items[0].id",
      "$.items[0].name",
      "$.enabled",
    ]);
    expect(result.tree[1]).toMatchObject({
      label: "items",
      type: "array",
      preview: "[1]",
      depth: 1,
    });
    expect(result.treeTruncated).toBe(false);
  });
});

describe("formatJsonContent", () => {
  it("formats strict JSON with two-space indentation", () => {
    expect(formatJsonContent('{"a":1}', "json")).toBe('{\n  "a": 1\n}\n');
  });

  it("formats JSONC while preserving comments", () => {
    expect(formatJsonContent('{"a":1,// note\n"b":2}', "jsonc")).toContain(
      "// note",
    );
  });
});

describe("minifyJsonContent", () => {
  it("minifies valid JSON", () => {
    expect(minifyJsonContent('{\n  "a": 1\n}', "json")).toBe('{"a":1}');
  });

  it("emits standard JSON when minifying JSONC", () => {
    expect(minifyJsonContent('{\n  // note\n  "a": 1,\n}', "jsonc")).toBe(
      '{"a":1}',
    );
  });
});

describe("escapeMinifiedJsonContent", () => {
  it("minifies and escapes valid JSON as a JSON string", () => {
    expect(escapeMinifiedJsonContent('{\n  "a": 1\n}', "json")).toBe(
      '"{\\"a\\":1}"',
    );
  });

  it("minifies JSONC before escaping", () => {
    expect(
      escapeMinifiedJsonContent('{\n  // note\n  "a": 1,\n}', "jsonc"),
    ).toBe('"{\\"a\\":1}"');
  });
});

describe("unescapeJsonContent", () => {
  it("removes escaping from a quoted JSON string and formats the result", () => {
    expect(unescapeJsonContent('"{\\"a\\":1}"', "json")).toBe(
      '{\n  "a": 1\n}\n',
    );
  });

  it("removes escaping from content pasted without outer quotes", () => {
    expect(unescapeJsonContent('{\\"a\\":1}', "json")).toBe(
      '{\n  "a": 1\n}\n',
    );
  });

  it("throws when the unescaped content is not valid JSON", () => {
    expect(() => unescapeJsonContent('"hello"', "json")).toThrow(
      "去除转义后的内容不是有效 JSON。",
    );
  });
});

describe("pathToString", () => {
  it("quotes keys that are not dot-safe", () => {
    expect(pathToString(["a-b", 0, "name"])).toBe('$["a-b"][0].name');
  });
});
