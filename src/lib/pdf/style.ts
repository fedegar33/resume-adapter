import { StyleSheet } from "@react-pdf/renderer";

// Reference values only. Final font files and the resume template are pending.
export const pdfPageSize = "LETTER" as const;
export const pdfStyles = StyleSheet.create({
  page: { padding: 72, fontSize: 11, color: "#353744" },
  sectionHeading: { fontSize: 14, color: "#3D85C6" },
});
