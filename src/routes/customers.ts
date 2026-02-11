import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createCustomerService } from '../services/customers';
import { requireCapability } from '../middleware/auth';
import { Errors, errorResponse, handleError } from '../utils/errors';

type Env = {
  DB: D1Database;
  SESSIONS: KVNamespace;
};

const customers = new Hono<{ Bindings: Env }>();

// Schema for customer search
const CustomerSearchQuery = z.object({
  query: z.string().optional(),
  type: z.enum(['INDIVIDUAL', 'BUSINESS', 'SYSTEM']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED']).optional(),
  kyc_status: z.enum(['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// Schema for customer creation
const CreateCustomerRequest = z.object({
  type: z.enum(['INDIVIDUAL', 'BUSINESS']),
  name: z.string().min(1).max(255),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  tax_id: z.string().optional(),
  address: z.object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
});

/**
 * GET /customers - Search customers
 * Requires ACCOUNT_READ capability
 */
customers.get(
  '/',
  requireCapability('ACCOUNT_READ'),
  zValidator('query', CustomerSearchQuery),
  async (c) => {
    try {
      const query = c.req.valid('query');
      const customerService = createCustomerService(c.env.DB);

      const result = await customerService.searchCustomers(query);

      return c.json(result);
    } catch (error) {
      return errorResponse(c, handleError(error));
    }
  }
);

/**
 * POST /customers - Create customer
 * Requires ACCOUNT_WRITE capability
 */
customers.post(
  '/',
  requireCapability('ACCOUNT_WRITE'),
  zValidator('json', CreateCustomerRequest),
  async (c) => {
    try {
      const request = c.req.valid('json');
      const customerService = createCustomerService(c.env.DB);

      const customer = await customerService.createCustomer(request);

      return c.json(customer, 201);
    } catch (error) {
      return errorResponse(c, handleError(error));
    }
  }
);

/**
 * GET /customers/:customerId - Get customer details
 * Requires ACCOUNT_READ capability
 */
customers.get(
  '/:customerId',
  requireCapability('ACCOUNT_READ'),
  async (c) => {
    try {
      const customerId = c.req.param('customerId');
      const customerService = createCustomerService(c.env.DB);

      const customer = await customerService.getCustomer(customerId);

      if (!customer) {
        return errorResponse(c, Errors.accountNotFound(customerId));
      }

      return c.json(customer);
    } catch (error) {
      return errorResponse(c, handleError(error));
    }
  }
);

/**
 * GET /customers/:customerId/accounts - Get customer's accounts
 * Requires ACCOUNT_READ capability
 */
customers.get(
  '/:customerId/accounts',
  requireCapability('ACCOUNT_READ'),
  async (c) => {
    try {
      const customerId = c.req.param('customerId');
      const customerService = createCustomerService(c.env.DB);

      const customer = await customerService.getCustomer(customerId);
      if (!customer) {
        return errorResponse(c, Errors.accountNotFound(customerId));
      }

      const accounts = await customerService.getCustomerAccounts(customerId);

      return c.json({ accounts });
    } catch (error) {
      return errorResponse(c, handleError(error));
    }
  }
);

// Schema for customer update
const UpdateCustomerRequest = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
});

/**
 * PATCH /customers/:customerId - Update customer
 * Requires ACCOUNT_WRITE capability
 */
customers.patch(
  '/:customerId',
  requireCapability('ACCOUNT_WRITE'),
  zValidator('json', UpdateCustomerRequest),
  async (c) => {
    try {
      const customerId = c.req.param('customerId');
      const updates = c.req.valid('json');
      const customerService = createCustomerService(c.env.DB);

      const customer = await customerService.updateCustomer(customerId, updates);

      return c.json(customer);
    } catch (error) {
      return errorResponse(c, handleError(error));
    }
  }
);

// Schema for suspend request
const SuspendRequest = z.object({
  reason: z.string().min(1),
});

/**
 * POST /customers/:customerId/suspend - Suspend customer
 * Requires COMPLIANCE_WRITE capability
 */
customers.post(
  '/:customerId/suspend',
  requireCapability('COMPLIANCE_WRITE'),
  zValidator('json', SuspendRequest),
  async (c) => {
    try {
      const customerId = c.req.param('customerId');
      const { reason } = c.req.valid('json');
      const customerService = createCustomerService(c.env.DB);

      await customerService.suspendCustomer(customerId, reason);

      return c.json({ success: true, status: 'SUSPENDED' });
    } catch (error) {
      return errorResponse(c, handleError(error));
    }
  }
);

/**
 * POST /customers/:customerId/close - Close customer
 * Requires ACCOUNT_WRITE capability
 */
customers.post(
  '/:customerId/close',
  requireCapability('ACCOUNT_WRITE'),
  async (c) => {
    try {
      const customerId = c.req.param('customerId');
      const customerService = createCustomerService(c.env.DB);

      await customerService.closeCustomer(customerId);

      return c.json({ success: true, status: 'CLOSED' });
    } catch (error) {
      return errorResponse(c, handleError(error));
    }
  }
);

export { customers };
