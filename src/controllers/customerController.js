/**
 * Customer Controller for fauxBank API
 */

const customerService = require('../services/customerService');

class CustomerController {
  /**
   * Register new customer
   */
  async register(req, res) {
    try {
      const result = await customerService.registerCustomer(req.body);

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'REGISTRATION_FAILED'
      });
    }
  }

  /**
   * Authenticate customer
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: 'Missing required fields: email, password',
          code: 'MISSING_FIELDS'
        });
      }

      const result = await customerService.authenticateCustomer(email, password);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: error.message,
        code: 'AUTHENTICATION_FAILED'
      });
    }
  }

  /**
   * Get customer profile
   */
  async getProfile(req, res) {
    try {
      const { customerId } = req.params;
      const profile = customerService.getCustomerProfile(customerId);

      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message,
        code: 'CUSTOMER_NOT_FOUND'
      });
    }
  }

  /**
   * Update customer information
   */
  async updateCustomer(req, res) {
    try {
      const { customerId } = req.params;
      const customer = customerService.updateCustomer(customerId, req.body);

      res.json({
        success: true,
        data: customer.toJSON()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'UPDATE_FAILED'
      });
    }
  }
}

module.exports = new CustomerController();
