import { Context, Next } from 'hono';
import { Agent, AgentCapability } from '../types';
import { createAgentService } from '../services/agents';
import { Errors, errorResponse } from '../utils/errors';
import { logAuthAttempt, logSecurityEvent } from './audit';

/**
 * Authentication and Authorization Middleware
 */

// Extend Hono context to include agent
declare module 'hono' {
  interface ContextVariableMap {
    agent: Agent;
    agentId: string;
  }
}

/**
 * Authenticate agent via Bearer token
 */
export function authMiddleware() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const traceId = c.res.headers.get('X-Trace-ID') || c.req.header('X-Trace-ID');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Log failed auth attempt (no token)
      logAuthAttempt(c.env.DB, undefined, false, 'Missing or invalid Authorization header', traceId).catch(() => {});
      return errorResponse(c, Errors.invalidCredentials());
    }

    const token = authHeader.substring(7);
    const agentService = createAgentService(c.env.DB);

    const agent = await agentService.getAgentByToken(token);

    if (!agent) {
      // Log failed auth attempt (invalid token)
      logAuthAttempt(c.env.DB, undefined, false, 'Invalid token', traceId).catch(() => {});
      return errorResponse(c, Errors.invalidCredentials());
    }

    if (agent.status !== 'ACTIVE') {
      // Log failed auth attempt (inactive agent)
      logAuthAttempt(c.env.DB, agent.id, false, `Agent is ${agent.status.toLowerCase()}`, traceId).catch(() => {});
      return errorResponse(c, Errors.invalidCredentials({ reason: `Agent is ${agent.status.toLowerCase()}` }));
    }

    // Log successful auth
    logAuthAttempt(c.env.DB, agent.id, true, undefined, traceId).catch(() => {});

    // Record activity
    await agentService.recordActivity(agent.id);

    // Set agent in context
    c.set('agent', agent);
    c.set('agentId', agent.id);

    return next();
  };
}

/**
 * Require specific capability
 */
export function requireCapability(capability: AgentCapability) {
  return async (c: Context, next: Next) => {
    const agent = c.get('agent');

    if (!agent) {
      return errorResponse(c, Errors.invalidCredentials());
    }

    if (!agent.capabilities.includes(capability)) {
      // Log capability denial
      logSecurityEvent(
        c.env.DB,
        agent.id,
        'CAPABILITY_DENIED',
        { required: capability, agent_capabilities: agent.capabilities },
        'BLOCKED'
      ).catch(() => {});
      return errorResponse(c, Errors.insufficientPermissions(capability));
    }

    return next();
  };
}

/**
 * Check account access for an agent (middleware version)
 * Use when accountId is in path params
 */
export function checkAccountAccess(accountId: string) {
  return async (c: Context, next: Next) => {
    const agent = c.get('agent');
    const agentService = createAgentService(c.env.DB);

    if (!agentService.checkAccountAccess(agent, accountId)) {
      return errorResponse(c, Errors.insufficientPermissions('Account access denied'));
    }

    return next();
  };
}

/**
 * SECURITY FIX: Middleware to check account access from path param
 * Extracts accountId from path and validates agent has access
 */
export function requireAccountAccess(paramName: string = 'accountId') {
  return async (c: Context, next: Next) => {
    const agent = c.get('agent');
    const accountId = c.req.param(paramName);

    if (!agent) {
      return errorResponse(c, Errors.invalidCredentials());
    }

    if (!accountId) {
      await next();
      return;
    }

    const agentService = createAgentService(c.env.DB);

    if (!agentService.checkAccountAccess(agent, accountId)) {
      // Log account access denial
      logSecurityEvent(
        c.env.DB,
        agent.id,
        'ACCOUNT_ACCESS_DENIED',
        { accountId, agent_patterns: agent.account_patterns },
        'BLOCKED'
      ).catch(() => {});
      return errorResponse(c, Errors.insufficientPermissions(`Access denied to account ${accountId}`));
    }

    return next();
  };
}

/**
 * SECURITY FIX: Check access to multiple accounts (for transactions)
 * Requires agent to have access to BOTH accounts unless they are ADMIN
 * or the transaction involves a system account
 */
export async function validateTransactionAccess(
  c: Context,
  debitAccountId: string,
  creditAccountId: string
): Promise<boolean> {
  const agent = c.get('agent');
  if (!agent) return false;

  // ADMIN agents have unrestricted access
  if (agent.type === 'ADMIN') {
    return true;
  }

  const agentService = createAgentService(c.env.DB);

  // Check access to both accounts
  const hasDebitAccess = agentService.checkAccountAccess(agent, debitAccountId);
  const hasCreditAccess = agentService.checkAccountAccess(agent, creditAccountId);

  // System accounts (used for deposits, fees, etc.) are accessible for credits/debits
  const systemAccounts = [
    'CH-COMM-SEEDBANK-AA',
    'CH-COMM-FEEINCOM-BB',
    'CH-COMM-INTEREST-CC',
    'CH-COMM-EXTERNAL-DD',
  ];
  const isSystemDebit = systemAccounts.includes(debitAccountId);
  const isSystemCredit = systemAccounts.includes(creditAccountId);

  // Allow if agent has access to their account side and other side is system
  if (hasDebitAccess && isSystemCredit) return true;
  if (hasCreditAccess && isSystemDebit) return true;

  // For non-system transactions, require access to BOTH accounts
  return hasDebitAccess && hasCreditAccess;
}

/**
 * Optional authentication - sets agent if token provided, but doesn't require it
 */
export function optionalAuthMiddleware() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const agentService = createAgentService(c.env.DB);

      const agent = await agentService.getAgentByToken(token);

      if (agent && agent.status === 'ACTIVE') {
        c.set('agent', agent);
        c.set('agentId', agent.id);
        await agentService.recordActivity(agent.id);
      }
    }

    await next();
  };
}
