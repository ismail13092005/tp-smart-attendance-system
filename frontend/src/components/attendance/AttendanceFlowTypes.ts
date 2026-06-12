// ── Attendance flow state machine types ──────────────────────────────────────

export type FlowStep =
  | 'qr'          // Step 1 – scan / enter QR token
  | 'face'        // Step 2 – camera capture + verification
  | 'location'    // Step 3 – geofence check
  | 'submitting'  // All 3 collected, sending to API
  | 'success'     // Attendance marked
  | 'duplicate'   // Already marked for this session
  | 'failed';     // One or more checks failed

export type FailedCheck = 'qr' | 'face' | 'location' | 'network' | 'unknown';

export interface QRValidationResult {
  valid: boolean;
  sessionId?: string;
  courseCode?: string;
  courseName?: string;
  facultyName?: string;
  location?: string;
  expiresAt?: string;
  reason?: string;
  /** GPS coordinates of the classroom — returned by validate-qr */
  sessionLatitude?: number | null;
  sessionLongitude?: number | null;
  geofenceRadius?: number;
}

export interface FaceCaptureResult {
  imageFile: File;
  imageDataUrl: string;
}

export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface AttendanceReceipt {
  id: string;
  status: 'present' | 'late';
  markedAt: string;
  courseCode: string;
  courseName: string;
  sessionId: string;
  location: string;
  faceConfidence?: number;
}

export interface FlowState {
  step: FlowStep;
  // Collected data
  qrToken: string | null;
  qrValidation: QRValidationResult | null;
  faceCapture: FaceCaptureResult | null;
  locationResult: LocationResult | null;
  // Outcomes
  receipt: AttendanceReceipt | null;
  failedCheck: FailedCheck | null;
  failureMessage: string | null;
  // Retry tracking
  qrRetries: number;
  faceRetries: number;
  locationRetries: number;
}

export const INITIAL_FLOW_STATE: FlowState = {
  step: 'qr',
  qrToken: null,
  qrValidation: null,
  faceCapture: null,
  locationResult: null,
  receipt: null,
  failedCheck: null,
  failureMessage: null,
  qrRetries: 0,
  faceRetries: 0,
  locationRetries: 0,
};

// User-friendly failure messages — never expose internals
export const FAILURE_MESSAGES: Record<FailedCheck, { title: string; body: string; canRetry: boolean }> = {
  qr: {
    title: 'QR Code Not Accepted',
    body: 'The QR code could not be verified. It may have expired or already been used. Ask your faculty to refresh the QR code.',
    canRetry: true,
  },
  face: {
    title: 'Face Verification Unsuccessful',
    body: 'We could not verify your identity. Ensure you are in good lighting, remove glasses if possible, and look directly at the camera.',
    canRetry: true,
  },
  location: {
    title: 'Location Check Failed',
    body: 'You appear to be outside the allowed area for this class. Move closer to the classroom and try again.',
    canRetry: true,
  },
  network: {
    title: 'Connection Problem',
    body: 'Could not reach the server. Check your internet connection and try again.',
    canRetry: true,
  },
  unknown: {
    title: 'Something Went Wrong',
    body: 'An unexpected error occurred. Please try again. If the problem persists, contact your faculty for a manual override.',
    canRetry: true,
  },
};
