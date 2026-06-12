import { AlertCircle, Clock, Home, History } from 'lucide-react';
import { Button } from '../ui/Button';
import { useNavigate } from 'react-router-dom';
import { formatDateTime } from '../../lib/utils';

interface DuplicateScreenProps {
  markedAt?: string;
  courseCode?: string;
  courseName?: string;
}

export function DuplicateScreen({ markedAt, courseCode, courseName }: DuplicateScreenProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-fade-in py-2 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-warning/10 ring-8 ring-warning/5">
        <AlertCircle className="h-10 w-10 text-warning" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold text-foreground">Already Marked</h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Your attendance for this session has already been recorded. You cannot mark it again.
        </p>
      </div>

      {(markedAt || courseCode) && (
        <div className="rounded-xl border border-border bg-card p-4 text-left space-y-2">
          {courseCode && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Course</span>
              <span className="font-medium">{courseCode} — {courseName}</span>
            </div>
          )}
          {markedAt && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Marked at</span>
              <span className="font-medium flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDateTime(markedAt)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate('/attendance-history')}
          leftIcon={<History className="h-4 w-4" />}
        >
          View Attendance History
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => navigate('/')}
          leftIcon={<Home className="h-4 w-4" />}
        >
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
