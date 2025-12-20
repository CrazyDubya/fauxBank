/**
 * Credit Controller for fauxBank API
 */

const creditService = require('../services/creditService');

class CreditController {
  /**
   * Perform credit check
   */
  async performCreditCheck(req, res) {
    try {
      const { customerId } = req.params;
      const result = creditService.performCreditCheck(customerId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'CREDIT_CHECK_FAILED'
      });
    }
  }

  /**
   * Apply for loan
   */
  async applyForLoan(req, res) {
    try {
      const { customerId, loanType, principal, termMonths, interestRate } = req.body;

      if (!customerId || !loanType || !principal || !termMonths) {
        return res.status(400).json({
          error: 'Missing required fields',
          code: 'MISSING_FIELDS'
        });
      }

      const loan = creditService.applyForLoan(
        customerId,
        loanType,
        principal,
        termMonths,
        interestRate || 5.99
      );

      res.status(201).json({
        success: true,
        data: loan.toJSON()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'LOAN_APPLICATION_FAILED'
      });
    }
  }

  /**
   * Make loan payment
   */
  async makeLoanPayment(req, res) {
    try {
      const { loanNumber } = req.params;
      const { amount } = req.body;

      if (!amount) {
        return res.status(400).json({
          error: 'Missing required field: amount',
          code: 'MISSING_FIELDS'
        });
      }

      const loan = creditService.makeLoanPayment(loanNumber, amount);

      res.json({
        success: true,
        data: loan.toJSON()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'LOAN_PAYMENT_FAILED'
      });
    }
  }

  /**
   * Apply for credit card
   */
  async applyForCreditCard(req, res) {
    try {
      const { customerId, cardType, requestedLimit } = req.body;

      if (!customerId || !cardType || !requestedLimit) {
        return res.status(400).json({
          error: 'Missing required fields',
          code: 'MISSING_FIELDS'
        });
      }

      const creditCard = creditService.applyForCreditCard(
        customerId,
        cardType,
        requestedLimit
      );

      res.status(201).json({
        success: true,
        data: creditCard.toJSON()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'CREDIT_CARD_APPLICATION_FAILED'
      });
    }
  }

  /**
   * Make credit card payment
   */
  async makeCreditCardPayment(req, res) {
    try {
      const { cardNumber } = req.params;
      const { amount } = req.body;

      if (!amount) {
        return res.status(400).json({
          error: 'Missing required field: amount',
          code: 'MISSING_FIELDS'
        });
      }

      const card = creditService.makeCreditCardPayment(cardNumber, amount);

      res.json({
        success: true,
        data: card.toJSON()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'PAYMENT_FAILED'
      });
    }
  }

  /**
   * Charge credit card
   */
  async chargeCreditCard(req, res) {
    try {
      const { cardNumber, amount, merchantId, description } = req.body;

      if (!cardNumber || !amount || !merchantId) {
        return res.status(400).json({
          error: 'Missing required fields',
          code: 'MISSING_FIELDS'
        });
      }

      const card = creditService.chargeCreditCard(cardNumber, amount, merchantId, description);

      res.json({
        success: true,
        data: card.toJSON()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'CHARGE_FAILED'
      });
    }
  }
}

module.exports = new CreditController();
