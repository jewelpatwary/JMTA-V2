import { create } from 'zustand';
import { saveAs } from 'file-saver';
import { MYAgent, BDAgent, Order, MYPayment, BDPayment, Conversion, Expense, User, CollectionMethod, Withdrawal, Deposit, RateHistory, LoanEntity, LoanTransaction, ProfitBreakdown } from '../types';
import { db, auth } from './firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  where,
  setDoc,
  getDoc,
  serverTimestamp,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './firebaseUtils';

// Local storage helpers
const load = (key: string) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const save = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Helper to calculate outstanding balances
const calculateOutstanding = (type: 'MY' | 'BD', agent: any, orders: any[], payments: any[], conversions: any[] = []) => {
  const initialBalance = Number(agent.initial_balance) || 0;
  const agentId = Number(agent.id);
  
  if (type === 'MY') {
    const totalOrders = orders.filter(o => Number(o.my_agent_id) === agentId).reduce((sum, o) => sum + Number(o.amount_myr), 0);
    const totalPayments = payments.filter(p => Number(p.my_agent_id) === agentId).reduce((sum, p) => sum + Number(p.amount_myr), 0);
    return initialBalance + totalPayments - totalOrders;
  } else {
    const totalOrders = orders.filter(o => Number(o.bd_agent_id) === agentId).reduce((sum, o) => sum + Number(o.amount_bdt), 0);
    const totalCharges = orders.filter(o => Number(o.bd_agent_id) === agentId).reduce((sum, o) => sum + (Number(o.charge) || 0), 0);
    const totalPayments = payments.filter(p => Number(p.bd_agent_id) === agentId).reduce((sum, p) => {
      const amt = Number(p.amount_bdt) || 0;
      const chg = Number(p.charge) || 0;
      return sum + amt - (amt < 0 ? chg : 0);
    }, 0);
    const totalConversions = conversions
      .filter(c => Boolean(c.pay_to_bd_agent_id) && Number(c.pay_to_bd_agent_id) === agentId)
      .reduce((sum, c) => {
        const bdt = Number(c.amount_bdt) || 0;
        const comm = c.commission_enabled ? (c.commission_amount ? Number(c.commission_amount) : bdt * 0.025) : 0;
        const total = Number(c.total_bd_received) || (bdt + comm);
        return sum + total;
      }, 0);
    
    return initialBalance + totalPayments + totalConversions - (totalOrders + totalCharges);
  }
};

// Centralized helper to get the exchange rate (BDT per RM) for a specific date
export const getExchangeRateForDate = (
  date: string,
  rateHistory: RateHistory[] = [],
  conversions: Conversion[] = [],
  orders: Order[] = [],
  defaultBankRate: number = 0,
  defaultMobileRate: number = 0
): number => {
  if (!date) return defaultBankRate || defaultMobileRate || 28;

  // 1. Check RateHistory for this exact date
  const hist = rateHistory.find(h => h.date === date);
  if (hist && (hist.bankRate > 0 || hist.mobileRate > 0)) {
    return hist.bankRate > 0 ? hist.bankRate : hist.mobileRate;
  }

  // 2. Check Conversions for this date
  const dateConversions = conversions.filter(c => c.date === date);
  if (dateConversions.length > 0) {
    const totalRm = dateConversions.reduce((sum, c) => sum + Number(c.amount_myr || 0), 0);
    const totalBdt = dateConversions.reduce((sum, c) => {
      const bdt = Number(c.amount_bdt) || 0;
      const comm = c.commission_enabled ? (c.commission_amount ? Number(c.commission_amount) : bdt * 0.025) : 0;
      return sum + (Number(c.total_bd_received) || (bdt + comm));
    }, 0);
    if (totalRm > 0 && totalBdt > 0) {
      return totalBdt / totalRm;
    }
    const singleRate = Number(dateConversions[0].rate);
    if (singleRate > 0) return singleRate;
  }

  // 3. Check Orders for this date
  const dateOrders = orders.filter(o => o.date === date && Number(o.rate) > 0);
  if (dateOrders.length > 0) {
    const totalBdt = dateOrders.reduce((sum, o) => sum + Number(o.amount_bdt || 0), 0);
    const totalRm = dateOrders.reduce((sum, o) => sum + Number(o.amount_myr || 0), 0);
    if (totalRm > 0 && totalBdt > 0) {
      return totalBdt / totalRm;
    }
    return Number(dateOrders[0].rate);
  }

  // 4. Check global conversions weighted average
  if (conversions.length > 0) {
    const totalRm = conversions.reduce((sum, c) => sum + Number(c.amount_myr || 0), 0);
    const totalBdt = conversions.reduce((sum, c) => {
      const bdt = Number(c.amount_bdt) || 0;
      const comm = c.commission_enabled ? (c.commission_amount ? Number(c.commission_amount) : bdt * 0.025) : 0;
      return sum + (Number(c.total_bd_received) || (bdt + comm));
    }, 0);
    if (totalRm > 0 && totalBdt > 0) {
      return totalBdt / totalRm;
    }
  }

  // 5. Check global orders average rate
  if (orders.length > 0) {
    const totalBdt = orders.reduce((sum, o) => sum + Number(o.amount_bdt || 0), 0);
    const totalRm = orders.reduce((sum, o) => sum + Number(o.amount_myr || 0), 0);
    if (totalRm > 0 && totalBdt > 0) {
      return totalBdt / totalRm;
    }
  }

  // 6. Defaults
  if (defaultBankRate > 0) return defaultBankRate;
  if (defaultMobileRate > 0) return defaultMobileRate;

  return 28;
};

// Initial Admin User
if (!localStorage.getItem('rf_users')) {
  save('rf_users', [{ id: 1, username: 'admin', password: 'admin123', role: 'admin' }]);
}

interface AppState {
  users: User[];
  myAgents: MYAgent[];
  bdAgents: BDAgent[];
  orders: Order[];
  collectionMethods: CollectionMethod[];
  myPayments: MYPayment[];
  bdPayments: BDPayment[];
  conversions: Conversion[];
  expenses: Expense[];
  withdrawals: Withdrawal[];
  deposits: Deposit[];
  loans: LoanEntity[];
  loanTransactions: LoanTransaction[];
  defaultMobileRate: number;
  defaultBankRate: number;
  rateHistory: RateHistory[];
  dateFormat: string;
  fontSize: string;
  fontStyle: string;
  stats: any;
  
  // Actions
  refresh: () => (() => void);
  setDefaultRates: (mobileRate: number, bankRate: number, date?: string) => void;
  updateRateHistoryItem: (id: number, mobileRate: number, bankRate: number) => Promise<void>;
  setDateFormat: (format: string) => void;
  setFontSize: (size: string) => void;
  setFontStyle: (style: string) => void;
}

let activeUnsubscribers: (() => void)[] = [];

export const useAppStore = create<AppState>((set, get) => ({
  users: load('rf_users'),
  myAgents: [],
  bdAgents: [],
  orders: [],
  collectionMethods: load('rf_collection_methods'),
  myPayments: load('rf_my_payments'),
  bdPayments: load('rf_bd_payments'),
  conversions: load('rf_conversions'),
  expenses: load('rf_expenses'),
  withdrawals: load('rf_withdrawals'),
  deposits: load('rf_deposits'),
  loans: [],
  loanTransactions: [],
  defaultMobileRate: Number(localStorage.getItem('rf_default_mobile_rate') || 0),
  defaultBankRate: Number(localStorage.getItem('rf_default_bank_rate') || 0),
  rateHistory: load('rf_rate_history'),
  dateFormat: localStorage.getItem('rf_date_format') || 'DD-MM-YYYY',
  fontSize: localStorage.getItem('rf_font_size') || localStorage.getItem('fontSize') || 'text-xs',
  fontStyle: localStorage.getItem('rf_font_style') || localStorage.getItem('fontStyle') || 'font-inter',
  stats: null,

  refresh: () => {
    // Clean up any existing listeners first to prevent duplicates/memory leaks
    if (activeUnsubscribers.length > 0) {
      activeUnsubscribers.forEach(unsub => {
        try {
          unsub();
        } catch (e) {
          console.error("Cleanup error", e);
        }
      });
      activeUnsubscribers = [];
    }

    const unsubscribers: (() => void)[] = [];

    // This internal refresh calculates stats based on current state
    const calculateAllStats = () => {
      const { 
        users, myAgents: myAgentsRaw, bdAgents: bdAgentsRaw, orders, 
        myPayments, bdPayments, conversions, expenses, 
        withdrawals, deposits, rateHistory, collectionMethods,
        defaultBankRate, defaultMobileRate
      } = useAppStore.getState();

      // Pre-compute maps to make lookups O(1) instead of O(N) inside the loop (total O(N) instead of O(N * M))
      const ordersByMyAgent = new Map<number, number>();
      const ordersByBdAgent = new Map<number, number>();
      const orderChargeByBdAgent = new Map<number, number>();
      
      const paymentsByMyAgent = new Map<number, number>();
      const paymentsByBdAgent = new Map<number, number>();
      
      const conversionsByBdAgent = new Map<number, number>();

      orders.forEach(o => {
        const myId = Number(o.my_agent_id);
        const bdId = Number(o.bd_agent_id);
        const amountMyr = Number(o.amount_myr) || 0;
        const amountBdt = Number(o.amount_bdt) || 0;
        const charge = Number(o.charge) || 0;

        if (myId) {
          ordersByMyAgent.set(myId, (ordersByMyAgent.get(myId) || 0) + amountMyr);
        }
        if (bdId) {
          ordersByBdAgent.set(bdId, (ordersByBdAgent.get(bdId) || 0) + amountBdt);
          orderChargeByBdAgent.set(bdId, (orderChargeByBdAgent.get(bdId) || 0) + charge);
        }
      });

      myPayments.forEach(p => {
        const myId = Number(p.my_agent_id);
        const amountMyr = Number(p.amount_myr) || 0;
        if (myId) {
          paymentsByMyAgent.set(myId, (paymentsByMyAgent.get(myId) || 0) + amountMyr);
        }
      });

      bdPayments.forEach(p => {
        const bdId = Number(p.bd_agent_id);
        const amountBdt = Number(p.amount_bdt) || 0;
        const chargeBdt = Number(p.charge) || 0;
        const netAmount = amountBdt < 0 ? amountBdt - chargeBdt : amountBdt;
        if (bdId) {
          paymentsByBdAgent.set(bdId, (paymentsByBdAgent.get(bdId) || 0) + netAmount);
        }
      });

      conversions.forEach(c => {
        const bdId = c.pay_to_bd_agent_id ? Number(c.pay_to_bd_agent_id) : 0;
        const bdt = Number(c.amount_bdt) || 0;
        const comm = c.commission_enabled ? (c.commission_amount ? Number(c.commission_amount) : bdt * 0.025) : 0;
        const amount = Number(c.total_bd_received) || (bdt + comm);
        if (bdId) {
          conversionsByBdAgent.set(bdId, (conversionsByBdAgent.get(bdId) || 0) + amount);
        }
      });

      const myAgents = myAgentsRaw.map(agent => {
        const agentId = Number(agent.id);
        const totalOrdersMyr = ordersByMyAgent.get(agentId) || 0;
        const totalPaymentsMyr = paymentsByMyAgent.get(agentId) || 0;
        const initialBalance = Number(agent.initial_balance) || 0;
        const outstanding = initialBalance + totalPaymentsMyr - totalOrdersMyr;

        return {
          ...agent,
          total_orders_myr: totalOrdersMyr,
          total_payments_myr: totalPaymentsMyr,
          initial_balance: initialBalance,
          outstanding: outstanding
        };
      }).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

      const bdAgents = bdAgentsRaw.map(agent => {
        const agentId = Number(agent.id);
        const totalOrdersBdt = ordersByBdAgent.get(agentId) || 0;
        const totalCharges = orderChargeByBdAgent.get(agentId) || 0;
        const totalPaymentsBdt = paymentsByBdAgent.get(agentId) || 0;
        const conversionTotal = conversionsByBdAgent.get(agentId) || 0;
        const initialBalance = Number(agent.initial_balance) || 0;
        const outstanding = initialBalance + totalPaymentsBdt + conversionTotal - (totalOrdersBdt + totalCharges);

        return {
          ...agent,
          total_orders_bdt: totalOrdersBdt,
          total_payments_bdt: totalPaymentsBdt + conversionTotal,
          initial_balance: initialBalance,
          outstanding: outstanding
        };
      }).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

      const today = new Date().toISOString().split('T')[0];
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterday = yesterdayDate.toISOString().split('T')[0];

      const totalBdtOrder = orders.reduce((sum, o) => sum + Number(o.amount_bdt), 0);
      const totalRmOrderActual = orders.reduce((sum, o) => sum + Number(o.amount_myr), 0);
      const totalBdtConverted = conversions.reduce((sum, c) => sum + Number(c.total_bd_received || c.amount_bdt), 0);
      const totalRmConverted = conversions.reduce((sum, c) => sum + Number(c.amount_myr), 0);
      const currentAvgConvertRate = totalRmConverted > 0 ? totalBdtConverted / totalRmConverted : 0;
      
      const avgConvertRate = currentAvgConvertRate > 0 ? currentAvgConvertRate : (totalRmConverted || 1);

      const todayOrders = orders.filter(o => o.date === today);
      const yesterdayOrders = orders.filter(o => o.date === yesterday);

      const totalConvertedRmCalculated = currentAvgConvertRate > 0 ? totalBdtOrder / currentAvgConvertRate : 0;
      const grossProfit = totalRmOrderActual - totalConvertedRmCalculated;
      const totalCharges = conversions.reduce((sum, c) => sum + Number(c.bank_charges), 0);
      
      // Separate direct MYR expenses and BDT expenses (e.g. banking transaction charges)
      const totalMyrExp = expenses.filter(e => e.currency !== 'BDT').reduce((sum, e) => sum + Number(e.amount_myr || 0), 0);
      
      let totalBankingChargesBdt = 0;
      let totalBankingChargesRm = 0;
      
      expenses.filter(e => e.currency === 'BDT').forEach(e => {
        const bdtAmt = Number(e.amount_myr || 0);
        const dayRate = getExchangeRateForDate(e.date, rateHistory, conversions, orders, defaultBankRate, defaultMobileRate);
        const rmVal = dayRate > 0 ? bdtAmt / dayRate : 0;
        totalBankingChargesBdt += bdtAmt;
        totalBankingChargesRm += rmVal;
      });

      // Total expenses in RM (direct MYR expenses + converted BDT charges/expenses)
      const totalExp = totalMyrExp + totalBankingChargesRm;
      const netProfit = grossProfit - totalCharges - totalExp;

      const getDailyStats = (dateOrders: Order[], dateExpenses: Expense[], dateConversions: Conversion[], dateStr: string) => {
        const volMyr = dateOrders.reduce((sum, o) => sum + Number(o.amount_myr), 0);
        const volBdt = dateOrders.reduce((sum, o) => sum + Number(o.amount_bdt), 0);
        
        const dayRate = getExchangeRateForDate(dateStr, rateHistory, conversions, orders, defaultBankRate, defaultMobileRate);
        const myrExp = dateExpenses.filter(e => e.currency !== 'BDT').reduce((sum, e) => sum + Number(e.amount_myr || 0), 0);
        const bdtExp = dateExpenses.filter(e => e.currency === 'BDT').reduce((sum, e) => {
          const bdtAmt = Number(e.amount_myr || 0);
          return sum + (dayRate > 0 ? bdtAmt / dayRate : 0);
        }, 0);
        const exp = myrExp + bdtExp;
        const charges = dateConversions.reduce((sum, c) => sum + Number(c.bank_charges), 0);
        const convertedRm = currentAvgConvertRate > 0 ? volBdt / currentAvgConvertRate : 0;
        return { count: dateOrders.length, volume: volMyr, profit: volMyr - convertedRm - exp - charges, expenses: exp };
      };

      const todayPerformance = getDailyStats(todayOrders, expenses.filter(e => e.date === today), conversions.filter(c => c.date === today), today);
      const yesterdayPerformance = getDailyStats(yesterdayOrders, expenses.filter(e => e.date === yesterday), conversions.filter(c => c.date === yesterday), yesterday);

      const calculateChange = (current: number, previous: number) => previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;

      const bdPaymentsByMethod = new Map<string, number>();
      bdPayments.forEach(p => {
        if (p.payment_method) {
          bdPaymentsByMethod.set(p.payment_method, (bdPaymentsByMethod.get(p.payment_method) || 0) + (Number(p.amount_bdt) || 0));
        }
      });

      const myPaymentsByMethod = new Map<string, number>();
      myPayments.forEach(p => {
        if (p.payment_method) {
          myPaymentsByMethod.set(p.payment_method, (myPaymentsByMethod.get(p.payment_method) || 0) + (Number(p.amount_myr) || 0));
        }
      });

      const depositsByMethodAndType = new Map<string, number>();
      deposits.forEach(d => {
        if (d.method_name) {
          const key = `${d.agent_type || 'MY'}_${d.method_name}`;
          depositsByMethodAndType.set(key, (depositsByMethodAndType.get(key) || 0) + (Number(d.amount) || 0));
        }
      });

      const withdrawalsByMethodAndType = new Map<string, number>();
      withdrawals.forEach(w => {
        if (w.method_name) {
          const key = `${w.agent_type || 'MY'}_${w.method_name}`;
          withdrawalsByMethodAndType.set(key, (withdrawalsByMethodAndType.get(key) || 0) + (Number(w.amount) || 0));
        }
      });

      const bankBalances = collectionMethods.map(m => {
        const totalInitialBalance = (Number(m.initial_balance) || 0) + m.subItems.reduce((sum, s) => sum + (Number(s.initial_balance) || 0), 0);
        if (m.type === 'BD') {
          const inAmount = bdPaymentsByMethod.get(m.name) || 0;
          const inAmountManual = depositsByMethodAndType.get(`BD_${m.name}`) || 0;
          const outAmount = withdrawalsByMethodAndType.get(`BD_${m.name}`) || 0;
          
          const matchingBdAgent = bdAgentsRaw.find(a => a.name === m.name);
          const orderCharges = matchingBdAgent ? (orderChargeByBdAgent.get(Number(matchingBdAgent.id)) || 0) : 0;
          
          return { name: m.name, type: 'BD', balance: totalInitialBalance + inAmount + inAmountManual - outAmount - orderCharges, currency: 'BDT' };
        }
        
        const inAmount = myPaymentsByMethod.get(m.name) || 0;
        const inAmountManual = depositsByMethodAndType.get(`MY_${m.name}`) || 0;
        const outAmount = withdrawalsByMethodAndType.get(`MY_${m.name}`) || 0;
        
        return { 
          name: m.name, type: 'MY', 
          balance: totalInitialBalance + inAmount + inAmountManual - outAmount,
          currency: 'MYR' 
        };
      }).filter(b => b.balance !== 0);

      const stats = {
        today: { count: todayOrders.length, total_myr: todayOrders.reduce((sum, o) => sum + Number(o.amount_myr), 0), total_bdt: todayOrders.reduce((sum, o) => sum + Number(o.amount_bdt), 0) },
        changes: { count: calculateChange(todayPerformance.count, yesterdayPerformance.count), volume: calculateChange(todayPerformance.volume, yesterdayPerformance.volume), profit: calculateChange(todayPerformance.profit, yesterdayPerformance.profit), expenses: calculateChange(todayPerformance.expenses, yesterdayPerformance.expenses) },
        netProfit, 
        profitBreakdown: { 
          totalBdtOrder, 
          totalRmOrder: totalRmOrderActual, 
          avgConvertRate: currentAvgConvertRate, 
          totalConvertedRm: totalConvertedRmCalculated, 
          grossProfit, 
          bankCharges: totalCharges, 
          bankingTransactionChargesBdt: totalBankingChargesBdt,
          bankingTransactionChargesRm: totalBankingChargesRm,
          bdtChargesRm: totalBankingChargesRm,
          generalExpensesRm: totalMyrExp,
          expenses: totalExp, 
          netProfit 
        },
        myAgentsOutstanding: { agents: myAgents.map(a => ({ name: a.name, outstanding: Number(a.outstanding.toFixed(2)) })).filter(a => a.outstanding !== 0), total: myAgents.reduce((sum, a) => sum + a.outstanding, 0) },
        bdAgentsOutstanding: { agents: bdAgents.map(a => ({ name: a.name, outstanding: Number(a.outstanding.toFixed(2)) })).filter(a => a.outstanding !== 0), total: bdAgents.reduce((sum, a) => sum + a.outstanding, 0) },
        bankBalances, expenses: { total_myr: totalExp },
        recentTransactions: orders.slice(0, 5).map(o => ({ ...o, my_agent_name: myAgents.find(a => a.id === o.my_agent_id)?.name || '-' }))
      };

      set({ myAgents, bdAgents, stats });
    };

    // Microtask batching/debouncing to compress multiple concurrent/sequential snapshot events into a single calculation tick
    let pendingCalc = false;
    const debouncedCalculateAllStats = () => {
      if (pendingCalc) return;
      pendingCalc = true;
      Promise.resolve().then(() => {
        calculateAllStats();
        pendingCalc = false;
      });
    };

    // Set up listeners for all collections
    const setupListener = (collectionName: string, stateKey: string) => {
      return onSnapshot(collection(db, collectionName), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), firebase_id: doc.id })) as any[];
        set({ [stateKey]: data } as any);
        debouncedCalculateAllStats();
      }, (error) => handleFirestoreError(error, OperationType.GET, collectionName));
    };

    // Custom listener for users to seed admin if empty
    unsubscribers.push(onSnapshot(collection(db, 'users'), (snapshot) => {
      if (snapshot.empty) {
        addDoc(collection(db, 'users'), { id: 1, username: 'admin', password: 'admin123', role: 'admin' });
      }
      const data = snapshot.docs.map(doc => ({ ...doc.data(), firebase_id: doc.id })) as any[];
      set({ users: data } as any);
      debouncedCalculateAllStats();
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users')));
    unsubscribers.push(setupListener('my_agents', 'myAgents'));
    unsubscribers.push(setupListener('bd_agents', 'bdAgents'));
    unsubscribers.push(setupListener('orders', 'orders'));
    unsubscribers.push(setupListener('my_payments', 'myPayments'));
    unsubscribers.push(setupListener('bd_payments', 'bdPayments'));
    unsubscribers.push(setupListener('conversions', 'conversions'));
    unsubscribers.push(setupListener('expenses', 'expenses'));
    unsubscribers.push(setupListener('withdrawals', 'withdrawals'));
    unsubscribers.push(setupListener('deposits', 'deposits'));
    unsubscribers.push(setupListener('collection_methods', 'collectionMethods'));
    unsubscribers.push(setupListener('rate_history', 'rateHistory'));
    unsubscribers.push(setupListener('loans', 'loans'));
    unsubscribers.push(setupListener('loan_transactions', 'loanTransactions'));

    // Listen to global settings
    unsubscribers.push(onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        set({ defaultMobileRate: data.defaultMobileRate, defaultBankRate: data.defaultBankRate });
      }
    }));

    activeUnsubscribers = unsubscribers;
    return () => {
      unsubscribers.forEach(unsub => {
        try {
          unsub();
        } catch (e) {
          // ignore
        }
      });
      activeUnsubscribers = [];
    };
  },

  setDefaultRates: async (mobileRate: number, bankRate: number, date?: string) => {
    const targetDate = date || new Date().toISOString().split('T')[0];
    try {
      await setDoc(doc(db, 'settings', 'global'), { defaultMobileRate: mobileRate, defaultBankRate: bankRate }, { merge: true });
      
      const historyCol = collection(db, 'rate_history');
      const q = query(historyCol, where('date', '==', targetDate));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        await updateDoc(doc(db, 'rate_history', snap.docs[0].id), { mobileRate, bankRate });
      } else {
        await addDoc(historyCol, { id: Date.now(), mobileRate, bankRate, date: targetDate });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'rate_history');
    }
  },

  updateRateHistoryItem: async (id: number, mobileRate: number, bankRate: number) => {
    try {
      const q = query(collection(db, 'rate_history'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(doc(db, 'rate_history', snap.docs[0].id), { mobileRate, bankRate });
        useAppStore.getState().refresh();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'rate_history');
    }
  },
  
  setDateFormat: (format: string) => {
    localStorage.setItem('rf_date_format', format);
    set(state => ({ ...state, dateFormat: format }));
  },

  setFontSize: (size: string) => {
    localStorage.setItem('rf_font_size', size);
    localStorage.setItem('fontSize', size);
    set(state => ({ ...state, fontSize: size }));
  },

  setFontStyle: (style: string) => {
    localStorage.setItem('rf_font_style', style);
    localStorage.setItem('fontStyle', style);
    set(state => ({ ...state, fontStyle: style }));
  },
}));

// Initialize store data
// useAppStore.getState().refresh();

export const store = {
  getUsers: () => useAppStore.getState().users,
  
  getMYAgents: () => useAppStore.getState().myAgents,

  addMYAgent: async (name: string, initial_balance: number, initial_balance_date?: string, default_mobile_rate: number = 0, default_bank_rate: number = 0) => {
    const newAgent = { 
      id: Date.now(), 
      name, 
      initial_balance: Number(initial_balance) || 0, 
      initial_balance_date: initial_balance_date || new Date().toISOString().split('T')[0],
      default_mobile_rate: Number(default_mobile_rate) || 0,
      default_bank_rate: Number(default_bank_rate) || 0
    };
    try {
      await addDoc(collection(db, 'my_agents'), newAgent);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'my_agents');
    }
    return newAgent;
  },

  updateMYAgent: async (id: number, data: any) => {
    try {
      const q = query(collection(db, 'my_agents'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(doc(db, 'my_agents', snap.docs[0].id), data);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'my_agents');
    }
  },

  deleteMYAgent: async (id: number) => {
    try {
      const q = query(collection(db, 'my_agents'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await deleteDoc(doc(db, 'my_agents', snap.docs[0].id));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'my_agents');
    }
  },

  getBDAgents: () => useAppStore.getState().bdAgents,

  addBDAgent: async (name: string, initial_balance: number, initial_balance_date?: string, phone: string = '') => {
    const newAgent = { 
      id: Date.now(), 
      name, 
      initial_balance: Number(initial_balance) || 0, 
      initial_balance_date: initial_balance_date || new Date().toISOString().split('T')[0],
      phone: phone || '' 
    };
    try {
      await addDoc(collection(db, 'bd_agents'), newAgent);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bd_agents');
    }
    return newAgent;
  },

  updateBDAgent: async (id: number, data: any) => {
    try {
      const q = query(collection(db, 'bd_agents'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(doc(db, 'bd_agents', snap.docs[0].id), data);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bd_agents');
    }
  },

  deleteBDAgent: async (id: number) => {
    try {
      const q = query(collection(db, 'bd_agents'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await deleteDoc(doc(db, 'bd_agents', snap.docs[0].id));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bd_agents');
    }
  },

  getOrders: () => {
    const { orders, myAgents, bdAgents } = useAppStore.getState();
    return orders.map(o => ({
      ...o,
      my_agent_name: myAgents.find(a => a.id === o.my_agent_id)?.name || 'Unknown',
      bd_agent_name: bdAgents.find(a => a.id === o.bd_agent_id)?.name || 'Unknown',
    })).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  },

  addOrder: async (data: any) => {
    const { myAgents, bdAgents } = useAppStore.getState();
    const my_agent_id = Number(data.my_agent_id);
    const bd_agent_id = Number(data.bd_agent_id);
    const my_agent_name = myAgents.find(a => a.id === my_agent_id)?.name || 'Unknown';
    const bd_agent_name = bdAgents.find(a => a.id === bd_agent_id)?.name || 'Unknown';
    const orderId = Date.now() + Math.floor(Math.random() * 1000);
    
    const newOrder = { 
      ...data, 
      id: orderId, 
      amount_bdt: Number(data.amount_bdt), 
      rate: Number(data.rate), 
      amount_myr: Number(data.amount_myr), 
      charge: data.charge !== undefined ? Number(data.charge) : 0,
      my_agent_id, 
      bd_agent_id,
      my_agent_name,
      bd_agent_name,
      paid_amount: 0
    };

    try {
      await addDoc(collection(db, 'orders'), newOrder);

      // Handle Charge as Expense in BDT
      if (newOrder.charge > 0) {
        const newExpense: Expense = {
          id: Date.now() + Math.floor(Math.random() * 1000) + 1,
          amount_myr: newOrder.charge,
          currency: 'BDT',
          category: 'Banking Transaction Charge',
          date: newOrder.date,
          note: `Banking transaction charge for order with ${bd_agent_name}`,
          order_id: orderId
        };
        await addDoc(collection(db, 'expenses'), newExpense);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'orders');
    }

    return newOrder;
  },

  updateOrder: async (id: number, data: any) => {
    const { orders, myAgents, bdAgents } = useAppStore.getState();
    const order = orders.find(o => o.id === id);
    if (!order) return;

    const my_agent_id = data.my_agent_id !== undefined ? Number(data.my_agent_id) : order.my_agent_id;
    const bd_agent_id = data.bd_agent_id !== undefined ? Number(data.bd_agent_id) : order.bd_agent_id;
    const my_agent_name = myAgents.find(a => a.id === my_agent_id)?.name || 'Unknown';
    const bd_agent_name = bdAgents.find(a => a.id === bd_agent_id)?.name || 'Unknown';

    const updatedOrder = { 
      ...order, 
      ...data, 
      amount_bdt: data.amount_bdt !== undefined ? Number(data.amount_bdt) : order.amount_bdt, 
      rate: data.rate !== undefined ? Number(data.rate) : order.rate, 
      amount_myr: data.amount_myr !== undefined ? Number(data.amount_myr) : order.amount_myr, 
      charge: data.charge !== undefined ? Number(data.charge) : (order.charge || 0),
      my_agent_id,
      bd_agent_id,
      my_agent_name,
      bd_agent_name
    };

    try {
      const q = query(collection(db, 'orders'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(doc(db, 'orders', snap.docs[0].id), updatedOrder);

        // Update Expense
        const expQ = query(collection(db, 'expenses'), where('order_id', '==', id));
        const expSnap = await getDocs(expQ);
        expSnap.forEach(async (d) => await deleteDoc(d.ref));

        if (updatedOrder.charge > 0) {
          const newExpense: Expense = {
            id: Date.now() + Math.floor(Math.random() * 1000) + 2,
            amount_myr: updatedOrder.charge,
            currency: 'BDT',
            category: 'Banking Transaction Charge',
            date: updatedOrder.date,
            note: `Banking transaction charge for order with ${bd_agent_name}`,
            order_id: id
          };
          await addDoc(collection(db, 'expenses'), newExpense);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'orders');
    }
  },

  deleteOrder: async (id: number) => {
    try {
      const q = query(collection(db, 'orders'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await deleteDoc(doc(db, 'orders', snap.docs[0].id));
        
        const expQ = query(collection(db, 'expenses'), where('order_id', '==', id));
        const expSnap = await getDocs(expQ);
        expSnap.forEach(async (d) => await deleteDoc(d.ref));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'orders');
    }
  },

  markOrdersAsPaid: async (orderIds: number[], type: 'MY' | 'BD') => {
    try {
      const { orders } = useAppStore.getState();
      const batch = writeBatch(db);
      
      const newOrders = [...orders];

      for (const id of orderIds) {
        const orderIndex = newOrders.findIndex(o => o.id === id);
        if (orderIndex !== -1) {
          const order = newOrders[orderIndex];
          const totalAmount = type === 'MY' ? (Number(order.amount_myr) || 0) : (Number(order.amount_bdt) || 0);
          const newStatus = 'paid';
          const newPaidAmount = totalAmount;
          const newRemainingBalance = 0;
          
          newOrders[orderIndex] = {
            ...order,
            status: newStatus,
            paid_amount: newPaidAmount,
            remaining_balance: newRemainingBalance
          };
          
          if (order.firebase_id) {
            batch.update(doc(db, 'orders', order.firebase_id), { status: newStatus, paid_amount: newPaidAmount, remaining_balance: newRemainingBalance });
          } else {
            const q = query(collection(db, 'orders'), where('id', '==', id));
            const snap = await getDocs(q);
            if (!snap.empty) {
              batch.update(doc(db, 'orders', snap.docs[0].id), { status: newStatus, paid_amount: newPaidAmount, remaining_balance: newRemainingBalance });
            }
          }
        }
      }
      
      useAppStore.setState({ orders: newOrders });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'orders');
    }
  },

  getCollectionMethods: () => useAppStore.getState().collectionMethods,
  addCollectionMethod: async (name: string, type: 'MY' | 'BD', initial_balance?: number, initial_balance_date?: string) => {
    const newMethod = { 
      id: Date.now(), 
      name, 
      type, 
      initial_balance: Number(initial_balance) || 0,
      initial_balance_date: initial_balance_date || new Date().toISOString().split('T')[0],
      subItems: [] 
    };
    try {
      await addDoc(collection(db, 'collection_methods'), newMethod);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'collection_methods');
    }
    return newMethod;
  },
  deleteCollectionMethod: async (id: number) => {
    try {
      const q = query(collection(db, 'collection_methods'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await deleteDoc(doc(db, 'collection_methods', snap.docs[0].id));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'collection_methods');
    }
  },
  updateCollectionMethod: async (id: number, data: any) => {
    try {
      const q = query(collection(db, 'collection_methods'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const method = snap.docs[0].data();
        const updated = { 
          ...method, 
          ...data,
          initial_balance: data.initial_balance !== undefined ? Number(data.initial_balance) : method.initial_balance,
          initial_balance_date: data.initial_balance_date || method.initial_balance_date
        };
        await updateDoc(doc(db, 'collection_methods', snap.docs[0].id), updated);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'collection_methods');
    }
  },
  addCollectionMethodSubItem: async (methodId: number, name: string, initial_balance?: number, initial_balance_date?: string) => {
    try {
      const q = query(collection(db, 'collection_methods'), where('id', '==', methodId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const method = snap.docs[0].data();
        method.subItems.push({ 
          id: Date.now(), 
          name,
          initial_balance: Number(initial_balance) || 0,
          initial_balance_date: initial_balance_date || new Date().toISOString().split('T')[0]
        });
        await updateDoc(doc(db, 'collection_methods', snap.docs[0].id), { subItems: method.subItems });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'collection_methods');
    }
  },
  deleteCollectionMethodSubItem: async (methodId: number, subItemId: number) => {
    try {
      const q = query(collection(db, 'collection_methods'), where('id', '==', methodId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const method = snap.docs[0].data();
        method.subItems = method.subItems.filter((s: any) => s.id !== subItemId);
        await updateDoc(doc(db, 'collection_methods', snap.docs[0].id), { subItems: method.subItems });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'collection_methods');
    }
  },
  updateCollectionMethodSubItem: async (methodId: number, subItemId: number, data: any) => {
    try {
      const q = query(collection(db, 'collection_methods'), where('id', '==', methodId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const method = snap.docs[0].data();
        method.subItems = method.subItems.map((s: any) => s.id === subItemId ? { 
          ...s, 
          ...data,
          initial_balance: data.initial_balance !== undefined ? Number(data.initial_balance) : s.initial_balance,
          initial_balance_date: data.initial_balance_date || s.initial_balance_date
        } : s);
        await updateDoc(doc(db, 'collection_methods', snap.docs[0].id), { subItems: method.subItems });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'collection_methods');
    }
  },

  getMYPayments: (agentId: number) => {
    const { myPayments } = useAppStore.getState();
    return myPayments
      .filter(p => p.my_agent_id === Number(agentId))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  },

  getAllMYPayments: () => useAppStore.getState().myPayments,

  addMYPayment: async (data: any) => {
    const newPayment = { 
      ...data, 
      id: Date.now() + Math.floor(Math.random() * 1000), 
      amount_myr: Number(data.amount_myr), 
      my_agent_id: Number(data.my_agent_id)
    };
    
    try {
      const batch = writeBatch(db);
      const newPaymentRef = doc(collection(db, 'my_payments'));
      
      if (data.order_ids?.length > 0) {
        const { orders } = useAppStore.getState();
        let remainingPayment = Number(data.amount_myr);
        const orderAllocations: Record<number, number> = {};

        for (const orderId of data.order_ids) {
          const order = orders.find(o => o.id === orderId);
          if (order) {
            const orderTotal = Number(order.amount_myr) || 0;
            const currentPaidAmount = Number(order.paid_amount) || 0;
            const currentRemaining = (order.remaining_balance !== undefined && order.remaining_balance >= 0)
              ? Number(order.remaining_balance)
              : Math.max(0, orderTotal - currentPaidAmount);

            const allocated = Math.min(Math.max(0, remainingPayment), currentRemaining);
            orderAllocations[orderId] = allocated;
            remainingPayment = Math.max(0, remainingPayment - allocated);

            const newPaidAmount = currentPaidAmount + allocated;
            const newRemainingBalance = Math.max(0, orderTotal - newPaidAmount);
            const newStatus = newRemainingBalance <= 0.001 ? 'paid' : (newPaidAmount > 0 ? 'partial' : 'unpaid');
            
            if (order.firebase_id) {
              batch.update(doc(db, 'orders', order.firebase_id), { status: newStatus, paid_amount: newPaidAmount, remaining_balance: newRemainingBalance });
            } else {
              const q = query(collection(db, 'orders'), where('id', '==', orderId));
              const snap = await getDocs(q);
              if (!snap.empty) {
                batch.update(doc(db, 'orders', snap.docs[0].id), { status: newStatus, paid_amount: newPaidAmount, remaining_balance: newRemainingBalance });
              }
            }
          }
        }
        newPayment.order_allocations = orderAllocations;
      }

      batch.set(newPaymentRef, newPayment);
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'my_payments');
    }
    return newPayment;
  },

  deleteMYPayment: async (id: number) => {
    try {
      const q = query(collection(db, 'my_payments'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const paymentDoc = snap.docs[0];
        const payment = paymentDoc.data();
        
        const batch = writeBatch(db);
        batch.delete(doc(db, 'my_payments', paymentDoc.id));
        
        if (payment.order_ids?.length > 0) {
          const { orders } = useAppStore.getState();
          const allocations = payment.order_allocations || {};
          const fallbackAmountPerOrder = Number(payment.amount_myr) / payment.order_ids.length;

          for (const orderId of payment.order_ids) {
            const order = orders.find(o => o.id === orderId);
            if (order) {
              const allocatedAmount = allocations[orderId] !== undefined ? Number(allocations[orderId]) : fallbackAmountPerOrder;
              const orderTotal = Number(order.amount_myr) || 0;
              const newPaidAmount = Math.max(0, (order.paid_amount || 0) - allocatedAmount);
              const newRemainingBalance = Math.max(0, orderTotal - newPaidAmount);
              const newStatus = newPaidAmount <= 0.001 ? 'unpaid' : (newRemainingBalance <= 0.001 ? 'paid' : 'partial');
              
              if (order.firebase_id) {
                batch.update(doc(db, 'orders', order.firebase_id), { status: newStatus, paid_amount: newPaidAmount, remaining_balance: newRemainingBalance });
              } else {
                const oq = query(collection(db, 'orders'), where('id', '==', orderId));
                const osnap = await getDocs(oq);
                if (!osnap.empty) {
                  batch.update(doc(db, 'orders', osnap.docs[0].id), { status: newStatus, paid_amount: newPaidAmount, remaining_balance: newRemainingBalance });
                }
              }
            }
          }
        }
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'my_payments');
    }
  },

  updateMYPayment: async (id: number, data: any) => {
    try {
      const q = query(collection(db, 'my_payments'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const paymentDoc = snap.docs[0];
        const existing = paymentDoc.data();
        const newAmount = data.amount_myr !== undefined ? Number(data.amount_myr) : Number(existing.amount_myr);
        const { orders } = useAppStore.getState();

        // If order_ids are involved, handle re-allocation
        if (data.order_ids !== undefined || (existing.order_ids && existing.order_ids.length > 0)) {
          const batch = writeBatch(db);
          const orderStateMap = new Map<number, any>();

          // Revert existing allocations
          if (existing.order_ids && existing.order_ids.length > 0) {
            const allocations = existing.order_allocations || {};
            const fallbackAmountPerOrder = Number(existing.amount_myr) / existing.order_ids.length;

            for (const orderId of existing.order_ids) {
              const order = orders.find(o => o.id === orderId);
              if (order) {
                const allocatedAmount = allocations[orderId] !== undefined ? Number(allocations[orderId]) : fallbackAmountPerOrder;
                const orderTotal = Number(order.amount_myr) || 0;
                const newPaidAmount = Math.max(0, (Number(order.paid_amount) || 0) - allocatedAmount);
                const newRemainingBalance = Math.max(0, orderTotal - newPaidAmount);
                const newStatus = newPaidAmount <= 0.001 ? 'unpaid' : (newRemainingBalance <= 0.001 ? 'paid' : 'partial');
                orderStateMap.set(orderId, {
                  order,
                  paid_amount: newPaidAmount,
                  remaining_balance: newRemainingBalance,
                  status: newStatus
                });
              }
            }
          }

          // Apply new allocations if target order_ids provided
          const targetOrderIds: number[] = data.order_ids !== undefined ? data.order_ids : (existing.order_ids || []);
          let remainingPayment = newAmount;
          const orderAllocations: Record<number, number> = {};

          for (const orderId of targetOrderIds) {
            let item = orderStateMap.get(orderId);
            if (!item) {
              const order = orders.find(o => o.id === orderId);
              if (order) {
                const curPaid = Number(order.paid_amount) || 0;
                const curTotal = Number(order.amount_myr) || 0;
                const curRem = (order.remaining_balance !== undefined && order.remaining_balance >= 0)
                  ? Number(order.remaining_balance)
                  : Math.max(0, curTotal - curPaid);
                item = {
                  order,
                  paid_amount: curPaid,
                  remaining_balance: curRem,
                  status: order.status || 'unpaid'
                };
                orderStateMap.set(orderId, item);
              }
            }

            if (item) {
              const orderTotal = Number(item.order.amount_myr) || 0;
              const currentPaidAmount = item.paid_amount;
              const currentRemaining = Math.max(0, orderTotal - currentPaidAmount);

              const allocated = Math.min(Math.max(0, remainingPayment), currentRemaining);
              orderAllocations[orderId] = allocated;
              remainingPayment = Math.max(0, remainingPayment - allocated);

              const newPaid = currentPaidAmount + allocated;
              const newRemaining = Math.max(0, orderTotal - newPaid);
              const newStatus = newRemaining <= 0.001 ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');

              item.paid_amount = newPaid;
              item.remaining_balance = newRemaining;
              item.status = newStatus;
            }
          }

          for (const [orderId, item] of orderStateMap.entries()) {
            if (item.order.firebase_id) {
              batch.update(doc(db, 'orders', item.order.firebase_id), {
                status: item.status,
                paid_amount: item.paid_amount,
                remaining_balance: item.remaining_balance
              });
            } else {
              const oq = query(collection(db, 'orders'), where('id', '==', orderId));
              const osnap = await getDocs(oq);
              if (!osnap.empty) {
                batch.update(doc(db, 'orders', osnap.docs[0].id), {
                  status: item.status,
                  paid_amount: item.paid_amount,
                  remaining_balance: item.remaining_balance
                });
              }
            }
          }

          const updated = { 
            ...existing, 
            ...data, 
            amount_myr: newAmount, 
            my_agent_id: data.my_agent_id !== undefined ? Number(data.my_agent_id) : existing.my_agent_id,
            order_ids: targetOrderIds,
            order_allocations: orderAllocations
          };
          batch.update(doc(db, 'my_payments', paymentDoc.id), updated);
          await batch.commit();

          const curPayments = useAppStore.getState().myPayments;
          const curOrders = useAppStore.getState().orders;
          useAppStore.setState({
            myPayments: curPayments.map(p => p.id === id ? { ...p, ...updated } : p),
            orders: curOrders.map(o => {
              const st = orderStateMap.get(o.id);
              return st ? { ...o, paid_amount: st.paid_amount, remaining_balance: st.remaining_balance, status: st.status } : o;
            })
          });
        } else {
          const updated = { 
            ...existing, 
            ...data, 
            amount_myr: newAmount, 
            my_agent_id: data.my_agent_id !== undefined ? Number(data.my_agent_id) : existing.my_agent_id 
          };
          await updateDoc(doc(db, 'my_payments', paymentDoc.id), updated);
          const curPayments = useAppStore.getState().myPayments;
          useAppStore.setState({
            myPayments: curPayments.map(p => p.id === id ? { ...p, ...updated } : p)
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'my_payments');
    }
  },

  getBDPayments: (agentId: number) => {
    const { bdPayments, conversions } = useAppStore.getState();
    
    const conversionPayments = conversions
      .filter(c => Boolean(c.pay_to_bd_agent_id) && Number(c.pay_to_bd_agent_id) === Number(agentId))
      .map(c => {
        const bdt = Number(c.amount_bdt) || 0;
        const comm = c.commission_enabled ? (c.commission_amount ? Number(c.commission_amount) : bdt * 0.025) : 0;
        const total = Number(c.total_bd_received) || (bdt + comm);
        return {
          id: c.id,
          bd_agent_id: Number(c.pay_to_bd_agent_id),
          amount_bdt: total,
          payment_method: 'Remittance',
          sub_method: '',
          date: c.date,
          note: c.commission_enabled ? 'Including 2.5% Commission' : '',
          is_conversion: true
        };
      });

    return [...bdPayments.filter(p => Number(p.bd_agent_id) === Number(agentId)), ...conversionPayments]
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  },

  getAllBDPayments: () => {
    const { bdPayments, conversions } = useAppStore.getState();
    const conversionPayments = conversions
      .filter(c => Boolean(c.pay_to_bd_agent_id))
      .map(c => {
        const bdt = Number(c.amount_bdt) || 0;
        const comm = c.commission_enabled ? (c.commission_amount ? Number(c.commission_amount) : bdt * 0.025) : 0;
        const total = Number(c.total_bd_received) || (bdt + comm);
        return {
          id: c.id,
          bd_agent_id: Number(c.pay_to_bd_agent_id),
          amount_bdt: total,
          payment_method: 'Remittance',
          sub_method: '',
          date: c.date,
          note: c.commission_enabled ? 'Including 2.5% Commission' : '',
          is_conversion: true
        };
      });
    return [...bdPayments, ...conversionPayments];
  },

  addBDPayment: async (data: any) => {
    const newPayment = { 
      ...data, 
      id: Date.now() + Math.floor(Math.random() * 1000), 
      amount_bdt: Number(data.amount_bdt), 
      charge: data.charge !== undefined ? Number(data.charge) : 0,
      bd_agent_id: Number(data.bd_agent_id)
    };
    
    try {
      const batch = writeBatch(db);
      const newPaymentRef = doc(collection(db, 'bd_payments'));
      
      if (data.order_ids?.length > 0) {
        const { orders } = useAppStore.getState();
        let remainingPayment = Number(data.amount_bdt);
        const orderAllocations: Record<number, number> = {};

        for (const orderId of data.order_ids) {
          const order = orders.find(o => o.id === orderId);
          if (order) {
            const orderTotal = Number(order.amount_bdt) || 0;
            const currentPaidAmount = Number(order.paid_amount) || 0;
            const currentRemaining = (order.remaining_balance !== undefined && order.remaining_balance >= 0)
              ? Number(order.remaining_balance)
              : Math.max(0, orderTotal - currentPaidAmount);

            const allocated = Math.min(Math.max(0, remainingPayment), currentRemaining);
            orderAllocations[orderId] = allocated;
            remainingPayment = Math.max(0, remainingPayment - allocated);

            const newPaidAmount = currentPaidAmount + allocated;
            const newRemainingBalance = Math.max(0, orderTotal - newPaidAmount);
            const newStatus = newRemainingBalance <= 0.001 ? 'paid' : (newPaidAmount > 0 ? 'partial' : 'unpaid');
            
            if (order.firebase_id) {
              batch.update(doc(db, 'orders', order.firebase_id), { status: newStatus, paid_amount: newPaidAmount, remaining_balance: newRemainingBalance });
            } else {
              const q = query(collection(db, 'orders'), where('id', '==', orderId));
              const snap = await getDocs(q);
              if (!snap.empty) {
                batch.update(doc(db, 'orders', snap.docs[0].id), { status: newStatus, paid_amount: newPaidAmount, remaining_balance: newRemainingBalance });
              }
            }
          }
        }
        newPayment.order_allocations = orderAllocations;
      }

      batch.set(newPaymentRef, newPayment);
      await batch.commit();

      if (Number(newPayment.charge) > 0) {
        const { bdAgents } = useAppStore.getState();
        const agentName = bdAgents.find(a => a.id === Number(newPayment.bd_agent_id))?.name || 'BD Agent';
        const newExpense: Expense = {
          id: Date.now() + Math.floor(Math.random() * 1000) + 1,
          amount_myr: Number(newPayment.charge),
          currency: 'BDT',
          category: 'Banking Transaction Charge',
          date: newPayment.date,
          note: `Banking transaction charge for payment to ${agentName}`,
          payment_id: newPayment.id
        };
        await addDoc(collection(db, 'expenses'), newExpense);
      }

      const curPayments = useAppStore.getState().bdPayments;
      useAppStore.setState({
        bdPayments: [newPayment, ...curPayments.filter(p => p.id !== newPayment.id)]
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bd_payments');
    }
    return newPayment;
  },

  deleteBDPayment: async (id: number) => {
    try {
      const q = query(collection(db, 'bd_payments'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const paymentDoc = snap.docs[0];
        const payment = paymentDoc.data();
        
        const batch = writeBatch(db);
        batch.delete(doc(db, 'bd_payments', paymentDoc.id));
        
        if (payment.order_ids?.length > 0) {
          const { orders } = useAppStore.getState();
          const allocations = payment.order_allocations || {};
          const fallbackAmountPerOrder = Number(payment.amount_bdt) / payment.order_ids.length;

          for (const orderId of payment.order_ids) {
            const order = orders.find(o => o.id === orderId);
            if (order) {
              const allocatedAmount = allocations[orderId] !== undefined ? Number(allocations[orderId]) : fallbackAmountPerOrder;
              const orderTotal = Number(order.amount_bdt) || 0;
              const newPaidAmount = Math.max(0, (order.paid_amount || 0) - allocatedAmount);
              const newRemainingBalance = Math.max(0, orderTotal - newPaidAmount);
              const newStatus = newPaidAmount <= 0.001 ? 'unpaid' : (newRemainingBalance <= 0.001 ? 'paid' : 'partial');
              
              if (order.firebase_id) {
                batch.update(doc(db, 'orders', order.firebase_id), { status: newStatus, paid_amount: newPaidAmount, remaining_balance: newRemainingBalance });
              } else {
                const oq = query(collection(db, 'orders'), where('id', '==', orderId));
                const osnap = await getDocs(oq);
                if (!osnap.empty) {
                  batch.update(doc(db, 'orders', osnap.docs[0].id), { status: newStatus, paid_amount: newPaidAmount, remaining_balance: newRemainingBalance });
                }
              }
            }
          }
        }
        await batch.commit();

        try {
          const expQ = query(collection(db, 'expenses'), where('payment_id', '==', id));
          const expSnap = await getDocs(expQ);
          for (const d of expSnap.docs) {
            await deleteDoc(d.ref);
          }
        } catch (expErr) {
          console.error('Error cleaning up expense for payment:', expErr);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bd_payments');
    }
  },

  updateBDPayment: async (id: number, data: any) => {
    try {
      const q = query(collection(db, 'bd_payments'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const paymentDoc = snap.docs[0];
        const existing = paymentDoc.data();
        const newAmount = data.amount_bdt !== undefined ? Number(data.amount_bdt) : Number(existing.amount_bdt);
        const newCharge = data.charge !== undefined ? Number(data.charge) : (existing.charge !== undefined ? Number(existing.charge) : 0);
        const { orders } = useAppStore.getState();

        // If order_ids are involved, handle re-allocation
        if (data.order_ids !== undefined || (existing.order_ids && existing.order_ids.length > 0)) {
          const batch = writeBatch(db);
          const orderStateMap = new Map<number, any>();

          // Revert existing allocations
          if (existing.order_ids && existing.order_ids.length > 0) {
            const allocations = existing.order_allocations || {};
            const fallbackAmountPerOrder = Number(existing.amount_bdt) / existing.order_ids.length;

            for (const orderId of existing.order_ids) {
              const order = orders.find(o => o.id === orderId);
              if (order) {
                const allocatedAmount = allocations[orderId] !== undefined ? Number(allocations[orderId]) : fallbackAmountPerOrder;
                const orderTotal = Number(order.amount_bdt) || 0;
                const newPaidAmount = Math.max(0, (Number(order.paid_amount) || 0) - allocatedAmount);
                const newRemainingBalance = Math.max(0, orderTotal - newPaidAmount);
                const newStatus = newPaidAmount <= 0.001 ? 'unpaid' : (newRemainingBalance <= 0.001 ? 'paid' : 'partial');
                orderStateMap.set(orderId, {
                  order,
                  paid_amount: newPaidAmount,
                  remaining_balance: newRemainingBalance,
                  status: newStatus
                });
              }
            }
          }

          // Apply new allocations if target order_ids provided
          const targetOrderIds: number[] = data.order_ids !== undefined ? data.order_ids : (existing.order_ids || []);
          let remainingPayment = newAmount;
          const orderAllocations: Record<number, number> = {};

          for (const orderId of targetOrderIds) {
            let item = orderStateMap.get(orderId);
            if (!item) {
              const order = orders.find(o => o.id === orderId);
              if (order) {
                const curPaid = Number(order.paid_amount) || 0;
                const curTotal = Number(order.amount_bdt) || 0;
                const curRem = (order.remaining_balance !== undefined && order.remaining_balance >= 0)
                  ? Number(order.remaining_balance)
                  : Math.max(0, curTotal - curPaid);
                item = {
                  order,
                  paid_amount: curPaid,
                  remaining_balance: curRem,
                  status: order.status || 'unpaid'
                };
                orderStateMap.set(orderId, item);
              }
            }

            if (item) {
              const orderTotal = Number(item.order.amount_bdt) || 0;
              const currentPaidAmount = item.paid_amount;
              const currentRemaining = Math.max(0, orderTotal - currentPaidAmount);

              const allocated = Math.min(Math.max(0, remainingPayment), currentRemaining);
              orderAllocations[orderId] = allocated;
              remainingPayment = Math.max(0, remainingPayment - allocated);

              const newPaid = currentPaidAmount + allocated;
              const newRemaining = Math.max(0, orderTotal - newPaid);
              const newStatus = newRemaining <= 0.001 ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid');

              item.paid_amount = newPaid;
              item.remaining_balance = newRemaining;
              item.status = newStatus;
            }
          }

          for (const [orderId, item] of orderStateMap.entries()) {
            if (item.order.firebase_id) {
              batch.update(doc(db, 'orders', item.order.firebase_id), {
                status: item.status,
                paid_amount: item.paid_amount,
                remaining_balance: item.remaining_balance
              });
            } else {
              const oq = query(collection(db, 'orders'), where('id', '==', orderId));
              const osnap = await getDocs(oq);
              if (!osnap.empty) {
                batch.update(doc(db, 'orders', osnap.docs[0].id), {
                  status: item.status,
                  paid_amount: item.paid_amount,
                  remaining_balance: item.remaining_balance
                });
              }
            }
          }

          const updated = { 
            ...existing, 
            ...data, 
            amount_bdt: newAmount, 
            charge: newCharge,
            bd_agent_id: data.bd_agent_id !== undefined ? Number(data.bd_agent_id) : existing.bd_agent_id,
            order_ids: targetOrderIds,
            order_allocations: orderAllocations
          };
          batch.update(doc(db, 'bd_payments', paymentDoc.id), updated);
          await batch.commit();

          const curPayments = useAppStore.getState().bdPayments;
          const curOrders = useAppStore.getState().orders;
          useAppStore.setState({
            bdPayments: curPayments.map(p => p.id === id ? { ...p, ...updated } : p),
            orders: curOrders.map(o => {
              const st = orderStateMap.get(o.id);
              return st ? { ...o, paid_amount: st.paid_amount, remaining_balance: st.remaining_balance, status: st.status } : o;
            })
          });
        } else {
          const updated = { 
            ...existing, 
            ...data, 
            amount_bdt: newAmount, 
            charge: newCharge,
            bd_agent_id: data.bd_agent_id !== undefined ? Number(data.bd_agent_id) : existing.bd_agent_id 
          };
          await updateDoc(doc(db, 'bd_payments', paymentDoc.id), updated);
          const curPayments = useAppStore.getState().bdPayments;
          useAppStore.setState({
            bdPayments: curPayments.map(p => p.id === id ? { ...p, ...updated } : p)
          });
        }

        try {
          const expQ = query(collection(db, 'expenses'), where('payment_id', '==', id));
          const expSnap = await getDocs(expQ);
          for (const d of expSnap.docs) {
            await deleteDoc(d.ref);
          }

          if (Number(newCharge) > 0) {
            const { bdAgents } = useAppStore.getState();
            const targetAgentId = data.bd_agent_id !== undefined ? Number(data.bd_agent_id) : Number(existing.bd_agent_id);
            const agentName = bdAgents.find(a => a.id === targetAgentId)?.name || 'BD Agent';
            const newExpense: Expense = {
              id: Date.now() + Math.floor(Math.random() * 1000) + 2,
              amount_myr: Number(newCharge),
              currency: 'BDT',
              category: 'Banking Transaction Charge',
              date: data.date || existing.date,
              note: `Banking transaction charge for payment to ${agentName}`,
              payment_id: id
            };
            await addDoc(collection(db, 'expenses'), newExpense);
          }
        } catch (expErr) {
          console.error('Error updating expense for payment:', expErr);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bd_payments');
    }
  },

  addConversion: async (data: any) => {
    const amount_myr = Number(data.amount_myr) || 0;
    const rate = Number(data.rate) || 0;
    const amount_bdt = data.amount_bdt !== undefined && data.amount_bdt !== '' 
      ? Number(data.amount_bdt) 
      : (amount_myr * rate);
    const commission_enabled = Boolean(data.commission_enabled);
    const commission_amount = commission_enabled ? amount_bdt * 0.025 : 0;
    const total_bd_received = amount_bdt + commission_amount;
    const bank_charges = Number(data.bank_charges) || 0;
    const pay_to_bd_agent_id = data.pay_to_bd_agent_id ? Number(data.pay_to_bd_agent_id) : null;
    
    const newItem: Conversion = { 
      id: Date.now() + Math.floor(Math.random() * 1000), 
      date: data.date || new Date().toISOString().split('T')[0],
      amount_myr, 
      rate, 
      amount_bdt, 
      bank_charges,
      commission_enabled,
      commission_amount,
      total_bd_received,
      pay_to_bd_agent_id: pay_to_bd_agent_id || undefined
    };

    // Optimistically update local Zustand store
    const current = useAppStore.getState().conversions;
    useAppStore.setState({ conversions: [newItem, ...current] });

    try {
      const docData: any = { ...newItem, pay_to_bd_agent_id: pay_to_bd_agent_id ?? null };
      await addDoc(collection(db, 'conversions'), docData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'conversions');
    }
    return newItem;
  },

  updateConversion: async (id: number, data: any) => {
    const numericId = Number(id);
    try {
      const current = useAppStore.getState().conversions;
      const existingInStore = current.find(c => Number(c.id) === numericId);

      const amount_myr = data.amount_myr !== undefined ? Number(data.amount_myr) : Number(existingInStore?.amount_myr || 0);
      const rate = data.rate !== undefined ? Number(data.rate) : Number(existingInStore?.rate || 0);
      const amount_bdt = data.amount_bdt !== undefined && data.amount_bdt !== '' 
        ? Number(data.amount_bdt) 
        : (data.amount_myr !== undefined || data.rate !== undefined ? amount_myr * rate : Number(existingInStore?.amount_bdt || 0));
      
      const commission_enabled = data.commission_enabled !== undefined 
        ? Boolean(data.commission_enabled) 
        : Boolean(existingInStore?.commission_enabled);
      const commission_amount = commission_enabled ? amount_bdt * 0.025 : 0;
      const total_bd_received = amount_bdt + commission_amount;
      const bank_charges = data.bank_charges !== undefined ? Number(data.bank_charges) : Number(existingInStore?.bank_charges || 0);
      
      let pay_to_bd_agent_id: number | null = null;
      if (data.pay_to_bd_agent_id !== undefined) {
        pay_to_bd_agent_id = data.pay_to_bd_agent_id ? Number(data.pay_to_bd_agent_id) : null;
      } else if (existingInStore?.pay_to_bd_agent_id) {
        pay_to_bd_agent_id = Number(existingInStore.pay_to_bd_agent_id);
      }

      const date = data.date !== undefined ? data.date : (existingInStore?.date || new Date().toISOString().split('T')[0]);

      const updatedObj: Conversion = {
        id: numericId,
        date,
        amount_myr,
        rate,
        amount_bdt,
        bank_charges,
        commission_enabled,
        commission_amount,
        total_bd_received,
        pay_to_bd_agent_id: pay_to_bd_agent_id || undefined
      };

      // Optimistically update local store immediately so all views update instantaneously
      useAppStore.setState({
        conversions: current.map(c => Number(c.id) === numericId ? { ...c, ...updatedObj } : c)
      });

      const q = query(collection(db, 'conversions'), where('id', '==', numericId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docRef = doc(db, 'conversions', snap.docs[0].id);
        const docData: any = {
          id: numericId,
          date,
          amount_myr,
          rate,
          amount_bdt,
          bank_charges,
          commission_enabled,
          commission_amount,
          total_bd_received,
          pay_to_bd_agent_id: pay_to_bd_agent_id ?? null
        };
        await updateDoc(docRef, docData);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'conversions');
    }
  },

  deleteConversion: async (id: number) => {
    const numericId = Number(id);
    try {
      const current = useAppStore.getState().conversions;
      useAppStore.setState({
        conversions: current.filter(c => Number(c.id) !== numericId)
      });

      const q = query(collection(db, 'conversions'), where('id', '==', numericId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await deleteDoc(doc(db, 'conversions', snap.docs[0].id));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'conversions');
    }
  },

  getExpenses: () => useAppStore.getState().expenses,
  addExpense: async (data: any) => {
    const newItem = { ...data, id: Date.now() + Math.floor(Math.random() * 1000), amount_myr: Number(data.amount_myr) };
    try {
      await addDoc(collection(db, 'expenses'), newItem);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'expenses');
    }
    return newItem;
  },

  updateExpense: async (id: number, data: any) => {
    try {
      const q = query(collection(db, 'expenses'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const existing = snap.docs[0].data();
        const updated = { 
          ...existing, 
          ...data, 
          amount_myr: data.amount_myr !== undefined ? Number(data.amount_myr) : existing.amount_myr 
        };
        await updateDoc(doc(db, 'expenses', snap.docs[0].id), updated);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'expenses');
    }
  },

  deleteExpense: async (id: number) => {
    try {
      const q = query(collection(db, 'expenses'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await deleteDoc(doc(db, 'expenses', snap.docs[0].id));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'expenses');
    }
  },

  getWithdrawals: () => useAppStore.getState().withdrawals,
  addWithdrawal: async (data: any) => {
    const newItem = { 
      ...data, 
      id: Date.now() + Math.floor(Math.random() * 1000), 
      amount: Number(data.amount),
      agent_id: Number(data.agent_id)
    };
    try {
      await addDoc(collection(db, 'withdrawals'), newItem);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'withdrawals');
    }
    return newItem;
  },
  updateWithdrawal: async (id: number, data: any) => {
    try {
      const q = query(collection(db, 'withdrawals'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const existing = snap.docs[0].data();
        const updated = { 
          ...existing, 
          ...data, 
          amount: data.amount !== undefined ? Number(data.amount) : existing.amount,
          agent_id: data.agent_id !== undefined ? Number(data.agent_id) : existing.agent_id
        };
        await updateDoc(doc(db, 'withdrawals', snap.docs[0].id), updated);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'withdrawals');
    }
  },
  deleteWithdrawal: async (id: number) => {
    try {
      const q = query(collection(db, 'withdrawals'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await deleteDoc(doc(db, 'withdrawals', snap.docs[0].id));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'withdrawals');
    }
  },
  
  getDeposits: () => useAppStore.getState().deposits,
  addDeposit: async (data: any) => {
    const newItem = { 
      ...data, 
      id: Date.now() + Math.floor(Math.random() * 1000), 
      amount: Number(data.amount),
      agent_id: Number(data.agent_id)
    };
    try {
      await addDoc(collection(db, 'deposits'), newItem);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'deposits');
    }
    return newItem;
  },
  updateDeposit: async (id: number, data: any) => {
    try {
      const q = query(collection(db, 'deposits'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const existing = snap.docs[0].data();
        const updated = { 
          ...existing, 
          ...data, 
          amount: data.amount !== undefined ? Number(data.amount) : existing.amount,
          agent_id: data.agent_id !== undefined ? Number(data.agent_id) : existing.agent_id
        };
        await updateDoc(doc(db, 'deposits', snap.docs[0].id), updated);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'deposits');
    }
  },
  deleteDeposit: async (id: number) => {
    try {
      const q = query(collection(db, 'deposits'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await deleteDoc(doc(db, 'deposits', snap.docs[0].id));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'deposits');
    }
  },

  getLoans: () => useAppStore.getState().loans,
  addLoan: async (name: string) => {
    const newItem = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name
    };
    try {
      await addDoc(collection(db, 'loans'), newItem);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'loans');
    }
    return newItem;
  },
  deleteLoan: async (id: number) => {
    try {
      const q = query(collection(db, 'loans'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await deleteDoc(doc(db, 'loans', snap.docs[0].id));
      }
      
      const qTx = query(collection(db, 'loan_transactions'), where('loanId', '==', id));
      const snapTx = await getDocs(qTx);
      const batch = writeBatch(db);
      snapTx.forEach(d => {
        batch.delete(doc(db, 'loan_transactions', d.id));
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'loans');
    }
  },

  getLoanTransactions: () => useAppStore.getState().loanTransactions,
  addLoanTransaction: async (data: any) => {
    const newItem = {
      ...data,
      id: Date.now() + Math.floor(Math.random() * 1000),
      loanId: Number(data.loanId)
    };
    try {
      await addDoc(collection(db, 'loan_transactions'), newItem);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'loan_transactions');
    }
    return newItem;
  },
  updateLoanTransaction: async (id: number, data: any) => {
    try {
      const q = query(collection(db, 'loan_transactions'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const existing = snap.docs[0].data();
        const updated = {
          ...existing,
          ...data,
          loanId: data.loanId !== undefined ? Number(data.loanId) : existing.loanId
        };
        await updateDoc(doc(db, 'loan_transactions', snap.docs[0].id), updated);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'loan_transactions');
    }
  },
  deleteLoanTransaction: async (id: number) => {
    try {
      const q = query(collection(db, 'loan_transactions'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await deleteDoc(doc(db, 'loan_transactions', snap.docs[0].id));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'loan_transactions');
    }
  },

  getCollectionReport: (start_date?: string, end_date?: string, my_agent_id?: any, bd_agent_id?: any) => {
    const { myPayments, withdrawals } = useAppStore.getState();
    
    const requiresFilter = (req: any) => {
       if (!req) return false;
       if (typeof req === 'string') return req !== 'all' && req !== '';
       return req.length > 0 && !req.includes('all') && !(req.length === 1 && req[0] === '');
    };
    
    const matchId = (item_agent: number | undefined, req: any) => {
       if (typeof req === 'string') return item_agent === Number(req);
       return item_agent !== undefined && req.includes(String(item_agent));
    };
    
    const filteredPayments = myPayments.filter(p => {
      if (start_date && p.date < start_date) return false;
      if (end_date && p.date > end_date) return false;
      if (requiresFilter(my_agent_id) && !matchId(p.my_agent_id, my_agent_id)) return false;
      if (requiresFilter(bd_agent_id)) return false; 
      return true;
    });

    const filteredWithdrawals = withdrawals.filter(w => {
      if (w.agent_type !== 'MY') return false;
      if (start_date && w.date < start_date) return false;
      if (end_date && w.date > end_date) return false;
      if (requiresFilter(my_agent_id) && !matchId(w.agent_id, my_agent_id)) return false;
      if (requiresFilter(bd_agent_id)) return false;
      return true;
    });

    const combined = [
      ...filteredPayments.map(p => ({
        date: p.date,
        method: p.sub_method ? `${p.payment_method} - ${p.sub_method}` : p.payment_method,
        collection: Number(p.amount_myr),
        withdraw: 0,
        note: p.note || ''
      })),
      ...filteredWithdrawals.map(w => ({
        date: w.date,
        method: w.sub_method_name ? `${w.method_name} - ${w.sub_method_name}` : w.method_name,
        collection: 0,
        withdraw: Number(w.amount),
        note: w.note || ''
      }))
    ].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

    let balance = 0;
    
    // If there's a start_date, we need to calculate the opening balance
    if (start_date) {
      const pastPayments = myPayments.filter(p => {
        if (p.date >= start_date) return false;
        if (requiresFilter(my_agent_id) && !matchId(p.my_agent_id, my_agent_id)) return false;
        if (requiresFilter(bd_agent_id)) return false;
        return true;
      });
      const pastWithdrawals = withdrawals.filter(w => {
        if (w.agent_type !== 'MY' || w.date >= start_date) return false;
        if (requiresFilter(my_agent_id) && !matchId(w.agent_id, my_agent_id)) return false;
        if (requiresFilter(bd_agent_id)) return false;
        return true;
      });
      
      const pastCollection = pastPayments.reduce((sum, p) => sum + Number(p.amount_myr), 0);
      const pastWithdraw = pastWithdrawals.reduce((sum, w) => sum + Number(w.amount), 0);
      balance = pastCollection - pastWithdraw;
      
      if (balance !== 0) {
        combined.unshift({
          date: start_date,
          method: 'Opening Balance',
          collection: 0,
          withdraw: 0,
          note: ''
        });
      }
    }

    const data = combined.map(t => {
      balance = balance + t.collection - t.withdraw;
      return { 
        date: t.date,
        method: t.method,
        collection: t.collection,
        withdraw: t.withdraw,
        balance: balance,
        note: t.note
      };
    });

    return data;
  },

  getReports: (params: any) => {
    const { type, my_agent_id, bd_agent_id, start_date, end_date } = params;
    const { orders, conversions, expenses, myPayments, bdPayments, myAgents, bdAgents, collectionMethods, rateHistory, defaultBankRate, defaultMobileRate } = useAppStore.getState();

    const filter = (data: any[], isConversion = false) => data.filter(item => {
      let match = true;
      if (start_date && item.date < start_date) match = false;
      if (end_date && item.date > end_date) match = false;
      
      const requiresMyAgentFilter = (req: any) => {
         if (!req) return false;
         if (typeof req === 'string') return req !== 'all' && req !== '';
         return req.length > 0 && !req.includes('all') && !(req.length === 1 && req[0] === '');
      };
      
      const matchAgentId = (item_agent: number | undefined, req: any) => {
         if (typeof req === 'string') return item_agent === Number(req);
         return item_agent !== undefined && req.includes(String(item_agent));
      };

      if (requiresMyAgentFilter(my_agent_id)) {
        if ('my_agent_id' in item) {
          if (!matchAgentId(item.my_agent_id, my_agent_id)) match = false;
        } else {
          // If filtering by MY Agent, exclude items that are BD-only (like BD payments or conversions not linked to MY agents)
          if ('bd_agent_id' in item || isConversion) match = false;
        }
      }
      
      if (requiresMyAgentFilter(bd_agent_id)) {
        if (isConversion) {
          if (!matchAgentId(item.pay_to_bd_agent_id, bd_agent_id)) match = false;
        } else if ('bd_agent_id' in item) {
          if (!matchAgentId(item.bd_agent_id, bd_agent_id)) match = false;
        } else {
          // If filtering by BD Agent, exclude items that are MY-only (like MY payments)
          if ('my_agent_id' in item) match = false;
        }
      }
      return match;
    });

    if (type === 'collection') {
      const data = store.getCollectionReport(start_date, end_date, my_agent_id, bd_agent_id);
      return { data, columns: ['Date', 'Method', 'Collection (MYR)', 'Withdraw', 'Balance', 'Note'] };
    }

    if (type === 'summary') {
      const filteredOrders = filter(orders);
      
      const globalConversions = conversions.filter(c => {
        if (start_date && c.date < start_date) return false;
        if (end_date && c.date > end_date) return false;
        return true;
      });
      const globalExpenses = expenses.filter(e => {
        if (start_date && e.date < start_date) return false;
        if (end_date && e.date > end_date) return false;
        return true;
      });
      const globalOrders = orders.filter(o => {
        if (start_date && o.date < start_date) return false;
        if (end_date && o.date > end_date) return false;
        return true;
      });

      const totalBdtOrder = filteredOrders.reduce((sum, o) => sum + Number(o.amount_bdt), 0);
      const totalRmOrder = filteredOrders.reduce((sum, o) => sum + Number(o.amount_myr), 0);
      
      const totalGlobalBdtOrder = globalOrders.reduce((sum, o) => sum + Number(o.amount_bdt), 0);
      
      const totalBdtConverted = globalConversions.reduce((sum, c) => {
        const bdt = Number(c.amount_bdt) || 0;
        const comm = c.commission_enabled ? (c.commission_amount ? Number(c.commission_amount) : bdt * 0.025) : 0;
        return sum + (Number(c.total_bd_received) || (bdt + comm));
      }, 0);
      const totalRmConverted = globalConversions.reduce((sum, c) => sum + Number(c.amount_myr), 0);
      
      const avgConvertRate = totalRmConverted > 0 ? totalBdtConverted / totalRmConverted : 0;
      const totalConvertedRm = avgConvertRate > 0 ? totalBdtOrder / avgConvertRate : 0;
      const grossProfit = totalRmOrder - totalConvertedRm;
      
      const totalGlobalCharges = globalConversions.reduce((sum, c) => sum + Number(c.bank_charges), 0);
      
      let totalGlobalMyrExp = 0;
      let totalGlobalBankingChargesBdt = 0;
      let totalGlobalBankingChargesRm = 0;

      globalExpenses.forEach(e => {
        if (e.currency === 'BDT') {
          const bdtAmt = Number(e.amount_myr || 0);
          const dayRate = getExchangeRateForDate(e.date, rateHistory, conversions, orders, defaultBankRate, defaultMobileRate);
          const rmVal = dayRate > 0 ? bdtAmt / dayRate : 0;
          totalGlobalBankingChargesBdt += bdtAmt;
          totalGlobalBankingChargesRm += rmVal;
        } else {
          totalGlobalMyrExp += Number(e.amount_myr || 0);
        }
      });

      const totalGlobalExp = totalGlobalMyrExp + totalGlobalBankingChargesRm;
      
      const requiresMyAgentFilter = (req: any) => {
         if (!req) return false;
         if (typeof req === 'string') return req !== 'all' && req !== '';
         return req.length > 0 && !req.includes('all') && !(req.length === 1 && req[0] === '');
      };
      const isAgentSelected = requiresMyAgentFilter(my_agent_id) || requiresMyAgentFilter(bd_agent_id);
      const proRateFactor = (isAgentSelected && totalGlobalBdtOrder > 0) ? (totalBdtOrder / totalGlobalBdtOrder) : 1;
      
      const totalCharges = totalGlobalCharges * proRateFactor;
      const totalExp = totalGlobalExp * proRateFactor;
      const bankingTransactionChargesBdt = totalGlobalBankingChargesBdt * proRateFactor;
      const bankingTransactionChargesRm = totalGlobalBankingChargesRm * proRateFactor;
      const generalExpensesRm = totalGlobalMyrExp * proRateFactor;
      
      const netProfit = grossProfit - totalCharges - totalExp;
      
      return {
        summary: {
          order_count: filteredOrders.length,
          total_myr_orders: totalRmOrder,
          total_myr_converted: totalRmConverted,
          total_bdt_converted: totalBdtConverted,
          avg_rate: avgConvertRate,
          total_expenses: totalExp,
          total_charges: totalCharges,
          profitBreakdown: {
            totalBdtOrder,
            totalRmOrder,
            avgConvertRate,
            totalConvertedRm,
            grossProfit,
            bankCharges: totalCharges,
            bankingTransactionChargesBdt,
            bankingTransactionChargesRm,
            bdtChargesRm: bankingTransactionChargesRm,
            generalExpensesRm,
            expenses: totalExp,
            netProfit
          }
        }
      };
    }

    if (type === 'orders') {
      const data = filter(orders).sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).map(o => ({
        date: o.date,
        my_agent: myAgents.find(a => Number(a.id) === Number(o.my_agent_id))?.name || '-',
        bd_agent: bdAgents.find(a => Number(a.id) === Number(o.bd_agent_id))?.name || '-',
        type: o.type,
        amount_bdt: Number(o.amount_bdt),
        rate: Number(o.rate),
        amount_myr: Number(o.amount_myr),
        remark: o.remark || ''
      }));
      return { data, columns: ['Date', 'MY Agent', 'BD Agent', 'Type', 'BDT', 'Rate', 'RM', 'Remark'] };
    }

    if (type === 'payments') {
      const myP = filter(myPayments)
        .map(p => ({ ...p, agentObj: myAgents.find(a => Number(a.id) === Number(p.my_agent_id)), side: 'MY', amount: p.amount_myr }))
        .filter(p => p.agentObj);
      
      const bdP = filter(bdPayments)
        .map(p => ({ ...p, agentObj: bdAgents.find(a => Number(a.id) === Number(p.bd_agent_id)), side: 'BD', amount: p.amount_bdt }))
        .filter(p => p.agentObj);

      const convP = filter(conversions, true)
        .filter(c => Boolean(c.pay_to_bd_agent_id))
        .map(c => {
          const bdt = Number(c.amount_bdt) || 0;
          const comm = c.commission_enabled ? (c.commission_amount ? Number(c.commission_amount) : bdt * 0.025) : 0;
          const total = Number(c.total_bd_received) || (bdt + comm);
          return { 
            ...c, 
            agentObj: bdAgents.find(a => Number(a.id) === Number(c.pay_to_bd_agent_id)), 
            side: 'BD', 
            amount: total,
            payment_method: 'Conversion Remittance'
          };
        })
        .filter(p => p.agentObj);

      const data = [...myP, ...bdP, ...convP].sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))).map(p => ({
        date: p.date,
        agent: p.agentObj?.name || '-',
        side: p.side,
        method: p.payment_method,
        amount: Number(p.amount),
        note: p.note || ''
      }));
      return { data, columns: ['Date', 'Agent', 'Side', 'Method', 'Amount', 'Note'] };
    }

    if (type === 'expenses') {
      const data = filter(expenses).map(e => {
        const isBdt = e.currency === 'BDT';
        const rate = isBdt ? getExchangeRateForDate(e.date, rateHistory, conversions, orders, defaultBankRate, defaultMobileRate) : 1;
        const amountRm = isBdt ? (rate > 0 ? Number(e.amount_myr) / rate : 0) : Number(e.amount_myr);
        return {
          date: e.date,
          category: e.category,
          amount_myr: Number(amountRm.toFixed(2)),
          note: isBdt ? `[BDT ${Number(e.amount_myr).toLocaleString()} @ ${rate.toFixed(2)}] ${e.note || ''}`.trim() : (e.note || '')
        };
      });
      return { data, columns: ['Date', 'Category', 'Amount (RM)', 'Note'] };
    }

    if (type === 'conversions') {
      const data = filter(conversions, true).map(c => {
        const bdt = Number(c.amount_bdt) || 0;
        const comm = c.commission_enabled ? (c.commission_amount ? Number(c.commission_amount) : bdt * 0.025) : 0;
        const total = Number(c.total_bd_received) || (bdt + comm);
        return {
          date: c.date,
          amount_myr: Number(c.amount_myr),
          rate: Number(c.rate),
          amount_bdt: total,
          bank_charges: Number(c.bank_charges),
          bd_agent: bdAgents.find(a => Number(a.id) === Number(c.pay_to_bd_agent_id))?.name || '-'
        };
      });
      return { data, columns: ['Date', 'RM Amount', 'Rate', 'BDT Received', 'Charges', 'Paid To Agent'] };
    }

    if (type === 'daily_financial') {
      const filteredOrders = filter(orders);
      const filteredConversions = filter(conversions, true);
      const filteredExpenses = filter(expenses);

      const dates = new Set([
        ...filteredOrders.map(o => o.date),
        ...filteredConversions.map(c => c.date),
        ...filteredExpenses.map(e => e.date)
      ]);
      const sortedDates = Array.from(dates).sort();

      const globalConversions = conversions.filter(c => {
        if (start_date && c.date < start_date) return false;
        if (end_date && c.date > end_date) return false;
        return true;
      });
      const globalOrders = orders.filter(o => {
        if (start_date && o.date < start_date) return false;
        if (end_date && o.date > end_date) return false;
        return true;
      });
      const globalExpenses = expenses.filter(e => {
        if (start_date && e.date < start_date) return false;
        if (end_date && e.date > end_date) return false;
        return true;
      });

      const totalGlobalBdtOrder = globalOrders.reduce((sum, o) => sum + Number(o.amount_bdt), 0);
      const totalGlobalBdtConverted = globalConversions.reduce((sum, c) => {
        const bdt = Number(c.amount_bdt) || 0;
        const comm = c.commission_enabled ? (c.commission_amount ? Number(c.commission_amount) : bdt * 0.025) : 0;
        return sum + (Number(c.total_bd_received) || (bdt + comm));
      }, 0);
      const totalGlobalRmConverted = globalConversions.reduce((sum, c) => sum + Number(c.amount_myr), 0);
      const avgConvertRate = totalGlobalRmConverted > 0 ? totalGlobalBdtConverted / totalGlobalRmConverted : 0;

      const data = sortedDates.map(date => {
        const dayOrders = filteredOrders.filter(o => o.date === date);
        const dayConversions = filteredConversions.filter(c => c.date === date);
        const dayExpenses = filteredExpenses.filter(e => e.date === date);

        const totalOrdersRm = dayOrders.reduce((sum, o) => sum + Number(o.amount_myr), 0);
        const totalOrdersBdt = dayOrders.reduce((sum, o) => sum + Number(o.amount_bdt), 0);
        
        const isAgentSelected = !!(my_agent_id || bd_agent_id);
        const dayProRateFactor = (isAgentSelected && totalGlobalBdtOrder > 0) ? (totalOrdersBdt / totalGlobalBdtOrder) : 1;
        
        const dayGlobalConversions = globalConversions.filter(c => c.date === date);
        const dayGlobalExpenses = globalExpenses.filter(e => e.date === date);
        
        const dayGlobalCharges = dayGlobalConversions.reduce((sum, c) => sum + Number(c.bank_charges), 0);
        
        const dayRate = getExchangeRateForDate(date, rateHistory, conversions, orders, defaultBankRate, defaultMobileRate);
        let dayGlobalMyrExp = 0;
        let dayGlobalBdtExpRm = 0;
        dayGlobalExpenses.forEach(e => {
          if (e.currency === 'BDT') {
            const bdtAmt = Number(e.amount_myr || 0);
            dayGlobalBdtExpRm += dayRate > 0 ? bdtAmt / dayRate : 0;
          } else {
            dayGlobalMyrExp += Number(e.amount_myr || 0);
          }
        });
        const dayGlobalExp = dayGlobalMyrExp + dayGlobalBdtExpRm;

        const dayCharges = isAgentSelected ? (dayGlobalCharges * dayProRateFactor) : dayGlobalCharges;
        const dayExp = isAgentSelected ? (dayGlobalExp * dayProRateFactor) : dayGlobalExp;

        const totalConvertedRm = avgConvertRate > 0 ? totalOrdersBdt / avgConvertRate : 0;
        const grossProfit = totalOrdersRm - totalConvertedRm;
        const netProfit = grossProfit - dayCharges - dayExp;

        return {
          date,
          total_orders: totalOrdersRm,
          avg_rate: avgConvertRate,
          total_converted: totalConvertedRm,
          gross_profit: grossProfit,
          expenses: dayExp + dayCharges,
          net_profit: netProfit
        };
      });

      return { data, columns: ['Date', 'Total Orders (RM)', 'Avg Rate', 'Total Converted (RM)', 'Gross Profit', 'Expenses & Charges', 'Net Profit'] };
    }

    if (type === 'outstanding') {
      let filteredMyAgents: MYAgent[] = [];
      let filteredBdAgents: BDAgent[] = [];

      if (my_agent_id) {
        filteredMyAgents = myAgents.filter(a => a.id === Number(my_agent_id));
      } else if (bd_agent_id) {
        filteredBdAgents = bdAgents.filter(a => a.id === Number(bd_agent_id));
      } else {
        filteredMyAgents = myAgents;
        filteredBdAgents = bdAgents;
      }

      const myAgentsData = filteredMyAgents.map(agent => {
        const outstanding = calculateOutstanding('MY', agent, orders, myPayments);
        return { 
          agent_name: agent.name, 
          type: 'MY Agent', 
          balance_rm: Math.round(outstanding * 100) / 100,
          balance_tk: 0
        };
      }).filter(a => a.balance_rm !== 0);

      const bdAgentsData = filteredBdAgents.map(agent => {
        const outstanding = calculateOutstanding('BD', agent, orders, bdPayments, conversions);
        return { 
          agent_name: agent.name, 
          type: 'BD Agent', 
          balance_rm: 0,
          balance_tk: Math.round(outstanding * 100) / 100
        };
      }).filter(a => a.balance_tk !== 0);

      const data = [...myAgentsData, ...bdAgentsData];
      const columns = ['Agent Name', 'Agent Type', 'Balance (RM)', 'Balance (Tk)'];
      return { data, columns };
    }

    if (type === 'ledger') {
      let ledgerData: any[] = [];
      let balance = 0;
      let isMyAgent = false;
      let initialDate = '';

      const getValidAgentId = (val: any) => {
        if (!val) return null;
        if (typeof val === 'string') {
          if (val === '' || val === 'all') return null;
          return Number(val);
        }
        if (Array.isArray(val)) {
          const first = val[0];
          if (!first || first === '' || first === 'all') return null;
          return Number(first);
        }
        return null;
      };

      const myAgentIdNum = getValidAgentId(my_agent_id);
      const bdAgentIdNum = getValidAgentId(bd_agent_id);

      if (myAgentIdNum) {
        isMyAgent = true;
        const agent = myAgents.find(a => a.id === myAgentIdNum);
        if (agent) {
          initialDate = agent.initial_balance_date || '';
          let currentBalance = Number(agent.initial_balance) || 0;
          
          const agentOrders = orders.filter(o => o.my_agent_id === agent.id);
          const agentPayments = myPayments.filter(p => p.my_agent_id === agent.id);
          
          let allTransactions = [
            ...agentOrders.map(o => ({ 
              id: o.id,
              date: o.date, 
              desc: 'Order', 
              order_amount: Number(o.amount_bdt), 
              rate: Number(o.rate), 
              debit: Number(o.amount_myr), 
              credit: 0 
            })),
            ...agentPayments.map(p => ({ 
              id: p.id,
              date: p.date, 
              desc: `Payment (${p.payment_method}${p.sub_method ? ' - ' + p.sub_method : ''})${p.note ? ' - ' + p.note : ''}`, 
              order_amount: '-', 
              rate: '-', 
              debit: 0, 
              credit: Number(p.amount_myr) 
            }))
          ].sort((a, b) => {
            const dateComparison = String(a.date || '').localeCompare(String(b.date || ''));
            if (dateComparison !== 0) return dateComparison;
            return a.id - b.id;
          });

          if (start_date) {
            const previousTransactions = allTransactions.filter(t => t.date < start_date);
            previousTransactions.forEach(t => {
              currentBalance = currentBalance + t.credit - t.debit;
            });
            ledgerData = allTransactions.filter(t => t.date >= start_date && (!end_date || t.date <= end_date));
          } else {
            ledgerData = end_date ? allTransactions.filter(t => t.date <= end_date) : allTransactions;
          }
          
          balance = currentBalance;
        }
      } else if (bdAgentIdNum) {
        const agent = bdAgents.find(a => Number(a.id) === bdAgentIdNum);
        if (agent) {
          initialDate = agent.initial_balance_date || '';
          let currentBalance = Number(agent.initial_balance) || 0;

          const agentOrders = orders.filter(o => Number(o.bd_agent_id) === Number(agent.id));
          const agentPayments = bdPayments.filter(p => Number(p.bd_agent_id) === Number(agent.id));
          const agentConversions = conversions.filter(c => Boolean(c.pay_to_bd_agent_id) && Number(c.pay_to_bd_agent_id) === Number(agent.id));
          
          const orderTransactions = agentOrders.map(o => ({
            id: o.id,
            date: o.date,
            desc: o.type === 'bank' ? `Bank Order${o.remark ? ' - ' + o.remark : ''}` : `Order${o.type && o.type !== 'bkash' ? ` (${o.type})` : ''}${o.remark ? ' - ' + o.remark : ''}`,
            debit: Number(o.amount_bdt),
            credit: 0
          }));

          const chargeTransactions = agentOrders
            .filter(o => (Number(o.charge) || 0) > 0)
            .map(o => ({
              id: Number(o.id) + 0.5,
              date: o.date,
              desc: o.type === 'bank' ? `Charge BD (Bank Order)${o.remark ? ' - ' + o.remark : ''}` : `Charge BD${o.remark ? ' - ' + o.remark : ''}`,
              debit: Number(o.charge),
              credit: 0
            }));

          const paymentTransactions = agentPayments.flatMap(p => {
            const amt = Number(p.amount_bdt) || 0;
            const chg = Number(p.charge) || 0;
            const isNegative = amt < 0;
            const mainTx = {
              id: p.id,
              date: p.date,
              desc: `Payment (${p.payment_method}${p.sub_method ? ' - ' + p.sub_method : ''})${p.note ? ' - ' + p.note : ''}`,
              debit: isNegative ? Math.abs(amt) : 0,
              credit: !isNegative ? amt : 0
            };
            if (isNegative && chg > 0) {
              const chargeTx = {
                id: Number(p.id) + 0.6,
                date: p.date,
                desc: `Transfer Charge (${p.payment_method}${p.sub_method ? ' - ' + p.sub_method : ''})`,
                debit: chg,
                credit: 0
              };
              return [mainTx, chargeTx];
            }
            return [mainTx];
          });

          let allTransactions = [
            ...orderTransactions,
            ...chargeTransactions,
            ...paymentTransactions,
            ...agentConversions.map(c => {
              const bdt = Number(c.amount_bdt) || 0;
              const comm = c.commission_enabled ? (c.commission_amount ? Number(c.commission_amount) : bdt * 0.025) : 0;
              const total = Number(c.total_bd_received) || (bdt + comm);
              return { 
                id: c.id,
                date: c.date, 
                desc: `Conversion Remittance${c.commission_enabled ? ' (incl. 2.5% Commission)' : ''}`, 
                debit: 0, 
                credit: total
              };
            })
          ].sort((a, b) => {
            const dateComparison = String(a.date || '').localeCompare(String(b.date || ''));
            if (dateComparison !== 0) return dateComparison;
            return a.id - b.id;
          });

          if (start_date) {
            const previousTransactions = allTransactions.filter(t => t.date < start_date);
            previousTransactions.forEach(t => {
              currentBalance = currentBalance + t.credit - t.debit;
            });
            ledgerData = allTransactions.filter(t => t.date >= start_date && (!end_date || t.date <= end_date));
          } else {
            ledgerData = end_date ? allTransactions.filter(t => t.date <= end_date) : allTransactions;
          }

          balance = currentBalance;
        }
      }

      const data: any[] = [];
      if (balance !== 0 || start_date) {
          const rowDate = start_date || initialDate || '';
          let initialRow: any = {};
          
          if (isMyAgent) {
            initialRow = {
              date: rowDate,
              desc: start_date ? 'Opening Balance' : 'Initial Balance',
              order_amount: '-',
              rate: '-',
              debit: 0,
              credit: 0,
              balance: balance
            };
          } else {
            initialRow = {
              date: rowDate,
              desc: start_date ? 'Opening Balance' : 'Initial Balance',
              debit: 0,
              credit: 0,
              balance: balance
            };
          }
          data.push(initialRow);
      }

      ledgerData.forEach(item => {
          balance = balance + item.credit - item.debit;
          const row: any = {
              date: item.date,
              desc: item.desc,
          };
          
          if (isMyAgent) {
            row.order_amount = item.order_amount;
            row.rate = item.rate;
          }

          row.debit = item.debit;
          row.credit = item.credit;
          row.balance = balance;
          
          data.push(row);
      });

      const columns = isMyAgent 
        ? ['Date', 'Description', 'Order Amt (BDT)', 'Rate', 'Debit', 'Credit', 'Balance']
        : ['Date', 'Description', 'Debit', 'Credit', 'Balance'];

      return { data, columns };
    }

    return { data: [], columns: [] };
  },

  getBackupData: () => {
    const state = useAppStore.getState();
    return {
      users: state.users,
      myAgents: state.myAgents,
      bdAgents: state.bdAgents,
      orders: state.orders,
      myPayments: state.myPayments,
      bdPayments: state.bdPayments,
      conversions: state.conversions,
      expenses: state.expenses,
      withdrawals: state.withdrawals,
      deposits: state.deposits,
      collectionMethods: state.collectionMethods,
      rateHistory: state.rateHistory,
      loans: state.loans,
      loanTransactions: state.loanTransactions,
      backupDate: new Date().toISOString()
    };
  },

  backupData: () => {
    const data = store.getBackupData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    saveAs(blob, `remitflow_backup_${new Date().toISOString().split('T')[0]}.json`);
  },

  restoreData: (jsonData: string) => {
    try {
      // Basic validation to check if it's a valid JSON string
      const trimmed = jsonData.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        throw new Error('Invalid file format. Please ensure you are uploading a valid JSON backup file.');
      }

      const data = JSON.parse(trimmed);
      
      // Check for required fields to ensure it's a RemitFlow backup
      if (!data.users && !data.myAgents && !data.bdAgents && !data.orders) {
        throw new Error('The uploaded file does not appear to be a valid RemitFlow backup.');
      }

      if (data.users) save('rf_users', data.users);
      if (data.myAgents) save('rf_my_agents', data.myAgents);
      if (data.bdAgents) save('rf_bd_agents', data.bdAgents);
      if (data.orders) save('rf_orders', data.orders);
      if (data.myPayments) save('rf_my_payments', data.myPayments);
      if (data.bdPayments) save('rf_bd_payments', data.bdPayments);
      if (data.conversions) save('rf_conversions', data.conversions);
      if (data.expenses) save('rf_expenses', data.expenses);
      if (data.withdrawals) save('rf_withdrawals', data.withdrawals);
      if (data.deposits) save('rf_deposits', data.deposits);
      if (data.collectionMethods) save('rf_collection_methods', data.collectionMethods);
      if (data.rateHistory) save('rf_rate_history', data.rateHistory);
      
      useAppStore.getState().refresh();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  getRateHistory: () => useAppStore.getState().rateHistory,

  updateRateHistoryItem: (id: number, mobileRate: number, bankRate: number) => useAppStore.getState().updateRateHistoryItem(id, mobileRate, bankRate)
};
