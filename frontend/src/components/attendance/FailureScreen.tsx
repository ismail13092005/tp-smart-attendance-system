import { XCircle, RefreshCw, MessageSquare, QrCode, Camera, MapPin, Wifi, HelpCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { FAILURE_MESSAGES } from './AttendanceFlowTypes';
import type { FailedCheck } from './AttendanceFlowTypes';

interface FailureScreenProps {
  failedCheck: FailedCheck;
  message: string | null;
  onRetry: () => void;
  onRetryFromStart: () => void;
  retryCount: number;
}

const CHECK_ICONS: Record<FailedCheck, React.ElementType> = {
  qr:       QrCode,
  face:     Camera,
  location: MapPin,
  network:  Wifi,
  unknown:  HelpCircle,
};

export function FailureScreen({ failedCheck, message, onRetry, onRetryFromStart, retryCount }: FailureScreenProps) {
  const info = FAILURE_MESSAGES[failedCheck];
  const Icon = CHECK_ICONS[failedCheck];
  const maxRetries = 3;
  const retriesLeft = maxRetries - retryCount;
  // Use the specific message if provided, otherwise fall back to the generic one
  const displayBody = message ?? info.body;

  return (
    <div className="space-y-6 animate-fade-in py-2">
      {/* Error hero */}
      <div className="text-center space-y-3">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 ring-8 ring-destructive/5">
          <XCircle className="h-10 w-10 text-destructive" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{info.title}</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">{displayBody}</p>
        </div>
      </div>

      {/* Which check failed */}
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/15 flex-shrink-0">
            <Icon className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Failed at: <span className="capitalize">{failedCheck.replace('_', ' ')} check</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              The other checks were not affected
            </p>
          </div>
        </div>
      </div>

      {/* Retry count warning */}
      {retryCount >= 2 && (
        <div className="rounded-lg bg-warning/10 border border-warning/30 p-3 text-sm text-warning">
          <p className="font-medium">Multiple failed attempts</p>
          <p className="text-xs mt-0.5 opacity-80">
            {retriesLeft > 0
              ? `${retriesLeft} attempt${retriesLeft !== 1 ? 's' : ''} remaining before you need to contact your faculty.`
              : 'Please contact your faculty for a manual attendance override.'}
          </p>
        </div>
      )}

      {/* Recovery tips */}
      <RecoveryTips failedCheck={failedCheck} />

      {/* Actions */}
      <div className="space-y-2">
        {retriesLeft > 0 && (
          <Button
            className="w-full"
            size="lg"
            onClick={onRetry}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Try {failedCheck === 'qr' ? 'Scanning' : failedCheck === 'face' ? 'Face Capture' : 'Location'} Again
          </Button>
        )}

        <Button
          variant="outline"
          className="w-full"
          onClick={onRetryFromStart}
          leftIcon={<RefreshCw className="h-4 w-4" />}
        >
          Start Over
        </Button>

        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          leftIcon={<MessageSquare className="h-4 w-4" />}
          onClick={() => window.open('mailto:support@greenfield.edu?subject=Attendance%20Issue', '_blank')}
        >
          Contact Support
        </Button>
      </div>

      {/* Support note */}
      <p className="text-center text-xs text-muted-foreground">
        If you continue to have issues, ask your faculty to mark your attendance manually.
        All failed attempts are logged for review.
      </p>
    </div>
  );
}

function RecoveryTips({ failedCheck }: { failedCheck: FailedCheck }) {
  const tips: Record<FailedCheck, string[]> = {
    qr: [
      'Ask your faculty to refresh the QR code',
      'Make sure you are scanning the latest QR code',
      'Try entering the code manually instead of scanning',
    ],
    face: [
      'Move to a well-lit area — avoid backlighting',
      'Remove sunglasses or face coverings',
      'Look directly at the camera, not at the screen',
      'Hold your device steady at eye level',
    ],
    location: [
      'Move closer to the classroom entrance',
      'Go near a window for better GPS signal',
      'Disable VPN if you are using one',
      'Wait a few seconds for GPS to stabilise',
    ],
    network: [
      'Check your Wi-Fi or mobile data connection',
      'Try switching between Wi-Fi and mobile data',
      'Move to an area with better signal',
    ],
    unknown: [
      'Try starting the process again',
      'Ensure your browser is up to date',
      'Contact support if the issue persists',
    ],
  };

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
      <p className="text-sm font-medium text-foreground">Suggested fixes</p>
      <ul className="space-y-1.5">
        {tips[failedCheck].map((tip, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className="text-primary mt-0.5 flex-shrink-0">→</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
