import { D1Database } from '@cloudflare/workers-types';
import { createLedgerService } from './ledger';
import { generateUUID } from '../utils/ids';

/**
 * Statement Service
 *
 * Generates account statements for customers.
 * Supports monthly statements and custom date ranges.
 */

export interface StatementTransaction {
  date: string;
  description: string;
  reference?: string;
  debit?: number;
  credit?: number;
  balance: number;
}

export interface Statement {
  statement_id: string;
  account_id: string;
  account_name?: string;
  period_start: string;
  period_end: string;
  opening_balance: number;
  closing_balance: number;
  total_debits: number;
  total_credits: number;
  transaction_count: number;
  transactions: StatementTransaction[];
  generated_at: string;
}

export interface StatementRequest {
  account_id: string;
  period_start: string;
  period_end: string;
  format?: 'JSON' | 'CSV' | 'PDF';
}

export interface StatementService {
  generateStatement(request: StatementRequest): Promise<Statement>;
  getMonthlyStatement(accountId: string, year: number, month: number): Promise<Statement>;
  listStatements(accountId: string): Promise<{
    statements: Array<{
      statement_id: string;
      period_start: string;
      period_end: string;
      generated_at: string;
    }>;
  }>;
  exportToCsv(statement: Statement): string;
}

export function createStatementService(db: D1Database): StatementService {
  const ledger = createLedgerService(db);

  return {
    async generateStatement(request: StatementRequest): Promise<Statement> {
      const account = await ledger.getAccount(request.account_id);
      if (!account) {
        throw new Error(`Account not found: ${request.account_id}`);
      }

      // Get all transactions in the period
      const transactions = await getTransactionsInPeriod(
        db,
        request.account_id,
        request.period_start,
        request.period_end
      );

      // Calculate running balances
      const openingBalance = await getBalanceAtDate(db, request.account_id, request.period_start);
      let runningBalance = openingBalance;
      let totalDebits = 0;
      let totalCredits = 0;

      const statementTransactions: StatementTransaction[] = transactions.map(tx => {
        let debit: number | undefined;
        let credit: number | undefined;

        if (tx.debit_account_id === request.account_id) {
          debit = tx.amount;
          totalDebits += tx.amount;
          runningBalance -= tx.amount;
        } else {
          credit = tx.amount;
          totalCredits += tx.amount;
          runningBalance += tx.amount;
        }

        return {
          date: tx.created_at,
          description: tx.memo || getTransactionDescription(tx),
          reference: tx.reference,
          debit,
          credit,
          balance: runningBalance,
        };
      });

      const statement: Statement = {
        statement_id: generateUUID(),
        account_id: request.account_id,
        account_name: account.name,
        period_start: request.period_start,
        period_end: request.period_end,
        opening_balance: openingBalance,
        closing_balance: runningBalance,
        total_debits: totalDebits,
        total_credits: totalCredits,
        transaction_count: transactions.length,
        transactions: statementTransactions,
        generated_at: new Date().toISOString(),
      };

      // Store statement reference
      await db
        .prepare(
          `INSERT INTO statements (id, account_id, period_start, period_end, generated_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(
          statement.statement_id,
          request.account_id,
          request.period_start,
          request.period_end,
          statement.generated_at
        )
        .run()
        .catch(() => {
          // If statements table doesn't exist, that's okay
        });

      return statement;
    },

    async getMonthlyStatement(accountId: string, year: number, month: number): Promise<Statement> {
      const periodStart = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const periodEnd = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month

      return this.generateStatement({
        account_id: accountId,
        period_start: periodStart + 'T00:00:00Z',
        period_end: periodEnd + 'T23:59:59Z',
      });
    },

    async listStatements(accountId: string): Promise<{
      statements: Array<{
        statement_id: string;
        period_start: string;
        period_end: string;
        generated_at: string;
      }>;
    }> {
      const results = await db
        .prepare(
          `SELECT id, period_start, period_end, generated_at FROM statements
           WHERE account_id = ?
           ORDER BY period_end DESC
           LIMIT 24`
        )
        .bind(accountId)
        .all()
        .catch(() => ({ results: [] }));

      return {
        statements: (results.results || []).map(row => ({
          statement_id: row.id as string,
          period_start: row.period_start as string,
          period_end: row.period_end as string,
          generated_at: row.generated_at as string,
        })),
      };
    },

    exportToCsv(statement: Statement): string {
      const lines: string[] = [];

      // Header
      lines.push(`Account Statement - ${statement.account_id}`);
      lines.push(`Period: ${statement.period_start} to ${statement.period_end}`);
      lines.push(`Generated: ${statement.generated_at}`);
      lines.push('');
      lines.push(`Opening Balance: ${formatCurrency(statement.opening_balance)}`);
      lines.push(`Closing Balance: ${formatCurrency(statement.closing_balance)}`);
      lines.push('');

      // Transaction header
      lines.push('Date,Description,Reference,Debit,Credit,Balance');

      // Transactions
      for (const tx of statement.transactions) {
        lines.push([
          tx.date,
          `"${tx.description.replace(/"/g, '""')}"`,
          tx.reference || '',
          tx.debit ? formatCurrency(tx.debit) : '',
          tx.credit ? formatCurrency(tx.credit) : '',
          formatCurrency(tx.balance),
        ].join(','));
      }

      // Summary
      lines.push('');
      lines.push(`Total Debits,,,${formatCurrency(statement.total_debits)}`);
      lines.push(`Total Credits,,,,${formatCurrency(statement.total_credits)}`);
      lines.push(`Transaction Count: ${statement.transaction_count}`);

      return lines.join('\n');
    },
  };
}

// Helper functions

async function getTransactionsInPeriod(
  db: D1Database,
  accountId: string,
  startDate: string,
  endDate: string
): Promise<Array<{
  id: string;
  type: string;
  amount: number;
  debit_account_id: string;
  credit_account_id: string;
  reference?: string;
  memo?: string;
  created_at: string;
}>> {
  const results = await db
    .prepare(
      `SELECT id, type, amount, debit_account_id, credit_account_id, reference, memo, created_at
       FROM transactions
       WHERE (debit_account_id = ? OR credit_account_id = ?)
       AND status = 'POSTED'
       AND created_at >= ? AND created_at <= ?
       ORDER BY created_at ASC`
    )
    .bind(accountId, accountId, startDate, endDate)
    .all();

  return (results.results || []).map(row => ({
    id: row.id as string,
    type: row.type as string,
    amount: row.amount as number,
    debit_account_id: row.debit_account_id as string,
    credit_account_id: row.credit_account_id as string,
    reference: row.reference as string | undefined,
    memo: row.memo as string | undefined,
    created_at: row.created_at as string,
  }));
}

async function getBalanceAtDate(
  db: D1Database,
  accountId: string,
  date: string
): Promise<number> {
  // Calculate balance at a specific date by summing all prior transactions
  const result = await db
    .prepare(
      `SELECT
        SUM(CASE WHEN credit_account_id = ? THEN amount ELSE 0 END) as credits,
        SUM(CASE WHEN debit_account_id = ? THEN amount ELSE 0 END) as debits
       FROM transactions
       WHERE (credit_account_id = ? OR debit_account_id = ?)
       AND status = 'POSTED'
       AND created_at < ?`
    )
    .bind(accountId, accountId, accountId, accountId, date)
    .first();

  const credits = (result?.credits as number) || 0;
  const debits = (result?.debits as number) || 0;

  return credits - debits;
}

function getTransactionDescription(tx: {
  type: string;
  debit_account_id: string;
  credit_account_id: string;
}): string {
  const descriptions: Record<string, string> = {
    DEPOSIT: 'Deposit',
    WITHDRAWAL: 'Withdrawal',
    TRANSFER: 'Transfer',
    PAYMENT: 'Payment',
    FEE: 'Fee',
    INTEREST: 'Interest',
    REFUND: 'Refund',
    CAPTURE: 'Card Capture',
    VOID: 'Void',
    CHARGEBACK: 'Chargeback',
    ADJUSTMENT: 'Adjustment',
  };

  return descriptions[tx.type] || tx.type;
}

function formatCurrency(cents: number): string {
  return `F$${(cents / 100).toFixed(2)}`;
}
