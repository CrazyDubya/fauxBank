# fauxBank Quick Start Guide

## Installation

```bash
# Clone the repository
git clone https://github.com/CrazyDubya/fauxBank.git
cd fauxBank

# Install dependencies
npm install

# Start the server
npm start
```

The server will start on `http://localhost:3000`

## Example Usage

### 1. Register a Customer

```bash
curl -X POST http://localhost:3000/api/customers/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane.smith@example.com",
    "password": "SecurePassword123!",
    "phone": "555-0200",
    "dateOfBirth": "1985-05-15",
    "ssn": "987-65-4321",
    "address": {
      "street": "456 Oak Ave",
      "city": "Springfield",
      "state": "IL",
      "zip": "62701"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "customer": {
      "customerId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane.smith@example.com",
      "creditScore": 0,
      "kycStatus": "pending"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 2. Create a Checking Account

```bash
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "customerId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "accountType": "checking",
    "initialDeposit": 2500,
    "options": {
      "overdraftProtection": true,
      "overdraftLimit": 500
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accountNumber": "AB3D-EF7G-HJ9K",
    "accountType": "checking",
    "balance": 2500,
    "currency": "USD",
    "status": "active",
    "routingNumber": "ABC123",
    "overdraftProtection": true,
    "overdraftLimit": 500
  }
}
```

### 3. Perform a Credit Check

```bash
curl -X GET http://localhost:3000/api/customers/a1b2c3d4-e5f6-7890-abcd-ef1234567890/credit-check \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "customerId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "creditScore": 720,
    "rating": "Good",
    "timestamp": "2025-12-20T18:00:00.000Z"
  }
}
```

### 4. Apply for a Credit Card

```bash
curl -X POST http://localhost:3000/api/credit-cards/apply \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "customerId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "cardType": "visa",
    "requestedLimit": 10000
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cardNumber": "LM2N-PQ4R-ST6V-WX8Y",
    "cardType": "visa",
    "creditLimit": 10000,
    "availableCredit": 10000,
    "interestRate": 19.99,
    "status": "active",
    "expirationDate": "2028-12-20"
  }
}
```

### 5. Process an ACH Transfer

```bash
curl -X POST http://localhost:3000/api/transactions/ach \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "fromAccountNumber": "AB3D-EF7G-HJ9K",
    "toAccountNumber": "LM2N-PQ4R-ST6V",
    "amount": 1000,
    "description": "Rent payment"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "txn-abc123",
    "transactionType": "ach",
    "amount": 1000,
    "fromAccount": "AB3D-EF7G-HJ9K",
    "toAccount": "LM2N-PQ4R-ST6V",
    "status": "completed",
    "description": "Rent payment",
    "metadata": {
      "processingDays": 1
    }
  }
}
```

### 6. Apply for a Loan

```bash
curl -X POST http://localhost:3000/api/loans/apply \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "customerId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "loanType": "auto",
    "principal": 25000,
    "termMonths": 60,
    "interestRate": 4.5
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "loanNumber": "LOAN-XY2Z3ABC",
    "loanType": "auto",
    "principal": 25000,
    "interestRate": 4.5,
    "termMonths": 60,
    "monthlyPayment": 465.94,
    "currentBalance": 25000,
    "status": "active",
    "nextPaymentDate": "2026-01-20"
  }
}
```

## Account Number Examples

fauxBank uses **alphanumeric account numbers** to clearly differentiate from real banking systems:

| Type | Format | Example |
|------|--------|---------|
| Bank Account | XXXX-XXXX-XXXX | `AB3D-EF7G-HJ9K` |
| Credit Card | XXXX-XXXX-XXXX-XXXX | `LM2N-PQ4R-ST6V-WX8Y` |
| Loan | LOAN-XXXXXXXX | `LOAN-XY2Z3ABC` |
| CD | CD-XXXXXXXX | `CD-AB3DEF7G` |
| Investment | INV-XXXXXXXX | `INV-LM2NPQ4R` |
| Routing Number | XXXXXX | `ABC123` |

Characters used: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (excludes O, I, 0, 1 for clarity)

## Available Endpoints

### Customer Endpoints
- `POST /api/customers/register` - Register new customer
- `POST /api/customers/login` - Authenticate customer
- `GET /api/customers/:id/profile` - Get customer profile
- `PUT /api/customers/:id` - Update customer info

### Account Endpoints
- `POST /api/accounts` - Create new account
- `GET /api/accounts/:accountNumber` - Get account details
- `GET /api/customers/:id/accounts` - List customer accounts
- `POST /api/accounts/transfer` - Transfer funds
- `POST /api/accounts/:accountNumber/freeze` - Freeze account
- `POST /api/accounts/:accountNumber/close` - Close account

### Transaction Endpoints
- `POST /api/transactions/ach` - Process ACH transfer
- `POST /api/transactions/echeck` - Process eCheck
- `POST /api/transactions/wire` - Process wire transfer
- `GET /api/transactions/:id` - Get transaction details
- `GET /api/accounts/:accountNumber/transactions` - List account transactions

### Credit Endpoints
- `GET /api/customers/:id/credit-check` - Perform credit check
- `POST /api/loans/apply` - Apply for loan
- `POST /api/loans/:loanNumber/payment` - Make loan payment
- `POST /api/credit-cards/apply` - Apply for credit card
- `POST /api/credit-cards/:cardNumber/payment` - Make card payment
- `POST /api/credit-cards/charge` - Charge credit card

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: 100 requests per minute per IP
- **Input Sanitization**: Prevents injection attacks
- **Transaction Validation**: Amount limits and format checking
- **Fraud Detection**: Automatic suspicious activity flagging
- **Audit Logging**: Complete transaction trail
- **Account Status Validation**: Prevents operations on frozen/closed accounts

## Testing

Run the comprehensive test script:

```bash
./test-api.sh
```

This will demonstrate:
- ✓ Customer registration
- ✓ Account creation (checking & savings)
- ✓ Credit check
- ✓ Credit card application
- ✓ Fund transfers
- ✓ ACH transactions
- ✓ Loan application
- ✓ Alphanumeric account numbers

## Configuration

Copy `.env.example` to `.env` and customize:

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key-here
ALLOWED_ORIGINS=http://localhost:3000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

## Use Cases

- **Testing**: Test payment integrations without real money
- **Development**: Build and test banking features
- **Role-playing**: Simulate banking scenarios
- **Training**: Train staff on banking systems
- **Demonstrations**: Show banking functionality
- **Education**: Learn about banking APIs

## Support

For issues or questions, please open an issue on GitHub.
