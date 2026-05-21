import { describe, expect, it } from "vitest";
import {
  BLANK_FILE_NAME,
  DEFAULT_FILE_NAME,
  createBlankFileState,
  createDemoFileState,
  createEmptyFileState,
  fileStateFromPayload,
  markSaved,
  updateFileContent,
} from "./fileState";

describe("file state", () => {
  it("starts as a clean demo JSON document", () => {
    const state = createEmptyFileState();

    expect(state.path).toBeNull();
    expect(state.name).toBe(DEFAULT_FILE_NAME);
    expect(state.content).toContain('"id": "cus_10001"');
    expect(state.dirty).toBe(false);
  });

  it("can create a clean blank JSON document", () => {
    const state = createBlankFileState();

    expect(state.path).toBeNull();
    expect(state.name).toBe(BLANK_FILE_NAME);
    expect(state.content).toBe("{\n  \n}\n");
    expect(state.dirty).toBe(false);
  });

  it("can explicitly create the demo JSON document", () => {
    const state = createDemoFileState();

    expect(state.name).toBe(DEFAULT_FILE_NAME);
    expect(state.content).toContain('"id": "cus_10001"');
  });

  it("creates clean state from an opened file", () => {
    const state = fileStateFromPayload({
      path: "/tmp/data.json",
      name: "data.json",
      content: "{}",
      sizeBytes: 2,
    });

    expect(state.path).toBe("/tmp/data.json");
    expect(state.dirty).toBe(false);
    expect(state.originalContent).toBe("{}");
  });

  it("marks edits dirty and matching content clean", () => {
    const state = fileStateFromPayload({
      path: "/tmp/data.json",
      name: "data.json",
      content: "{}",
      sizeBytes: 2,
    });

    const changed = updateFileContent(state, '{"ok":true}');
    expect(changed.dirty).toBe(true);

    const reverted = updateFileContent(changed, "{}");
    expect(reverted.dirty).toBe(false);
  });

  it("marks current content saved", () => {
    const state = updateFileContent(createEmptyFileState(), '{"ok":true}');
    const saved = markSaved(state, {
      path: "/tmp/ok.json",
      name: "ok.json",
      sizeBytes: 11,
    });

    expect(saved.dirty).toBe(false);
    expect(saved.path).toBe("/tmp/ok.json");
    expect(saved.originalContent).toBe('{"ok":true}');
  });
});
