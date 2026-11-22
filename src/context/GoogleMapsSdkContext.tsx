import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  APILoadingStatus,
  APIProvider,
  useApiLoadingStatus,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';

export interface GoogleMapsSdkState {
  hasApiKey: boolean;
  isLoaded: boolean;
  isFailed: boolean;
  quotaExceeded: boolean;
  placesLib: google.maps.PlacesLibrary | null;
  routesLib: google.maps.RoutesLibrary | null;
}

const GoogleMapsSdkContext = createContext<GoogleMapsSdkState>({
  hasApiKey: false,
  isLoaded: false,
  isFailed: false,
  quotaExceeded: false,
  placesLib: null,
  routesLib: null,
});

export function getGoogleMapsApiKey(): string {
  const viteKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (typeof viteKey === 'string' && viteKey.trim() && !viteKey.includes('MY_GOOGLE_MAPS_API_KEY')) {
    return viteKey.trim();
  }
  if (
    typeof __AURELIA_MAPS_API_KEY__ === 'string' &&
    __AURELIA_MAPS_API_KEY__.trim() &&
    !__AURELIA_MAPS_API_KEY__.includes('MY_GOOGLE_MAPS_API_KEY')
  ) {
    return __AURELIA_MAPS_API_KEY__.trim();
  }
  return '';
}

function isQuotaErrorMessage(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err ?? '');
  return (
    text.includes('RESOURCE_EXHAUSTED') ||
    text.includes('OVER_QUERY_LIMIT') ||
    text.includes('OverQuotaMapError') ||
    text.includes('QuotaExceededError') ||
    text.includes('429')
  );
}

export function reportMapsErrorForQuota(err: unknown): void {
  if (isQuotaErrorMessage(err)) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

function GoogleSdkBridge({
  quotaExceeded,
  children,
}: {
  quotaExceeded: boolean;
  children: ReactNode;
}) {
  const status = useApiLoadingStatus();
  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');

  const isFailed =
    status === APILoadingStatus.AUTH_FAILURE || status === APILoadingStatus.FAILED || quotaExceeded;
  const isLoaded = status === APILoadingStatus.LOADED && !isFailed;

  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  }, [status]);

  return (
    <GoogleMapsSdkContext.Provider
      value={{
        hasApiKey: true,
        isLoaded,
        isFailed,
        quotaExceeded,
        placesLib,
        routesLib,
      }}
    >
      {children}
    </GoogleMapsSdkContext.Provider>
  );
}

export function GoogleMapsSdkProvider({
  quotaExceeded,
  children,
}: {
  quotaExceeded: boolean;
  children: ReactNode;
}) {
  const [apiKey] = useState<string>(() => getGoogleMapsApiKey());

  if (!apiKey) {
    return (
      <GoogleMapsSdkContext.Provider
        value={{
          hasApiKey: false,
          isLoaded: false,
          isFailed: false,
          quotaExceeded,
          placesLib: null,
          routesLib: null,
        }}
      >
        {children}
      </GoogleMapsSdkContext.Provider>
    );
  }

  return (
    <APIProvider
      apiKey={apiKey}
      language="en"
      region="IN"
      libraries={['places', 'routes', 'marker']}
    >
      <GoogleSdkBridge quotaExceeded={quotaExceeded}>{children}</GoogleSdkBridge>
    </APIProvider>
  );
}

export function useGoogleMapsSdk(): GoogleMapsSdkState {
  return useContext(GoogleMapsSdkContext);
}
