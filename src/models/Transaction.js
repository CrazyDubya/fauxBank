/**
 * Transaction Model for fauxBank
 * Supports all transaction types: transfers, ACH, eChecks, card transactions
 */

class Transaction {
  constructor(data) {
    this.transactionId = data.transactionId;
    this.transactionType = data.transactionType; // 'debit', 'credit', 'transfer', 'ach', 'echeck', 'card_payment', 'loan_payment', 'wire'
    this.amount = data.amount;
    this.currency = data.currency || 'USD';
    this.fromAccount = data.fromAccount;
    this.toAccount = data.toAccount;
    this.status = data.status || 'pending'; // 'pending', 'completed', 'failed', 'cancelled'
    this.description = data.description || '';
    this.customerId = data.customerId;
    this.metadata = data.metadata || {}; // Additional transaction-specific data
    this.createdAt = data.createdAt || new Date();
    this.completedAt = data.completedAt;
    this.failureReason = data.failureReason;
  }

  toJSON() {
    return {
      transactionId: this.transactionId,
      transactionType: this.transactionType,
      amount: this.amount,
      currency: this.currency,
      fromAccount: this.fromAccount,
      toAccount: this.toAccount,
      status: this.status,
      description: this.description,
      customerId: this.customerId,
      metadata: this.metadata,
      createdAt: this.createdAt,
      completedAt: this.completedAt,
      failureReason: this.failureReason
    };
  }
}

module.exports = Transaction;
