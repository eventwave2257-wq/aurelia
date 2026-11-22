import crypto from 'node:crypto';

/**
 * Standard CCAvenue 16-byte AES-128-CBC initialization vector.
 */
export const CCAVENUE_FIXED_IV = Buffer.from([
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
  0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
]);

export interface CcavenueRequestParams {
  merchantId: string;
  orderId: string;
  currency?: string;
  amount: string;
  redirectUrl: string;
  cancelUrl: string;
  billingName: string;
  paymentOption: 'OPTUPI' | 'OPTCRDC' | 'OPTNBK';
  rideId: string;
}

/**
 * Derives the 128-bit AES key from CCAvenue Working Key using MD5 per CCAvenue kit specification.
 */
function deriveAes128Key(workingKey: string): Buffer {
  return crypto.createHash('md5').update(workingKey, 'utf8').digest();
}

/**
 * Encrypts a CCAvenue request or response query string into uppercase/lowercase hex using AES-128-CBC.
 */
export function encryptCcavenuePayload(plainText: string, workingKey: string): string {
  const key = deriveAes128Key(workingKey);
  const cipher = crypto.createCipheriv('aes-128-cbc', key, CCAVENUE_FIXED_IV);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

/**
 * Decrypts a CCAvenue hex-encoded `encRequest` or `encResp` payload using AES-128-CBC.
 */
export function decryptCcavenuePayload(encHex: string, workingKey: string): string {
  const cleanHex = (encHex || '').trim();
  if (!/^[0-9a-fA-F]+$/.test(cleanHex) || cleanHex.length % 2 !== 0) {
    throw new Error('Invalid CCAvenue encrypted hex payload.');
  }
  const key = deriveAes128Key(workingKey);
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, CCAVENUE_FIXED_IV);
  let decrypted = decipher.update(cleanHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Builds the canonical CCAvenue query parameter string for checkout form submission.
 */
export function buildCcavenuePlainRequest(params: CcavenueRequestParams): string {
  const query = new URLSearchParams({
    merchant_id: params.merchantId,
    order_id: params.orderId,
    currency: params.currency ?? 'INR',
    amount: params.amount,
    redirect_url: params.redirectUrl,
    cancel_url: params.cancelUrl,
    language: 'EN',
    billing_name: params.billingName.slice(0, 60) || 'Aurelia Rider',
    payment_option: params.paymentOption,
    merchant_param1: params.rideId.slice(0, 64),
  });
  return query.toString();
}

/**
 * Parses decrypted CCAvenue `encResp` key=value pairs into a normalized dictionary.
 */
export function parseCcavenueResponseParams(decrypted: string): Record<string, string> {
  const params = new URLSearchParams(decrypted);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) {
    out[k] = v;
  }
  return out;
}
