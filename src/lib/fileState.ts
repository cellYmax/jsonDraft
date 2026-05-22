import defaultDemoJson from "../../examples/customer-profile.json?raw";

export type FilePayload = {
  path: string;
  name: string;
  content: string;
  sizeBytes: number;
};

export type SaveResult = {
  path: string;
  name: string;
  sizeBytes: number;
};

export type FileState = {
  path: string | null;
  name: string;
  content: string;
  originalContent: string;
  dirty: boolean;
  sizeBytes: number;
};

export const DEFAULT_FILE_NAME = "customer-profile.json";
export const DEFAULT_JSON = defaultDemoJson;
export const BLANK_FILE_NAME = "未命名.json";
export const BLANK_JSON = "{\n  \n}\n";

export function createDemoFileState(): FileState {
  return {
    path: null,
    name: DEFAULT_FILE_NAME,
    content: DEFAULT_JSON,
    originalContent: DEFAULT_JSON,
    dirty: false,
    sizeBytes: byteSize(DEFAULT_JSON),
  };
}

export function createBlankFileState(): FileState {
  return {
    path: null,
    name: BLANK_FILE_NAME,
    content: BLANK_JSON,
    originalContent: BLANK_JSON,
    dirty: false,
    sizeBytes: byteSize(BLANK_JSON),
  };
}

export function fileStateFromPayload(payload: FilePayload): FileState {
  return {
    path: payload.path,
    name: payload.name,
    content: payload.content,
    originalContent: payload.content,
    dirty: false,
    sizeBytes: payload.sizeBytes,
  };
}

export function updateFileContent(
  state: FileState,
  content: string,
): FileState {
  return {
    ...state,
    content,
    dirty: content !== state.originalContent,
    sizeBytes: byteSize(content),
  };
}

export function markSaved(
  state: FileState,
  result?: SaveResult | FilePayload,
): FileState {
  const path = result?.path ?? state.path;
  const name = result?.name ?? state.name;
  const sizeBytes = result?.sizeBytes ?? byteSize(state.content);

  return {
    ...state,
    path,
    name,
    originalContent: state.content,
    dirty: false,
    sizeBytes,
  };
}

export function applySaveResult(
  state: FileState,
  result: SaveResult | FilePayload,
  savedContent: string,
): FileState {
  if (state.content === savedContent) {
    return markSaved(state, result);
  }

  return {
    ...state,
    path: result.path,
    name: result.name,
    originalContent: savedContent,
    dirty: true,
    sizeBytes: byteSize(state.content),
  };
}

export function byteSize(content: string): number {
  return new TextEncoder().encode(content).length;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
