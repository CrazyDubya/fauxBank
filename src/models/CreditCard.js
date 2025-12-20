/**
 * Credit Card Model for fauxBank
 */

class CreditCard {
  constructor(data) {
    this.cardNumber = data.cardNumber;
    this.cardType = data.cardType; // 'visa', 'mastercard', 'amex', 'discover'
    this.customerId = data.customerId;
    this.creditLimit = data.creditLimit;
    this.currentBalance = data.currentBalance || 0;
    this.availableCredit = data.availableCredit || data.creditLimit;
    this.interestRate = data.interestRate;
    this.minimumPayment = data.minimumPayment || 0;
    this.dueDate = data.dueDate;
    this.cvv = data.cvv;
    this.expirationDate = data.expirationDate;
    this.status = data.status || 'active'; // 'active', 'frozen', 'closed', 'reported_stolen'
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.rewardsPoints = data.rewardsPoints || 0;
  }

  toJSON() {
    return {
      cardNumber: this.cardNumber,
      cardType: this.cardType,
      customerId: this.customerId,
      creditLimit: this.creditLimit,
      currentBalance: this.currentBalance,
      availableCredit: this.availableCredit,
      interestRate: this.interestRate,
      minimumPayment: this.minimumPayment,
      dueDate: this.dueDate,
      expirationDate: this.expirationDate,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      rewardsPoints: this.rewardsPoints
    };
  }
}

module.exports = CreditCard;
