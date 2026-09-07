# Security Specification

## 1. Data Invariants
- All collections (`users`, `my_agents`, `bd_agents`, `orders`, `my_payments`, `bd_payments`, `conversions`, `expenses`, `withdrawals`, `deposits`, `rate_history`, `collection_methods`, `settings`, `loans`, `loan_transactions`, `calculations`) require the user to be authenticated.
- `admins` (if used) are privileged.
- Users can only read/write their own data where applicable (but the current app design seems to share data).
- For now, we will enforce `request.auth != null`.

## 2. The "Dirty Dozen" Payloads
*(Placeholder for actual payloads)*

## 3. The Test Runner
*(Placeholder for `firestore.rules.test.ts`)*
