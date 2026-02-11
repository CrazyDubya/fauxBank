import { Context, Next } from 'hono';
import { createComplianceService } from '../services/compliance';
import { createLedgerService } from '../services/ledger';
import { Errors, errorResponse } from '../utils/errors';
import { logSecurityEvent } from './audit';

/**
 * KYC Enforcement Middleware
 *
 * Validates KYC status for operations that require verified customer identity.
 * Critical for regulatory compliance (AML/KYC requirements).
 */

// Transaction thresholds that require verified KYC (in cents)
const KYC_THRESHOLDS = {
  // Single transaction threshold requiring KYC
  SINGLE_TRANSACTION: 100000, // F$1,000 - transactions above this require verified KYC

  // Daily aggregate threshold
  DAILY_AGGREGATE: 300000, // F$3,000 - cumulative daily transactions above this require KYC

  // Wire transfer threshold (always require KYC)
  WIRE_TRANSFER: 0, // All wire transfers require KYC
};

/**
 * Check if a customer's KYC status is verified
 */
export async function isKycVerified(db: D1Database, customerId: string): Promise<boolean> {
  const complianceService = createComplianceService(db);
  const status = await complianceService.getKycStatus(customerId);
  return status === 'APPROVED';
}

/**
 * Middleware to require verified KYC for all operations on a route
 * Use this for high-risk operations like wire transfers
 */
export function requireKycVerified() {
  return async (c: Context, next: Next) => {
    const agent = c.get('agent');
    if (!agent) {
      return errorResponse(c, Errors.invalidCredentials());
    }

    // ADMIN agents bypass KYC checks (for system operations)
    if (agent.type === 'ADMIN') {
      return next();
    }

    // Get account from path to find customer
    const accountId = c.req.param('accountId');
    if (!accountId) {
      // If no account in path, let the operation proceed
      // (KYC check will happen at transaction level)
      return next();
    }

    const ledgerService = createLedgerService(c.env.DB);
    const account = await ledgerService.getAccount(accountId);

    if (!account) {
      return errorResponse(c, Errors.accountNotFound(accountId));
    }

    // Check KYC status of account owner
    const verified = await isKycVerified(c.env.DB, account.owner_id);

    if (!verified) {
      // Log security event
      logSecurityEvent(
        c.env.DB,
        agent.id,
        'KYC_VERIFICATION_REQUIRED',
        { accountId, customerId: account.owner_id },
        'BLOCKED'
      ).catch(() => {});

      return errorResponse(c, Errors.validationError({
        kyc: ['Customer KYC verification required for this operation'],
      }));
    }

    return next();
  };
}

/**
 * Validate KYC for transaction based on amount thresholds
 * Use in transaction creation routes
 */
export async function validateTransactionKyc(
  c: Context,
  debitAccountId: string,
  creditAccountId: string,
  amount: number,
  transactionType: string
): Promise<{ allowed: boolean; reason?: string }> {
  const agent = c.get('agent');

  // ADMIN agents bypass KYC checks
  if (agent?.type === 'ADMIN') {
    return { allowed: true };
  }

  // Wire transfers always require KYC
  if (transactionType === 'WIRE') {
    const ledgerService = createLedgerService(c.env.DB);

    // Check debit account owner KYC
    const debitAccount = await ledgerService.getAccount(debitAccountId);
    if (debitAccount && !isSystemAccount(debitAccountId)) {
      const verified = await isKycVerified(c.env.DB, debitAccount.owner_id);
      if (!verified) {
        logSecurityEvent(
          c.env.DB,
          agent?.id,
          'WIRE_KYC_REQUIRED',
          { accountId: debitAccountId, customerId: debitAccount.owner_id },
          'BLOCKED'
        ).catch(() => {});

        return {
          allowed: false,
          reason: 'Wire transfers require verified KYC status',
        };
      }
    }
  }

  // Check if amount exceeds single transaction threshold
  if (amount > KYC_THRESHOLDS.SINGLE_TRANSACTION) {
    const ledgerService = createLedgerService(c.env.DB);

    // Check both accounts' owners
    for (const accountId of [debitAccountId, creditAccountId]) {
      if (isSystemAccount(accountId)) continue;

      const account = await ledgerService.getAccount(accountId);
      if (account) {
        const verified = await isKycVerified(c.env.DB, account.owner_id);
        if (!verified) {
          logSecurityEvent(
            c.env.DB,
            agent?.id,
            'HIGH_VALUE_KYC_REQUIRED',
            { accountId, customerId: account.owner_id, amount },
            'BLOCKED'
          ).catch(() => {});

          return {
            allowed: false,
            reason: `Transactions over F$${(KYC_THRESHOLDS.SINGLE_TRANSACTION / 100).toFixed(2)} require verified KYC status`,
          };
        }
      }
    }
  }

  return { allowed: true };
}

/**
 * Check if an account is a system account (exempt from KYC)
 */
function isSystemAccount(accountId: string): boolean {
  const systemAccounts = [
    'CH-COMM-SEEDBANK-AA',
    'CH-COMM-FEEINCOM-BB',
    'CH-COMM-INTEREST-CC',
    'CH-COMM-EXTERNAL-DD',
  ];
  return systemAccounts.includes(accountId);
}

/**
 * Middleware for account creation - requires KYC for owner
 */
export function requireKycForAccountCreation() {
  return async (c: Context, next: Next) => {
    const agent = c.get('agent');

    // ADMIN agents bypass KYC checks
    if (agent?.type === 'ADMIN') {
      return next();
    }

    try {
      const body = await c.req.json();
      const ownerId = body?.owner_id;

      if (ownerId) {
        const verified = await isKycVerified(c.env.DB, ownerId);

        if (!verified) {
          logSecurityEvent(
            c.env.DB,
            agent?.id,
            'ACCOUNT_CREATION_KYC_REQUIRED',
            { ownerId },
            'BLOCKED'
          ).catch(() => {});

          return errorResponse(c, Errors.validationError({
            kyc: ['Customer KYC verification required before creating accounts'],
          }));
        }
      }
    } catch {
      // Body parsing failed - let validation handle it
    }

    return next();
  };
}
