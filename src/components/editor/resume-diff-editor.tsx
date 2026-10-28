"use client";

import dynamic from "next/dynamic";
import { loader, type DiffEditorProps } from "@monaco-editor/react";

loader.config({ paths: { vs: "/vendor/monaco/vs" } });

const DiffEditor = dynamic(
  () => import("@monaco-editor/react").then((module) => module.DiffEditor),
  { ssr: false },
);

type Props = Pick<DiffEditorProps, "original" | "modified" | "onMount">;

// Library wiring only. Approval and protected-section checks are not implemented.
export function ResumeDiffEditor(props: Props) {
  return (
    <DiffEditor
      {...props}
      language="markdown"
      height="70vh"
      options={{
        originalEditable: false,
        readOnly: false,
        renderSideBySide: true,
        wordWrap: "on",
        diffWordWrap: "on",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
      }}
    />
  );
}
