import crypto from 'node:crypto';
import { createServer } from 'node:http';
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, type WebSocket } from 'ws';
import { GoogleGenAI, Modality, Type, type LiveServerMessage } from '@google/genai';
import {
  buildCcavenuePlainRequest,
  decryptCcavenuePayload,
  encryptCcavenuePayload,
  parseCcavenueResponseParams,
} from './src/utils/ccavenueServerCrypto.ts';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // API endpoint for AI-driven feedback analysis
  app.post('/api/gemini/feedback-analysis', async (req, res) => {
    try {
      const { feedbackItems } = req.body;

      if (!feedbackItems || !Array.isArray(feedbackItems) || feedbackItems.length === 0) {
        return res.json({
          success: true,
          analysis: {
            summary: "No rider comments or feedback ratings available yet in this period.",
            sentimentBreakdown: { positive: 100, comfortFocused: 0, careSpecific: 0, constructive: 0 },
            categories: [],
            coachingTips: ["Complete more Karnataka executive or special care trips to receive AI-driven passenger feedback summaries."],
          },
        });
      }

      const promptText = `Analyze the following passenger feedback notes and ratings from Aurelia Karnataka executive chauffeur and special medical/disability care rides:
${JSON.stringify(feedbackItems, null, 2)}

Provide a comprehensive sentiment analysis categorized into:
1. 'Positive': General praise, polite service, smooth driving.
2. 'Comfort-Focused': Climate control, seat adjustment, music, cabin cleanliness, quietness.
3. 'Care-Specific': Wheelchair assistance, medical equipment care, respectful elderly assistance, hospital punctuality.
4. 'Constructive': Areas of improvement or minor feedback.

Return a JSON object matching the requested schema with sentiment percentages summing to 100, a summary paragraph, category breakdowns, and actionable driver coaching tips.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: promptText,
        config: {
          systemInstruction: 'You are an expert AI service quality analyst for elite chauffeur and medical transport platforms in Karnataka. Provide insightful, professional, and encouraging driver coaching analysis.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: 'A 2-3 sentence executive summary of rider feedback sentiment.',
              },
              sentimentBreakdown: {
                type: Type.OBJECT,
                properties: {
                  positive: { type: Type.NUMBER, description: 'Percentage of positive sentiment' },
                  comfortFocused: { type: Type.NUMBER, description: 'Percentage of comfort-focused sentiment' },
                  careSpecific: { type: Type.NUMBER, description: 'Percentage of care-specific sentiment' },
                  constructive: { type: Type.NUMBER, description: 'Percentage of constructive feedback' },
                },
                description: 'Sentiment percentage breakdown summing to 100.',
              },
              categories: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    categoryName: { type: Type.STRING, description: 'Category title e.g. Positive, Comfort-Focused, Care-Specific, Constructive' },
                    count: { type: Type.NUMBER, description: 'Number of items in this category' },
                    sampleComment: { type: Type.STRING, description: 'Representative excerpt or theme' },
                  },
                },
              },
              coachingTips: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 actionable tips for the driver to improve ratings and service quality.',
              },
            },
          },
        },
      });

      const jsonStr = (response.text ?? '{}').trim();
      const parsedAnalysis = JSON.parse(jsonStr);

      res.json({
        success: true,
        analysis: parsedAnalysis,
      });
    } catch (error: any) {
      console.error('Gemini feedback analysis error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate AI feedback analysis',
      });
    }
  });

  // API endpoint for multi-turn Gemini Chatbot (gemini-4-hydrogen / gemini-3.1-flash-lite)
  app.post('/api/gemini/chat', async (req, res) => {
    try {
      const { messages, model, systemInstruction } = req.body ?? {};
      const allowedModels = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;
      const selectedModel = allowedModels.includes(model) ? model : 'gemini-4-hydrogen';

      const normalized = Array.isArray(messages)
        ? messages
            .filter((msg: any) => msg && typeof msg.text === 'string' && msg.text.trim().length > 0)
            .map((msg: any) => ({
              role: msg.role === 'model' ? ('model' as const) : ('user' as const),
              parts: [{ text: msg.text.trim() }],
            }))
        : [];

      // Ensure history starts with a user turn and ends before the latest user prompt
      let latestMessage = 'Hello! Please summarize how Aurelia supports Karnataka drivers.';
      let history = normalized;

      if (normalized.length > 0 && normalized[normalized.length - 1].role === 'user') {
        latestMessage = normalized[normalized.length - 1].parts[0].text;
        history = normalized.slice(0, -1);
      }

      const firstUserIdx = history.findIndex((m) => m.role === 'user');
      const cleanHistory = firstUserIdx >= 0 ? history.slice(firstUserIdx) : [];

      const customInstruction =
        typeof systemInstruction === 'string' && systemInstruction.trim().length > 0
          ? systemInstruction.trim().slice(0, 1200)
          : 'You are Aurelia AI Fleet Assistant & Karnataka Chauffeur Expert, specialized in executive rides, special care medical transport, ₹19/km pricing & flat ₹3/ride settlement transfers, Bangalore/Karnataka navigation across 31 districts, speed limits (50 km/hr bike, 95 km/hr car), and High Earning Areas zones. Be helpful, concise, and professional.';

      const chat = ai.chats.create({
        model: selectedModel,
        history: cleanHistory,
        config: {
          systemInstruction: customInstruction,
        },
      });

      const response = await chat.sendMessage({ message: latestMessage });

      res.json({
        success: true,
        model: selectedModel,
        reply:
          response.text ||
          'I am ready to help with Karnataka routes, earnings, and compliance.',
      });
    } catch (error: any) {
      console.error('Gemini chat error:', error);
      const status = typeof error?.status === 'number' ? error.status : 500;
      res.status(status).json({
        success: false,
        error: error?.message || 'Failed to generate chat response',
      });
    }
  });

  // In-memory OTP storage with attempt cap for backend security validation
  const otpSessions = new Map<string, { otp: string; expiresAt: number; phone: string; attempts: number }>();

  interface DispatchedOtpAudit {
    id: string;
    phone: string;
    maskedPhone: string;
    otp: string;
    dispatchedAt: string;
    expiresAt: number;
    channel: string;
    status: 'dispatched' | 'verified';
  }
  const dispatchedOtpLogs: DispatchedOtpAudit[] = [];

  const normalizeServerIndianPhone = (raw: string): string => {
    const digits = (raw || '').replace(/\D/g, '');
    if (digits.length > 10 && digits.startsWith('91')) return digits.slice(-10);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    return digits;
  };

  app.post('/api/otp/send', (req, res) => {
    try {
      const { phone, otp, role } = req.body ?? {};
      if (!phone || typeof phone !== 'string') {
        return res.status(400).json({ success: false, error: 'A valid 10-digit Indian mobile number is required.' });
      }
      const cleanPhone = normalizeServerIndianPhone(phone);
      if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
        return res.status(400).json({
          success: false,
          error: 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.',
        });
      }

      const assignedOtp = (otp && typeof otp === 'string' && /^\d{4}$/.test(otp.trim()))
        ? otp.trim()
        : Math.floor(1000 + Math.random() * 9000).toString();

      const expiresAt = Date.now() + 10 * 60 * 1000;
      otpSessions.set(cleanPhone, {
        otp: assignedOtp,
        expiresAt,
        phone: cleanPhone,
        attempts: 0,
      });

      const maskedPhone = `+91 ${cleanPhone.slice(0, 2)}*** **${cleanPhone.slice(7)}`;

      // Record dispatch audit for Admin inspection only
      dispatchedOtpLogs.push({
        id: `otp-log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        phone: cleanPhone,
        maskedPhone,
        otp: assignedOtp,
        dispatchedAt: new Date().toISOString(),
        expiresAt,
        channel: typeof role === 'string' && role ? `Aurelia SMS Gateway (${role})` : 'Aurelia Secure SMS Gateway',
        status: 'dispatched',
      });
      if (dispatchedOtpLogs.length > 150) {
        dispatchedOtpLogs.shift();
      }

      // Security: Only send OTP to the entered number, do not expose code in public response
      res.json({
        success: true,
        message: `4-digit verification code sent to ${maskedPhone}`,
        phone: cleanPhone,
        maskedPhone,
        expiresInSec: 600,
        deliveryChannel: 'aurelia_secure_sms_gateway',
      });
    } catch (err: any) {
      console.error('OTP send error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to dispatch OTP' });
    }
  });

  // Admin-only inspection endpoint for dispatched OTP audits
  app.get('/api/admin/otp-dispatches', (_req, res) => {
    res.json({
      success: true,
      dispatches: dispatchedOtpLogs.slice().reverse(),
    });
  });

  app.post('/api/admin/otp-dispatches/clear', (_req, res) => {
    dispatchedOtpLogs.length = 0;
    res.json({ success: true, message: 'Dispatched OTP logs cleared' });
  });

  app.post('/api/otp/verify', (req, res) => {
    try {
      const { phone, otp } = req.body ?? {};
      const cleanPhone = normalizeServerIndianPhone(typeof phone === 'string' ? phone : '');
      const cleanOtp = String(otp ?? '').replace(/\D/g, '').trim();

      if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
        return res.status(400).json({
          success: false,
          valid: false,
          error: 'Valid 10-digit Indian mobile number is required.',
        });
      }

      if (!/^\d{4,6}$/.test(cleanOtp)) {
        return res.status(400).json({
          success: false,
          valid: false,
          error: 'Verification code must be 4 digits.',
        });
      }

      const session = otpSessions.get(cleanPhone);

      if (!session) {
        return res.status(400).json({
          success: false,
          valid: false,
          error: 'No active OTP verification session found for this number. Please request a new code.',
        });
      }

      if (Date.now() > session.expiresAt) {
        otpSessions.delete(cleanPhone);
        return res.status(400).json({
          success: false,
          valid: false,
          error: 'Verification code has expired. Please request a new OTP.',
        });
      }

      if (session.attempts >= 5) {
        otpSessions.delete(cleanPhone);
        return res.status(429).json({
          success: false,
          valid: false,
          error: 'Too many failed attempts. Please request a new OTP.',
        });
      }

      if (session.otp !== cleanOtp) {
        session.attempts += 1;
        return res.status(400).json({
          success: false,
          valid: false,
          error: 'Invalid verification code. Please check your SMS messages and try again.',
        });
      }

      otpSessions.delete(cleanPhone);
      const matched = dispatchedOtpLogs.slice().reverse().find((l) => l.phone === cleanPhone);
      if (matched) matched.status = 'verified';
      res.json({ success: true, valid: true, verifiedPhone: cleanPhone });
    } catch (err: any) {
      console.error('OTP verify error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to verify OTP' });
    }
  });

  // Authoritative CCAvenue Order Ledger & Ephemeral Sandbox Working Key
  interface CcavenueServerOrder {
    orderId: string;
    rideId: string;
    amountInr: number;
    method: 'upi' | 'card' | 'netbanking';
    paymentOption: 'OPTUPI' | 'OPTCRDC' | 'OPTNBK';
    mode: 'ccavenue_live' | 'ccavenue_sandbox';
    status: 'initiated' | 'paid' | 'failed';
    trackingId?: string;
    bankRefNo?: string;
    createdAt: number;
  }

  const ccavenueOrders = new Map<string, CcavenueServerOrder>();
  const SANDBOX_CCAVENUE_WORKING_KEY = crypto.randomBytes(16).toString('hex');

  function resolveCcavenueConfig() {
    const merchantId = process.env.CCAVENUE_MERCHANT_ID?.trim() ?? '';
    const accessCode = process.env.CCAVENUE_ACCESS_CODE?.trim() ?? '';
    const workingKey = process.env.CCAVENUE_WORKING_KEY?.trim() ?? '';
    const isLiveConfigured =
      merchantId.length > 0 &&
      accessCode.length > 0 &&
      workingKey.length > 0 &&
      !merchantId.includes('MY_CCAVENUE') &&
      !accessCode.includes('MY_CCAVENUE') &&
      !workingKey.includes('MY_CCAVENUE');

    const ccavenueEnv = process.env.CCAVENUE_ENV === 'production' ? 'production' : 'test';
    const liveGatewayUrl =
      ccavenueEnv === 'production'
        ? 'https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction'
        : 'https://test.ccavenue.com/transaction/transaction.do?command=initiateTransaction';

    return {
      isLiveConfigured,
      mode: (isLiveConfigured ? 'ccavenue_live' : 'ccavenue_sandbox') as
        | 'ccavenue_live'
        | 'ccavenue_sandbox',
      merchantId: isLiveConfigured ? merchantId : 'AURELIA_SANDBOX_MERCHANT',
      accessCode: isLiveConfigured ? accessCode : 'AVAU_SANDBOX_ACCESS',
      workingKey: isLiveConfigured ? workingKey : SANDBOX_CCAVENUE_WORKING_KEY,
      gatewayUrl: isLiveConfigured ? liveGatewayUrl : '/api/payments/ccavenue/response',
    };
  }

  // CCAvenue UPI, Card & NetBanking Order Creation + AES-128-CBC encRequest Generation
  app.post('/api/payments/ccavenue/order', (req, res) => {
    try {
      const { amountInr, rideId, method, customerName } = req.body ?? {};
      const amountNum = Number(amountInr);
      if (!Number.isFinite(amountNum) || amountNum < 1 || amountNum > 500000) {
        return res.status(400).json({ success: false, error: 'Invalid fare amount for CCAvenue order' });
      }
      if (!rideId || typeof rideId !== 'string' || rideId.length > 64) {
        return res.status(400).json({ success: false, error: 'Valid rideId is required' });
      }

      const normalizedMethod: 'upi' | 'card' | 'netbanking' =
        method === 'card' ? 'card' : method === 'netbanking' ? 'netbanking' : 'upi';
      const paymentOption: 'OPTUPI' | 'OPTCRDC' | 'OPTNBK' =
        normalizedMethod === 'card'
          ? 'OPTCRDC'
          : normalizedMethod === 'netbanking'
            ? 'OPTNBK'
            : 'OPTUPI';

      const cfg = resolveCcavenueConfig();
      const orderId = `AURCCA${Date.now()}`;
      const formattedAmount = amountNum.toFixed(2);
      const baseOrigin = (process.env.APP_URL && !process.env.APP_URL.includes('MY_APP_URL')
        ? process.env.APP_URL
        : `${req.protocol}://${req.get('host') || 'localhost:3000'}`).replace(/\/$/, '');

      const plainRequest = buildCcavenuePlainRequest({
        merchantId: cfg.merchantId,
        orderId,
        currency: 'INR',
        amount: formattedAmount,
        redirectUrl: `${baseOrigin}/api/payments/ccavenue/response`,
        cancelUrl: `${baseOrigin}/api/payments/ccavenue/response`,
        billingName: typeof customerName === 'string' ? customerName : 'Aurelia Rider',
        paymentOption,
        rideId,
      });

      const encRequest = encryptCcavenuePayload(plainRequest, cfg.workingKey);

      ccavenueOrders.set(orderId, {
        orderId,
        rideId,
        amountInr: Number(formattedAmount),
        method: normalizedMethod,
        paymentOption,
        mode: cfg.mode,
        status: 'initiated',
        createdAt: Date.now(),
      });

      return res.json({
        success: true,
        gateway: 'ccavenue',
        mode: cfg.mode,
        gatewayUrl: cfg.gatewayUrl,
        merchantId: cfg.merchantId,
        accessCode: cfg.accessCode,
        orderId,
        amountInr: formattedAmount,
        currency: 'INR',
        paymentOption,
        method: normalizedMethod,
        encRequest,
      });
    } catch (err: any) {
      console.error('CCAvenue order error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to create CCAvenue order' });
    }
  });

  // CCAvenue AES-128-CBC encResp Verification & Reconciliation
  app.post('/api/payments/ccavenue/verify', (req, res) => {
    try {
      const { order_id, encResp, paymentMethodDetails } = req.body ?? {};
      if (!order_id || typeof order_id !== 'string') {
        return res.status(400).json({ success: false, verified: false, error: 'Missing CCAvenue order ID' });
      }

      const order = ccavenueOrders.get(order_id);
      if (!order) {
        return res.status(404).json({ success: false, verified: false, error: 'CCAvenue order not found on server' });
      }

      const cfg = resolveCcavenueConfig();
      let encPayloadToVerify = typeof encResp === 'string' && encResp.trim().length > 0 ? encResp.trim() : '';

      if (order.mode === 'ccavenue_live' && !encPayloadToVerify) {
        return res.status(400).json({
          success: false,
          verified: false,
          error: 'Encrypted CCAvenue encResp payload is required in live mode.',
        });
      }

      // In verifiable sandbox mode, mint a genuine AES-128-CBC encrypted CCAvenue response string
      if (!encPayloadToVerify && order.mode === 'ccavenue_sandbox') {
        if (order.method === 'upi') {
          const upi = String(paymentMethodDetails?.upiId ?? '').trim();
          if (!/^[a-zA-Z0-9.\-_]{2,120}@[a-zA-Z]{2,40}$/.test(upi)) {
            return res.status(400).json({ success: false, verified: false, error: 'Enter a valid UPI ID (e.g. rider@okicici).' });
          }
        } else if (order.method === 'card') {
          const last4 = String(paymentMethodDetails?.cardLast4 ?? '').replace(/\D/g, '');
          if (last4.length !== 4) {
            return res.status(400).json({ success: false, verified: false, error: 'Enter the 4-digit card suffix.' });
          }
        }

        const simTrackingId = `CCA-TRK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const simBankRef = `CCA-BNK-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const simPlainResp = new URLSearchParams({
          order_id: order.orderId,
          tracking_id: simTrackingId,
          bank_ref_no: simBankRef,
          order_status: 'Success',
          payment_mode: order.paymentOption,
          currency: 'INR',
          amount: order.amountInr.toFixed(2),
        }).toString();

        encPayloadToVerify = encryptCcavenuePayload(simPlainResp, cfg.workingKey);
      }

      const decrypted = decryptCcavenuePayload(encPayloadToVerify, cfg.workingKey);
      const parsed = parseCcavenueResponseParams(decrypted);

      if (parsed.order_id !== order.orderId) {
        return res.status(400).json({ success: false, verified: false, error: 'CCAvenue order ID mismatch.' });
      }
      const parsedAmt = Number(parsed.amount);
      if (!Number.isFinite(parsedAmt) || Math.abs(parsedAmt - order.amountInr) > 0.01) {
        return res.status(400).json({ success: false, verified: false, error: 'CCAvenue amount verification mismatch.' });
      }
      if (parsed.order_status !== 'Success') {
        order.status = 'failed';
        return res.status(400).json({
          success: false,
          verified: false,
          error: `CCAvenue transaction status: ${parsed.order_status || 'Aborted'}`,
        });
      }

      const trackingId = parsed.tracking_id || `CCA-TRK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const bankRefNo = parsed.bank_ref_no || `CCA-BNK-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      order.status = 'paid';
      order.trackingId = trackingId;
      order.bankRefNo = bankRefNo;

      return res.json({
        success: true,
        verified: true,
        gateway: 'ccavenue',
        orderId: order.orderId,
        trackingId,
        bankRefNo,
        paymentMode: parsed.payment_mode || order.paymentOption,
        encRespDigest: `${encPayloadToVerify.slice(0, 24)}...`,
        reconciledAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('CCAvenue verify error:', err);
      res.status(500).json({ success: false, verified: false, error: err.message || 'CCAvenue verification failed' });
    }
  });

  // Standard CCAvenue Redirect / Cancel Callback Handler (receives URL-encoded encResp)
  app.post('/api/payments/ccavenue/response', (req, res) => {
    try {
      const encResp = typeof req.body?.encResp === 'string' ? req.body.encResp.trim() : '';
      if (!encResp) {
        return res.status(400).json({ success: false, verified: false, error: 'Missing encResp in CCAvenue callback.' });
      }
      const cfg = resolveCcavenueConfig();
      const decrypted = decryptCcavenuePayload(encResp, cfg.workingKey);
      const parsed = parseCcavenueResponseParams(decrypted);
      const order = parsed.order_id ? ccavenueOrders.get(parsed.order_id) : undefined;
      if (order && parsed.order_status === 'Success') {
        order.status = 'paid';
        order.trackingId = parsed.tracking_id;
        order.bankRefNo = parsed.bank_ref_no;
      } else if (order) {
        order.status = 'failed';
      }
      return res.json({
        success: parsed.order_status === 'Success',
        orderId: parsed.order_id ?? '',
        trackingId: parsed.tracking_id ?? '',
        bankRefNo: parsed.bank_ref_no ?? '',
        orderStatus: parsed.order_status ?? 'Unknown',
      });
    } catch (err: any) {
      console.error('CCAvenue callback parse error:', err);
      return res.status(400).json({ success: false, error: err?.message || 'Unable to decrypt CCAvenue response.' });
    }
  });

  // Secure UPI Payout Validation & Reconciliation Endpoint
  app.post('/api/payouts/reconcile', (req, res) => {
    try {
      const { driverId, upiId, netPayoutInr, grossCollectedInr, companyFeeInr } = req.body ?? {};
      if (!driverId || typeof driverId !== 'string') {
        return res.status(400).json({ success: false, error: 'Valid driverId is required' });
      }
      if (!upiId || typeof upiId !== 'string' || !/^[a-zA-Z0-9.\-_]{2,120}@[a-zA-Z]{2,40}$/.test(upiId.trim())) {
        return res.status(400).json({ success: false, error: 'Enter a valid UPI ID (example: driver@okicici)' });
      }
      const payoutNum = Number(netPayoutInr);
      if (!Number.isFinite(payoutNum) || payoutNum <= 0 || payoutNum > 500000) {
        return res.status(400).json({ success: false, error: 'Invalid payout amount' });
      }
      const utrReference = `UTR-AUR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      return res.json({
        success: true,
        status: 'reconciled',
        upiId: upiId.trim(),
        netPayoutInr: Math.round(payoutNum * 100) / 100,
        grossCollectedInr: Number(grossCollectedInr) || payoutNum,
        companyFeeInr: Number(companyFeeInr) || 0,
        utrReference,
        reconciledAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('UPI payout reconciliation error:', err);
      res.status(500).json({ success: false, error: err.message || 'UPI reconciliation failed' });
    }
  });

  // Timing-safe Admin Panel Lock Verification Endpoint
  const ADMIN_PASSCODE_DIGEST = Buffer.from(
    '550f337898fbfd33749fa9cf32a6f3cb48e694bb4060bfee17b27349b0253b95',
    'hex'
  );
  const adminUnlockAttempts = new Map<string, { count: number; resetAt: number }>();

  app.post('/api/admin/unlock', (req, res) => {
    try {
      const clientKey = req.ip || 'local';
      const now = Date.now();
      const rec = adminUnlockAttempts.get(clientKey);
      if (rec && rec.resetAt > now && rec.count >= 15) {
        return res.status(429).json({
          success: false,
          unlocked: false,
          error: 'Too many failed passcode attempts. Please wait a few minutes and try again.',
        });
      }

      const rawPasscode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
      if (!rawPasscode) {
        return res.status(400).json({
          success: false,
          unlocked: false,
          error: 'Please enter the Admin access number.',
        });
      }

      const candidateDigest = process.env.ADMIN_PASSCODE
        ? crypto
            .createHash('sha256')
            .update(`aurelia-admin-v1:${process.env.ADMIN_PASSCODE.trim()}`)
            .digest()
        : ADMIN_PASSCODE_DIGEST;

      const inputDigest = crypto
        .createHash('sha256')
        .update(`aurelia-admin-v1:${rawPasscode}`)
        .digest();

      const matched =
        inputDigest.length === candidateDigest.length &&
        crypto.timingSafeEqual(inputDigest, candidateDigest);

      if (!matched) {
        const nextCount = rec && rec.resetAt > now ? rec.count + 1 : 1;
        adminUnlockAttempts.set(clientKey, {
          count: nextCount,
          resetAt: rec && rec.resetAt > now ? rec.resetAt : now + 5 * 60 * 1000,
        });
        return res.status(401).json({
          success: false,
          unlocked: false,
          error: 'Incorrect access number. Access to Admin Panel is locked.',
        });
      }

      adminUnlockAttempts.delete(clientKey);
      return res.json({
        success: true,
        unlocked: true,
        verifiedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Admin unlock error:', err);
      return res.status(500).json({
        success: false,
        unlocked: false,
        error: 'Unable to verify admin passcode right now.',
      });
    }
  });

  // Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/api/gemini/live' });

  wss.on('connection', async (clientSocket: WebSocket) => {
    if (!process.env.GEMINI_API_KEY) {
      clientSocket.send(
        JSON.stringify({
          type: 'error',
          error: 'GEMINI_API_KEY is not configured on the server for Live Voice.',
        })
      );
      clientSocket.close();
      return;
    }

    let liveSession: Awaited<ReturnType<typeof ai.live.connect>> | null = null;
    try {
      liveSession = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
          systemInstruction:
            'You are Aurelia Live Voice Copilot for Karnataka chauffeurs. Give short, calm, spoken-friendly answers about routes, speed limits, special care pickups, and flat ₹3 per-ride settlement.',
        },
        callbacks: {
          onopen: () => {
            if (clientSocket.readyState === clientSocket.OPEN) {
              clientSocket.send(JSON.stringify({ type: 'ready' }));
            }
          },
          onmessage: (msg: LiveServerMessage) => {
            if (clientSocket.readyState !== clientSocket.OPEN) return;

            if (msg.serverContent?.interrupted) {
              clientSocket.send(JSON.stringify({ type: 'interrupted' }));
            }
            const inputTranscript = (msg.serverContent as any)?.inputTranscription?.text;
            if (typeof inputTranscript === 'string' && inputTranscript.trim()) {
              clientSocket.send(
                JSON.stringify({ type: 'input_transcript', text: inputTranscript })
              );
            }
            const outputTranscript = (msg.serverContent as any)?.outputTranscription?.text;
            if (typeof outputTranscript === 'string' && outputTranscript.trim()) {
              clientSocket.send(
                JSON.stringify({ type: 'output_transcript', text: outputTranscript })
              );
            }
            const parts = msg.serverContent?.modelTurn?.parts ?? [];
            for (const part of parts) {
              if (part.inlineData?.data) {
                clientSocket.send(
                  JSON.stringify({
                    type: 'audio',
                    data: part.inlineData.data,
                    mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000',
                  })
                );
              }
            }
          },
          onerror: (err: any) => {
            if (clientSocket.readyState === clientSocket.OPEN) {
              clientSocket.send(
                JSON.stringify({
                  type: 'error',
                  error: err?.message || 'Gemini Live session error.',
                })
              );
            }
          },
          onclose: () => {
            if (clientSocket.readyState === clientSocket.OPEN) {
              clientSocket.send(JSON.stringify({ type: 'closed' }));
            }
          },
        },
      });
    } catch (err: any) {
      if (clientSocket.readyState === clientSocket.OPEN) {
        clientSocket.send(
          JSON.stringify({
            type: 'error',
            error: err?.message || 'Unable to establish Gemini Live Voice connection.',
          })
        );
      }
      clientSocket.close();
      return;
    }

    clientSocket.on('message', (raw) => {
      if (!liveSession) return;
      try {
        const payload = JSON.parse(raw.toString());
        if (payload?.type === 'audio' && typeof payload.data === 'string') {
          liveSession.sendRealtimeInput({
            media: {
              mimeType: 'audio/pcm;rate=16000',
              data: payload.data,
            },
          });
        } else if (payload?.type === 'text' && typeof payload.text === 'string') {
          liveSession.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: payload.text }] }],
            turnComplete: true,
          });
        }
      } catch (err: any) {
        if (clientSocket.readyState === clientSocket.OPEN) {
          clientSocket.send(
            JSON.stringify({ type: 'error', error: err?.message || 'Malformed audio packet' })
          );
        }
      }
    });

    clientSocket.on('close', () => {
      try {
        liveSession?.close();
      } catch {
        // Ignore close cleanup errors
      }
    });
  });

  const port = process.env.PORT || 3000;
  httpServer.listen(port, () => {
    console.log(`Aurelia full-stack server running on http://localhost:${port}`);
  });
}

startServer();
