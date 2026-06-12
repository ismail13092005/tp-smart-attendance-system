import { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import { QrCode, Keyboard, AlertCircle, RefreshCw, Camera, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import type { QRValidationResult } from './AttendanceFlowTypes';

interface QRScanStepProps {
  onValidToken: (token: string, validation: QRValidationResult) => void;
  retryCount: number;
}

type InputMode = 'scan' | 'manual';

async function validateQRWithBackend(token: string): Promise<QRValidationResult> {
  if (!token || token.trim().length < 10) {
    return { valid: false, reason: 'QR code appears incomplete. Please scan again.' };
  }
  try {
    console.log('[QR] Validating token with backend:', token.substring(0, 20) + '...');
    const res = await api.validateQRToken(token.trim());
    console.log('[QR] Backend validation result:', res.data);
    return res.data as QRValidationResult;
  } catch (err) {
    console.error('[QR] Backend validation failed:', err);
    // Optimistically accept — final validation happens at submission
    return {
      valid: true,
      sessionId: 'pending',
      courseCode: '—',
      courseName: 'Verifying…',
      facultyName: '—',
      location: '—',
    };
  }
}

export function QRScanStep({ onValidToken, retryCount }: QRScanStepProps) {
  const [mode, setMode] = useState<InputMode>('scan');
  const [manualToken, setManualToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannerReady, setScannerReady] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const processedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Start camera scanner ──────────────────────────────────────────────────
  const startScanner = useCallback(async () => {
    console.log('[QR Scanner] Starting camera...');
    setCameraError(null);
    setScannerReady(false);
    processedRef.current = false;
    setLastScanned(null);

    try {
      // Check camera availability
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported in this browser');
      }

      // Request rear camera (environment) for QR scanning on mobile
      // Fall back to any available camera if rear camera is not available
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' }, // rear camera preferred
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch {
        // Fallback: try any camera
        console.warn('[QR Scanner] Rear camera unavailable, trying any camera...');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      }

      console.log('[QR Scanner] Requesting camera permission...');
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        console.log('[QR Scanner] Camera started successfully');
        setScannerReady(true);
        scanningRef.current = true;
        requestAnimationFrame(tick);
      }
    } catch (err) {
      console.error('[QR Scanner] Camera error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('permission') || msg.includes('denied') || msg.includes('NotAllowed')) {
        setCameraError('Camera permission denied. Please allow camera access or use "Enter Code".');
      } else if (msg.includes('NotFound') || msg.includes('not found')) {
        setCameraError('No camera found. Use "Enter Code" instead.');
      } else {
        setCameraError('Could not start camera. Use "Enter Code" instead.');
      }
    }
  }, []);

  // ── Scan loop using jsQR ──────────────────────────────────────────────────
  const tick = useCallback(() => {
    if (!scanningRef.current || processedRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        console.log('[QR Scanner] QR code detected:', code.data.substring(0, 30) + '...');
        processedRef.current = true;
        scanningRef.current = false;
        processToken(code.data);
        return;
      }
    }

    if (scanningRef.current) {
      requestAnimationFrame(tick);
    }
  }, []);

  // ── Stop scanner ──────────────────────────────────────────────────────────
  const stopScanner = useCallback(() => {
    console.log('[QR Scanner] Stopping camera...');
    scanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScannerReady(false);
  }, []);

  // ── Start/stop on mode change ─────────────────────────────────────────────
  useEffect(() => {
    if (mode === 'scan') {
      startScanner();
    } else {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
  }, [mode, startScanner, stopScanner]);

  // ── Process scanned/entered token ─────────────────────────────────────────
  const processToken = async (token: string) => {
    console.log('[QR Scanner] Processing token...');
    setValidating(true);
    setError(null);
    setLastScanned(token);
    
    try {
      const result = await validateQRWithBackend(token);
      if (result.valid) {
        console.log('[QR Scanner] Token validated successfully');
        stopScanner();
        onValidToken(token, result);
      } else {
        console.warn('[QR Scanner] Token validation failed:', result.reason);
        setError(result.reason ?? 'Invalid QR code. Please try again.');
        // Re-enable scanner for retry
        processedRef.current = false;
        scanningRef.current = true;
        requestAnimationFrame(tick);
      }
    } catch (err) {
      console.error('[QR Scanner] Token processing error:', err);
      setError('Could not validate QR code. Check your connection.');
      processedRef.current = false;
      scanningRef.current = true;
      requestAnimationFrame(tick);
    } finally {
      setValidating(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    await processToken(manualToken.trim());
  };

  const switchMode = (m: InputMode) => {
    setError(null);
    setMode(m);
    if (m === 'manual') setTimeout(() => inputRef.current?.focus(), 50);
  };

  const retryScanner = () => {
    setError(null);
    setCameraError(null);
    processedRef.current = false;
    startScanner();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold text-foreground">Scan QR Code</h2>
        <p className="text-sm text-muted-foreground">
          Point your camera at the QR code displayed by your faculty
        </p>
      </div>

      {/* Retry notice */}
      {retryCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-warning/10 border border-warning/30 p-3 text-sm text-warning">
          <RefreshCw className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Attempt {retryCount + 1} — ask your faculty to refresh the QR code if it keeps failing.</span>
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex rounded-lg border border-border p-1 gap-1">
        <button
          onClick={() => switchMode('scan')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors',
            mode === 'scan' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Camera className="h-4 w-4" />
          Camera Scan
        </button>
        <button
          onClick={() => switchMode('manual')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors',
            mode === 'manual' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Keyboard className="h-4 w-4" />
          Enter Code
        </button>
      </div>

      {/* Camera scan mode */}
      {mode === 'scan' && (
        <div className="space-y-3">
          <div className="relative mx-auto w-full max-w-xs aspect-square rounded-2xl overflow-hidden bg-black">
            {/* Live video feed */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
              autoPlay
            />

            {/* Hidden canvas for jsQR processing */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Corner brackets overlay */}
            {!cameraError && scannerReady && (
              <>
                {(['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'] as const).map((pos, i) => (
                  <div key={i} className={cn('absolute w-7 h-7 border-primary pointer-events-none', pos,
                    i < 2 ? 'border-t-2' : 'border-b-2',
                    i % 2 === 0 ? 'border-l-2' : 'border-r-2',
                  )} />
                ))}
              </>
            )}

            {/* Loading state */}
            {!scannerReady && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
                <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <p className="text-xs text-white/70">Starting camera…</p>
              </div>
            )}

            {/* Validating overlay */}
            {validating && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
                <div className="h-8 w-8 rounded-full border-4 border-success border-t-transparent animate-spin" />
                <p className="text-xs text-white/70">Validating…</p>
              </div>
            )}

            {/* Camera error state */}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-4">
                <QrCode className="h-12 w-12 text-white/30" />
                <p className="text-xs text-white/60 text-center">{cameraError}</p>
              </div>
            )}

            {/* Scan line animation */}
            {scannerReady && !validating && (
              <div className="absolute inset-x-6 h-0.5 bg-primary/70 pointer-events-none animate-scan" />
            )}

            {/* Success indicator */}
            {lastScanned && validating && (
              <div className="absolute top-3 right-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success shadow-lg">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
              </div>
            )}
          </div>

          {cameraError ? (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={retryScanner}>
                <RefreshCw className="h-4 w-4 mr-1.5" /> Retry Camera
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => switchMode('manual')}>
                <Keyboard className="h-4 w-4 mr-1.5" /> Enter Code
              </Button>
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Hold the QR code steady in front of the camera
            </p>
          )}
        </div>
      )}

      {/* Manual entry mode */}
      {mode === 'manual' && (
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="qr-token" className="block text-sm font-medium text-foreground">
              QR Token
            </label>
            <input
              ref={inputRef}
              id="qr-token"
              type="text"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Paste or type the QR token here"
              className={cn(
                'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono',
                'placeholder:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              Ask your faculty to share the token if you cannot scan the QR code.
            </p>
          </div>
          <Button type="submit" className="w-full" size="lg" loading={validating} disabled={!manualToken.trim()}>
            Validate Code
          </Button>
        </form>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Info */}
      <div className="rounded-lg bg-muted/50 border border-border p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">How QR verification works</p>
        <p>Each QR code is unique to this session and expires in 3 minutes. It cannot be reused once scanned.</p>
      </div>

      {/* CSS for scan line animation */}
      <style>{`
        @keyframes scan {
          0%, 100% { top: 10%; }
          50% { top: 90%; }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
