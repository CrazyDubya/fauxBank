/**
 * Investment Account Model for fauxBank
 */

class InvestmentAccount {
  constructor(data) {
    this.investmentNumber = data.investmentNumber;
    this.accountType = data.accountType; // 'brokerage', 'ira', 'roth_ira', '401k'
    this.customerId = data.customerId;
    this.cashBalance = data.cashBalance || 0;
    this.investedValue = data.investedValue || 0;
    this.totalValue = data.totalValue || 0;
    this.holdings = data.holdings || []; // Array of stock/fund holdings
    this.status = data.status || 'active'; // 'active', 'frozen', 'closed'
    this.riskProfile = data.riskProfile || 'moderate'; // 'conservative', 'moderate', 'aggressive'
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  toJSON() {
    return {
      investmentNumber: this.investmentNumber,
      accountType: this.accountType,
      customerId: this.customerId,
      cashBalance: this.cashBalance,
      investedValue: this.investedValue,
      totalValue: this.totalValue,
      holdings: this.holdings,
      status: this.status,
      riskProfile: this.riskProfile,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = InvestmentAccount;
