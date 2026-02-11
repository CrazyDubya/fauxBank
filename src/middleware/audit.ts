import { Context, Next } from 'hono';
import { createAuditService, AuditLogType, AuditOutcome } from '../services/audit';

/**
 * Audit Logging Middleware
 *
 * Automatically logs all API requests with context, timing, and outcomes.
 * Critical for regulatory compliance and security monitoring.
 */

// Map HTTP methods to action verbs
const methodActions: Record<string, string> = {
  GET: 'READ',
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'MODIFY',
  DELETE: 'DELETE',
};

// Extract resource info from path
function extractResourceInfo(path: string): { resource_type: string; resource_id?: string } {
  // Remove /v1 prefix if present
  const cleanPath = path.replace(/^\/v1/, '');
  const segments = cleanPath.split('/').filter(Boolean);

  if (segments.length === 0) {
    return { resource_type: 'ROOT' };
  }

  // Common patterns:
  // /accounts/:id -> ACCOUNT
  // /transactions/:id -> TRANSACTION
  // /agents/:id -> AGENT
  // /compliance/disputes/:id -> DISPUTE

  const resourceMap: Record<string, string> = {
    accounts: 'ACCOUNT',
    transactions: 'TRANSACTION',
    agents: 'AGENT',
    disputes: 'DISPUTE',
    kyc: 'KYC',
    merchant: 'MERCHANT',
    testing: 'TESTING',
    compliance: 'COMPLIANCE',
  };

  const resource_type = resourceMap[segments[0]] || segments[0].toUpperCase();

  // Try to extract resource ID (usually the second segment if it looks like an ID)
  let resource_id: string | undefined;
  if (segments.length >= 2) {
    const potentialId = segments[1];
    // Check if it looks like an ID (not a sub-resource path)
    if (
      potentialId.includes('-') ||
      /^[A-Z]{2,4}-/.test(potentialId) ||
      /^[a-f0-9-]{36}$/.test(potentialId)
    ) {
      resource_id = potentialId;
    }
  }

  return { resource_type, resource_id };
}

// Determine log type based on path and method
function determineLogType(path: string, method: string): AuditLogType {
  const cleanPath = path.toLowerCase();

  if (cleanPath.includes('/agents/register') || cleanPath.includes('/auth')) {
    return method === 'POST' ? 'AUTH_SUCCESS' : 'API_REQUEST';
  }

  if (cleanPath.includes('/transactions') && method === 'POST') {
    return 'TRANSACTION';
  }

  if (cleanPath.includes('/accounts')) {
    return 'ACCOUNT_ACCESS';
  }

  if (cleanPath.includes('/compliance') || cleanPath.includes('/kyc')) {
    return 'COMPLIANCE_EVENT';
  }

  if (
    cleanPath.includes('/agents/') &&
    (cleanPath.includes('/suspend') || cleanPath.includes('/revoke') || cleanPath.includes('/scope'))
  ) {
    return 'ADMIN_ACTION';
  }

  return 'API_REQUEST';
}

// Paths that should not be logged (health checks, etc.)
const skipPaths = ['/', '/health', '/v1/health'];

/**
 * Audit middleware - logs all API requests
 */
export function auditMiddleware() {
  return async (c: Context, next: Next) => {
    const startTime = Date.now();
    const path = new URL(c.req.url).pathname;

    // Skip health checks and root
    if (skipPaths.includes(path)) {
      return next();
    }

    // Capture request info before processing
    const method = c.req.method;
    const traceId = c.res.headers.get('X-Trace-ID') || c.req.header('X-Trace-ID');

    let requestBody: Record<string, unknown> | undefined;

    // Only capture body for POST/PUT/PATCH, and only if not sensitive
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        const clonedRequest = c.req.raw.clone();
        const text = await clonedRequest.text();
        if (text) {
          requestBody = JSON.parse(text);
        }
      } catch {
        // Body might not be JSON or might be empty
      }
    }

    // Process the request
    let outcome: AuditOutcome = 'SUCCESS';
    let errorCode: string | undefined;
    let responseBody: Record<string, unknown> | undefined;

    try {
      await next();

      // Capture response status
      const status = c.res.status;

      if (status >= 400 && status < 500) {
        outcome = 'FAILURE';
        errorCode = `HTTP-${status}`;
      } else if (status >= 500) {
        outcome = 'FAILURE';
        errorCode = `SERVER-${status}`;
      }

      // Try to capture response body for error responses
      if (status >= 400) {
        try {
          const clonedResponse = c.res.clone();
          const text = await clonedResponse.text();
          if (text) {
            responseBody = JSON.parse(text);
            if (responseBody?.code) {
              errorCode = responseBody.code as string;
            }
          }
        } catch {
          // Response might not be JSON
        }
      }
    } catch (error) {
      outcome = 'FAILURE';
      errorCode = 'UNHANDLED_ERROR';
      throw error;
    } finally {
      // Log the request asynchronously (don't block response)
      const latencyMs = Date.now() - startTime;

      // Get agent info from context if available
      const agent = c.get('agent');
      const agentId = agent?.id || c.get('agentId');

      const { resource_type, resource_id } = extractResourceInfo(path);
      const logType = determineLogType(path, method);
      const action = `${methodActions[method] || method}_${resource_type}`;

      // Create audit log entry
      const auditService = createAuditService(c.env.DB);

      // Don't await - log asynchronously
      auditService
        .log({
          log_type: logType,
          agent_id: agentId,
          action,
          resource_type,
          resource_id,
          request: requestBody,
          response: outcome !== 'SUCCESS' ? responseBody : undefined,
          outcome,
          error_code: errorCode,
          latency_ms: latencyMs,
          trace_id: traceId || undefined,
        })
        .catch((err) => {
          // Log audit failures but don't crash
          console.error('Audit logging failed:', err);
        });
    }
  };
}

/**
 * Log authentication attempts (for use in auth middleware)
 */
export async function logAuthAttempt(
  db: D1Database,
  agentId: string | undefined,
  success: boolean,
  reason?: string,
  traceId?: string
): Promise<void> {
  const auditService = createAuditService(db);
  await auditService.logAuthAttempt(agentId, success, reason, traceId);
}

/**
 * Log security events (access denied, suspicious activity, etc.)
 */
export async function logSecurityEvent(
  db: D1Database,
  agentId: string | undefined,
  action: string,
  details: Record<string, unknown>,
  outcome: AuditOutcome = 'BLOCKED'
): Promise<void> {
  const auditService = createAuditService(db);
  await auditService.logSecurityEvent(agentId, action, details, outcome);
}

/**
 * Log transaction events
 */
export async function logTransactionEvent(
  db: D1Database,
  agentId: string,
  transactionId: string,
  debitAccount: string,
  creditAccount: string,
  amount: number,
  outcome: AuditOutcome,
  errorCode?: string
): Promise<void> {
  const auditService = createAuditService(db);
  await auditService.logTransaction(
    agentId,
    transactionId,
    debitAccount,
    creditAccount,
    amount,
    outcome,
    errorCode
  );
}
