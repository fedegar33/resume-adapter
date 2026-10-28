import "client-only";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { resumeTextToMarkdown, safeLink, type ResumeTextPage } from "@/lib/pdf/text-to-markdown";

export async function extractResumeMarkdown(document: PDFDocumentProxy, signal: AbortSignal) {
  const pages: ResumeTextPage[] = [];
  for (let number = 1; number <= document.numPages; number++) {
    signal.throwIfAborted();
    const page = await document.getPage(number);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const annotations = await page.getAnnotations();
    const links = annotations.flatMap((annotation: { url?: unknown; rect?: number[] }) => {
      const url = safeLink(annotation.url);
      if (!url || annotation.rect?.length !== 4) return [];
      const [x1, y1] = viewport.convertToViewportPoint(annotation.rect[0], annotation.rect[1]);
      const [x2, y2] = viewport.convertToViewportPoint(annotation.rect[2], annotation.rect[3]);
      return [{ url, left: Math.min(x1, x2), right: Math.max(x1, x2), top: Math.min(y1, y2), bottom: Math.max(y1, y2) }];
    });
    pages.push({ number, fragments: content.items.flatMap((item) => {
      if (!("str" in item)) return [];
      const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
      const height = item.height || Math.hypot(item.transform[2], item.transform[3]) || 11;
      const link = links.find((link) => x + item.width / 2 >= link.left && x + item.width / 2 <= link.right && y - height / 2 >= link.top && y - height / 2 <= link.bottom)?.url;
      return [{ text: item.str, x, y, width: item.width, height, font: item.fontName, link }];
    }) });
  }
  signal.throwIfAborted();
  return resumeTextToMarkdown(pages);
}
