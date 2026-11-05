export interface PositionFix {
  lat: number;
  lng: number;
  accuracy: number;
  /** Degrees clockwise from north; null when the device is not moving. */
  heading: number | null;
}

/**
 * Watches the device's GNSS position and derives a direction-of-travel heading.
 * Returns a stop function.
 */
export function startPositioning(
  onFix: (fix: PositionFix) => void,
  onError?: (error: GeolocationPositionError) => void,
): () => void {
  let last: { lat: number; lng: number } | null = null;

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude: lat, longitude: lng, accuracy, speed, heading } = pos.coords;
      let headingDeg: number | null = null;

      if (heading != null && (speed == null || speed > 0.5)) {
        headingDeg = heading;
      } else if (last) {
        const dLat = lat - last.lat;
        const dLng = lng - last.lng;
        const distanceM = Math.hypot(dLat, dLng) * 111_000; // rough metres at this latitude
        if (distanceM > 5) {
          headingDeg = ((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360;
        }
      }

      last = { lat, lng };
      onFix({ lat, lng, accuracy, heading: headingDeg });
    },
    (error) => onError?.(error),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
  );

  return () => navigator.geolocation.clearWatch(watchId);
}
