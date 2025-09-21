# Bonus Payment Feature

## Overview
The bonus payment feature allows you to create additional payments for users that are separate from their regular project assignment payments. Bonus payments do not deduct from the remaining amount of project assignments.

## Backend Changes

### Model Changes
- Added `isBonus` field to `WalletTransaction` model
- Field type: `Boolean`
- Default value: `false`

### Service Changes
- Updated `createWalletTransaction` service to handle bonus payments
- Bonus payments bypass the project assignment remaining amount deduction
- Regular payments continue to deduct from project assignment remaining amounts
- Added `isBonus` filter support in `queryWalletTransactions` function

### Validation Changes
- Added `isBonus` field to `createWalletTransaction` validation schema
- Added `isBonus` field to `updateWalletTransaction` validation schema
- Added `isBonus` filter to `getWalletTransactions` query validation

### API Usage

#### Creating a Bonus Payment
```javascript
POST /v1/wallet-transactions
{
  "userId": "user_id_here",
  "type": "SITE_ENGINEER_PAYMENT",
  "amount": 1000,
  "description": "Bonus payment for excellent work",
  "currency": "INR",
  "isBonus": true
}
```

#### Creating a Regular Payment
```javascript
POST /v1/wallet-transactions
{
  "userId": "user_id_here",
  "type": "SITE_ENGINEER_PAYMENT",
  "amount": 1000,
  "description": "Regular project payment",
  "currency": "INR",
  "isBonus": false  // or omit this field (defaults to false)
}
```

## Frontend Changes

### UserPaymentsPage.columns.jsx
- Added bonus payment indicator in amount column
- Added bonus payment indicator in notes column
- Uses Gift icon to visually distinguish bonus payments

### UserPaymentsPage.jsx
- Updated transaction history display to show bonus payment indicators
- Bonus payments are clearly marked with a gift icon and "Bonus" label

### MakePaymentModal.jsx
- Added bonus payment toggle button with visual indicators
- Dynamic styling based on bonus payment mode
- Skip remaining amount validation for bonus payments
- Clear visual distinction between regular and bonus payment modes
- Updated submit button text and styling for bonus payments

## Visual Indicators

### In Amount Column
- Regular payments: `₹1,000`
- Bonus payments: `₹1,000` + `🎁 Bonus` badge

### In Notes Column
- Regular payments: Shows description only
- Bonus payments: Shows "🎁 Bonus Payment" label + description

### In Transaction History
- Regular payments: `Received: ₹1,000`
- Bonus payments: `Received: ₹1,000` + `🎁 Bonus` indicator

### In Make Payment Modal
- **Regular Mode**: Blue theme with "Make Payment" button
- **Bonus Mode**: Yellow theme with "Make Bonus Payment" button
- **Toggle Button**: Switch between regular and bonus payment modes
- **Visual Indicators**: Gift icons and yellow color scheme for bonus payments
- **Validation**: Bonus payments skip remaining amount validation

## Key Benefits

1. **Clear Distinction**: Bonus payments are visually distinct from regular payments
2. **No Impact on Project Budgets**: Bonus payments don't affect project assignment remaining amounts
3. **Same API**: Uses the existing `createWalletTransaction` endpoint
4. **Backward Compatible**: Existing payments continue to work without changes
5. **Easy Integration**: No changes needed in the PaymentsPage.jsx for the "Make Payment" option

## Testing

Run the bonus payment tests:
```bash
npm test -- tests/unit/models/walletTransaction.model.test.js
npm test -- tests/integration/walletTransaction.bonus.test.js
```

## Migration Notes

- Existing wallet transactions will have `isBonus: false` by default
- No database migration is required as the field has a default value
- All existing functionality remains unchanged
