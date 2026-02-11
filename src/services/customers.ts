import { D1Database } from '@cloudflare/workers-types';
import { generateCustomerId } from '../utils/ids';
import { Errors } from '../utils/errors';

/**
 * Customer Service
 *
 * Handles customer management including search functionality.
 * Critical for teller and customer service agent operations.
 */

export type CustomerType = 'INDIVIDUAL' | 'BUSINESS' | 'SYSTEM';
export type CustomerStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
export type KycStatusType = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';

export interface Customer {
  id: string;
  type: CustomerType;
  name: string;
  email?: string;
  phone?: string;
  status: CustomerStatus;
  kyc_status: KycStatusType;
  kyc_verified_at?: string;
  tax_id_hash?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CustomerSearchParams {
  query?: string;
  type?: CustomerType;
  status?: CustomerStatus;
  kyc_status?: KycStatusType;
  limit?: number;
  offset?: number;
}

export interface CreateCustomerRequest {
  type: CustomerType;
  name: string;
  email?: string;
  phone?: string;
  tax_id?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
}

export interface CustomerService {
  createCustomer(request: CreateCustomerRequest): Promise<Customer>;
  getCustomer(customerId: string): Promise<Customer | null>;
  updateCustomer(customerId: string, updates: Partial<CreateCustomerRequest>): Promise<Customer>;
  searchCustomers(params: CustomerSearchParams): Promise<{
    customers: Customer[];
    total: number;
    has_more: boolean;
  }>;
  getCustomerAccounts(customerId: string): Promise<string[]>;
  suspendCustomer(customerId: string, reason: string): Promise<void>;
  closeCustomer(customerId: string): Promise<void>;
}

export function createCustomerService(db: D1Database): CustomerService {
  return {
    async createCustomer(request: CreateCustomerRequest): Promise<Customer> {
      const customerId = generateCustomerId();
      const now = new Date().toISOString();

      // Hash tax ID if provided
      let taxIdHash: string | undefined;
      if (request.tax_id) {
        const encoder = new TextEncoder();
        const data = encoder.encode(request.tax_id + '-fauxbank-salt');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        taxIdHash = Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }

      await db
        .prepare(
          `INSERT INTO customers (
            id, type, name, email, phone, status, kyc_status,
            tax_id_hash, address, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          customerId,
          request.type,
          request.name,
          request.email || null,
          request.phone || null,
          'ACTIVE',
          'PENDING',
          taxIdHash || null,
          request.address ? JSON.stringify(request.address) : null,
          now,
          now
        )
        .run();

      const customer = await this.getCustomer(customerId);
      if (!customer) {
        throw Errors.internalError('Failed to create customer');
      }

      return customer;
    },

    async getCustomer(customerId: string): Promise<Customer | null> {
      const result = await db
        .prepare(`SELECT * FROM customers WHERE id = ?`)
        .bind(customerId)
        .first();

      if (!result) {
        return null;
      }

      return mapRowToCustomer(result);
    },

    async updateCustomer(
      customerId: string,
      updates: Partial<CreateCustomerRequest>
    ): Promise<Customer> {
      const customer = await this.getCustomer(customerId);
      if (!customer) {
        throw Errors.accountNotFound(customerId);
      }

      const now = new Date().toISOString();
      const setClause: string[] = [];
      const params: unknown[] = [];

      if (updates.name !== undefined) {
        setClause.push('name = ?');
        params.push(updates.name);
      }

      if (updates.email !== undefined) {
        setClause.push('email = ?');
        params.push(updates.email);
      }

      if (updates.phone !== undefined) {
        setClause.push('phone = ?');
        params.push(updates.phone);
      }

      if (updates.address !== undefined) {
        setClause.push('address = ?');
        params.push(JSON.stringify(updates.address));
      }

      if (setClause.length === 0) {
        return customer;
      }

      setClause.push('updated_at = ?');
      params.push(now);
      params.push(customerId);

      await db
        .prepare(`UPDATE customers SET ${setClause.join(', ')} WHERE id = ?`)
        .bind(...params)
        .run();

      const updated = await this.getCustomer(customerId);
      if (!updated) {
        throw Errors.internalError('Failed to update customer');
      }

      return updated;
    },

    async searchCustomers(params: CustomerSearchParams): Promise<{
      customers: Customer[];
      total: number;
      has_more: boolean;
    }> {
      const conditions: string[] = ['1=1'];
      const bindings: unknown[] = [];

      // Filter by type
      if (params.type) {
        conditions.push('type = ?');
        bindings.push(params.type);
      }

      // Filter by status
      if (params.status) {
        conditions.push('status = ?');
        bindings.push(params.status);
      }

      // Filter by KYC status
      if (params.kyc_status) {
        conditions.push('kyc_status = ?');
        bindings.push(params.kyc_status);
      }

      // Search by query (name, email, phone)
      if (params.query) {
        const searchTerm = `%${params.query}%`;
        conditions.push('(name LIKE ? OR email LIKE ? OR phone LIKE ? OR id LIKE ?)');
        bindings.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      const limit = params.limit || 50;
      const offset = params.offset || 0;

      // Get total count
      const countResult = await db
        .prepare(`SELECT COUNT(*) as count FROM customers WHERE ${conditions.join(' AND ')}`)
        .bind(...bindings)
        .first();

      const total = (countResult?.count as number) || 0;

      // Get results
      const results = await db
        .prepare(
          `SELECT * FROM customers
           WHERE ${conditions.join(' AND ')}
           ORDER BY name ASC
           LIMIT ? OFFSET ?`
        )
        .bind(...bindings, limit, offset)
        .all();

      const customers = (results.results || []).map(mapRowToCustomer);

      return {
        customers,
        total,
        has_more: offset + customers.length < total,
      };
    },

    async getCustomerAccounts(customerId: string): Promise<string[]> {
      const results = await db
        .prepare(`SELECT id FROM accounts WHERE owner_id = ?`)
        .bind(customerId)
        .all();

      return (results.results || []).map(r => r.id as string);
    },

    async suspendCustomer(customerId: string, reason: string): Promise<void> {
      const customer = await this.getCustomer(customerId);
      if (!customer) {
        throw Errors.accountNotFound(customerId);
      }

      const now = new Date().toISOString();

      await db.batch([
        // Update customer status
        db.prepare(
          `UPDATE customers SET status = 'SUSPENDED', metadata = ?, updated_at = ? WHERE id = ?`
        ).bind(
          JSON.stringify({ ...customer.metadata, suspension_reason: reason, suspended_at: now }),
          now,
          customerId
        ),

        // Freeze all customer accounts
        db.prepare(
          `UPDATE accounts SET status = 'FROZEN', updated_at = ? WHERE owner_id = ? AND status = 'ACTIVE'`
        ).bind(now, customerId),
      ]);
    },

    async closeCustomer(customerId: string): Promise<void> {
      const customer = await this.getCustomer(customerId);
      if (!customer) {
        throw Errors.accountNotFound(customerId);
      }

      // Check that all accounts are closed
      const openAccounts = await db
        .prepare(
          `SELECT COUNT(*) as count FROM accounts WHERE owner_id = ? AND status != 'CLOSED'`
        )
        .bind(customerId)
        .first();

      if ((openAccounts?.count as number) > 0) {
        throw Errors.validationError({
          accounts: ['All accounts must be closed before closing customer'],
        });
      }

      const now = new Date().toISOString();

      await db
        .prepare(`UPDATE customers SET status = 'CLOSED', updated_at = ? WHERE id = ?`)
        .bind(now, customerId)
        .run();
    },
  };
}

function mapRowToCustomer(row: Record<string, unknown>): Customer {
  return {
    id: row.id as string,
    type: row.type as CustomerType,
    name: row.name as string,
    email: row.email as string | undefined,
    phone: row.phone as string | undefined,
    status: row.status as CustomerStatus,
    kyc_status: row.kyc_status as KycStatusType,
    kyc_verified_at: row.kyc_verified_at as string | undefined,
    tax_id_hash: row.tax_id_hash as string | undefined,
    address: row.address ? JSON.parse(row.address as string) : undefined,
    metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}
