/**
 * Loan Model for fauxBank
 */

class Loan {
  constructor(data) {
    this.loanNumber = data.loanNumber;
    this.loanType = data.loanType; // 'personal', 'auto', 'home', 'student', 'business'
    this.principal = data.principal;
    this.interestRate = data.interestRate;
    this.termMonths = data.termMonths;
    this.monthlyPayment = data.monthlyPayment;
    this.currentBalance = data.currentBalance || data.principal;
    this.customerId = data.customerId;
    this.status = data.status || 'active'; // 'active', 'paid_off', 'defaulted', 'deferred'
    this.startDate = data.startDate || new Date();
    this.nextPaymentDate = data.nextPaymentDate;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  toJSON() {
    return {
      loanNumber: this.loanNumber,
      loanType: this.loanType,
      principal: this.principal,
      interestRate: this.interestRate,
      termMonths: this.termMonths,
      monthlyPayment: this.monthlyPayment,
      currentBalance: this.currentBalance,
      customerId: this.customerId,
      status: this.status,
      startDate: this.startDate,
      nextPaymentDate: this.nextPaymentDate,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Loan;
