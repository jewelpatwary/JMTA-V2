export interface CollectionMethod {
  id: number;
  name: string;
  type: 'MY' | 'BD';
  initial_balance?: number;
  initial_balance_date?: string;
  subItems: CollectionMethodSubItem[];
}

export interface CollectionMethodSubItem {
  id: number;
  name: string;
  initial_balance?: number;
  initial_balance_date?: string;
}

export interface User {
  id: number;
  username: string;
  password?: string;
  role: 'admin' | 'operator';
}

export interface MYAgent {
  id: number;
  name: string;
  default_mobile_rate: number;
  default_bank_rate: number;
  total_orders_myr: number;
  total_payments_myr: number;
  initial_balance?: number;
  initial_balance_date?: string;
  outstanding: number;
}

export interface BDAgent {
  id: number;
  name: string;
  total_orders_bdt: number;
  total_payments_bdt: number;
  initial_balance?: number;
  initial_balance_date?: string;
  outstanding: number;
}

export interface Order {
  id: number;
  my_agent_id: number;
  my_agent_name?: string;
  bd_agent_id: number;
  bd_agent_name?: string;
  type: 'bkash' | 'bank' | 'nagad';
  amount_bdt: number;
  rate: number;
  amount_myr: number;
  charge?: number;
  date: string;
  status: string;
  paid_amount?: number;
  remaining_balance?: number;
  remark?: string;
  firebase_id?: string;
}

export interface MYPayment {
  id: number;
  my_agent_id: number;
  amount_myr: number;
  payment_method: string;
  sub_method?: string;
  date: string;
  note?: string;
  order_ids?: number[];
  firebase_id?: string;
}

export interface BDPayment {
  id: number;
  bd_agent_id: number;
  amount_bdt: number;
  charge?: number;
  payment_method: string;
  sub_method?: string;
  date: string;
  note?: string;
  order_ids?: number[];
  firebase_id?: string;
}

export interface Conversion {
  id: number;
  amount_myr: number;
  rate: number;
  amount_bdt: number;
  bank_charges: number;
  date: string;
  note?: string;
  commission_enabled?: boolean;
  commission_amount?: number;
  total_bd_received?: number;
  pay_to_bd_agent_id?: number;
}

export interface Expense {
  id: number;
  amount_myr: number;
  currency?: 'MYR' | 'BDT';
  category: string;
  date: string;
  note?: string;
  order_id?: number;
  payment_id?: number;
}

export interface ProfitBreakdown {
  totalBdtOrder: number;
  totalRmOrder: number;
  avgConvertRate: number;
  totalConvertedRm: number;
  grossProfit: number;
  bankCharges: number;
  bankingTransactionChargesBdt?: number;
  bankingTransactionChargesRm?: number;
  bdtChargesRm?: number;
  generalExpensesRm?: number;
  expenses: number;
  netProfit: number;
  avgOrderRate?: number;
}

export interface RateHistory {
  id: number;
  mobileRate: number;
  bankRate: number;
  date: string;
}

export interface Withdrawal {
  id: number;
  agent_id: number;
  agent_type: 'MY' | 'BD';
  method_name: string;
  sub_method_name?: string;
  amount: number;
  date: string;
  note?: string;
}

export interface Deposit {
  id: number;
  agent_id: number;
  agent_type: 'MY' | 'BD';
  method_name: string;
  sub_method_name?: string;
  amount: number;
  date: string;
  note?: string;
}

export interface LoanEntity {
  id: number;
  name: string;
  created_at?: string;
  updated_at?: string;
  added_date?: string;
  modify_date?: string;
  firebase_id?: string;
}

export interface LoanTransaction {
  id: number;
  loanId: number;
  date: string;
  description: string;
  drAmount: string;
  crAmount: string;
  created_at?: string;
  updated_at?: string;
  added_date?: string;
  modify_date?: string;
  firebase_id?: string;
}

export interface CalculationRow {
  id: number;
  bdTk: string;
  rate: string;
  payment: string;
  lastDue: string;
  firebase_id?: string;
}
