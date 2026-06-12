import { useState, useEffect } from 'react';
import { MapPin, Navigation, ShieldAlert, CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import type { FaceCaptureResult, LocationResult, QRValidationResult } from './AttendanceFlowTypes';

interface LocationStepProps {
  sessionValidation: QRValidationResult;
  faceCapture: FaceCaptureResult;
  onLocationReady: (location: LocationResult) => void;
  retryCount: number;
}

type LocationState = 'idle' | 'requesting' | 'acquired' | 'denied' | 'timeout' | 'error';

export function LocationStep({ sessionValidation, faceCapture, onLocationReady, retryCount }: LocationStepProps) {
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Tick elapsed time while requesting
  useEffect(() => {
    if (locationState !== 'requesting') { setElapsed(0); return; }
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [locationState]);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationState('error');
      setErrorMsg('Your browser does not support location services.');
      return;
    }

    setLocationState('requesting');
    setErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const result: LocationResult = {
          latitude:  pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy:  pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        setLocation(result);
        setLocationState('acquired');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocationState('denied');
          setErrorMsg('Location permission was denied. Please enable it in your browser settings.');
        } else if (err.code === err.TIMEOUT) {
          setLocationState('timeout');
          setErrorMsg('Location request timed out. Move to an area with better GPS signal.');
        } else {
          setLocationState('error');
          setErrorMsg('Could not determine your location. Please try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  };

  const proceed = () => {
    if (location) onLocationReady(location);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold text-foreground">Location Verification</h2>
        <p className="text-sm text-muted-foreground">
          We need to confirm you are within the classroom area
        </p>
      </div>

      {/* Retry notice */}
      {retryCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-warning/10 border border-warning/30 p-3 text-sm text-warning">
          <RefreshCw className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>Attempt {retryCount + 1} — move closer to the classroom and try again.</span>
        </div>
      )}

      {/* Captured face thumbnail */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <img
          src={faceCapture.imageDataUrl}
          alt="Your captured photo"
          className="h-12 w-12 rounded-full object-cover border-2 border-success/50 flex-shrink-0"
        />
        <div>
          <p className="text-sm font-medium text-foreground">Face captured</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-success" />
            Ready for verification
          </p>
        </div>
      </div>

      {/* Geofence map card */}
      <GeofenceCard
        sessionValidation={sessionValidation}
        locationState={locationState}
        location={location}
        elapsed={elapsed}
      />

      {/* Error */}
      {errorMsg && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive animate-fade-in">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Location unavailable</p>
            <p className="text-xs mt-0.5 opacity-80">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Permission denied help */}
      {locationState === 'denied' && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
          <p className="font-medium text-foreground">How to enable location</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
            <li>Click the lock icon in your browser address bar</li>
            <li>Find "Location" and set it to "Allow"</li>
            <li>Refresh the page and try again</li>
          </ol>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {locationState === 'idle' && (
          <Button className="w-full" size="lg" onClick={requestLocation} leftIcon={<Navigation className="h-4 w-4" />}>
            Allow Location Access
          </Button>
        )}

        {locationState === 'requesting' && (
          <Button className="w-full" size="lg" disabled leftIcon={<Loader2 className="h-4 w-4 animate-spin" />}>
            Getting location… {elapsed > 0 && `(${elapsed}s)`}
          </Button>
        )}

        {locationState === 'acquired' && (
          <Button className="w-full" size="lg" onClick={proceed} leftIcon={<CheckCircle2 className="h-4 w-4" />}>
            Confirm & Submit Attendance
          </Button>
        )}

        {(locationState === 'denied' || locationState === 'timeout' || locationState === 'error') && (
          <Button variant="outline" className="w-full" onClick={requestLocation} leftIcon={<RefreshCw className="h-4 w-4" />}>
            Try Again
          </Button>
        )}
      </div>

      {/* Privacy note */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldAlert className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span>Your location is only used to verify you are within the classroom area and is not stored or tracked continuously.</span>
      </div>
    </div>
  );
}

// ── Geofence status card ──────────────────────────────────────────────────────

interface GeofenceCardProps {
  sessionValidation: QRValidationResult;
  locationState: LocationState;
  location: LocationResult | null;
  elapsed: number;
}

function GeofenceCard({ sessionValidation, locationState, location }: GeofenceCardProps) {
  return (
    <div className={cn(
      'rounded-xl border p-4 space-y-3 transition-colors duration-300',
      locationState === 'acquired' ? 'border-success/30 bg-success/5' : 'border-border bg-card',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
            locationState === 'acquired'   ? 'bg-success/20' :
            locationState === 'requesting' ? 'bg-primary/10' : 'bg-muted',
          )}>
            {locationState === 'requesting' ? (
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
            ) : locationState === 'acquired' ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <MapPin className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {locationState === 'acquired'   ? 'Location Confirmed' :
               locationState === 'requesting' ? 'Locating…' : 'Location Required'}
            </p>
            <p className="text-xs text-muted-foreground">{sessionValidation.location ?? 'Classroom area'}</p>
          </div>
        </div>
      </div>

      {/* Visual geofence indicator */}
      <div className="relative h-24 rounded-lg bg-muted/50 overflow-hidden flex items-center justify-center">
        {/* Concentric rings */}
        {[64, 48, 32].map((size, i) => (
          <div
            key={i}
            className={cn(
              'absolute rounded-full border transition-colors duration-500',
              locationState === 'acquired' ? 'border-success/40' : 'border-primary/20',
            )}
            style={{ width: size, height: size }}
          />
        ))}

        {/* Center pin */}
        <div className={cn(
          'relative z-10 flex h-6 w-6 items-center justify-center rounded-full shadow-md transition-colors',
          locationState === 'acquired' ? 'bg-success' : 'bg-primary',
        )}>
          <MapPin className="h-3.5 w-3.5 text-white" />
        </div>

        {/* Pulse animation when requesting */}
        {locationState === 'requesting' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-16 w-16 rounded-full border-2 border-primary/30 animate-ping" />
          </div>
        )}

        {/* Accuracy label */}
        {location && (
          <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 rounded px-1.5 py-0.5">
            ±{Math.round(location.accuracy)}m accuracy
          </div>
        )}
      </div>

      {/* Coordinates */}
      {location && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-muted/50 px-2 py-1.5">
            <p className="text-muted-foreground">Latitude</p>
            <p className="font-mono font-medium">{location.latitude.toFixed(5)}</p>
          </div>
          <div className="rounded-md bg-muted/50 px-2 py-1.5">
            <p className="text-muted-foreground">Longitude</p>
            <p className="font-mono font-medium">{location.longitude.toFixed(5)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
