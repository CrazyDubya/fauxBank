/**
 * Customer Model for fauxBank
 */

class Customer {
  constructor(data) {
    this.customerId = data.customerId;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.email = data.email;
    this.phone = data.phone;
    this.address = data.address || {};
    this.dateOfBirth = data.dateOfBirth;
    this.ssn = data.ssn; // Simulated SSN for testing
    this.creditScore = data.creditScore || 0;
    this.kycStatus = data.kycStatus || 'pending'; // 'pending', 'verified', 'failed'
    this.accountStatus = data.accountStatus || 'active'; // 'active', 'suspended', 'closed'
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  toJSON() {
    return {
      customerId: this.customerId,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      phone: this.phone,
      address: this.address,
      dateOfBirth: this.dateOfBirth,
      creditScore: this.creditScore,
      kycStatus: this.kycStatus,
      accountStatus: this.accountStatus,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Customer;
