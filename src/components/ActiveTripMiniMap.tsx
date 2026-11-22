import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AdvancedMarker,
  Map as GoogleMap,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { MapPin, Navigation } from 'lucide-react';
import { reportMapsErrorForQuota, useGoogleMapsSdk } from '../context/GoogleMapsSdkContext';
import type { DriverTripPhase, GeoPoint, VehicleTier } from '../types/aurelia';
import { computeStaticRoutePreviewGeometry } from '../utils/aureliaLogic';

interface ActiveTripMiniMapProps {
  pickupLatLng: GeoPoint;
  dropoffLatLng: GeoPoint;
  pickupLabel: string;
  dropoffLabel: string;
  vehicleTier: VehicleTier;
  isEmergencyOrCare: boolean;
  distanceKm: number;
  durationMins: number;
  phase: DriverTripPhase;
}

function MiniMapRouteOverlay({
  origin,
  destination,
  routeColor,
  travelMode,
  onRouteMetricResolved,
}: {
  origin: GeoPoint;
  destination: GeoPoint;
  routeColor: string;
  travelMode: 'TWO_WHEELER' | 'DRIVING';
  onRouteMetricResolved?: (km: number, mins: number) => void;
}) {
  const map = useMap('active-trip-mini-map');
  const routesLib = useMapsLibrary('routes');
  const onMetricRef = useRef(onRouteMetricResolved);
  onMetricRef.current = onRouteMetricResolved;

  const origLat = origin.lat;
  const origLng = origin.lng;
  const destLat = destination.lat;
  const destLng = destination.lng;

  useEffect(() => {
    if (!map) return;

    const origPoint: GeoPoint = { lat: origLat, lng: origLng };
    const destPoint: GeoPoint = { lat: destLat, lng: destLng };
    let cancelled = false;
    let activePolylines: google.maps.Polyline[] = [];

    const fitFallbackBounds = () => {
      if (typeof google === 'undefined' || !google.maps?.LatLngBounds) return;
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(origPoint);
      bounds.extend(destPoint);
      map.fitBounds(bounds, { top: 28, right: 28, bottom: 28, left: 28 });
    };

    const drawDirectFallbackPolyline = () => {
      if (typeof google === 'undefined' || !google.maps?.Polyline) {
        fitFallbackBounds();
        return;
      }
      const line = new google.maps.Polyline({
        path: [origPoint, destPoint],
        geodesic: true,
        strokeColor: routeColor,
        strokeOpacity: 0.85,
        strokeWeight: 4,
        map,
      });
      activePolylines.push(line);
      fitFallbackBounds();
    };

    if (!routesLib) {
      fitFallbackBounds();
      return () => {
        cancelled = true;
        for (const poly of activePolylines) poly.setMap(null);
      };
    }

    routesLib.Route.computeRoutes({
      origin: origPoint,
      destination: destPoint,
      travelMode,
      fields: ['path', 'viewport', 'distanceMeters', 'durationMillis'],
      region: 'IN',
      language: 'en',
      internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
    })
      .then((res) => {
        if (cancelled) return;
        const route = res.routes?.[0];
        if (!route) {
          drawDirectFallbackPolyline();
          return;
        }

        const polylines = route.createPolylines({
          polylineOptions: {
            strokeColor: routeColor,
            strokeOpacity: 0.94,
            strokeWeight: 4,
          },
        });
        for (const poly of polylines) {
          poly.setMap(map);
        }
        activePolylines = polylines;

        if (route.viewport) {
          map.fitBounds(route.viewport, { top: 28, right: 28, bottom: 28, left: 28 });
        } else {
          fitFallbackBounds();
        }

        if (
          onMetricRef.current &&
          typeof route.distanceMeters === 'number' &&
          typeof route.durationMillis === 'number'
        ) {
          const km = Math.max(0.5, Math.round((route.distanceMeters / 1000) * 10) / 10);
          const mins = Math.max(2, Math.round(route.durationMillis / 60000));
          onMetricRef.current(km, mins);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        reportMapsErrorForQuota(err);
        drawDirectFallbackPolyline();
      });

    return () => {
      cancelled = true;
      for (const poly of activePolylines) {
        poly.setMap(null);
      }
    };
  }, [map, routesLib, origLat, origLng, destLat, destLng, routeColor, travelMode]);

  return null;
}

export function ActiveTripMiniMap({
  pickupLatLng,
  dropoffLatLng,
  pickupLabel,
  dropoffLabel,
  vehicleTier,
  isEmergencyOrCare,
  distanceKm,
  durationMins,
  phase,
}: ActiveTripMiniMapProps) {
  const { hasApiKey, isFailed } = useGoogleMapsSdk();
  const [resolvedMetrics, setResolvedMetrics] = useState<{ km: number; mins: number } | null>(null);

  useEffect(() => {
    setResolvedMetrics(null);
  }, [pickupLatLng.lat, pickupLatLng.lng, dropoffLatLng.lat, dropoffLatLng.lng]);

  const geometry = useMemo(
    () => computeStaticRoutePreviewGeometry(pickupLatLng, dropoffLatLng),
    [pickupLatLng, dropoffLatLng]
  );

  const canRenderGoogleMap = hasApiKey && !isFailed;
  const routeColor = isEmergencyOrCare ? '#10B981' : '#D4AF63';
  const travelMode: 'TWO_WHEELER' | 'DRIVING' = vehicleTier === 'bike' ? 'TWO_WHEELER' : 'DRIVING';
  const displayKm = resolvedMetrics?.km ?? distanceKm;
  const displayMins = resolvedMetrics?.mins ?? durationMins;

  const phaseTag =
    phase === 'completed'
      ? 'Completed'
      : phase === 'in_trip'
        ? 'In Transit'
        : phase === 'arrived_pickup'
          ? 'At Pickup'
          : 'To Pickup';

  // Curved midpoint for fallback SVG corridor arc
  const midX = (geometry.pickupSvg.x + geometry.dropoffSvg.x) / 2;
  const midY = (geometry.pickupSvg.y + geometry.dropoffSvg.y) / 2 - 12;

  return (
    <div
      data-testid="active-trip-mini-map"
      aria-label={`Static route map from ${pickupLabel} to ${dropoffLabel}`}
      className="rounded-2xl overflow-hidden border border-stone-200/90 dark:border-white/10 bg-stone-50 dark:bg-[#080A0F] shadow-sm"
    >
      {/* Top Unobscured Telemetry Header */}
      <div className="px-3 py-1.5 bg-stone-50 dark:bg-[#07080B] border-b border-stone-200/80 dark:border-white/10 flex items-center justify-between gap-2 text-[11px]">
        <span className="font-semibold text-[#9A722A] dark:text-[#E6C77E] flex items-center gap-1.5 min-w-0 truncate">
          <Navigation className="w-3 h-3 shrink-0" />
          <span className="truncate">
            {canRenderGoogleMap ? 'Static Route Map · Google Maps' : 'Route Corridor Preview'}
          </span>
        </span>
        <span
          data-testid="active-trip-mini-map-metrics"
          className="font-mono-tabular font-bold text-stone-800 dark:text-stone-100 shrink-0"
        >
          {displayKm} km · {displayMins} min · {phaseTag}
        </span>
      </div>

      {/* Fixed-Height Static Map Viewport */}
      <div className="relative w-full h-36 sm:h-40 bg-stone-900 overflow-hidden select-none">
        {canRenderGoogleMap ? (
          <GoogleMap
            id="active-trip-mini-map"
            mapId="DEMO_MAP_ID"
            defaultCenter={geometry.center}
            defaultZoom={geometry.zoom}
            gestureHandling="none"
            disableDefaultUI={true}
            keyboardShortcuts={false}
            clickableIcons={false}
            zoomControl={false}
            mapTypeControl={false}
            streetViewControl={false}
            fullscreenControl={false}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
          >
            <MiniMapRouteOverlay
              origin={pickupLatLng}
              destination={dropoffLatLng}
              routeColor={routeColor}
              travelMode={travelMode}
              onRouteMetricResolved={(km, mins) => setResolvedMetrics({ km, mins })}
            />

            <AdvancedMarker position={pickupLatLng} title={`Pickup: ${pickupLabel}`}>
              <Pin background="#D4AF63" borderColor="#111318" glyphColor="#111318" scale={0.85} />
            </AdvancedMarker>

            <AdvancedMarker position={dropoffLatLng} title={`Drop-off: ${dropoffLabel}`}>
              <Pin background="#10B981" borderColor="#064E3B" glyphColor="#FFFFFF" scale={0.85} />
            </AdvancedMarker>
          </GoogleMap>
        ) : (
          <div className="w-full h-full relative bg-[radial-gradient(circle_at_25%_20%,rgba(212,175,99,0.16),transparent_55%),linear-gradient(145deg,#0B0E14,#121824)]">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="w-full h-full"
              aria-hidden="true"
            >
              {[25, 50, 75].map((pos) => (
                <g key={pos} opacity="0.16">
                  <line x1={pos} y1="0" x2={pos} y2="100" stroke="#E6C77E" strokeWidth="0.35" strokeDasharray="1.5 1.5" />
                  <line x1="0" y1={pos} x2="100" y2={pos} stroke="#E6C77E" strokeWidth="0.35" strokeDasharray="1.5 1.5" />
                </g>
              ))}
              <path
                d={`M ${geometry.pickupSvg.x} ${geometry.pickupSvg.y} Q ${midX} ${Math.max(10, midY)} ${geometry.dropoffSvg.x} ${geometry.dropoffSvg.y}`}
                fill="none"
                stroke={routeColor}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeDasharray={phase === 'en_route_pickup' ? '3 2' : undefined}
              />
              <circle
                cx={geometry.pickupSvg.x}
                cy={geometry.pickupSvg.y}
                r="4.2"
                fill="#D4AF63"
                stroke="#111318"
                strokeWidth="1.1"
              />
              <circle
                cx={geometry.dropoffSvg.x}
                cy={geometry.dropoffSvg.y}
                r="4.2"
                fill="#10B981"
                stroke="#064E3B"
                strokeWidth="1.1"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Compact Endpoint Legend Footer */}
      <div className="px-3 py-2 bg-stone-50 dark:bg-[#07080B] border-t border-stone-200/80 dark:border-white/10 grid grid-cols-2 gap-2 text-[11px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-2 h-2 rounded-full bg-[#D4AF63] shrink-0" aria-hidden="true" />
          <MapPin className="w-3 h-3 text-[#B48A3E] dark:text-[#E6C77E] shrink-0" />
          <span className="truncate font-medium text-stone-700 dark:text-stone-200" title={pickupLabel}>
            {pickupLabel}
          </span>
        </div>
        <div className="flex items-center justify-end gap-1.5 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
          <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="truncate font-medium text-stone-700 dark:text-stone-200" title={dropoffLabel}>
            {dropoffLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
