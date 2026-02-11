import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  CreateAccountRequest,
  UpdateAccountRequest,
  FreezeAccountRequest,
  formatAmount,
} from '../types';
import { createAccountService } from '../services/accounts';
import { createLedgerService } from '../services/ledger';
import { createStatementService } from '../services/statements';
import { z } from 'zod';
import { requireCapability, requireAccountAccess } from '../middleware/auth';
import { Errors, errorResponse, handleError } from '../utils/errors';
import { isValidAccountId } from '../utils/account-id';

type Env = {
  DB: D1Database;
  SESSIONS: KVNamespace;
};

const accounts = new Hono<{ Bindings: Env }>();

/**
 * POST /accounts - Create new account
 */
accounts.post(
  '/',
  requireCapability('ACCOUNT_WRITE'),
  zValidator('json', CreateAccountRequest),
  async (c) => {
    try {
      const request = c.req.valid('json');
      const agentId = c.get('agentId');
      const accountService = createAccountService(c.env.DB);

      const account = await accountService.createAccount(request, agentId);

      // Format balances for response
      const response = {
        ...account,
        balances: {
          available: formatAmount(account.balances.available),
          ledger: formatAmount(account.balances.ledger),
          pending: formatAmount(account.balances.pending),
          held: formatAmount(account.balances.held),
        },
      };

      return c.json(response, 201);
    } catch (error) {
      return errorResponse(c, handleError(error));
    }
  }
);

/**
 * GET /accounts/:accountId - Get account details
 * SECURITY FIX: Added account access control check
 */
accounts.get(
  '/:accountId',
  requireCapability('ACCOUNT_READ'),
  requireAccountAccess('accountId'),
  async (c) => {
    try {
      const accountId = c.req.param('accountId');

      if (!isValidAccountId(accountId)) {
        return errorResponse(c, Errors.invalidAccountFormat(accountId));
      }

      const accountService = createAccountService(c.env.DB);
      const account = await accountService.getAccount(accountId);

      if (!account) {
        return errorResponse(c, Errors.accountNotFound(accountId));
      }

      // Format balances for response
      const response = {
        ...account,
        balances: {
          available: formatAmount(account.balances.available),
          ledger: formatAmount(account.balances.ledger),
          pending: formatAmount(account.balances.pending),
          held: formatAmount(account.balances.held),
        },
      };

      return c.json(response);
    } catch (error) {
      return errorResponse(c, handleError(error));
    }
  }
);

/**
 * PATCH /accounts/:accountId - Update account
 * SECURITY FIX: Added account access control check
 */
accounts.patch(
  '/:accountId',
  requireCapability('ACCOUNT_WRITE'),
  requireAccountAccess('accountId'),
  zValidator('json', UpdateAccountRequest),
  async (c) => {
    try {
      const accountId = c.req.param('accountId');
      const request = c.req.valid('json');

      if (!isValidAccountId(accountId)) {
        return errorResponse(c, Errors.invalidAccountFormat(accountId));
      }

      const accountService = createAccountService(c.env.DB);
      const account = await accountService.updateAccount(accountId, request);

      // Format balances for response
      const response = {
        ...account,
        balances: {
          available: formatAmount(account.balances.available),
          ledger: formatAmount(account.balances.ledger),
          pending: formatAmount(account.balances.pending),
          held: formatAmount(account.balances.held),
        },
      };

      return c.json(response);
    } catch (error) {
      return errorResponse(c, handleError(error));
    }
  }
);

/**
 * GET /accounts/:accountId/balance - Get current balances
 * SECURITY FIX: Added account access control check
 */
accounts.get(
  '/:accountId/balance',
  requireCapability('BALANCE_READ'),
  requireAccountAccess('accountId'),
  async (c) => {
    try {
      const accountId = c.req.param('accountId');

      if (!isValidAccountId(accountId)) {
        return errorResponse(c, Errors.invalidAccountFormat(accountId));
      }

      const ledgerService = createLedgerService(c.env.DB);
      const balances = await ledgerService.getBalance(accountId);

      return c.json({
        account_id: accountId,
        as_of: new Date().toISOString(),
        available: formatAmount(balances.available),
        ledger: formatAmount(balances.ledger),
        pending: formatAmount(balances.pending),
        held: formatAmount(balances.held),
      });
    } catch (error) {
      return errorResponse(c, handleError(error));
    }
  }
);

/**
 * POST /accounts/:accountId/freeze - Freeze account
 * SECURITY FIX: Added account access control check
 */
accounts.post(
  '/:accountId/freeze',
  requireCapability('ACCOUNT_WRITE'),
  requireAccountAccess('accountId'),
  zValidator('json', FreezeAccountRequest),
  async (c) => {
    try {
      const accountId = c.req.param('accountId');
      const request = c.req.valid('json');

      if (!isValidAccountId(accountId)) {
        return errorResponse(c, Errors.invalidAccountFormat(accountId));
      }

      const accountService = createAccountService(c.env.DB);
      await accountService.freezeAccount(accountId, request);

      return c.json({ success: true, status: 'FROZEN' });
    } catch (error) {
      return errorResponse(c, handleError(error));
    }
  }
);

/**
 * POST /accounts/:accountId/close - Close account
 * SECURITY FIX: Added account access control check
 */
accounts.post(
  '/:accountId/close',
  requireCapability('ACCOUNT_WRITE'),
  requireAccountAccess('accountId'),
  async (c) => {
    try {
      const accountId = c.req.param('accountId');

      if (!isValidAccountId(accountId)) {
        return errorResponse(c, Errors.invalidAccountFormat(accountId));
      }

      const accountService = createAccountService(c.env.DB);
      await accountService.closeAccount(accountId);

      return c.json({ success: true, status: 'CLOSED' });
    } catch (error) {
      return errorResponse(c, handleError(error));
    }
  }
);

// Statement request schema
const StatementRequestSchema = z.object({
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
  format: z.enum(['JSON', 'CSV']).optional().default('JSON'),
});

/**
 * POST /accounts/:accountId/statements - Generate statement
 */
accounts.post(
  '/:accountId/statements',
  requireCapability('ACCOUNT_READ'),
  requireAccountAccess('accountId'),
  zValidator('json', StatementRequestSchema),
  async (c) => {
    try {
      const accountId = c.req.param('accountId');
      const request = c.req.valid('json');

      if (!isValidAccountId(accountId)) {
        return errorResponse(c, Errors.invalidAccountFormat(accountId));
      }

      const statementService = createStatementService(c.env.DB);
      const statement = await statementService.generateStatement({
        account_id: accountId,
        period_start: request.period_start,
        period_end: request.period_end,
        format: request.format,
      });

      if (request.format === 'CSV') {
        const csv = statementService.exportToCsv(statement);
        return new Response(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="statement-${accountId}-${statement.statement_id}.csv"`,
          },
        });
      }

      return c.json(statement);
    } catch (error) {
      return errorResponse(c, handleError(error));
    }
  }
);

// Monthly statement schema
const MonthlyStatementSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

/**
 * GET /accounts/:accountId/statements/monthly - Get monthly statement
 */
accounts.get(
  '/:accountId/statements/monthly',
  requireCapability('ACCOUNT_READ'),
  requireAccountAccess('accountId'),
  zValidator('query', MonthlyStatementSchema),
  async (c) => {
    try {
      const accountId = c.req.param('accountId');
      const { year, month } = c.req.valid('query');

      if (!isValidAccountId(accountId)) {
        return errorResponse(c, Errors.invalidAccountFormat(accountId));
      }

      const statementService = createStatementService(c.env.DB);
      const statement = await statementService.getMonthlyStatement(accountId, year, month);

      return c.json(statement);
    } catch (error) {
      return errorResponse(c, handleError(error));
    }
  }
);

/**
 * GET /accounts/:accountId/statements - List past statements
 */
accounts.get(
  '/:accountId/statements',
  requireCapability('ACCOUNT_READ'),
  requireAccountAccess('accountId'),
  async (c) => {
    try {
      const accountId = c.req.param('accountId');

      if (!isValidAccountId(accountId)) {
        return errorResponse(c, Errors.invalidAccountFormat(accountId));
      }

      const statementService = createStatementService(c.env.DB);
      const result = await statementService.listStatements(accountId);

      return c.json(result);
    } catch (error) {
      return errorResponse(c, handleError(error));
    }
  }
);

export { accounts };
