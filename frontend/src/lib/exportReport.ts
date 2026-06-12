/**
 * exportReport.ts — shared PDF and CSV/Excel export utilities.
 *
 * PDF: uses jsPDF + jspdf-autotable (client-side, no server round-trip).
 * CSV: plain text, opens as Excel-compatible file.
 *
 * Both functions accept a generic rows array + column definitions so they
 * can be reused across professor and admin report pages.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReportColumn {
  header: string;
  key: string;
  /** Optional formatter applied to the cell value */
  format?: (v: unknown) => string;
}

export interface ReportMeta {
  title: string;
  subtitle?: string;
  generatedBy?: string;
  filters?: Record<string, string | undefined>;
}

// ── CSV ───────────────────────────────────────────────────────────────────────

export function exportCSV(
  rows: Record<string, unknown>[],
  columns: ReportColumn[],
  filename: string,
) {
  if (rows.length === 0) return;

  const headers = columns.map(c => c.header);
  const body = rows.map(row =>
    columns.map(col => {
      const raw = row[col.key];
      const v = col.format ? col.format(raw) : String(raw ?? '');
      // Escape commas and quotes for CSV
      return v.includes(',') || v.includes('"') || v.includes('\n')
        ? `"${v.replace(/"/g, '""')}"`
        : v;
    }),
  );

  const csv = [headers.join(','), ...body.map(r => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── PDF ───────────────────────────────────────────────────────────────────────

export function exportPDF(
  sections: Array<{
    title: string;
    columns: ReportColumn[];
    rows: Record<string, unknown>[];
  }>,
  meta: ReportMeta,
  filename: string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 15;

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138); // primary blue
  doc.text(meta.title, pageW / 2, y, { align: 'center' });
  y += 7;

  if (meta.subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(meta.subtitle, pageW / 2, y, { align: 'center' });
    y += 6;
  }

  // Generated info
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  const genLine = [
    `Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`,
    meta.generatedBy ? `By: ${meta.generatedBy}` : '',
  ].filter(Boolean).join('   ·   ');
  doc.text(genLine, pageW / 2, y, { align: 'center' });
  y += 5;

  // Active filters
  if (meta.filters) {
    const filterParts = Object.entries(meta.filters)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`);
    if (filterParts.length > 0) {
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Filters: ${filterParts.join('  |  ')}`, pageW / 2, y, { align: 'center' });
      y += 5;
    }
  }

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(14, y, pageW - 14, y);
  y += 6;

  // ── Sections ─────────────────────────────────────────────────────────────────
  sections.forEach((section, idx) => {
    if (idx > 0) y += 4;

    // Section title
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(section.title, 14, y);
    y += 5;

    if (section.rows.length === 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(148, 163, 184);
      doc.text('No data available for selected filters.', 14, y);
      y += 8;
      return;
    }

    const head = [section.columns.map(c => c.header)];
    const body = section.rows.map(row =>
      section.columns.map(col => {
        const raw = row[col.key];
        return col.format ? col.format(raw) : String(raw ?? '—');
      }),
    );

    autoTable(doc, {
      startY: y,
      head,
      body,
      theme: 'striped',
      headStyles: {
        fillColor: [30, 58, 138],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 3,
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 2.5,
        textColor: [30, 41, 59],
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { fontStyle: 'bold' } },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        // Footer on each page
        const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Page ${data.pageNumber} of ${pageCount}  ·  SmartAttend`,
          pageW / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'center' },
        );
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  });

  doc.save(`${filename}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Convenience: single-section PDF ──────────────────────────────────────────

export function exportSingleTablePDF(
  rows: Record<string, unknown>[],
  columns: ReportColumn[],
  meta: ReportMeta,
  filename: string,
) {
  exportPDF([{ title: meta.title, columns, rows }], meta, filename);
}

// ── Date helpers ──────────────────────────────────────────────────────────────

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function fmtPct(v: unknown): string {
  const n = parseFloat(String(v ?? '0'));
  return isNaN(n) ? '—' : `${n}%`;
}
