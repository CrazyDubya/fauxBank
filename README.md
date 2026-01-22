# fauxBank

A mock banking web & API layer providing full functionality of a bank with an agentic system backing it that has zero trust, first-in-class guardrails equivalent to current banking standards and requirements.

## Overview

FauxBank provides a full-service simulated banking platform that serves as the economic backbone for testing agentic e-commerce systems. It offers manipulation-resistant, audit-complete banking services using obviously-fake alpha-character account identifiers.

## Key Features

- **Full Banking Functionality**: Accounts, loans, credit cards, ACH, eChecks, debit cards, credit checks, investment accounts, CDs, and more
- **Alphanumeric Account Numbers**: Uses alpha characters instead of numeric to differentiate from actual banking systems
- **Zero-Trust Security**: Banking-standard security guardrails and validation
- **Agentic System**: Intelligent system for testing, roleplaying, and other uses
- **RESTful API**: Complete API for all banking operations
- **Manipulation Resistance**: Security through structural impossibility
- **Double-Entry Ledger**: Every transaction debits one account and credits another
- **Agent-Based Access Control**: Registered agents with specific capabilities and rate limits
- **Compliance Simulation**: KYC, disputes, and regulatory workflows

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
- **Certificates of Deposit**: Fixed-term deposits
- **Loans**: Personal, auto, home, student, business
- **Credit Cards**: Visa, Mastercard, Amex, Discover
- **Merchant Accounts**: For commercial operations
- **Trust & Escrow Accounts**: Specialized account types

### Credit Services
- **Personal Loans**: Unsecured personal lending
- **Auto Loans**: Vehicle financing
- **Home Loans**: Mortgage products
- **Student Loans**: Education financing
- **Business Loans**: Commercial lending
- **Credit Cards**: Multiple card types with reward programs

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

## Deployment Options

### Traditional Node.js Server
```bash
npm start
```

### Cloudflare Workers (for edge deployment)
```bash
npm run dev:cloudflare  # Local development
npm run deploy          # Deploy to production
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

For detailed API documentation, see:
- [API Reference](API_REFERENCE.md) - Complete endpoint documentation
- [Quick Start Guide](QUICK_START.md) - Usage examples
- [Postman Collection](fauxBank.postman_collection.json) - Import-ready API collection

## Project Structure

```
fauxBank/
├── src/
│   ├── controllers/     # API request handlers
│   ├── models/          # Data models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── middleware/      # Security and validation
│   ├── utils/           # Utilities (account number generation)
│   └── server.js        # Main server file
├── frontend/            # Web UI (React + Vite)
├── docs/                # Documentation and screenshots
├── migrations/          # Database migrations
└── test-api.sh          # API testing script
```

## GUI Dashboard

FauxBank includes a comprehensive web dashboard for managing accounts, transactions, and compliance. See [GUI Documentation](docs/GUI_SHOWCASE.md) for screenshots and details.

## Development

```bash
# Run tests
npm test

# Type checking (if using TypeScript features)
npm run typecheck

# Database migrations (for Cloudflare D1)
npm run db:migrate
```

## Use Cases

- **Testing**: Test payment integrations without real money
- **Development**: Build and test banking features
- **Role-playing**: Simulate banking scenarios
- **Training**: Train staff on banking systems
- **Demonstrations**: Show banking functionality to stakeholders
- **Education**: Learn about banking systems and APIs
- **E-commerce Testing**: Test agentic commerce platforms

## Technology Stack

- **Backend**: Node.js + Express.js (traditional) or Hono + Cloudflare Workers (edge)
- **Frontend**: React + TypeScript + Vite
- **Storage**: In-memory (traditional) or Cloudflare D1 (edge deployment)
- **Authentication**: JWT
- **Security**: bcryptjs, rate limiting, input sanitization

## Security & Compliance

FauxBank implements banking-standard security measures:

- ✓ Zero-trust architecture
- ✓ JWT-based authentication
- ✓ Global rate limiting (100 req/min per IP)
- ✓ XSS prevention
- ✓ Transaction validation
- ✓ Fraud detection
- ✓ Comprehensive audit logging
- ✓ KYC workflows
- ✓ Dispute handling

## License

ISC

## Contributing

This is a mock banking system for testing and development purposes only.

## Disclaimer

⚠️ **This is a mock banking system for testing purposes only.**
- Do not use for real financial transactions
- Account numbers are alphanumeric to differentiate from real banks
- No real money is involved
- No real personal information should be used
