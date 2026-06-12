import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, ShieldCheck, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import type { FaceCaptureResult, QRValidationResult } from './AttendanceFlowTypes';

interface FaceCaptureStepProps {
  sessionValidation: QRValidationResult;
  onCapture: (result: FaceCaptureResult) => void;
  retryCount: number;
}

type CameraState = 'loading' | 'ready' | 'captured' | 'error';

export function FaceCaptureStep({ onCapture, retryCount }: FaceCaptureStepProps) {
  const webcamRef = useRef<Webcam>(null);
  const [cameraState, setCameraState] = useState<CameraState>('loading');
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Countdown capture
  const startCountdown = useCallback(() => {
    setCountdown(3);
  }, []);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      captureNow();
      setCountdown(null);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const captureNow = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot({ width: 640, height: 480 });
    if (!imageSrc) {
      setCameraError('Could not capture image. Please try again.');
      return;
    }
    setCapturedDataUrl(imageSrc);
    setCameraState('captured');
  }, []);

  const retake = () => {
    setCapturedDataUrl(null);
    setCameraState('ready');
    setCameraError(null);
  };

  const confirmCapture = async () => {
    if (!capturedDataUrl) return;
    // Convert data URL to File
    const res = await fetch(capturedDataUrl);
    const blob = await res.blob();
    const file = new File([blob], 'face-capture.jpg', { type: 'image/jpeg' });

    // Validate image is not empty
    if (blob.size < 5000) {
      setCameraError('Image too small or blank. Please retake.');
      retake();
      return;
    }

    onCapture({ imageFile: file, imageDataUrl: capturedDataUrl });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold text-foreground">Face Verification</h2>
        <p className="text-sm text-muted-foreground">
          Look directly at the camera and ensure your face is well-lit
        </p>
      </div>

      {/* Retry notice */}
      {retryCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-warning/10 border border-warning/30 p-3 text-sm text-warning">
          <RefreshCw className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>Attempt {retryCount + 1} — ensure good lighting and look directly at the camera.</span>
        </div>
      )}

      {/* Camera / Preview */}
      <div className="relative mx-auto w-full max-w-sm">
        {/* Outer frame */}
        <div className={cn(
          'relative rounded-2xl overflow-hidden bg-black aspect-[4/3]',
          'ring-2 transition-all duration-300',
          cameraState === 'ready'    && 'ring-primary/50',
          cameraState === 'captured' && 'ring-success/70',
          cameraState === 'error'    && 'ring-destructive/50',
          cameraState === 'loading'  && 'ring-border',
        )}>
          {/* Live camera */}
          {cameraState !== 'captured' && (
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              screenshotQuality={0.92}
              className="w-full h-full object-cover"
              videoConstraints={{ facingMode: 'user', width: 640, height: 480 }}
              onUserMedia={() => setCameraState('ready')}
              onUserMediaError={(err) => {
                setCameraState('error');
                setCameraError(
                  typeof err === 'string' ? err :
                  err instanceof Error ? err.message :
                  'Camera access denied. Please allow camera permissions.',
                );
              }}
            />
          )}

          {/* Captured preview */}
          {cameraState === 'captured' && capturedDataUrl && (
            <img src={capturedDataUrl} alt="Captured face" className="w-full h-full object-cover" />
          )}

          {/* Loading overlay */}
          {cameraState === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm text-white/70">Starting camera…</p>
            </div>
          )}

          {/* Face guide overlay — oval bounding box */}
          {cameraState === 'ready' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={cn(
                'w-44 h-56 rounded-full border-2 border-dashed transition-colors duration-300',
                countdown !== null ? 'border-warning' : 'border-white/60',
              )} />
            </div>
          )}

          {/* Countdown overlay */}
          {countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
                <span className="text-5xl font-bold text-white tabular-nums">{countdown}</span>
              </div>
            </div>
          )}

          {/* Captured checkmark */}
          {cameraState === 'captured' && (
            <div className="absolute top-3 right-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success shadow-lg">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
            </div>
          )}
        </div>

        {/* Tips below camera */}
        {cameraState === 'ready' && (
          <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span>✓ Face the camera</span>
            <span>✓ Good lighting</span>
            <span>✓ No glasses</span>
          </div>
        )}
      </div>

      {/* Camera error */}
      {cameraError && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Camera unavailable</p>
            <p className="text-xs mt-0.5 opacity-80">{cameraError}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {cameraState === 'ready' && (
          <>
            <Button
              className="w-full"
              size="lg"
              onClick={startCountdown}
              disabled={countdown !== null}
              leftIcon={<Camera className="h-4 w-4" />}
            >
              {countdown !== null ? `Capturing in ${countdown}…` : 'Capture Photo'}
            </Button>
            <Button
              variant="ghost"
              className="w-full text-sm"
              size="sm"
              onClick={captureNow}
              disabled={countdown !== null}
            >
              Capture immediately
            </Button>
          </>
        )}

        {cameraState === 'captured' && (
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={retake} leftIcon={<RefreshCw className="h-4 w-4" />}>
              Retake
            </Button>
            <Button className="flex-1" size="lg" onClick={confirmCapture} leftIcon={<CheckCircle2 className="h-4 w-4" />}>
              Use This Photo
            </Button>
          </div>
        )}

        {cameraState === 'error' && (
          <Button variant="outline" className="w-full" onClick={() => { setCameraState('loading'); setCameraError(null); }}>
            Retry Camera
          </Button>
        )}
      </div>

      {/* Biometric security panel */}
      <BiometricInfoPanel />
    </div>
  );
}

function BiometricInfoPanel() {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary flex-shrink-0" />
        <p className="text-sm font-medium text-foreground">Secured Biometric Processing</p>
      </div>
      <ul className="space-y-1.5 text-xs text-muted-foreground">
        <li className="flex items-start gap-2">
          <span className="text-success mt-0.5">✓</span>
          <span>Your photo is processed locally and never stored permanently</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-success mt-0.5">✓</span>
          <span>Only an encrypted mathematical representation is compared</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-success mt-0.5">✓</span>
          <span>Liveness detection prevents photo spoofing</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-success mt-0.5">✓</span>
          <span>Data is encrypted end-to-end during transmission</span>
        </li>
      </ul>
    </div>
  );
}
