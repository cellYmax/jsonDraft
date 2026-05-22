export type DiffKind = "added" | "removed" | "changed" | "unchanged";

export type DiffEntry = {
  path: string;
  kind: DiffKind;
  leftValue: unknown;
  rightValue: unknown;
};

type Segment = string | number;

const ROOT_PATH = "$";

export function diffJson(left: unknown, right: unknown): DiffEntry[] {
  const entries: DiffEntry[] = [];
  walk(entries, [], left, right);
  return entries;
}

export function summarizeDiff(entries: DiffEntry[]): {
  added: number;
  removed: number;
  changed: number;
} {
  let added = 0;
  let removed = 0;
  let changed = 0;

  for (const entry of entries) {
    if (entry.kind === "added") {
      added += 1;
    } else if (entry.kind === "removed") {
      removed += 1;
    } else if (entry.kind === "changed") {
      changed += 1;
    }
  }

  return { added, removed, changed };
}

function walk(
  entries: DiffEntry[],
  segments: Segment[],
  left: unknown,
  right: unknown,
) {
  if (sameValue(left, right)) {
    return;
  }

  const leftKind = classify(left);
  const rightKind = classify(right);

  if (leftKind === "missing" && rightKind !== "missing") {
    entries.push({
      path: pathFromSegments(segments),
      kind: "added",
      leftValue: undefined,
      rightValue: right,
    });
    return;
  }

  if (leftKind !== "missing" && rightKind === "missing") {
    entries.push({
      path: pathFromSegments(segments),
      kind: "removed",
      leftValue: left,
      rightValue: undefined,
    });
    return;
  }

  if (leftKind === "object" && rightKind === "object") {
    walkObjects(
      entries,
      segments,
      left as Record<string, unknown>,
      right as Record<string, unknown>,
    );
    return;
  }

  if (leftKind === "array" && rightKind === "array") {
    walkArrays(entries, segments, left as unknown[], right as unknown[]);
    return;
  }

  entries.push({
    path: pathFromSegments(segments),
    kind: "changed",
    leftValue: left,
    rightValue: right,
  });
}

function walkObjects(
  entries: DiffEntry[],
  segments: Segment[],
  left: Record<string, unknown>,
  right: Record<string, unknown>,
) {
  const keys = orderedKeys(left, right);

  for (const key of keys) {
    const inLeft = Object.prototype.hasOwnProperty.call(left, key);
    const inRight = Object.prototype.hasOwnProperty.call(right, key);

    walk(
      entries,
      [...segments, key],
      inLeft ? left[key] : MISSING,
      inRight ? right[key] : MISSING,
    );
  }
}

function walkArrays(
  entries: DiffEntry[],
  segments: Segment[],
  left: unknown[],
  right: unknown[],
) {
  const max = Math.max(left.length, right.length);

  for (let index = 0; index < max; index += 1) {
    walk(
      entries,
      [...segments, index],
      index < left.length ? left[index] : MISSING,
      index < right.length ? right[index] : MISSING,
    );
  }
}

const MISSING = Symbol("MISSING");

type ValueKind =
  | "missing"
  | "null"
  | "object"
  | "array"
  | "string"
  | "number"
  | "boolean"
  | "unknown";

function classify(value: unknown): ValueKind {
  if (value === MISSING) {
    return "missing";
  }
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  switch (typeof value) {
    case "object":
      return "object";
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    default:
      return "unknown";
  }
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  const leftKind = classify(left);
  const rightKind = classify(right);
  if (leftKind !== rightKind) {
    return false;
  }

  if (leftKind === "object") {
    const a = left as Record<string, unknown>;
    const b = right as Record<string, unknown>;
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) {
      return false;
    }
    return keys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) && sameValue(a[key], b[key]),
    );
  }

  if (leftKind === "array") {
    const a = left as unknown[];
    const b = right as unknown[];
    if (a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => sameValue(item, b[index]));
  }

  return false;
}

function orderedKeys(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const key of Object.keys(left)) {
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  for (const key of Object.keys(right)) {
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }

  return out;
}

function pathFromSegments(segments: Segment[]): string {
  if (segments.length === 0) {
    return ROOT_PATH;
  }

  let result = ROOT_PATH;
  for (const segment of segments) {
    if (typeof segment === "number") {
      result += `[${segment}]`;
    } else if (isDotSafe(segment)) {
      result += `.${segment}`;
    } else {
      result += `[${JSON.stringify(segment)}]`;
    }
  }

  return result;
}

function isDotSafe(key: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
}
