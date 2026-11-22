import { useState } from 'react';
import { Fuel, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { KARNATAKA_AUTO_IMG_PATH } from '../data/seedData';
import type { DriverProfileData } from '../types/aurelia';
import { formatCurrency } from '../utils/aureliaLogic';
import { LocalLeaderboard } from './LocalLeaderboard';
import { VehicleTierGraphic } from './VehicleTierGraphic';

interface AutoDriversViewProps {
  driverProfile: DriverProfileData;
  selectedDistrictId?: string;
}

interface AutoRideItem {
  id: string;
  passengerName: string;
  pickup: string;
  dropoff: string;
  distanceKm: number;
  fareInr: number;
  metered: boolean;
  status: 'available' | 'completed';
}

export function AutoDriversView({ driverProfile, selectedDistrictId }: AutoDriversViewProps) {
  const [rides, setRides] = useState<AutoRideItem[]>([
    {
      id: 'AUTO-101',
      passengerName: 'Priya Sharma',
      pickup: 'Koramangala 5th Block',
      dropoff: 'MG Road Metro Station',
      distanceKm: 4.5,
      fareInr: 110,
      metered: true,
      status: 'available',
    },
    {
      id: 'AUTO-102',
      passengerName: 'Anil Hegde',
      pickup: 'Indiranagar 100ft Road',
      dropoff: 'Domlur Flyover',
      distanceKm: 2.8,
      fareInr: 80,
      metered: true,
      status: 'available',
    },
    {
      id: 'AUTO-103',
      passengerName: 'Sunita Rao',
      pickup: 'Jayanagar 4th Block',
      dropoff: 'National College',
      distanceKm: 3.2,
      fareInr: 90,
      metered: true,
      status: 'completed',
    },
  ]);

  const [activeRide, setActiveRide] = useState<AutoRideItem | null>(null);
  const [cngStations] = useState([
    { name: 'IOCL CNG Station - Koramangala', distance: '1.2 km', status: 'Open · ₹89.50/kg' },
    { name: 'BPCL Auto LPG & CNG - Indiranagar', distance: '3.4 km', status: 'Open · ₹89.50/kg' },
    { name: 'HPCL Green Fuel - MG Road', distance: '4.8 km', status: 'Open · ₹89.50/kg' },
  ]);

  const handleAcceptAutoRide = (ride: AutoRideItem) => {
    setActiveRide(ride);
  };

  const handleCompleteAutoRide = (id: string) => {
    setRides((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'completed' } : r))
    );
    setActiveRide(null);
  };

  return (
    <div className="space-y-5">
      {/* Header + Visual Showcase */}
      <div className="rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-4 relative min-h-[150px]">
          <img
            src={KARNATAKA_AUTO_IMG_PATH}
            alt="Aurelia Karnataka Electric Auto Rickshaw on Bengaluru Metro Corridor"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#E6C77E]">
              Namma Metro Feeder Fleet
            </span>
            <VehicleTierGraphic tier="auto" className="w-7 h-4 text-[#E6C77E]" />
          </div>
        </div>

        <div className="lg:col-span-8 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-[#D4AF63]">
              Karnataka Auto Rickshaw Fleet · Metered &amp; Fixed Fares
            </p>
            <h1 className="font-display text-3xl font-bold text-stone-900 dark:text-stone-50 mt-0.5">
              Auto Drivers Section
            </h1>
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
              Connected with {driverProfile.fullName} ({driverProfile.vehicle.licensePlate}) · CNG &amp; Electric Auto Support
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-right">
              <p className="text-[10px] uppercase font-semibold text-amber-800 dark:text-amber-300">Auto Today Net</p>
              <p className="text-xl font-bold text-stone-900 dark:text-stone-50 font-mono-tabular">₹840</p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Available Auto Rides / Queue */}
        <div className="lg:col-span-7 p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-50">
              Auto Dispatch Queue ({rides.filter((r) => r.status === 'available').length})
            </h2>
            <span className="text-xs text-stone-500 font-mono-tabular">Base ₹30 + ₹16/km</span>
          </div>

          <div className="space-y-3">
            {activeRide && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase">
                    Active Auto Dispatch — {activeRide.id}
                  </span>
                  <span className="text-xs font-bold font-mono-tabular text-stone-900 dark:text-stone-50">
                    {formatCurrency(activeRide.fareInr)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-900 dark:text-stone-50">
                    {activeRide.passengerName}
                  </p>
                  <p className="text-xs text-stone-600 dark:text-stone-300">
                    {activeRide.pickup} → {activeRide.dropoff} ({activeRide.distanceKm} km)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCompleteAutoRide(activeRide.id)}
                  className="w-full min-h-[44px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Complete Auto Trip & Collect Fare</span>
                </button>
              </div>
            )}

            {rides
              .filter((r) => r.status === 'available')
              .map((ride) => (
                <div
                  key={ride.id}
                  className="p-4 rounded-2xl bg-stone-50/80 dark:bg-[#080A0F]/85 border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-amber-700 dark:text-[#D4AF63]">🛺 Auto Metered</span>
                      <span className="text-stone-400">•</span>
                      <span className="text-stone-500 font-mono-tabular">{ride.distanceKm} km</span>
                    </div>
                    <p className="text-sm font-semibold text-stone-900 dark:text-stone-50">
                      {ride.passengerName}
                    </p>
                    <p className="text-xs text-stone-600 dark:text-stone-300">
                      {ride.pickup} → {ride.dropoff}
                    </p>
                  </div>

                  <div className="text-right shrink-0 space-y-2">
                    <p className="text-base font-bold text-stone-900 dark:text-stone-50 font-mono-tabular">
                      {formatCurrency(ride.fareInr)}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleAcceptAutoRide(ride)}
                      disabled={!!activeRide}
                      className="min-h-[38px] px-3.5 rounded-xl bg-[#B48A3E] hover:bg-[#9A722A] dark:bg-[#D4AF63] dark:hover:bg-[#E2C27D] text-white dark:text-stone-950 font-semibold text-xs disabled:opacity-50"
                    >
                      Accept Auto
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* CNG Stations & Auto Perks */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 space-y-3">
            <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-50 flex items-center gap-2">
              <Fuel className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span>Nearby CNG & Green Fuel Stations</span>
            </h2>
            <div className="space-y-2.5">
              {cngStations.map((station, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-stone-50 dark:bg-[#080A0F] border border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-semibold text-stone-800 dark:text-stone-200">{station.name}</p>
                    <p className="text-stone-500 font-mono-tabular">{station.distance} away</p>
                  </div>
                  <span className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-mono-tabular font-medium">
                    {station.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 space-y-3">
            <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-50 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Auto Driver Welfare & Insurance</span>
            </h2>
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              All registered Karnataka auto drivers receive ₹5 Lakh accidental health cover, zero commission on return trips, and priority Bangalore Metro feeder parking access.
            </p>
          </div>
        </div>
      </div>

      {/* Local Auto Leaderboard Component */}
      <LocalLeaderboard
        selectedDistrictId={selectedDistrictId}
        currentDriverName={driverProfile.fullName}
      />
    </div>
  );
}
