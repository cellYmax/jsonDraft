export type RecentFile = {
  path: string;
  name: string;
};

export const RECENT_FILES_KEY = "jsonDraft.recentFiles";
export const MAX_RECENT_FILES = 5;

type Storage = Pick<Window["localStorage"], "getItem" | "setItem">;

function defaultStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

export function loadRecentFiles(storage: Storage | null = defaultStorage()): RecentFile[] {
  if (!storage) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(storage.getItem(RECENT_FILES_KEY) ?? "[]");

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isRecentFile)
      .slice(0, MAX_RECENT_FILES);
  } catch {
    return [];
  }
}

export function saveRecentFiles(
  files: RecentFile[],
  storage: Storage | null = defaultStorage(),
) {
  if (!storage) {
    return;
  }
  storage.setItem(
    RECENT_FILES_KEY,
    JSON.stringify(files.slice(0, MAX_RECENT_FILES)),
  );
}

export function addRecentFile(
  files: RecentFile[],
  file: RecentFile,
): RecentFile[] {
  return [
    file,
    ...files.filter((candidate) => candidate.path !== file.path),
  ].slice(0, MAX_RECENT_FILES);
}

export function removeRecentFile(
  files: RecentFile[],
  path: string,
): RecentFile[] {
  return files.filter((candidate) => candidate.path !== path);
}

function isRecentFile(value: unknown): value is RecentFile {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<RecentFile>;
  return typeof candidate.path === "string" && typeof candidate.name === "string";
}
