import { Context, Next } from 'hono';
import { Agent, AgentCapability } from '../types';
import { createAgentService } from '../services/agents';
import { Errors, errorResponse } from '../utils/errors';

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

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(c, Errors.invalidCredentials());
    }

    const token = authHeader.substring(7);
    const agentService = createAgentService(c.env.DB);

    const agent = await agentService.getAgentByToken(token);

    if (!agent) {
      return errorResponse(c, Errors.invalidCredentials());
    }

    if (agent.status !== 'ACTIVE') {
      return errorResponse(c, Errors.invalidCredentials({ reason: `Agent is ${agent.status.toLowerCase()}` }));
    }

    // Record activity
    await agentService.recordActivity(agent.id);

    // Set agent in context
    c.set('agent', agent);
    c.set('agentId', agent.id);

    await next();
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
      return errorResponse(c, Errors.insufficientPermissions(capability));
    }

    await next();
  };
}

/**
 * Check account access for an agent
 */
export function checkAccountAccess(accountId: string) {
  return async (c: Context, next: Next) => {
    const agent = c.get('agent');
    const agentService = createAgentService(c.env.DB);

    if (!agentService.checkAccountAccess(agent, accountId)) {
      return errorResponse(c, Errors.insufficientPermissions('Account access denied'));
    }

    await next();
  };
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
