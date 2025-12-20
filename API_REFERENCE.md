# fauxBank API Reference

Complete API reference for the fauxBank mock banking system.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Most endpoints require authentication via JWT token. Include the token in the Authorization header:

```
Authorization: Bearer <token>
```

Obtain a token by registering or logging in via the customer endpoints.

## Response Format

All responses follow this format:

**Success Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## Endpoints

### Health Check

#### GET /health
Check API health status

**Authentication:** Not required

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-20T18:00:00.000Z",
  "service": "fauxBank API"
}
```

---

## Customer Endpoints

### Register Customer

#### POST /customers/register
Create a new customer account

**Authentication:** Not required

**Request Body:**
```json
{
  "firstName": "string (required)",
  "lastName": "string (required)",
  "email": "string (required, unique)",
  "password": "string (required)",
  "phone": "string (required)",
  "dateOfBirth": "string (ISO date, required)",
  "ssn": "string (required)",
  "address": {
    "street": "string",
    "city": "string",
    "state": "string",
    "zip": "string"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "customer": {
      "customerId": "uuid",
      "firstName": "string",
      "lastName": "string",
      "email": "string",
      "kycStatus": "pending",
      "creditScore": 0
    },
    "token": "jwt-token"
  }
}
```

### Login

#### POST /customers/login
Authenticate a customer

**Authentication:** Not required

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "customer": { ... },
    "token": "jwt-token"
  }
}
```

### Get Customer Profile

#### GET /customers/:customerId/profile
Get complete customer profile with all accounts

**Authentication:** Required

**URL Parameters:**
- `customerId` - Customer UUID

**Response:**
```json
{
  "success": true,
  "data": {
    "customer": { ... },
    "accounts": [ ... ],
    "loans": [ ... ],
    "creditCards": [ ... ],
    "certificatesOfDeposit": [ ... ],
    "investmentAccounts": [ ... ]
  }
}
```

### Update Customer

#### PUT /customers/:customerId
Update customer information

**Authentication:** Required

**URL Parameters:**
- `customerId` - Customer UUID

**Request Body:**
```json
{
  "phone": "string (optional)",
  "address": { ... } (optional),
  "email": "string (optional)"
}
```

---

## Account Endpoints

### Create Account

#### POST /accounts
Create a new bank account

**Authentication:** Required

**Request Body:**
```json
{
  "customerId": "uuid (required)",
  "accountType": "checking|savings|money_market (required)",
  "initialDeposit": "number (optional, default: 0)",
  "options": {
    "interestRate": "number (optional)",
    "minimumBalance": "number (optional)",
    "overdraftProtection": "boolean (optional)",
    "overdraftLimit": "number (optional)"
  }
}
```

**Account Types:**
- `checking` - Standard checking account
- `savings` - Interest-bearing savings account
- `money_market` - Higher interest money market account

**Response:**
```json
{
  "success": true,
  "data": {
    "accountNumber": "XXXX-XXXX-XXXX (alphanumeric)",
    "accountType": "string",
    "balance": "number",
    "currency": "USD",
    "status": "active",
    "routingNumber": "XXXXXX (alphanumeric)",
    "interestRate": "number",
    "minimumBalance": "number",
    "overdraftProtection": "boolean",
    "overdraftLimit": "number"
  }
}
```

### Get Account

#### GET /accounts/:accountNumber
Get account details

**Authentication:** Required

**URL Parameters:**
- `accountNumber` - Account number (alphanumeric)

**Response:**
```json
{
  "success": true,
  "data": {
    "accountNumber": "string",
    "accountType": "string",
    "balance": "number",
    "status": "active|frozen|closed",
    ...
  }
}
```

### Get Customer Accounts

#### GET /customers/:customerId/accounts
List all accounts for a customer

**Authentication:** Required

**URL Parameters:**
- `customerId` - Customer UUID

**Response:**
```json
{
  "success": true,
  "data": [
    { ... account details ... },
    { ... account details ... }
  ]
}
```

### Transfer Funds

#### POST /accounts/transfer
Transfer money between accounts

**Authentication:** Required

**Request Body:**
```json
{
  "fromAccountNumber": "string (required)",
  "toAccountNumber": "string (required)",
  "amount": "number (required, max: 1000000)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fromAccount": { ... updated account ... },
    "toAccount": { ... updated account ... }
  }
}
```

### Freeze Account

#### POST /accounts/:accountNumber/freeze
Freeze an account

**Authentication:** Required

**Request Body:**
```json
{
  "reason": "string (required)"
}
```

### Unfreeze Account

#### POST /accounts/:accountNumber/unfreeze
Unfreeze an account

**Authentication:** Required

### Close Account

#### POST /accounts/:accountNumber/close
Close an account (balance must be zero)

**Authentication:** Required

---

## Transaction Endpoints

### Process ACH

#### POST /transactions/ach
Process an ACH transfer (1-3 business days)

**Authentication:** Required

**Request Body:**
```json
{
  "fromAccountNumber": "string (required)",
  "toAccountNumber": "string (required)",
  "amount": "number (required)",
  "description": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "uuid",
    "transactionType": "ach",
    "amount": "number",
    "fromAccount": "string",
    "toAccount": "string",
    "status": "completed|pending|failed",
    "description": "string",
    "metadata": {
      "processingDays": 1
    }
  }
}
```

### Process eCheck

#### POST /transactions/echeck
Process an electronic check

**Authentication:** Required

**Request Body:**
```json
{
  "fromAccountNumber": "string (required)",
  "toAccountNumber": "string (required)",
  "amount": "number (required)",
  "checkNumber": "string (required)",
  "description": "string (optional)"
}
```

### Process Wire Transfer

#### POST /transactions/wire
Process a wire transfer (same-day, $25 fee)

**Authentication:** Required

**Request Body:**
```json
{
  "fromAccountNumber": "string (required)",
  "toAccountNumber": "string (required)",
  "amount": "number (required)",
  "description": "string (optional)"
}
```

**Note:** Wire transfers include a $25 fee automatically deducted from the source account.

### Get Transaction

#### GET /transactions/:transactionId
Get transaction details

**Authentication:** Required

### Get Account Transactions

#### GET /accounts/:accountNumber/transactions
List all transactions for an account

**Authentication:** Required

---

## Credit Endpoints

### Perform Credit Check

#### GET /customers/:customerId/credit-check
Perform a credit check and get credit score

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "customerId": "uuid",
    "creditScore": "number (300-850)",
    "rating": "Excellent|Very Good|Good|Fair|Poor",
    "timestamp": "ISO date"
  }
}
```

**Credit Score Ranges:**
- 800-850: Excellent
- 740-799: Very Good
- 670-739: Good
- 580-669: Fair
- 300-579: Poor

### Apply for Loan

#### POST /loans/apply
Apply for a loan

**Authentication:** Required

**Request Body:**
```json
{
  "customerId": "uuid (required)",
  "loanType": "personal|auto|home|student|business (required)",
  "principal": "number (required)",
  "termMonths": "number (required)",
  "interestRate": "number (optional, default varies)"
}
```

**Minimum Credit Scores by Loan Type:**
- Personal: 620
- Auto: 600
- Home: 680
- Student: 580
- Business: 700

**Response:**
```json
{
  "success": true,
  "data": {
    "loanNumber": "LOAN-XXXXXXXX",
    "loanType": "string",
    "principal": "number",
    "interestRate": "number",
    "termMonths": "number",
    "monthlyPayment": "number",
    "currentBalance": "number",
    "status": "active",
    "nextPaymentDate": "ISO date"
  }
}
```

### Make Loan Payment

#### POST /loans/:loanNumber/payment
Make a payment on a loan

**Authentication:** Required

**Request Body:**
```json
{
  "amount": "number (required)"
}
```

### Apply for Credit Card

#### POST /credit-cards/apply
Apply for a credit card

**Authentication:** Required

**Request Body:**
```json
{
  "customerId": "uuid (required)",
  "cardType": "visa|mastercard|amex|discover (required)",
  "requestedLimit": "number (required)"
}
```

**Credit Limit by Credit Score:**
- 750+: Up to $20,000
- 670-749: Up to $10,000
- 600-669: Up to $5,000
- Below 600: Denied

**Response:**
```json
{
  "success": true,
  "data": {
    "cardNumber": "XXXX-XXXX-XXXX-XXXX (alphanumeric)",
    "cardType": "string",
    "creditLimit": "number",
    "availableCredit": "number",
    "interestRate": "number",
    "status": "active",
    "expirationDate": "ISO date"
  }
}
```

### Make Credit Card Payment

#### POST /credit-cards/:cardNumber/payment
Make a payment on a credit card

**Authentication:** Required

**Request Body:**
```json
{
  "amount": "number (required)"
}
```

### Charge Credit Card

#### POST /credit-cards/charge
Charge a credit card

**Authentication:** Required

**Request Body:**
```json
{
  "cardNumber": "string (required)",
  "amount": "number (required)",
  "merchantId": "string (required)",
  "description": "string (optional)"
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Authentication required or invalid token |
| `FORBIDDEN` | Access denied |
| `INVALID_REQUEST` | Request validation failed |
| `MISSING_FIELDS` | Required fields missing |
| `ACCOUNT_NOT_FOUND` | Account does not exist |
| `ACCOUNT_CLOSED` | Account is closed |
| `ACCOUNT_FROZEN` | Account is frozen |
| `INSUFFICIENT_FUNDS` | Not enough balance |
| `CREDIT_LIMIT_EXCEEDED` | Charge exceeds credit limit |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INVALID_AMOUNT` | Amount validation failed |
| `TRANSFER_FAILED` | Transfer could not be completed |
| `LOAN_APPLICATION_FAILED` | Loan application denied |
| `CREDIT_CARD_APPLICATION_FAILED` | Card application denied |

---

## Rate Limiting

- **Limit:** 100 requests per minute per IP address
- **Window:** 60 seconds
- **Response:** HTTP 429 with retry-after header

---

## Security Features

1. **JWT Authentication**: Secure token-based authentication
2. **Input Sanitization**: Prevents SQL injection and XSS attacks
3. **Rate Limiting**: Prevents API abuse
4. **Transaction Validation**: Amount limits and format checking
5. **Fraud Detection**: Automatic suspicious activity flagging
6. **Audit Logging**: Complete transaction trail
7. **Account Status Validation**: Prevents operations on invalid accounts

---

## Testing

Use the included test script:

```bash
./test-api.sh
```

Or use curl/Postman to test individual endpoints.

---

## Notes

- All account numbers are **alphanumeric** (e.g., `AB3D-EF7G-HJ9K`)
- Maximum transaction amount: $1,000,000
- Wire transfer fee: $25 (automatically deducted)
- ACH processing time: 1-3 business days
- JWT tokens expire after 24 hours
