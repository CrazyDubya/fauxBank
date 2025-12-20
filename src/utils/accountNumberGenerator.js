/**
 * Account Number Generator for fauxBank
 * Generates alphanumeric account numbers to differentiate from real banking systems
 */

const crypto = require('crypto');

/**
 * Generate a random alphanumeric account number
 * Format: XXXX-XXXX-XXXX (12 characters, grouped for readability)
 * Uses uppercase letters and numbers, excluding ambiguous characters (0, O, I, 1)
 */
function generateAccountNumber() {
  // Character set excluding ambiguous characters
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let accountNumber = '';
  
  for (let i = 0; i < 12; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    accountNumber += chars[randomIndex];
    
    // Add hyphen after every 4 characters (except at the end)
    if ((i + 1) % 4 === 0 && i < 11) {
      accountNumber += '-';
    }
  }
  
  return accountNumber;
}

/**
 * Generate a routing number (also alphanumeric for fauxBank)
 * Format: XXXXXX (6 characters)
 */
function generateRoutingNumber() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let routingNumber = '';
  
  for (let i = 0; i < 6; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    routingNumber += chars[randomIndex];
  }
  
  return routingNumber;
}

/**
 * Generate a card number (alphanumeric)
 * Format: XXXX-XXXX-XXXX-XXXX (16 characters)
 */
function generateCardNumber() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let cardNumber = '';
  
  for (let i = 0; i < 16; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    cardNumber += chars[randomIndex];
    
    // Add hyphen after every 4 characters (except at the end)
    if ((i + 1) % 4 === 0 && i < 15) {
      cardNumber += '-';
    }
  }
  
  return cardNumber;
}

/**
 * Generate a loan account number
 * Format: LOAN-XXXXXXXX (8 characters after prefix)
 */
function generateLoanNumber() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let loanNumber = 'LOAN-';
  
  for (let i = 0; i < 8; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    loanNumber += chars[randomIndex];
  }
  
  return loanNumber;
}

/**
 * Generate a CD (Certificate of Deposit) account number
 * Format: CD-XXXXXXXX (8 characters after prefix)
 */
function generateCDNumber() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let cdNumber = 'CD-';
  
  for (let i = 0; i < 8; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    cdNumber += chars[randomIndex];
  }
  
  return cdNumber;
}

/**
 * Generate an investment account number
 * Format: INV-XXXXXXXX (8 characters after prefix)
 */
function generateInvestmentNumber() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let invNumber = 'INV-';
  
  for (let i = 0; i < 8; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    invNumber += chars[randomIndex];
  }
  
  return invNumber;
}

/**
 * Validate an account number format
 */
function validateAccountNumber(accountNumber) {
  // Check format: XXXX-XXXX-XXXX
  const pattern = /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/;
  return pattern.test(accountNumber);
}

module.exports = {
  generateAccountNumber,
  generateRoutingNumber,
  generateCardNumber,
  generateLoanNumber,
  generateCDNumber,
  generateInvestmentNumber,
  validateAccountNumber
};
