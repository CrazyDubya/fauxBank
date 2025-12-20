/**
 * Customer Service for fauxBank
 */

const Customer = require('../models/Customer');
const dataStore = require('./dataStore');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../middleware/auth');
const { auditLog } = require('../middleware/securityGuardrails');
const crypto = require('crypto');

class CustomerService {
  /**
   * Register new customer
   */
  async registerCustomer(customerData) {
    // Check if email already exists
    const existingCustomer = dataStore.getCustomerByEmail(customerData.email);
    if (existingCustomer) {
      throw new Error('Email already registered');
    }

    // Generate customer ID
    const customerId = crypto.randomUUID();

    // Hash password (if provided)
    let hashedPassword = null;
    if (customerData.password) {
      hashedPassword = await bcrypt.hash(customerData.password, 10);
    }

    const customer = new Customer({
      customerId,
      firstName: customerData.firstName,
      lastName: customerData.lastName,
      email: customerData.email,
      phone: customerData.phone,
      address: customerData.address || {},
      dateOfBirth: customerData.dateOfBirth,
      ssn: customerData.ssn, // Simulated for testing
      kycStatus: 'pending'
    });

    dataStore.createCustomer(customer);

    // Store password separately (in real system, would be in secure store)
    if (hashedPassword) {
      // For demo purposes, storing in metadata
      customer._password = hashedPassword;
    }

    auditLog('CUSTOMER_REGISTERED', { customerId, email: customerData.email });

    // Generate authentication token
    const token = generateToken({
      customerId: customer.customerId,
      email: customer.email,
      role: 'customer'
    });

    return {
      customer: customer.toJSON(),
      token
    };
  }

  /**
   * Authenticate customer
   */
  async authenticateCustomer(email, password) {
    const customer = dataStore.getCustomerByEmail(email);
    
    if (!customer) {
      throw new Error('Invalid credentials');
    }

    // In a real system, password would be retrieved from secure storage
    if (!customer._password) {
      throw new Error('Password not set for this account');
    }

    const isValid = await bcrypt.compare(password, customer._password);
    
    if (!isValid) {
      auditLog('FAILED_LOGIN', { email });
      throw new Error('Invalid credentials');
    }

    auditLog('CUSTOMER_LOGIN', { customerId: customer.customerId, email });

    const token = generateToken({
      customerId: customer.customerId,
      email: customer.email,
      role: 'customer'
    });

    return {
      customer: customer.toJSON(),
      token
    };
  }

  /**
   * Get customer by ID
   */
  getCustomer(customerId) {
    return dataStore.getCustomer(customerId);
  }

  /**
   * Update customer information
   */
  updateCustomer(customerId, updates) {
    const customer = dataStore.getCustomer(customerId);
    
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Prevent updating sensitive fields directly
    delete updates.customerId;
    delete updates.creditScore;
    delete updates._password;

    const updatedCustomer = dataStore.updateCustomer(customerId, updates);

    auditLog('CUSTOMER_UPDATED', { customerId, fields: Object.keys(updates) });

    return updatedCustomer;
  }

  /**
   * Complete KYC verification
   */
  completeKYC(customerId, status) {
    const customer = dataStore.getCustomer(customerId);
    
    if (!customer) {
      throw new Error('Customer not found');
    }

    const validStatuses = ['verified', 'failed'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid KYC status');
    }

    customer.kycStatus = status;
    customer.updatedAt = new Date();
    dataStore.updateCustomer(customerId, customer);

    auditLog('KYC_COMPLETED', { customerId, status });

    return customer;
  }

  /**
   * Get customer profile with all accounts
   */
  getCustomerProfile(customerId) {
    const customer = dataStore.getCustomer(customerId);
    
    if (!customer) {
      throw new Error('Customer not found');
    }

    const accounts = dataStore.getAccountsByCustomer(customerId);
    const loans = dataStore.getLoansByCustomer(customerId);
    const creditCards = dataStore.getCreditCardsByCustomer(customerId);
    const cds = dataStore.getCDsByCustomer(customerId);
    const investmentAccounts = dataStore.getInvestmentAccountsByCustomer(customerId);

    return {
      customer: customer.toJSON(),
      accounts: accounts.map(a => a.toJSON()),
      loans: loans.map(l => l.toJSON()),
      creditCards: creditCards.map(c => c.toJSON()),
      certificatesOfDeposit: cds.map(cd => cd.toJSON()),
      investmentAccounts: investmentAccounts.map(inv => inv.toJSON())
    };
  }
}

module.exports = new CustomerService();
