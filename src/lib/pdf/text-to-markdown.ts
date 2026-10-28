// Layout heuristics for simple, single-column resumes. This never rewrites facts.
export type TextFragment = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  font: string;
  link?: string;
};

export type ResumeTextPage = { number: number; fragments: TextFragment[] };
type Line = { text: string; markdown: string; x: number; y: number; size: number; font: string; page: number };

function escapeMarkdown(text: string) {
  return text.replace(/([\\`*_{}\[\]<>#!|~])/g, "\\$1").replace(/^(\s*\d+)\./, "$1\\.");
}

export function safeLink(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    if (["https:", "http:", "mailto:", "tel:"].includes(url.protocol)) return url.href;
  } catch { /* A PDF annotation is untrusted; keep the text without an invalid link. */ }
}

function linesFromPage(page: ResumeTextPage): Line[] {
  const rows: TextFragment[][] = [];
  for (const fragment of [...page.fragments].sort((a, b) => a.y - b.y || a.x - b.x)) {
    if (!fragment.text.trim()) continue;
    const last = rows.at(-1);
    if (last && Math.abs(last[0].y - fragment.y) <= Math.max(2, fragment.height * 0.25)) last.push(fragment);
    else rows.push([fragment]);
  }
  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    const segments: { text: string; link?: string }[] = [];
    let previous: TextFragment | undefined;
    for (const fragment of row) {
      const space = previous && fragment.x - (previous.x + previous.width) > fragment.height * 0.12 && !/\s$/.test(previous.text) && !/^\s/.test(fragment.text) ? " " : "";
      const link = safeLink(fragment.link);
      const last = segments.at(-1);
      if (last && last.link === link) last.text += space + fragment.text;
      else segments.push({ text: space + fragment.text, link });
      previous = fragment;
    }
    const dominant = [...row].sort((a, b) => b.text.length - a.text.length)[0];
    return {
      text: segments.map((segment) => segment.text).join("").trim(),
      markdown: segments.map(({ text, link }) => link ? `${/^\s/.test(text) ? " " : ""}[${escapeMarkdown(text.trim())}](<${link.replaceAll(">", "%3E").replaceAll("<", "%3C")}>)${/\s$/.test(text) ? " " : ""}` : escapeMarkdown(text)).join("").trim(),
      x: row[0].x,
      y: row[0].y,
      size: Math.max(...row.map((fragment) => fragment.height)),
      font: dominant.font,
      page: page.number,
    };
  });
}

const sectionHeading = /^(about|profile|professional (summary|experience)|summary|experience|work experience|employment( history)?|education|certifications?|languages?|stack|skills|technical skills|technologies|projects|contact|interests|publications|volunteering)$/i;

export function resumeTextToMarkdown(pages: ResumeTextPage[]) {
  const lines = pages.flatMap(linesFromPage);
  if (!lines.length) return "";
  const sizeWeights = new Map<number, number>();
  const fontWeights = new Map<string, number>();
  for (const line of lines) {
    const size = Math.round(line.size * 2) / 2;
    sizeWeights.set(size, (sizeWeights.get(size) ?? 0) + line.text.length);
    fontWeights.set(line.font, (fontWeights.get(line.font) ?? 0) + line.text.length);
  }
  const bodySize = [...sizeWeights].sort((a, b) => b[1] - a[1])[0][0];
  const bodyFont = [...fontWeights].sort((a, b) => b[1] - a[1])[0][0];
  const gaps = lines.slice(1).flatMap((line, index) => {
    const previous = lines[index];
    const gap = line.y - previous.y;
    return line.page === previous.page && gap > bodySize * 0.6 && gap < bodySize * 2 ? [gap] : [];
  }).sort((a, b) => a - b);
  const lineSpacing = gaps[Math.floor(gaps.length / 2)] ?? bodySize * 1.3;
  const blocks: { kind: "heading" | "paragraph" | "bullet"; text: string }[] = [];
  let previous: Line | undefined;
  let inExperience = false;
  let hasEmployer = false;
  for (const [index, line] of lines.entries()) {
    const last = blocks.at(-1);
    const section = sectionHeading.test(line.text.replace(/:$/, ""));
    const prominent = line.text.length < 150 && line.size >= bodySize * 1.13;
    const distinctFont = line.text.length < 120 && line.font !== bodyFont && !/[.!?]$/.test(line.text);
    const bullet = /^[•●▪◦‣–-]\s+/.test(line.text);
    if (section || prominent || distinctFont) {
      if (section) {
        inExperience = /experience|employment/i.test(line.text);
        hasEmployer = false;
      }
      let level = index === 0 && prominent ? 1 : section ? 2 : 3;
      if (!section && inExperience) {
        // A following role/date line is evidence of a new employer. Other
        // subheadings within that entry are proposed as nested projects.
        const roleDatesFollow = /\b(?:19|20)\d{2}\b/.test(lines[index + 1]?.text ?? "");
        level = !hasEmployer || roleDatesFollow ? 3 : 4;
        if (level === 3) hasEmployer = true;
      }
      blocks.push({ kind: "heading", text: `${"#".repeat(level)} ${line.markdown}` });
    } else if (bullet) {
      blocks.push({ kind: "bullet", text: `- ${line.markdown.replace(/^[•●▪◦‣–-]\s+/, "")}` });
    } else {
      const crossPage = previous && line.page !== previous.page;
      const continuation = previous && last && last.kind !== "heading" && (
        crossPage
          ? !/[.!?:;]$/.test(previous.text) && /^[\p{Ll}\d(]/u.test(line.text)
          : line.y - previous.y <= lineSpacing * 1.3 && Math.abs(line.size - previous.size) < bodySize * 0.15 && (last.kind !== "bullet" || line.x > previous.x + bodySize * 0.5)
      );
      if (continuation && last) last.text += `${/[-\u00ad]$/.test(last.text) ? "" : " "}${line.markdown}`;
      else blocks.push({ kind: "paragraph", text: line.markdown });
    }
    previous = line;
  }
  return blocks.map((block, index) => `${index > 0 && block.kind === "bullet" && blocks[index - 1].kind === "bullet" ? "\n" : index > 0 ? "\n\n" : ""}${block.text}`).join("") + "\n";
}
