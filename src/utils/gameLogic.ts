export type CandyGemType = 0 | 1 | 2 | 3 | 4 | 5;

export interface GridCoord {
  row: number;
  col: number;
}

export const CANDY_GEM_META: Record<
  CandyGemType,
  { name: string; color: string; glow: string; symbol: string }
> = {
  0: { name: 'Ruby Berry', color: '#e11d48', glow: 'rgba(225,29,72,0.45)', symbol: '♦' },
  1: { name: 'Amber Gold', color: '#f59e0b', glow: 'rgba(245,158,11,0.45)', symbol: '★' },
  2: { name: 'Emerald Mint', color: '#10b981', glow: 'rgba(16,185,129,0.45)', symbol: '♣' },
  3: { name: 'Sapphire Sky', color: '#0ea5e9', glow: 'rgba(14,165,233,0.45)', symbol: '●' },
  4: { name: 'Amethyst Plum', color: '#a855f7', glow: 'rgba(168,85,247,0.45)', symbol: '▲' },
  5: { name: 'Citrus Tang', color: '#f97316', glow: 'rgba(249,115,22,0.45)', symbol: '◆' },
};

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function createMatch3Board(
  rows = 8,
  cols = 8,
  seed = Date.now()
): (CandyGemType | null)[][] {
  const rand = mulberry32(seed);
  const board: (CandyGemType | null)[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(null)
  );

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let candidate = Math.floor(rand() * 6) as CandyGemType;
      let guard = 0;
      while (
        guard < 12 &&
        ((c >= 2 && board[r][c - 1] === candidate && board[r][c - 2] === candidate) ||
          (r >= 2 && board[r - 1][c] === candidate && board[r - 2][c] === candidate))
      ) {
        candidate = ((candidate + 1) % 6) as CandyGemType;
        guard++;
      }
      board[r][c] = candidate;
    }
  }
  return board;
}

export function areAdjacent(a: GridCoord, b: GridCoord): boolean {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return dr + dc === 1;
}

export function swapTiles(
  board: (CandyGemType | null)[][],
  a: GridCoord,
  b: GridCoord
): (CandyGemType | null)[][] {
  const next = board.map((row) => [...row]);
  const temp = next[a.row][a.col];
  next[a.row][a.col] = next[b.row][b.col];
  next[b.row][b.col] = temp;
  return next;
}

export function findMatchCoords(board: (CandyGemType | null)[][]): GridCoord[] {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const matched = new Set<string>();

  for (let r = 0; r < rows; r++) {
    let run = 1;
    for (let c = 1; c <= cols; c++) {
      const cur = c < cols ? board[r][c] : null;
      const prev = board[r][c - 1];
      if (cur !== null && cur === prev) {
        run++;
      } else {
        if (prev !== null && run >= 3) {
          for (let k = c - run; k < c; k++) matched.add(`${r},${k}`);
        }
        run = 1;
      }
    }
  }

  for (let c = 0; c < cols; c++) {
    let run = 1;
    for (let r = 1; r <= rows; r++) {
      const cur = r < rows ? board[r][c] : null;
      const prev = board[r - 1][c];
      if (cur !== null && cur === prev) {
        run++;
      } else {
        if (prev !== null && run >= 3) {
          for (let k = r - run; k < r; k++) matched.add(`${k},${c}`);
        }
        run = 1;
      }
    }
  }

  return Array.from(matched).map((key) => {
    const [row, col] = key.split(',').map(Number);
    return { row, col };
  });
}

export function resolveMatchCascades(
  board: (CandyGemType | null)[][],
  seed = Date.now()
): {
  board: (CandyGemType | null)[][];
  clearedCount: number;
  cascadeDepth: number;
  scoreDelta: number;
} {
  const rand = mulberry32(seed);
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  let current = board.map((row) => [...row]);
  let clearedCount = 0;
  let cascadeDepth = 0;
  let scoreDelta = 0;

  while (true) {
    const matches = findMatchCoords(current);
    if (matches.length === 0) break;
    cascadeDepth += 1;
    clearedCount += matches.length;
    scoreDelta += matches.length * 30 * cascadeDepth;

    for (const m of matches) {
      current[m.row][m.col] = null;
    }

    // Apply gravity + refill
    for (let c = 0; c < cols; c++) {
      let writeRow = rows - 1;
      for (let r = rows - 1; r >= 0; r--) {
        if (current[r][c] !== null) {
          current[writeRow][c] = current[r][c];
          if (writeRow !== r) current[r][c] = null;
          writeRow--;
        }
      }
      while (writeRow >= 0) {
        current[writeRow][c] = Math.floor(rand() * 6) as CandyGemType;
        writeRow--;
      }
    }
  }

  return { board: current, clearedCount, cascadeDepth, scoreDelta };
}

export const ALPHABET_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export interface AlphabetChallenge {
  word: string;
  hint: string;
  missingIndex: number;
}

export const ALPHABET_WORD_CHALLENGES: AlphabetChallenge[] = [
  { word: 'AURELIA', hint: 'Sovereign Fleet Brand', missingIndex: 3 },
  { word: 'MYSURU', hint: 'Heritage Palace City', missingIndex: 2 },
  { word: 'BENGALURU', hint: 'Garden & Tech Capital', missingIndex: 4 },
  { word: 'HIGHWAY', hint: 'Inter-District Express Corridor', missingIndex: 3 },
  { word: 'HOSPITAL', hint: 'Priority #1 Clinical Dropoff', missingIndex: 4 },
  { word: 'CHAUFFEUR', hint: 'Certified Executive Driver', missingIndex: 5 },
  { word: 'UDUPI', hint: 'Coastal Temple Hub', missingIndex: 2 },
  { word: 'SAFETY', hint: 'Helmet & Speed Compliance', missingIndex: 1 },
];

export function evaluateAlphabetPick(
  targetLetter: string,
  pickedLetter: string
): { correct: boolean; points: number } {
  const ok = targetLetter.toUpperCase() === pickedLetter.toUpperCase();
  return { correct: ok, points: ok ? 50 : -10 };
}

export type RunnerAction = 'run' | 'jump' | 'slide';
export type RunnerObstacleKind = 'barrier' | 'low_branch' | 'coin';

export interface RunnerEntity {
  id: number;
  lane: 0 | 1 | 2;
  y: number;
  kind: RunnerObstacleKind;
}

export function checkRunnerEntityCollision(
  playerLane: 0 | 1 | 2,
  playerAction: RunnerAction,
  entity: Pick<RunnerEntity, 'lane' | 'y' | 'kind'>,
  playerY = 250,
  hitWindowPx = 28
): 'none' | 'coin' | 'crash' {
  if (entity.lane !== playerLane) return 'none';
  if (Math.abs(entity.y - playerY) > hitWindowPx) return 'none';

  if (entity.kind === 'coin') return 'coin';
  if (entity.kind === 'barrier') {
    return playerAction === 'jump' ? 'none' : 'crash';
  }
  if (entity.kind === 'low_branch') {
    return playerAction === 'slide' ? 'none' : 'crash';
  }
  return 'none';
}

export function calculateZoneDamage(
  playerX: number,
  playerY: number,
  centerX: number,
  centerY: number,
  zoneRadius: number
): number {
  const dist = Math.hypot(playerX - centerX, playerY - centerY);
  if (dist <= zoneRadius) return 0;
  const excessRatio = (dist - zoneRadius) / Math.max(40, zoneRadius);
  return Math.min(18, Math.max(2, Math.round(4 + excessRatio * 10)));
}

export function stepCircleCollision(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number
): boolean {
  return Math.hypot(ax - bx, ay - by) <= ar + br;
}

export type FreeFireWeaponId = 'scar' | 'mp40' | 'm1887' | 'awm';
export type FreeFireCharacterId = 'alok' | 'kelly' | 'hayato';

export interface FreeFireWeaponSpec {
  id: FreeFireWeaponId;
  name: string;
  slot: 1 | 2 | 3 | 4;
  category: 'AR' | 'SMG' | 'SG' | 'SR';
  damage: number;
  fireRateSec: number;
  pellets: number;
  spreadRad: number;
  bulletSpeed: number;
  rangePx: number;
  headshotChance: number;
  headshotMult: number;
  color: string;
}

export const FREE_FIRE_WEAPONS: Record<FreeFireWeaponId, FreeFireWeaponSpec> = {
  scar: {
    id: 'scar',
    name: 'SCAR',
    slot: 1,
    category: 'AR',
    damage: 28,
    fireRateSec: 0.16,
    pellets: 1,
    spreadRad: 0.04,
    bulletSpeed: 580,
    rangePx: 440,
    headshotChance: 0.24,
    headshotMult: 2.1,
    color: '#fbbf24',
  },
  mp40: {
    id: 'mp40',
    name: 'MP40',
    slot: 2,
    category: 'SMG',
    damage: 19,
    fireRateSec: 0.085,
    pellets: 1,
    spreadRad: 0.09,
    bulletSpeed: 520,
    rangePx: 300,
    headshotChance: 0.22,
    headshotMult: 1.9,
    color: '#38bdf8',
  },
  m1887: {
    id: 'm1887',
    name: 'M1887',
    slot: 3,
    category: 'SG',
    damage: 18,
    fireRateSec: 0.52,
    pellets: 6,
    spreadRad: 0.24,
    bulletSpeed: 490,
    rangePx: 210,
    headshotChance: 0.2,
    headshotMult: 1.75,
    color: '#f97316',
  },
  awm: {
    id: 'awm',
    name: 'AWM',
    slot: 4,
    category: 'SR',
    damage: 95,
    fireRateSec: 0.85,
    pellets: 1,
    spreadRad: 0.005,
    bulletSpeed: 880,
    rangePx: 660,
    headshotChance: 0.42,
    headshotMult: 2.4,
    color: '#f43f5e',
  },
};

export interface FreeFireCharacterSpec {
  id: FreeFireCharacterId;
  name: string;
  title: string;
  skillName: string;
  skillDesc: string;
  speedMultiplier: number;
  armorBonus: number;
  accent: string;
}

export const FREE_FIRE_CHARACTERS: Record<FreeFireCharacterId, FreeFireCharacterSpec> = {
  alok: {
    id: 'alok',
    name: 'DJ Alok',
    title: 'Drop the Beat',
    skillName: 'Healing Aura',
    skillDesc: '5m Healing Zone (+35 HP over 5s & +15% Speed)',
    speedMultiplier: 1.05,
    armorBonus: 0,
    accent: '#10b981',
  },
  kelly: {
    id: 'kelly',
    name: 'Kelly',
    title: 'Dash Sprinter',
    skillName: 'Deadly Velocity',
    skillDesc: '+22% Sprint Speed & +15% First-Shot Crit',
    speedMultiplier: 1.22,
    armorBonus: 0,
    accent: '#f59e0b',
  },
  hayato: {
    id: 'hayato',
    name: 'Hayato',
    title: 'Bushido Blade',
    skillName: 'Art of Blades',
    skillDesc: '+30 Starting Vest Armor & 25% Damage Reduction',
    speedMultiplier: 1.0,
    armorBonus: 30,
    accent: '#ef4444',
  },
};

export interface RectObstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function pointHitsRect(px: number, py: number, radius: number, r: RectObstacle): boolean {
  const closestX = Math.max(r.x, Math.min(px, r.x + r.w));
  const closestY = Math.max(r.y, Math.min(py, r.y + r.h));
  const dx = px - closestX;
  const dy = py - closestY;
  return dx * dx + dy * dy < radius * radius;
}

export function resolveCircleRectPush(
  cx: number,
  cy: number,
  radius: number,
  r: RectObstacle
): { x: number; y: number } {
  const closestX = Math.max(r.x, Math.min(cx, r.x + r.w));
  const closestY = Math.max(r.y, Math.min(cy, r.y + r.h));
  const dx = cx - closestX;
  const dy = cy - closestY;
  const distSq = dx * dx + dy * dy;
  if (distSq >= radius * radius) return { x: cx, y: cy };
  const dist = Math.sqrt(distSq);
  if (dist > 0.0001) {
    const push = radius - dist;
    return { x: cx + (dx / dist) * push, y: cy + (dy / dist) * push };
  }
  const leftPen = cx - r.x;
  const rightPen = r.x + r.w - cx;
  const topPen = cy - r.y;
  const bottomPen = r.y + r.h - cy;
  const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);
  if (minPen === leftPen) return { x: r.x - radius, y: cy };
  if (minPen === rightPen) return { x: r.x + r.w + radius, y: cy };
  if (minPen === topPen) return { x: cx, y: r.y - radius };
  return { x: cx, y: r.y + r.h + radius };
}

export function calculateWeaponDamage(params: {
  weaponId: FreeFireWeaponId;
  isHeadshot: boolean;
  targetArmor: number;
  damageReductionRate?: number;
}): { hpDamage: number; armorDamage: number; remainingArmor: number } {
  const spec = FREE_FIRE_WEAPONS[params.weaponId];
  const raw = Math.round(spec.damage * (params.isHeadshot ? spec.headshotMult : 1));
  const reduction = Math.min(0.45, Math.max(0, params.damageReductionRate ?? 0));
  const afterPerk = Math.max(1, Math.round(raw * (1 - reduction)));

  if (params.targetArmor <= 0) {
    return { hpDamage: afterPerk, armorDamage: 0, remainingArmor: 0 };
  }

  const absorbed = Math.min(params.targetArmor, Math.round(afterPerk * (params.isHeadshot ? 0.2 : 0.45)));
  const hpDamage = Math.max(1, afterPerk - absorbed);
  return {
    hpDamage,
    armorDamage: absorbed,
    remainingArmor: Math.max(0, params.targetArmor - absorbed),
  };
}

