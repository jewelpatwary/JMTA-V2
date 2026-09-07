import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  Landmark, 
  Wallet, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Search, 
  Calendar, 
  FileText, 
  Download, 
  Printer, 
  Plus, 
  Edit, 
  Trash2, 
  RefreshCw, 
  Filter, 
  CheckCircle2, 
  ChevronDown, 
  ArrowLeft, 
  Layers, 
  FileSpreadsheet, 
  TrendingUp, 
  TrendingDown, 
  Scale, 
  DollarSign,
  ReceiptText,
  Eye
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import XLSX from 'xlsx-js-style';
import { toJpeg } from 'html-to-image';
import { saveAs } from 'file-saver';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { store, useAppStore } from '../lib/store';
import { MYPayment, BDPayment, CollectionMethod, Withdrawal, Deposit } from '../types';

interface BankStatementLedgerProps {
  initialAgentType?: 'MY' | 'BD';
}

export interface BankBalanceDisplayItem {
  id: number;
  parentId?: number;
  name: string;
  initial_balance: number;
  initial_balance_date: string;
  totalIn: number;
  totalOut: number;
  net: number;
  parentMethod: string;
  isSub: boolean;
  subItems?: BankBalanceDisplayItem[];
}

interface StatementTransaction {
  id: number | string;
  date: string;
  particulars: string;
  agentName?: string;
  methodName: string;
  subMethodName?: string;
  type: string;
  rawType: 'initial' | 'payment' | 'deposit' | 'withdrawal' | string;
  reference: string;
  isDebit: boolean; // Money out / withdrawal
  isCredit: boolean; // Money in / deposit / collection
  debitAmount: number;
  creditAmount: number;
  balance: number;
  note: string;
}

export function BankBalancePage({ initialAgentType = 'MY' }: BankStatementLedgerProps) {
  const { collectionMethods: methods, myPayments, bdPayments, withdrawals, deposits, myAgents, bdAgents } = useAppStore();
  
  const [agentType, setAgentType] = useState<'MY' | 'BD'>(initialAgentType);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showAddBalanceModal, setShowAddBalanceModal] = useState(false);
  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false);
  const [showNewBankModal, setShowNewBankModal] = useState(false);
  const [showNewSubItemModal, setShowNewSubItemModal] = useState<{ methodId: number; methodName: string } | null>(null);
  const [transactionTarget, setTransactionTarget] = useState<{ method: string; subMethod?: string; id?: number; parentId?: number } | null>(null);
  
  // Statement view target (null = dashboard overview, { method: 'ALL' } = consolidated statement, { method: 'CIMB' } = specific bank)
  const [statementTarget, setStatementTarget] = useState<{ method: string; subMethod?: string } | null>(null);

  if (statementTarget) {
    return (
      <BankStatementView 
        agentType={agentType}
        methodName={statementTarget.method}
        subMethodName={statementTarget.subMethod}
        onBack={() => setStatementTarget(null)}
        onSwitchAccount={(m, s) => setStatementTarget({ method: m, subMethod: s })}
      />
    );
  }

  const filteredMethods = methods.filter(m => (m.type || 'MY') === agentType);

  const flatMethodBalances: BankBalanceDisplayItem[] = filteredMethods
    .map(method => {
      const payments = agentType === 'MY' 
        ? myPayments.filter(p => p.payment_method === method.name)
        : bdPayments.filter(p => p.payment_method === method.name);
      
      const methodWithdrawals = withdrawals.filter(w => 
        w.agent_type === agentType && 
        w.method_name === method.name
      );

      const methodDeposits = deposits.filter(d => 
        d.agent_type === agentType && 
        d.method_name === method.name
      );

      const balance = payments.reduce((sum, p) => sum + (agentType === 'MY' ? (p as MYPayment).amount_myr : (p as BDPayment).amount_bdt), 0);
      const manualDeposits = methodDeposits.reduce((sum, d) => sum + d.amount, 0);
      const withdrawn = methodWithdrawals.reduce((sum, w) => sum + w.amount, 0);
      const initialBal = Number(method.initial_balance) || 0;

      const subItems: BankBalanceDisplayItem[] = (method.subItems || []).map(sub => {
        const subPayments = payments.filter(p => p.sub_method === sub.name);
        const subWithdrawals = methodWithdrawals.filter(w => w.sub_method_name === sub.name);
        const subDeposits = methodDeposits.filter(d => d.sub_method_name === sub.name);
        
        const subBalance = subPayments.reduce((sum, p) => sum + (agentType === 'MY' ? (p as MYPayment).amount_myr : (p as BDPayment).amount_bdt), 0);
        const subManualDeposits = subDeposits.reduce((sum, d) => sum + d.amount, 0);
        const subWithdrawn = subWithdrawals.reduce((sum, w) => sum + w.amount, 0);
        const subInitialBal = Number(sub.initial_balance) || 0;

        return {
          id: sub.id,
          parentId: method.id,
          name: sub.name,
          initial_balance: subInitialBal,
          initial_balance_date: sub.initial_balance_date || '',
          totalIn: subBalance + subManualDeposits + subInitialBal,
          totalOut: subWithdrawn,
          net: (subBalance + subManualDeposits + subInitialBal) - subWithdrawn,
          parentMethod: method.name,
          isSub: true
        };
      });

      return {
        id: method.id,
        name: method.name,
        initial_balance: initialBal,
        initial_balance_date: method.initial_balance_date || '',
        totalIn: balance + manualDeposits + initialBal,
        totalOut: withdrawn,
        net: (balance + manualDeposits + initialBal) - withdrawn,
        subItems,
        parentMethod: method.name,
        isSub: false
      };
    });

  // Calculate flattened display items
  const displayItems: BankBalanceDisplayItem[] = flatMethodBalances.flatMap(m => {
    if (!m.subItems || m.subItems.length === 0) {
      return [m];
    }
    return m.subItems;
  }).filter(item => {
    if (!searchTerm) return true;
    const matchName = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchParent = item.parentMethod?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchName || matchParent;
  });

  const grandTotalIn = flatMethodBalances.reduce((sum, m) => sum + m.totalIn, 0);
  const grandTotalOut = flatMethodBalances.reduce((sum, m) => sum + m.totalOut, 0);
  const grandNetBalance = grandTotalIn - grandTotalOut;
  const currencySymbol = agentType === 'MY' ? 'RM' : '৳';

  return (
    <div className="space-y-6">
      {/* Top Header & Currency Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shadow-md">
            <Landmark size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">Bank Balance Ledger & Statements</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Live Statements
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Comprehensive statement management, real-time account ledgers, and debit/credit tracking.
            </p>
          </div>
        </div>

        {/* Currency Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => setAgentType('MY')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                agentType === 'MY'
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <span>🇲🇾</span>
              <span>Malaysia (MYR)</span>
            </button>
            <button
              onClick={() => setAgentType('BD')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all",
                agentType === 'BD'
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <span>🇧🇩</span>
              <span>Bangladesh (BDT)</span>
            </button>
          </div>

          <button
            onClick={() => setShowNewBankModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold rounded-xl shadow-sm transition-all"
          >
            <Plus size={15} />
            <span>New Bank</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Net Available Balance</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center">
              <Wallet size={16} />
            </div>
          </div>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-2">
            {currencySymbol} {grandNetBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Across all {filteredMethods.length} active banks</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Total Money In (Credit)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
              <ArrowDownLeft size={16} />
            </div>
          </div>
          <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
            {currencySymbol} {grandTotalIn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Deposits + collections received</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Total Money Out (Debit)</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 flex items-center justify-center">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <p className="text-xl font-extrabold text-red-600 dark:text-red-400 mt-2">
            {currencySymbol} {grandTotalOut.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Withdrawals & payouts</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Consolidated Statement</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center">
              <Layers size={16} />
            </div>
          </div>
          <button
            onClick={() => setStatementTarget({ method: 'ALL' })}
            className="w-full mt-3 py-2 px-3 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
          >
            <ReceiptText size={15} />
            <span>View All-Banks Statement</span>
          </button>
        </div>
      </div>

      {/* Account Table & Management */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search bank or sub-account..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white dark:text-white"
            />
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Showing <span className="font-bold text-slate-900 dark:text-white">{displayItems.length}</span> bank accounts / channels
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bank / Account Name</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Account Type</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Money In (Credit)</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Money Out (Debit)</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Net Balance</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Actions & Statement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {displayItems.length > 0 ? (
                displayItems.map((item, idx) => (
                  <tr key={`${item.parentMethod}-${item.name}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
                          {item.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            {item.name}
                          </p>
                          {item.isSub && (
                            <p className="text-[10px] text-slate-400 font-medium">
                              Parent: {item.parentMethod}
                            </p>
                          )}
                          {item.initial_balance > 0 && (
                            <p className="text-[10px] text-slate-400 font-normal">
                              Opening: {currencySymbol} {item.initial_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({formatDate(item.initial_balance_date)})
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn(
                        "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1",
                        item.isSub 
                          ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                          : "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      )}>
                        <Building2 size={11} />
                        {item.isSub ? 'Sub-Account' : 'Main Bank'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-xs text-emerald-600 dark:text-emerald-400">
                      +{currencySymbol} {item.totalIn.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-xs text-red-600 dark:text-red-400">
                      -{currencySymbol} {item.totalOut.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3.5 text-right font-extrabold text-xs text-slate-900 dark:text-white">
                      {currencySymbol} {item.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {/* Statement Button */}
                        <button
                          onClick={() => setStatementTarget({ 
                            method: item.parentMethod || item.name, 
                            subMethod: item.isSub ? item.name : undefined 
                          })}
                          className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all"
                          title="View Official Bank Statement"
                        >
                          <FileText size={13} />
                          <span>Statement</span>
                        </button>

                        {/* Quick Deposit */}
                        <button
                          onClick={() => {
                            setTransactionTarget({ 
                              method: item.parentMethod || item.name, 
                              subMethod: item.isSub ? item.name : undefined 
                            });
                            setShowAddBalanceModal(true);
                          }}
                          className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all"
                          title="Deposit Money In"
                        >
                          <Plus size={12} />
                          <span>Deposit</span>
                        </button>

                        {/* Quick Withdrawal */}
                        <button
                          onClick={() => {
                            setTransactionTarget({ 
                              method: item.parentMethod || item.name, 
                              subMethod: item.isSub ? item.name : undefined 
                            });
                            setShowWithdrawModal(true);
                          }}
                          className="px-2 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all"
                          title="Withdraw Money Out"
                        >
                          <ArrowUpRight size={12} />
                          <span>Withdraw</span>
                        </button>

                        {/* Add Sub Account */}
                        {!item.isSub && (
                          <button
                            onClick={() => setShowNewSubItemModal({ methodId: item.id, methodName: item.name })}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-lg transition-colors"
                            title="Add Sub-Account"
                          >
                            <Plus size={14} />
                          </button>
                        )}

                        {/* Edit Bank Details */}
                        <button
                          onClick={() => {
                            setTransactionTarget({ 
                              method: item.parentMethod || item.name, 
                              subMethod: item.isSub ? item.name : undefined,
                              id: item.id,
                              parentId: item.parentId
                            });
                            setShowEditDetailsModal(true);
                          }}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-lg transition-colors"
                          title="Edit Bank Details"
                        >
                          <Edit size={14} />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete "${item.name}"?`)) {
                              if (item.isSub && item.parentId) {
                                store.deleteCollectionMethodSubItem(item.parentId, item.id);
                              } else {
                                store.deleteCollectionMethod(item.id);
                              }
                            }
                          }}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                          title="Delete Bank Account"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500 text-xs italic">
                    No bank accounts found. Click "+ New Bank" to configure your bank ledger.
                  </td>
                </tr>
              )}
            </tbody>
            {displayItems.length > 0 && (
              <tfoot className="bg-slate-50 dark:bg-slate-800 border-t-2 border-slate-200 dark:border-slate-700 font-bold sticky bottom-0">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                    Total All Accounts:
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-emerald-600 dark:text-emerald-400">
                    +{currencySymbol} {grandTotalIn.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-red-600 dark:text-red-400">
                    -{currencySymbol} {grandTotalOut.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-slate-900 dark:text-white">
                    {currencySymbol} {grandNetBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal Dialogs */}
      {showWithdrawModal && transactionTarget && (
        <WithdrawModal 
          isOpen={showWithdrawModal}
          onClose={() => setShowWithdrawModal(false)}
          agentId={0}
          agentType={agentType}
          methodName={transactionTarget.method}
          subMethodName={transactionTarget.subMethod}
          onSuccess={() => {}}
        />
      )}

      {showAddBalanceModal && transactionTarget && (
        <AddBalanceModal 
          isOpen={showAddBalanceModal}
          onClose={() => setShowAddBalanceModal(false)}
          agentId={0}
          agentType={agentType}
          methodName={transactionTarget.method}
          subMethodName={transactionTarget.subMethod}
          onSuccess={() => {}}
        />
      )}

      {showEditDetailsModal && transactionTarget && (
        <EditMethodDetailsModal
          isOpen={showEditDetailsModal}
          onClose={() => setShowEditDetailsModal(false)}
          item={transactionTarget}
          onSuccess={() => {}}
        />
      )}

      {showNewBankModal && (
        <AddNewBankModal
          isOpen={showNewBankModal}
          onClose={() => setShowNewBankModal(false)}
          agentType={agentType}
        />
      )}

      {showNewSubItemModal && (
        <AddNewSubItemModal
          isOpen={!!showNewSubItemModal}
          onClose={() => setShowNewSubItemModal(null)}
          methodId={showNewSubItemModal.methodId}
          methodName={showNewSubItemModal.methodName}
        />
      )}
    </div>
  );
}

// --- Bank Statement View Component ---

export function BankStatementView({ 
  agentType, 
  methodName, 
  subMethodName, 
  onBack,
  onSwitchAccount
}: {
  agentType: 'MY' | 'BD';
  methodName: string; // 'ALL' for consolidated
  subMethodName?: string;
  onBack: () => void;
  onSwitchAccount?: (method: string, subMethod?: string) => void;
}) {
  const { myPayments, bdPayments, withdrawals: allWithdrawals, deposits: allDeposits, collectionMethods, myAgents, bdAgents, fontSize, fontStyle } = useAppStore();
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [presetPeriod, setPresetPeriod] = useState<string>('all');
  const [filterType, setFilterType] = useState<'ALL' | 'INFLOW' | 'OUTFLOW'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [showAddDepositModal, setShowAddDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const statementRef = useRef<HTMLDivElement>(null);
  const currencySymbol = agentType === 'MY' ? 'RM' : '৳';
  const isConsolidated = methodName === 'ALL';

  // Preset Date Handlers
  const handlePresetSelect = (preset: string) => {
    setPresetPeriod(preset);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yStr = yesterday.toISOString().split('T')[0];
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === 'this_week') {
      const firstDay = new Date(now);
      const day = now.getDay() || 7;
      firstDay.setDate(now.getDate() - day + 1);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'this_month') {
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(firstDayOfMonth);
      setEndDate(todayStr);
    } else if (preset === 'last_month') {
      const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      setStartDate(firstDayOfLastMonth);
      setEndDate(lastDayOfLastMonth);
    } else if (preset === 'this_year') {
      const firstDayOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      setStartDate(firstDayOfYear);
      setEndDate(todayStr);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Build Master Transactions List
  const relevantMethods = collectionMethods.filter(m => (m.type || 'MY') === agentType);
  const targetMethods = isConsolidated 
    ? relevantMethods 
    : relevantMethods.filter(m => m.name === methodName);

  // 1. Calculate Initial Opening Balances configured in bank settings
  const openingBalanceEntries: StatementTransaction[] = [];
  targetMethods.forEach(method => {
    if (subMethodName) {
      const subItem = (method.subItems || []).find(s => s.name === subMethodName);
      if (subItem && subItem.initial_balance) {
        openingBalanceEntries.push({
          id: `init-${method.id}-${subItem.id}`,
          date: subItem.initial_balance_date || '2020-01-01',
          particulars: `Opening Balance - ${method.name} (${subItem.name})`,
          methodName: method.name,
          subMethodName: subItem.name,
          type: 'Opening Balance',
          rawType: 'initial',
          reference: 'INIT-BAL',
          isDebit: false,
          isCredit: true,
          creditAmount: Number(subItem.initial_balance) || 0,
          debitAmount: 0,
          balance: 0,
          note: 'Configured Account Opening Balance'
        });
      }
    } else {
      if (!isConsolidated && (method.subItems || []).length > 0) {
        // Method has sub-items
        (method.subItems || []).forEach(sub => {
          if (sub.initial_balance) {
            openingBalanceEntries.push({
              id: `init-${method.id}-${sub.id}`,
              date: sub.initial_balance_date || '2020-01-01',
              particulars: `Opening Balance - ${method.name} (${sub.name})`,
              methodName: method.name,
              subMethodName: sub.name,
              type: 'Opening Balance',
              rawType: 'initial',
              reference: 'INIT-BAL',
              isDebit: false,
              isCredit: true,
              creditAmount: Number(sub.initial_balance) || 0,
              debitAmount: 0,
              balance: 0,
              note: 'Configured Account Opening Balance'
            });
          }
        });
      } else if (method.initial_balance) {
        openingBalanceEntries.push({
          id: `init-${method.id}`,
          date: method.initial_balance_date || '2020-01-01',
          particulars: `Opening Balance - ${method.name}`,
          methodName: method.name,
          subMethodName: undefined,
          type: 'Opening Balance',
          rawType: 'initial',
          reference: 'INIT-BAL',
          isDebit: false,
          isCredit: true,
          creditAmount: Number(method.initial_balance) || 0,
          debitAmount: 0,
          balance: 0,
          note: 'Configured Account Opening Balance'
        });
      }
    }
  });

  // 2. Payments (Collections from agents)
  const agentPayments = agentType === 'MY'
    ? myPayments.filter(p => isConsolidated || (p.payment_method === methodName && (subMethodName ? p.sub_method === subMethodName : true)))
    : bdPayments.filter(p => isConsolidated || (p.payment_method === methodName && (subMethodName ? p.sub_method === subMethodName : true)));

  const paymentEntries: StatementTransaction[] = agentPayments.map(p => {
    const agent = (agentType === 'MY' ? myAgents : bdAgents).find(a => Number(a.id) === Number((p as any).my_agent_id || (p as any).bd_agent_id));
    const amount = agentType === 'MY' ? (p as MYPayment).amount_myr : (p as BDPayment).amount_bdt;
    return {
      id: p.id,
      date: p.date || new Date().toISOString().split('T')[0],
      particulars: `Agent Collection: ${agent?.name || 'Agent #' + ((p as any).my_agent_id || (p as any).bd_agent_id)}`,
      agentName: agent?.name,
      methodName: p.payment_method,
      subMethodName: p.sub_method,
      type: 'Collection',
      rawType: 'payment',
      reference: `PAY-${p.id}`,
      isDebit: false,
      isCredit: true,
      creditAmount: Number(amount) || 0,
      debitAmount: 0,
      balance: 0,
      note: p.note || ''
    };
  });

  // 3. Deposits (Manual Bank Top-up)
  const matchingDeposits = allDeposits.filter(d => 
    d.agent_type === agentType && 
    (isConsolidated || (d.method_name === methodName && (subMethodName ? d.sub_method_name === subMethodName : true)))
  );

  const depositEntries: StatementTransaction[] = matchingDeposits.map(d => ({
    id: d.id,
    date: d.date || new Date().toISOString().split('T')[0],
    particulars: `Deposit / Fund In: ${d.method_name}${d.sub_method_name ? ` (${d.sub_method_name})` : ''}`,
    methodName: d.method_name,
    subMethodName: d.sub_method_name,
    type: 'Deposit',
    rawType: 'deposit',
    reference: `DEP-${d.id}`,
    isDebit: false,
    isCredit: true,
    creditAmount: Number(d.amount) || 0,
    debitAmount: 0,
    balance: 0,
    note: d.note || ''
  }));

  // 4. Withdrawals (Disbursements / Money Out)
  const matchingWithdrawals = allWithdrawals.filter(w => 
    w.agent_type === agentType && 
    (isConsolidated || (w.method_name === methodName && (subMethodName ? w.sub_method_name === subMethodName : true)))
  );

  const withdrawalEntries: StatementTransaction[] = matchingWithdrawals.map(w => ({
    id: w.id,
    date: w.date || new Date().toISOString().split('T')[0],
    particulars: `Withdrawal / Payout: ${w.method_name}${w.sub_method_name ? ` (${w.sub_method_name})` : ''}`,
    methodName: w.method_name,
    subMethodName: w.sub_method_name,
    type: 'Withdrawal',
    rawType: 'withdrawal',
    reference: `WTH-${w.id}`,
    isDebit: true,
    isCredit: false,
    creditAmount: 0,
    debitAmount: Number(w.amount) || 0,
    balance: 0,
    note: w.note || ''
  }));

  // Combined all chronological transactions
  const allChronological = [
    ...openingBalanceEntries,
    ...paymentEntries,
    ...depositEntries,
    ...withdrawalEntries
  ].sort((a, b) => {
    const dateDiff = String(a.date).localeCompare(String(b.date));
    if (dateDiff !== 0) return dateDiff;
    if (a.rawType === 'initial') return -1;
    if (b.rawType === 'initial') return 1;
    return String(a.id).localeCompare(String(b.id));
  });

  // Calculate Brought Forward (Opening Balance for the period) and Running Balance
  let runningCumulative = 0;
  let broughtForwardBalance = 0;

  const transactionsWithRunningBalance: StatementTransaction[] = allChronological.map(item => {
    const delta = item.creditAmount - item.debitAmount;
    
    // Check if this occurred before the start date filter
    if (startDate && item.date < startDate) {
      broughtForwardBalance += delta;
    }
    
    runningCumulative += delta;
    return {
      ...item,
      balance: runningCumulative
    };
  });

  // Filter transactions within the selected Statement Period
  const statementPeriodTransactions = transactionsWithRunningBalance.filter(item => {
    if (startDate && item.date < startDate) return false;
    if (endDate && item.date > endDate) return false;
    if (filterType === 'INFLOW' && !item.isCredit) return false;
    if (filterType === 'OUTFLOW' && !item.isDebit) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchPart = item.particulars.toLowerCase().includes(q);
      const matchNote = (item.note || '').toLowerCase().includes(q);
      const matchRef = item.reference.toLowerCase().includes(q);
      const matchAgent = (item.agentName || '').toLowerCase().includes(q);
      if (!matchPart && !matchNote && !matchRef && !matchAgent) return false;
    }
    return true;
  });

  // Period Metrics
  const totalPeriodCredits = statementPeriodTransactions.reduce((sum, t) => sum + t.creditAmount, 0);
  const totalPeriodDebits = statementPeriodTransactions.reduce((sum, t) => sum + t.debitAmount, 0);
  const totalPeriodInflowCount = statementPeriodTransactions.filter(t => t.isCredit).length;
  const totalPeriodOutflowCount = statementPeriodTransactions.filter(t => t.isDebit).length;
  const netPeriodMovement = totalPeriodCredits - totalPeriodDebits;
  
  // Closing Balance (Carried Forward)
  const closingBalance = broughtForwardBalance + netPeriodMovement;

  // Account display title
  const accountTitle = isConsolidated 
    ? `Consolidated Statement (All ${agentType === 'MY' ? 'MYR' : 'BDT'} Accounts)` 
    : `${methodName}${subMethodName ? ` - ${subMethodName}` : ''}`;

  // Export PDF Statement
  const handleExportPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Primary Header
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, 210, 32, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('OFFICIAL BANK STATEMENT', 14, 15);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Juel Money Transfer Apps - Treasury & Financial Ledger', 14, 22);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 27);

    // Account Summary Box
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Account: ${accountTitle}`, 14, 42);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Currency: ${agentType === 'MY' ? 'MYR (Malaysian Ringgit)' : 'BDT (Bangladeshi Taka)'}`, 14, 48);
    doc.text(`Statement Period: ${startDate ? formatDate(startDate) : 'All Time'} to ${endDate ? formatDate(endDate) : 'Present'}`, 14, 54);

    // Financial Bento Summary in PDF
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 60, 182, 22, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 60, 182, 22, 2, 2, 'D');

    // 4 Summary Metrics
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('OPENING BALANCE (B/F)', 20, 67);
    doc.text('TOTAL MONEY IN (+)', 68, 67);
    doc.text('TOTAL MONEY OUT (-)', 116, 67);
    doc.text('CLOSING BALANCE (C/F)', 160, 67);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${currencySymbol} ${broughtForwardBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 20, 75);
    
    doc.setTextColor(16, 185, 129); // Emerald
    doc.text(`+${currencySymbol} ${totalPeriodCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 68, 75);

    doc.setTextColor(239, 68, 68); // Red
    doc.text(`-${currencySymbol} ${totalPeriodDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 116, 75);

    doc.setTextColor(15, 23, 42);
    doc.text(`${currencySymbol} ${closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 160, 75);

    // Table Content
    const tableColumns = ["Seq", "Value Date", "Description / Narration", "Reference", "Debit (-)", "Credit (+)", "Balance"];
    const tableRows: any[] = [];

    // Add Brought Forward row if date filtered
    if (startDate) {
      tableRows.push([
        "-",
        formatDate(startDate),
        "BALANCE BROUGHT FORWARD (B/F)",
        "-",
        "-",
        "-",
        `${currencySymbol} ${broughtForwardBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      ]);
    }

    statementPeriodTransactions.forEach((t, i) => {
      tableRows.push([
        (i + 1).toString(),
        formatDate(t.date),
        t.particulars + (t.note ? `\nNote: ${t.note}` : ''),
        t.reference,
        t.isDebit ? `${currencySymbol} ${t.debitAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-',
        t.isCredit ? `${currencySymbol} ${t.creditAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-',
        `${currencySymbol} ${t.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      ]);
    });

    // Summary Total Row
    const totalRow = [
      "",
      "TOTALS",
      `Period Transactions: ${statementPeriodTransactions.length}`,
      "",
      `${currencySymbol} ${totalPeriodDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      `${currencySymbol} ${totalPeriodCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      `${currencySymbol} ${closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
    ];

    autoTable(doc, {
      startY: 88,
      head: [tableColumns],
      body: tableRows,
      foot: [totalRow],
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2.5, font: 'helvetica' },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 22 },
        2: { cellWidth: 65 },
        3: { cellWidth: 22 },
        4: { cellWidth: 24, halign: 'right', textColor: [220, 38, 38] },
        5: { cellWidth: 24, halign: 'right', textColor: [16, 185, 129] },
        6: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }
      }
    });

    // Page footers & Certification
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `This is a computer-generated bank statement from Juel Money Transfer Apps. Page ${i} of ${pageCount}`,
        14,
        doc.internal.pageSize.height - 8
      );
    }

    doc.save(`${methodName}_Bank_Statement.pdf`);
  };

  // Export Excel (.xlsx) Statement
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    const data: any[][] = [
      ["OFFICIAL BANK STATEMENT - JUEL MONEY TRANSFER APPS"],
      [`Account: ${accountTitle}`],
      [`Currency: ${agentType === 'MY' ? 'MYR' : 'BDT'}`],
      [`Period: ${startDate || 'All Time'} to ${endDate || 'Present'}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ["STATEMENT SUMMARY"],
      ["Opening Balance (B/F)", broughtForwardBalance],
      ["Total Money In (Credit)", totalPeriodCredits],
      ["Total Money Out (Debit)", totalPeriodDebits],
      ["Net Movement", netPeriodMovement],
      ["Closing Balance (C/F)", closingBalance],
      [],
      ["TRANSACTION DETAILS"],
      ["Seq", "Value Date", "Description / Narration", "Reference", "Debit (-)", "Credit (+)", "Running Balance", "Note"]
    ];

    if (startDate) {
      data.push(["-", startDate, "BALANCE BROUGHT FORWARD (B/F)", "-", 0, 0, broughtForwardBalance, "Opening Balance"]);
    }

    statementPeriodTransactions.forEach((t, i) => {
      data.push([
        i + 1,
        t.date,
        t.particulars,
        t.reference,
        t.isDebit ? t.debitAmount : 0,
        t.isCredit ? t.creditAmount : 0,
        t.balance,
        t.note || ''
      ]);
    });

    data.push([
      "TOTAL",
      "",
      `Total items: ${statementPeriodTransactions.length}`,
      "",
      totalPeriodDebits,
      totalPeriodCredits,
      closingBalance,
      ""
    ]);

    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Bank Statement");
    XLSX.writeFile(wb, `${methodName}_Bank_Statement.xlsx`);
  };

  // Export JPG Snapshot
  const handleExportJPG = () => {
    if (!statementRef.current) return;
    setIsExporting(true);
    toJpeg(statementRef.current, { quality: 0.95, backgroundColor: '#ffffff', skipFonts: true, fontEmbedCSS: '' })
      .then(dataUrl => {
        saveAs(dataUrl, `${methodName}_Bank_Statement.jpg`);
      })
      .catch(err => {
        console.error('Failed to export JPG', err);
      })
      .finally(() => {
        setIsExporting(false);
      });
  };

  // Direct Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={cn("space-y-6", fontStyle, fontSize)}>
      {/* Top Breadcrumb & Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center"
            title="Back to Bank Accounts"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bank Statement</span>
              <span className="text-slate-300">/</span>
              <h1 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                {accountTitle}
              </h1>
            </div>
            <p className="text-[11px] text-slate-500">
              Official ledger report with real-time balance reconciliation
            </p>
          </div>
        </div>

        {/* Account Switcher & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Account Switcher */}
          {onSwitchAccount && (
            <div className="relative min-w-[200px]">
              <select
                value={isConsolidated ? 'ALL' : `${methodName}${subMethodName ? `:::${subMethodName}` : ''}`}
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'ALL') {
                    onSwitchAccount('ALL');
                  } else {
                    const [m, s] = val.split(':::');
                    onSwitchAccount(m, s || undefined);
                  }
                }}
                className="w-full px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
              >
                <option value="ALL">Consolidated (All {agentType} Banks)</option>
                {relevantMethods.map(m => {
                  if ((m.subItems || []).length > 0) {
                    return (m.subItems || []).map(s => (
                      <option key={`${m.id}-${s.id}`} value={`${m.name}:::${s.name}`}>
                        {m.name} ({s.name})
                      </option>
                    ));
                  }
                  return (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Quick Deposit & Withdrawal */}
          {!isConsolidated && (
            <>
              <button
                onClick={() => setShowAddDepositModal(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-sm transition-all"
              >
                <Plus size={14} />
                <span>Deposit (+)</span>
              </button>
              <button
                onClick={() => setShowWithdrawModal(true)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-sm transition-all"
              >
                <ArrowUpRight size={14} />
                <span>Withdraw (-)</span>
              </button>
            </>
          )}

          {/* Export Actions */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={handleExportPDF}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all flex items-center gap-1"
              title="Export Official PDF Statement"
            >
              <FileText size={13} />
              <span>PDF</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all flex items-center gap-1"
              title="Export Excel (.xlsx)"
            >
              <FileSpreadsheet size={13} />
              <span>Excel</span>
            </button>
            <button
              onClick={handleExportJPG}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all flex items-center gap-1"
              title="Export Image (.jpg)"
            >
              <Download size={13} />
              <span>JPG</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all flex items-center gap-1"
              title="Print Bank Statement"
            >
              <Printer size={13} />
              <span>Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* Statement Period & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 print:hidden">
        {/* Preset Period Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Period:</span>
          {[
            { id: 'all', label: 'All Time' },
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'this_week', label: 'This Week' },
            { id: 'this_month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' },
            { id: 'this_year', label: 'This Year' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => handlePresetSelect(p.id)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium transition-all",
                presetPeriod === p.id
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Date Inputs & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                setPresetPeriod('custom');
              }}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white dark:text-white"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => {
                setEndDate(e.target.value);
                setPresetPeriod('custom');
              }}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white dark:text-white"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Transaction Type</label>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white dark:text-white"
            >
              <option value="ALL">All Debits & Credits</option>
              <option value="INFLOW">Credits Only (Money In)</option>
              <option value="OUTFLOW">Debits Only (Money Out)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Search Narration / Ref</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Search particular or note..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Statement Canvas (For Screen & Export) */}
      <div 
        ref={statementRef}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6 space-y-6"
      >
        {/* Official Statement Letterhead */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-bold">
                  <Landmark size={18} />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight uppercase">
                    Juel Money Transfer Apps
                  </h2>
                  <p className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">
                    Bank Account & Treasury Statement
                  </p>
                </div>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1">
                <CheckCircle2 size={11} />
                Reconciled Ledger
              </span>
              <p className="text-[11px] text-slate-500 mt-1 font-mono">
                Statement Ref: STM-{agentType}-{Date.now().toString().slice(-6)}
              </p>
            </div>
          </div>

          {/* Account Meta Details Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Account / Channel</span>
              <span className="font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                {accountTitle}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Operating Currency</span>
              <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                {agentType === 'MY' ? 'MYR - Malaysian Ringgit' : 'BDT - Bangladeshi Taka'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Statement Period</span>
              <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">
                {startDate ? formatDate(startDate) : 'Beginning'} — {endDate ? formatDate(endDate) : 'Present'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Generated Timestamp</span>
              <span className="font-semibold text-slate-900 dark:text-white mt-0.5 block">
                {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        {/* Authentic 4-Metric Bank Statement Summary Bento Box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Opening Balance B/F */}
          <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              1. Opening Balance (B/F)
            </span>
            <p className="text-lg font-black text-slate-900 dark:text-white mt-1">
              {currencySymbol} {broughtForwardBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Balance prior to {startDate ? formatDate(startDate) : 'period'}</p>
          </div>

          {/* 2. Total Money In / Credits */}
          <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                2. Total Money In (Credits)
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                {totalPeriodInflowCount} txns
              </span>
            </div>
            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
              +{currencySymbol} {totalPeriodCredits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">Collections & Bank Top-ups</p>
          </div>

          {/* 3. Total Money Out / Debits */}
          <div className="p-4 bg-red-50/50 dark:bg-red-950/20 rounded-xl border border-red-200/60 dark:border-red-800/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">
                3. Total Money Out (Debits)
              </span>
              <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">
                {totalPeriodOutflowCount} txns
              </span>
            </div>
            <p className="text-lg font-black text-red-600 dark:text-red-400 mt-1">
              -{currencySymbol} {totalPeriodDebits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-red-600/70 dark:text-red-400/70 mt-0.5">Withdrawals & Disbursements</p>
          </div>

          {/* 4. Closing Balance C/F */}
          <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-200/60 dark:border-indigo-800/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                4. Closing Balance (C/F)
              </span>
              <span className={cn(
                "text-[10px] font-bold flex items-center gap-0.5",
                netPeriodMovement >= 0 ? "text-emerald-600" : "text-red-600"
              )}>
                {netPeriodMovement >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {netPeriodMovement >= 0 ? '+' : ''}{currencySymbol}{netPeriodMovement.toFixed(0)}
              </span>
            </div>
            <p className="text-lg font-black text-slate-900 dark:text-white mt-1">
              {currencySymbol} {closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70 mt-0.5">Carried forward ending position</p>
          </div>
        </div>

        {/* Bank Statement Transaction Table */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-100">
              <tr>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider w-12 text-center">#</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider w-28">Value Date</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Description / Narration</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider w-28">Reference</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider w-32 text-right">Debit (- Out)</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider w-32 text-right">Credit (+ In)</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider w-36 text-right">Running Balance</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider w-16 text-center print:hidden">Act</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans text-xs">
              {/* If date filtered, display opening B/F row */}
              {startDate && (
                <tr className="bg-slate-50 dark:bg-slate-800/60 font-semibold italic text-slate-600 dark:text-slate-300">
                  <td className="px-3 py-2.5 text-center text-slate-400">-</td>
                  <td className="px-3 py-2.5">{formatDate(startDate)}</td>
                  <td className="px-4 py-2.5" colSpan={2}>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[10px] font-bold not-italic text-slate-700 dark:text-slate-200">
                        B/F
                      </span>
                      <span>BALANCE BROUGHT FORWARD</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-400">-</td>
                  <td className="px-3 py-2.5 text-right text-slate-400">-</td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-900 dark:text-white font-mono">
                    {currencySymbol} {broughtForwardBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="print:hidden"></td>
                </tr>
              )}

              {statementPeriodTransactions.length > 0 ? (
                statementPeriodTransactions.map((t, idx) => (
                  <tr 
                    key={`${t.rawType}-${t.id}-${idx}`}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Seq */}
                    <td className="px-3 py-3 text-center text-slate-400 text-[11px] font-mono">
                      {idx + 1}
                    </td>

                    {/* Date */}
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap font-medium text-xs">
                      {formatDate(t.date)}
                    </td>

                    {/* Particulars / Narration */}
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                            t.rawType === 'payment' && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
                            t.rawType === 'deposit' && "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
                            t.rawType === 'withdrawal' && "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
                            t.rawType === 'initial' && "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                          )}>
                            {t.type}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {t.particulars}
                          </span>
                        </div>
                        {t.note && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                            {t.note}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Reference */}
                    <td className="px-3 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {t.reference}
                    </td>

                    {/* Debit (- Out) */}
                    <td className="px-3 py-3 text-right font-mono font-bold text-xs text-red-600 dark:text-red-400 whitespace-nowrap">
                      {t.isDebit ? `-${currencySymbol} ${t.debitAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                    </td>

                    {/* Credit (+ In) */}
                    <td className="px-3 py-3 text-right font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {t.isCredit ? `+${currencySymbol} ${t.creditAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                    </td>

                    {/* Running Balance */}
                    <td className="px-3 py-3 text-right font-mono font-black text-xs text-slate-900 dark:text-white whitespace-nowrap">
                      {currencySymbol} {t.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    {/* Actions (for manual entries) */}
                    <td className="px-3 py-3 text-center print:hidden">
                      {(t.rawType === 'deposit' || t.rawType === 'withdrawal') && (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditTarget(t)}
                            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded"
                            title="Edit transaction"
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('Delete this transaction from the ledger?')) {
                                if (t.rawType === 'deposit') {
                                  store.deleteDeposit(Number(t.id));
                                } else {
                                  store.deleteWithdrawal(Number(t.id));
                                }
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 rounded"
                            title="Delete transaction"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500 text-xs italic">
                    No transactions recorded for this period.
                  </td>
                </tr>
              )}
            </tbody>
            {/* Statement Summary Footers */}
            <tfoot className="bg-slate-100 dark:bg-slate-800/80 border-t-2 border-slate-300 dark:border-slate-700 font-bold text-xs">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-slate-900 dark:text-white uppercase tracking-wider text-right">
                  TOTAL PERIOD MOVEMENT:
                </td>
                <td className="px-3 py-3 text-right font-mono font-bold text-red-600 dark:text-red-400">
                  -{currencySymbol} {totalPeriodDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  +{currencySymbol} {totalPeriodCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-3 text-right font-mono font-black text-slate-900 dark:text-white">
                  {currencySymbol} {closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="print:hidden"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Certified Footer Notice */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-400 gap-2">
          <p>
            This statement reflects all reconciled transactions, agent collections, manual deposits, and cash disbursements recorded in the system.
          </p>
          <p className="font-mono">
            Authorized Digital Record • Juel Money Transfer Apps
          </p>
        </div>
      </div>

      {/* Edit Transaction Modal */}
      {editTarget && (
        <EditTransactionModal
          isOpen={!!editTarget}
          onClose={() => setEditTarget(null)}
          transaction={editTarget}
        />
      )}

      {/* Quick Deposit Modal */}
      {showAddDepositModal && !isConsolidated && (
        <AddBalanceModal
          isOpen={showAddDepositModal}
          onClose={() => setShowAddDepositModal(false)}
          agentId={0}
          agentType={agentType}
          methodName={methodName}
          subMethodName={subMethodName}
          onSuccess={() => {}}
        />
      )}

      {/* Quick Withdraw Modal */}
      {showWithdrawModal && !isConsolidated && (
        <WithdrawModal
          isOpen={showWithdrawModal}
          onClose={() => setShowWithdrawModal(false)}
          agentId={0}
          agentType={agentType}
          methodName={methodName}
          subMethodName={subMethodName}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}

// --- Modals ---

export function EditTransactionModal({ isOpen, onClose, transaction }: {
  isOpen: boolean;
  onClose: () => void;
  transaction: any;
}) {
  const amountVal = transaction.debitAmount > 0 ? transaction.debitAmount : transaction.creditAmount;
  const [amount, setAmount] = useState(amountVal ? amountVal.toString() : '');
  const [date, setDate] = useState(transaction.date || new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState(transaction.note || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (transaction.rawType === 'deposit') {
      store.updateDeposit(Number(transaction.id), {
        amount: Number(amount),
        date,
        note
      });
    } else if (transaction.rawType === 'withdrawal') {
      store.updateWithdrawal(Number(transaction.id), {
        amount: Number(amount),
        date,
        note
      });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Edit {transaction.type}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500">
            <Plus className="rotate-45 w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Amount</label>
            <input 
              type="number" 
              step="0.01" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              required 
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white dark:text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Date</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              required 
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white dark:text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Narration / Note</label>
            <input 
              type="text" 
              value={note} 
              onChange={e => setNote(e.target.value)} 
              placeholder="Transaction note..." 
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white dark:text-white"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-2 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-1 py-2 px-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-sm"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function WithdrawModal({ isOpen, onClose, agentId, agentType, methodName, subMethodName, onSuccess }: { 
  isOpen: boolean; 
  onClose: () => void; 
  agentId: number; 
  agentType: 'MY' | 'BD';
  methodName: string;
  subMethodName?: string;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    store.addWithdrawal({
      agent_id: agentId,
      agent_type: agentType,
      method_name: methodName,
      sub_method_name: subMethodName,
      amount: Number(amount),
      date,
      note
    });
    onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 flex items-center justify-center">
              <ArrowUpRight size={16} />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Withdraw Money Out (Debit)</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500">
            <Plus className="rotate-45 w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-xs">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Target Account</p>
            <p className="font-bold text-slate-900 dark:text-white">
              {methodName} {subMethodName ? `(${subMethodName})` : ''} • {agentType === 'MY' ? 'MYR' : 'BDT'}
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Withdrawal Amount ({agentType === 'MY' ? 'RM' : '৳'})</label>
            <input 
              type="number" 
              step="0.01" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              required 
              placeholder="0.00"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-red-600 dark:text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Value Date</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              required 
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white dark:text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Reason / Narration</label>
            <input 
              type="text" 
              value={note} 
              onChange={e => setNote(e.target.value)} 
              placeholder="e.g., Payout to customer, cash withdrawal..." 
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white dark:text-white"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-2 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
            >
              Confirm Withdrawal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AddBalanceModal({ isOpen, onClose, agentId, agentType, methodName, subMethodName, onSuccess }: { 
  isOpen: boolean; 
  onClose: () => void; 
  agentId: number; 
  agentType: 'MY' | 'BD';
  methodName: string;
  subMethodName?: string;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    store.addDeposit({
      agent_id: agentId,
      agent_type: agentType,
      method_name: methodName,
      sub_method_name: subMethodName,
      amount: Number(amount),
      date,
      note
    });
    onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
              <Plus size={16} />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Deposit Money In (Credit)</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500">
            <Plus className="rotate-45 w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-xs">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Target Account</p>
            <p className="font-bold text-slate-900 dark:text-white">
              {methodName} {subMethodName ? `(${subMethodName})` : ''} • {agentType === 'MY' ? 'MYR' : 'BDT'}
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Deposit Amount ({agentType === 'MY' ? 'RM' : '৳'})</label>
            <input 
              type="number" 
              step="0.01" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              required 
              placeholder="0.00"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-600 dark:text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Value Date</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              required 
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white dark:text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Source / Narration</label>
            <input 
              type="text" 
              value={note} 
              onChange={e => setNote(e.target.value)} 
              placeholder="e.g., Bank deposit, owner capital, transfer..." 
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white dark:text-white"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-2 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
            >
              Confirm Deposit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EditMethodDetailsModal({ isOpen, onClose, item, onSuccess }: {
  isOpen: boolean;
  onClose: () => void;
  item: any;
  onSuccess: () => void;
}) {
  const { collectionMethods } = useAppStore();
  const [name, setName] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [initialBalanceDate, setInitialBalanceDate] = useState('');

  useEffect(() => {
    if (item.parentId) {
      const method = collectionMethods.find(m => m.id === item.parentId);
      const sub = method?.subItems.find(s => s.id === item.id);
      if (sub) {
        setName(sub.name);
        setInitialBalance(sub.initial_balance?.toString() || '0');
        setInitialBalanceDate(sub.initial_balance_date || new Date().toISOString().split('T')[0]);
      }
    } else {
      const method = collectionMethods.find(m => m.id === item.id);
      if (method) {
        setName(method.name);
        setInitialBalance(method.initial_balance?.toString() || '0');
        setInitialBalanceDate(method.initial_balance_date || new Date().toISOString().split('T')[0]);
      }
    }
  }, [item, collectionMethods]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (item.parentId) {
      store.updateCollectionMethodSubItem(item.parentId, item.id, {
        name,
        initial_balance: Number(initialBalance),
        initial_balance_date: initialBalanceDate
      });
    } else {
      store.updateCollectionMethod(item.id, {
        name,
        initial_balance: Number(initialBalance),
        initial_balance_date: initialBalanceDate
      });
    }
    onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Edit Bank Account Details</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500">
            <Plus className="rotate-45 w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Bank / Account Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required 
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white dark:text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Configured Opening Balance</label>
            <input 
              type="number" 
              step="0.01" 
              value={initialBalance} 
              onChange={e => setInitialBalance(e.target.value)} 
              required 
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white dark:text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Opening Balance Date</label>
            <input 
              type="date" 
              value={initialBalanceDate} 
              onChange={e => setInitialBalanceDate(e.target.value)} 
              required 
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white dark:text-white"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-2 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-1 py-2 px-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-sm"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AddNewBankModal({ isOpen, onClose, agentType }: {
  isOpen: boolean;
  onClose: () => void;
  agentType: 'MY' | 'BD';
}) {
  const [name, setName] = useState('');
  const [initialBalance, setInitialBalance] = useState('0');
  const [initialBalanceDate, setInitialBalanceDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    store.addCollectionMethod(name.trim(), agentType, Number(initialBalance) || 0, initialBalanceDate);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 flex items-center justify-center">
              <Building2 size={16} />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Add New {agentType === 'MY' ? 'Malaysia (MYR)' : 'Bangladesh (BDT)'} Bank Account
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500">
            <Plus className="rotate-45 w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Bank Name (e.g. Maybank, CIMB, bKash, Islami Bank)</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required 
              placeholder="e.g. Maybank Main Account"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white dark:text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Initial Opening Balance ({agentType === 'MY' ? 'RM' : '৳'})</label>
            <input 
              type="number" 
              step="0.01" 
              value={initialBalance} 
              onChange={e => setInitialBalance(e.target.value)} 
              placeholder="0.00"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white dark:text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Opening Balance Date</label>
            <input 
              type="date" 
              value={initialBalanceDate} 
              onChange={e => setInitialBalanceDate(e.target.value)} 
              required 
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white dark:text-white"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-2 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-1 py-2 px-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-sm"
            >
              Create Bank Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AddNewSubItemModal({ isOpen, onClose, methodId, methodName }: {
  isOpen: boolean;
  onClose: () => void;
  methodId: number;
  methodName: string;
}) {
  const [name, setName] = useState('');
  const [initialBalance, setInitialBalance] = useState('0');
  const [initialBalanceDate, setInitialBalanceDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    store.addCollectionMethodSubItem(methodId, name.trim(), Number(initialBalance) || 0, initialBalanceDate);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Add Sub-Account</h2>
            <p className="text-xs text-slate-400 font-medium">Under parent bank: {methodName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500">
            <Plus className="rotate-45 w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Sub-Account Name (e.g., Wallet #1, Acc #8841)</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required 
              placeholder="e.g. Account #8841"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white dark:text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Initial Balance</label>
            <input 
              type="number" 
              step="0.01" 
              value={initialBalance} 
              onChange={e => setInitialBalance(e.target.value)} 
              placeholder="0.00"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white dark:text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Opening Balance Date</label>
            <input 
              type="date" 
              value={initialBalanceDate} 
              onChange={e => setInitialBalanceDate(e.target.value)} 
              required 
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white dark:text-white"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-2 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-1 py-2 px-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-sm"
            >
              Add Sub-Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
