import { describe, expect, it } from "vitest";
import { diffJson, summarizeDiff } from "./jsonDiff";

describe("diffJson", () => {
  it("returns no entries for identical primitives", () => {
    expect(diffJson(1, 1)).toEqual([]);
    expect(diffJson("a", "a")).toEqual([]);
    expect(diffJson(null, null)).toEqual([]);
  });

  it("reports a single root change for primitive vs primitive", () => {
    expect(diffJson(1, 2)).toEqual([
      { path: "$", kind: "changed", leftValue: 1, rightValue: 2 },
    ]);
  });

  it("treats type changes as a single 'changed' entry", () => {
    expect(diffJson({ a: 1 }, [1, 2])).toEqual([
      {
        path: "$",
        kind: "changed",
        leftValue: { a: 1 },
        rightValue: [1, 2],
      },
    ]);
  });

  it("walks object keys in left-then-right order", () => {
    const result = diffJson({ a: 1, b: 2 }, { a: 1, c: 3 });
    expect(result).toEqual([
      { path: "$.b", kind: "removed", leftValue: 2, rightValue: undefined },
      { path: "$.c", kind: "added", leftValue: undefined, rightValue: 3 },
    ]);
  });

  it("reports nested object changes by path", () => {
    const result = diffJson(
      { user: { name: "Alice", age: 30 } },
      { user: { name: "Alice", age: 31 } },
    );
    expect(result).toEqual([
      { path: "$.user.age", kind: "changed", leftValue: 30, rightValue: 31 },
    ]);
  });

  it("aligns arrays by index", () => {
    const result = diffJson([1, 2, 3], [1, 4, 3, 5]);
    expect(result).toEqual([
      { path: "$[1]", kind: "changed", leftValue: 2, rightValue: 4 },
      { path: "$[3]", kind: "added", leftValue: undefined, rightValue: 5 },
    ]);
  });

  it("treats null and missing as different", () => {
    const result = diffJson({ a: null }, {});
    expect(result).toEqual([
      { path: "$.a", kind: "removed", leftValue: null, rightValue: undefined },
    ]);
  });

  it("quotes path segments that are not dot-safe", () => {
    const result = diffJson({ "a-b": 1 }, { "a-b": 2 });
    expect(result).toEqual([
      { path: '$["a-b"]', kind: "changed", leftValue: 1, rightValue: 2 },
    ]);
  });

  it("returns no entries when deeply equal objects differ in key order", () => {
    expect(
      diffJson({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 }),
    ).toEqual([]);
  });

  it("differentiates 0 from -0 only via the changed kind", () => {
    expect(diffJson(0, 0)).toEqual([]);
    expect(diffJson(-0, 0)).toEqual([
      { path: "$", kind: "changed", leftValue: -0, rightValue: 0 },
    ]);
  });
});

describe("summarizeDiff", () => {
  it("counts entries by kind and ignores unchanged", () => {
    const summary = summarizeDiff([
      { path: "$.a", kind: "added", leftValue: undefined, rightValue: 1 },
      { path: "$.b", kind: "removed", leftValue: 2, rightValue: undefined },
      { path: "$.c", kind: "changed", leftValue: 3, rightValue: 4 },
      { path: "$.d", kind: "changed", leftValue: 5, rightValue: 6 },
      { path: "$.e", kind: "unchanged", leftValue: 7, rightValue: 7 },
    ]);

    expect(summary).toEqual({ added: 1, removed: 1, changed: 2 });
  });
});
