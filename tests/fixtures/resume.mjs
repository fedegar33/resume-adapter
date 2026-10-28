// Synthetic text only; never use a personal resume as a committed fixture.
export function makeResumePdf({ empty = false } = {}) {
  const text = (value, x, y, size = 11, font = "F1") => `BT /${font} ${size} Tf ${x} ${y} Td (${value.replace(/[\\()]/g, "\\$&")}) Tj ET`;
  const pageOne = empty ? "" : [
    text("Alex Example", 72, 740, 25, "F2"),
    text("alex@example.com", 72, 710),
    text("Professional Summary", 72, 670, 14, "F2"),
    text("Software engineer building reliable services", 72, 645),
    text("and thoughtful user interfaces.", 72, 631),
    text("Experience", 72, 590, 14, "F2"),
    text("Example Company", 72, 560, 12, "F2"),
    text("Senior Engineer | January 2020 - Present", 72, 540),
    text("Payments Project", 72, 510, 12, "F2"),
    text("Worked on existing integrations for", 72, 100),
  ].join("\n");
  const pageTwo = empty ? "" : [
    text("customers across different markets.", 72, 740),
    text("Education", 72, 680, 14, "F2"),
    text("Example University", 72, 655),
    text("2014 - 2018", 72, 641),
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [5 0 R 7 0 R] /Count 2 >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 6 0 R >>",
    `<< /Length ${Buffer.byteLength(pageOne)} >>\nstream\n${pageOne}\nendstream`,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 8 0 R >>",
    `<< /Length ${Buffer.byteLength(pageTwo)} >>\nstream\n${pageTwo}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
