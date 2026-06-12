/**
 * MarkAttendance — complete 3-factor attendance flow
 *
 * State machine:
 *   qr → face → location → submitting → success | duplicate | failed
 *
 * Rules enforced:
 *  - Steps cannot be skipped
 *  - Duplicate submission is detected and shown a friendly screen
 *  - Each step tracks its own retry count
 *  - Failure messages never expose internal details
 *  - Submission is locked once started (prevents double-tap)
 */

import { useReducer, useCallback, useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { FlowStepper } from '../../components/attendance/FlowStepper';
import { QRScanStep } from '../../components/attendance/QRScanStep';
import { SessionValidationCard } from '../../components/attendance/SessionValidationCard';
import { FaceCaptureStep } from '../../components/attendance/FaceCaptureStep';
import { LocationStepLeaflet } from '../../components/attendance/LocationStepLeaflet';
import { SubmittingStep } from '../../components/attendance/SubmittingStep';
import { AttendanceReceipt } from '../../components/attendance/AttendanceReceipt';
import { FailureScreen } from '../../components/attendance/FailureScreen';
import { DuplicateScreen } from '../../components/attendance/DuplicateScreen';
import { api, getErrorMessage } from '../../lib/api';
import {
  INITIAL_FLOW_STATE,
  type FlowState,
  type FlowStep,
  type QRValidationResult,
  type FaceCaptureResult,
  type LocationResult,
  type FailedCheck,
} from '../../components/attendance/AttendanceFlowTypes';

// ── Reducer ───────────────────────────────────────────────────────────────────

type Action =
  | { type: 'QR_ACCEPTED';    token: string; validation: QRValidationResult }
  | { type: 'FACE_CAPTURED';  capture: FaceCaptureResult }
  | { type: 'LOCATION_READY'; location: LocationResult }
  | { type: 'SUBMITTING' }
  | { type: 'SUCCESS';        receipt: FlowState['receipt'] }
  | { type: 'DUPLICATE';      markedAt?: string }
  | { type: 'FAILED';         check: FailedCheck; message: string }
  | { type: 'RETRY_STEP' }
  | { type: 'RESET' };

function reducer(state: FlowState, action: Action): FlowState {
  switch (action.type) {
    case 'QR_ACCEPTED':
      return { ...state, step: 'face', qrToken: action.token, qrValidation: action.validation };

    case 'FACE_CAPTURED':
      return { ...state, step: 'location', faceCapture: action.capture };

    case 'LOCATION_READY':
      return { ...state, locationResult: action.location };

    case 'SUBMITTING':
      return { ...state, step: 'submitting' };

    case 'SUCCESS':
      return { ...state, step: 'success', receipt: action.receipt };

    case 'DUPLICATE':
      return { ...state, step: 'duplicate' };

    case 'FAILED':
      return {
        ...state,
        step: 'failed',
        failedCheck: action.check,
        failureMessage: action.message,
        // Increment the retry counter for the failed step
        qrRetries:       action.check === 'qr'       ? state.qrRetries + 1       : state.qrRetries,
        faceRetries:     action.check === 'face'     ? state.faceRetries + 1     : state.faceRetries,
        locationRetries: action.check === 'location' ? state.locationRetries + 1 : state.locationRetries,
      };

    case 'RETRY_STEP': {
      // Go back to the failed step, preserving already-collected data
      const check = state.failedCheck;
      const retryStep: FlowStep =
        check === 'qr'       ? 'qr' :
        check === 'face'     ? 'face' :
        check === 'location' ? 'location' : 'qr';
      return {
        ...state,
        step: retryStep,
        failedCheck: null,
        failureMessage: null,
        // Clear only the failed step's data
        qrToken:        check === 'qr'       ? null : state.qrToken,
        qrValidation:   check === 'qr'       ? null : state.qrValidation,
        faceCapture:    check === 'face'     ? null : state.faceCapture,
        locationResult: check === 'location' ? null : state.locationResult,
      };
    }

    case 'RESET':
      return INITIAL_FLOW_STATE;

    default:
      return state;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MarkAttendance() {
  const [state, dispatch] = useReducer(reducer, INITIAL_FLOW_STATE);
  const navigate = useNavigate();
  void navigate; // used by child components via router
  const submittingRef = useRef(false); // prevent double-submit

  // ── Face enrollment gate ───────────────────────────────────────────────────
  const [enrollmentChecked, setEnrollmentChecked] = useState(false);
  const [hasEnrollment, setHasEnrollment] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.checkEnrollmentStatus();
        setHasEnrollment(res.data?.hasEnrollment === true);
      } catch {
        // If check fails, allow through — backend will reject if truly not enrolled
        setHasEnrollment(true);
      } finally {
        setEnrollmentChecked(true);
      }
    })();
  }, []);

  // ── Step handlers ──────────────────────────────────────────────────────────

  const handleQRAccepted = useCallback((token: string, validation: QRValidationResult) => {
    dispatch({ type: 'QR_ACCEPTED', token, validation });
  }, []);

  const handleFaceCaptured = useCallback((capture: FaceCaptureResult) => {
    dispatch({ type: 'FACE_CAPTURED', capture });
  }, []);

  const handleLocationReady = useCallback(async (location: LocationResult) => {
    if (submittingRef.current) return; // guard against double-tap
    submittingRef.current = true;

    dispatch({ type: 'LOCATION_READY', location });
    dispatch({ type: 'SUBMITTING' });

    try {
      const response = await api.markAttendance({
        qrToken:   state.qrToken!,
        faceImage: state.faceCapture!.imageFile,
        latitude:  location.latitude,
        longitude: location.longitude,
        accuracy:  location.accuracy,
      });

      const attendance = response.data?.attendance;
      dispatch({
        type: 'SUCCESS',
        receipt: {
          id:             attendance?.id ?? 'unknown',
          status:         attendance?.status ?? 'present',
          markedAt:       attendance?.markedAt ?? new Date().toISOString(),
          courseCode:     state.qrValidation?.courseCode ?? '—',
          courseName:     state.qrValidation?.courseName ?? '—',
          sessionId:      attendance?.sessionId ?? '',
          location:       state.qrValidation?.location ?? '—',
          faceConfidence: attendance?.faceConfidence,
        },
      });
    } catch (err: unknown) {
      submittingRef.current = false;
      const msg = getErrorMessage(err);

      // Detect duplicate
      if (msg.toLowerCase().includes('already marked') || msg.toLowerCase().includes('duplicate')) {
        dispatch({ type: 'DUPLICATE' });
        return;
      }

      // Detect wrong role — 403 means faculty/admin tried to mark attendance
      if (
        msg.toLowerCase().includes('permission') ||
        msg.toLowerCase().includes('forbidden') ||
        msg.toLowerCase().includes('attendance:mark_self')
      ) {
        dispatch({
          type: 'FAILED',
          check: 'unknown',
          message: 'Only students can mark attendance. Please log out and log in with a student account.',
        });
        return;
      }

      // Map error message to failed check
      let check: FailedCheck = 'unknown';
      if (msg.toLowerCase().includes('qr') || msg.toLowerCase().includes('token') || msg.toLowerCase().includes('session ended') || msg.toLowerCase().includes('session is not')) {
        check = 'qr';
      } else if (msg.toLowerCase().includes('face') || msg.toLowerCase().includes('verification') || msg.toLowerCase().includes('identity')) {
        check = 'face';
      } else if (
        msg.toLowerCase().includes('location') ||
        msg.toLowerCase().includes('geofence') ||
        msg.toLowerCase().includes('outside') ||
        msg.toLowerCase().includes('away') ||
        msg.toLowerCase().includes('within') ||
        msg.toLowerCase().includes('classroom') ||
        msg.toLowerCase().includes('distance')
      ) {
        check = 'location';
      } else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('connect') || msg.toLowerCase().includes('timeout')) {
        check = 'network';
      }

      dispatch({ type: 'FAILED', check, message: msg });
    }
  }, [state.qrToken, state.faceCapture, state.qrValidation]);

  const handleRetry = useCallback(() => {
    submittingRef.current = false;
    dispatch({ type: 'RETRY_STEP' });
  }, []);

  const handleReset = useCallback(() => {
    submittingRef.current = false;
    dispatch({ type: 'RESET' });
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  const showStepper = !['success', 'duplicate', 'failed'].includes(state.step);
  const showBack    = state.step === 'face' || state.step === 'location';

  // Show loading while checking enrollment
  if (!enrollmentChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Checking enrollment status…</p>
        </div>
      </div>
    );
  }

  // Block attendance if face not enrolled
  if (hasEnrollment === false) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto w-full max-w-md px-4 py-6 space-y-6">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-semibold text-foreground">Mark Attendance</h1>
              <p className="text-xs text-muted-foreground">3-factor verification required</p>
            </div>
          </div>
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 flex-shrink-0">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Face Not Enrolled</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  You must complete face enrollment before marking attendance.
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Face enrollment is required for identity verification during attendance. This is a one-time setup.
            </p>
            <Button
              className="w-full"
              size="lg"
              onClick={() => navigate('/student/face-enrollment')}
            >
              Go to Face Enrollment
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => navigate(-1)}
            >
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile-first container */}
      <div className="mx-auto w-full max-w-md px-4 py-6 space-y-6">

        {/* Page header */}
        <div className="flex items-center gap-3">
          {showBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (state.step === 'face')     dispatch({ type: 'RETRY_STEP' });
                if (state.step === 'location') dispatch({ type: 'FACE_CAPTURED', capture: state.faceCapture! });
              }}
              leftIcon={<ArrowLeft className="h-4 w-4" />}
              className="px-2"
              aria-label="Go back"
            />
          )}
          <div>
            <h1 className="text-lg font-semibold text-foreground">Mark Attendance</h1>
            <p className="text-xs text-muted-foreground">3-factor verification required</p>
          </div>
        </div>

        {/* Stepper */}
        {showStepper && (
          <div className="rounded-xl border border-border bg-card p-4">
            <FlowStepper currentStep={state.step} />
          </div>
        )}

        {/* Session validation card — shown after QR accepted */}
        {state.qrValidation?.valid && state.step !== 'qr' && state.step !== 'success' && state.step !== 'failed' && state.step !== 'duplicate' && (
          <SessionValidationCard validation={state.qrValidation} />
        )}

        {/* Step content */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          {state.step === 'qr' && (
            <QRScanStep
              onValidToken={handleQRAccepted}
              retryCount={state.qrRetries}
            />
          )}

          {state.step === 'face' && state.qrValidation && (
            <FaceCaptureStep
              sessionValidation={state.qrValidation}
              onCapture={handleFaceCaptured}
              retryCount={state.faceRetries}
            />
          )}

          {state.step === 'location' && state.qrValidation && state.faceCapture && (
            <LocationStepLeaflet
              sessionValidation={state.qrValidation}
              faceCapture={state.faceCapture}
              onLocationReady={handleLocationReady}
              retryCount={state.locationRetries}
            />
          )}

          {state.step === 'submitting' && (
            <SubmittingStep />
          )}

          {state.step === 'success' && state.receipt && (
            <AttendanceReceipt
              receipt={state.receipt}
              onMarkAnother={handleReset}
            />
          )}

          {state.step === 'duplicate' && (
            <DuplicateScreen
              courseCode={state.qrValidation?.courseCode}
              courseName={state.qrValidation?.courseName}
            />
          )}

          {state.step === 'failed' && state.failedCheck && (
            <FailureScreen
              failedCheck={state.failedCheck}
              message={state.failureMessage}
              onRetry={handleRetry}
              onRetryFromStart={handleReset}
              retryCount={
                state.failedCheck === 'qr'       ? state.qrRetries :
                state.failedCheck === 'face'     ? state.faceRetries :
                state.failedCheck === 'location' ? state.locationRetries : 0
              }
            />
          )}
        </div>

        {/* Step indicator text */}
        {showStepper && (
          <p className="text-center text-xs text-muted-foreground">
            {state.step === 'qr'       && 'Step 1 of 3 — Scan the QR code shown by your faculty'}
            {state.step === 'face'     && 'Step 2 of 3 — Verify your identity with face recognition'}
            {state.step === 'location' && 'Step 3 of 3 — Confirm you are within the classroom area'}
            {state.step === 'submitting' && 'Processing your attendance…'}
          </p>
        )}
      </div>
    </div>
  );
}
