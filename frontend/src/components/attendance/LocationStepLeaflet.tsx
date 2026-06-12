import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, ShieldAlert, CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import type { FaceCaptureResult, LocationResult, QRValidationResult } from './AttendanceFlowTypes';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LocationStepProps {
  sessionValidation: QRValidationResult;
  faceCapture: FaceCaptureResult;
  onLocationReady: (location: LocationResult) => void;
  retryCount: number;
}

type LocationState = 'idle' | 'requesting' | 'acquired' | 'denied' | 'timeout' | 'error';

interface SessionCoords {
  latitude: number;
  longitude: number;
  radius: number;
}

// Fix Leaflet default marker icon issue in webpack/vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Haversine formula — returns distance in metres
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function LocationStepLeaflet({ sessionValidation, faceCapture, onLocationReady, retryCount }: LocationStepProps) {
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState<number | null>(null);
  const [sessionCoords, setSessionCoords] = useState<SessionCoords | null>(null);
  const [coordsLoading, setCoordsLoading] = useState(true);
  const [coordsError, setCoordsError] = useState<string | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const studentMarkerRef = useRef<L.Marker | null>(null);
  const classroomMarkerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  // ── Fetch real session GPS coordinates ────────────────────────────────────
  useEffect(() => {
    const sessionId = sessionValidation.sessionId;

    // First try: use coords already embedded in the QR validation response
    if (
      sessionValidation.sessionLatitude != null &&
      sessionValidation.sessionLongitude != null
    ) {
      setSessionCoords({
        latitude:  sessionValidation.sessionLatitude,
        longitude: sessionValidation.sessionLongitude,
        radius:    sessionValidation.geofenceRadius ?? 100,
      });
      setCoordsLoading(false);
      return;
    }

    // Second try: fetch from session endpoint
    if (!sessionId || sessionId === 'pending') {
      setCoordsError('Session location not available');
      setCoordsLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await api.getSession(sessionId);
        const s = res.data?.session;
        if (s?.latitude != null && s?.longitude != null) {
          setSessionCoords({
            latitude:  parseFloat(s.latitude),
            longitude: parseFloat(s.longitude),
            radius:    s.geofence_radius ?? 100,
          });
        } else {
          setCoordsError('Session location not available — faculty did not set GPS coordinates');
        }
      } catch {
        setCoordsError('Could not load session location');
      } finally {
        setCoordsLoading(false);
      }
    })();
  }, [sessionValidation.sessionId, sessionValidation.sessionLatitude, sessionValidation.sessionLongitude, sessionValidation.geofenceRadius]);

  // ── Tick elapsed time while requesting ────────────────────────────────────
  useEffect(() => {
    if (locationState !== 'requesting') { setElapsed(0); return; }
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [locationState]);

  // ── Initialize Leaflet map once session coords are known ──────────────────
  useEffect(() => {
    if (coordsLoading || !mapRef.current || leafletMapRef.current) return;

    // Use session coords if available, otherwise a neutral default
    const centerLat = sessionCoords?.latitude ?? 0;
    const centerLng = sessionCoords?.longitude ?? 0;
    const radius    = sessionCoords?.radius ?? 100;

    const map = L.map(mapRef.current, {
      center: [centerLat, centerLng],
      zoom: sessionCoords ? 17 : 2,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    if (sessionCoords) {
      // Classroom marker (blue)
      const classroomIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:26px;height:26px;
          background:#3b82f6;border:3px solid white;border-radius:50%;
          box-shadow:0 2px 8px rgba(0,0,0,0.35);
        "></div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      classroomMarkerRef.current = L.marker([centerLat, centerLng], {
        icon: classroomIcon,
        title: 'Classroom Location',
      })
        .addTo(map)
        .bindPopup(`<b>Classroom</b><br>${sessionValidation.location ?? 'Session location'}`);

      // Geofence circle
      circleRef.current = L.circle([centerLat, centerLng], {
        radius,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.08,
        weight: 2,
      }).addTo(map);
    }

    leafletMapRef.current = map;

    return () => {
      map.remove();
      leafletMapRef.current = null;
    };
  }, [coordsLoading, sessionCoords, sessionValidation.location]);

  // ── Update student marker and distance when location acquired ─────────────
  useEffect(() => {
    if (!location || !leafletMapRef.current) return;

    const studentIcon = L.divIcon({
      className: '',
      html: `<div style="
        width:20px;height:20px;
        background:#10b981;border:3px solid white;border-radius:50%;
        box-shadow:0 2px 8px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    if (studentMarkerRef.current) {
      studentMarkerRef.current.setLatLng([location.latitude, location.longitude]);
    } else {
      studentMarkerRef.current = L.marker([location.latitude, location.longitude], {
        icon: studentIcon,
        title: 'Your Location',
      })
        .addTo(leafletMapRef.current)
        .bindPopup('<b>Your Location</b>');
    }

    // Fit bounds to show both markers
    if (sessionCoords) {
      const dist = haversineDistance(
        location.latitude, location.longitude,
        sessionCoords.latitude, sessionCoords.longitude,
      );
      setDistance(Math.round(dist));

      const bounds = L.latLngBounds([
        [sessionCoords.latitude, sessionCoords.longitude],
        [location.latitude, location.longitude],
      ]);
      leafletMapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
    }
  }, [location, sessionCoords]);

  // ── Request geolocation ───────────────────────────────────────────────────
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

  const geofenceRadius = sessionCoords?.radius ?? 100;
  const isInsideGeofence = distance !== null && distance <= geofenceRadius;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold text-foreground">Location Verification</h2>
        <p className="text-sm text-muted-foreground">
          We need to confirm you are within {geofenceRadius}m of the classroom
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

      {/* Session location status */}
      {coordsLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading session location…</span>
        </div>
      )}

      {!coordsLoading && coordsError && (
        <div className="flex items-start gap-2 rounded-lg bg-warning/10 border border-warning/30 p-3 text-sm text-warning">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{coordsError}</span>
        </div>
      )}

      {/* Leaflet Map */}
      {!coordsLoading && (
        <div className="rounded-xl overflow-hidden border border-border bg-card shadow-sm">
          <div
            ref={mapRef}
            className="w-full h-64 relative"
            style={{ minHeight: '256px' }}
          />
          <div className="p-3 bg-muted/30 text-xs space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              {sessionCoords && (
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-primary border border-white" />
                  <span className="text-muted-foreground">Classroom</span>
                </div>
              )}
              {location && (
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-success border border-white" />
                  <span className="text-muted-foreground">Your Location</span>
                </div>
              )}
              {sessionCoords && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-muted-foreground">{geofenceRadius}m radius</span>
                </div>
              )}
            </div>

            {/* Distance indicator */}
            {distance !== null && (
              <div className={cn(
                'text-xs font-medium px-2 py-1 rounded',
                isInsideGeofence
                  ? 'bg-success/10 text-success'
                  : 'bg-destructive/10 text-destructive',
              )}>
                {isInsideGeofence
                  ? `✓ Inside allowed location — ${distance}m from classroom`
                  : `✗ Outside allowed location — ${distance}m away (max ${geofenceRadius}m)`}
              </div>
            )}

            {/* No GPS on session */}
            {!sessionCoords && !coordsLoading && (
              <div className="text-xs text-warning px-2 py-1 rounded bg-warning/10">
                ⚠ Session location not available — geofence check will be skipped
              </div>
            )}
          </div>
        </div>
      )}

      {/* Location status card */}
      <div className={cn(
        'rounded-xl border p-4 space-y-3 transition-colors duration-300',
        locationState === 'acquired' ? 'border-success/30 bg-success/5' : 'border-border bg-card',
      )}>
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

        {location && (
          <div className="text-xs text-muted-foreground bg-background/80 rounded px-2 py-1">
            GPS Accuracy: ±{Math.round(location.accuracy)}m
          </div>
        )}
      </div>

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
          <Button
            className="w-full"
            size="lg"
            onClick={requestLocation}
            disabled={coordsLoading}
            leftIcon={<Navigation className="h-4 w-4" />}
          >
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
        <span>
          Your location is verified using free OpenStreetMap. No Google APIs or tracking.
          Location is only used to confirm you are within {geofenceRadius}m of the classroom.
        </span>
      </div>
    </div>
  );
}
