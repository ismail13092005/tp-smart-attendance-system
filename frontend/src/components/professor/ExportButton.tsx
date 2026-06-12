/**
 * ExportButton — CSV export (works without a server round-trip).
 * PDF export opens a print dialog on the current page.
 */
import { useState } from 'react';
import { Download, FileText, Table2, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ExportButtonProps {
  onExportCSV: () => void;
  onExportPDF?: () => void;
  label?: string;
  disabled?: boolean;
}

export function ExportButton({ onExportCSV, onExportPDF, label = 'Export', disabled }: ExportButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <div className="flex">
        <button
          onClick={onExportCSV}
          disabled={disabled}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-l-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Download className="h-4 w-4" />
          {label}
        </button>
        <button
          onClick={() => setOpen(!open)}
          disabled={disabled}
          className="flex items-center px-2 bg-primary text-primary-foreground rounded-r-lg border-l border-primary-foreground/20 hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-border bg-card shadow-lg overflow-hidden animate-slide-up">
          <button
            onClick={() => { onExportCSV(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
          >
            <Table2 className="h-4 w-4 text-success" />
            Export as CSV
          </button>
          {onExportPDF && (
            <button
              onClick={() => { onExportPDF(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors border-t border-border"
            >
              <FileText className="h-4 w-4 text-destructive" />
              Export as PDF
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── CSV helpers ───────────────────────────────────────────────────────────────

export function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const v = String(row[h] ?? '');
        return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(','),
    ),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printPage() {
  window.print();
}
