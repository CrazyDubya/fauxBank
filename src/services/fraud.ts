import { D1Database } from '@cloudflare/workers-types';
import { createAuditService } from './audit';
import { createLedgerService } from './ledger';

/**
 * Fraud Scoring Service
 *
 * Implements risk assessment for transactions and account activities.
 * Uses multiple signals to calculate a risk score (0.0 - 1.0).
 */

export interface FraudSignal {
  name: string;
  weight: number;
  triggered: boolean;
  details?: string;
}

export interface FraudAssessment {
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  signals: FraudSignal[];
  recommendation: 'ALLOW' | 'REVIEW' | 'BLOCK';
  flags: string[];
}

export interface TransactionRiskInput {
  debit_account_id: string;
  credit_account_id: string;
  amount: number;
  transaction_type: string;
  agent_id?: string;
  metadata?: Record<string, unknown>;
}

// Risk thresholds
const RISK_THRESHOLDS = {
  LOW: 0.25,
  MEDIUM: 0.50,
  HIGH: 0.75,
  CRITICAL: 0.90,
};

// Transaction amount thresholds (in cents)
const AMOUNT_THRESHOLDS = {
  LARGE: 500000, // F$5,000 - triggers additional scrutiny
  VERY_LARGE: 1000000, // F$10,000 - high risk flag
  SUSPICIOUS: 5000000, // F$50,000 - requires review
};

// Velocity limits for fraud detection
const VELOCITY_LIMITS = {
  TRANSACTIONS_PER_HOUR: 20,
  TRANSACTIONS_PER_DAY: 100,
  UNIQUE_RECIPIENTS_PER_DAY: 10,
};

export interface FraudService {
  assessTransactionRisk(input: TransactionRiskInput): Promise<FraudAssessment>;
  getAccountRiskProfile(accountId: string): Promise<{
    risk_score: number;
    recent_alerts: number;
    flags: string[];
  }>;
  reportSuspiciousActivity(
    accountId: string,
    description: string,
    agentId?: string
  ): Promise<string>;
  getRecentAlerts(since: string): Promise<Array<{
    id: string;
    account_id: string;
    risk_score: number;
    created_at: string;
  }>>;
}

export function createFraudService(db: D1Database): FraudService {
  const ledger = createLedgerService(db);
  const audit = createAuditService(db);

  return {
    async assessTransactionRisk(input: TransactionRiskInput): Promise<FraudAssessment> {
      const signals: FraudSignal[] = [];
      let totalWeight = 0;
      let triggeredWeight = 0;

      // Signal 1: Large transaction amount
      const largeAmountSignal: FraudSignal = {
        name: 'LARGE_AMOUNT',
        weight: 0.15,
        triggered: input.amount >= AMOUNT_THRESHOLDS.LARGE,
        details: input.amount >= AMOUNT_THRESHOLDS.VERY_LARGE
          ? 'Very large transaction amount'
          : input.amount >= AMOUNT_THRESHOLDS.LARGE
          ? 'Large transaction amount'
          : undefined,
      };
      signals.push(largeAmountSignal);
      totalWeight += largeAmountSignal.weight;
      if (largeAmountSignal.triggered) triggeredWeight += largeAmountSignal.weight;

      // Signal 2: Suspicious amount (just under reporting thresholds - structuring)
      const structuringSignal: FraudSignal = {
        name: 'POSSIBLE_STRUCTURING',
        weight: 0.25,
        triggered: isStructuringPattern(input.amount),
        details: 'Amount may indicate structuring to avoid reporting',
      };
      signals.push(structuringSignal);
      totalWeight += structuringSignal.weight;
      if (structuringSignal.triggered) triggeredWeight += structuringSignal.weight;

      // Signal 3: High velocity (many transactions in short time)
      const velocity = await getTransactionVelocity(db, input.debit_account_id);
      const velocitySignal: FraudSignal = {
        name: 'HIGH_VELOCITY',
        weight: 0.20,
        triggered: velocity.hourly > VELOCITY_LIMITS.TRANSACTIONS_PER_HOUR * 0.8,
        details: `${velocity.hourly} transactions in the last hour`,
      };
      signals.push(velocitySignal);
      totalWeight += velocitySignal.weight;
      if (velocitySignal.triggered) triggeredWeight += velocitySignal.weight;

      // Signal 4: New recipient (first time transacting with this account)
      const isNewRecipient = await checkNewRecipient(db, input.debit_account_id, input.credit_account_id);
      const newRecipientSignal: FraudSignal = {
        name: 'NEW_RECIPIENT',
        weight: 0.10,
        triggered: isNewRecipient && input.amount >= AMOUNT_THRESHOLDS.LARGE,
        details: 'First transaction to this recipient with large amount',
      };
      signals.push(newRecipientSignal);
      totalWeight += newRecipientSignal.weight;
      if (newRecipientSignal.triggered) triggeredWeight += newRecipientSignal.weight;

      // Signal 5: Many unique recipients (smurfing indicator)
      const uniqueRecipients = await getUniqueRecipientCount(db, input.debit_account_id);
      const smurfingSignal: FraudSignal = {
        name: 'MANY_RECIPIENTS',
        weight: 0.15,
        triggered: uniqueRecipients > VELOCITY_LIMITS.UNIQUE_RECIPIENTS_PER_DAY * 0.8,
        details: `${uniqueRecipients} unique recipients in last 24 hours`,
      };
      signals.push(smurfingSignal);
      totalWeight += smurfingSignal.weight;
      if (smurfingSignal.triggered) triggeredWeight += smurfingSignal.weight;

      // Signal 6: Account age (new accounts are higher risk)
      const accountAge = await getAccountAge(db, input.debit_account_id);
      const newAccountSignal: FraudSignal = {
        name: 'NEW_ACCOUNT',
        weight: 0.10,
        triggered: accountAge < 7 && input.amount >= AMOUNT_THRESHOLDS.LARGE,
        details: `Account is ${accountAge} days old with large transaction`,
      };
      signals.push(newAccountSignal);
      totalWeight += newAccountSignal.weight;
      if (newAccountSignal.triggered) triggeredWeight += newAccountSignal.weight;

      // Signal 7: Unusual time (transactions at odd hours)
      const hour = new Date().getUTCHours();
      const unusualTimeSignal: FraudSignal = {
        name: 'UNUSUAL_TIME',
        weight: 0.05,
        triggered: (hour >= 1 && hour <= 5) && input.amount >= AMOUNT_THRESHOLDS.LARGE,
        details: 'Large transaction during unusual hours (01:00-05:00 UTC)',
      };
      signals.push(unusualTimeSignal);
      totalWeight += unusualTimeSignal.weight;
      if (unusualTimeSignal.triggered) triggeredWeight += unusualTimeSignal.weight;

      // Calculate risk score
      const riskScore = totalWeight > 0 ? triggeredWeight / totalWeight : 0;

      // Determine risk level
      let riskLevel: FraudAssessment['risk_level'];
      if (riskScore >= RISK_THRESHOLDS.CRITICAL) {
        riskLevel = 'CRITICAL';
      } else if (riskScore >= RISK_THRESHOLDS.HIGH) {
        riskLevel = 'HIGH';
      } else if (riskScore >= RISK_THRESHOLDS.MEDIUM) {
        riskLevel = 'MEDIUM';
      } else {
        riskLevel = 'LOW';
      }

      // Determine recommendation
      let recommendation: FraudAssessment['recommendation'];
      if (riskScore >= RISK_THRESHOLDS.HIGH) {
        recommendation = 'BLOCK';
      } else if (riskScore >= RISK_THRESHOLDS.MEDIUM) {
        recommendation = 'REVIEW';
      } else {
        recommendation = 'ALLOW';
      }

      // Collect flags
      const flags = signals
        .filter(s => s.triggered)
        .map(s => s.name);

      // Log high-risk transactions to audit
      if (riskScore >= RISK_THRESHOLDS.MEDIUM) {
        await audit.log({
          log_type: 'SECURITY_EVENT',
          agent_id: input.agent_id,
          account_id: input.debit_account_id,
          action: 'FRAUD_ASSESSMENT',
          resource_type: 'TRANSACTION',
          request: {
            amount: input.amount,
            transaction_type: input.transaction_type,
            credit_account: input.credit_account_id,
          },
          response: {
            risk_score: riskScore,
            risk_level: riskLevel,
            recommendation,
            signals: signals.filter(s => s.triggered).map(s => s.name),
          },
          outcome: recommendation === 'BLOCK' ? 'BLOCKED' : 'SUCCESS',
          risk_score: riskScore,
          flags,
        });
      }

      return {
        risk_score: Math.round(riskScore * 100) / 100,
        risk_level: riskLevel,
        signals,
        recommendation,
        flags,
      };
    },

    async getAccountRiskProfile(accountId: string) {
      // Get recent alerts for this account
      const recentAlerts = await db
        .prepare(
          `SELECT COUNT(*) as count FROM audit_logs
           WHERE account_id = ? AND log_type = 'SECURITY_EVENT'
           AND created_at > datetime('now', '-30 days')`
        )
        .bind(accountId)
        .first();

      const alertCount = (recentAlerts?.count as number) || 0;

      // Get any existing flags
      const account = await ledger.getAccount(accountId);
      const flags: string[] = [];

      if (alertCount > 5) flags.push('FREQUENT_ALERTS');
      if (account?.status === 'FROZEN') flags.push('ACCOUNT_FROZEN');

      // Calculate base risk score from alert history
      const riskScore = Math.min(0.1 * alertCount, 1.0);

      return {
        risk_score: riskScore,
        recent_alerts: alertCount,
        flags,
      };
    },

    async reportSuspiciousActivity(
      accountId: string,
      description: string,
      agentId?: string
    ) {
      const logId = await audit.log({
        log_type: 'SECURITY_EVENT',
        agent_id: agentId,
        account_id: accountId,
        action: 'SUSPICIOUS_ACTIVITY_REPORTED',
        request: { description },
        outcome: 'SUCCESS',
        risk_score: 0.7,
        flags: ['MANUAL_REPORT'],
      });

      return logId;
    },

    async getRecentAlerts(since: string) {
      const results = await db
        .prepare(
          `SELECT id, account_id, risk_score, created_at FROM audit_logs
           WHERE log_type = 'SECURITY_EVENT' AND risk_score >= 0.5
           AND created_at > ?
           ORDER BY risk_score DESC, created_at DESC
           LIMIT 100`
        )
        .bind(since)
        .all();

      return (results.results || []).map(row => ({
        id: row.id as string,
        account_id: row.account_id as string,
        risk_score: row.risk_score as number,
        created_at: row.created_at as string,
      }));
    },
  };
}

// Helper functions

function isStructuringPattern(amount: number): boolean {
  // Check for amounts just under common reporting thresholds
  // CTR threshold is $10,000 (1,000,000 cents)
  const ctrThreshold = 1000000;
  const margin = 50000; // F$500 margin

  // Amount is suspicious if it's just under the threshold
  if (amount >= ctrThreshold - margin && amount < ctrThreshold) {
    return true;
  }

  // Check for round amounts that might indicate structuring
  // E.g., exactly $9,900, $9,500, etc.
  if (amount >= 900000 && amount < ctrThreshold && amount % 10000 === 0) {
    return true;
  }

  return false;
}

async function getTransactionVelocity(
  db: D1Database,
  accountId: string
): Promise<{ hourly: number; daily: number }> {
  const [hourlyResult, dailyResult] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) as count FROM transactions
         WHERE (debit_account_id = ? OR credit_account_id = ?)
         AND created_at > datetime('now', '-1 hour')`
      )
      .bind(accountId, accountId)
      .first(),
    db
      .prepare(
        `SELECT COUNT(*) as count FROM transactions
         WHERE (debit_account_id = ? OR credit_account_id = ?)
         AND created_at > datetime('now', '-1 day')`
      )
      .bind(accountId, accountId)
      .first(),
  ]);

  return {
    hourly: (hourlyResult?.count as number) || 0,
    daily: (dailyResult?.count as number) || 0,
  };
}

async function checkNewRecipient(
  db: D1Database,
  debitAccountId: string,
  creditAccountId: string
): Promise<boolean> {
  const result = await db
    .prepare(
      `SELECT COUNT(*) as count FROM transactions
       WHERE debit_account_id = ? AND credit_account_id = ?
       AND created_at < datetime('now')`
    )
    .bind(debitAccountId, creditAccountId)
    .first();

  return (result?.count as number) === 0;
}

async function getUniqueRecipientCount(
  db: D1Database,
  accountId: string
): Promise<number> {
  const result = await db
    .prepare(
      `SELECT COUNT(DISTINCT credit_account_id) as count FROM transactions
       WHERE debit_account_id = ?
       AND created_at > datetime('now', '-1 day')`
    )
    .bind(accountId)
    .first();

  return (result?.count as number) || 0;
}

async function getAccountAge(db: D1Database, accountId: string): Promise<number> {
  const result = await db
    .prepare(`SELECT created_at FROM accounts WHERE id = ?`)
    .bind(accountId)
    .first();

  if (!result?.created_at) return 365; // Default to old account if not found

  const createdAt = new Date(result.created_at as string);
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
