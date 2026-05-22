import { useEffect, useRef } from "react";
import type * as Monaco from "monaco-editor";
import type { NodeRange } from "../lib/jsonTools";

const HIGHLIGHT_CLASS = "path-highlight";

type EditorInstance = Monaco.editor.IStandaloneCodeEditor;

export function usePathHighlight(
  editor: EditorInstance | null,
  range: NodeRange | null,
  rootLength: number,
) {
  const decorations = useRef<
    Monaco.editor.IEditorDecorationsCollection | null
  >(null);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const model = editor.getModel();
    if (!model) {
      return;
    }

    if (!decorations.current) {
      decorations.current = editor.createDecorationsCollection();
    }

    const shouldHighlight =
      range !== null &&
      range.length > 0 &&
      !(range.offset === 0 && range.length === rootLength);

    if (!shouldHighlight) {
      decorations.current.clear();
      return;
    }

    const start = model.getPositionAt(range.offset);
    const end = model.getPositionAt(range.offset + range.length);

    decorations.current.set([
      {
        range: {
          startLineNumber: start.lineNumber,
          startColumn: start.column,
          endLineNumber: end.lineNumber,
          endColumn: end.column,
        },
        options: {
          className: HIGHLIGHT_CLASS,
          isWholeLine: false,
          stickiness: 1,
        },
      },
    ]);
  }, [editor, range, rootLength]);

  useEffect(() => {
    return () => {
      decorations.current?.clear();
      decorations.current = null;
    };
  }, [editor]);
}
