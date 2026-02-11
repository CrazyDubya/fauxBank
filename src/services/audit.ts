import { D1Database } from '@cloudflare/workers-types';
import { generateLogId } from '../utils/ids';

/**
 * Audit Service
 *
 * Provides comprehensive audit logging for all API operations.
 * Critical for regulatory compliance and security monitoring.
 */

export type AuditLogType =
  | 'API_REQUEST'
  | 'AUTH_SUCCESS'
  | 'AUTH_FAILURE'
  | 'TRANSACTION'
  | 'ACCOUNT_ACCESS'
  | 'SECURITY_EVENT'
  | 'ADMIN_ACTION'
  | 'COMPLIANCE_EVENT';

export type AuditOutcome = 'SUCCESS' | 'FAILURE' | 'BLOCKED';

export interface AuditLogEntry {
  log_type: AuditLogType;
  agent_id?: string;
  session_id?: string;
  customer_id?: string;
  account_id?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  outcome: AuditOutcome;
  error_code?: string;
  risk_score?: number;
  flags?: string[];
  manipulation_detected?: boolean;
  latency_ms?: number;
  trace_id?: string;
}

export interface AuditQuery {
  agent_id?: string;
  customer_id?: string;
  account_id?: string;
  log_type?: AuditLogType;
  outcome?: AuditOutcome;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

export interface AuditService {
  log(entry: AuditLogEntry): Promise<string>;
  logSecurityEvent(
    agent_id: string | undefined,
    action: string,
    details: Record<string, unknown>,
    outcome: AuditOutcome
  ): Promise<string>;
  logTransaction(
    agent_id: string,
    transaction_id: string,
    debit_account: string,
    credit_account: string,
    amount: number,
    outcome: AuditOutcome,
    error_code?: string
  ): Promise<string>;
  logAuthAttempt(
    agent_id: string | undefined,
    success: boolean,
    reason?: string,
    trace_id?: string
  ): Promise<string>;
  query(params: AuditQuery): Promise<AuditLogEntry[]>;
  getSecurityAlerts(since: string): Promise<AuditLogEntry[]>;
}

/**
 * Sanitize sensitive data from request/response objects
 * Removes tokens, passwords, and other sensitive fields
 */
function sanitizeData(data: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!data) return undefined;

  const sensitiveFields = [
    'token',
    'password',
    'secret',
    'authorization',
    'api_key',
    'card_number',
    'cvv',
    'pin',
    'ssn',
    'tax_id',
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    // Check if this is a sensitive field
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeData(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export function createAuditService(db: D1Database): AuditService {
  return {
    async log(entry: AuditLogEntry): Promise<string> {
      const logId = generateLogId();
      const now = new Date().toISOString();

      // Sanitize request/response data
      const sanitizedRequest = sanitizeData(entry.request);
      const sanitizedResponse = sanitizeData(entry.response);

      await db
        .prepare(
          `INSERT INTO audit_logs (
            id, log_type, agent_id, session_id, customer_id, account_id,
            action, resource_type, resource_id, request, response,
            outcome, error_code, risk_score, flags, manipulation_detected,
            latency_ms, trace_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          logId,
          entry.log_type,
          entry.agent_id || null,
          entry.session_id || null,
          entry.customer_id || null,
          entry.account_id || null,
          entry.action,
          entry.resource_type || null,
          entry.resource_id || null,
          sanitizedRequest ? JSON.stringify(sanitizedRequest) : null,
          sanitizedResponse ? JSON.stringify(sanitizedResponse) : null,
          entry.outcome,
          entry.error_code || null,
          entry.risk_score || 0,
          entry.flags ? JSON.stringify(entry.flags) : null,
          entry.manipulation_detected ? 1 : 0,
          entry.latency_ms || null,
          entry.trace_id || null,
          now
        )
        .run();

      return logId;
    },

    async logSecurityEvent(
      agent_id: string | undefined,
      action: string,
      details: Record<string, unknown>,
      outcome: AuditOutcome
    ): Promise<string> {
      return this.log({
        log_type: 'SECURITY_EVENT',
        agent_id,
        action,
        request: details,
        outcome,
        risk_score: outcome === 'BLOCKED' ? 0.8 : outcome === 'FAILURE' ? 0.5 : 0.1,
        flags: outcome !== 'SUCCESS' ? ['SECURITY_ALERT'] : undefined,
      });
    },

    async logTransaction(
      agent_id: string,
      transaction_id: string,
      debit_account: string,
      credit_account: string,
      amount: number,
      outcome: AuditOutcome,
      error_code?: string
    ): Promise<string> {
      return this.log({
        log_type: 'TRANSACTION',
        agent_id,
        account_id: debit_account,
        action: 'TRANSACTION_EXECUTE',
        resource_type: 'TRANSACTION',
        resource_id: transaction_id,
        request: {
          debit_account,
          credit_account,
          amount,
        },
        outcome,
        error_code,
        risk_score: amount > 10000000 ? 0.3 : 0.1, // Flag large transactions
      });
    },

    async logAuthAttempt(
      agent_id: string | undefined,
      success: boolean,
      reason?: string,
      trace_id?: string
    ): Promise<string> {
      return this.log({
        log_type: success ? 'AUTH_SUCCESS' : 'AUTH_FAILURE',
        agent_id,
        action: success ? 'AUTH_SUCCESS' : 'AUTH_FAILURE',
        outcome: success ? 'SUCCESS' : 'FAILURE',
        error_code: success ? undefined : 'FB-1001',
        request: reason ? { reason } : undefined,
        trace_id,
        risk_score: success ? 0 : 0.4,
        flags: success ? undefined : ['AUTH_FAILURE'],
      });
    },

    async query(params: AuditQuery): Promise<AuditLogEntry[]> {
      const conditions: string[] = ['1=1'];
      const bindings: unknown[] = [];

      if (params.agent_id) {
        conditions.push('agent_id = ?');
        bindings.push(params.agent_id);
      }

      if (params.customer_id) {
        conditions.push('customer_id = ?');
        bindings.push(params.customer_id);
      }

      if (params.account_id) {
        conditions.push('account_id = ?');
        bindings.push(params.account_id);
      }

      if (params.log_type) {
        conditions.push('log_type = ?');
        bindings.push(params.log_type);
      }

      if (params.outcome) {
        conditions.push('outcome = ?');
        bindings.push(params.outcome);
      }

      if (params.from_date) {
        conditions.push('created_at >= ?');
        bindings.push(params.from_date);
      }

      if (params.to_date) {
        conditions.push('created_at <= ?');
        bindings.push(params.to_date);
      }

      const limit = params.limit || 100;
      const offset = params.offset || 0;

      const results = await db
        .prepare(
          `SELECT * FROM audit_logs
           WHERE ${conditions.join(' AND ')}
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`
        )
        .bind(...bindings, limit, offset)
        .all();

      return (results.results || []).map(mapRowToAuditEntry);
    },

    async getSecurityAlerts(since: string): Promise<AuditLogEntry[]> {
      const results = await db
        .prepare(
          `SELECT * FROM audit_logs
           WHERE (outcome = 'FAILURE' OR outcome = 'BLOCKED' OR manipulation_detected = 1)
           AND created_at >= ?
           ORDER BY created_at DESC
           LIMIT 100`
        )
        .bind(since)
        .all();

      return (results.results || []).map(mapRowToAuditEntry);
    },
  };
}

function mapRowToAuditEntry(row: Record<string, unknown>): AuditLogEntry {
  return {
    log_type: row.log_type as AuditLogType,
    agent_id: row.agent_id as string | undefined,
    session_id: row.session_id as string | undefined,
    customer_id: row.customer_id as string | undefined,
    account_id: row.account_id as string | undefined,
    action: row.action as string,
    resource_type: row.resource_type as string | undefined,
    resource_id: row.resource_id as string | undefined,
    request: row.request ? JSON.parse(row.request as string) : undefined,
    response: row.response ? JSON.parse(row.response as string) : undefined,
    outcome: row.outcome as AuditOutcome,
    error_code: row.error_code as string | undefined,
    risk_score: row.risk_score as number | undefined,
    flags: row.flags ? JSON.parse(row.flags as string) : undefined,
    manipulation_detected: (row.manipulation_detected as number) === 1,
    latency_ms: row.latency_ms as number | undefined,
    trace_id: row.trace_id as string | undefined,
  };
}
