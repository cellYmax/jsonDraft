import { describe, expect, it } from "vitest";
import {
  MAX_RECENT_FILES,
  RECENT_FILES_KEY,
  addRecentFile,
  loadRecentFiles,
  removeRecentFile,
  saveRecentFiles,
  type RecentFile,
} from "./recentFiles";

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    raw: store,
  };
}

const fileA: RecentFile = { path: "/tmp/a.json", name: "a.json" };
const fileB: RecentFile = { path: "/tmp/b.json", name: "b.json" };
const fileC: RecentFile = { path: "/tmp/c.json", name: "c.json" };

describe("recentFiles", () => {
  describe("loadRecentFiles", () => {
    it("returns an empty array when storage is missing or empty", () => {
      const storage = createMemoryStorage();
      expect(loadRecentFiles(storage)).toEqual([]);
    });

    it("filters out malformed entries", () => {
      const storage = createMemoryStorage();
      storage.raw.set(
        RECENT_FILES_KEY,
        JSON.stringify([
          fileA,
          { path: 42, name: "bad" },
          { path: "/tmp/x.json" },
          null,
          fileB,
        ]),
      );
      expect(loadRecentFiles(storage)).toEqual([fileA, fileB]);
    });

    it("returns an empty array when the JSON is invalid", () => {
      const storage = createMemoryStorage();
      storage.raw.set(RECENT_FILES_KEY, "{not json");
      expect(loadRecentFiles(storage)).toEqual([]);
    });

    it("clamps to MAX_RECENT_FILES entries", () => {
      const storage = createMemoryStorage();
      const tooMany = Array.from({ length: MAX_RECENT_FILES + 3 }, (_, index) => ({
        path: `/tmp/${index}.json`,
        name: `${index}.json`,
      }));
      storage.raw.set(RECENT_FILES_KEY, JSON.stringify(tooMany));
      expect(loadRecentFiles(storage)).toHaveLength(MAX_RECENT_FILES);
    });
  });

  describe("saveRecentFiles", () => {
    it("persists at most MAX_RECENT_FILES entries", () => {
      const storage = createMemoryStorage();
      const tooMany = Array.from({ length: MAX_RECENT_FILES + 2 }, (_, index) => ({
        path: `/tmp/${index}.json`,
        name: `${index}.json`,
      }));
      saveRecentFiles(tooMany, storage);
      const persisted = JSON.parse(storage.raw.get(RECENT_FILES_KEY)!);
      expect(persisted).toHaveLength(MAX_RECENT_FILES);
    });
  });

  describe("addRecentFile", () => {
    it("inserts at the head and removes duplicates by path", () => {
      const result = addRecentFile([fileB, fileA], fileA);
      expect(result).toEqual([fileA, fileB]);
    });

    it("clamps the result to MAX_RECENT_FILES", () => {
      const initial = Array.from({ length: MAX_RECENT_FILES }, (_, index) => ({
        path: `/tmp/${index}.json`,
        name: `${index}.json`,
      }));
      const result = addRecentFile(initial, fileC);
      expect(result).toHaveLength(MAX_RECENT_FILES);
      expect(result[0]).toEqual(fileC);
    });
  });

  describe("removeRecentFile", () => {
    it("returns a new array without the matching path", () => {
      expect(removeRecentFile([fileA, fileB, fileC], fileB.path)).toEqual([
        fileA,
        fileC,
      ]);
    });

    it("returns an equivalent list when the path is absent", () => {
      expect(removeRecentFile([fileA, fileB], "/tmp/nope.json")).toEqual([
        fileA,
        fileB,
      ]);
    });
  });
});
