/**
 * FaceEnrollment — multi-step enrollment wizard
 *
 * Steps:
 *   intro → capture → confirm → enrolling → success | failed
 *
 * Features:
 *  - Live quality hints during capture
 *  - Retry with specific failure reason
 *  - Privacy disclosure before capture
 *  - Existing enrollment detection
 *  - Re-enrollment flow
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Camera, CheckCircle2, AlertCircle,
  RefreshCw, Info, Trash2, ArrowLeft, Loader2,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { FaceCameraCapture, type CaptureResult } from '../../components/face/FaceCameraCapture';
import { FaceQualityMeter } from '../../components/face/FaceQualityMeter';
import { api } from '../../lib/api';

// ── Error code → user message ─────────────────────────────────────────────────

const ERROR_MESSAGES: Record<string, { title: string; hint: string }> = {
  NO_FACE_DETECTED:    { title: 'No face detected',       hint: 'Make sure your face is clearly visible and centred in the frame.' },
  MULTIPLE_FACES:      { title: 'Multiple faces detected', hint: 'Only one person should be in the frame.' },
  BLURRY_FRAME:        { title: 'Image is blurry',         hint: 'Hold your device steady and ensure good lighting.' },
  QUALITY_TOO_LOW:     { title: 'Image quality too low',   hint: 'Move to a well-lit area and look directly at the camera.' },
  LIVENESS_FAILED:     { title: 'Liveness check failed',   hint: 'Please use a live camera — photos or videos are not accepted.' },
  SPOOFING_DETECTED:   { title: 'Verification failed',     hint: 'Please use a live camera — photos or videos are not accepted.' },
  PROVIDER_UNAVAILABLE:{ title: 'Service unavailable',     hint: 'The face recognition service is temporarily unavailable. Try again shortly.' },
};

function getFriendlyError(code?: string): { title: string; hint: string } {
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  return { title: 'Enrollment failed', hint: 'An unexpected error occurred. Please try again.' };
}

// ── Wizard steps ──────────────────────────────────────────────────────────────

type WizardStep = 'loading' | 'intro' | 'capture' | 'confirm' | 'enrolling' | 'success' | 'failed';

interface ExistingEnrollment {
  enrollmentId: string;
  enrolledAt: string;
  expiresAt: string | null;
  verificationCount: number;
  provider: string;
}

export default function FaceEnrollment() {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>('loading');
  const [existing, setExisting] = useState<ExistingEnrollment | null>(null);
  const [capture, setCapture] = useState<CaptureResult | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [retryCount, setRetryCount] = useState(0);
  const [deleting, setDeleting] = useState(false);

  // ── Load existing enrollment on mount ────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const res = await api.checkEnrollmentStatus();
        if (res.data?.hasEnrollment) {
          setExisting(res.data);
        }
      } catch { /* ignore */ }
      setStep('intro');
    })();
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCapture = useCallback((result: CaptureResult) => {
    setCapture(result);
    setStep('confirm');
  }, []);

  const handleEnroll = async () => {
    if (!capture) return;
    setStep('enrolling');
    try {
      await api.enrollFace(capture.file);
      setStep('success');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { code?: string; message?: string } } } };
      const code = axiosErr?.response?.data?.error?.code;
      setErrorCode(code);
      setRetryCount(r => r + 1);
      setStep('failed');
    }
  };

  const handleRetry = () => {
    setCapture(null);
    setErrorCode(undefined);
    setStep('capture');
  };

  const handleDeleteEnrollment = async () => {
    setDeleting(true);
    try {
      await api.deleteEnrollment();
      setExisting(null);
    } catch { /* ignore */ }
    setDeleting(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-md px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          {(step === 'capture' || step === 'confirm') && (
            <Button variant="ghost" size="sm" className="px-2"
              onClick={() => setStep(step === 'confirm' ? 'capture' : 'intro')}
              leftIcon={<ArrowLeft className="h-4 w-4" />}
              aria-label="Go back"
            />
          )}
          <div>
            <h1 className="text-lg font-semibold text-foreground">Face Enrollment</h1>
            <p className="text-xs text-muted-foreground">Biometric identity setup</p>
          </div>
        </div>

        {/* ── Loading ── */}
        {step === 'loading' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Checking enrollment status…</p>
          </div>
        )}

        {/* ── Intro ── */}
        {step === 'intro' && (
          <div className="space-y-5 animate-fade-in">
            {/* Existing enrollment card */}
            {existing && (
              <div className="rounded-xl border border-success/30 bg-success/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-success">Face Already Enrolled</p>
                    <p className="text-xs text-muted-foreground">
                      {existing.verificationCount} successful verification{existing.verificationCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md bg-background/60 px-2 py-1.5">
                    <p className="text-muted-foreground">Provider</p>
                    <p className="font-medium capitalize">{existing.provider}</p>
                  </div>
                  {existing.expiresAt && (
                    <div className="rounded-md bg-background/60 px-2 py-1.5">
                      <p className="text-muted-foreground">Expires</p>
                      <p className="font-medium">{new Date(existing.expiresAt).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-destructive border-destructive/30 hover:bg-destructive/5"
                  loading={deleting}
                  onClick={handleDeleteEnrollment}
                  leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                >
                  Delete Enrollment (GDPR)
                </Button>
              </div>
            )}

            {/* Privacy disclosure */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {existing ? 'Re-enroll Your Face' : 'Enroll Your Face'}
                  </p>
                  <p className="text-xs text-muted-foreground">One-time setup for attendance verification</p>
                </div>
              </div>

              <ul className="space-y-2 text-sm text-muted-foreground">
                {[
                  'Your photo is processed in memory and immediately discarded',
                  'Only an encrypted mathematical template is stored — not your image',
                  'The template cannot be reverse-engineered into a photo',
                  'You can delete your biometric data at any time',
                  'Data is used solely for attendance verification',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="rounded-lg bg-muted/50 border border-border p-3 flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  By proceeding you consent to biometric data processing for attendance purposes.
                  You may withdraw consent at any time by deleting your enrollment.
                </span>
              </div>

              <Button className="w-full" size="lg" onClick={() => setStep('capture')} leftIcon={<Camera className="h-4 w-4" />}>
                {existing ? 'Re-enroll Face' : 'Start Enrollment'}
              </Button>
            </div>

            {/* Tips */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">Tips for best results</p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {[
                  'Face the camera directly — avoid tilting your head',
                  'Ensure your face is well-lit from the front',
                  'Remove sunglasses, hats, or face coverings',
                  'Keep a neutral expression',
                  'Make sure only you are in the frame',
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">→</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ── Capture ── */}
        {step === 'capture' && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Position Your Face</h2>
              <p className="text-sm text-muted-foreground">
                Centre your face in the oval guide and wait for a good quality score
              </p>
            </div>

            {retryCount > 0 && (
              <Alert variant="warning">
                Attempt {retryCount + 1} — {getFriendlyError(errorCode).hint}
              </Alert>
            )}

            <div className="rounded-xl border border-border bg-card p-4">
              <FaceCameraCapture
                onCapture={handleCapture}
                minQuality={0.60}
                countdown
              />
            </div>
          </div>
        )}

        {/* ── Confirm ── */}
        {step === 'confirm' && capture && (
          <div className="space-y-4 animate-slide-up">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Confirm Your Photo</h2>
              <p className="text-sm text-muted-foreground">
                Make sure your face is clearly visible before enrolling
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              {/* Preview */}
              <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-black">
                <img src={capture.dataUrl} alt="Captured face" className="w-full h-full object-cover" />
                {capture.quality.acceptable && (
                  <div className="absolute top-3 right-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success shadow-lg">
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                  </div>
                )}
              </div>

              {/* Quality report */}
              <FaceQualityMeter report={capture.quality} />

              {/* Low quality warning */}
              {!capture.quality.acceptable && (
                <Alert variant="warning" title="Low quality image">
                  This image may not enroll successfully. Consider retaking for better results.
                </Alert>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep('capture')} leftIcon={<RefreshCw className="h-4 w-4" />}>
                  Retake
                </Button>
                <Button className="flex-1" size="lg" onClick={handleEnroll} leftIcon={<CheckCircle2 className="h-4 w-4" />}>
                  Enroll Face
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Enrolling ── */}
        {step === 'enrolling' && (
          <div className="rounded-xl border border-border bg-card p-8 text-center space-y-5 animate-fade-in">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Processing Enrollment</p>
              <p className="text-sm text-muted-foreground mt-1">
                Extracting and encrypting your face template…
              </p>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              {['Analysing face geometry', 'Generating encrypted template', 'Saving securely'].map((s, i) => (
                <div key={i} className="flex items-center gap-2 justify-center">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Your photo is discarded after this step</p>
          </div>
        )}

        {/* ── Success ── */}
        {step === 'success' && (
          <div className="rounded-xl border border-success/30 bg-success/5 p-8 text-center space-y-5 animate-slide-up">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success/15 ring-8 ring-success/10">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Enrollment Complete!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Your face has been securely enrolled. You can now mark attendance using face verification.
              </p>
            </div>

            <div className="rounded-lg bg-background/60 border border-border p-3 text-xs text-muted-foreground space-y-1 text-left">
              <p className="font-medium text-foreground">What was stored</p>
              <p>✓ An encrypted mathematical template (not your photo)</p>
              <p>✓ Enrollment timestamp and quality score</p>
              <p>✗ Your raw photo was discarded immediately</p>
            </div>

            <div className="flex flex-col gap-2">
              <Button className="w-full" size="lg" onClick={() => navigate('/')}>
                Go to Dashboard
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setStep('intro')}>
                View Enrollment Details
              </Button>
            </div>
          </div>
        )}

        {/* ── Failed ── */}
        {step === 'failed' && (
          <div className="space-y-4 animate-fade-in">
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">{getFriendlyError(errorCode).title}</h2>
                <p className="text-sm text-muted-foreground mt-1">{getFriendlyError(errorCode).hint}</p>
              </div>
            </div>

            {retryCount >= 3 && (
              <Alert variant="warning" title="Multiple failed attempts">
                If you continue to have issues, contact your administrator for assistance.
              </Alert>
            )}

            <div className="flex flex-col gap-2">
              <Button className="w-full" size="lg" onClick={handleRetry} leftIcon={<RefreshCw className="h-4 w-4" />}>
                Try Again
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
