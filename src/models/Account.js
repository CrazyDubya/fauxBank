/**
 * Account Model for fauxBank
 */

class Account {
  constructor(data) {
    this.accountNumber = data.accountNumber;
    this.accountType = data.accountType; // 'checking', 'savings', 'money_market'
    this.balance = data.balance || 0;
    this.currency = data.currency || 'USD';
    this.status = data.status || 'active'; // 'active', 'frozen', 'closed'
    this.customerId = data.customerId;
    this.routingNumber = data.routingNumber;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.interestRate = data.interestRate || 0;
    this.minimumBalance = data.minimumBalance || 0;
    this.overdraftProtection = data.overdraftProtection || false;
    this.overdraftLimit = data.overdraftLimit || 0;
  }

  toJSON() {
    return {
      accountNumber: this.accountNumber,
      accountType: this.accountType,
      balance: this.balance,
      currency: this.currency,
      status: this.status,
      customerId: this.customerId,
      routingNumber: this.routingNumber,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      interestRate: this.interestRate,
      minimumBalance: this.minimumBalance,
      overdraftProtection: this.overdraftProtection,
      overdraftLimit: this.overdraftLimit
    };
  }
}

module.exports = Account;
