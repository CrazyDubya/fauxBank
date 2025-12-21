import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  AgentRegistrationRequest,
  AgentScopeRequest,
} from '../types';
import { createAgentService } from '../services/agents';
import { authMiddleware, requireCapability } from '../middleware/auth';
import { Errors, errorResponse, handleError } from '../utils/errors';

type Env = {
  DB: D1Database;
  SESSIONS: KVNamespace;
};

const agents = new Hono<{ Bindings: Env }>();

/**
 * POST /agents/register - Register new agent
 * Note: This endpoint does not require authentication
 */
agents.post(
  '/register',
  zValidator('json', AgentRegistrationRequest),
  async (c) => {
    try {
      const request = c.req.valid('json');
      const agentService = createAgentService(c.env.DB);

      const result = await agentService.registerAgent(request);

      return c.json(result, 201);
    } catch (error) {
      return errorResponse(c, handleError(error));
    }
  }
);

/**
 * GET /agents/:agentId - Get agent details
 * Requires authentication and ADMIN capability (or self)
 */
agents.get(
  '/:agentId',
  authMiddleware(),
  async (c) => {
    try {
      const agentId = c.req.param('agentId');
      const currentAgent = c.get('agent');

      // Agents can only view themselves unless they're ADMIN
      if (currentAgent.id !== agentId && !currentAgent.capabilities.includes('ACCOUNT_WRITE')) {
        return errorResponse(c, Errors.insufficientPermissions('ADMIN'));
      }

      const agentService = createAgentService(c.env.DB);
      const agent = await agentService.getAgent(agentId);

      if (!agent) {
        return errorResponse(c, Errors.accountNotFound(agentId));
      }

      // Don't expose token hash
      const { ...safeAgent } = agent;

      return c.json(safeAgent);
    } catch (error) {
      return errorResponse(c, handleError(error));
    }
  }
);

/**
 * POST /agents/:agentId/scope - Configure agent scope
 * Requires ADMIN capability
 */
agents.post(
  '/:agentId/scope',
  authMiddleware(),
  requireCapability('ACCOUNT_WRITE'),
  zValidator('json', AgentScopeRequest),
  async (c) => {
    try {
      const agentId = c.req.param('agentId');
      const request = c.req.valid('json');

      const agentService = createAgentService(c.env.DB);
      await agentService.configureScope(agentId, request);

      return c.json({ success: true });
    } catch (error) {
      return errorResponse(c, handleError(error));
    }
  }
);

/**
 * POST /agents/:agentId/suspend - Suspend agent
 * Requires ADMIN capability
 */
agents.post(
  '/:agentId/suspend',
  authMiddleware(),
  requireCapability('ACCOUNT_WRITE'),
  async (c) => {
    try {
      const agentId = c.req.param('agentId');

      const agentService = createAgentService(c.env.DB);
      await agentService.suspendAgent(agentId);

      return c.json({ success: true, status: 'SUSPENDED' });
    } catch (error) {
      return errorResponse(c, handleError(error));
    }
  }
);

/**
 * POST /agents/:agentId/revoke - Revoke agent
 * Requires ADMIN capability
 */
agents.post(
  '/:agentId/revoke',
  authMiddleware(),
  requireCapability('ACCOUNT_WRITE'),
  async (c) => {
    try {
      const agentId = c.req.param('agentId');

      const agentService = createAgentService(c.env.DB);
      await agentService.revokeAgent(agentId);

      return c.json({ success: true, status: 'REVOKED' });
    } catch (error) {
      return errorResponse(c, handleError(error));
    }
  }
);

export { agents };
