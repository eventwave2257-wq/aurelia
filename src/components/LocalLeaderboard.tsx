import { useState, useMemo } from 'react';
import { Trophy, Star, Award, Medal, MapPin, Zap, TrendingUp, ShieldCheck } from 'lucide-react';
import { KARNATAKA_31_DISTRICTS } from '../data/karnatakaDistricts';

interface AutoLeaderboardDriver {
  id: string;
  rank: number;
  name: string;
  plate: string;
  tripsCount: number;
  rating: number;
  fuelType: 'Electric Auto' | 'Green CNG' | 'LPG Metered';
  badge: string;
  isCurrentUser?: boolean;
}

interface LocalLeaderboardProps {
  selectedDistrictId?: string;
  currentDriverName?: string;
}

export function LocalLeaderboard({
  selectedDistrictId = 'bengaluru_urban',
  currentDriverName,
}: LocalLeaderboardProps) {
  const [districtId, setDistrictId] = useState<string>(selectedDistrictId);
  const [filterPeriod, setFilterPeriod] = useState<'month' | 'week'>('month');

  const currentDistrict = useMemo(() => {
    return (
      KARNATAKA_31_DISTRICTS.find((d) => d.id === districtId) ??
      KARNATAKA_31_DISTRICTS.find((d) => d.id === 'bengaluru_urban') ??
      KARNATAKA_31_DISTRICTS[0]
    );
  }, [districtId]);

  // Generate localized leaderboard drivers based on selected district
  const drivers: AutoLeaderboardDriver[] = useMemo(() => {
    const dName = currentDistrict.name;
    const isBlr = districtId.includes('bengaluru');
    const platePrefix = isBlr ? 'KA-01' : districtId.includes('mysuru') ? 'KA-09' : districtId.includes('dharwad') ? 'KA-25' : 'KA-19';

    const baseList: AutoLeaderboardDriver[] = [
      {
        id: '1',
        rank: 1,
        name: 'Manjunath Swamy',
        plate: `${platePrefix}-F-7120`,
        tripsCount: filterPeriod === 'month' ? 348 : 86,
        rating: 4.98,
        fuelType: 'Electric Auto',
        badge: '🏆 District Champion',
      },
      {
        id: '2',
        rank: 2,
        name: 'Ramesh Gowda',
        plate: `${platePrefix}-E-4921`,
        tripsCount: filterPeriod === 'month' ? 324 : 79,
        rating: 4.95,
        fuelType: 'Green CNG',
        badge: '⭐ 5-Star Hospitality',
      },
      {
        id: '3',
        rank: 3,
        name: 'Syed Farooq',
        plate: `${platePrefix}-B-3109`,
        tripsCount: filterPeriod === 'month' ? 312 : 75,
        rating: 4.93,
        fuelType: 'Green CNG',
        badge: '⚡ Rapid Feeder Champ',
      },
      {
        id: '4',
        rank: 4,
        name: 'Venkatesh K.',
        plate: `${platePrefix}-AA-8419`,
        tripsCount: filterPeriod === 'month' ? 295 : 68,
        rating: 4.91,
        fuelType: 'Electric Auto',
        badge: '🌿 Eco Pioneer',
      },
      {
        id: '5',
        rank: 5,
        name: currentDriverName || 'You (Aurelia Driver)',
        plate: `${platePrefix}-AB-4829`,
        tripsCount: filterPeriod === 'month' ? 280 : 64,
        rating: 4.92,
        fuelType: 'Green CNG',
        badge: '🔥 Top 5 Performer',
        isCurrentUser: true,
      },
      {
        id: '6',
        rank: 6,
        name: 'Ananda Kumar',
        plate: `${platePrefix}-D-9182`,
        tripsCount: filterPeriod === 'month' ? 264 : 61,
        rating: 4.89,
        fuelType: 'LPG Metered',
        badge: '🛡️ Safety Specialist',
      },
    ];

    return baseList;
  }, [currentDistrict, districtId, filterPeriod, currentDriverName]);

  return (
    <div
      data-testid="local-leaderboard-card"
      className="p-5 sm:p-6 rounded-3xl bg-white/85 dark:bg-[#101218]/85 backdrop-blur-xl border border-stone-200/80 dark:border-white/10 shadow-sm space-y-4"
    >
      {/* Title & District Select */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 dark:bg-amber-400/20 border border-amber-300 dark:border-amber-500/40 flex items-center justify-center text-amber-700 dark:text-amber-300">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-[#D4AF63]">
                Karnataka Fleet Rankings
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-[10px] font-bold text-amber-800 dark:text-amber-300 border border-amber-300/70 dark:border-amber-700/60">
                Live
              </span>
            </div>
            <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-50">
              Local Auto Leaderboard
            </h2>
          </div>
        </div>

        {/* Controls: District Select & Period Switch */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={districtId}
              onChange={(e) => setDistrictId(e.target.value)}
              className="min-h-[40px] pl-3 pr-8 py-1 rounded-xl bg-stone-100 dark:bg-[#080A0F] border border-stone-200 dark:border-white/10 text-xs font-semibold text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              {KARNATAKA_31_DISTRICTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.division.replace(' Division', '')})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center p-1 rounded-xl bg-stone-100/80 dark:bg-[#080A0F]/80 border border-stone-200/80 dark:border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setFilterPeriod('month')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                filterPeriod === 'month'
                  ? 'bg-white dark:bg-[#D4AF63] text-stone-900 dark:text-stone-950 shadow-sm'
                  : 'text-stone-600 dark:text-stone-300'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setFilterPeriod('week')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                filterPeriod === 'week'
                  ? 'bg-white dark:bg-[#D4AF63] text-stone-900 dark:text-stone-950 shadow-sm'
                  : 'text-stone-600 dark:text-stone-300'
              }`}
            >
              This Week
            </button>
          </div>
        </div>
      </div>

      {/* District Meta Highlight */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/40 text-xs font-mono-tabular">
        <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
          <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            District: <strong className="text-stone-900 dark:text-white">{currentDistrict.name}</strong> ({currentDistrict.headquarters})
          </span>
        </div>
        <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
          <Star className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            Avg District Rating: <strong className="text-emerald-700 dark:text-emerald-400">4.92★</strong>
          </span>
        </div>
        <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
          <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            Active Verified Autos: <strong className="text-stone-900 dark:text-white">1,240+</strong>
          </span>
        </div>
      </div>

      {/* Leaderboard Table / Cards */}
      <div className="divide-y divide-stone-100 dark:divide-stone-800 overflow-hidden">
        {drivers.map((driver) => {
          const isTop3 = driver.rank <= 3;
          return (
            <div
              key={driver.id}
              className={`py-3.5 px-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                driver.isCurrentUser
                  ? 'bg-amber-100/70 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/40'
                  : 'hover:bg-stone-50 dark:hover:bg-white/[0.02]'
              }`}
            >
              {/* Left: Rank & Driver Info */}
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 font-mono-tabular ${
                    driver.rank === 1
                      ? 'bg-amber-400 text-stone-950 shadow-sm'
                      : driver.rank === 2
                        ? 'bg-slate-300 text-stone-900 shadow-sm'
                        : driver.rank === 3
                          ? 'bg-amber-700 text-amber-100 shadow-sm'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                  }`}
                >
                  {driver.rank === 1 ? '🥇' : driver.rank === 2 ? '🥈' : driver.rank === 3 ? '🥉' : `#${driver.rank}`}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-stone-900 dark:text-stone-50">
                      {driver.name}
                    </p>
                    {driver.isCurrentUser && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-stone-950 font-bold text-[10px]">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 font-mono-tabular mt-0.5">
                    <span>{driver.plate}</span>
                    <span>•</span>
                    <span className="text-amber-700 dark:text-amber-400">{driver.fuelType}</span>
                    <span>•</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{driver.badge}</span>
                  </div>
                </div>
              </div>

              {/* Right: Stats (Trips & Rating) */}
              <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 pl-12 sm:pl-0 font-mono-tabular">
                <div className="text-left sm:text-right">
                  <p className="text-xs text-stone-500 dark:text-stone-400 uppercase">Completed Trips</p>
                  <p className="text-base font-bold text-stone-900 dark:text-stone-100">
                    {driver.tripsCount} trips
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-stone-500 dark:text-stone-400 uppercase">Passenger Rating</p>
                  <p className="text-base font-bold text-amber-600 dark:text-[#E6C77E] flex items-center justify-end gap-1">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span>{driver.rating.toFixed(2)}</span>
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
