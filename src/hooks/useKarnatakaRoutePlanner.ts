import { useCallback, useEffect, useRef, useState } from 'react';
import { KARNATAKA_BOUNDS } from '../data/karnatakaDistricts';
import { reportMapsErrorForQuota, useGoogleMapsSdk } from '../context/GoogleMapsSdkContext';
import type { GeoPoint, SelectedPlacePoint, VehicleTier } from '../types/aurelia';
import { estimateRoadDistanceKm, searchKarnatakaDirectory } from '../utils/aureliaLogic';

export interface AutocompleteOption {
  id: string;
  title: string;
  subtitle: string;
  source: 'google_places' | 'karnataka_directory';
  googleSuggestion?: google.maps.places.AutocompleteSuggestion;
  directoryPlace?: SelectedPlacePoint;
}

export function useKarnatakaAutocomplete(inputValue: string) {
  const { placesLib, isFailed } = useGoogleMapsSdk();
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const [options, setOptions] = useState<AutocompleteOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const resetSession = useCallback(() => {
    sessionTokenRef.current = null;
  }, []);

  useEffect(() => {
    const trimmed = inputValue.trim();
    const localMatches: AutocompleteOption[] = searchKarnatakaDirectory(trimmed, 5).map(
      (item, idx) => ({
        id: `dir-${idx}-${item.label}`,
        title: item.label,
        subtitle: item.formattedAddress,
        source: 'karnataka_directory',
        directoryPlace: item,
      })
    );

    if (!trimmed) {
      setOptions(localMatches);
      setIsLoading(false);
      return;
    }

    if (!placesLib || isFailed) {
      setOptions(localMatches);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }

        const request: google.maps.places.AutocompleteRequest = {
          input: trimmed,
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: ['in'],
          region: 'IN',
          language: 'en',
          locationBias: KARNATAKA_BOUNDS,
          internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
        };

        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        if (cancelled) return;

        const googleOpts: AutocompleteOption[] = (res.suggestions ?? [])
          .filter((s) => Boolean(s.placePrediction))
          .map((s, idx) => ({
            id: `gplaces-${s.placePrediction?.placeId ?? idx}`,
            title:
              s.placePrediction?.mainText?.text ??
              s.placePrediction?.text.text ??
              'Karnataka Location',
            subtitle:
              s.placePrediction?.secondaryText?.text ??
              s.placePrediction?.text.text ??
              'Karnataka, India',
            source: 'google_places' as const,
            googleSuggestion: s,
          }))
          .sort((a, b) => {
            const aKa = /karnataka|bengaluru|bangalore|mysuru|mysore|mangaluru|hubballi|belagavi|udupi/i.test(
              `${a.title} ${a.subtitle}`
            );
            const bKa = /karnataka|bengaluru|bangalore|mysuru|mysore|mangaluru|hubballi|belagavi|udupi/i.test(
              `${b.title} ${b.subtitle}`
            );
            if (aKa === bKa) return 0;
            return aKa ? -1 : 1;
          })
          .slice(0, 5);

        // Combine Google Places suggestions first, supplemented by Karnataka District Hubs
        const combined = [...googleOpts];
        for (const loc of localMatches) {
          if (
            !combined.some((g) => g.title.toLowerCase() === loc.title.toLowerCase()) &&
            combined.length < 7
          ) {
            combined.push(loc);
          }
        }
        setOptions(combined);
      } catch (err) {
        reportMapsErrorForQuota(err);
        if (!cancelled) {
          setOptions(localMatches);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [inputValue, placesLib, isFailed]);

  const resolveOptionToPlace = useCallback(
    async (option: AutocompleteOption): Promise<SelectedPlacePoint | null> => {
      if (option.directoryPlace) {
        return option.directoryPlace;
      }
      if (!option.googleSuggestion?.placePrediction) return null;
      try {
        const place = option.googleSuggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location', 'viewport'],
        });
        resetSession();
        if (!place.location) return null;
        return {
          label: place.displayName || option.title,
          formattedAddress: place.formattedAddress || option.subtitle,
          location: {
            lat: place.location.lat(),
            lng: place.location.lng(),
          },
          source: 'google_places',
        };
      } catch (err) {
        reportMapsErrorForQuota(err);
        return null;
      }
    },
    [resetSession]
  );

  return { options, isLoading, resolveOptionToPlace };
}

export interface ComputedRouteMetrics {
  distanceKm: number;
  durationMins: number;
  routeObj: google.maps.routes.Route | null;
  source: 'google_routes' | 'corridor_estimate';
}

export function useKarnatakaRouteCalculator() {
  const { routesLib, isFailed } = useGoogleMapsSdk();

  const computeRoute = useCallback(
    async (
      origin: GeoPoint,
      destination: GeoPoint,
      vehicleTier: VehicleTier
    ): Promise<ComputedRouteMetrics> => {
      const fallbackKm = estimateRoadDistanceKm(origin, destination);
      const speedKmh = vehicleTier === 'bike' ? 34 : 38;
      const fallbackMins = Math.max(6, Math.round((fallbackKm / speedKmh) * 60));

      if (!routesLib || isFailed) {
        return {
          distanceKm: fallbackKm,
          durationMins: fallbackMins,
          routeObj: null,
          source: 'corridor_estimate',
        };
      }

      try {
        const travelMode: google.maps.TravelModeString =
          vehicleTier === 'bike' ? 'TWO_WHEELER' : 'DRIVING';
        const res = await routesLib.Route.computeRoutes({
          origin,
          destination,
          travelMode,
          fields: ['distanceMeters', 'durationMillis', 'path', 'viewport'],
          region: 'IN',
          language: 'en',
          internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
        });

        const firstRoute = res.routes?.[0];
        if (!firstRoute || typeof firstRoute.distanceMeters !== 'number') {
          return {
            distanceKm: fallbackKm,
            durationMins: fallbackMins,
            routeObj: null,
            source: 'corridor_estimate',
          };
        }

        const distanceKm = Math.max(0.5, Math.round((firstRoute.distanceMeters / 1000) * 10) / 10);
        const durationMins =
          typeof firstRoute.durationMillis === 'number' && Number.isFinite(firstRoute.durationMillis)
            ? Math.max(4, Math.round(firstRoute.durationMillis / 60000))
            : fallbackMins;

        return {
          distanceKm,
          durationMins,
          routeObj: firstRoute,
          source: 'google_routes',
        };
      } catch (err) {
        reportMapsErrorForQuota(err);
        return {
          distanceKm: fallbackKm,
          durationMins: fallbackMins,
          routeObj: null,
          source: 'corridor_estimate',
        };
      }
    },
    [routesLib, isFailed]
  );

  return { computeRoute };
}
