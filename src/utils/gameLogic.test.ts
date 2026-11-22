import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALPHABET_LETTERS,
  ALPHABET_WORD_CHALLENGES,
  FREE_FIRE_CHARACTERS,
  FREE_FIRE_WEAPONS,
  areAdjacent,
  calculateWeaponDamage,
  calculateZoneDamage,
  checkRunnerEntityCollision,
  createMatch3Board,
  evaluateAlphabetPick,
  findMatchCoords,
  pointHitsRect,
  resolveCircleRectPush,
  resolveMatchCascades,
  stepCircleCollision,
  swapTiles,
} from './gameLogic';

test('Candy Crush match-3 board initialization avoids starting matches and resolves swaps cleanly', () => {
  const board = createMatch3Board(8, 8, 1337);
  assert.equal(board.length, 8);
  assert.equal(board[0].length, 8);
  assert.equal(findMatchCoords(board).length, 0);

  assert.equal(areAdjacent({ row: 2, col: 3 }, { row: 2, col: 4 }), true);
  assert.equal(areAdjacent({ row: 2, col: 3 }, { row: 3, col: 4 }), false);

  // Force a clear 3-in-a-row after a swap
  const rigged = createMatch3Board(6, 6, 42);
  rigged[0][0] = 1;
  rigged[0][1] = 1;
  rigged[0][2] = 2;
  rigged[0][3] = 1;
  const swapped = swapTiles(rigged, { row: 0, col: 2 }, { row: 0, col: 3 });
  const result = resolveMatchCascades(swapped, 99);
  assert.ok(result.clearedCount >= 3);
  assert.ok(result.cascadeDepth >= 1);
  assert.ok(result.scoreDelta >= 90);
});

test('Alphabet game verifies A-Z sequences and word completions accurately', () => {
  assert.equal(ALPHABET_LETTERS.length, 26);
  assert.ok(ALPHABET_WORD_CHALLENGES.length >= 6);

  assert.deepEqual(evaluateAlphabetPick('A', 'a'), { correct: true, points: 50 });
  assert.deepEqual(evaluateAlphabetPick('Z', 'B'), { correct: false, points: -10 });
});

test('Temple Run runner collision logic avoids barrier on jump, low_branch on slide, and collects coins', () => {
  assert.equal(checkRunnerEntityCollision(1, 'run', { lane: 1, y: 250, kind: 'coin' }), 'coin');
  assert.equal(checkRunnerEntityCollision(1, 'jump', { lane: 1, y: 250, kind: 'barrier' }), 'none');
  assert.equal(checkRunnerEntityCollision(1, 'run', { lane: 1, y: 250, kind: 'barrier' }), 'crash');
  assert.equal(checkRunnerEntityCollision(1, 'slide', { lane: 1, y: 250, kind: 'low_branch' }), 'none');
  assert.equal(checkRunnerEntityCollision(1, 'jump', { lane: 1, y: 250, kind: 'low_branch' }), 'crash');
  assert.equal(checkRunnerEntityCollision(0, 'run', { lane: 2, y: 250, kind: 'barrier' }), 'none');
});

test('Free Fire zone damage and circle bullet hit detection behave accurately', () => {
  assert.equal(calculateZoneDamage(200, 160, 200, 160, 100), 0);
  assert.ok(calculateZoneDamage(360, 160, 200, 160, 100) >= 2);
  assert.equal(stepCircleCollision(100, 100, 14, 110, 100, 6), true);
  assert.equal(stepCircleCollision(100, 100, 14, 140, 100, 6), false);
});

test('Free Fire Bermuda arsenal, character perks, obstacle push, and headshot armor math work accurately', () => {
  assert.deepEqual(Object.keys(FREE_FIRE_WEAPONS), ['scar', 'mp40', 'm1887', 'awm']);
  assert.deepEqual(Object.keys(FREE_FIRE_CHARACTERS), ['alok', 'kelly', 'hayato']);

  const wall = { x: 100, y: 100, w: 80, h: 40 };
  assert.equal(pointHitsRect(140, 120, 4, wall), true);
  assert.equal(pointHitsRect(220, 120, 4, wall), false);

  const pushed = resolveCircleRectPush(108, 120, 16, wall);
  assert.ok(pushed.x <= 84.01, `expected pushed.x <= 84, got ${pushed.x}`);

  const bodyUnarmored = calculateWeaponDamage({
    weaponId: 'awm',
    isHeadshot: false,
    targetArmor: 0,
  });
  assert.equal(bodyUnarmored.hpDamage, 95);
  assert.equal(bodyUnarmored.armorDamage, 0);

  const bodyArmored = calculateWeaponDamage({
    weaponId: 'scar',
    isHeadshot: false,
    targetArmor: 50,
  });
  assert.equal(bodyArmored.armorDamage, 13);
  assert.equal(bodyArmored.hpDamage, 15);
  assert.equal(bodyArmored.remainingArmor, 37);

  const headshotWithHayato = calculateWeaponDamage({
    weaponId: 'awm',
    isHeadshot: true,
    targetArmor: 50,
    damageReductionRate: 0.25,
  });
  assert.ok(headshotWithHayato.hpDamage > bodyUnarmored.hpDamage);
  assert.ok(headshotWithHayato.remainingArmor < 50);
});

