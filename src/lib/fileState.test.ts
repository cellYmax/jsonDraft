import { describe, expect, it } from "vitest";
import {
  BLANK_FILE_NAME,
  DEFAULT_FILE_NAME,
  applySaveResult,
  createBlankFileState,
  createDemoFileState,
  fileStateFromPayload,
  markSaved,
  updateFileContent,
} from "./fileState";

describe("file state", () => {
  it("starts as a clean demo JSON document", () => {
    const state = createDemoFileState();

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
    const state = updateFileContent(createDemoFileState(), '{"ok":true}');
    const saved = markSaved(state, {
      path: "/tmp/ok.json",
      name: "ok.json",
      sizeBytes: 11,
    });

    expect(saved.dirty).toBe(false);
    expect(saved.path).toBe("/tmp/ok.json");
    expect(saved.originalContent).toBe('{"ok":true}');
  });

  describe("applySaveResult", () => {
    it("becomes clean when content matches what was saved", () => {
      const initial = fileStateFromPayload({
        path: "/tmp/old.json",
        name: "old.json",
        content: "{}",
        sizeBytes: 2,
      });
      const edited = updateFileContent(initial, '{"a":1}');

      const next = applySaveResult(
        edited,
        { path: "/tmp/new.json", name: "new.json", sizeBytes: 7 },
        '{"a":1}',
      );

      expect(next.dirty).toBe(false);
      expect(next.path).toBe("/tmp/new.json");
      expect(next.name).toBe("new.json");
      expect(next.originalContent).toBe('{"a":1}');
      expect(next.content).toBe('{"a":1}');
    });

    it("preserves newer edits as dirty during a save race", () => {
      const initial = fileStateFromPayload({
        path: "/tmp/old.json",
        name: "old.json",
        content: "{}",
        sizeBytes: 2,
      });
      const editedDuringSave = updateFileContent(initial, '{"a":2}');

      const next = applySaveResult(
        editedDuringSave,
        { path: "/tmp/new.json", name: "new.json", sizeBytes: 7 },
        '{"a":1}',
      );

      expect(next.dirty).toBe(true);
      expect(next.path).toBe("/tmp/new.json");
      expect(next.name).toBe("new.json");
      expect(next.content).toBe('{"a":2}');
      expect(next.originalContent).toBe('{"a":1}');
      expect(next.sizeBytes).toBe(new TextEncoder().encode('{"a":2}').length);
    });
  });
});
