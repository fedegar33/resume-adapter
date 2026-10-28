"use client";

import dynamic from "next/dynamic";
import { loader } from "@monaco-editor/react";

loader.config({ paths: { vs: "/vendor/monaco/vs" } });
const Editor = dynamic(() => import("@monaco-editor/react").then((module) => module.Editor), { ssr: false });

export function ResumeMarkdownEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Editor
      language="markdown"
      defaultValue={value}
      // Monaco owns its live model/cursor; the parent records edits without
      // writing an older React render back over rapid keyboard input.
      onMount={(editor) => { if (editor.getValue() !== value) editor.setValue(value); }}
      onChange={(value) => onChange(value ?? "")}
      height="100%"
      loading={<textarea aria-label="Resume Markdown" value={value} onChange={(event) => onChange(event.target.value)} spellCheck={false} className="h-full w-full resize-none p-5 font-mono text-sm outline-offset-[-2px]" />}
      options={{
        ariaLabel: "Resume Markdown",
        wordWrap: "on",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        lineNumbers: "off",
        glyphMargin: false,
        folding: false,
        lineDecorationsWidth: 12,
        fontSize: 14,
        lineHeight: 23,
        padding: { top: 20, bottom: 20 },
        tabFocusMode: true,
        renderLineHighlight: "none",
        quickSuggestions: false,
        wordBasedSuggestions: "off",
        accessibilitySupport: "auto",
      }}
    />
  );
}
