/**
 * PDF export utilities using jsPDF + jspdf-autotable
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const BRAND = 'SmartAttend — Greenfield University';

function header(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(BRAND, 14, 16);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 14, 24);

  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(subtitle, 14, 30);
    doc.setTextColor(0);
  }

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, subtitle ? 36 : 30);
  doc.setTextColor(0);

  return subtitle ? 42 : 36;
}

function save(doc: jsPDF, filename: string) {
  doc.save(`${filename}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function statusColor(status: string): [number, number, number] {
  if (status === 'PRESENT')    return [22, 163, 74];
  if (status === 'LATE')       return [234, 179, 8];
  if (status === 'ABSENT')     return [239, 68, 68];
  if (status === 'NOT MARKED') return [156, 163, 175];
  return [0, 0, 0];
}

// ── Student: attendance history PDF ──────────────────────────────────────────

export interface HistoryRow {
  course_code: string;
  course_name: string;
  session_type: string;
  scheduled_start: string;
  location: string;
  status: string;
  marked_at: string | null;
  faculty_name: string;
  is_manual_override: boolean;
}

export function exportStudentAttendancePDF(
  studentName: string,
  records: HistoryRow[],
  summary: { total: number; attended: number; pct: number },
) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const startY = header(
    doc,
    `Attendance Report — ${studentName}`,
    `Total: ${summary.total} | Attended: ${summary.attended} | Overall: ${summary.pct.toFixed(1)}%`,
  );

  autoTable(doc, {
    startY,
    head: [['Date', 'Course', 'Type', 'Location', 'Faculty', 'Status', 'Marked At', 'Override']],
    body: records.map(r => [
      new Date(r.scheduled_start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      `${r.course_code} — ${r.course_name}`,
      r.session_type,
      r.location ?? '—',
      r.faculty_name,
      r.status.toUpperCase(),
      r.marked_at ? new Date(r.marked_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—',
      r.is_manual_override ? 'Yes' : 'No',
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      5: { fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        data.cell.styles.textColor = statusColor(String(data.cell.raw));
      }
    },
    didDrawPage: (data) => {
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(`Page ${data.pageNumber}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 8);
      doc.setTextColor(0);
    },
  });

  save(doc, `attendance-${studentName.replace(/\s+/g, '-').toLowerCase()}`);
}

// ── Professor: session attendance sheet PDF ───────────────────────────────────

export interface SheetRow {
  first_name: string;
  last_name: string;
  roll_number: string | null;
  email: string;
  status: string | null;
  marked_at: string | null;
  face_confidence: number | null;
  qr_verified: boolean;
  face_verified: boolean;
  geo_verified: boolean;
  is_manual_override: boolean;
}

export interface SessionInfo {
  course_code: string;
  course_name: string;
  session_type: string;
  scheduled_start: string;
  scheduled_end: string;
  location: string;
  present_count: number;
  late_count: number;
  absent_count: number;
  expected_count: number;
}

export function exportSessionSheetPDF(session: SessionInfo, rows: SheetRow[]) {
  const doc = new jsPDF({ orientation: 'landscape' });

  const date = new Date(session.scheduled_start).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const time = `${new Date(session.scheduled_start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} — ${new Date(session.scheduled_end).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  const pct = session.expected_count > 0
    ? Math.round(((session.present_count + session.late_count) / session.expected_count) * 100)
    : 0;

  const startY = header(
    doc,
    `Session Attendance — ${session.course_code}: ${session.course_name}`,
    `${date} | ${time} | ${session.location} | Present: ${session.present_count} Late: ${session.late_count} Absent: ${session.absent_count} | Attendance: ${pct}%`,
  );

  autoTable(doc, {
    startY,
    head: [['#', 'Roll No.', 'Student Name', 'Email', 'Status', 'Marked At', 'QR', 'Face', 'Geo', 'Override']],
    body: rows.map((r, i) => [
      i + 1,
      r.roll_number ?? '—',
      `${r.first_name} ${r.last_name}`,
      r.email,
      (r.status ?? 'NOT MARKED').toUpperCase(),
      r.marked_at ? new Date(r.marked_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—',
      r.qr_verified   ? '✓' : '—',
      r.face_verified  ? '✓' : '—',
      r.geo_verified   ? '✓' : '—',
      r.is_manual_override ? 'Yes' : 'No',
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [109, 40, 217], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      4: { fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        data.cell.styles.textColor = statusColor(String(data.cell.raw));
      }
    },
    didDrawPage: (data) => {
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(`Page ${data.pageNumber}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 8);
      doc.setTextColor(0);
    },
  });

  const filename = `session-${session.course_code}-${new Date(session.scheduled_start).toISOString().slice(0, 10)}`;
  save(doc, filename.replace(/\s+/g, '-').toLowerCase());
}
