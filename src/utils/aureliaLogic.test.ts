import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appointmentToRideOffer,
  BIKE_SPEED_FINE_INR,
  BIKE_SPEED_LIMIT_KMH,
  calculateAcceptanceRate,
  calculatePerKmFareBreakdown,
  calculateTripFinancials,
  CAR_SPEED_FINE_INR,
  CAR_SPEED_LIMIT_KMH,
  computePassengerRatingAverage,
  computeSeparateEarningsAnalysis,
  computeTaxReportTotals,
  estimateRoadDistanceKm,
  evaluateSpeedViolation,
  filterCareAppointments,
  getDistrictEmergencyContacts,
  getSpeedLimitPolicy,
  getVehicleTierLabel,
  searchKarnatakaDirectory,
  sortOffersByPriority,
  tripsToCsv,
  tripsToPdfBytes,
  tripsToTaxCsv,
  validateCareAppointmentInput,
  validateDriverProfileInput,
  validatePassengerRatingInput,
  generateVerificationOtp,
  validateVerificationOtp,
  buildSmsShareUri,
  formatPhoneDisplay,
  evaluateWinWinConditionFare,
  calculateWinWinFareBreakdown,
  validateUpiId,
  calculatePayoutLedgerTotals,
} from './aureliaLogic';
import {
  HIGH_EARNING_ZONES,
  KARNATAKA_31_DISTRICTS,
  KARNATAKA_BOUNDS,
} from '../data/karnatakaDistricts';
import type {
  CareAppointment,
  CompletedTrip,
  DriverProfileData,
  NewCareBookingInput,
  RideOffer,
} from '../types/aurelia';

test('calculatePerKmFareBreakdown charges ₹19/km with ₹3/km company maintenance & service and ₹16/km driver payout', () => {
  const tenKm = calculatePerKmFareBreakdown(10);
  assert.equal(tenKm.totalDistanceFare, 190);
  assert.equal(tenKm.companyMaintenanceFee, 30);
  assert.equal(tenKm.driverDistanceEarnings, 160);
  assert.equal(tenKm.netDriverPayout, 160);

  const careTrip = calculateTripFinancials({
    category: 'care_medical',
    pricingModel: 'per_km_19',
    distanceMiles: 10,
    baseFare: 190,
    surgeBonus: 0,
    careStipend: 500,
    tip: 50,
  });
  assert.equal(careTrip.platformFee, 30);
  assert.equal(careTrip.netPayout, 710); // 160 + 500 + 50
});

test('calculateTripFinancials preserves legacy 18% standard and 0% care rules when pricingModel is omitted', () => {
  const standard = calculateTripFinancials({
    category: 'standard',
    baseFare: 20,
    surgeBonus: 5,
    careStipend: 0,
    tip: 4,
  });
  assert.equal(standard.platformFee, 4.5);
  assert.equal(standard.netPayout, 24.5);

  const care = calculateTripFinancials({
    category: 'care_wheelchair',
    baseFare: 25,
    surgeBonus: 0,
    careStipend: 14,
    tip: 3,
  });
  assert.equal(care.platformFee, 0);
  assert.equal(care.netPayout, 42);
});

test('all 31 Karnataka districts are present with unique IDs and valid Karnataka coordinates', () => {
  assert.equal(KARNATAKA_31_DISTRICTS.length, 31);
  const uniqueIds = new Set(KARNATAKA_31_DISTRICTS.map((d) => d.id));
  assert.equal(uniqueIds.size, 31);
  for (const d of KARNATAKA_31_DISTRICTS) {
    assert.ok(
      d.lat >= KARNATAKA_BOUNDS.south && d.lat <= KARNATAKA_BOUNDS.north,
      `${d.name} lat out of Karnataka bounds`
    );
    assert.ok(
      d.lng >= KARNATAKA_BOUNDS.west && d.lng <= KARNATAKA_BOUNDS.east,
      `${d.name} lng out of Karnataka bounds`
    );
  }
});

test('sortOffersByPriority puts Emergency Hospital Visit #1 when enabled', () => {
  const offers = [
    { id: 'std', category: 'standard', isEmergencyHospitalVisit: false },
    { id: 'care', category: 'care_wheelchair', isEmergencyHospitalVisit: false },
    { id: 'emerg', category: 'care_medical', isEmergencyHospitalVisit: true },
  ] as unknown as RideOffer[];

  const sorted = sortOffersByPriority(offers, true);
  assert.equal(sorted[0].id, 'emerg');
  assert.equal(sorted[1].id, 'care');
  assert.equal(sorted[2].id, 'std');
});

test('vehicle tier labels, road distance estimate, and Karnataka directory search work accurately', () => {
  assert.equal(getVehicleTierLabel('bike'), 'Bike');
  assert.equal(getVehicleTierLabel('car_economy'), 'Car (Economy)');
  assert.equal(getVehicleTierLabel('car_premier'), 'Car (Premier)');
  assert.equal(getVehicleTierLabel('car_elite'), 'Car (Elite)');

  const distBlrToMys = estimateRoadDistanceKm(
    { lat: 12.9716, lng: 77.5946 },
    { lat: 12.2958, lng: 76.6394 }
  );
  assert.ok(distBlrToMys > 120 && distBlrToMys < 180);

  const results = searchKarnatakaDirectory('Udupi');
  assert.ok(results.some((r) => r.label.toLowerCase().includes('udupi') || r.formattedAddress.includes('Udupi')));
});

test('calculateAcceptanceRate computes percentage accurately', () => {
  assert.equal(calculateAcceptanceRate({ acceptedCount: 47, declinedCount: 3 }), 94);
  assert.equal(calculateAcceptanceRate({ acceptedCount: 0, declinedCount: 0 }), 100);
});

test('computeSeparateEarningsAnalysis separates standard vs care metrics, peak windows, and special insights', () => {
  const sampleTrips: CompletedTrip[] = [
    {
      id: 't1',
      category: 'standard',
      serviceLabel: 'Aurelia X',
      riderOrPatientName: 'Alex M.',
      routeSummary: 'Downtown -> Airport',
      completedAt: '2026-11-14T16:00:00Z',
      durationMins: 30,
      distanceMiles: 12,
      baseFare: 20,
      surgeBonus: 0,
      careStipend: 0,
      tip: 3.6,
    },
    {
      id: 't2',
      category: 'care_medical',
      serviceLabel: 'Medical & Dialysis',
      riderOrPatientName: 'Martha R.',
      routeSummary: 'Oakwood -> St. Jude Dialysis',
      completedAt: '2026-11-14T09:30:00Z',
      durationMins: 30,
      distanceMiles: 8,
      baseFare: 24,
      surgeBonus: 0,
      careStipend: 16,
      tip: 0,
    },
    {
      id: 't3',
      category: 'care_wheelchair',
      serviceLabel: 'Wheelchair Mobility',
      riderOrPatientName: 'David K.',
      routeSummary: 'Elm St -> Rehab Center',
      completedAt: '2026-11-11T09:00:00Z',
      durationMins: 40,
      distanceMiles: 9.5,
      baseFare: 26,
      surgeBonus: 0,
      careStipend: 14,
      tip: 5,
    },
  ];

  const todayAnalysis = computeSeparateEarningsAnalysis(sampleTrips, 'today', '2026-11-14T23:59:59Z');
  assert.equal(todayAnalysis.combined.tripCount, 2);
  assert.equal(todayAnalysis.standard.tripCount, 1);
  assert.equal(todayAnalysis.care.tripCount, 1);
  assert.equal(todayAnalysis.standard.netEarnings, 20);
  assert.equal(todayAnalysis.care.netEarnings, 40);
  assert.equal(todayAnalysis.combined.netEarnings, 60);
  assert.equal(todayAnalysis.careSharePercent, 67);
  assert.equal(todayAnalysis.peakWindows[0].careNet, 40);
  assert.equal(todayAnalysis.peakWindows[2].standardNet, 20);
  assert.equal(todayAnalysis.specialAnalysis.commissionSaved, 4.32);

  const weekAnalysis = computeSeparateEarningsAnalysis(sampleTrips, 'week', '2026-11-14T23:59:59Z');
  assert.equal(weekAnalysis.combined.tripCount, 3);
  assert.equal(weekAnalysis.care.tripCount, 2);
  assert.equal(weekAnalysis.care.netEarnings, 85);
  assert.equal(weekAnalysis.dailyComparison.length, 2);
});

test('validateCareAppointmentInput and validateDriverProfileInput enforce required fields', () => {
  const invalidBooking: NewCareBookingInput = {
    patientName: '',
    category: 'care_wheelchair',
    vehicleTier: 'car_elite',
    patientConditionSummary: '',
    mobilityEquipment: '',
    accessibilityNeeds: [],
    assignedDriverName: 'Vikramaditya Rao',
    pickupAddress: '',
    destinationFacility: '',
    scheduledDate: '',
    scheduledTime: '',
    distanceMiles: '-2',
    baseFare: '0',
    careStipend: '-5',
    caregiverName: '',
    caregiverPhone: '',
    boardingProtocol: '',
    priorityLevel: 'Critical Care',
  };
  const bookingErrors = validateCareAppointmentInput(invalidBooking);
  assert.ok(bookingErrors.patientName);
  assert.ok(bookingErrors.accessibilityNeeds);
  assert.ok(bookingErrors.distanceMiles);

  const validBooking: NewCareBookingInput = {
    patientName: 'Eleanor Vance',
    category: 'care_oxygen',
    vehicleTier: 'car_elite',
    patientConditionSummary: 'COPD post-op checkup with portable O2',
    mobilityEquipment: 'Oxygen Tank Mount + Smooth Ride',
    accessibilityNeeds: ['Oxygen Cylinder Mount', 'Assistance with Boarding'],
    assignedDriverName: 'Vikramaditya Rao',
    pickupAddress: 'Sadashivanagar, Bengaluru',
    destinationFacility: 'Manipal Hospital, Bengaluru',
    scheduledDate: '2026-11-14',
    scheduledTime: '14:30',
    distanceMiles: '12',
    baseFare: '228',
    careStipend: '550',
    caregiverName: 'Dr. Nina Patel',
    caregiverPhone: '555-0192',
    boardingProtocol: 'Wait at side ramp; avoid sudden braking.',
    priorityLevel: 'Time-Sensitive',
  };
  assert.deepEqual(validateCareAppointmentInput(validBooking), {});

  const invalidProfile: DriverProfileData = {
    fullName: '',
    email: 'not-an-email',
    phone: '',
    cityRegion: 'Karnataka',
    yearsExperience: -1,
    bio: '',
    vehicle: {
      make: '',
      model: 'Sienna',
      year: 1990,
      licensePlate: '',
      color: 'Silver',
      wavConfiguration: 'Side Ramp',
    },
    specializations: [],
    backgroundCheck: {
      status: 'Verified & Cleared',
      lastUpdated: '2026-11-01',
      reviewedBy: 'Admin',
      notes: 'Cleared',
    },
  };
  const profileErrors = validateDriverProfileInput(invalidProfile);
  assert.ok(profileErrors.fullName);
  assert.ok(profileErrors.email);
  assert.ok(profileErrors.vehicleMake);
  assert.ok(profileErrors.vehicleYear);
  assert.ok(profileErrors.licensePlate);
  assert.ok(profileErrors.yearsExperience);
});

test('filterCareAppointments, appointmentToRideOffer, and tripsToCsv work end to end', () => {
  const list: CareAppointment[] = [
    {
      id: 'a1',
      category: 'care_wheelchair',
      patientName: 'Arthur Pendelton',
      patientConditionSummary: 'Power wheelchair user',
      mobilityEquipment: 'Hydraulic Ramp',
      accessibilityNeeds: ['Wheelchair Accessible Vehicle (WAV)', 'Assistance with Boarding'],
      assignedDriverName: 'Vikramaditya Rao',
      pickupAddress: 'Indiranagar, Bengaluru',
      destinationFacility: 'Manipal Hospital, Bengaluru',
      pickupCoords: { x: 20, y: 30 },
      dropoffCoords: { x: 70, y: 60 },
      scheduledDate: '2026-11-14',
      scheduledTime: '13:00',
      distanceMiles: 6.2,
      estimatedDurationMins: 22,
      baseFare: 117.8,
      careStipend: 500,
      waitTimeProtectionBonus: 250,
      caregiverName: 'Sarah',
      caregiverPhone: '555-0111',
      boardingProtocol: 'Meet at front lobby.',
      claimed: true,
      completed: false,
      priorityLevel: 'Routine',
    },
  ];

  assert.equal(filterCareAppointments(list, 'claimed', '').length, 1);
  assert.equal(filterCareAppointments(list, 'care_wheelchair', 'boarding').length, 1);
  assert.equal(filterCareAppointments(list, 'all', 'nonexistent').length, 0);

  const offer = appointmentToRideOffer(list[0]);
  assert.equal(offer.careStipend, 750);
  assert.equal(offer.graceWaitMins, 10);

  const csv = tripsToCsv([
    {
      id: 't-100',
      category: 'care_medical',
      vehicleTier: 'car_elite',
      pricingModel: 'per_km_19',
      serviceLabel: 'Medical & Dialysis',
      riderOrPatientName: 'Martha R.',
      routeSummary: 'Malleshwaram -> Manipal Hospital',
      completedAt: '2026-11-14T11:30:00Z',
      durationMins: 30,
      distanceMiles: 10,
      baseFare: 190,
      surgeBonus: 0,
      careStipend: 500,
      tip: 0,
      driverPassengerRating: {
        overall: 5,
        curbReadiness: 5,
        communication: 4,
        equipmentReadiness: 5,
        privateCareNotes: 'Meet at West Wing dialysis entrance.',
        updatedAt: '2026-11-14',
      },
    },
  ]);
  assert.ok(csv.includes('"Care & Medical"'));
  assert.ok(csv.includes('"Car (Elite)"'));
  assert.ok(csv.includes('"660.00"'));
  assert.ok(csv.includes('"4.8"'));
  assert.ok(csv.includes('Meet at West Wing dialysis entrance.'));
});

test('computePassengerRatingAverage and validatePassengerRatingInput work accurately', () => {
  assert.equal(
    computePassengerRatingAverage({
      overall: 5,
      curbReadiness: 4,
      communication: 5,
      equipmentReadiness: 5,
    }),
    4.8
  );

  const invalid = validatePassengerRatingInput({
    overall: 0,
    curbReadiness: 6,
    communication: 4,
    equipmentReadiness: 5,
  });
  assert.ok(invalid.overall);
  assert.ok(invalid.curbReadiness);
  assert.equal(invalid.communication, undefined);
});

test('formatCurrency formats Indian Rupees with en-IN grouping', async () => {
  const { formatCurrency } = await import('./aureliaLogic');
  assert.equal(formatCurrency(125000), '₹1,25,000.00');
  assert.equal(formatCurrency(840.5), '₹840.50');
});

test('speed limit policy enforces 50 km/h (₹40 fine) for Bike and 95 km/h (₹80 fine) for Cars', () => {
  assert.equal(BIKE_SPEED_LIMIT_KMH, 50);
  assert.equal(BIKE_SPEED_FINE_INR, 40);
  assert.equal(CAR_SPEED_LIMIT_KMH, 95);
  assert.equal(CAR_SPEED_FINE_INR, 80);

  const bikePolicy = getSpeedLimitPolicy('bike');
  assert.deepEqual(bikePolicy, { maxSpeedKmh: 50, fineInr: 40, categoryLabel: 'Bike' });

  for (const carTier of ['car_economy', 'car_premier', 'car_elite'] as const) {
    assert.deepEqual(getSpeedLimitPolicy(carTier), {
      maxSpeedKmh: 95,
      fineInr: 80,
      categoryLabel: 'Cars',
    });
  }

  // Exact boundary check for Bike
  const bikeSafe = evaluateSpeedViolation(50, 'bike');
  assert.equal(bikeSafe.exceeded, false);
  assert.equal(bikeSafe.fineInr, 0);

  const bikeOver = evaluateSpeedViolation(51, 'bike');
  assert.equal(bikeOver.exceeded, true);
  assert.equal(bikeOver.overByKmh, 1);
  assert.equal(bikeOver.fineInr, 40);

  // Exact boundary check for Cars
  const carSafe = evaluateSpeedViolation(95, 'car_elite');
  assert.equal(carSafe.exceeded, false);
  assert.equal(carSafe.fineInr, 0);

  const carOver = evaluateSpeedViolation(96, 'car_premier');
  assert.equal(carOver.exceeded, true);
  assert.equal(carOver.overByKmh, 1);
  assert.equal(carOver.fineInr, 80);
});

test('HIGH_EARNING_ZONES covers frequently ordered Karnataka areas within state bounds', () => {
  assert.ok(HIGH_EARNING_ZONES.length >= 6);
  const uniqueIds = new Set(HIGH_EARNING_ZONES.map((z) => z.id));
  assert.equal(uniqueIds.size, HIGH_EARNING_ZONES.length);
  for (const zone of HIGH_EARNING_ZONES) {
    assert.ok(zone.radiusMeters > 0);
    assert.ok(
      zone.lat >= KARNATAKA_BOUNDS.south && zone.lat <= KARNATAKA_BOUNDS.north,
      `${zone.name} lat out of Karnataka bounds`
    );
    assert.ok(
      zone.lng >= KARNATAKA_BOUNDS.west && zone.lng <= KARNATAKA_BOUNDS.east,
      `${zone.name} lng out of Karnataka bounds`
    );
  }
});

test('getDistrictEmergencyContacts returns pre-saved police, hospital, and emergency services for all 31 Karnataka districts', () => {
  for (const district of KARNATAKA_31_DISTRICTS) {
    const contacts = getDistrictEmergencyContacts(district.id);
    assert.equal(contacts.districtId, district.id);
    assert.equal(contacts.districtName, district.name);
    assert.ok(contacts.police.title.length > 0);
    assert.ok(contacts.police.controlRoomPhone.length > 0);
    assert.equal(contacts.hospital.name, district.medicalCenter);
    assert.ok(contacts.hospital.deskPhone.length > 0);
    assert.ok(contacts.emergencyServices.length >= 4);
  }

  const mysuru = getDistrictEmergencyContacts('mysuru');
  assert.equal(mysuru.hospital.name, 'Apollo BGS Specialty Hospital, Mysuru');
  assert.ok(mysuru.police.title.includes('Mysuru'));

  const fallback = getDistrictEmergencyContacts('unknown-district');
  assert.equal(fallback.districtId, 'bengaluru-urban');
});

test('computeTaxReportTotals, tripsToTaxCsv, and tripsToPdfBytes export valid tax & trip records', () => {
  const sampleTrips: CompletedTrip[] = [
    {
      id: 'TAX-101',
      category: 'standard',
      vehicleTier: 'car_premier',
      pricingModel: 'per_km_19',
      serviceLabel: 'Car (Premier)',
      riderOrPatientName: 'Rohan Kulkarni',
      routeSummary: 'Indiranagar -> Kempegowda Airport',
      completedAt: '2026-11-14T09:00:00Z',
      durationMins: 42,
      distanceMiles: 30,
      baseFare: 570,
      surgeBonus: 0,
      careStipend: 0,
      tip: 50,
    },
    {
      id: 'TAX-102',
      category: 'care_medical',
      vehicleTier: 'car_elite',
      pricingModel: 'per_km_19',
      serviceLabel: 'Medical & Dialysis',
      riderOrPatientName: 'Lakshmi N.',
      routeSummary: 'Jayanagar -> Manipal Hospital',
      completedAt: '2026-11-14T11:30:00Z',
      durationMins: 28,
      distanceMiles: 10,
      baseFare: 190,
      surgeBonus: 0,
      careStipend: 400,
      tip: 0,
    },
  ];

  const totals = computeTaxReportTotals(sampleTrips);
  assert.equal(totals.tripCount, 2);
  assert.equal(totals.totalDistanceKm, 40);
  assert.equal(totals.grossFares, 760);
  assert.equal(totals.careStipends, 400);
  assert.equal(totals.tips, 50);
  assert.equal(totals.deductibleFees, 120); // (30 + 10) * ₹3/km
  assert.equal(totals.netTaxableIncome, 1090); // (570 - 90 + 50) + (190 - 30 + 400)

  const taxCsv = tripsToTaxCsv(sampleTrips, { periodLabel: 'This Week', channelLabel: 'All Trips' });
  assert.ok(taxCsv.includes('TAX REPORTING & RECORD-KEEPING SUMMARY'));
  assert.ok(taxCsv.includes('"Deductible Company Maint & Platform Fees (INR)","120.00"'));
  assert.ok(taxCsv.includes('"Net Taxable Driver Earnings (INR)","1090.00"'));

  const pdfBytes = tripsToPdfBytes(sampleTrips, {
    periodLabel: 'This Week',
    channelLabel: 'All Trips',
    generatedAt: '2026-11-14',
  });
  const pdfText = new TextDecoder('latin1').decode(pdfBytes);
  assert.ok(pdfText.startsWith('%PDF-1.4\n'));
  assert.ok(pdfText.trimEnd().endsWith('%%EOF'));
  assert.ok(pdfText.includes('TAX REPORTING SUMMARY \\(INR\\)'));
  assert.ok(pdfText.includes('TAX-101'));
  assert.ok(pdfText.includes('NET TAXABLE DRIVER EARNINGS: INR 1090.00'));

  // Multi-page pagination with 30 trips
  const manyTrips: CompletedTrip[] = Array.from({ length: 30 }, (_, i) => ({
    ...sampleTrips[0],
    id: `TAX-PG-${i + 1}`,
  }));
  const multiPageText = new TextDecoder('latin1').decode(tripsToPdfBytes(manyTrips));
  const pageMatches = multiPageText.match(/\/Type \/Page\b/g) ?? [];
  assert.equal(pageMatches.length, 2);
});

test('generateVerificationOtp, validateVerificationOtp, buildSmsShareUri, and formatPhoneDisplay verify OTP securely without exposing demo code', () => {
  // Generates 4-digit numeric code
  for (let i = 0; i < 20; i++) {
    const code = generateVerificationOtp();
    assert.equal(code.length, 4);
    assert.ok(/^\d{4}$/.test(code));
    const num = parseInt(code, 10);
    assert.ok(num >= 1000 && num <= 9999);
  }

  // Validation with correct code
  const validResult = validateVerificationOtp('5819', '5819');
  assert.equal(validResult.valid, true);
  assert.equal(validResult.error, undefined);

  // Validation with incorrect code - verify it DOES NOT leak the expected code in the error message!
  const invalidResult = validateVerificationOtp('1111', '5819');
  assert.equal(invalidResult.valid, false);
  assert.ok(invalidResult.error);
  assert.ok(!invalidResult.error?.includes('5819')); // CRITICAL: Must not leak the expected OTP
  assert.ok(invalidResult.error?.includes('Invalid verification code'));

  // Validation with empty or invalid format
  const emptyResult = validateVerificationOtp('', '5819');
  assert.equal(emptyResult.valid, false);
  assert.ok(!emptyResult.error?.includes('5819'));

  const shortResult = validateVerificationOtp('12', '5819');
  assert.equal(shortResult.valid, false);

  // SMS Share URI generation
  const uri = buildSmsShareUri('9845012345', '7342');
  assert.ok(uri.startsWith('sms:+919845012345?body='));
  assert.ok(uri.includes('7342'));
  assert.ok(uri.includes('Aurelia'));

  // Phone display format
  assert.equal(formatPhoneDisplay('9845012345'), '+91 98450 12345');
});

test('evaluateWinWinConditionFare beats Uber/Rapido/Ola/Namma Yatri customer prices while protecting driver net earnings', () => {
  const modes = ['bike', 'auto', 'car_economy', 'car_premier', 'car_elite'] as const;
  const reducedConditions = [
    'off_peak_corridor',
    'high_earning_zone',
    'long_distance',
    'peak_traffic_fair',
    'care_priority',
  ] as const;

  for (const mode of modes) {
    const stdEval = evaluateWinWinConditionFare({
      vehicleMode: mode,
      conditionId: 'standard_19',
      distanceKm: 12,
    });
    assert.equal(stdEval.competitors.length, 4);

    for (const condition of reducedConditions) {
      const res = evaluateWinWinConditionFare({
        vehicleMode: mode,
        conditionId: condition,
        distanceKm: 12,
      });

      // Reduced customer rate must be strictly cheaper than every competitor (Uber, Ola, Rapido, Namma Yatri)
      for (const comp of res.competitors) {
        assert.ok(
          res.aureliaReducedRatePerKm < comp.customerRatePerKm,
          `${mode} / ${condition}: expected Aurelia ₹${res.aureliaReducedRatePerKm}/km < ${comp.brand} ₹${comp.customerRatePerKm}/km`
        );
      }

      // Customer total fare must beat market average
      assert.ok(res.customerSavingsVsAvgInr > 0);
      assert.ok(res.customerSavingsVsCheapestInr > 0);

      // Reduced condition price must NEVER cut driver net below baseline standard driver net
      assert.ok(
        res.aureliaDriverNetPerKm >= stdEval.aureliaDriverNetPerKm,
        `${mode} / ${condition}: driver net ₹${res.aureliaDriverNetPerKm}/km should be >= baseline ₹${stdEval.aureliaDriverNetPerKm}/km`
      );
      if (
        condition !== 'peak_traffic_fair' &&
        (mode === 'bike' || mode === 'auto' || mode === 'car_economy')
      ) {
        assert.ok(
          res.driverAdvantageVsAvgPerKm > 0,
          `${mode} / ${condition}: driver should earn strictly more than competitor avg`
        );
      } else if (condition === 'peak_traffic_fair') {
        assert.ok(
          res.aureliaDriverNetPerKm > stdEval.aureliaDriverNetPerKm,
          `${mode} / ${condition}: peak anti-surge cap must raise driver net above baseline`
        );
      }
    }
  }

  // Care zero-commission condition removes 100% platform fee
  const careRes = calculateWinWinFareBreakdown(10, 'car_elite', 'care_priority', 400, 50);
  assert.equal(careRes.companyMaintenanceFee, 0);
  assert.equal(careRes.totalDistanceFare, 160);
  assert.equal(careRes.driverDistanceEarnings, 160);
  assert.equal(careRes.netDriverPayout, 610); // 160 + 400 + 50
});

test('validateUpiId and calculatePayoutLedgerTotals validate UPI handles and compute settlement summaries', () => {
  assert.equal(validateUpiId('').valid, false);
  assert.equal(validateUpiId('invalidhandle').valid, false);
  assert.equal(validateUpiId('a@b').valid, false);
  assert.equal(validateUpiId('vikram.rao@okicici').valid, true);
  assert.equal(validateUpiId('rajesh_98@ybl').valid, true);

  const ledgerTotals = calculatePayoutLedgerTotals([
    {
      id: 'PAY-1',
      driverId: 'd1',
      driverName: 'Vikramaditya Rao',
      upiId: 'vikram@okicici',
      grossCollectedInr: 1000,
      companyFeeInr: 150,
      netPayoutInr: 850,
      status: 'reconciled',
      createdAt: '2026-11-14T10:00:00Z',
      updatedAt: '2026-11-14T10:05:00Z',
      utrReference: 'UTR-AUR-101',
    },
    {
      id: 'PAY-2',
      driverId: 'd1',
      driverName: 'Vikramaditya Rao',
      upiId: 'vikram@okicici',
      grossCollectedInr: 500,
      companyFeeInr: 50,
      netPayoutInr: 450,
      status: 'pending',
      createdAt: '2026-11-15T12:00:00Z',
      updatedAt: '2026-11-15T12:00:00Z',
      utrReference: 'PENDING-PAY-2',
    },
  ]);

  assert.equal(ledgerTotals.reconciledTotal, 850);
  assert.equal(ledgerTotals.pendingTotal, 450);
  assert.equal(ledgerTotals.totalCompanyFees, 200);
  assert.equal(ledgerTotals.reconciledCount, 1);
  assert.equal(ledgerTotals.pendingCount, 1);
});

test('calculateFlatRideTransfer and computeFlatRideTransferSummary deduct ₹3 per ride and transfer remainder', async () => {
  const {
    FLAT_PLATFORM_DEDUCTION_INR,
    calculateFlatRideTransfer,
    computeFlatRideTransferSummary,
  } = await import('./aureliaLogic');

  assert.equal(FLAT_PLATFORM_DEDUCTION_INR, 3);

  const singleRide = calculateFlatRideTransfer(228);
  assert.equal(singleRide.grossFareInr, 228);
  assert.equal(singleRide.deductedFeeInr, 3);
  assert.equal(singleRide.transferredNetInr, 225);

  const lowRide = calculateFlatRideTransfer(2);
  assert.equal(lowRide.deductedFeeInr, 2);
  assert.equal(lowRide.transferredNetInr, 0);

  const sampleTrips: CompletedTrip[] = [
    {
      id: 'TRP-301',
      category: 'standard',
      serviceLabel: 'Car (Premier)',
      riderOrPatientName: 'Asha M.',
      routeSummary: 'Indiranagar -> MG Road',
      completedAt: '2026-11-18T10:00:00Z',
      durationMins: 18,
      distanceMiles: 8,
      baseFare: 150,
      surgeBonus: 0,
      careStipend: 0,
      tip: 20,
    },
    {
      id: 'TRP-302',
      category: 'care_medical',
      serviceLabel: 'Medical Care',
      riderOrPatientName: 'Suresh K.',
      routeSummary: 'Jayanagar -> Manipal Hospital',
      completedAt: '2026-11-18T11:30:00Z',
      durationMins: 22,
      distanceMiles: 10,
      baseFare: 190,
      surgeBonus: 0,
      careStipend: 110,
      tip: 0,
    },
  ];

  const summary = computeFlatRideTransferSummary(sampleTrips, 'rajesh@okicici (+91 9845012345)');
  assert.equal(summary.totalTrips, 2);
  assert.equal(summary.totalGrossInr, 470); // (150+20) + (190+110)
  assert.equal(summary.totalDeductedFeeInr, 6); // ₹3 * 2 rides
  assert.equal(summary.totalTransferredNetInr, 464); // 470 - 6
  assert.equal(summary.entries[0].transferredNetInr, 167);
  assert.equal(summary.entries[1].transferredNetInr, 297);
});

test('validatePasswordSetup, hashPasswordSha256, validateQrPayloadOrImage, and generateDeterministicQrMatrix work securely', async () => {
  const {
    validatePasswordSetup,
    hashPasswordSha256,
    validateQrPayloadOrImage,
    generateDeterministicQrMatrix,
  } = await import('./aureliaLogic');

  assert.equal(validatePasswordSetup('short1', 'short1').valid, false);
  assert.equal(validatePasswordSetup('onlyletters', 'onlyletters').valid, false);
  assert.equal(validatePasswordSetup('Aurelia99', 'Aurelia98').valid, false);
  assert.equal(validatePasswordSetup('Aurelia99', 'Aurelia99').valid, true);

  const hashA = await hashPasswordSha256('Aurelia99');
  const hashB = await hashPasswordSha256('Aurelia99');
  assert.equal(hashA, hashB);
  assert.ok(hashA.length >= 16);
  assert.ok(!hashA.includes('Aurelia99'));

  assert.equal(validateQrPayloadOrImage('', '').valid, false);
  const upiQr = validateQrPayloadOrImage('vikram.rao@okicici', '');
  assert.equal(upiQr.valid, true);
  assert.ok(upiQr.normalizedPayload.startsWith('upi://pay?pa='));

  const imgQr = validateQrPayloadOrImage('', 'data:image/png;base64,AAA');
  assert.equal(imgQr.valid, true);

  const matrix1 = generateDeterministicQrMatrix('upi://pay?pa=vikram@okicici', 21);
  const matrix2 = generateDeterministicQrMatrix('upi://pay?pa=vikram@okicici', 21);
  assert.equal(matrix1.length, 21);
  assert.deepEqual(matrix1, matrix2);
  // Top-left finder corner must be filled
  assert.equal(matrix1[0][0], true);
  assert.equal(matrix1[1][1], false);
});

test('PASSENGER_TIP_PRESETS_INR, validatePassengerTipAmount, calculateInTripPayoutPreview, and calculateLiveRideTotalsWithTip update final earnings and payouts accurately', async () => {
  const {
    PASSENGER_TIP_PRESETS_INR,
    validatePassengerTipAmount,
    calculateInTripPayoutPreview,
    calculateLiveRideTotalsWithTip,
  } = await import('./aureliaLogic');

  assert.deepEqual([...PASSENGER_TIP_PRESETS_INR], [0, 20, 50, 100]);

  assert.equal(validatePassengerTipAmount('').valid, false);
  assert.equal(validatePassengerTipAmount('-10').valid, false);
  assert.equal(validatePassengerTipAmount('9999').valid, false);
  assert.equal(validatePassengerTipAmount('abc').valid, false);
  const okTip = validatePassengerTipAmount('75.50');
  assert.equal(okTip.valid, true);
  assert.equal(okTip.amount, 75.5);

  const withoutTip = calculateInTripPayoutPreview({
    baseFareInr: 190,
    careStipendInr: 500,
    tipInr: 0,
    category: 'care_medical',
    pricingModel: 'per_km_19',
    distanceKm: 10,
  });
  assert.equal(withoutTip.netDriverPayoutInr, 660); // (190 - 30) + 500
  assert.equal(withoutTip.flatTransferredNetInr, 687); // (190 + 500) - 3

  const withTip = calculateInTripPayoutPreview({
    baseFareInr: 190,
    careStipendInr: 500,
    tipInr: 100,
    category: 'care_medical',
    pricingModel: 'per_km_19',
    distanceKm: 10,
  });
  assert.equal(withTip.tipInr, 100);
  assert.equal(withTip.grossWithTipInr, 790);
  assert.equal(withTip.netDriverPayoutInr, 760); // 660 + 100 tip
  assert.equal(withTip.flatTransferredNetInr, 787); // 790 - 3 fee

  const liveTotals = calculateLiveRideTotalsWithTip(
    {
      fareInr: 220,
      driverNetInr: 205,
      companyFeeInr: 15,
      tipInr: 50,
    },
    100
  );
  assert.equal(liveTotals.tipInr, 100);
  assert.equal(liveTotals.customerTotalWithTipInr, 320);
  assert.equal(liveTotals.driverPayoutWithTipInr, 305);
  assert.equal(liveTotals.flatTransferredNetInr, 317);
});

test('verifyAdminPasscode accepts only the exact admin passcode 9945781777 and rejects all others', async () => {
  const { verifyAdminPasscode } = await import('./aureliaLogic');

  assert.equal(await verifyAdminPasscode('9945781777'), true);
  assert.equal(await verifyAdminPasscode(' 9945781777 '), true);
  assert.equal(await verifyAdminPasscode(''), false);
  assert.equal(await verifyAdminPasscode('123456'), false);
  assert.equal(await verifyAdminPasscode('9945781778'), false);
  assert.equal(await verifyAdminPasscode('994578177'), false);
  assert.equal(await verifyAdminPasscode('99457817770'), false);
});

test('getTripCompletionProgress tracks real-time trip completion from en_route_pickup through completed', async () => {
  const { getTripCompletionProgress } = await import('./aureliaLogic');

  const offline = getTripCompletionProgress('offline');
  assert.equal(offline.isVisible, false);
  assert.equal(offline.percent, 0);

  const idle = getTripCompletionProgress('online_idle');
  assert.equal(idle.isVisible, false);
  assert.equal(idle.percent, 0);

  const enRoute = getTripCompletionProgress('en_route_pickup');
  assert.equal(enRoute.isVisible, true);
  assert.equal(enRoute.percent, 25);
  assert.equal(enRoute.activeStepIndex, 0);
  assert.equal(enRoute.steps[0].active, true);
  assert.equal(enRoute.steps[0].completed, false);

  const arrived = getTripCompletionProgress('arrived_pickup');
  assert.equal(arrived.isVisible, true);
  assert.equal(arrived.percent, 50);
  assert.equal(arrived.activeStepIndex, 1);
  assert.equal(arrived.steps[0].completed, true);
  assert.equal(arrived.steps[1].active, true);

  const inTrip = getTripCompletionProgress('in_trip');
  assert.equal(inTrip.isVisible, true);
  assert.equal(inTrip.percent, 75);
  assert.equal(inTrip.activeStepIndex, 2);
  assert.equal(inTrip.steps[0].completed, true);
  assert.equal(inTrip.steps[1].completed, true);
  assert.equal(inTrip.steps[2].active, true);

  const completed = getTripCompletionProgress('completed');
  assert.equal(completed.isVisible, true);
  assert.equal(completed.percent, 100);
  assert.equal(completed.activeStepIndex, 3);
  assert.equal(completed.statusLabel, 'Trip Completed');
  assert.ok(completed.steps.every((s) => s.completed));
});

test('normalizeIndianMobile, isValidIndianMobile, maskIndianPhoneNumber, and normalizeOtpInput sanitize inputs reliably', async () => {
  const {
    normalizeIndianMobile,
    isValidIndianMobile,
    maskIndianPhoneNumber,
    normalizeOtpInput,
  } = await import('./aureliaLogic');

  assert.equal(normalizeIndianMobile('+91 98450 12345'), '9845012345');
  assert.equal(normalizeIndianMobile('09845012345'), '9845012345');
  assert.equal(isValidIndianMobile('+91 98450 12345'), true);
  assert.equal(isValidIndianMobile('5123456789'), false);
  assert.equal(isValidIndianMobile('12345'), false);
  assert.equal(maskIndianPhoneNumber('9845012345'), '+91 98*** **345');
  assert.equal(normalizeOtpInput(' 48-29a '), '4829');
});

test('CCAvenue AES-128-CBC encrypt/decrypt round-trip, request builder, and checkout validators work securely', async () => {
  const {
    encryptCcavenuePayload,
    decryptCcavenuePayload,
    buildCcavenuePlainRequest,
    parseCcavenueResponseParams,
  } = await import('./ccavenueServerCrypto');
  const {
    getCcavenuePaymentOption,
    formatPaymentMethodLabel,
    validateCcavenueCheckoutInput,
  } = await import('./aureliaLogic');

  const workingKey = 'A1B2C3D4E5F60718293A4B5C6D7E8F90';
  const plainReq = buildCcavenuePlainRequest({
    merchantId: '123456',
    orderId: 'AURCCA99001',
    amount: '342.50',
    redirectUrl: 'https://aurelia.example/api/payments/ccavenue/response',
    cancelUrl: 'https://aurelia.example/api/payments/ccavenue/response',
    billingName: 'Lakshmi Narasimhan',
    paymentOption: 'OPTUPI',
    rideId: 'ride-aur-99001',
  });

  const encHex = encryptCcavenuePayload(plainReq, workingKey);
  assert.ok(/^[0-9a-f]+$/.test(encHex));
  const decReq = decryptCcavenuePayload(encHex, workingKey);
  const reqParams = parseCcavenueResponseParams(decReq);
  assert.equal(reqParams.order_id, 'AURCCA99001');
  assert.equal(reqParams.amount, '342.50');
  assert.equal(reqParams.payment_option, 'OPTUPI');

  // Response round-trip
  const encResp = encryptCcavenuePayload(
    'order_id=AURCCA99001&tracking_id=CCA-TRK-99001&bank_ref_no=HDFC123&order_status=Success&amount=342.50',
    workingKey
  );
  const parsedResp = parseCcavenueResponseParams(decryptCcavenuePayload(encResp, workingKey));
  assert.equal(parsedResp.order_status, 'Success');
  assert.equal(parsedResp.tracking_id, 'CCA-TRK-99001');

  assert.equal(getCcavenuePaymentOption('ccavenue_upi'), 'OPTUPI');
  assert.equal(getCcavenuePaymentOption('ccavenue_card'), 'OPTCRDC');
  assert.equal(getCcavenuePaymentOption('ccavenue_netbanking'), 'OPTNBK');
  assert.equal(formatPaymentMethodLabel('ccavenue_netbanking'), 'CCAvenue NetBanking');

  assert.equal(validateCcavenueCheckoutInput({ method: 'ccavenue_upi', upiId: 'rider@okicici' }).valid, true);
  assert.equal(validateCcavenueCheckoutInput({ method: 'ccavenue_upi', upiId: 'bad-upi' }).valid, false);
  assert.equal(validateCcavenueCheckoutInput({ method: 'ccavenue_card', cardLast4: '4242' }).valid, true);
  assert.equal(validateCcavenueCheckoutInput({ method: 'ccavenue_card', cardLast4: '12' }).valid, false);
  assert.equal(validateCcavenueCheckoutInput({ method: 'ccavenue_netbanking', bankCode: 'HDFC Bank' }).valid, true);
});

test('resolveOfferGeoEndpoints and computeStaticRoutePreviewGeometry calculate static map viewport & SVG bounds', async () => {
  const { resolveOfferGeoEndpoints, computeStaticRoutePreviewGeometry } = await import('./aureliaLogic');

  const direct = resolveOfferGeoEndpoints({
    pickupLatLng: { lat: 12.9784, lng: 77.6408 },
    dropoffLatLng: { lat: 12.9592, lng: 77.6480 },
    pickupCoords: { x: 70, y: 71 },
    dropoffCoords: { x: 74, y: 72 },
  });
  assert.deepEqual(direct.pickup, { lat: 12.9784, lng: 77.6408 });
  assert.deepEqual(direct.dropoff, { lat: 12.9592, lng: 77.6480 });

  const derived = resolveOfferGeoEndpoints(
    {
      pickupCoords: { x: 40, y: 60 },
      dropoffCoords: { x: 60, y: 40 },
    },
    { lat: 12.3, lng: 76.6 }
  );
  assert.ok(Math.abs(derived.pickup.lat - 12.28) < 0.001);
  assert.ok(Math.abs(derived.dropoff.lat - 12.32) < 0.001);

  const geom = computeStaticRoutePreviewGeometry(direct.pickup, direct.dropoff);
  assert.ok(Math.abs(geom.center.lat - 12.9688) < 0.001);
  assert.ok(Math.abs(geom.center.lng - 77.6444) < 0.001);
  assert.equal(geom.zoom, 13);
  assert.ok(geom.approxDistanceKm > 0);
  assert.ok(geom.pickupSvg.x >= 16 && geom.pickupSvg.x <= 84);
  assert.ok(geom.dropoffSvg.y >= 18 && geom.dropoffSvg.y <= 82);
});

test('formatIndianE164Phone, isVerifiedFirebaseAuthUser, and classifyFirebasePhoneAuthError handle Firebase Phone OTP cleanly', async () => {
  const {
    formatIndianE164Phone,
    isVerifiedFirebaseAuthUser,
    classifyFirebasePhoneAuthError,
  } = await import('./aureliaLogic');

  assert.equal(formatIndianE164Phone('98450 12345'), '+919845012345');
  assert.equal(formatIndianE164Phone('+91 9945781777'), '+919945781777');
  assert.equal(formatIndianE164Phone('12345'), '');

  assert.equal(isVerifiedFirebaseAuthUser(null), false);
  assert.equal(isVerifiedFirebaseAuthUser({ emailVerified: false, phoneNumber: null }), false);
  assert.equal(isVerifiedFirebaseAuthUser({ emailVerified: true, phoneNumber: null }), true);
  assert.equal(isVerifiedFirebaseAuthUser({ emailVerified: false, phoneNumber: '+919845012345' }), true);

  const opNotAllowed = classifyFirebasePhoneAuthError({ code: 'auth/operation-not-allowed' });
  assert.equal(opNotAllowed.canFallbackToGateway, true);
  assert.equal(opNotAllowed.requiresConsoleSetup, true);

  const invalidOtp = classifyFirebasePhoneAuthError({ code: 'auth/invalid-verification-code' });
  assert.equal(invalidOtp.canFallbackToGateway, false);
  assert.equal(invalidOtp.requiresConsoleSetup, false);
});

test('evaluateTripDurationWarning triggers strictly when elapsed duration exceeds estimated duration by more than 20%', async () => {
  const { evaluateTripDurationWarning, formatDurationMmSs } = await import('./aureliaLogic');

  assert.equal(formatDurationMmSs(0), '00:00');
  assert.equal(formatDurationMmSs(65), '01:05');
  assert.equal(formatDurationMmSs(1200), '20:00');

  // 10 min estimated = 600s; +20% threshold = 720s (12 min)
  const underThreshold = evaluateTripDurationWarning(600, 10);
  assert.equal(underThreshold.isExceeded, false);
  assert.equal(underThreshold.thresholdSeconds, 720);
  assert.equal(underThreshold.thresholdMins, 12);

  // Exactly 20.0% (720s vs 600s) is NOT >20%, so must NOT trigger warning
  const exactBoundary = evaluateTripDurationWarning(720, 10);
  assert.equal(exactBoundary.isExceeded, false);
  assert.equal(exactBoundary.overrunPercent, 20);

  // 721s (>20% over 600s) MUST trigger warning
  const justOver = evaluateTripDurationWarning(721, 10);
  assert.equal(justOver.isExceeded, true);
  assert.equal(justOver.overrunPercent, 20);
  assert.ok(justOver.overrunMinutes >= 2);
  assert.ok(justOver.message.includes('more than 20%'));

  // 726s (+2.1 mins)
  const over21 = evaluateTripDurationWarning(726, 10);
  assert.equal(over21.isExceeded, true);
  assert.equal(over21.overrunMinutes, 2.1);

  // Significant overrun (26 mins vs 20 min estimate = +30%)
  const heavyOverrun = evaluateTripDurationWarning(26 * 60, 20);
  assert.equal(heavyOverrun.isExceeded, true);
  assert.equal(heavyOverrun.overrunPercent, 30);
  assert.equal(heavyOverrun.overrunMinutes, 6);
  assert.equal(heavyOverrun.elapsedFormatted, '26:00');
});

test('interpolateLiveTrackingPosition and computeLiveTrackingMetrics calculate live vehicle movement, remaining km, and ETA', async () => {
  const { interpolateLiveTrackingPosition, computeLiveTrackingMetrics } = await import('./aureliaLogic');

  const pickup = { lat: 12.9592, lng: 77.6480 };
  const dropoff = { lat: 12.9409, lng: 77.5955 };

  // En-route pickup interpolates toward pickup
  const approachStart = interpolateLiveTrackingPosition(pickup, dropoff, 0, 'en_route_pickup');
  assert.ok(approachStart.lat < pickup.lat);
  const approachEnd = interpolateLiveTrackingPosition(pickup, dropoff, 1, 'en_route_pickup');
  assert.deepEqual(approachEnd, pickup);

  // Arrived locks on pickup
  assert.deepEqual(interpolateLiveTrackingPosition(pickup, dropoff, 0.5, 'arrived_pickup'), pickup);

  // In-trip interpolates along pickup -> dropoff
  const midTrip = interpolateLiveTrackingPosition(pickup, dropoff, 0.5, 'in_trip');
  assert.ok(Math.abs(midTrip.lat - (pickup.lat + dropoff.lat) / 2) < 0.0001);
  assert.ok(Math.abs(midTrip.lng - (pickup.lng + dropoff.lng) / 2) < 0.0001);

  // Completed locks on dropoff
  assert.deepEqual(interpolateLiveTrackingPosition(pickup, dropoff, 0.2, 'completed'), dropoff);

  // Live metrics during in_trip
  const metrics = computeLiveTrackingMetrics({
    currentPos: midTrip,
    pickup,
    dropoff,
    phase: 'in_trip',
    plannedDistanceKm: 8.4,
  });
  assert.ok(metrics.remainingKm > 0);
  assert.ok(metrics.etaMins >= 1);
  assert.ok(metrics.progressFraction > 0.3 && metrics.progressFraction < 0.7);
  assert.equal(metrics.phaseLabel, 'Live En Route to Destination');

  // Completed metrics zero out remaining distance & ETA
  const doneMetrics = computeLiveTrackingMetrics({
    currentPos: dropoff,
    pickup,
    dropoff,
    phase: 'completed',
    plannedDistanceKm: 8.4,
  });
  assert.equal(doneMetrics.remainingKm, 0);
  assert.equal(doneMetrics.etaMins, 0);
  assert.equal(doneMetrics.progressFraction, 1);
});

test('evaluateDistrictTrafficRiskEstimation predicts high traffic risk based on historical district congestion data', async () => {
  const { evaluateDistrictTrafficRiskEstimation } = await import('./aureliaLogic');

  const blrRisk = evaluateDistrictTrafficRiskEstimation('Bengaluru Urban', 12, 18);
  assert.equal(blrRisk.isHighRisk, true);
  assert.ok(blrRisk.riskScore >= 35);
  assert.ok(blrRisk.predictedMins > blrRisk.historicalAvgMins);
  assert.ok(blrRisk.primaryCorridor.includes('Outer Ring'));

  const quietRisk = evaluateDistrictTrafficRiskEstimation('Bagalkot', 10, 15);
  assert.ok(typeof quietRisk.isHighRisk === 'boolean');
  assert.ok(quietRisk.congestionIndex > 1.0);
});




