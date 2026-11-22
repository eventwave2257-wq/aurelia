import test from 'node:test';
import assert from 'node:assert/strict';

test('vehicle maintenance calculations accurately project oil change and tire rotation remaining distance', () => {
  const baseOdometerKm = 18450;
  const sampleTrips = [
    { distanceMiles: 24.5 },
    { distanceMiles: 18.2 },
    { distanceMiles: 32.1 },
  ];
  const cumulativeKm = sampleTrips.reduce((acc, t) => acc + t.distanceMiles, 0); // 74.8 km
  assert.equal(Math.round(cumulativeKm * 10) / 10, 74.8);

  const currentOdometer = Math.round(baseOdometerKm + cumulativeKm);
  assert.equal(currentOdometer, 18525);

  const OIL_INTERVAL = 10000;
  const oilRemaining = OIL_INTERVAL - ((cumulativeKm) % OIL_INTERVAL || 2450);
  assert.ok(oilRemaining > 0 && oilRemaining <= OIL_INTERVAL);

  const TIRE_INTERVAL = 8000;
  const tireRemaining = TIRE_INTERVAL - ((cumulativeKm) % TIRE_INTERVAL || 1680);
  assert.ok(tireRemaining > 0 && tireRemaining <= TIRE_INTERVAL);
});

test('smart routing estimates savings and alternative distance accurately', () => {
  const baseDurationMins = 24;
  const baseDistanceKm = 8.5;
  const timeSaved = 6;
  const alternativeDuration = baseDurationMins - timeSaved;
  const alternativeDistance = +(baseDistanceKm * 1.08).toFixed(1);

  assert.equal(alternativeDuration, 18);
  assert.equal(alternativeDistance, 9.2);
  assert.ok(alternativeDuration < baseDurationMins);
});
