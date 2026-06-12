import { getDistance } from 'geolib';
import { Coordinates } from '../../shared/types';
import { NotFoundError, ValidationError } from '../../shared/errors';
import logger from '../../shared/logger';
import pool from '../../database/pool';
import config from '../../config';

export class GeofenceService {
  /**
   * Verify if student location is within the session's configured geofence radius.
   * Uses the session's geofence_radius_m column; falls back to GEOFENCE_RADIUS_METERS env var.
   */
  async verifyLocation(
    sessionId: string,
    studentLocation: Coordinates,
  ): Promise<{
    withinGeofence: boolean;
    distance: number;
    allowedRadius: number;
    reason?: string;
  }> {
    const { rows } = await pool.query(
      `SELECT
         ST_X(location_point::geometry) AS longitude,
         ST_Y(location_point::geometry) AS latitude,
         geofence_radius_m
       FROM faculty_sessions
       WHERE id = $1 AND deleted_at IS NULL`,
      [sessionId],
    );

    if (!rows[0]) throw new NotFoundError('Session not found');

    const { latitude: sessionLat, longitude: sessionLng, geofence_radius_m } = rows[0];

    // Use session-specific radius, fall back to global config
    const allowedRadius: number = geofence_radius_m ?? config.geofence.radiusMeters;

    if (sessionLat == null || sessionLng == null) {
      logger.warn(`Session ${sessionId} has no location coordinates set — skipping geofence check`);
      // If faculty didn't share location, skip geofence check
      return { withinGeofence: true, distance: 0, allowedRadius };
    }

    if (!this.isValidCoordinates(studentLocation)) {
      throw new ValidationError('Invalid location coordinates');
    }

    const distance = getDistance(
      { latitude: studentLocation.latitude, longitude: studentLocation.longitude },
      { latitude: sessionLat, longitude: sessionLng },
    );

    const withinGeofence = distance <= allowedRadius;

    logger.info(
      `Geofence check for session ${sessionId}: ${withinGeofence} (distance: ${distance}m, allowed: ${allowedRadius}m)`,
    );

    return {
      withinGeofence,
      distance,
      allowedRadius,
      reason: withinGeofence ? undefined : `You are ${distance}m away. Must be within ${allowedRadius}m of the classroom.`,
    };
  }

  private isValidCoordinates(coords: Coordinates): boolean {
    if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') return false;
    if (coords.latitude < -90 || coords.latitude > 90) return false;
    if (coords.longitude < -180 || coords.longitude > 180) return false;
    if (coords.latitude === 0 && coords.longitude === 0) return false;
    return true;
  }

  /** Utility: calculate distance in metres between two coordinate pairs */
  calculateDistance(coords1: Coordinates, coords2: Coordinates): number {
    return getDistance(
      { latitude: coords1.latitude, longitude: coords1.longitude },
      { latitude: coords2.latitude, longitude: coords2.longitude },
    );
  }
}

