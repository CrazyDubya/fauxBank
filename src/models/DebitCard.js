/**
 * Debit Card Model for fauxBank
 */

class DebitCard {
  constructor(data) {
    this.cardNumber = data.cardNumber;
    this.linkedAccountNumber = data.linkedAccountNumber;
    this.customerId = data.customerId;
    this.cvv = data.cvv;
    this.expirationDate = data.expirationDate;
    this.status = data.status || 'active'; // 'active', 'frozen', 'closed', 'reported_stolen'
    this.dailyLimit = data.dailyLimit || 1000;
    this.dailySpent = data.dailySpent || 0;
    this.pin = data.pin; // Encrypted PIN
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  toJSON() {
    return {
      cardNumber: this.cardNumber,
      linkedAccountNumber: this.linkedAccountNumber,
      customerId: this.customerId,
      expirationDate: this.expirationDate,
      status: this.status,
      dailyLimit: this.dailyLimit,
      dailySpent: this.dailySpent,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = DebitCard;
