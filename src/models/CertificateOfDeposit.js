/**
 * Certificate of Deposit (CD) Model for fauxBank
 */

class CertificateOfDeposit {
  constructor(data) {
    this.cdNumber = data.cdNumber;
    this.customerId = data.customerId;
    this.principal = data.principal;
    this.interestRate = data.interestRate;
    this.termMonths = data.termMonths;
    this.maturityDate = data.maturityDate;
    this.currentValue = data.currentValue || data.principal;
    this.status = data.status || 'active'; // 'active', 'matured', 'closed'
    this.autoRenew = data.autoRenew || false;
    this.earlyWithdrawalPenalty = data.earlyWithdrawalPenalty || 0;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  toJSON() {
    return {
      cdNumber: this.cdNumber,
      customerId: this.customerId,
      principal: this.principal,
      interestRate: this.interestRate,
      termMonths: this.termMonths,
      maturityDate: this.maturityDate,
      currentValue: this.currentValue,
      status: this.status,
      autoRenew: this.autoRenew,
      earlyWithdrawalPenalty: this.earlyWithdrawalPenalty,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = CertificateOfDeposit;
