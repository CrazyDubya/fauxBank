# fauxBank

A mock banking web & API layer providing full functionality of a bank with an agentic system backing it that has zero trust, first-in-class guardrails equivalent to current banking standards and requirements.

## Key Features

- **Full Banking Functionality**: Accounts, loans, credit cards, ACH, eChecks, debit cards, credit checks, investment accounts, CDs, and more
- **Alphanumeric Account Numbers**: Uses alpha characters instead of numeric to differentiate from actual banking systems
- **Zero-Trust Security**: Banking-standard security guardrails and validation
- **Agentic System**: Intelligent system for testing, roleplaying, and other uses
- **RESTful API**: Complete API for all banking operations

## Account Number Format

All account numbers use **alphanumeric characters** to clearly differentiate from real banking systems:

- **Bank Accounts**: `XXXX-XXXX-XXXX` (e.g., `AB3D-EF7G-HJ9K`)
- **Loan Accounts**: `LOAN-XXXXXXXX` (e.g., `LOAN-AB3DEF7G`)
- **Credit Cards**: `XXXX-XXXX-XXXX-XXXX` (e.g., `AB3D-EF7G-HJ9K-LM2N`)
- **Investment Accounts**: `INV-XXXXXXXX` (e.g., `INV-AB3DEF7G`)
- **CDs**: `CD-XXXXXXXX` (e.g., `CD-AB3DEF7G`)

Characters used: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (excludes ambiguous 0, O, I, 1)

## Banking Services

### Account Types
- **Checking Accounts**: Standard transaction accounts
- **Savings Accounts**: Interest-bearing savings with minimum balance
- **Money Market Accounts**: Higher interest rates

### Credit Services
- **Personal Loans**: Unsecured personal lending
- **Auto Loans**: Vehicle financing
- **Home Loans**: Mortgage products
- **Student Loans**: Education financing
- **Business Loans**: Commercial lending
- **Credit Cards**: Visa, Mastercard, Amex, Discover

### Transaction Types
- **ACH Transfers**: 1-3 business day transfers
- **eChecks**: Electronic check processing
- **Wire Transfers**: Same-day transfers (with fees)
- **Debit Card Transactions**: Point-of-sale payments

### Investment Products
- **Brokerage Accounts**: Buy/sell stocks and funds
- **IRA**: Traditional Individual Retirement Account
- **Roth IRA**: Tax-free retirement account
- **401(k)**: Employer-sponsored retirement
- **Certificates of Deposit (CDs)**: Fixed-term deposits with guaranteed returns

### Security Features
- **Credit Checks**: Simulated credit scoring (300-850)
- **Fraud Detection**: Transaction monitoring
- **Account Freezing**: Security holds
- **KYC Verification**: Know Your Customer compliance
- **Rate Limiting**: API abuse prevention
- **Input Sanitization**: Injection attack prevention
- **Audit Logging**: Complete transaction trail

## Installation

```bash
# Clone the repository
git clone https://github.com/CrazyDubya/fauxBank.git
cd fauxBank

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Start the server
npm start

# Or for development with auto-reload
npm run dev
```

## API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication

Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Endpoints

#### Customer Management

**Register Customer**
```http
POST /api/customers/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "phone": "555-0100",
  "dateOfBirth": "1990-01-01",
  "ssn": "123-45-6789",
  "address": {
    "street": "123 Main St",
    "city": "Anytown",
    "state": "CA",
    "zip": "12345"
  }
}
```

**Login**
```http
POST /api/customers/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Get Customer Profile**
```http
GET /api/customers/{customerId}/profile
Authorization: Bearer <token>
```

#### Account Management

**Create Account**
```http
POST /api/accounts
Authorization: Bearer <token>
Content-Type: application/json

{
  "customerId": "customer-uuid",
  "accountType": "checking",
  "initialDeposit": 1000,
  "options": {
    "overdraftProtection": true,
    "overdraftLimit": 500
  }
}
```

**Get Account**
```http
GET /api/accounts/{accountNumber}
Authorization: Bearer <token>
```

**Transfer Funds**
```http
POST /api/accounts/transfer
Authorization: Bearer <token>
Content-Type: application/json

{
  "fromAccountNumber": "AB3D-EF7G-HJ9K",
  "toAccountNumber": "LM2N-PQ4R-ST6V",
  "amount": 100.00
}
```

#### Transactions

**Process ACH Transfer**
```http
POST /api/transactions/ach
Authorization: Bearer <token>
Content-Type: application/json

{
  "fromAccountNumber": "AB3D-EF7G-HJ9K",
  "toAccountNumber": "LM2N-PQ4R-ST6V",
  "amount": 500.00,
  "description": "Payment for services"
}
```

**Process eCheck**
```http
POST /api/transactions/echeck
Authorization: Bearer <token>
Content-Type: application/json

{
  "fromAccountNumber": "AB3D-EF7G-HJ9K",
  "toAccountNumber": "LM2N-PQ4R-ST6V",
  "amount": 250.00,
  "checkNumber": "1001",
  "description": "Check payment"
}
```

**Process Wire Transfer**
```http
POST /api/transactions/wire
Authorization: Bearer <token>
Content-Type: application/json

{
  "fromAccountNumber": "AB3D-EF7G-HJ9K",
  "toAccountNumber": "LM2N-PQ4R-ST6V",
  "amount": 5000.00,
  "description": "Wire transfer"
}
```

#### Credit Services

**Perform Credit Check**
```http
GET /api/customers/{customerId}/credit-check
Authorization: Bearer <token>
```

**Apply for Loan**
```http
POST /api/loans/apply
Authorization: Bearer <token>
Content-Type: application/json

{
  "customerId": "customer-uuid",
  "loanType": "personal",
  "principal": 10000,
  "termMonths": 36,
  "interestRate": 5.99
}
```

**Apply for Credit Card**
```http
POST /api/credit-cards/apply
Authorization: Bearer <token>
Content-Type: application/json

{
  "customerId": "customer-uuid",
  "cardType": "visa",
  "requestedLimit": 5000
}
```

**Charge Credit Card**
```http
POST /api/credit-cards/charge
Authorization: Bearer <token>
Content-Type: application/json

{
  "cardNumber": "AB3D-EF7G-HJ9K-LM2N",
  "amount": 99.99,
  "merchantId": "MERCHANT-123",
  "description": "Purchase"
}
```

## Security Guardrails

fauxBank implements zero-trust security principles:

1. **Input Validation**: All inputs are validated and sanitized
2. **Rate Limiting**: 100 requests per minute per IP
3. **Authentication**: JWT-based authentication for protected endpoints
4. **Transaction Limits**: Maximum $1,000,000 per transaction
5. **Fraud Detection**: Automatic flagging of suspicious transactions
6. **Audit Logging**: All operations are logged for compliance
7. **Account Status Checks**: Prevents operations on frozen/closed accounts
8. **Sufficient Funds Validation**: Ensures adequate balance before transactions

## Use Cases

- **Testing**: Test payment integrations without real money
- **Development**: Build and test banking features
- **Role-playing**: Simulate banking scenarios
- **Training**: Train staff on banking systems
- **Demonstrations**: Show banking functionality to stakeholders
- **Education**: Learn about banking systems and APIs

## Project Structure

```
fauxBank/
├── src/
│   ├── controllers/        # API request handlers
│   ├── models/             # Data models
│   ├── routes/             # API routes
│   ├── services/           # Business logic
│   ├── middleware/         # Security and validation
│   ├── utils/              # Utilities (account number generation)
│   └── server.js           # Main server file
├── .env.example            # Environment template
├── .gitignore              # Git ignore rules
├── package.json            # Dependencies
└── README.md               # This file
```

## Technology Stack

- **Node.js**: Runtime environment
- **Express.js**: Web framework
- **JWT**: Authentication
- **bcryptjs**: Password hashing
- **In-memory storage**: Simplified data persistence

## Development

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Run in production mode
npm start
```

## Environment Variables

Create a `.env` file based on `.env.example`:

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key
ALLOWED_ORIGINS=http://localhost:3000
```

## License

ISC

## Contributing

This is a mock banking system for testing and development purposes only. Contributions are welcome!

## Disclaimer

⚠️ **This is a mock banking system for testing purposes only.** 
- Do not use for real financial transactions
- Account numbers are alphanumeric to differentiate from real banks
- No real money is involved
- No real personal information should be used
