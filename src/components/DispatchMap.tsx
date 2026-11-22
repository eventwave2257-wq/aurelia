import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AdvancedMarker,
  Map as GoogleMap,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  ChevronDown,
  ChevronUp,
  Crosshair,
  Flame,
  Hospital,
  MapPin,
  Navigation,
} from 'lucide-react';
import {
  HIGH_EARNING_ZONES,
  KARNATAKA_31_DISTRICTS,
  KARNATAKA_CENTER,
  KARNATAKA_LANDMARKS,
} from '../data/karnatakaDistricts';
import { reportMapsErrorForQuota, useGoogleMapsSdk } from '../context/GoogleMapsSdkContext';
import type {
  CareAppointment,
  DriverTripPhase,
  GeoPoint,
  HighEarningZone,
  KarnatakaDistrict,
  PlannedRouteSummary,
  RideOffer,
} from '../types/aurelia';

interface DispatchMapProps {
  phase: DriverTripPhase;
  activeOffer: RideOffer | null;
  plannedRoute: PlannedRouteSummary | null;
  plannedRouteObj: google.maps.routes.Route | null;
  careAppointments: CareAppointment[];
  selectedDistrictId: string;
  onSelectDistrict: (district: KarnatakaDistrict) => void;
  onSelectCarePin?: (appointmentId: string) => void;
}

const DARK_GOLD_FALLBACK_STYLE =
  'linear-gradient(145deg, rgba(11,13,18,0.96), rgba(17,22,30,0.96))';

function GoogleMapCameraAndRoute({
  district,
  origin,
  destination,
  routeColor,
  precomputedRouteObj,
  travelMode,
  recenterTick,
}: {
  district: KarnatakaDistrict;
  origin: GeoPoint | null;
  destination: GeoPoint | null;
  routeColor: string;
  precomputedRouteObj: google.maps.routes.Route | null;
  travelMode: 'TWO_WHEELER' | 'DRIVING';
  recenterTick: number;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');

  // Pan & zoom smoothly when district selection changes (if no active route bounds override)
  useEffect(() => {
    if (!map) return;
    if (origin && destination && recenterTick === 0) return;
    map.panTo({ lat: district.lat, lng: district.lng });
    map.setZoom(11);
  }, [map, district, origin, destination, recenterTick]);

  const originLat = origin?.lat ?? null;
  const originLng = origin?.lng ?? null;
  const dropLat = destination?.lat ?? null;
  const dropLng = destination?.lng ?? null;

  // Draw polyline and fit map bounds when origin & destination exist
  useEffect(() => {
    if (!map || originLat === null || originLng === null || dropLat === null || dropLng === null)
      return;
    const origPoint = { lat: originLat, lng: originLng };
    const destPoint = { lat: dropLat, lng: dropLng };
    let cancelled = false;
    let activePolylines: google.maps.Polyline[] = [];

    const attachPolylines = (route: google.maps.routes.Route) => {
      if (cancelled) return;
      activePolylines = route.createPolylines({
        polylineOptions: {
          strokeColor: routeColor,
          strokeOpacity: 0.92,
          strokeWeight: 5,
        },
      });
      for (const poly of activePolylines) {
        poly.setMap(map);
      }
      if (route.viewport) {
        map.fitBounds(route.viewport, { top: 64, right: 48, bottom: 72, left: 48 });
      }
    };

    if (precomputedRouteObj) {
      attachPolylines(precomputedRouteObj);
    } else if (routesLib) {
      routesLib.Route.computeRoutes({
        origin: origPoint,
        destination: destPoint,
        travelMode,
        fields: ['distanceMeters', 'durationMillis', 'path', 'viewport'],
        region: 'IN',
        language: 'en',
        internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
      })
        .then((res) => {
          const r = res.routes?.[0];
          if (r) {
            attachPolylines(r);
          } else {
            const bounds = new google.maps.LatLngBounds();
            bounds.extend(origPoint);
            bounds.extend(destPoint);
            map.fitBounds(bounds, { top: 64, right: 48, bottom: 72, left: 48 });
          }
        })
        .catch((err) => {
          reportMapsErrorForQuota(err);
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(origPoint);
          bounds.extend(destPoint);
          map.fitBounds(bounds, { top: 64, right: 48, bottom: 72, left: 48 });
        });
    }

    return () => {
      cancelled = true;
      for (const poly of activePolylines) {
        poly.setMap(null);
      }
    };
  }, [map, routesLib, originLat, originLng, dropLat, dropLng, routeColor, precomputedRouteObj, travelMode]);

  return null;
}

function GoogleMapHighEarningZones({
  zones,
  visible,
  selectedZoneId,
  onSelectZone,
}: {
  zones: HighEarningZone[];
  visible: boolean;
  selectedZoneId: string | null;
  onSelectZone: (zone: HighEarningZone) => void;
}) {
  const map = useMap();
  const onSelectZoneRef = useRef(onSelectZone);
  onSelectZoneRef.current = onSelectZone;

  useEffect(() => {
    if (!map || !visible || typeof google === 'undefined' || !google.maps?.Circle) {
      return;
    }

    const circles = zones.map((zone) => {
      const isSelected = zone.id === selectedZoneId;
      const circle = new google.maps.Circle({
        map,
        center: { lat: zone.lat, lng: zone.lng },
        radius: zone.radiusMeters,
        fillColor: '#F97316',
        fillOpacity: isSelected ? 0.36 : 0.24,
        strokeColor: '#EA580C',
        strokeOpacity: 0.92,
        strokeWeight: isSelected ? 3 : 2,
        clickable: true,
      });
      circle.addListener('click', () => {
        map.panTo({ lat: zone.lat, lng: zone.lng });
        map.setZoom(12);
        onSelectZoneRef.current(zone);
      });
      return circle;
    });

    return () => {
      for (const c of circles) {
        c.setMap(null);
      }
    };
  }, [map, zones, visible, selectedZoneId]);

  if (!visible) return null;

  return (
    <>
      {zones.map((zone) => (
        <AdvancedMarker
          key={zone.id}
          position={{ lat: zone.lat, lng: zone.lng }}
          title={`High Earning Area: ${zone.name} (${zone.orderFrequencyLabel})`}
          onClick={() => onSelectZoneRef.current(zone)}
        >
          <Pin background="#F97316" borderColor="#9A3412" glyphColor="#FFFFFF" />
        </AdvancedMarker>
      ))}
    </>
  );
}

export function DispatchMap({
  phase,
  activeOffer,
  plannedRoute,
  plannedRouteObj,
  careAppointments,
  selectedDistrictId,
  onSelectDistrict,
  onSelectCarePin,
}: DispatchMapProps) {
  const { hasApiKey, isFailed } = useGoogleMapsSdk();
  const [showHospitalPins, setShowHospitalPins] = useState<boolean>(true);
  const [showHighEarningZones, setShowHighEarningZones] = useState<boolean>(true);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(
    HIGH_EARNING_ZONES[0]?.id ?? null
  );
  const [showAllDistricts, setShowAllDistricts] = useState<boolean>(false);
  const [recenterTick, setRecenterTick] = useState<number>(0);

  const selectedDistrict = useMemo(
    () =>
      KARNATAKA_31_DISTRICTS.find((d) => d.id === selectedDistrictId) ??
      KARNATAKA_31_DISTRICTS.find((d) => d.id === 'bengaluru-urban') ??
      KARNATAKA_31_DISTRICTS[0],
    [selectedDistrictId]
  );

  const selectedZone = useMemo(
    () => HIGH_EARNING_ZONES.find((z) => z.id === selectedZoneId) ?? HIGH_EARNING_ZONES[0],
    [selectedZoneId]
  );

  const originLatLng: GeoPoint | null =
    activeOffer?.pickupLatLng ?? plannedRoute?.pickup.location ?? null;
  const dropLatLng: GeoPoint | null =
    activeOffer?.dropoffLatLng ?? plannedRoute?.dropoff.location ?? null;

  const isEmergencyOrCare =
    Boolean(activeOffer?.isEmergencyHospitalVisit) ||
    Boolean(plannedRoute?.isEmergencyHospitalVisit) ||
    (activeOffer ? activeOffer.category !== 'standard' : false);
  const routeStroke = isEmergencyOrCare ? '#10B981' : '#E6C77E';
  const travelMode: 'TWO_WHEELER' | 'DRIVING' =
    (activeOffer?.vehicleTier ?? plannedRoute?.vehicleTier) === 'bike'
      ? 'TWO_WHEELER'
      : 'DRIVING';

  const canRenderGoogleMap = hasApiKey && !isFailed;

  const hospitals = useMemo(
    () => KARNATAKA_LANDMARKS.filter((lm) => lm.kind === 'hospital'),
    []
  );

  const handleSelectZone = (zone: HighEarningZone) => {
    setSelectedZoneId(zone.id);
    const matchingDistrict = KARNATAKA_31_DISTRICTS.find((d) => d.id === zone.districtId);
    if (matchingDistrict) {
      onSelectDistrict(matchingDistrict);
    }
  };

  return (
    <div className="space-y-3">
      {/* Main Google Map Viewport Container (Explicit Height Prevents 0x0 Collapse) */}
      <div
        data-testid="dispatch-map"
        className="relative w-full h-[360px] sm:h-[380px] lg:h-[460px] rounded-3xl overflow-hidden border border-stone-200/80 dark:border-white/10 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.45)] bg-stone-100 dark:bg-[#0B0D12]"
      >
        {canRenderGoogleMap ? (
          <GoogleMap
            mapId="DEMO_MAP_ID"
            defaultCenter={{ lat: selectedDistrict.lat, lng: selectedDistrict.lng }}
            defaultZoom={11}
            gestureHandling="greedy"
            disableDefaultUI={false}
            streetViewControl={false}
            mapTypeControl={false}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
          >
            <GoogleMapCameraAndRoute
              district={selectedDistrict}
              origin={originLatLng}
              destination={dropLatLng}
              routeColor={routeStroke}
              precomputedRouteObj={plannedRouteObj}
              travelMode={travelMode}
              recenterTick={recenterTick}
            />

            {/* Orange High Earning Areas Zones */}
            <GoogleMapHighEarningZones
              zones={HIGH_EARNING_ZONES}
              visible={showHighEarningZones}
              selectedZoneId={selectedZoneId}
              onSelectZone={handleSelectZone}
            />

            {/* Chauffeur Current District Marker */}
            <AdvancedMarker position={{ lat: selectedDistrict.lat, lng: selectedDistrict.lng }}>
              <Pin background="#E6C77E" borderColor="#111318" glyphColor="#111318" />
            </AdvancedMarker>

            {/* Hospital Hubs across Karnataka */}
            {showHospitalPins &&
              hospitals.map((h) => (
                <AdvancedMarker
                  key={h.id}
                  position={{ lat: h.lat, lng: h.lng }}
                  title={h.title}
                >
                  <Pin background="#10B981" borderColor="#064E3B" glyphColor="#FFFFFF" />
                </AdvancedMarker>
              ))}

            {/* Special Care Appointment Pickups */}
            {showHospitalPins &&
              careAppointments
                .filter((a) => !a.completed && a.pickupLatLng)
                .map((apt) => (
                  <AdvancedMarker
                    key={apt.id}
                    position={apt.pickupLatLng!}
                    title={`${apt.patientName} — ${apt.destinationFacility}`}
                    onClick={() => onSelectCarePin?.(apt.id)}
                  >
                    <Pin background="#0F766E" borderColor="#FFFFFF" glyphColor="#FFFFFF" />
                  </AdvancedMarker>
                ))}

            {/* Active Pickup & Drop Pins */}
            {originLatLng && (
              <AdvancedMarker position={originLatLng} title="Pickup Location">
                <Pin background="#D4AF63" borderColor="#111318" glyphColor="#111318" />
              </AdvancedMarker>
            )}
            {dropLatLng && (
              <AdvancedMarker position={dropLatLng} title="Drop Location">
                <Pin background="#10B981" borderColor="#064E3B" glyphColor="#FFFFFF" />
              </AdvancedMarker>
            )}
          </GoogleMap>
        ) : (
          /* Interactive Karnataka Corridor Map (Built-in 31-District Telemetry & Routing) */
          <div
            className="w-full h-full relative pt-14 pb-4 px-4 sm:px-5 flex flex-col sm:flex-row sm:items-stretch justify-between gap-3"
            style={{ background: DARK_GOLD_FALLBACK_STYLE }}
          >
            {/* Left Telemetry & Corridor Info Column */}
            <div className="relative z-10 sm:w-[54%] flex flex-col justify-between gap-2.5 min-w-0">
              <div className="space-y-1.5 p-3.5 rounded-2xl bg-black/45 backdrop-blur-md border border-white/10">
                <p className="text-[11px] font-mono-tabular uppercase tracking-[0.14em] text-[#E6C77E]">
                  Karnataka 31-District Corridor · {selectedDistrict.division}
                </p>
                <h3 className="font-display text-lg sm:text-2xl font-bold text-white leading-tight truncate">
                  {selectedDistrict.name} ({selectedDistrict.headquarters})
                </h3>
                <p className="text-xs text-stone-200 leading-snug">
                  Primary Medical Hub:{' '}
                  <strong className="text-emerald-300">{selectedDistrict.medicalCenter}</strong>
                </p>
                {showHighEarningZones && selectedZone && (
                  <p className="text-xs text-orange-300 font-semibold truncate">
                    Orange Zone · {selectedZone.name}
                  </p>
                )}
                <p className="text-[11px] font-mono-tabular text-stone-400">
                  {selectedDistrict.lat.toFixed(4)}°N, {selectedDistrict.lng.toFixed(4)}°E ·{' '}
                  {selectedDistrict.highwayCode}
                </p>
              </div>

              {(originLatLng || dropLatLng) && (
                <div className="p-3 rounded-2xl bg-black/65 backdrop-blur-md border border-amber-400/25 text-xs text-stone-200 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[#E6C77E] font-semibold">
                      Active Corridor Route
                    </p>
                    <p className="truncate font-semibold text-white">
                      {activeOffer
                        ? `${activeOffer.pickupAddress} → ${activeOffer.dropoffAddress}`
                        : `${plannedRoute?.pickup.label} → ${plannedRoute?.dropoff.label}`}
                    </p>
                  </div>
                  {plannedRoute && (
                    <span className="font-mono-tabular font-bold text-emerald-300 shrink-0">
                      {plannedRoute.distanceKm} km
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Right Interactive Karnataka State SVG Projection */}
            <div className="absolute inset-0 top-12 sm:static sm:w-[46%] flex items-center justify-center opacity-45 sm:opacity-100 pointer-events-none sm:pointer-events-auto">
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="xMidYMid meet"
                aria-label="Interactive Karnataka 31-District Corridor Map"
                className="w-full h-full max-h-[290px] sm:max-h-full"
              >
                {/* Subtle Latitude / Longitude Grid */}
                {[20, 40, 60, 80].map((v) => (
                  <g key={v} opacity="0.16">
                    <line x1={v} y1="4" x2={v} y2="96" stroke="#E6C77E" strokeWidth="0.25" strokeDasharray="1 1.5" />
                    <line x1="8" y1={v} x2="92" y2={v} stroke="#E6C77E" strokeWidth="0.25" strokeDasharray="1 1.5" />
                  </g>
                ))}

                {/* Karnataka State Boundary Silhouette */}
                <path
                  d="M 24 8 L 42 5 L 62 7 L 74 12 L 73 24 L 64 34 L 67 46 L 62 56 L 76 62 L 80 73 L 72 82 L 61 88 L 49 93 L 38 87 L 28 80 L 21 77 L 17 64 L 15 50 L 16 32 L 18 18 Z"
                  fill="rgba(212,175,99,0.10)"
                  stroke="#D4AF63"
                  strokeWidth="0.7"
                />

                {/* Karnataka National Highway Corridor Arcs (NH-48, NH-75, NH-275, NH-50) */}
                <g opacity="0.45" stroke="#E6C77E" strokeWidth="0.45" fill="none">
                  {/* NH-48 Belagavi -> Hubballi -> Davanagere -> Bengaluru */}
                  <path d="M 23 29 Q 42 48 66 71" strokeDasharray="1.4 1.2" />
                  {/* NH-75 Bengaluru -> Hassan -> Mangaluru */}
                  <path d="M 66 71 Q 44 70 28 73" strokeDasharray="1.4 1.2" />
                  {/* NH-275 Bengaluru -> Mysuru */}
                  <path d="M 66 71 Q 59 77 53 81" />
                  {/* NH-50 Kalaburagi -> Hosapete -> Bengaluru */}
                  <path d="M 56 17 Q 54 44 66 71" strokeDasharray="1.4 1.2" />
                </g>

                {/* Subtle Compass Rose */}
                <g transform="translate(86, 13)" opacity="0.65">
                  <circle cx="0" cy="0" r="4.5" fill="rgba(11,13,18,0.55)" stroke="#E6C77E" strokeWidth="0.35" />
                  <path d="M 0 -3 L 1 1 L 0 0.2 L -1 1 Z" fill="#E6C77E" />
                  <text x="0" y="3.5" textAnchor="middle" fill="#D6D3D1" fontSize="2.4" fontWeight="bold">
                    N
                  </text>
                </g>

                {/* Orange High Earning Zones */}
                {showHighEarningZones &&
                  HIGH_EARNING_ZONES.map((zone) => {
                    const zx = ((zone.lng - 74.0) / 4.6) * 65 + 16;
                    const zy = ((18.5 - zone.lat) / 7.0) * 84 + 8;
                    const isSel = zone.id === selectedZoneId;
                    return (
                      <g
                        key={zone.id}
                        className="cursor-pointer"
                        onClick={() => handleSelectZone(zone)}
                      >
                        <title>{`High Earning Area: ${zone.name} (${zone.orderFrequencyLabel})`}</title>
                        <circle
                          cx={zx}
                          cy={zy}
                          r={isSel ? 5.2 : 3.8}
                          fill="rgba(249, 115, 22, 0.30)"
                          stroke="#F97316"
                          strokeWidth={isSel ? '0.8' : '0.45'}
                        />
                        <circle cx={zx} cy={zy} r={1.3} fill="#FB923C" />
                      </g>
                    );
                  })}

                {/* All 31 Districts */}
                {KARNATAKA_31_DISTRICTS.map((d) => {
                  const nx = ((d.lng - 74.0) / 4.6) * 65 + 16;
                  const ny = ((18.5 - d.lat) / 7.0) * 84 + 8;
                  const isSel = d.id === selectedDistrict.id;
                  return (
                    <g
                      key={d.id}
                      className="cursor-pointer"
                      onClick={() => onSelectDistrict(d)}
                    >
                      <title>{`${d.name} (${d.headquarters})`}</title>
                      {isSel && (
                        <circle
                          cx={nx}
                          cy={ny}
                          r={4.0}
                          fill="rgba(230, 199, 126, 0.22)"
                          stroke="#E6C77E"
                          strokeWidth="0.6"
                        />
                      )}
                      <circle
                        cx={nx}
                        cy={ny}
                        r={isSel ? 2.1 : 1.05}
                        fill={isSel ? '#E6C77E' : '#34D399'}
                        stroke="#0B0D12"
                        strokeWidth="0.3"
                      />
                    </g>
                  );
                })}

                {/* Hospital Hubs & Special Care Pins */}
                {showHospitalPins &&
                  hospitals.map((h) => {
                    const hx = ((h.lng - 74.0) / 4.6) * 65 + 16;
                    const hy = ((18.5 - h.lat) / 7.0) * 84 + 8;
                    return (
                      <g key={h.id}>
                        <title>{h.title}</title>
                        <rect
                          x={hx - 1.4}
                          y={hy - 1.4}
                          width="2.8"
                          height="2.8"
                          rx="0.6"
                          fill="#10B981"
                          stroke="#064E3B"
                          strokeWidth="0.35"
                        />
                        <line x1={hx - 0.8} y1={hy} x2={hx + 0.8} y2={hy} stroke="#FFFFFF" strokeWidth="0.45" />
                        <line x1={hx} y1={hy - 0.8} x2={hx} y2={hy + 0.8} stroke="#FFFFFF" strokeWidth="0.45" />
                      </g>
                    );
                  })}

                {showHospitalPins &&
                  careAppointments
                    .filter((a) => !a.completed && a.pickupLatLng)
                    .map((apt) => {
                      const ax = ((apt.pickupLatLng!.lng - 74.0) / 4.6) * 65 + 16;
                      const ay = ((18.5 - apt.pickupLatLng!.lat) / 7.0) * 84 + 8;
                      return (
                        <g
                          key={apt.id}
                          className="cursor-pointer"
                          onClick={() => onSelectCarePin?.(apt.id)}
                        >
                          <title>{`${apt.patientName} — ${apt.destinationFacility}`}</title>
                          <circle cx={ax} cy={ay} r={1.8} fill="#0F766E" stroke="#FFFFFF" strokeWidth="0.45" />
                        </g>
                      );
                    })}

                {/* Active Route Line, Pickup/Drop Pins & Live Phase Vehicle Marker */}
                {originLatLng && dropLatLng && (() => {
                  const ox = ((originLatLng.lng - 74.0) / 4.6) * 65 + 16;
                  const oy = ((18.5 - originLatLng.lat) / 7.0) * 84 + 8;
                  const dx = ((dropLatLng.lng - 74.0) / 4.6) * 65 + 16;
                  const dy = ((18.5 - dropLatLng.lat) / 7.0) * 84 + 8;
                  const ratio =
                    phase === 'completed'
                      ? 1
                      : phase === 'in_trip'
                        ? 0.65
                        : phase === 'arrived_pickup'
                          ? 0.15
                          : phase === 'en_route_pickup'
                            ? 0.05
                            : 0;
                  const vx = ox + (dx - ox) * ratio;
                  const vy = oy + (dy - oy) * ratio;
                  return (
                    <g>
                      <line
                        x1={ox}
                        y1={oy}
                        x2={dx}
                        y2={dy}
                        stroke={routeStroke}
                        strokeWidth="1.2"
                        strokeDasharray="2 1.2"
                      />
                      <circle cx={ox} cy={oy} r={2.2} fill="#E6C77E" stroke="#0B0D12" strokeWidth="0.5" />
                      <circle cx={dx} cy={dy} r={2.2} fill="#10B981" stroke="#FFFFFF" strokeWidth="0.5" />
                      {ratio > 0 && (
                        <circle cx={vx} cy={vy} r={2.6} fill="#FFFFFF" stroke={routeStroke} strokeWidth="0.9" />
                      )}
                    </g>
                  );
                })()}
              </svg>
            </div>
          </div>
        )}

        {/* Top Floating HUD Bar */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none z-10">
          <div className="pointer-events-auto min-w-0 flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/90 dark:bg-[#0B0D12]/90 backdrop-blur-md border border-stone-200 dark:border-white/15 shadow-md text-xs font-semibold text-stone-900 dark:text-white">
            <Navigation className="w-3.5 h-3.5 text-[#B48A3E] dark:text-[#E6C77E] shrink-0" />
            <span className="truncate">
              {phase === 'offline' && `${selectedDistrict.name} · Offline`}
              {phase === 'online_idle' && `${selectedDistrict.name} · Online`}
              {phase === 'request_incoming' && 'Incoming Dispatch Route'}
              {phase === 'en_route_pickup' && `Pickup ETA · ${activeOffer?.pickupEtaMins ?? 4} min`}
              {phase === 'arrived_pickup' && 'At Pickup Portico'}
              {phase === 'in_trip' && `En Route · ${activeOffer?.tripDurationMins ?? 24} min`}
              {phase === 'completed' && 'Trip Completed · Drop-off Reached'}
            </span>
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              data-testid="toggle-high-earning-zones-btn"
              onClick={() => setShowHighEarningZones((p) => !p)}
              aria-pressed={showHighEarningZones}
              className={`min-h-[40px] px-3 py-1.5 rounded-2xl text-xs font-semibold border backdrop-blur-md flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                showHighEarningZones
                  ? 'bg-orange-500 text-white border-orange-400 shadow-sm'
                  : 'bg-white/90 dark:bg-[#0B0D12]/90 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-white/15'
              }`}
            >
              <Flame className="w-3.5 h-3.5 shrink-0" />
              <span>High Earning Areas</span>
            </button>

            <button
              type="button"
              onClick={() => setShowHospitalPins((p) => !p)}
              aria-pressed={showHospitalPins}
              className={`min-h-[40px] px-3 py-1.5 rounded-2xl text-xs font-semibold border backdrop-blur-md flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                showHospitalPins
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-white/90 dark:bg-[#0B0D12]/90 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-white/15'
              }`}
            >
              <Hospital className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Hospitals</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectDistrict(
                  KARNATAKA_31_DISTRICTS.find((d) => d.id === 'bengaluru-urban') ??
                    KARNATAKA_31_DISTRICTS[0]
                );
                setRecenterTick((t) => t + 1);
              }}
              aria-label="Center on Karnataka state"
              title={`Center ${KARNATAKA_CENTER.lat.toFixed(2)}, ${KARNATAKA_CENTER.lng.toFixed(2)}`}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-2xl bg-white/90 dark:bg-[#0B0D12]/90 backdrop-blur-md border border-stone-200 dark:border-white/15 text-stone-800 dark:text-white shadow-sm"
            >
              <Crosshair className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* High Earning Areas Orange Zones Directory Strip */}
      <div
        data-testid="high-earning-areas-strip"
        className="p-3.5 rounded-2xl bg-orange-50/90 dark:bg-orange-950/35 backdrop-blur-xl border border-orange-300/80 dark:border-orange-500/40 space-y-2 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              aria-hidden="true"
              className="w-3 h-3 rounded-sm bg-orange-500 border border-orange-700 shrink-0"
            />
            <span className="text-xs font-bold text-orange-950 dark:text-orange-200 truncate">
              High Earning Areas (Frequent Order Zones)
            </span>
          </div>
          {selectedZone && (
            <span className="text-[11px] font-semibold text-orange-800 dark:text-orange-300 truncate">
              {selectedZone.name} · {selectedZone.orderFrequencyLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {HIGH_EARNING_ZONES.map((zone) => {
            const active = zone.id === selectedZoneId;
            return (
              <button
                key={zone.id}
                type="button"
                data-testid={`high-earning-zone-${zone.id}`}
                onClick={() => handleSelectZone(zone)}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors ${
                  active
                    ? 'bg-orange-500 text-white border-orange-600 shadow-sm'
                    : 'bg-white/90 dark:bg-[#101218]/90 text-orange-900 dark:text-orange-200 border-orange-300/80 dark:border-orange-500/40 hover:bg-orange-100 dark:hover:bg-orange-500/20'
                }`}
              >
                {zone.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Karnataka All 31 Districts Selector Strip & Expandable Grid */}
      <div className="p-3.5 rounded-2xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 space-y-2.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-4 h-4 text-[#B48A3E] dark:text-[#E6C77E] shrink-0" />
            <span className="text-xs font-bold text-stone-900 dark:text-white truncate">
              Karnataka Districts (All 31)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Select Karnataka District"
              data-testid="karnataka-district-select"
              value={selectedDistrict.id}
              onChange={(e) => {
                const found = KARNATAKA_31_DISTRICTS.find((d) => d.id === e.target.value);
                if (found) onSelectDistrict(found);
              }}
              className="min-h-[40px] px-3 rounded-xl border border-stone-200 dark:border-white/15 bg-stone-50 dark:bg-[#07080B] text-xs font-semibold text-stone-900 dark:text-white"
            >
              {KARNATAKA_31_DISTRICTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              data-testid="toggle-all-districts-btn"
              onClick={() => setShowAllDistricts((prev) => !prev)}
              aria-expanded={showAllDistricts}
              className="min-h-[40px] px-3 rounded-xl border border-stone-200 dark:border-white/15 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/10 flex items-center gap-1 whitespace-nowrap"
            >
              <span>{showAllDistricts ? 'Hide 31' : 'View All 31'}</span>
              {showAllDistricts ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {showAllDistricts && (
          <div
            data-testid="karnataka-31-districts-grid"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 pt-2 border-t border-stone-100 dark:border-white/10 max-h-56 overflow-y-auto"
          >
            {KARNATAKA_31_DISTRICTS.map((dist) => {
              const active = dist.id === selectedDistrict.id;
              return (
                <button
                  key={dist.id}
                  type="button"
                  onClick={() => onSelectDistrict(dist)}
                  className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-left text-xs font-medium transition-colors truncate border ${
                    active
                      ? 'bg-[#B48A3E] dark:bg-[#E6C77E] text-white dark:text-stone-950 border-[#B48A3E] dark:border-[#E6C77E] font-bold'
                      : 'bg-stone-50 dark:bg-white/[0.03] text-stone-700 dark:text-stone-300 border-stone-200/70 dark:border-white/10 hover:bg-stone-100 dark:hover:bg-white/[0.08]'
                  }`}
                >
                  {dist.name}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
