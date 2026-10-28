import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";

// Parse/serialize Markdown. Allowed-node validation belongs to the next phase.
// This does not execute HTML, render HTML, or enforce the product's allowed subset.
export function createMarkdownProcessor() {
  return unified().use(remarkParse).use(remarkStringify, { bullet: "-", emphasis: "*" });
}
