/**
 * ID Generation Utilities for FauxBank
 *
 * Various ID formats used throughout the system.
 */

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Generate an alpha-only ID with a prefix
 * Format: PREFIX-XXXX-XXXX-XXXX (where X is A-Z)
 */
export function generateAlphaId(prefix: string): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = prefix + '-';

  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) {
      result += '-';
    }
    result += letters[Math.floor(Math.random() * 26)];
  }

  return result;
}

/**
 * Generate a session ID
 * Format: SES-XXXX-XXXX-XXXX
 */
export function generateSessionId(): string {
  return generateAlphaId('SES');
}

/**
 * Generate a customer ID
 * Format: CUST-XXXX-XXXX-XXXX
 */
export function generateCustomerId(): string {
  return generateAlphaId('CUST');
}

/**
 * Generate a dispute ID
 * Format: DSP-XXXX-XXXX-XXXX
 */
export function generateDisputeId(): string {
  return generateAlphaId('DSP');
}

/**
 * Generate a KYC verification ID
 * Format: KYC-XXXX-XXXX-XXXX
 */
export function generateKycId(): string {
  return generateAlphaId('KYC');
}

/**
 * Generate an authorization ID
 * Format: AUTH-XXXX-XXXX-XXXX
 */
export function generateAuthorizationId(): string {
  return generateAlphaId('AUTH');
}

/**
 * Generate a wire transfer ID
 * Format: WIRE-XXXX-XXXX-XXXX
 */
export function generateWireId(): string {
  return generateAlphaId('WIRE');
}

/**
 * Generate a chargeback ID
 * Format: CHB-XXXX-XXXX-XXXX
 */
export function generateChargebackId(): string {
  return generateAlphaId('CHB');
}

/**
 * Generate an audit log ID
 * Format: LOG-XXXX-XXXX-XXXX
 */
export function generateLogId(): string {
  return generateAlphaId('LOG');
}

/**
 * Generate a failure injection ID
 * Format: FAIL-XXXX-XXXX-XXXX
 */
export function generateFailureId(): string {
  return generateAlphaId('FAIL');
}

/**
 * Generate an agent token
 * Returns a secure random token for API authentication
 */
export function generateAgentToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash an agent token for storage
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a card token (for simulated cards)
 * Format: CARD-XXXX-XXXX-XXXX-XXXX
 */
export function generateCardToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'CARD-';

  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) {
      result += '-';
    }
    result += chars[Math.floor(Math.random() * chars.length)];
  }

  return result;
}
