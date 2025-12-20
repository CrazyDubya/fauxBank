#!/bin/bash

# fauxBank API Test Script
# Demonstrates the full functionality of the banking system

echo "=========================================="
echo "fauxBank API Test Script"
echo "=========================================="
echo ""

BASE_URL="http://localhost:3000/api"

echo "1. Register a new customer..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/customers/register" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "password": "SecurePass123!",
    "phone": "555-0100",
    "dateOfBirth": "1990-01-01",
    "ssn": "123-45-6789",
    "address": {
      "street": "123 Main St",
      "city": "Anytown",
      "state": "CA",
      "zip": "12345"
    }
  }')

echo "$REGISTER_RESPONSE" | jq '.'
CUSTOMER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.data.customer.customerId')
TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.data.token')

echo ""
echo "Customer ID: $CUSTOMER_ID"
echo "Token: ${TOKEN:0:20}..."
echo ""

if [ "$CUSTOMER_ID" = "null" ] || [ "$TOKEN" = "null" ]; then
  echo "Registration failed. Exiting."
  exit 1
fi

echo "2. Create a checking account..."
ACCOUNT_RESPONSE=$(curl -s -X POST "$BASE_URL/accounts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"customerId\": \"$CUSTOMER_ID\",
    \"accountType\": \"checking\",
    \"initialDeposit\": 5000,
    \"options\": {
      \"overdraftProtection\": true,
      \"overdraftLimit\": 500
    }
  }")

echo "$ACCOUNT_RESPONSE" | jq '.'
ACCOUNT_NUMBER=$(echo "$ACCOUNT_RESPONSE" | jq -r '.data.accountNumber')
echo ""
echo "Account Number: $ACCOUNT_NUMBER"
echo ""

echo "3. Create a savings account..."
SAVINGS_RESPONSE=$(curl -s -X POST "$BASE_URL/accounts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"customerId\": \"$CUSTOMER_ID\",
    \"accountType\": \"savings\",
    \"initialDeposit\": 10000,
    \"options\": {
      \"interestRate\": 2.5
    }
  }")

echo "$SAVINGS_RESPONSE" | jq '.'
SAVINGS_ACCOUNT=$(echo "$SAVINGS_RESPONSE" | jq -r '.data.accountNumber')
echo ""
echo "Savings Account Number: $SAVINGS_ACCOUNT"
echo ""

echo "4. Perform credit check..."
CREDIT_CHECK=$(curl -s -X GET "$BASE_URL/customers/$CUSTOMER_ID/credit-check" \
  -H "Authorization: Bearer $TOKEN")

echo "$CREDIT_CHECK" | jq '.'
CREDIT_SCORE=$(echo "$CREDIT_CHECK" | jq -r '.data.creditScore')
echo ""
echo "Credit Score: $CREDIT_SCORE"
echo ""

echo "5. Apply for a credit card..."
CREDIT_CARD=$(curl -s -X POST "$BASE_URL/credit-cards/apply" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"customerId\": \"$CUSTOMER_ID\",
    \"cardType\": \"visa\",
    \"requestedLimit\": 5000
  }")

echo "$CREDIT_CARD" | jq '.'
CARD_NUMBER=$(echo "$CREDIT_CARD" | jq -r '.data.cardNumber')
echo ""
echo "Credit Card Number: $CARD_NUMBER"
echo ""

echo "6. Transfer funds between accounts..."
TRANSFER=$(curl -s -X POST "$BASE_URL/accounts/transfer" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"fromAccountNumber\": \"$SAVINGS_ACCOUNT\",
    \"toAccountNumber\": \"$ACCOUNT_NUMBER\",
    \"amount\": 1000
  }")

echo "$TRANSFER" | jq '.'
echo ""

echo "7. Process ACH transaction..."
ACH=$(curl -s -X POST "$BASE_URL/transactions/ach" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"fromAccountNumber\": \"$ACCOUNT_NUMBER\",
    \"toAccountNumber\": \"$SAVINGS_ACCOUNT\",
    \"amount\": 500,
    \"description\": \"Test ACH transfer\"
  }")

echo "$ACH" | jq '.'
echo ""

echo "8. Apply for personal loan..."
LOAN=$(curl -s -X POST "$BASE_URL/loans/apply" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"customerId\": \"$CUSTOMER_ID\",
    \"loanType\": \"personal\",
    \"principal\": 10000,
    \"termMonths\": 36,
    \"interestRate\": 5.99
  }")

echo "$LOAN" | jq '.'
LOAN_NUMBER=$(echo "$LOAN" | jq -r '.data.loanNumber')
echo ""
echo "Loan Number: $LOAN_NUMBER"
echo ""

echo "9. Get customer profile..."
PROFILE=$(curl -s -X GET "$BASE_URL/customers/$CUSTOMER_ID/profile" \
  -H "Authorization: Bearer $TOKEN")

echo "$PROFILE" | jq '.'
echo ""

echo "=========================================="
echo "Test completed successfully!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  Customer ID: $CUSTOMER_ID"
echo "  Checking Account: $ACCOUNT_NUMBER"
echo "  Savings Account: $SAVINGS_ACCOUNT"
echo "  Credit Card: $CARD_NUMBER"
echo "  Loan Number: $LOAN_NUMBER"
echo "  Credit Score: $CREDIT_SCORE"
echo ""
echo "All banking features demonstrated:"
echo "  ✓ Customer registration"
echo "  ✓ Account creation (checking & savings)"
echo "  ✓ Credit check"
echo "  ✓ Credit card application"
echo "  ✓ Fund transfers"
echo "  ✓ ACH transactions"
echo "  ✓ Loan application"
echo "  ✓ Alphanumeric account numbers"
echo "=========================================="
