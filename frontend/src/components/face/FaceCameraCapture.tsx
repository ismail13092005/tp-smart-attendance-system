/**
 * FaceCameraCapture
 *
 * Reusable camera component with:
 *  - Oval face guide overlay
 *  - Live quality polling (every 1.5 s while camera is open)
 *  - Countdown capture
 *  - Preview + retake flow
 *  - Accessibility: aria-live quality announcements
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { FaceQualityMeter, type QualityReport } from './FaceQualityMeter';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';

export interface CaptureResult {
  file: File;
  dataUrl: string;
  quality: QualityReport;
}

interface FaceCameraCaptureProps {
  onCapture: (result: CaptureResult) => void;
  /** Minimum quality score to allow capture (0–1) */
  minQuality?: number;
  /** Show countdown before capture */
  countdown?: boolean;
  className?: string;
}

type CameraState = 'loading' | 'ready' | 'captured' | 'error';

export function FaceCameraCapture({
  onCapture,
  minQuality = 0.60,
  countdown = true,
  className,
}: FaceCameraCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const qualityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>('loading');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedQuality, setCapturedQuality] = useState<QualityReport | null>(null);
  const [liveQuality, setLiveQuality] = useState<QualityReport | null>(null);
  const [checkingQuality, setCheckingQuality] = useState(false);
  const [countdownVal, setCountdownVal] = useState<number | null>(null);

  // ── Live quality polling ──────────────────────────────────────────────────

  const pollQuality = useCallback(async () => {
    if (cameraState !== 'ready' || !webcamRef.current) return;
    const shot = webcamRef.current.getScreenshot({ width: 320, height: 240 });
    if (!shot) return;
    setCheckingQuality(true);
    try {
      const blob = await (await fetch(shot)).blob();
      const file = new File([blob], 'quality-check.jpg', { type: 'image/jpeg' });
      const res = await api.checkFaceQuality(file);
      setLiveQuality(res.data?.quality ?? null);
    } catch {
      // Silently ignore — quality polling is best-effort
    } finally {
      setCheckingQuality(false);
    }
  }, [cameraState]);

  useEffect(() => {
    if (cameraState === 'ready') {
      qualityTimerRef.current = setInterval(pollQuality, 1500);
    }
    return () => {
      if (qualityTimerRef.current) clearInterval(qualityTimerRef.current);
    };
  }, [cameraState, pollQuality]);

  // ── Countdown ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (countdownVal === null) return;
    if (countdownVal === 0) { captureNow(); setCountdownVal(null); return; }
    const t = setTimeout(() => setCountdownVal(v => (v ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdownVal]);

  // ── Capture ───────────────────────────────────────────────────────────────

  const captureNow = useCallback(async () => {
    const shot = webcamRef.current?.getScreenshot({ width: 640, height: 480 });
    if (!shot) return;

    const blob = await (await fetch(shot)).blob();
    const file = new File([blob], 'face-enrollment.jpg', { type: 'image/jpeg' });

    // Final quality check on the captured frame
    let quality: QualityReport = liveQuality ?? { score: 0.8, acceptable: true, issues: [] };
    try {
      const res = await api.checkFaceQuality(file);
      quality = res.data?.quality ?? quality;
    } catch { /* use last known quality */ }

    setCapturedDataUrl(shot);
    setCapturedFile(file);
    setCapturedQuality(quality);
    setCameraState('captured');
  }, [liveQuality]);

  const startCapture = () => {
    if (countdown) setCountdownVal(3);
    else captureNow();
  };

  const retake = () => {
    setCapturedDataUrl(null);
    setCapturedFile(null);
    setCapturedQuality(null);
    setLiveQuality(null);
    setCameraState('ready');
  };

  const confirmCapture = () => {
    if (capturedFile && capturedDataUrl && capturedQuality) {
      onCapture({ file: capturedFile, dataUrl: capturedDataUrl, quality: capturedQuality });
    }
  };

  const qualityOk = liveQuality ? liveQuality.score >= minQuality && liveQuality.acceptable : true;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Camera frame */}
      <div className={cn(
        'relative rounded-2xl overflow-hidden bg-black aspect-[4/3] ring-2 transition-all duration-300',
        cameraState === 'ready'    && (qualityOk ? 'ring-primary/40' : 'ring-warning/50'),
        cameraState === 'captured' && 'ring-success/60',
        cameraState === 'error'    && 'ring-destructive/50',
        cameraState === 'loading'  && 'ring-border',
      )}>
        {/* Live feed */}
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
                err instanceof Error ? err.message : 'Camera access denied',
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

        {/* Oval face guide */}
        {cameraState === 'ready' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={cn(
              'w-44 h-56 rounded-full border-2 border-dashed transition-colors duration-500',
              qualityOk ? 'border-white/60' : 'border-warning/70',
            )} />
          </div>
        )}

        {/* Countdown */}
        {countdownVal !== null && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
              <span className="text-5xl font-bold text-white tabular-nums">{countdownVal}</span>
            </div>
          </div>
        )}

        {/* Captured badge */}
        {cameraState === 'captured' && (
          <div className="absolute top-3 right-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success shadow-lg">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
          </div>
        )}

        {/* Quality badge on live feed */}
        {cameraState === 'ready' && liveQuality && (
          <div className="absolute bottom-2 left-2 right-2">
            <div className="rounded-lg bg-black/60 backdrop-blur-sm px-3 py-1.5">
              <div className="flex items-center justify-between text-xs text-white">
                <span>Quality</span>
                <span className={cn(
                  'font-semibold',
                  liveQuality.score >= 0.80 ? 'text-green-400' :
                  liveQuality.score >= 0.60 ? 'text-yellow-400' : 'text-red-400',
                )}>
                  {Math.round(liveQuality.score * 100)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Camera error */}
      {cameraState === 'error' && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Camera unavailable</p>
            <p className="text-xs mt-0.5 opacity-80">{cameraError}</p>
          </div>
        </div>
      )}

      {/* Quality meter (live) */}
      {cameraState === 'ready' && (
        <FaceQualityMeter report={liveQuality} checking={checkingQuality && !liveQuality} />
      )}

      {/* Quality meter (captured) */}
      {cameraState === 'captured' && capturedQuality && (
        <FaceQualityMeter report={capturedQuality} />
      )}

      {/* Accessibility live region */}
      <div aria-live="polite" className="sr-only">
        {liveQuality && !liveQuality.acceptable && liveQuality.issues.join(', ')}
      </div>

      {/* Actions */}
      <div className="space-y-2">
        {cameraState === 'ready' && (
          <>
            <Button
              className="w-full"
              size="lg"
              onClick={startCapture}
              disabled={countdownVal !== null || (!qualityOk && !!liveQuality)}
              leftIcon={<Camera className="h-4 w-4" />}
            >
              {countdownVal !== null
                ? `Capturing in ${countdownVal}…`
                : !qualityOk && liveQuality
                ? 'Improve image quality to capture'
                : 'Capture Photo'}
            </Button>
            {!qualityOk && liveQuality && (
              <Button variant="ghost" size="sm" className="w-full" onClick={startCapture}>
                Capture anyway
              </Button>
            )}
          </>
        )}

        {cameraState === 'captured' && (
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={retake} leftIcon={<RefreshCw className="h-4 w-4" />}>
              Retake
            </Button>
            <Button
              className="flex-1"
              size="lg"
              onClick={confirmCapture}
              disabled={!capturedQuality?.acceptable && (capturedQuality?.score ?? 0) < 0.50}
              leftIcon={<CheckCircle2 className="h-4 w-4" />}
            >
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
    </div>
  );
}
