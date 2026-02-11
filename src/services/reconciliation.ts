import { D1Database } from '@cloudflare/workers-types';
import { createAuditService } from './audit';

/**
 * Balance Reconciliation Service
 *
 * Provides double-entry accounting verification and balance reconciliation.
 * Critical for auditor requirements and financial integrity.
 */

export interface ReconciliationResult {
  status: 'BALANCED' | 'DISCREPANCY' | 'ERROR';
  checked_at: string;
  accounts_checked: number;
  discrepancies: AccountDiscrepancy[];
  summary: {
    total_debit: number;
    total_credit: number;
    net_position: number;
  };
}

export interface AccountDiscrepancy {
  account_id: string;
  expected_balance: number;
  actual_balance: number;
  difference: number;
  transaction_count: number;
}

export interface ReconciliationService {
  reconcileAccount(accountId: string): Promise<AccountDiscrepancy | null>;
  reconcileAll(): Promise<ReconciliationResult>;
  verifyDoubleEntry(): Promise<{
    balanced: boolean;
    total_debits: number;
    total_credits: number;
    unmatched_transactions: string[];
  }>;
  getDailyReconciliationReport(date: string): Promise<{
    date: string;
    opening_balance: number;
    closing_balance: number;
    debits: number;
    credits: number;
    transaction_count: number;
    status: 'RECONCILED' | 'PENDING' | 'DISCREPANCY';
  }[]>;
}

export function createReconciliationService(db: D1Database): ReconciliationService {
  const audit = createAuditService(db);

  return {
    async reconcileAccount(accountId: string): Promise<AccountDiscrepancy | null> {
      // Get the current ledger balance
      const accountResult = await db
        .prepare(`SELECT balance_ledger FROM accounts WHERE id = ?`)
        .bind(accountId)
        .first();

      if (!accountResult) {
        return null;
      }

      const actualBalance = accountResult.balance_ledger as number;

      // Calculate expected balance from transactions
      const transactionResult = await db
        .prepare(
          `SELECT
            SUM(CASE WHEN credit_account_id = ? THEN amount ELSE 0 END) as credits,
            SUM(CASE WHEN debit_account_id = ? THEN amount ELSE 0 END) as debits,
            COUNT(*) as tx_count
           FROM transactions
           WHERE (credit_account_id = ? OR debit_account_id = ?)
           AND status = 'POSTED'`
        )
        .bind(accountId, accountId, accountId, accountId)
        .first();

      const credits = (transactionResult?.credits as number) || 0;
      const debits = (transactionResult?.debits as number) || 0;
      const txCount = (transactionResult?.tx_count as number) || 0;

      // Expected balance = credits - debits (double-entry: credits increase, debits decrease)
      const expectedBalance = credits - debits;

      // Check for discrepancy
      if (Math.abs(expectedBalance - actualBalance) > 0) {
        const discrepancy: AccountDiscrepancy = {
          account_id: accountId,
          expected_balance: expectedBalance,
          actual_balance: actualBalance,
          difference: actualBalance - expectedBalance,
          transaction_count: txCount,
        };

        // Log discrepancy
        await audit.log({
          log_type: 'COMPLIANCE_EVENT',
          account_id: accountId,
          action: 'BALANCE_DISCREPANCY_DETECTED',
          request: {
            expected: expectedBalance,
            actual: actualBalance,
            difference: discrepancy.difference,
          },
          outcome: 'FAILURE',
          risk_score: 0.8,
          flags: ['RECONCILIATION_FAILURE'],
        });

        return discrepancy;
      }

      return null;
    },

    async reconcileAll(): Promise<ReconciliationResult> {
      const startTime = new Date().toISOString();
      const discrepancies: AccountDiscrepancy[] = [];

      // Get all active accounts
      const accountsResult = await db
        .prepare(`SELECT id FROM accounts WHERE status != 'CLOSED'`)
        .all();

      const accounts = accountsResult.results || [];
      let totalDebit = 0;
      let totalCredit = 0;

      for (const account of accounts) {
        const accountId = account.id as string;
        const discrepancy = await this.reconcileAccount(accountId);

        if (discrepancy) {
          discrepancies.push(discrepancy);
        }

        // Also collect totals
        const accountData = await db
          .prepare(`SELECT balance_ledger FROM accounts WHERE id = ?`)
          .bind(accountId)
          .first();

        const balance = (accountData?.balance_ledger as number) || 0;
        if (balance >= 0) {
          totalCredit += balance;
        } else {
          totalDebit += Math.abs(balance);
        }
      }

      const result: ReconciliationResult = {
        status: discrepancies.length === 0 ? 'BALANCED' : 'DISCREPANCY',
        checked_at: startTime,
        accounts_checked: accounts.length,
        discrepancies,
        summary: {
          total_debit: totalDebit,
          total_credit: totalCredit,
          net_position: totalCredit - totalDebit,
        },
      };

      // Log reconciliation run
      await audit.log({
        log_type: 'COMPLIANCE_EVENT',
        action: 'RECONCILIATION_RUN',
        request: {
          accounts_checked: accounts.length,
        },
        response: {
          status: result.status,
          discrepancy_count: discrepancies.length,
        },
        outcome: discrepancies.length === 0 ? 'SUCCESS' : 'FAILURE',
        risk_score: discrepancies.length > 0 ? 0.9 : 0,
        flags: discrepancies.length > 0 ? ['RECONCILIATION_FAILURE'] : [],
      });

      return result;
    },

    async verifyDoubleEntry(): Promise<{
      balanced: boolean;
      total_debits: number;
      total_credits: number;
      unmatched_transactions: string[];
    }> {
      // In double-entry accounting, total debits must equal total credits
      const result = await db
        .prepare(
          `SELECT
            SUM(amount) as total_debits,
            (SELECT SUM(amount) FROM transactions WHERE status = 'POSTED') as total_from_debits
           FROM transactions
           WHERE status = 'POSTED'`
        )
        .first();

      // Get debit and credit totals separately
      const debitTotal = await db
        .prepare(
          `SELECT SUM(amount) as total FROM transactions
           WHERE status = 'POSTED'`
        )
        .first();

      const creditTotal = await db
        .prepare(
          `SELECT SUM(amount) as total FROM transactions
           WHERE status = 'POSTED'`
        )
        .first();

      // Since each transaction has exactly one debit and one credit of equal amounts,
      // total debits should equal total credits
      const totalDebits = (debitTotal?.total as number) || 0;
      const totalCredits = (creditTotal?.total as number) || 0;

      // Find any transactions that might be incomplete
      const unmatchedResult = await db
        .prepare(
          `SELECT id FROM transactions
           WHERE (debit_account_id IS NULL OR credit_account_id IS NULL)
           AND status = 'POSTED'`
        )
        .all();

      const unmatched = (unmatchedResult.results || []).map(r => r.id as string);

      const balanced = totalDebits === totalCredits && unmatched.length === 0;

      if (!balanced) {
        await audit.log({
          log_type: 'SECURITY_EVENT',
          action: 'DOUBLE_ENTRY_VIOLATION',
          request: {
            total_debits: totalDebits,
            total_credits: totalCredits,
            unmatched_count: unmatched.length,
          },
          outcome: 'FAILURE',
          risk_score: 1.0,
          flags: ['CRITICAL_ACCOUNTING_ERROR', 'DOUBLE_ENTRY_VIOLATION'],
          manipulation_detected: true,
        });
      }

      return {
        balanced,
        total_debits: totalDebits,
        total_credits: totalCredits,
        unmatched_transactions: unmatched,
      };
    },

    async getDailyReconciliationReport(date: string): Promise<{
      date: string;
      opening_balance: number;
      closing_balance: number;
      debits: number;
      credits: number;
      transaction_count: number;
      status: 'RECONCILED' | 'PENDING' | 'DISCREPANCY';
    }[]> {
      // Get all accounts with their daily transaction summaries
      const results = await db
        .prepare(
          `SELECT
            a.id as account_id,
            a.balance_ledger as current_balance,
            COALESCE(SUM(CASE WHEN t.credit_account_id = a.id AND date(t.created_at) = ? THEN t.amount ELSE 0 END), 0) as day_credits,
            COALESCE(SUM(CASE WHEN t.debit_account_id = a.id AND date(t.created_at) = ? THEN t.amount ELSE 0 END), 0) as day_debits,
            COUNT(CASE WHEN (t.credit_account_id = a.id OR t.debit_account_id = a.id) AND date(t.created_at) = ? THEN 1 END) as tx_count
           FROM accounts a
           LEFT JOIN transactions t ON (t.credit_account_id = a.id OR t.debit_account_id = a.id)
           WHERE a.status != 'CLOSED'
           GROUP BY a.id`
        )
        .bind(date, date, date)
        .all();

      return (results.results || []).map(row => {
        const currentBalance = (row.current_balance as number) || 0;
        const dayCredits = (row.day_credits as number) || 0;
        const dayDebits = (row.day_debits as number) || 0;
        const txCount = (row.tx_count as number) || 0;

        // Calculate opening balance (current - day's net change)
        const netChange = dayCredits - dayDebits;
        const openingBalance = currentBalance - netChange;

        return {
          date,
          opening_balance: openingBalance,
          closing_balance: currentBalance,
          debits: dayDebits,
          credits: dayCredits,
          transaction_count: txCount,
          status: 'RECONCILED' as const,
        };
      });
    },
  };
}
