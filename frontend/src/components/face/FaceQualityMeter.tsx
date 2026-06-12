/**
 * FaceQualityMeter
 * Renders a live quality bar and issue chips from a FaceQualityReport.
 */
import { cn } from '../../lib/utils';

export interface QualityReport {
  score: number;
  acceptable: boolean;
  issues: string[];
  brightness?: number;
  sharpness?: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

interface FaceQualityMeterProps {
  report: QualityReport | null;
  checking?: boolean;
}

const ISSUE_LABELS: Record<string, string> = {
  no_face:        'No face detected',
  multiple_faces: 'Multiple faces',
  too_dark:       'Too dark',
  too_bright:     'Too bright',
  blurry:         'Image blurry',
  face_too_small: 'Move closer',
  face_too_close: 'Move back',
  head_turned:    'Face the camera',
  eyes_closed:    'Open your eyes',
  face_occluded:  'Remove obstructions',
};

export function FaceQualityMeter({ report, checking }: FaceQualityMeterProps) {
  if (checking) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Analysing frame…</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full w-1/2 bg-primary/40 animate-pulse rounded-full" />
        </div>
      </div>
    );
  }

  if (!report) return null;

  const pct = Math.round(report.score * 100);
  const color =
    pct >= 80 ? 'bg-success' :
    pct >= 60 ? 'bg-warning' :
    'bg-destructive';

  const label =
    pct >= 80 ? 'Excellent' :
    pct >= 70 ? 'Good' :
    pct >= 60 ? 'Acceptable' :
    'Too low';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Image quality</span>
        <span className={cn(
          'font-semibold',
          pct >= 70 ? 'text-success' : pct >= 60 ? 'text-warning' : 'text-destructive',
        )}>
          {label} ({pct}%)
        </span>
      </div>

      {/* Bar */}
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', color)}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Sub-metrics */}
      {(report.brightness !== undefined || report.sharpness !== undefined) && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          {report.brightness !== undefined && (
            <span>Brightness: {Math.round(report.brightness * 100)}%</span>
          )}
          {report.sharpness !== undefined && (
            <span>Sharpness: {Math.round(report.sharpness * 100)}%</span>
          )}
        </div>
      )}

      {/* Issue chips */}
      {report.issues.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {report.issues.map((issue) => (
            <span
              key={issue}
              className="inline-flex items-center rounded-full bg-destructive/10 border border-destructive/20 px-2 py-0.5 text-xs text-destructive"
            >
              {ISSUE_LABELS[issue] ?? issue}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
