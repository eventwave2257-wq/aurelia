import type { VehicleTier } from '../types/aurelia';

interface VehicleTierGraphicProps {
  tier: VehicleTier | 'auto';
  className?: string;
}

export function VehicleTierGraphic({ tier, className = 'w-6 h-4' }: VehicleTierGraphicProps) {
  if (tier === 'bike') {
    return (
      <svg viewBox="0 0 48 28" fill="none" aria-hidden="true" className={className}>
        <circle cx="11" cy="20" r="5.5" stroke="currentColor" strokeWidth="2.2" />
        <circle cx="37" cy="20" r="5.5" stroke="currentColor" strokeWidth="2.2" />
        <path
          d="M11 20L19 10H29L33 15.5L37 20M19 10L16 6H12M28 10L31 6.5H35"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M21 15.5H29"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (tier === 'auto') {
    return (
      <svg viewBox="0 0 48 28" fill="none" aria-hidden="true" className={className}>
        <path
          d="M8 20V11C8 7.5 11 5.5 16 5.5H30C34.5 5.5 38 9 39.5 14L41 20H8Z"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinejoin="round"
        />
        <path d="M16 5.5V13.5H38" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="14" cy="21" r="4" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2" />
        <circle cx="35" cy="21" r="4" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  if (tier === 'car_elite') {
    return (
      <svg viewBox="0 0 54 28" fill="none" aria-hidden="true" className={className}>
        <path
          d="M6 19.5V12.5C6 9.5 9 6.5 14 6.5H35C39.5 6.5 43.5 9.5 46.5 13.5L49 16.5V19.5H6Z"
          fill="currentColor"
          fillOpacity="0.12"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinejoin="round"
        />
        <path d="M14 9.5H24V14.5H12.5L14 9.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M27 9.5H35.5L40 14.5H27V9.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="14.5" cy="20.5" r="4.2" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2.1" />
        <circle cx="40.5" cy="20.5" r="4.2" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2.1" />
      </svg>
    );
  }

  // car_economy & car_premier sleek sedan silhouette
  return (
    <svg viewBox="0 0 54 28" fill="none" aria-hidden="true" className={className}>
      <path
        d="M5 19.5L7.5 14C8.5 12 11 11.5 13 11.5L18.5 6.5H33.5L40.5 11.5H45.5C47.8 11.5 49.5 13.5 49.5 16V19.5H5Z"
        fill="currentColor"
        fillOpacity={tier === 'car_premier' ? '0.18' : '0.08'}
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinejoin="round"
      />
      <path d="M18 11.5L21 8.5H32.5L36.5 11.5H18Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="14.5" cy="20.5" r="4" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" />
      <circle cx="40.5" cy="20.5" r="4" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
