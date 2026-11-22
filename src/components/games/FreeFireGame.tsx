import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Crosshair,
  Flame,
  Heart,
  Play,
  RotateCcw,
  Shield,
  Skull,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import {
  FREE_FIRE_CHARACTERS,
  FREE_FIRE_WEAPONS,
  type FreeFireCharacterId,
  type FreeFireWeaponId,
  type RectObstacle,
  calculateWeaponDamage,
  calculateZoneDamage,
  pointHitsRect,
  resolveCircleRectPush,
  stepCircleCollision,
} from '../../utils/gameLogic';
import { arcadeSfx } from './arcadeAudio';

interface FreeFireGameProps {
  onPhaseChange?: (phase: 'title' | 'playing' | 'gameover') => void;
}

type DropZoneId = 'clocktower' | 'pochinok' | 'peak';

interface DropZoneConfig {
  id: DropZoneId;
  name: string;
  subtitle: string;
  x: number;
  y: number;
}

const DROP_ZONES: Record<DropZoneId, DropZoneConfig> = {
  clocktower: {
    id: 'clocktower',
    name: 'Clock Tower',
    subtitle: 'Central high-loot compound',
    x: 600,
    y: 310,
  },
  pochinok: {
    id: 'pochinok',
    name: 'Pochinok',
    subtitle: 'South-west riverside town',
    x: 250,
    y: 690,
  },
  peak: {
    id: 'peak',
    name: 'Peak',
    subtitle: 'High-ground sniper ridge',
    x: 930,
    y: 230,
  },
};

const WORLD_W = 1200;
const WORLD_H = 900;
const VIEW_W = 640;
const VIEW_H = 400;
const TOTAL_PLAYERS = 20;
const MAX_ACTIVE_ENEMIES = 4;

interface BuildingObstacle extends RectObstacle {
  label?: string;
  roofColor: string;
}

const BERMUDA_BUILDINGS: BuildingObstacle[] = [
  // Clock Tower compound (spawn is at 600, 310 — clear radius around it)
  { x: 465, y: 210, w: 85, h: 55, label: 'CLOCK HALL', roofColor: '#475569' },
  { x: 655, y: 205, w: 90, h: 55, label: 'ARMORY', roofColor: '#52525b' },
  { x: 475, y: 375, w: 95, h: 50, label: 'SOUTH HOUSE', roofColor: '#3f3f46' },
  { x: 660, y: 370, w: 80, h: 55, roofColor: '#475569' },
  // Pochinok compound (spawn at 250, 690)
  { x: 120, y: 635, w: 80, h: 50, label: 'POCHINOK N', roofColor: '#7c2d12' },
  { x: 135, y: 745, w: 95, h: 55, roofColor: '#78350f' },
  { x: 325, y: 645, w: 85, h: 50, label: 'DEPOT', roofColor: '#713f12' },
  { x: 330, y: 745, w: 90, h: 50, roofColor: '#57534e' },
  // Peak compound (spawn at 930, 230)
  { x: 800, y: 145, w: 90, h: 50, label: 'PEAK MANOR', roofColor: '#334155' },
  { x: 1005, y: 145, w: 85, h: 55, roofColor: '#475569' },
  { x: 810, y: 295, w: 80, h: 50, roofColor: '#3f3f46' },
  { x: 1005, y: 290, w: 90, h: 55, label: 'WATCHTOWER', roofColor: '#1e293b' },
  // Mill / Shipyard / Mid-map ruins
  { x: 165, y: 170, w: 100, h: 60, label: 'MILL', roofColor: '#374151' },
  { x: 205, y: 380, w: 95, h: 55, label: 'BIMA SHAKTI', roofColor: '#4b5563' },
  { x: 745, y: 675, w: 105, h: 60, label: 'FACTORY', roofColor: '#334155' },
  { x: 960, y: 685, w: 95, h: 55, label: 'CAPE TOWN', roofColor: '#78350f' },
];

interface GlooWall extends RectObstacle {
  id: number;
  ttl: number;
  hp: number;
}

interface RedBarrel {
  id: number;
  x: number;
  y: number;
  hp: number;
  exploded: boolean;
}

interface LootDrop {
  id: number;
  x: number;
  y: number;
  kind: 'medkit' | 'mushroom' | 'vest' | 'gloo' | 'airdrop';
}

interface EnemyBot {
  id: number;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  armor: number;
  shootCd: number;
  strafeSign: number;
  strafeTimer: number;
  weapon: FreeFireWeaponId;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromPlayer: boolean;
  weapon: FreeFireWeaponId;
  distLeft: number;
  firstShotBoost?: boolean;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  ttl: number;
}

interface ExplosionRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  ttl: number;
  color: string;
}

interface HudSnapshot {
  hp: number;
  maxHp: number;
  ep: number;
  armor: number;
  weapon: FreeFireWeaponId;
  glooWalls: number;
  medkits: number;
  kills: number;
  headshots: number;
  damageDealt: number;
  aliveCount: number;
  zoneRadius: number;
  outsideZone: boolean;
  skillCooldown: number;
  skillActiveTimer: number;
  parachuting: boolean;
  killFeed: string[];
}

const BOT_NAMES = [
  'RAISTAR_99',
  'M8N_SNIPER',
  'B2K_BERMUDA',
  'NOOB_SLAYER',
  'ALOK_BEAT',
  'KELLY_DASH',
  'HAYATO_OP',
  'CLOCK_KING',
  'AWM_LEGEND',
  'GLOO_MASTER',
  'PEAK_RUSH',
  'BOOYAH_PRO',
  'POCHINOK_77',
  'ONE_TAP_GG',
  'KARNATAKA_FF',
  'BENGALURU_X',
  'MYSURU_ACE',
  'VIKRAM_OPS',
  'RUSH_SQUAD',
];

const INITIAL_BARRELS: RedBarrel[] = [
  { id: 1, x: 565, y: 270, hp: 35, exploded: false },
  { id: 2, x: 635, y: 355, hp: 35, exploded: false },
  { id: 3, x: 240, y: 635, hp: 35, exploded: false },
  { id: 4, x: 915, y: 280, hp: 35, exploded: false },
  { id: 5, x: 290, y: 390, hp: 35, exploded: false },
  { id: 6, x: 765, y: 630, hp: 35, exploded: false },
];

export function FreeFireGame({ onPhaseChange }: FreeFireGameProps) {
  const [phase, setPhase] = useState<'title' | 'playing' | 'gameover'>('title');
  const [selectedChar, setSelectedChar] = useState<FreeFireCharacterId>('alok');
  const [selectedDrop, setSelectedDrop] = useState<DropZoneId>('clocktower');
  const [matchResult, setMatchResult] = useState<{
    booyah: boolean;
    rank: number;
    kills: number;
    headshots: number;
    damageDealt: number;
    cause: string;
  } | null>(null);

  const [hud, setHud] = useState<HudSnapshot>({
    hp: 200,
    maxHp: 200,
    ep: 40,
    armor: 0,
    weapon: 'scar',
    glooWalls: 3,
    medkits: 2,
    kills: 0,
    headshots: 0,
    damageDealt: 0,
    aliveCount: TOTAL_PLAYERS,
    zoneRadius: 680,
    outsideZone: false,
    skillCooldown: 0,
    skillActiveTimer: 0,
    parachuting: false,
    killFeed: [],
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reqRef = useRef<number>(0);

  const simRef = useRef({
    px: 600,
    py: 310,
    aimAngle: 0,
    mouseActive: false,
    mouseCanvasX: VIEW_W / 2 + 80,
    mouseCanvasY: VIEW_H / 2,
    hp: 200,
    maxHp: 200,
    ep: 40,
    armor: 0,
    weapon: 'scar' as FreeFireWeaponId,
    character: 'alok' as FreeFireCharacterId,
    glooWallsCount: 3,
    medkits: 2,
    kills: 0,
    headshots: 0,
    damageDealt: 0,
    remainingSpawns: TOTAL_PLAYERS - 1,
    aliveCount: TOTAL_PLAYERS,
    fireCooldown: 0,
    firstShotReady: true,
    skillCooldown: 0,
    skillActiveTimer: 0,
    parachuteTimer: 0,
    spawnShieldTimer: 0,
    zoneX: WORLD_W / 2,
    zoneY: WORLD_H / 2,
    zoneRadius: 680,
    zoneTick: 0,
    epTick: 0,
    airdropTimer: 16,
    nextEntityId: 100,
    botNameCursor: 0,
    keys: {} as Record<string, boolean>,
    enemies: [] as EnemyBot[],
    bullets: [] as Projectile[],
    glooWalls: [] as GlooWall[],
    barrels: [] as RedBarrel[],
    loots: [] as LootDrop[],
    floats: [] as FloatingText[],
    explosions: [] as ExplosionRing[],
    killFeed: [] as string[],
    active: false,
  });

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  const syncHudNow = useCallback(() => {
    const s = simRef.current;
    const distFromZone = Math.hypot(s.px - s.zoneX, s.py - s.zoneY);
    setHud({
      hp: Math.max(0, Math.round(s.hp)),
      maxHp: s.maxHp,
      ep: Math.round(s.ep),
      armor: Math.round(s.armor),
      weapon: s.weapon,
      glooWalls: s.glooWallsCount,
      medkits: s.medkits,
      kills: s.kills,
      headshots: s.headshots,
      damageDealt: Math.round(s.damageDealt),
      aliveCount: s.aliveCount,
      zoneRadius: Math.round(s.zoneRadius),
      outsideZone: distFromZone > s.zoneRadius,
      skillCooldown: Math.ceil(s.skillCooldown),
      skillActiveTimer: Math.ceil(s.skillActiveTimer),
      parachuting: s.parachuteTimer > 0,
      killFeed: [...s.killFeed],
    });
  }, []);

  const pushKillFeed = (entry: string) => {
    const s = simRef.current;
    s.killFeed = [entry, ...s.killFeed.slice(0, 3)];
  };

  const spawnBot = (nearPlayer: boolean) => {
    const s = simRef.current;
    if (s.remainingSpawns <= 0) return;
    s.remainingSpawns -= 1;

    let bx = 200;
    let by = 200;
    for (let attempt = 0; attempt < 15; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = nearPlayer ? 290 + Math.random() * 190 : 340 + Math.random() * 340;
      bx = Math.max(70, Math.min(WORLD_W - 70, s.px + Math.cos(angle) * dist));
      by = Math.max(70, Math.min(WORLD_H - 70, s.py + Math.sin(angle) * dist));
      const blocked = BERMUDA_BUILDINGS.some((b) => pointHitsRect(bx, by, 22, b));
      if (!blocked) break;
    }

    const weapons: FreeFireWeaponId[] = ['scar', 'mp40', 'm1887', 'scar'];
    const botWeapon = weapons[s.botNameCursor % weapons.length];
    const botName = BOT_NAMES[s.botNameCursor % BOT_NAMES.length];
    s.botNameCursor += 1;

    s.enemies.push({
      id: s.nextEntityId++,
      name: botName,
      x: bx,
      y: by,
      vx: 0,
      vy: 0,
      hp: 85 + Math.min(35, s.kills * 3),
      maxHp: 85 + Math.min(35, s.kills * 3),
      armor: s.kills >= 5 ? 25 : 10,
      shootCd: 1.4 + Math.random() * 1.1,
      strafeSign: Math.random() < 0.5 ? -1 : 1,
      strafeTimer: 1.5 + Math.random() * 2,
      weapon: botWeapon,
    });
  };

  const createInitialLoots = (): LootDrop[] => {
    const spots: Array<{ x: number; y: number; kind: LootDrop['kind'] }> = [
      { x: 560, y: 310, kind: 'vest' },
      { x: 640, y: 315, kind: 'gloo' },
      { x: 590, y: 255, kind: 'mushroom' },
      { x: 255, y: 645, kind: 'vest' },
      { x: 295, y: 710, kind: 'medkit' },
      { x: 920, y: 195, kind: 'vest' },
      { x: 960, y: 255, kind: 'gloo' },
      { x: 420, y: 460, kind: 'mushroom' },
      { x: 710, y: 470, kind: 'medkit' },
      { x: 450, y: 740, kind: 'mushroom' },
      { x: 840, y: 630, kind: 'gloo' },
      { x: 270, y: 290, kind: 'medkit' },
    ];
    return spots.map((spot, i) => ({ id: i + 1, ...spot }));
  };

  const startGame = () => {
    const drop = DROP_ZONES[selectedDrop];
    const charSpec = FREE_FIRE_CHARACTERS[selectedChar];
    const s = simRef.current;

    s.px = drop.x;
    s.py = drop.y;
    s.aimAngle = 0;
    s.mouseActive = false;
    s.hp = 200;
    s.maxHp = 200;
    s.ep = 40;
    s.armor = charSpec.armorBonus;
    s.weapon = 'scar';
    s.character = selectedChar;
    s.glooWallsCount = 3;
    s.medkits = 2;
    s.kills = 0;
    s.headshots = 0;
    s.damageDealt = 0;
    s.remainingSpawns = TOTAL_PLAYERS - 1;
    s.aliveCount = TOTAL_PLAYERS;
    s.fireCooldown = 0;
    s.firstShotReady = true;
    s.skillCooldown = 0;
    s.skillActiveTimer = 0;
    s.parachuteTimer = 1.2;
    s.spawnShieldTimer = 2.5;
    s.zoneX = WORLD_W / 2;
    s.zoneY = WORLD_H / 2;
    s.zoneRadius = 680;
    s.zoneTick = 0;
    s.epTick = 0;
    s.airdropTimer = 14;
    s.nextEntityId = 100;
    s.botNameCursor = 0;
    s.keys = {};
    s.enemies = [];
    s.bullets = [];
    s.glooWalls = [];
    s.barrels = INITIAL_BARRELS.map((b) => ({ ...b }));
    s.loots = createInitialLoots();
    s.floats = [
      {
        x: drop.x,
        y: drop.y - 26,
        text: `LANDING: ${drop.name.toUpperCase()}`,
        color: '#fbbf24',
        ttl: 1.8,
      },
    ];
    s.explosions = [];
    s.killFeed = [`Dropped into ${drop.name} · ${charSpec.name}`];
    s.active = true;

    for (let i = 0; i < MAX_ACTIVE_ENEMIES; i++) {
      spawnBot(i < 3);
    }

    setMatchResult(null);
    syncHudNow();
    setPhase('playing');
    arcadeSfx.coin();
  };

  const endGame = useCallback((booyah: boolean, cause: string) => {
    const s = simRef.current;
    if (!s.active) return;
    s.active = false;
    const rank = booyah ? 1 : Math.max(2, s.aliveCount);
    setMatchResult({
      booyah,
      rank,
      kills: s.kills,
      headshots: s.headshots,
      damageDealt: Math.round(s.damageDealt),
      cause,
    });
    if (booyah) {
      arcadeSfx.victory();
    } else {
      arcadeSfx.error();
    }
    setPhase('gameover');
  }, []);

  const getAutoAimAngle = () => {
    const s = simRef.current;
    if (s.mouseActive) {
      const camX = Math.max(0, Math.min(WORLD_W - VIEW_W, s.px - VIEW_W / 2));
      const camY = Math.max(0, Math.min(WORLD_H - VIEW_H, s.py - VIEW_H / 2));
      const worldMouseX = camX + s.mouseCanvasX;
      const worldMouseY = camY + s.mouseCanvasY;
      return Math.atan2(worldMouseY - s.py, worldMouseX - s.px);
    }
    let nearest: EnemyBot | null = null;
    let bestDist = Infinity;
    for (const enemy of s.enemies) {
      const d = Math.hypot(enemy.x - s.px, enemy.y - s.py);
      if (d < bestDist) {
        bestDist = d;
        nearest = enemy;
      }
    }
    if (nearest && bestDist < 540) {
      return Math.atan2(nearest.y - s.py, nearest.x - s.px);
    }
    return s.aimAngle;
  };

  const fireWeapon = useCallback(() => {
    const s = simRef.current;
    if (!s.active || s.parachuteTimer > 0 || s.fireCooldown > 0) return;

    const spec = FREE_FIRE_WEAPONS[s.weapon];
    s.fireCooldown = spec.fireRateSec;
    const baseAngle = getAutoAimAngle();
    s.aimAngle = baseAngle;

    for (let i = 0; i < spec.pellets; i++) {
      const spread = (Math.random() - 0.5) * spec.spreadRad;
      const a = baseAngle + spread;
      s.bullets.push({
        x: s.px + Math.cos(a) * 18,
        y: s.py + Math.sin(a) * 18,
        vx: Math.cos(a) * spec.bulletSpeed,
        vy: Math.sin(a) * spec.bulletSpeed,
        fromPlayer: true,
        weapon: s.weapon,
        distLeft: spec.rangePx,
        firstShotBoost: s.firstShotReady,
      });
    }
    s.firstShotReady = false;
    arcadeSfx.shoot();
  }, []);

  const deployGlooWall = useCallback(() => {
    const s = simRef.current;
    if (!s.active || s.parachuteTimer > 0 || s.glooWallsCount <= 0) return;
    s.glooWallsCount -= 1;

    const angle = getAutoAimAngle();
    const cx = s.px + Math.cos(angle) * 44;
    const cy = s.py + Math.sin(angle) * 44;
    const horizontal = Math.abs(Math.sin(angle)) >= Math.abs(Math.cos(angle));
    const w = horizontal ? 68 : 16;
    const h = horizontal ? 16 : 68;

    s.glooWalls.push({
      id: s.nextEntityId++,
      x: Math.max(12, Math.min(WORLD_W - w - 12, cx - w / 2)),
      y: Math.max(12, Math.min(WORLD_H - h - 12, cy - h / 2)),
      w,
      h,
      ttl: 14,
      hp: 160,
    });
    s.floats.push({ x: cx, y: cy - 16, text: 'GLOO WALL!', color: '#38bdf8', ttl: 0.9 });
    arcadeSfx.coin();
    syncHudNow();
  }, [syncHudNow]);

  const useMedkit = useCallback(() => {
    const s = simRef.current;
    if (!s.active || s.medkits <= 0 || s.hp >= s.maxHp) return;
    s.medkits -= 1;
    s.hp = Math.min(s.maxHp, s.hp + 60);
    s.floats.push({ x: s.px, y: s.py - 22, text: '+60 HP MEDKIT', color: '#4ade80', ttl: 1.0 });
    arcadeSfx.coin();
    syncHudNow();
  }, [syncHudNow]);

  const activateCharacterSkill = useCallback(() => {
    const s = simRef.current;
    if (!s.active || s.parachuteTimer > 0 || s.skillCooldown > 0) return;
    if (s.character === 'alok') {
      s.skillActiveTimer = 6;
      s.skillCooldown = 16;
      s.hp = Math.min(s.maxHp, s.hp + 15);
      s.floats.push({ x: s.px, y: s.py - 24, text: 'DROP THE BEAT!', color: '#10b981', ttl: 1.2 });
    } else if (s.character === 'kelly') {
      s.skillActiveTimer = 4.5;
      s.skillCooldown = 12;
      s.firstShotReady = true;
      s.floats.push({ x: s.px, y: s.py - 24, text: 'DEADLY VELOCITY!', color: '#fbbf24', ttl: 1.2 });
    } else {
      s.skillActiveTimer = 5;
      s.skillCooldown = 14;
      s.armor = Math.min(100, s.armor + 25);
      s.floats.push({ x: s.px, y: s.py - 24, text: 'BUSHIDO SHIELD!', color: '#f87171', ttl: 1.2 });
    }
    arcadeSfx.coin();
    syncHudNow();
  }, [syncHudNow]);

  const switchWeapon = useCallback(
    (weaponId: FreeFireWeaponId) => {
      const s = simRef.current;
      s.weapon = weaponId;
      s.firstShotReady = true;
      syncHudNow();
    },
    [syncHudNow]
  );

  // Keyboard listener
  useEffect(() => {
    if (phase !== 'playing') return;

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) {
        e.preventDefault();
      }
      simRef.current.keys[k] = true;

      if (k === ' ' || k === 'f') fireWeapon();
      if (k === 'g') deployGlooWall();
      if (k === 'h') useMedkit();
      if (k === 'e') activateCharacterSkill();
      if (k === '1') switchWeapon('scar');
      if (k === '2') switchWeapon('mp40');
      if (k === '3') switchWeapon('m1887');
      if (k === '4') switchWeapon('awm');
    };

    const onKeyUp = (e: KeyboardEvent) => {
      simRef.current.keys[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [phase, fireWeapon, deployGlooWall, useMedkit, activateCharacterSkill, switchWeapon]);

  // Main 60fps Canvas Loop
  useEffect(() => {
    if (phase !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();
    let hudSyncAccum = 0;

    const detonateBarrel = (barrel: RedBarrel) => {
      const s = simRef.current;
      barrel.exploded = true;
      s.explosions.push({
        x: barrel.x,
        y: barrel.y,
        radius: 10,
        maxRadius: 115,
        ttl: 0.45,
        color: '#f97316',
      });
      s.floats.push({ x: barrel.x, y: barrel.y - 18, text: 'BOOM!', color: '#fb923c', ttl: 1.0 });
      arcadeSfx.hit();

      const playerDist = Math.hypot(s.px - barrel.x, s.py - barrel.y);
      if (playerDist < 110) {
        const dmg = Math.round((1 - playerDist / 110) * 55);
        s.hp -= dmg;
        s.floats.push({ x: s.px, y: s.py - 20, text: `-${dmg}`, color: '#f43f5e', ttl: 0.9 });
      }

      for (const enemy of s.enemies) {
        const d = Math.hypot(enemy.x - barrel.x, enemy.y - barrel.y);
        if (d < 120) {
          const dmg = Math.round((1 - d / 120) * 110);
          enemy.hp -= dmg;
          s.damageDealt += dmg;
          s.floats.push({ x: enemy.x, y: enemy.y - 16, text: `${dmg}`, color: '#fb923c', ttl: 0.9 });
        }
      }
    };

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const s = simRef.current;

      if (s.active) {
        // Timers
        s.fireCooldown = Math.max(0, s.fireCooldown - dt);
        s.skillCooldown = Math.max(0, s.skillCooldown - dt);
        if (s.skillActiveTimer > 0) {
          s.skillActiveTimer = Math.max(0, s.skillActiveTimer - dt);
          if (s.character === 'alok') {
            s.hp = Math.min(s.maxHp, s.hp + dt * 5);
          }
        }
        if (s.parachuteTimer > 0) {
          s.parachuteTimer = Math.max(0, s.parachuteTimer - dt);
        } else if (s.spawnShieldTimer > 0) {
          s.spawnShieldTimer = Math.max(0, s.spawnShieldTimer - dt);
        }

        // Player movement
        const charSpec = FREE_FIRE_CHARACTERS[s.character];
        let speedBoost = charSpec.speedMultiplier;
        if (s.skillActiveTimer > 0 && s.character === 'kelly') speedBoost *= 1.35;
        if (s.skillActiveTimer > 0 && s.character === 'alok') speedBoost *= 1.15;
        const moveSpeed = (s.parachuteTimer > 0 ? 110 : 195) * speedBoost;

        let mx = 0;
        let my = 0;
        if (s.keys['w'] || s.keys['arrowup']) my -= 1;
        if (s.keys['s'] || s.keys['arrowdown']) my += 1;
        if (s.keys['a'] || s.keys['arrowleft']) mx -= 1;
        if (s.keys['d'] || s.keys['arrowright']) mx += 1;
        if (mx !== 0 || my !== 0) {
          const mag = Math.hypot(mx, my);
          s.px += (mx / mag) * moveSpeed * dt;
          s.py += (my / mag) * moveSpeed * dt;
          if (!s.mouseActive) {
            s.aimAngle = Math.atan2(my, mx);
          }
        }

        // Clamp world & resolve building/gloo collisions
        s.px = Math.max(26, Math.min(WORLD_W - 26, s.px));
        s.py = Math.max(26, Math.min(WORLD_H - 26, s.py));
        if (s.parachuteTimer <= 0) {
          for (const b of BERMUDA_BUILDINGS) {
            const pushed = resolveCircleRectPush(s.px, s.py, 15, b);
            s.px = pushed.x;
            s.py = pushed.y;
          }
          for (const g of s.glooWalls) {
            const pushed = resolveCircleRectPush(s.px, s.py, 15, g);
            s.px = pushed.x;
            s.py = pushed.y;
          }
        }

        // Hold space/fire continuous auto-fire
        if (s.keys[' '] || s.keys['f']) {
          fireWeapon();
        }

        // EP -> HP passive heal
        s.epTick += dt;
        if (s.epTick >= 1.0) {
          s.epTick = 0;
          if (s.ep > 0 && s.hp < s.maxHp) {
            const heal = Math.min(3, s.ep, s.maxHp - s.hp);
            s.ep -= heal;
            s.hp += heal;
          }
        }

        // Safe zone shrink + outside damage
        s.zoneRadius = Math.max(120, s.zoneRadius - dt * 6.5);
        s.zoneTick += dt;
        if (s.zoneTick >= 1.0) {
          s.zoneTick = 0;
          const zoneDmg = calculateZoneDamage(s.px, s.py, s.zoneX, s.zoneY, s.zoneRadius);
          if (zoneDmg > 0 && s.parachuteTimer <= 0) {
            s.hp -= zoneDmg;
            s.floats.push({ x: s.px, y: s.py - 22, text: `-${zoneDmg} ZONE`, color: '#fb923c', ttl: 0.7 });
          }
          for (const e of s.enemies) {
            const eZoneDmg = calculateZoneDamage(e.x, e.y, s.zoneX, s.zoneY, s.zoneRadius);
            if (eZoneDmg > 0) e.hp -= eZoneDmg;
          }
        }

        // Periodic Golden Airdrop
        s.airdropTimer -= dt;
        if (s.airdropTimer <= 0) {
          s.airdropTimer = 24;
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * Math.max(80, s.zoneRadius * 0.55);
          const ax = Math.max(80, Math.min(WORLD_W - 80, s.zoneX + Math.cos(a) * r));
          const ay = Math.max(80, Math.min(WORLD_H - 80, s.zoneY + Math.sin(a) * r));
          s.loots.push({ id: s.nextEntityId++, x: ax, y: ay, kind: 'airdrop' });
          pushKillFeed('Golden Airdrop landed in Safe Zone!');
        }

        // Collect Loots
        for (let i = s.loots.length - 1; i >= 0; i--) {
          const loot = s.loots[i];
          if (stepCircleCollision(s.px, s.py, 16, loot.x, loot.y, 14)) {
            if (loot.kind === 'medkit') {
              s.medkits = Math.min(5, s.medkits + 1);
              s.floats.push({ x: loot.x, y: loot.y - 12, text: '+1 MEDKIT', color: '#4ade80', ttl: 0.9 });
            } else if (loot.kind === 'mushroom') {
              s.ep = Math.min(100, s.ep + 45);
              s.floats.push({ x: loot.x, y: loot.y - 12, text: '+45 EP', color: '#facc15', ttl: 0.9 });
            } else if (loot.kind === 'vest') {
              s.armor = Math.min(100, s.armor + 45);
              s.floats.push({ x: loot.x, y: loot.y - 12, text: '+ARMOR VEST', color: '#60a5fa', ttl: 0.9 });
            } else if (loot.kind === 'gloo') {
              s.glooWallsCount = Math.min(6, s.glooWallsCount + 1);
              s.floats.push({ x: loot.x, y: loot.y - 12, text: '+1 GLOO WALL', color: '#38bdf8', ttl: 0.9 });
            } else if (loot.kind === 'airdrop') {
              s.armor = 100;
              s.medkits = Math.min(5, s.medkits + 1);
              s.glooWallsCount = Math.min(6, s.glooWallsCount + 2);
              s.weapon = 'awm';
              s.floats.push({ x: loot.x, y: loot.y - 14, text: 'AIRDROP: AWM + LV3 VEST!', color: '#fbbf24', ttl: 1.4 });
              pushKillFeed('Player secured Golden Airdrop (AWM + Lv3 Vest)');
            }
            arcadeSfx.coin();
            s.loots.splice(i, 1);
          }
        }

        // Gloo wall TTL
        for (let i = s.glooWalls.length - 1; i >= 0; i--) {
          s.glooWalls[i].ttl -= dt;
          if (s.glooWalls[i].ttl <= 0 || s.glooWalls[i].hp <= 0) {
            s.glooWalls.splice(i, 1);
          }
        }

        // Enemies AI + shooting
        for (const e of s.enemies) {
          const dx = s.px - e.x;
          const dy = s.py - e.y;
          const dist = Math.hypot(dx, dy) || 1;
          e.strafeTimer -= dt;
          if (e.strafeTimer <= 0) {
            e.strafeTimer = 1.4 + Math.random() * 1.5;
            e.strafeSign *= -1;
          }

          const nx = dx / dist;
          const ny = dy / dist;
          const pxPerp = -ny * e.strafeSign;
          const pyPerp = nx * e.strafeSign;

          const desiredSpeed = dist > 230 ? 92 : dist < 120 ? -45 : 25;
          e.x += (nx * desiredSpeed + pxPerp * 52) * dt;
          e.y += (ny * desiredSpeed + pyPerp * 52) * dt;
          e.x = Math.max(28, Math.min(WORLD_W - 28, e.x));
          e.y = Math.max(28, Math.min(WORLD_H - 28, e.y));

          for (const b of BERMUDA_BUILDINGS) {
            const pushed = resolveCircleRectPush(e.x, e.y, 14, b);
            e.x = pushed.x;
            e.y = pushed.y;
          }
          for (const g of s.glooWalls) {
            const pushed = resolveCircleRectPush(e.x, e.y, 14, g);
            e.x = pushed.x;
            e.y = pushed.y;
          }

          e.shootCd -= dt;
          if (e.shootCd <= 0 && dist < 390 && s.parachuteTimer <= 0 && s.spawnShieldTimer <= 0) {
            e.shootCd = 1.65 + Math.random() * 0.95;
            const aimErr = (Math.random() - 0.5) * 0.24;
            const shotAngle = Math.atan2(dy, dx) + aimErr;
            s.bullets.push({
              x: e.x + Math.cos(shotAngle) * 16,
              y: e.y + Math.sin(shotAngle) * 16,
              vx: Math.cos(shotAngle) * 320,
              vy: Math.sin(shotAngle) * 320,
              fromPlayer: false,
              weapon: e.weapon,
              distLeft: 380,
            });
          }
        }

        // Bullets update & hit resolution
        for (let i = s.bullets.length - 1; i >= 0; i--) {
          const b = s.bullets[i];
          const stepX = b.vx * dt;
          const stepY = b.vy * dt;
          b.x += stepX;
          b.y += stepY;
          b.distLeft -= Math.hypot(stepX, stepY);

          if (b.distLeft <= 0 || b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H) {
            s.bullets.splice(i, 1);
            continue;
          }

          // Check Building obstacle collision
          let blocked = false;
          for (const obs of BERMUDA_BUILDINGS) {
            if (pointHitsRect(b.x, b.y, 3, obs)) {
              blocked = true;
              break;
            }
          }
          if (blocked) {
            s.bullets.splice(i, 1);
            continue;
          }

          // Check Gloo Wall collision
          for (const g of s.glooWalls) {
            if (pointHitsRect(b.x, b.y, 3, g)) {
              g.hp -= 18;
              blocked = true;
              break;
            }
          }
          if (blocked) {
            s.bullets.splice(i, 1);
            continue;
          }

          // Check Explosive Barrel collision (player shots detonate tactical barrels)
          if (b.fromPlayer) {
            for (const barrel of s.barrels) {
              if (!barrel.exploded && stepCircleCollision(b.x, b.y, 4, barrel.x, barrel.y, 13)) {
                barrel.hp -= FREE_FIRE_WEAPONS[b.weapon].damage;
                if (barrel.hp <= 0) {
                  detonateBarrel(barrel);
                }
                blocked = true;
                break;
              }
            }
            if (blocked) {
              s.bullets.splice(i, 1);
              continue;
            }
          }

          if (b.fromPlayer) {
            let hitEnemy = false;
            for (const enemy of s.enemies) {
              if (stepCircleCollision(b.x, b.y, 4, enemy.x, enemy.y, 15)) {
                const spec = FREE_FIRE_WEAPONS[b.weapon];
                const kellyCrit = s.character === 'kelly' && (b.firstShotBoost || s.skillActiveTimer > 0) ? 0.18 : 0;
                const isHeadshot = Math.random() < spec.headshotChance + kellyCrit;
                const dmg = calculateWeaponDamage({
                  weaponId: b.weapon,
                  isHeadshot,
                  targetArmor: enemy.armor,
                });
                enemy.hp -= dmg.hpDamage;
                enemy.armor = dmg.remainingArmor;
                s.damageDealt += dmg.hpDamage;
                if (isHeadshot) s.headshots += 1;

                s.floats.push({
                  x: enemy.x + (Math.random() - 0.5) * 10,
                  y: enemy.y - 18,
                  text: isHeadshot ? `${dmg.hpDamage} HEADSHOT!` : `${dmg.hpDamage}`,
                  color: isHeadshot ? '#facc15' : '#ffffff',
                  ttl: 0.75,
                });
                arcadeSfx.hit();
                hitEnemy = true;
                break;
              }
            }
            if (hitEnemy) {
              s.bullets.splice(i, 1);
            }
          } else {
            if (
              s.parachuteTimer <= 0 &&
              s.spawnShieldTimer <= 0 &&
              stepCircleCollision(b.x, b.y, 4, s.px, s.py, 14)
            ) {
              const reduction =
                (s.character === 'hayato' ? 0.25 : 0) +
                (s.character === 'hayato' && s.skillActiveTimer > 0 ? 0.15 : 0);
              const dmg = calculateWeaponDamage({
                weaponId: b.weapon,
                isHeadshot: false,
                targetArmor: s.armor,
                damageReductionRate: reduction,
              });
              const scaledEnemyDmg = Math.max(3, Math.min(14, Math.round(dmg.hpDamage * 0.32)));
              s.hp -= scaledEnemyDmg;
              s.armor = dmg.remainingArmor;
              s.floats.push({
                x: s.px,
                y: s.py - 20,
                text: `-${scaledEnemyDmg}`,
                color: '#f43f5e',
                ttl: 0.7,
              });
              s.bullets.splice(i, 1);
            }
          }
        }

        // Remove defeated enemies & spawn loot/replacements
        for (let i = s.enemies.length - 1; i >= 0; i--) {
          const e = s.enemies[i];
          if (e.hp <= 0) {
            s.kills += 1;
            s.aliveCount = Math.max(1, TOTAL_PLAYERS - s.kills);
            pushKillFeed(`You eliminated ${e.name} (${FREE_FIRE_WEAPONS[s.weapon].name})`);

            const dropKinds: LootDrop['kind'][] = ['medkit', 'mushroom', 'gloo', 'vest'];
            s.loots.push({
              id: s.nextEntityId++,
              x: e.x,
              y: e.y,
              kind: dropKinds[s.kills % dropKinds.length],
            });
            s.enemies.splice(i, 1);
            if (s.remainingSpawns > 0 && s.enemies.length < MAX_ACTIVE_ENEMIES) {
              spawnBot(false);
            }
          }
        }

        // Floating text & explosion FX
        for (let i = s.floats.length - 1; i >= 0; i--) {
          s.floats[i].y -= dt * 26;
          s.floats[i].ttl -= dt;
          if (s.floats[i].ttl <= 0) s.floats.splice(i, 1);
        }
        for (let i = s.explosions.length - 1; i >= 0; i--) {
          const ex = s.explosions[i];
          ex.ttl -= dt;
          ex.radius = Math.min(ex.maxRadius, ex.radius + dt * 260);
          if (ex.ttl <= 0) s.explosions.splice(i, 1);
        }

        // Win / Loss checks
        if (s.hp <= 0) {
          s.hp = 0;
          syncHudNow();
          endGame(false, 'Eliminated on Bermuda Island');
          return;
        }
        if (s.aliveCount <= 1 || (s.remainingSpawns === 0 && s.enemies.length === 0)) {
          s.aliveCount = 1;
          syncHudNow();
          endGame(true, 'Last Survivor Standing');
          return;
        }
      }

      // Camera clamped to island
      const camX = Math.max(0, Math.min(WORLD_W - VIEW_W, s.px - VIEW_W / 2));
      const camY = Math.max(0, Math.min(WORLD_H - VIEW_H, s.py - VIEW_H / 2));

      // Draw World
      ctx.fillStyle = '#0c4a6e';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      ctx.save();
      ctx.translate(-camX, -camY);

      // Sand beach + Bermuda grass
      ctx.fillStyle = '#d6b37c';
      ctx.fillRect(16, 16, WORLD_W - 32, WORLD_H - 32);
      ctx.fillStyle = '#1e3a29';
      ctx.fillRect(42, 42, WORLD_W - 84, WORLD_H - 84);

      // Subtle grass grid texture
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let gx = 60; gx < WORLD_W - 40; gx += 80) {
        ctx.beginPath();
        ctx.moveTo(gx, 42);
        ctx.lineTo(gx, WORLD_H - 42);
        ctx.stroke();
      }
      for (let gy = 60; gy < WORLD_H - 40; gy += 80) {
        ctx.beginPath();
        ctx.moveTo(42, gy);
        ctx.lineTo(WORLD_W - 42, gy);
        ctx.stroke();
      }

      // River & 2 Wooden Bridges
      ctx.fillStyle = '#0e7490';
      ctx.fillRect(42, 540, WORLD_W - 84, 48);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(240, 535, 86, 58);
      ctx.fillRect(830, 535, 86, 58);

      // Roads linking Clock Tower, Peak, Pochinok
      ctx.strokeStyle = '#44403c';
      ctx.lineWidth = 34;
      ctx.beginPath();
      ctx.moveTo(250, 690);
      ctx.lineTo(600, 310);
      ctx.lineTo(930, 230);
      ctx.stroke();

      // Zone labels
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('CLOCK TOWER', 552, 300);
      ctx.fillText('POCHINOK', 210, 682);
      ctx.fillText('PEAK', 912, 222);

      // Safe Zone Ring
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(s.zoneX, s.zoneY, s.zoneRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(234, 88, 12, 0.14)';
      ctx.beginPath();
      ctx.rect(0, 0, WORLD_W, WORLD_H);
      ctx.arc(s.zoneX, s.zoneY, s.zoneRadius, 0, Math.PI * 2, true);
      ctx.fill();

      // Buildings
      for (const b of BERMUDA_BUILDINGS) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
        ctx.fillStyle = b.roofColor;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
        if (b.label) {
          ctx.fillStyle = '#e2e8f0';
          ctx.font = 'bold 9px monospace';
          ctx.fillText(b.label, b.x + 6, b.y + b.h / 2 + 3);
        }
      }

      // Gloo Walls
      for (const g of s.glooWalls) {
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(g.x, g.y, g.w, g.h);
        ctx.strokeStyle = '#cffafe';
        ctx.lineWidth = 2;
        ctx.strokeRect(g.x, g.y, g.w, g.h);
      }

      // Explosive Red Barrels
      for (const barrel of s.barrels) {
        if (barrel.exploded) continue;
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(barrel.x, barrel.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Loots
      for (const loot of s.loots) {
        if (loot.kind === 'medkit') {
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(loot.x - 8, loot.y - 8, 16, 16);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(loot.x - 2, loot.y - 5, 4, 10);
          ctx.fillRect(loot.x - 5, loot.y - 2, 10, 4);
        } else if (loot.kind === 'mushroom') {
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(loot.x, loot.y, 7, Math.PI, 0);
          ctx.fill();
          ctx.fillStyle = '#fef3c7';
          ctx.fillRect(loot.x - 3, loot.y, 6, 6);
        } else if (loot.kind === 'vest') {
          ctx.fillStyle = '#3b82f6';
          ctx.beginPath();
          ctx.arc(loot.x, loot.y, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#bfdbfe';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (loot.kind === 'gloo') {
          ctx.fillStyle = '#0ea5e9';
          ctx.fillRect(loot.x - 9, loot.y - 6, 18, 12);
          ctx.strokeStyle = '#e0f2fe';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(loot.x - 9, loot.y - 6, 18, 12);
        } else if (loot.kind === 'airdrop') {
          ctx.fillStyle = '#eab308';
          ctx.fillRect(loot.x - 13, loot.y - 13, 26, 26);
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(loot.x - 13, loot.y - 13, 26, 26);
        }
      }

      // Enemies
      for (const e of s.enemies) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(e.x, e.y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fee2e2';
        ctx.lineWidth = 2;
        ctx.stroke();

        // HP bar
        ctx.fillStyle = '#18181b';
        ctx.fillRect(e.x - 16, e.y - 22, 32, 5);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(e.x - 16, e.y - 22, 32 * Math.max(0, e.hp / e.maxHp), 5);
      }

      // Bullets
      for (const b of s.bullets) {
        ctx.fillStyle = b.fromPlayer ? FREE_FIRE_WEAPONS[b.weapon].color : '#fb7185';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.weapon === 'awm' ? 4.5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Explosions
      for (const ex of s.explosions) {
        ctx.strokeStyle = ex.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Player + Skill Aura + Weapon Barrel
      if (s.skillActiveTimer > 0) {
        ctx.strokeStyle = FREE_FIRE_CHARACTERS[s.character].accent;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.px, s.py, 28, 0, Math.PI * 2);
        ctx.stroke();
      }

      const aim = getAutoAimAngle();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(s.px, s.py);
      ctx.lineTo(s.px + Math.cos(aim) * 20, s.py + Math.sin(aim) * 20);
      ctx.stroke();

      ctx.fillStyle = FREE_FIRE_CHARACTERS[s.character].accent;
      ctx.beginPath();
      ctx.arc(s.px, s.py, s.parachuteTimer > 0 ? 18 : 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      if (s.parachuteTimer > 0) {
        ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
        ctx.beginPath();
        ctx.arc(s.px, s.py - 18, 22, Math.PI, 0);
        ctx.fill();
      }

      // Floating damage/pickup numbers
      ctx.font = 'bold 12px monospace';
      for (const f of s.floats) {
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x - 16, f.y);
      }

      ctx.restore();

      // In-canvas Minimap Radar (top-right)
      const mmW = 108;
      const mmH = 81;
      const mmX = VIEW_W - mmW - 10;
      const mmY = 10;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(mmX, mmY, mmW, mmH);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(mmX, mmY, mmW, mmH);

      const scaleX = mmW / WORLD_W;
      const scaleY = mmH / WORLD_H;

      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(mmX + s.zoneX * scaleX, mmY + s.zoneY * scaleY, s.zoneRadius * scaleX, 0, Math.PI * 2);
      ctx.stroke();

      for (const e of s.enemies) {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(mmX + e.x * scaleX - 1.5, mmY + e.y * scaleY - 1.5, 3, 3);
      }

      for (const l of s.loots) {
        if (l.kind === 'airdrop') {
          ctx.fillStyle = '#eab308';
          ctx.fillRect(mmX + l.x * scaleX - 2, mmY + l.y * scaleY - 2, 4, 4);
        }
      }

      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(mmX + s.px * scaleX, mmY + s.py * scaleY, 3, 0, Math.PI * 2);
      ctx.fill();

      // Throttle HUD state sync (~10Hz)
      hudSyncAccum += dt;
      if (hudSyncAccum >= 0.1) {
        hudSyncAccum = 0;
        syncHudNow();
      }

      reqRef.current = requestAnimationFrame(loop);
    };

    reqRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(reqRef.current);
  }, [phase, fireWeapon, endGame, syncHudNow]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const sy = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    simRef.current.mouseCanvasX = sx;
    simRef.current.mouseCanvasY = sy;
    simRef.current.mouseActive = true;
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handleCanvasMouseMove(e);
    fireWeapon();
  };

  const characterList = Object.values(FREE_FIRE_CHARACTERS);
  const weaponList = Object.values(FREE_FIRE_WEAPONS);

  return (
    <div className="space-y-3">
      {phase === 'title' && (
        <div className="py-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#151821] p-4 rounded-2xl border border-amber-500/30">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-400/50 flex items-center justify-center text-orange-300 shrink-0">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-50">
                  Free Fire · Bermuda Battle Royale
                </h2>
                <p className="text-xs text-stone-400">
                  20 Survivors · Parachute Drop · 4 Weapons · Gloo Walls · Active Character Skills · Shrinking Zone
                </p>
              </div>
            </div>
            <button
              type="button"
              data-start="true"
              data-testid="start-freefire-btn"
              onClick={startGame}
              className="min-h-[48px] px-6 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-stone-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shrink-0 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>BOOYAH! DROP IN</span>
            </button>
          </div>

          {/* Character Selector */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
              1. Select Character &amp; Active Skill
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {characterList.map((char) => {
                const active = selectedChar === char.id;
                return (
                  <button
                    key={char.id}
                    type="button"
                    data-testid={`ff-char-${char.id}`}
                    onClick={() => setSelectedChar(char.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-[#1a1f2e] border-amber-400 shadow-md'
                        : 'bg-[#12151f] border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-white">{char.name}</span>
                      <span
                        className="text-[10px] font-mono-tabular px-2 py-0.5 rounded-md font-semibold"
                        style={{ backgroundColor: `${char.accent}25`, color: char.accent }}
                      >
                        {char.skillName}
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-200/80 font-medium mt-0.5">{char.title}</p>
                    <p className="text-[11px] text-stone-400 mt-1 leading-snug">{char.skillDesc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Drop Zone & Weapon Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                2. Choose Bermuda Drop Zone
              </p>
              <div className="grid grid-cols-3 gap-2">
                {Object.values(DROP_ZONES).map((zone) => {
                  const active = selectedDrop === zone.id;
                  return (
                    <button
                      key={zone.id}
                      type="button"
                      data-testid={`ff-drop-${zone.id}`}
                      onClick={() => setSelectedDrop(zone.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-orange-500/20 border-orange-400 text-white'
                          : 'bg-[#12151f] border-white/10 text-stone-300 hover:border-white/25'
                      }`}
                    >
                      <p className="font-bold text-xs">{zone.name}</p>
                      <p className="text-[10px] text-stone-400 mt-0.5 leading-tight">{zone.subtitle}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                3. Full 4-Gun Loadout Included
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {weaponList.map((w) => (
                  <div
                    key={w.id}
                    className="p-2 rounded-xl bg-[#12151f] border border-white/10 text-center"
                  >
                    <p className="text-[10px] font-mono-tabular text-stone-400">[{w.slot}] {w.category}</p>
                    <p className="text-xs font-bold text-white mt-0.5">{w.name}</p>
                    <p className="text-[10px] font-mono-tabular text-amber-300 mt-0.5">
                      {w.pellets > 1 ? `${w.damage}×${w.pellets}` : w.damage} DMG
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {phase === 'playing' && (
        <div className="space-y-2.5">
          {/* Top Combat HUD */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 bg-[#151821] p-2.5 rounded-2xl border border-white/10 font-mono-tabular">
            <div className="col-span-2 sm:col-span-2 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5" /> HP {hud.hp}/{hud.maxHp}
                </span>
                <span className="text-amber-300">EP {hud.ep}</span>
                <span className="text-sky-300 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> {hud.armor}
                </span>
              </div>
              <div className="h-2 w-full rounded-md bg-stone-800 overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 transition-[width] duration-100"
                  style={{ width: `${Math.min(100, (hud.hp / hud.maxHp) * 100)}%` }}
                />
              </div>
            </div>

            <div className="text-center bg-[#0D0F16] rounded-xl px-2 py-1 border border-white/5">
              <p className="text-[10px] text-stone-400 uppercase">Alive</p>
              <p data-testid="ff-alive-count" className="text-sm font-bold text-amber-300">
                {hud.aliveCount}
              </p>
            </div>
            <div className="text-center bg-[#0D0F16] rounded-xl px-2 py-1 border border-white/5">
              <p className="text-[10px] text-stone-400 uppercase">Kills / HS</p>
              <p data-testid="ff-kills-count" className="text-sm font-bold text-rose-400">
                {hud.kills} / {hud.headshots}
              </p>
            </div>
            <div className="text-center bg-[#0D0F16] rounded-xl px-2 py-1 border border-white/5">
              <p className="text-[10px] text-stone-400 uppercase">Gloo / Med</p>
              <p className="text-sm font-bold text-sky-300">
                {hud.glooWalls} / {hud.medkits}
              </p>
            </div>
            <div className="text-center bg-[#0D0F16] rounded-xl px-2 py-1 border border-white/5">
              <p className="text-[10px] text-stone-400 uppercase">Safe Zone</p>
              <p
                className={`text-sm font-bold ${
                  hud.outsideZone ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {hud.outsideZone ? 'OUTSIDE!' : `${hud.zoneRadius}m`}
              </p>
            </div>
          </div>

          {/* Bermuda Canvas Viewport */}
          <div className="relative w-full flex justify-center rounded-2xl overflow-hidden border border-white/15 bg-stone-950">
            <canvas
              ref={canvasRef}
              width={VIEW_W}
              height={VIEW_H}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={() => {
                simRef.current.mouseActive = false;
              }}
              onMouseDown={handleCanvasMouseDown}
              className="w-full max-w-[640px] aspect-[16/10] cursor-crosshair block"
            />
            {hud.killFeed.length > 0 && (
              <div className="absolute top-2 left-2 space-y-1 pointer-events-none">
                {hud.killFeed.slice(0, 2).map((line, i) => (
                  <div
                    key={i}
                    className="px-2 py-0.5 rounded-md bg-black/75 border border-white/10 text-[10px] font-mono-tabular text-amber-200"
                  >
                    {line}
                  </div>
                ))}
              </div>
            )}
            {hud.parachuting && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg bg-amber-500 text-stone-950 text-xs font-bold">
                Parachuting to {DROP_ZONES[selectedDrop].name}...
              </div>
            )}
          </div>

          {/* Weapon Slots + Combat Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#151821] p-2.5 rounded-2xl border border-white/10">
            <div className="flex flex-wrap items-center gap-1.5">
              {weaponList.map((w) => {
                const active = hud.weapon === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    data-testid={`ff-weapon-${w.id}`}
                    onClick={() => switchWeapon(w.id)}
                    className={`min-h-[38px] px-2.5 rounded-xl text-xs font-mono-tabular font-bold border transition-colors cursor-pointer ${
                      active
                        ? 'bg-amber-400 text-stone-950 border-amber-300'
                        : 'bg-white/5 text-stone-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {w.slot}:{w.name}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                data-testid="ff-gloo-btn"
                onClick={deployGlooWall}
                disabled={hud.glooWalls <= 0}
                className="min-h-[38px] px-3 rounded-xl bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/50 text-sky-200 text-xs font-semibold flex items-center gap-1 disabled:opacity-40 cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Gloo [G] ({hud.glooWalls})</span>
              </button>

              <button
                type="button"
                data-testid="ff-medkit-btn"
                onClick={useMedkit}
                disabled={hud.medkits <= 0 || hud.hp >= hud.maxHp}
                className="min-h-[38px] px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/50 text-emerald-200 text-xs font-semibold flex items-center gap-1 disabled:opacity-40 cursor-pointer"
              >
                <Heart className="w-3.5 h-3.5" />
                <span>Med [H] ({hud.medkits})</span>
              </button>

              <button
                type="button"
                data-testid="ff-skill-btn"
                onClick={activateCharacterSkill}
                disabled={hud.skillCooldown > 0}
                className="min-h-[38px] px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 text-xs font-semibold flex items-center gap-1 disabled:opacity-45 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>
                  {hud.skillActiveTimer > 0
                    ? `Active ${hud.skillActiveTimer}s`
                    : hud.skillCooldown > 0
                      ? `CD ${hud.skillCooldown}s`
                      : `Skill [E]`}
                </span>
              </button>

              <button
                type="button"
                data-testid="ff-fire-btn"
                onClick={fireWeapon}
                className="min-h-[38px] px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1 shadow-md cursor-pointer"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>FIRE [SPACE]</span>
              </button>
            </div>
          </div>

          <p className="text-[11px] text-stone-400 text-center font-mono-tabular">
            Move: WASD / Arrows · Aim &amp; Shoot: Mouse Click or Space · Weapons: 1–4 · Gloo Wall: G · Medkit: H · Skill: E
          </p>
        </div>
      )}

      {phase === 'gameover' && matchResult && (
        <div className="py-8 flex flex-col items-center text-center space-y-5 bg-[#12151f] rounded-2xl border border-white/10 p-6">
          <div
            className={`w-16 h-16 rounded-2xl border flex items-center justify-center ${
              matchResult.booyah
                ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                : 'bg-rose-500/20 border-rose-400/40 text-rose-300'
            }`}
          >
            {matchResult.booyah ? <Trophy className="w-8 h-8" /> : <Skull className="w-8 h-8" />}
          </div>

          <div className="space-y-1">
            <p className="text-xs font-mono-tabular uppercase tracking-widest text-amber-300">
              Rank #{matchResult.rank} / {TOTAL_PLAYERS} · {FREE_FIRE_CHARACTERS[selectedChar].name}
            </p>
            <h3 className="font-display text-3xl font-bold text-stone-50">
              {matchResult.booyah ? 'BOOYAH! BERMUDA CHAMPION' : 'MATCH ELIMINATED'}
            </h3>
            <p className="text-xs text-stone-400">{matchResult.cause}</p>
          </div>

          <div className="grid grid-cols-3 gap-3 w-full max-w-md font-mono-tabular">
            <div className="p-3 rounded-xl bg-[#080A0F] border border-white/10">
              <p className="text-[10px] text-stone-400 uppercase">Kills</p>
              <p className="text-xl font-bold text-rose-400">{matchResult.kills}</p>
            </div>
            <div className="p-3 rounded-xl bg-[#080A0F] border border-white/10">
              <p className="text-[10px] text-stone-400 uppercase">Headshots</p>
              <p className="text-xl font-bold text-amber-300">{matchResult.headshots}</p>
            </div>
            <div className="p-3 rounded-xl bg-[#080A0F] border border-white/10">
              <p className="text-[10px] text-stone-400 uppercase">Damage</p>
              <p className="text-xl font-bold text-emerald-400">{matchResult.damageDealt}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={startGame}
              className="min-h-[46px] px-6 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-stone-950 font-bold text-sm flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Play Again</span>
            </button>
            <button
              type="button"
              onClick={() => setPhase('title')}
              className="min-h-[46px] px-5 rounded-2xl bg-white/10 hover:bg-white/20 text-stone-200 font-semibold text-sm flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Change Loadout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
