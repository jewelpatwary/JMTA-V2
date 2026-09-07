import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Globe, 
  ArrowRightLeft, 
  Receipt, 
  BarChart3, 
  Settings, 
  LogOut,
  Plus,
  UserPlus,
  Search,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Wallet,
  Clock,
  Banknote,
  AlertCircle,
  Trash2,
  Eye,
  Edit,
  RefreshCw,
  CreditCard,
  Sun,
  Moon,
  Scale,
  FileText,
  Check,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  Calendar,
  SlidersHorizontal,
  Calculator,
  Cloud,
  Database,
  Landmark,
  Building2,
  ReceiptText,
  Printer,
  ArrowDownLeft,
  ArrowUpRight,
  FileSpreadsheet,
  Layers,
  Filter,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import XLSX from 'xlsx-js-style';
import { toJpeg } from 'html-to-image';
import { saveAs } from 'file-saver';
import Papa from 'papaparse';
import { MessageSquare, Send, CheckSquare, ExternalLink } from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Legend,
  Cell,
  ReferenceLine
} from 'recharts';
import { cn, formatCurrency, formatDate } from './lib/utils';
import { db } from './lib/firebase';
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
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { store, useAppStore, getExchangeRateForDate } from './lib/store';
import { User, MYAgent, BDAgent, Order, MYPayment, BDPayment, Conversion, Expense, CollectionMethod, Withdrawal, RateHistory, LoanEntity, LoanTransaction, CalculationRow } from './types';
import { BankBalancePage, BankStatementView } from './components/BankStatementLedger';

// --- Components ---

const Card = ({ children, className, ...props }: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden", className)} {...props}>
    {children}
  </div>
);

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className,
  type = 'button',
  form,
  disabled,
  size = 'md',
  title
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'default';
  className?: string;
  type?: 'button' | 'submit';
  form?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  title?: string;
  key?: any;
}) => {
  const variants = {
    primary: 'bg-slate-900 dark:bg-white dark:text-slate-900 text-white hover:bg-slate-800 dark:hover:bg-slate-100',
    default: 'bg-slate-900 dark:bg-white dark:text-slate-900 text-white hover:bg-slate-800 dark:hover:bg-slate-100',
    secondary: 'bg-emerald-600 text-white hover:bg-emerald-700',
    outline: 'border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
    danger: 'bg-red-500 text-white hover:bg-red-600'
  };

  const sizes = {
    sm: "px-2 py-1 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  return (
    <button 
      type={type}
      form={form}
      onClick={onClick} 
      disabled={disabled}
      title={title}
      className={cn(
        "rounded-lg font-medium transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant as keyof typeof variants] || variants.primary,
        sizes[size as keyof typeof sizes] || sizes.md,
        className
      )}
    >
      {children}
    </button>
  );
};

const Input = ({ label, className, helpText, ...props }: { label?: string; helpText?: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="space-y-1">
    {label && <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</label>}
    <input 
      {...props} 
      className={cn("w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-slate-900 dark:focus:ring-white focus:border-transparent outline-none transition-all text-xs dark:text-white", className)}
    />
    {helpText && <p className="text-[10px] text-slate-500">{helpText}</p>}
  </div>
);

const Select = ({ label, options, ...props }: { label?: string; options: { value: any; label: string }[] } & React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="space-y-1">
    {label && <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</label>}
    <div className="relative">
      <select 
        {...props} 
        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-slate-900 dark:focus:ring-white focus:border-transparent outline-none transition-all appearance-none text-xs dark:text-white"
      >
        {options.map((opt, idx) => <option key={`${opt.value}-${idx}`} value={opt.value}>{opt.label}</option>)}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
        <ChevronDown className="w-3 h-3" />
      </div>
    </div>
  </div>
);

const SearchableSelect = ({ 
  label, 
  value, 
  options, 
  onChange, 
  placeholder = "Select an option",
  required,
  action
}: { 
  label?: React.ReactNode; 
  value: string | number; 
  options: { value: any; label: string }[]; 
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  action?: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const selectedOption = options.find(opt => opt.value.toString() === value.toString());
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-1">
      {(label || action) && (
        <div className="flex items-center justify-between">
          {typeof label === 'string' ? (
            <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</label>
          ) : (
            label
          )}
          {action}
        </div>
      )}
      <div 
        onClick={() => setIsOpen(true)}
        className={cn(
          "w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer flex items-center justify-between text-xs dark:text-white min-h-[32px]",
          !selectedOption && "text-slate-400"
        )}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown size={12} className="text-slate-400 flex-shrink-0" />
      </div>

      {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div 
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-sm dark:text-white">{label || "Select Option"}</h3>
                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <Plus className="rotate-45 w-5 h-5 text-slate-500" />
                </button>
              </div>
              
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="Search..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none dark:text-white"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {filteredOptions.length > 0 ? filteredOptions.map((opt, idx) => (
                  <div 
                    key={`${opt.value}-${idx}`}
                    onClick={() => {
                      onChange(opt.value.toString());
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={cn(
                      "p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between group",
                      value.toString() === opt.value.toString() 
                        ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-bold" 
                        : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <span className="text-sm">{opt.label}</span>
                    {value.toString() === opt.value.toString() && <Check size={16} />}
                  </div>
                )) : (
                  <div className="py-8 text-center text-slate-500 text-sm">No results found</div>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

const MultiSearchableSelect = ({ 
  label, 
  values, 
  options, 
  onChange, 
  placeholder = "Select options"
}: { 
  label?: string; 
  values: string[]; 
  options: { value: any; label: string }[]; 
  onChange: (values: string[]) => void;
  placeholder?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const selectedOptions = options.filter(opt => values.includes(opt.value.toString()));
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleOption = (val: string) => {
    if (val === 'all') {
       onChange(['all']);
       return;
    }
    let newVals = [...values];
    if (newVals.includes('all')) newVals = newVals.filter(v => v !== 'all');
    if (val === '') { // clear all
      onChange(['']);
      return;
    }
    if (newVals.includes('')) newVals = newVals.filter(v => v !== '');
    
    if (newVals.includes(val)) {
      newVals = newVals.filter(v => v !== val);
    } else {
      newVals.push(val);
    }
    
    if (newVals.length === 0) newVals = [''];
    onChange(newVals);
  };

  const displayText = selectedOptions.length === 0 
    ? placeholder 
    : selectedOptions.length === 1 
      ? selectedOptions[0].label 
      : `${selectedOptions.length} items selected`;

  return (
    <div className="space-y-1 relative">
      {label && <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</label>}
      <div 
        onClick={() => setIsOpen(true)}
        className={cn(
          "w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer flex items-center justify-between text-xs dark:text-white min-h-[32px]",
          selectedOptions.length === 0 && "text-slate-400"
        )}
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown size={12} className="text-slate-400 flex-shrink-0" />
      </div>

      {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div 
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-sm dark:text-white">{label || "Select Options"}</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => setIsOpen(false)} className="px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity">Done</button>
                  <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <Plus className="rotate-45 w-5 h-5 text-slate-500" />
                  </button>
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="Search..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none dark:text-white"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {filteredOptions.length > 0 ? filteredOptions.map((opt, idx) => {
                  const isSelected = values.includes(opt.value.toString());
                  return (
                  <div 
                    key={`${opt.value}-${idx}`}
                    onClick={() => toggleOption(opt.value.toString())}
                    className={cn(
                      "p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between group",
                      isSelected 
                        ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-bold" 
                        : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <span className="text-sm">{opt.label}</span>
                    {isSelected && <Check size={16} />}
                  </div>
                )}) : (
                  <div className="py-8 text-center text-slate-500 text-sm">No results found</div>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

function StorageWidget() {
  const [stats, setStats] = useState({
    localBytes: 0,
    appBytes: 0,
    bundleBytes: 0,
    totalBytes: 0,
    quota: 20 * 1024 * 1024, // 20 MB total allocation quota for assets and data
    percentage: 0
  });

  const orders = useAppStore(state => state.orders);
  const myPayments = useAppStore(state => state.myPayments);
  const bdPayments = useAppStore(state => state.bdPayments);
  const conversions = useAppStore(state => state.conversions);
  const expenses = useAppStore(state => state.expenses);
  const withdrawals = useAppStore(state => state.withdrawals);
  const deposits = useAppStore(state => state.deposits);
  const collectionMethods = useAppStore(state => state.collectionMethods);

  useEffect(() => {
    let localBytes = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const val = localStorage.getItem(key);
          localBytes += (key.length + (val ? val.length : 0)) * 2;
        }
      }
    } catch (_) {}

    let appBytes = 0;
    try {
      const s = useAppStore.getState();
      const stateKeys = [
        'myAgents', 'bdAgents', 'orders', 'myPayments', 'bdPayments',
        'conversions', 'expenses', 'withdrawals', 'deposits',
        'collectionMethods', 'rateHistory', 'users'
      ];
      stateKeys.forEach(k => {
        const arr = (s as any)[k];
        if (Array.isArray(arr)) {
          appBytes += JSON.stringify(arr).length * 2;
        }
      });
    } catch (_) {}

    let bundleBytes = 0;
    try {
      const resources = performance.getEntriesByType('resource');
      resources.forEach((r: any) => {
        if (r.transferSize) {
          bundleBytes += r.transferSize;
        } else if (r.decodedBodySize) {
          bundleBytes += r.decodedBodySize;
        }
      });
    } catch (_) {}
    if (bundleBytes === 0) {
      bundleBytes = 2.4 * 1024 * 1024; // typical optimized bundler size fallback
    }

    const totalBytes = localBytes + appBytes + bundleBytes;
    const quota = 20 * 1024 * 1024; // 20MB Representation
    const percentage = Math.min((totalBytes / quota) * 100, 100);

    setStats({
      localBytes,
      appBytes,
      bundleBytes,
      totalBytes,
      quota,
      percentage
    });
  }, [orders, myPayments, bdPayments, conversions, expenses, withdrawals, deposits, collectionMethods]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  
  return (
    <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl p-3 space-y-2 text-xs">
    </div>
  );
}

// --- Modals ---

const SecurityModal = ({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
}) => {
  const [timeout, setTimeoutVal] = useState(localStorage.getItem('inactivityTimeout') || '5');
  const handleSave = () => {
    localStorage.setItem('inactivityTimeout', timeout);
    alert('Security settings saved!');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Security Settings</h2>
        <div className="space-y-4">
          <Input 
            label="Inactivity Timeout (minutes)" 
            type="number" 
            value={timeout} 
            onChange={(e) => setTimeoutVal(e.target.value)} 
            min="1" />
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={handleSave}>Save Settings</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const StorageUtilizationModal = ({ 
  isOpen, 
  onClose
}: { 
  isOpen: boolean; 
  onClose: () => void;
}) => {
  const [stats, setStats] = useState({
    localBytes: 0,
    appBytes: 0,
    bundleBytes: 0,
    totalBytes: 0,
    quota: 20 * 1024 * 1024,
    percentage: 0
  });

  const { orders, myPayments, bdPayments, conversions, expenses, withdrawals, deposits, collectionMethods } = useAppStore();

  useEffect(() => {
    if (!isOpen) return;

    let localBytes = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const val = localStorage.getItem(key);
          localBytes += (key.length + (val ? val.length : 0)) * 2;
        }
      }
    } catch (_) {}

    let appBytes = 0;
    try {
      const s = useAppStore.getState();
      const stateKeys = [
        'myAgents', 'bdAgents', 'orders', 'myPayments', 'bdPayments',
        'conversions', 'expenses', 'withdrawals', 'deposits',
        'collectionMethods', 'rateHistory', 'users'
      ];
      stateKeys.forEach(k => {
        const arr = (s as any)[k];
        if (Array.isArray(arr)) {
          appBytes += JSON.stringify(arr).length * 2;
        }
      });
    } catch (_) {}

    let bundleBytes = 0;
    try {
      const resources = performance.getEntriesByType('resource');
      resources.forEach((r: any) => {
        if (r.transferSize) {
          bundleBytes += r.transferSize;
        } else if (r.decodedBodySize) {
          bundleBytes += r.decodedBodySize;
        }
      });
    } catch (_) {}
    if (bundleBytes === 0) {
      bundleBytes = 2.4 * 1024 * 1024;
    }

    const totalBytes = localBytes + appBytes + bundleBytes;
    const quota = 20 * 1024 * 1024;
    const percentage = Math.min((totalBytes / quota) * 100, 100);

    setStats({
      localBytes,
      appBytes,
      bundleBytes,
      totalBytes,
      quota,
      percentage
    });
  }, [isOpen, orders, myPayments, bdPayments, conversions, expenses, withdrawals, deposits, collectionMethods]);

  if (!isOpen) return null;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Storage Utilization</h2>
        <div className="space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>App Bundle Size:</span>
              <span className="font-mono font-medium">{formatSize(stats.bundleBytes)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Database State (Cloud):</span>
              <span className="font-mono font-medium">{formatSize(stats.appBytes)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Local Cache:</span>
              <span className="font-mono font-medium">{formatSize(stats.localBytes)}</span>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold text-slate-900 dark:text-slate-100">
              <span>Total Usage:</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400">{formatSize(stats.totalBytes)}</span>
            </div>
            <div className="pt-1 flex justify-between font-bold text-slate-900 dark:text-slate-100">
              <span>Total Usable Storage:</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">{formatSize(stats.quota)}</span>
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
  title: string; 
  message: string; 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6"
      >
        <div className="flex items-center gap-3 mb-4 text-red-600">
          <AlertCircle size={24} />
          <h3 className="text-lg font-bold">{title}</h3>
        </div>
        <p className="text-slate-600 dark:text-slate-300 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={() => { onConfirm(); onClose(); }}>Delete</Button>
        </div>
      </div>
    </div>
  );
};


const PaymentModal = ({ 
  isOpen, 
  onClose, 
  agent, 
  type, 
  token, 
  onSuccess,
  paymentToEdit
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  agent: any; 
  type: 'MY' | 'BD'; 
  token: string;
  onSuccess: () => void;
  paymentToEdit?: any;
}) => {
  const { orders, bdAgents: allBdAgents, collectionMethods } = useAppStore();
  const [formData, setFormData] = useState({
    amount: '',
    charge: '0',
    payment_method: '',
    sub_method: '',
    date: new Date().toISOString().split('T')[0],
    note: ''
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());
  const [selectedBdAgentId, setSelectedBdAgentId] = useState<string>('');
  const [bdAgents, setBdAgents] = useState<any[]>([]);
  const [transferFromAgentId, setTransferFromAgentId] = useState('');
  const [isTransfer, setIsTransfer] = useState(false);

  const activeAgent = (type === 'BD' && selectedBdAgentId)
    ? (allBdAgents.find(a => String(a.id) === String(selectedBdAgentId)) || agent)
    : agent;

  const filteredMethods = collectionMethods.filter(m => (m.type || 'MY') === type);

  useEffect(() => {
    if (isOpen && agent) {
      const initialBdId = (type === 'BD' && paymentToEdit)
        ? (paymentToEdit.bd_agent_id !== undefined ? String(paymentToEdit.bd_agent_id) : (paymentToEdit.pay_to_bd_agent_id !== undefined ? String(paymentToEdit.pay_to_bd_agent_id) : String(agent.id)))
        : String(agent.id);

      setSelectedBdAgentId(initialBdId);

      const targetAgent = (type === 'BD' && initialBdId)
        ? (allBdAgents.find(a => String(a.id) === String(initialBdId)) || agent)
        : agent;

      if (type === 'BD') {
        const agents = allBdAgents.filter((a: any) => String(a.id) !== String(targetAgent.id));
        setBdAgents(agents);
      }

      if (paymentToEdit) {
        const editAmt = type === 'MY'
          ? (paymentToEdit.amount_myr !== undefined ? String(paymentToEdit.amount_myr) : '')
          : (paymentToEdit.amount_bdt !== undefined ? String(paymentToEdit.amount_bdt) : '');

        let isTrans = false;
        let transSourceId = '';
        if (type === 'BD' && paymentToEdit.note && paymentToEdit.note.includes('Transfer from ')) {
          isTrans = true;
          const match = paymentToEdit.note.match(/Transfer from ([^.]+)\./);
          if (match && match[1]) {
            const sourceAgentName = match[1].trim();
            const found = allBdAgents.find((a: any) => a.name.toLowerCase() === sourceAgentName.toLowerCase());
            if (found) transSourceId = String(found.id);
          }
        }

        setFormData({
          amount: editAmt,
          charge: paymentToEdit.charge !== undefined ? String(paymentToEdit.charge) : '0',
          payment_method: paymentToEdit.payment_method || '',
          sub_method: paymentToEdit.sub_method || '',
          date: paymentToEdit.date || new Date().toISOString().split('T')[0],
          note: paymentToEdit.note || ''
        });
        setIsTransfer(isTrans);
        setTransferFromAgentId(transSourceId);

        const editOrderIds = new Set<number>(
          paymentToEdit.order_ids ? paymentToEdit.order_ids.map((id: any) => Number(id)) : []
        );
        setSelectedOrders(editOrderIds);

        const filtered = orders.filter(o => type === 'MY' ? o.my_agent_id === targetAgent.id : o.bd_agent_id === targetAgent.id);
        const unpaidOrCurrent = filtered.filter(o => o.status !== 'paid' || editOrderIds.has(Number(o.id))).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
        const paidOther = filtered.filter(o => o.status === 'paid' && !editOrderIds.has(Number(o.id))).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
        setRecentOrders([...unpaidOrCurrent, ...paidOther]);
      } else {
        setFormData({
          amount: '',
          charge: '0',
          payment_method: '',
          sub_method: '',
          date: new Date().toISOString().split('T')[0],
          note: ''
        });
        setSelectedOrders(new Set());
        setTransferFromAgentId('');
        setIsTransfer(false);

        const filtered = orders.filter(o => type === 'MY' ? o.my_agent_id === targetAgent.id : o.bd_agent_id === targetAgent.id);
        const unpaid = filtered.filter(o => o.status !== 'paid').sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
        const paid = filtered.filter(o => o.status === 'paid').sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
        setRecentOrders([...unpaid, ...paid]);
      }
    } else {
      setSelectedBdAgentId('');
      setSelectedOrders(new Set());
      setRecentOrders([]);
      setTransferFromAgentId('');
      setIsTransfer(false);
    }
  }, [isOpen, agent, type, orders, allBdAgents, paymentToEdit]);

  if (!isOpen) return null;

  const handleBdAgentChange = (newAgentIdStr: string) => {
    setSelectedBdAgentId(newAgentIdStr);
    const newAgentId = Number(newAgentIdStr);
    const newAgent = allBdAgents.find(a => Number(a.id) === newAgentId);
    if (!newAgent) return;

    const originalAgentId = paymentToEdit?.bd_agent_id !== undefined
      ? Number(paymentToEdit.bd_agent_id)
      : (paymentToEdit?.pay_to_bd_agent_id !== undefined ? Number(paymentToEdit.pay_to_bd_agent_id) : Number(agent?.id));
    const isOriginal = originalAgentId === newAgentId;

    const filtered = orders.filter(o => Number(o.bd_agent_id) === newAgentId);

    if (isOriginal && paymentToEdit) {
      const editOrderIds = new Set<number>(
        paymentToEdit.order_ids ? paymentToEdit.order_ids.map((id: any) => Number(id)) : []
      );
      setSelectedOrders(editOrderIds);
      const unpaidOrCurrent = filtered.filter(o => o.status !== 'paid' || editOrderIds.has(Number(o.id))).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      const paidOther = filtered.filter(o => o.status === 'paid' && !editOrderIds.has(Number(o.id))).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      setRecentOrders([...unpaidOrCurrent, ...paidOther]);
    } else {
      setSelectedOrders(new Set());
      const unpaid = filtered.filter(o => o.status !== 'paid').sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      const paid = filtered.filter(o => o.status === 'paid').sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      setRecentOrders([...unpaid, ...paid]);
    }

    const otherAgents = allBdAgents.filter((a: any) => Number(a.id) !== newAgentId);
    setBdAgents(otherAgents);
    if (transferFromAgentId === newAgentIdStr) {
      setTransferFromAgentId('');
    }
  };

  const editOrderIds = new Set<number>(
    paymentToEdit?.order_ids ? paymentToEdit.order_ids.map((id: any) => Number(id)) : []
  );

  const isOriginalAgent = paymentToEdit ? (
    (paymentToEdit.bd_agent_id !== undefined && Number(paymentToEdit.bd_agent_id) === Number(activeAgent.id)) ||
    (paymentToEdit.pay_to_bd_agent_id !== undefined && Number(paymentToEdit.pay_to_bd_agent_id) === Number(activeAgent.id)) ||
    (!paymentToEdit.bd_agent_id && !paymentToEdit.pay_to_bd_agent_id && Number(agent.id) === Number(activeAgent.id))
  ) : true;

  const toggleOrder = (order: any) => {
    const isPartOfThisPayment = isOriginalAgent && editOrderIds.has(Number(order.id));
    if (order.status === 'paid' && !isPartOfThisPayment && !selectedOrders.has(order.id)) return; // Cannot select paid orders
    
    const newSet = new Set(selectedOrders);
    if (newSet.has(order.id)) {
      newSet.delete(order.id);
    } else {
      newSet.add(order.id);
    }
    setSelectedOrders(newSet);
    
    let total = 0;
    recentOrders.forEach(o => {
      if (newSet.has(o.id)) {
        const isOriginal = isOriginalAgent && editOrderIds.has(Number(o.id));
        let orderAmount = 0;
        if (isOriginal && paymentToEdit?.order_allocations?.[o.id] !== undefined) {
          orderAmount = Number(paymentToEdit.order_allocations[o.id]);
        } else if (isOriginal) {
          orderAmount = type === 'MY' ? Number(o.amount_myr) : Number(o.amount_bdt);
        } else {
          orderAmount = (o.remaining_balance !== undefined && o.remaining_balance > 0)
            ? Number(o.remaining_balance)
            : (type === 'MY' ? Number(o.amount_myr) : Number(o.amount_bdt));
        }
        total += orderAmount || 0;
      }
    });
    setFormData(prev => ({ ...prev, amount: total > 0 ? total.toFixed(2) : '' }));
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedOrderIds = recentOrders
      .filter(o => selectedOrders.has(o.id))
      .map(o => o.id);

    const targetBdAgentId = type === 'BD'
      ? (selectedBdAgentId ? parseInt(selectedBdAgentId) : agent.id)
      : agent.id;

    if (paymentToEdit) {
      if (paymentToEdit.is_conversion) {
        await store.updateConversion(paymentToEdit.id, {
          date: formData.date,
          amount_bdt: parseFloat(formData.amount),
          note: formData.note,
          pay_to_bd_agent_id: type === 'BD' ? targetBdAgentId : undefined
        });
      } else if (type === 'MY') {
        await store.updateMYPayment(paymentToEdit.id, {
          amount_myr: parseFloat(formData.amount),
          payment_method: formData.payment_method,
          sub_method: formData.sub_method,
          date: formData.date,
          note: formData.note,
          order_ids: selectedOrderIds
        });
      } else {
        let noteText = formData.note;
        if (isTransfer && transferFromAgentId) {
          const sourceAgent = allBdAgents.find(a => a.id === parseInt(transferFromAgentId));
          if (sourceAgent && !noteText.includes(`Transfer from ${sourceAgent.name}`)) {
            noteText = `Transfer from ${sourceAgent.name}. ${noteText}`;
          }
        }
        await store.updateBDPayment(paymentToEdit.id, {
          bd_agent_id: targetBdAgentId,
          amount_bdt: parseFloat(formData.amount),
          charge: type === 'BD' ? (parseFloat(formData.charge) || 0) : undefined,
          payment_method: formData.payment_method,
          sub_method: formData.sub_method,
          date: formData.date,
          note: noteText,
          order_ids: selectedOrderIds
        });
      }
    } else {
      if (type === 'BD' && isTransfer && transferFromAgentId) {
         const amount = parseFloat(formData.amount);
         const charge = parseFloat(formData.charge) || 0;
         const sourceAgent = allBdAgents.find(a => a.id === parseInt(transferFromAgentId));
         
         // Credit current agent and debit source agent in parallel
         await Promise.all([
           store.addBDPayment({ 
             bd_agent_id: targetBdAgentId, 
             amount_bdt: amount, 
             charge: 0,
             payment_method: formData.payment_method, 
             sub_method: formData.sub_method,
             date: formData.date, 
             note: `Transfer from ${sourceAgent?.name}.${charge > 0 ? ` (Transfer Charge: ${charge} BDT)` : ''} ${formData.note}`, 
             order_ids: selectedOrderIds 
           }),
           store.addBDPayment({ 
             bd_agent_id: parseInt(transferFromAgentId), 
             amount_bdt: -amount, 
             charge: charge,
             payment_method: formData.payment_method, 
             sub_method: formData.sub_method,
             date: formData.date, 
             note: `Transfer to ${activeAgent.name}.${charge > 0 ? ` (Transfer Charge: ${charge} BDT)` : ''} ${formData.note}`, 
             order_ids: [] 
           })
         ]);
      } else {
        const payload = type === 'MY' 
          ? { my_agent_id: agent.id, amount_myr: parseFloat(formData.amount), payment_method: formData.payment_method, sub_method: formData.sub_method, date: formData.date, note: formData.note, order_ids: selectedOrderIds }
          : { 
              bd_agent_id: targetBdAgentId, 
              amount_bdt: parseFloat(formData.amount), 
              charge: parseFloat(formData.charge) || 0,
              payment_method: formData.payment_method, 
              sub_method: formData.sub_method, 
              date: formData.date, 
              note: formData.note, 
              order_ids: selectedOrderIds 
            };

        if (type === 'MY') {
          await store.addMYPayment(payload);
        } else {
          await store.addBDPayment(payload);
        }
      }
    }

    setFormData({
      amount: '',
      charge: '0',
      payment_method: '',
      sub_method: '',
      date: new Date().toISOString().split('T')[0],
      note: ''
    });
    setTransferFromAgentId('');
    setIsTransfer(false);
    onSuccess();
    onClose();
  };

  const selectableOrders = recentOrders.filter(o => o.status !== 'paid' || (isOriginalAgent && editOrderIds.has(Number(o.id))) || selectedOrders.has(o.id));

  return (
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-[60] overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 md:p-6 min-h-screen flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {paymentToEdit ? `Edit Payment - ${activeAgent.name}` : `Add Payment - ${activeAgent.name}`}
            </h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">
              {type === 'MY' ? 'Incoming Funds (RM)' : 'Outgoing Funds (BDT)'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"><Plus className="rotate-45 w-6 h-6 text-slate-600 dark:text-slate-400" /></button>
        </div>
        
        <div className="grid gap-6 flex-1 grid-cols-1 md:grid-cols-2">
          <div>
            <Card className="p-5">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">Payment Details</h3>
              <form id="payment-form" onSubmit={handlePaymentSubmit} className="space-y-4">
                {type === 'BD' && (
                  <div>
                    <SearchableSelect 
                      label={paymentToEdit ? "Change BD (BD Agent)" : "BD Agent"}
                      value={selectedBdAgentId} 
                      onChange={val => handleBdAgentChange(val)}
                      options={allBdAgents.map(a => ({ value: String(a.id), label: a.name }))} 
                      required
                    />
                  </div>
                )}

                <div className={type === 'BD' ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : ""}>
                  <Input 
                    label={`Amount (${type === 'MY' ? 'RM' : 'BDT'})`} 
                    type="number" 
                    step="0.01" 
                    value={formData.amount} 
                    onChange={e => setFormData({...formData, amount: e.target.value})} 
                    required 
                  />
                  {type === 'BD' && (
                    <Input 
                      label="Charge (BDT)" 
                      type="number" 
                      step="0.01" 
                      value={formData.charge} 
                      onChange={e => setFormData({...formData, charge: e.target.value})} 
                      placeholder="0.00"
                    />
                  )}
                </div>
                
                {type === 'BD' && (
                  <div className="flex items-center gap-2 py-1">
                    <input 
                      type="checkbox" 
                      id="is_transfer" 
                      checked={isTransfer} 
                      onChange={e => {
                        setIsTransfer(e.target.checked);
                        if (!e.target.checked) setTransferFromAgentId('');
                      }}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white focus:ring-slate-900 dark:focus:ring-white"
                    />
                    <label htmlFor="is_transfer" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Transfer from another agent?
                    </label>
                  </div>
                )}

                {isTransfer && (
                  <SearchableSelect 
                    label="Transfer From Agent" 
                    value={transferFromAgentId} 
                    onChange={val => setTransferFromAgentId(val)}
                    options={[{value: '', label: 'Select Source Agent'}, ...bdAgents.map(a => ({value: a.id, label: a.name}))]} 
                    required
                  />
                )}

                <div className="space-y-3">
                  <Select 
                    label="Payment Method" 
                    value={formData.payment_method} 
                    onChange={e => setFormData({...formData, payment_method: e.target.value, sub_method: ''})}
                    options={[
                      {value: '', label: 'Select Method'}, 
                      ...filteredMethods.map(m => ({value: m.name, label: m.name}))
                    ]}
                    required
                  />

                  <Select 
                    label="Sub-Method" 
                    value={formData.sub_method} 
                    onChange={e => setFormData({...formData, sub_method: e.target.value})}
                    options={[
                      {value: '', label: 'Select Sub-Method'}, 
                      ...(formData.payment_method 
                        ? filteredMethods.find(m => m.name === formData.payment_method)?.subItems.map(s => ({value: s.name, label: s.name})) || []
                        : []
                      )
                    ]} 
                    required
                  />
                </div>

                <Input 
                  label="Payment Date" 
                  type="date" 
                  value={formData.date} 
                  onChange={e => setFormData({...formData, date: e.target.value})} 
                  required 
                />
                <Input 
                  label="Remark" 
                  value={formData.note} 
                  onChange={e => setFormData({...formData, note: e.target.value})} 
                  placeholder="Optional notes" 
                />
                <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                  {paymentToEdit && (
                    <Button variant="outline" className="flex-1" onClick={onClose} type="button">Cancel</Button>
                  )}
                  <Button type="submit" form="payment-form" className={paymentToEdit ? "flex-1" : "w-full"}>
                    {paymentToEdit ? "Save Changes" : "Confirm Payment"}
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          <div>
            <Card className="p-5 h-full flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-900 dark:text-white">Select Orders to Knock Off ({activeAgent.name})</h3>
                <div className="flex gap-2">
                  {selectableOrders.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      className="h-8 px-2 text-xs"
                      onClick={() => {
                        if (selectedOrders.size === selectableOrders.length) {
                          setSelectedOrders(new Set());
                          setFormData(prev => ({ ...prev, amount: '' }));
                        } else {
                          const newSet = new Set(selectableOrders.map(o => o.id));
                          setSelectedOrders(newSet);
                          let total = 0;
                          selectableOrders.forEach(o => {
                            const isOriginal = isOriginalAgent && editOrderIds.has(Number(o.id));
                            let orderAmount = 0;
                            if (isOriginal && paymentToEdit?.order_allocations?.[o.id] !== undefined) {
                              orderAmount = Number(paymentToEdit.order_allocations[o.id]);
                            } else if (isOriginal) {
                              orderAmount = type === 'MY' ? Number(o.amount_myr) : Number(o.amount_bdt);
                            } else {
                              orderAmount = (o.remaining_balance !== undefined && o.remaining_balance > 0)
                                ? Number(o.remaining_balance)
                                : (type === 'MY' ? Number(o.amount_myr) : Number(o.amount_bdt));
                            }
                            total += orderAmount || 0;
                          });
                          setFormData(prev => ({ ...prev, amount: total > 0 ? total.toFixed(2) : '' }));
                        }
                      }}
                    >
                      {selectedOrders.size === selectableOrders.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  )}
                  {selectedOrders.size > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      type="button"
                      className="text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-900/50 dark:hover:bg-amber-900/20 h-8 px-2 text-xs"
                      onClick={async () => {
                        const selectedOrderIds = recentOrders
                          .filter(o => selectedOrders.has(o.id))
                          .map(o => o.id);
                        await store.markOrdersAsPaid(selectedOrderIds, type);
                        setSelectedOrders(new Set());
                      }}
                    >
                      Mark as Paid
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-2 max-h-[60vh]">
                {recentOrders.length > 0 ? recentOrders.map((order, idx) => {
                  const isPartOfThisPayment = isOriginalAgent && editOrderIds.has(Number(order.id));
                  const isSelected = selectedOrders.has(order.id);
                  const isPaid = order.status === 'paid' && !isPartOfThisPayment && !isSelected;
                  const amount = type === 'MY' ? order.amount_myr : order.amount_bdt;
                  
                  return (
                    <div 
                      key={`${order.id}-${idx}`} 
                      onClick={() => toggleOrder(order)}
                      className={cn(
                        "grid grid-cols-12 gap-2 items-center p-3 rounded-xl border transition-all text-xs",
                        isPaid ? "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed" : "cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700",
                        isSelected ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-sm" : "border-slate-200 dark:border-slate-700"
                      )}
                    >
                      <div className="col-span-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white">{formatDate(order.date)}</div>
                        {order.status === 'paid' && <span className="text-[9px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1 py-0.5 rounded uppercase">Paid</span>}
                        {order.status === 'partial' && <span className="text-[9px] font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-1 py-0.5 rounded uppercase">Partial</span>}
                      </div>
                      <div className="col-span-2 text-slate-500 dark:text-slate-400">
                        {order.type}
                      </div>
                      <div className="col-span-4 text-slate-500 dark:text-slate-400 truncate" title={order.remark}>
                        {order.remark || '-'}
                      </div>
                      <div className="col-span-3 text-right">
                        <div className={cn("font-bold", isPaid ? "text-slate-500 dark:text-slate-500" : "text-slate-900 dark:text-white")}>
                          {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[9px] text-slate-400">
                           {type === 'MY' ? order.amount_bdt.toLocaleString() + ' BDT' : formatCurrency(order.amount_myr)}
                        </div>
                        {order.remaining_balance !== undefined && order.remaining_balance > 0 && (
                          <div className="text-[9px] text-amber-500 font-bold">
                            Due: {order.remaining_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">No recent orders found.</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

function ViewPaymentsModal({ 
  isOpen, 
  onClose, 
  agent, 
  type, 
  token,
  onViewLedger,
  onSuccess
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  agent: any; 
  type: 'MY' | 'BD'; 
  token: string;
  onViewLedger?: () => void;
  onSuccess?: () => void;
}) {
  const { myPayments, bdPayments, conversions, collectionMethods } = useAppStore();
  const [filterDate, setFilterDate] = useState('');
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });

  const payments = type === 'MY' 
    ? myPayments.filter(p => Number(p.my_agent_id) === Number(agent.id)) 
    : store.getBDPayments(agent.id);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
        direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const handleDelete = (id: number) => {
    setPaymentToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!paymentToDelete) return;
    const paymentObj = payments.find((p: any) => p.id === paymentToDelete);
    if (paymentObj && (paymentObj as any).is_conversion) {
      await store.deleteConversion(paymentToDelete);
    } else if (type === 'MY') {
      await store.deleteMYPayment(paymentToDelete);
    } else {
      await store.deleteBDPayment(paymentToDelete);
    }
    if (onSuccess) onSuccess();
    setPaymentToDelete(null);
    setShowDeleteConfirm(false);
  };

  const filteredMethods = collectionMethods.filter(m => (m.type || 'MY') === type);

  const handleEditClick = (p: any) => {
    setEditingPayment(p);
  };

  if (!isOpen) return null;

  const filteredPayments = payments.filter(p => !filterDate || p.date === filterDate);
  const sortedPayments = [...filteredPayments].sort((a, b) => {
    let aVal = (a as any)[sortConfig.key];
    let bVal = (b as any)[sortConfig.key];
    
    if (sortConfig.key === 'date') {
        aVal = new Date(aVal as string).getTime();
        bVal = new Date(bVal as string).getTime();
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });
  const totalPages = Math.ceil(sortedPayments.length / itemsPerPage);
  const currentPayments = sortedPayments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="fixed inset-0 bg-slate-50 z-50 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 md:p-6 min-h-screen flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Payments - {agent.name}</h2>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mt-1">
              {type === 'MY' ? 'Incoming Funds (RM)' : 'Outgoing Funds (BDT)'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onViewLedger && (
              <Button variant="outline" size="sm" onClick={onViewLedger} className="h-9 px-3 text-xs gap-2 border-slate-200 hover:bg-slate-100">
                <Receipt size={14} /> View Ledger
              </Button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><Plus className="rotate-45 w-6 h-6 text-slate-600" /></button>
          </div>
        </div>
        
        <Card className="p-5 flex-1 flex flex-col">
          <div className="mb-4">
            <Input label="Filter by Date" type="date" value={filterDate} onChange={e => { setFilterDate(e.target.value); setCurrentPage(1); }} />
          </div>

          <div className="overflow-y-auto flex-1">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase cursor-pointer" onClick={() => handleSort('date')}>Date {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} className="inline" /> : <ChevronDown size={12} className="inline" />)}</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase">Method</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase">Amount</th>
                  {type === 'BD' && (
                    <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase">Charge</th>
                  )}
                  <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase">Remark</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentPayments.map((p, idx) => (
                  <tr key={`${p.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{formatDate(p.date)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase w-fit",
                          p.payment_method === 'bkash' ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700"
                        )}>
                          {p.payment_method}
                        </span>
                        {p.sub_method && (
                          <span className="text-[10px] text-slate-500 font-medium mt-0.5 ml-0.5">
                            {p.sub_method}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs font-bold">{type === 'MY' ? formatCurrency((p as MYPayment).amount_myr) : `${(p as BDPayment).amount_bdt.toLocaleString()} BDT`}</td>
                    {type === 'BD' && (
                      <td className="px-3 py-2 text-xs font-mono text-slate-600 dark:text-slate-400">
                        {Number((p as BDPayment).charge || 0) > 0 ? `${Number((p as BDPayment).charge).toLocaleString()} BDT` : '-'}
                      </td>
                    )}
                    <td className="px-3 py-2 text-xs text-slate-500">{p.note}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => handleEditClick(p)} className="p-1 text-slate-400 hover:text-blue-600 rounded"><Edit size={14} /></button>
                        <button onClick={() => handleDelete(p.id)} className="p-1 text-slate-400 hover:text-red-600 rounded"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {filteredPayments.length > 0 && (
                <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-200 sticky bottom-0 z-10">
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-xs text-slate-900 text-right border-r border-slate-200">TOTAL:</td>
                    <td className="px-3 py-2 text-xs text-slate-900 border-r border-slate-200">
                      {type === 'MY' 
                        ? formatCurrency(filteredPayments.reduce((sum, p) => sum + Number((p as MYPayment).amount_myr), 0))
                        : `${filteredPayments.reduce((sum, p) => sum + Number((p as BDPayment).amount_bdt), 0).toLocaleString()} BDT`
                      }
                    </td>
                    {type === 'BD' && (
                      <td className="px-3 py-2 text-xs text-slate-900 border-r border-slate-200">
                        {`${filteredPayments.reduce((sum, p) => sum + (Number((p as BDPayment).charge) || 0), 0).toLocaleString()} BDT`}
                      </td>
                    )}
                    <td className="px-3 py-2 border-r border-slate-200"></td>
                    <td className="px-3 py-2"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-4">
              <div className="text-xs text-slate-500">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredPayments.length)} of {filteredPayments.length} entries
              </div>
              <div className="flex gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 px-2 text-xs"
                >
                  Previous
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "primary" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="h-8 w-8 p-0 text-xs"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 px-2 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {editingPayment && (
        <PaymentModal
          isOpen={!!editingPayment}
          onClose={() => setEditingPayment(null)}
          agent={agent}
          type={type}
          token={token}
          onSuccess={() => {
            setEditingPayment(null);
            if (onSuccess) onSuccess();
          }}
          paymentToEdit={editingPayment}
        />
      )}

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Payment"
        message="Are you sure you want to delete this payment? This action cannot be undone."
      />
    </div>
  );
}

function ViewLedgerModal({ 
  isOpen, 
  onClose, 
  agent, 
  type 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  agent: any; 
  type: 'MY' | 'BD'; 
}) {
  const { stats, conversions, orders, myPayments, bdPayments, fontSize, fontStyle } = useAppStore();
  const [reportData, setReportData] = useState<any>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (isOpen && agent) fetchLedger();
  }, [isOpen, agent, startDate, endDate, stats, conversions, orders, myPayments, bdPayments]);

  const fetchLedger = () => {
    if (!agent) return;
    const filters = {
      type: 'ledger',
      [type === 'MY' ? 'my_agent_id' : 'bd_agent_id']: agent.id.toString(),
      start_date: startDate,
      end_date: endDate
    };
    const data = store.getReports(filters);
    setReportData(data);
  };

  if (!isOpen || !agent) return null;

  const { data, columns } = reportData || { data: [], columns: [] };

  const exportToPDF = () => {
    if (!reportData || !reportData.data || !reportData.columns) return;
    const doc = new jsPDF();
    const { data, columns } = reportData;
    
    const columnTotals = columns.map((col: string, index: number) => {
      if (index === 0) return 'TOTAL';
      if (col === 'Rate') return '';
      if (col === 'Balance') {
        if (data.length === 0) return '';
        const lastRow = data[data.length - 1];
        const balance = Object.values(lastRow)[index];
        return typeof balance === 'number' ? balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
      }
      let sum = 0;
      let hasNumeric = false;
      data.forEach((row: any) => {
        const val = Object.values(row)[index];
        if (typeof val === 'number') {
          sum += val;
          hasNumeric = true;
        }
      });
      return hasNumeric ? sum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
    });

    const bodyData = data.map((row: any) => Object.values(row).map((val: any) => 
      typeof val === 'number' ? val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : val
    ));

    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text(`AGENT LEDGER REPORT - ${agent.name}`, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Juel Money Transfer Apps (${startDate ? formatDate(startDate) : 'Beginning'} — ${endDate ? formatDate(endDate) : 'Present'})`, 14, 28);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 34);

    autoTable(doc, {
      startY: 42,
      head: [columns],
      body: bodyData,
      foot: [columnTotals],
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] },
      footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: 'bold' }
    });

    doc.save(`ledger_${agent.name.toLowerCase().replace(/\s+/g, '_')}_report.pdf`);
  };

  const exportToExcel = () => {
    if (!reportData || !reportData.data || !reportData.columns) return;
    const { data, columns } = reportData;
    const columnTotals = columns.map((col: string, index: number) => {
      if (index === 0) return 'TOTAL';
      if (col === 'Rate') return '';
      if (col === 'Balance') {
        if (data.length === 0) return '';
        const lastRow = data[data.length - 1];
        const balance = Object.values(lastRow)[index];
        return typeof balance === 'number' ? balance.toFixed(2) : '';
      }
      let sum = 0;
      let hasNumeric = false;
      data.forEach((row: any) => {
        const val = Object.values(row)[index];
        if (typeof val === 'number') {
          sum += val;
          hasNumeric = true;
        }
      });
      return hasNumeric ? sum.toFixed(2) : '';
    });

    const exportData = data.map((row: any) => {
      const newRow: any = {};
      Object.keys(row).forEach((key, i) => {
        const val = Object.values(row)[i];
        newRow[columns[i]] = typeof val === 'number' ? val.toFixed(2) : val;
      });
      return newRow;
    });

    if (data.length > 0) {
      const totalRow: any = {};
      columns.forEach((col: string, i: number) => {
        totalRow[col] = columnTotals[i];
      });
      exportData.push(totalRow);
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ledger");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `ledger_${agent.name.toLowerCase().replace(/\s+/g, '_')}_report.xlsx`);
  };

  const exportToJPG = async () => {
    const element = document.getElementById('ledger-modal-content');
    if (!element) return;
    try {
      const dataUrl = await toJpeg(element, {
        backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
        pixelRatio: 2,
        skipFonts: true,
        fontEmbedCSS: ''
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `ledger_${agent.name.toLowerCase().replace(/\s+/g, '_')}_report.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
    }
  };

  const columnTotals = columns.map((col: string, index: number) => {
    if (index === 0) return 'TOTAL';
    if (col === 'Rate') return '';
    if (col === 'Balance') {
      if (data.length === 0) return '';
      const lastRow = data[data.length - 1];
      const balance = Object.values(lastRow)[index];
      return typeof balance === 'number' ? balance : '';
    }
    let sum = 0;
    let hasNumeric = false;
    data.forEach((row: any) => {
      const rowValues = Object.values(row);
      const val = rowValues[index];
      if (typeof val === 'number') {
        sum += val;
        hasNumeric = true;
      }
    });
    return hasNumeric ? Number(sum.toFixed(2)) : '';
  });

  return (
    <div className={cn("fixed inset-0 bg-slate-50 dark:bg-slate-950 z-50 overflow-y-auto", fontStyle, fontSize)}>
      <div className="max-w-6xl mx-auto p-4 md:p-6 min-h-screen flex flex-col">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="text-emerald-600" size={22} />
              Agent Ledger - {agent.name}
            </h2>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Full Transaction History ({type === 'MY' ? 'RM' : 'BDT'}) &bull; Juel Money Transfer Apps
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" className="text-xs py-1.5 h-9" onClick={fetchLedger}>
              <RefreshCw size={14} />
            </Button>
            <Button variant="outline" className="text-xs py-1.5 h-9" onClick={exportToPDF}>Export PDF</Button>
            <Button variant="outline" className="text-xs py-1.5 h-9" onClick={exportToExcel}>Export Excel</Button>
            <Button variant="outline" className="text-xs py-1.5 h-9" onClick={exportToJPG}>Export JPG</Button>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors ml-2">
              <Plus className="rotate-45 w-6 h-6 text-slate-600 dark:text-slate-400" />
            </button>
          </div>
        </div>

        <Card className="p-4 mb-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Start Date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <Input label="End Date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </Card>
        
        <div id="ledger-modal-content" className="space-y-4 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 flex-1 flex flex-col">
          <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4 mb-2">
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                AGENT LEDGER REPORT - {agent.name}
              </h1>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">
                Juel Money Transfer Apps ({startDate ? formatDate(startDate) : 'Beginning'} - {endDate ? formatDate(endDate) : 'Present'})
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Generated On</p>
              <p className="text-xs font-mono text-slate-900 dark:text-white">{new Date().toLocaleString()}</p>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  {columns.map((col: string) => (
                    <th key={col} className="px-3 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700 last:border-r-0">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.length > 0 ? data.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    {Object.values(row).map((val: any, j: number) => {
                      const colName = columns[j];
                      return (
                        <td key={j} className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 last:border-r-0 whitespace-nowrap">
                          {typeof val === 'number' ? (
                            <span className={cn(
                              colName === 'Debit' ? "text-red-600 dark:text-red-400 font-medium" : "",
                              colName === 'Credit' ? "text-emerald-600 dark:text-emerald-400 font-medium" : "",
                              colName === 'Withdraw' ? "text-red-600 dark:text-red-400 font-medium" : "",
                              colName.includes('Collection') ? "text-emerald-600 dark:text-emerald-400 font-medium" : "",
                              colName === 'Balance' ? "font-bold text-slate-900 dark:text-white" : ""
                            )}>
                              {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            colName.toLowerCase().includes('date') ? formatDate(val as string) : val
                          )}
                        </td>
                      );
                    })}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400 text-xs italic">No transactions found for this period.</td>
                  </tr>
                )}
              </tbody>
              {data.length > 0 && (
                <tfoot className="bg-slate-50 dark:bg-slate-800 font-bold border-t-2 border-slate-200 dark:border-slate-700">
                  <tr>
                    {columnTotals.map((total: any, i: number) => (
                      <td key={i} className={cn(
                        "px-3 py-3 text-xs border-r border-slate-200 dark:border-slate-700 last:border-r-0",
                        i === 0 ? "text-slate-900 dark:text-white text-right tracking-wider uppercase font-bold" : "text-slate-900 dark:text-white"
                      )}>
                        {typeof total === 'number' ? total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : total}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}


function ViewTransactionsModal({ 
  isOpen, 
  onClose, 
  agent, 
  type, 
  token 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  agent: any; 
  type: 'MY' | 'BD'; 
  token: string; 
}) {
  const { orders, fontSize, fontStyle } = useAppStore();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  if (!isOpen) return null;

  const transactions = orders.filter(o => type === 'MY' ? o.my_agent_id === agent.id : o.bd_agent_id === agent.id);

  const filteredTransactions = transactions.filter(t => {
    if (startDate && t.date < startDate) return false;
    if (endDate && t.date > endDate) return false;
    return true;
  });

  return (
    <div className={cn("fixed inset-0 bg-slate-50 dark:bg-slate-950 z-50 overflow-y-auto", fontStyle, fontSize)}>
      <div className="max-w-4xl mx-auto p-4 md:p-6 min-h-screen flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Transactions - {agent.name}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"><Plus className="rotate-45 w-6 h-6 text-slate-600 dark:text-slate-300" /></button>
        </div>
        
        <Card className="p-5 flex-1 flex flex-col">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input label="Start Date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <Input label="End Date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>

          <div className="overflow-y-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase w-32 border-r border-slate-200 dark:border-slate-700">Date</th>
                  <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">Type</th>
                  <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">BDT</th>
                  <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">Rate</th>
                  <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">RM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTransactions.map((t, idx) => (
                  <tr key={`${t.id}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-2 py-2 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap border-r border-slate-200 dark:border-slate-700">{formatDate(t.date)}</td>
                    <td className="px-2 py-2 border-r border-slate-200 dark:border-slate-700">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase",
                        t.type === 'bkash' ? "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300" : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                      )}>
                        {t.type}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-xs font-medium text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">{t.amount_bdt.toLocaleString()}</td>
                    <td className="px-2 py-2 text-xs text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700">{t.rate && !isNaN(Number(t.rate)) ? Number(t.rate).toFixed(2) : t.rate || '-'}</td>
                    <td className="px-2 py-2 text-xs font-bold text-slate-900 dark:text-white">{formatCurrency(t.amount_myr)}</td>
                  </tr>
                ))}
              </tbody>
              {filteredTransactions.length > 0 && (
                <tfoot className="bg-slate-50 dark:bg-slate-800 font-bold border-t-2 border-slate-200 dark:border-slate-700 sticky bottom-0 z-10">
                  <tr>
                    <td colSpan={2} className="px-2 py-2 text-xs text-slate-900 dark:text-white text-right border-r border-slate-200 dark:border-slate-700">TOTAL:</td>
                    <td className="px-2 py-2 text-xs text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">{filteredTransactions.reduce((sum, t) => sum + Number(t.amount_bdt), 0).toLocaleString()}</td>
                    <td className="px-2 py-2 text-xs text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">-</td>
                    <td className="px-2 py-2 text-xs text-slate-900 dark:text-white">{formatCurrency(filteredTransactions.reduce((sum, t) => sum + Number(t.amount_myr), 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

const ProfileSidebar = ({ 
  isOpen, 
  onClose, 
  theme, 
  onThemeChange, 
  user, 
  onLogout,
  fontSize,
  setFontSize,
  fontStyle,
  setFontStyle,
  onOpenSecurity,
  onOpenStorage
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  theme: 'light' | 'dark'; 
  onThemeChange: (theme: 'light' | 'dark') => void;
  user: User | null;
  onLogout: () => void;
  fontSize: string;
  setFontSize: (size: string) => void;
  fontStyle: string;
  setFontStyle: (style: string) => void;
  onOpenSecurity: () => void;
  onOpenStorage: () => void;
}) => {
  const { collectionMethods, setDateFormat } = useAppStore();
  const [newMethod, setNewMethod] = useState('');
  const [expandedMethodId, setExpandedMethodId] = useState<number | null>(null);
  const [editingMethodId, setEditingMethodId] = useState<number | null>(null);
  const [editingSubId, setEditingSubId] = useState<{methodId: number, subId: number} | null>(null);
  const [editValue, setEditValue] = useState('');
  const [selectedType, setSelectedType] = useState<'MY' | 'BD'>('MY');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showFontSizeModal, setShowFontSizeModal] = useState(false);
  const [showDateFormatModal, setShowDateFormatModal] = useState(false);
  const [showFontStyleModal, setShowFontStyleModal] = useState(false);
  const [detailsData, setDetailsData] = useState<{
    type: 'method' | 'subItem';
    methodId: number;
    subId?: number;
    name: string;
    initial_balance: number;
    initial_balance_date: string;
  } | null>(null);

  const handleAddMethod = () => {
    if (newMethod.trim()) {
      store.addCollectionMethod(newMethod, selectedType);
      setNewMethod('');
    }
  };

  const handleDeleteMethod = (id: number) => {
    store.deleteCollectionMethod(id);
  };

  const handleUpdateMethod = (id: number) => {
    if (editValue.trim()) {
      store.updateCollectionMethod(id, { name: editValue });
      setEditingMethodId(null);
      setEditValue('');
    }
  };

  const handleUpdateSubItem = (methodId: number, subId: number) => {
    if (editValue.trim()) {
      store.updateCollectionMethodSubItem(methodId, subId, { name: editValue });
      setEditingSubId(null);
      setEditValue('');
    }
  };

  const handleSaveDetails = () => {
    if (!detailsData) return;

    if (detailsData.type === 'method') {
      store.updateCollectionMethod(detailsData.methodId, {
        name: detailsData.name,
        initial_balance: detailsData.initial_balance,
        initial_balance_date: detailsData.initial_balance_date
      });
    } else if (detailsData.type === 'subItem' && detailsData.subId) {
      store.updateCollectionMethodSubItem(detailsData.methodId, detailsData.subId, {
        name: detailsData.name,
        initial_balance: detailsData.initial_balance,
        initial_balance_date: detailsData.initial_balance_date
      });
    }
    setShowDetailsModal(false);
    setDetailsData(null);
  };

  const filteredMethods = collectionMethods.filter(m => (m.type || 'MY') === selectedType);

  return (
    <>
      {isOpen && (
        <>
          <div 
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
          />
          <aside 
            className="fixed inset-y-0 right-0 w-80 bg-white dark:bg-slate-900 shadow-2xl z-[70] flex flex-col"
          >
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-base dark:text-white">Settings</h3>
              <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500">
                <Plus className="rotate-45" size={20} />
              </button>
            </div>

              <div className={cn("flex-1 overflow-y-auto p-4 space-y-6", fontSize, fontStyle)}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Appearance</h5>
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button 
                      onClick={() => onThemeChange('light')}
                      className={cn(
                        "p-2 rounded-md transition-all",
                        theme === 'light' 
                          ? "bg-white dark:bg-slate-700 text-yellow-500 shadow-sm" 
                          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      )}
                    >
                      <Sun className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onThemeChange('dark')}
                      className={cn(
                        "p-2 rounded-md transition-all",
                        theme === 'dark' 
                          ? "bg-white dark:bg-slate-700 text-indigo-400 shadow-sm" 
                          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      )}
                    >
                      <Moon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex gap-2 relative">
                  <button onClick={() => { setShowFontSizeModal(!showFontSizeModal); setShowFontStyleModal(false); setShowDateFormatModal(false); }} className="flex-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 py-1.5 rounded uppercase">Font Size</button>
                  <button onClick={() => { setShowFontStyleModal(!showFontStyleModal); setShowFontSizeModal(false); setShowDateFormatModal(false); }} className="flex-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 py-1.5 rounded uppercase">Font Style</button>
                  <button onClick={() => { setShowDateFormatModal(!showDateFormatModal); setShowFontSizeModal(false); setShowFontStyleModal(false); }} className="flex-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 py-1.5 rounded uppercase">Date Format</button>
                  
                  {showDateFormatModal && (
                    <div className="absolute top-10 left-0 right-0 bg-white dark:bg-slate-900 border rounded-lg shadow-xl p-2 z-10 space-y-1">
                      {['DD-MM-YYYY', 'YYYY-MM-DD', 'MM-DD-YYYY'].map(format => (
                        <button key={format} onClick={() => { setDateFormat(format); setShowDateFormatModal(false); }} className="w-full text-left text-xs p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">{format}</button>
                      ))}
                    </div>
                  )}

                  {showFontSizeModal && (
                    <div className="absolute top-10 left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl p-2 z-20 space-y-1">
                      {[
                        { size: 'text-xs', label: 'Extra Small (Default)' },
                        { size: 'text-sm', label: 'Small' },
                        { size: 'text-base', label: 'Medium' },
                        { size: 'text-lg', label: 'Large' },
                        { size: 'text-xl', label: 'Extra Large' }
                      ].map(item => (
                        <button 
                          key={item.size} 
                          onClick={() => { setFontSize(item.size); setShowFontSizeModal(false); }} 
                          className={cn(
                            "w-full text-left text-xs p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center justify-between transition-colors",
                            fontSize === item.size ? "bg-slate-100 dark:bg-slate-800 font-bold text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-slate-300"
                          )}
                        >
                          <span>{item.label}</span>
                          {fontSize === item.size && <Check size={14} className="text-indigo-600 dark:text-indigo-400" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {showFontStyleModal && (
                    <div className="absolute top-10 left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl p-2 z-20 space-y-1 max-h-72 overflow-y-auto">
                      {[
                        { name: 'Inter (Clean Sans)', class: 'font-inter' },
                        { name: 'Plus Jakarta Sans (Crisp Modern)', class: 'font-jakarta' },
                        { name: 'Poppins (Geometric Sans)', class: 'font-poppins' },
                        { name: 'Roboto (Standard Sans)', class: 'font-roboto' },
                        { name: 'Outfit (Contemporary)', class: 'font-outfit' },
                        { name: 'Open Sans (Friendly Sans)', class: 'font-opensans' },
                        { name: 'Lato (Balanced Sans)', class: 'font-lato' },
                        { name: 'Montserrat (Pro Sans)', class: 'font-montserrat' },
                        { name: 'Merriweather (Book Serif)', class: 'font-merriweather' },
                        { name: 'Playfair Display (Luxury Serif)', class: 'font-playfair' },
                        { name: 'JetBrains Mono (Developer Mono)', class: 'font-jetbrains' },
                        { name: 'Courier Prime (Classic Typewriter)', class: 'font-courier' },
                        { name: 'System Sans-Serif', class: 'font-sans' },
                        { name: 'System Serif', class: 'font-serif' },
                        { name: 'System Monospace', class: 'font-mono' }
                      ].map((style, i) => (
                        <button 
                          key={i} 
                          onClick={() => { setFontStyle(style.class); setShowFontStyleModal(false); }} 
                          className={cn(
                            "w-full text-left text-xs p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center justify-between transition-colors", 
                            style.class,
                            fontStyle === style.class ? "bg-slate-100 dark:bg-slate-800 font-bold text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-slate-300"
                          )}
                        >
                          <span className={style.class}>{style.name}</span>
                          {fontStyle === style.class && <Check size={14} className="text-indigo-600 dark:text-indigo-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Security</h5>
                <button 
                  onClick={() => { onOpenSecurity(); onClose(); }}
                  className="w-full flex items-center justify-between p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <Clock size={16} />
                    Inactivity Settings
                  </span>
                </button>
                <button 
                  onClick={() => { onOpenStorage(); onClose(); }}
                  className="w-full flex items-center justify-between p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <Database size={16} />
                    Storage Utilization
                  </span>
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                      <CreditCard size={12} />
                    </div>
                    <h5 className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-widest">Payment Methods</h5>
                  </div>
                  <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-[8px] font-bold text-slate-500 rounded-full">
                    {filteredMethods.length}
                  </span>
                </div>

                <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button
                    onClick={() => setSelectedType('MY')}
                    className={cn(
                      "flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all",
                      selectedType === 'MY' 
                        ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    )}
                  >
                    MY Agent
                  </button>
                  <button
                    onClick={() => setSelectedType('BD')}
                    className={cn(
                      "flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all",
                      selectedType === 'BD' 
                        ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    )}
                  >
                    BD Agent
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="relative group px-1">
                    <input 
                      type="text" 
                      value={newMethod} 
                      onChange={(e) => setNewMethod(e.target.value)}
                      placeholder={`Add ${selectedType} method...`}
                      className="w-full pl-3 pr-10 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all shadow-sm"
                    />
                    <button 
                      onClick={handleAddMethod} 
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:scale-95 transition-all"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                    {filteredMethods.length === 0 ? (
                      <div className="text-center py-6 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                        <p className="text-[10px] font-medium text-slate-400">No payment methods added yet.</p>
                      </div>
                    ) : (
                      <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-50 dark:bg-slate-800">
                            <tr>
                              <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Method</th>
                              <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredMethods.map((method, idx) => (
                              <React.Fragment key={`${method.id}-${idx}`}>
                                <tr 
                                  onClick={() => setExpandedMethodId(expandedMethodId === method.id ? null : method.id)}
                                  className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                                >
                                  <td className="px-3 py-2">
                                    {editingMethodId === method.id ? (
                                      <input 
                                        autoFocus
                                        value={editValue}
                                        onChange={e => setEditValue(e.target.value)}
                                        onBlur={() => handleUpdateMethod(method.id)}
                                        onKeyDown={e => e.key === 'Enter' && handleUpdateMethod(method.id)}
                                        onClick={e => e.stopPropagation()}
                                        className="text-xs font-bold bg-white dark:bg-slate-800 border border-indigo-500 rounded px-1 outline-none dark:text-white w-full"
                                      />
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <div className={cn("transition-transform duration-300", expandedMethodId === method.id ? "rotate-180" : "")}>
                                          <ChevronDown size={12} className="text-slate-400" />
                                        </div>
                                        <span className="text-xs font-bold text-slate-900 dark:text-white">{method.name}</span>
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <button 
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          setDetailsData({
                                            type: 'method',
                                            methodId: method.id,
                                            name: method.name,
                                            initial_balance: method.initial_balance || 0,
                                            initial_balance_date: method.initial_balance_date || new Date().toISOString().split('T')[0]
                                          });
                                          setShowDetailsModal(true);
                                        }} 
                                        className="p-1 text-slate-400 hover:text-indigo-500 transition-all"
                                      >
                                        <Settings size={12} />
                                      </button>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); setEditingMethodId(method.id); setEditValue(method.name); }} 
                                        className="p-1 text-slate-400 hover:text-blue-500 transition-all"
                                      >
                                        <Edit size={12} />
                                      </button>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteMethod(method.id); }} 
                                        className="p-1 text-slate-400 hover:text-red-500 transition-all"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                {expandedMethodId === method.id && (
                                  <tr>
                                    <td colSpan={2} className="bg-slate-50/30 dark:bg-slate-800/20 p-2">
                                      <div className="space-y-1">
                                        {method.subItems.map((sub, idx) => (
                                          <div key={`${sub.id}-${idx}`} className="flex items-center justify-between group/sub px-3 py-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-all">
                                            <div className="flex items-center gap-2 flex-1">
                                              <div className="w-1 h-1 rounded-full bg-indigo-400" />
                                              {editingSubId?.subId === sub.id ? (
                                                <input 
                                                  autoFocus
                                                  value={editValue}
                                                  onChange={e => setEditValue(e.target.value)}
                                                  onBlur={() => handleUpdateSubItem(method.id, sub.id)}
                                                  onKeyDown={e => e.key === 'Enter' && handleUpdateSubItem(method.id, sub.id)}
                                                  className="text-[10px] font-semibold bg-white dark:bg-slate-800 border border-indigo-500 rounded px-1 outline-none dark:text-white w-full"
                                                />
                                              ) : (
                                                <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">{sub.name}</span>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <button 
                                                onClick={() => { 
                                                  setDetailsData({
                                                    type: 'subItem',
                                                    methodId: method.id,
                                                    subId: sub.id,
                                                    name: sub.name,
                                                    initial_balance: sub.initial_balance || 0,
                                                    initial_balance_date: sub.initial_balance_date || new Date().toISOString().split('T')[0]
                                                  });
                                                  setShowDetailsModal(true);
                                                }} 
                                                className="p-1 text-slate-400 hover:text-indigo-500 transition-all"
                                              >
                                                <Settings size={10} />
                                              </button>
                                              <button 
                                                onClick={() => { setEditingSubId({methodId: method.id, subId: sub.id}); setEditValue(sub.name); }} 
                                                className="p-1 text-slate-400 hover:text-blue-500 transition-all"
                                              >
                                                <Edit size={10} />
                                              </button>
                                              <button 
                                                onClick={() => {
                                                  store.deleteCollectionMethodSubItem(method.id, sub.id);
                                                }} 
                                                className="p-1 text-slate-400 hover:text-red-500 transition-all"
                                              >
                                                <Trash2 size={10} />
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                        <div className="relative mt-2 px-1">
                                          <input 
                                            type="text" 
                                            placeholder={`Add sub-item...`}
                                            className="w-full pl-3 pr-10 py-1.5 text-[10px] rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                store.addCollectionMethodSubItem(method.id, e.currentTarget.value.trim());
                                                e.currentTarget.value = '';
                                              }
                                            }}
                                          />
                                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1 py-0.5 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 shadow-sm pointer-events-none">
                                            <span className="text-[6px] font-bold text-slate-400 uppercase">Enter</span>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>

                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data Management</h5>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => store.backupData()}
                      className="flex items-center justify-center gap-2 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                    >
                      <FileText size={14} />
                      Export Data
                    </button>
                    <label className="flex items-center justify-center gap-2 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-[10px] font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors cursor-pointer">
                      <RefreshCw size={14} />
                      Restore Data
                      <input 
                        type="file" 
                        className="hidden" 
                        accept=".json,application/json,text/plain,*/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const content = event.target?.result as string;
                              const result = store.restoreData(content);
                              if (result.success) {
                                alert('Data restored successfully!');
                              } else {
                                alert('Failed to restore data: ' + (result.error || 'Unknown error'));
                              }
                            };
                            reader.readAsText(file);
                          }
                        }}
                      />
                    </label>
                    <button 
                      onClick={() => { onLogout(); onClose(); }}
                      className="flex items-center justify-center gap-3 w-full py-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <LogOut size={20} />
                      Logout Account
                    </button>
                  </div>
                </div>
              </div>
            </aside>

          {showDetailsModal && detailsData && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <div 
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
              >
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="font-bold text-sm dark:text-white">Initial Balance Settings</h3>
                  <button onClick={() => setShowDetailsModal(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500">
                    <Plus className="rotate-45" size={18} />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Name</label>
                    <input 
                      type="text"
                      value={detailsData.name}
                      onChange={e => setDetailsData({ ...detailsData, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Initial Balance ({selectedType === 'MY' ? 'RM' : 'Tk'})</label>
                    <input 
                      type="number"
                      value={detailsData.initial_balance}
                      onChange={e => setDetailsData({ ...detailsData, initial_balance: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Initial Balance Date</label>
                    <input 
                      type="date"
                      value={detailsData.initial_balance_date}
                      onChange={e => setDetailsData({ ...detailsData, initial_balance_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                    />
                  </div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex gap-2">
                  <button 
                    onClick={() => setShowDetailsModal(false)}
                    className="flex-1 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveDetails}
                    className="flex-1 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
};

// --- Bank Statement Ledger & Bank Balances are handled via ./components/BankStatementLedger ---


// --- Main App ---

function PaymentPage({ token, onViewLedger, onPaymentAdded }: { token: string; onViewLedger: (type: 'MY' | 'BD', id: number) => void; onPaymentAdded?: () => void }) {
  const { myAgents, bdAgents, stats } = useAppStore();
  const [activeTab, setActiveTab] = useState<'MY' | 'BD'>('MY');
  const [selectedAgent, setSelectedAgent] = useState<MYAgent | BDAgent | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showView, setShowView] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleAddPayment = (agent: MYAgent | BDAgent) => {
    setSelectedAgent(agent);
    setShowPayment(true);
  };

  const handleViewPayments = (agent: MYAgent | BDAgent) => {
    setSelectedAgent(agent);
    setShowView(true);
  };

  const handleViewLedger = (agent: MYAgent | BDAgent) => {
    setSelectedAgent(agent);
    setShowLedger(true);
  };

  const filteredAgents = (activeTab === 'MY' ? myAgents : bdAgents).filter(agent => 
    agent.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder={`Search ${activeTab === 'MY' ? 'MY' : 'BD'} agents...`}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 dark:focus:ring-white outline-none dark:text-white"
          />
        </div>
        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <button
            onClick={() => setActiveTab('MY')}
            className={cn(
              "px-6 py-2 rounded-md text-sm font-medium transition-all",
              activeTab === 'MY' 
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" 
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            MY Agents
          </button>
          <button
            onClick={() => setActiveTab('BD')}
            className={cn(
              "px-6 py-2 rounded-md text-sm font-medium transition-all",
              activeTab === 'BD' 
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" 
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            BD Agents
          </button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">Agent Name</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">Balance ({activeTab === 'MY' ? 'RM' : 'BDT'})</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredAgents.length > 0 ? (
                filteredAgents.map((agent: any, idx: number) => (
                  <tr key={`${agent.id}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-2 py-2 text-xs font-medium text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">{agent.name}</td>
                    <td className="px-2 py-2 text-xs font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">
                      {activeTab === 'MY' 
                        ? formatCurrency(agent.outstanding)
                        : `${agent.outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tk`
                      }
                    </td>
                    <td className="px-2 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" className="py-1 px-2 text-[10px] h-7 whitespace-nowrap" onClick={() => handleAddPayment(agent)}>
                          <Plus size={12} /> Add Payment
                        </Button>
                        <Button variant="outline" className="py-1 px-2 text-[10px] h-7 whitespace-nowrap" onClick={() => handleViewPayments(agent)}>
                          <Eye size={12} /> View
                        </Button>
                        <Button variant="outline" className="py-1 px-2 text-[10px] h-7 whitespace-nowrap" onClick={() => handleViewLedger(agent)}>
                          <Receipt size={12} /> Ledger
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                    No agents found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
            {filteredAgents.length > 0 && (
              <tfoot className="bg-slate-50 dark:bg-slate-800 font-bold border-t-2 border-slate-200 dark:border-slate-700 sticky bottom-0 z-10">
                <tr>
                  <td className="px-2 py-2 text-xs text-slate-900 dark:text-white text-right border-r border-slate-200 dark:border-slate-700">TOTAL:</td>
                  <td className="px-2 py-2 text-xs text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">
                    {activeTab === 'MY' 
                      ? formatCurrency(filteredAgents.reduce((sum, agent: any) => sum + agent.outstanding, 0))
                      : `${filteredAgents.reduce((sum, agent: any) => sum + agent.outstanding, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tk`
                    }
                  </td>
                  <td className="px-2 py-2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {selectedAgent && (
        <>
          <PaymentModal 
            isOpen={showPayment} 
            onClose={() => setShowPayment(false)} 
            agent={selectedAgent} 
            type={activeTab} 
            token={token} 
            onSuccess={() => {
              if (onPaymentAdded) onPaymentAdded();
            }} 
          />
          <ViewPaymentsModal 
            isOpen={showView} 
            onClose={() => setShowView(false)} 
            agent={selectedAgent} 
            type={activeTab}
            token={token}
            onViewLedger={() => {
              setShowView(false);
              setShowLedger(true);
            }}
            onSuccess={() => {
              if (onPaymentAdded) onPaymentAdded();
            }}
          />

          <ViewLedgerModal
            isOpen={showLedger}
            onClose={() => setShowLedger(false)}
            agent={selectedAgent}
            type={activeTab}
          />
        </>
      )}
    </div>
  );
}

export default function App() {
  const { refresh, myAgents, bdAgents, orders, myPayments, bdPayments, conversions, expenses, collectionMethods, stats } = useAppStore();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [fontSize, setFontSize] = useState('text-xs');
  const [fontStyle, setFontStyle] = useState('font-sans');
  const [theme, setTheme] = useState<'light' | 'dark'>(localStorage.getItem('theme') as 'light' | 'dark' || 'light');
  const [orderFilters, setOrderFilters] = useState<{start: string, end: string} | null>(null);
  const [reportFilters, setReportFilters] = useState<{type: string, my_agent_id?: string, bd_agent_id?: string} | null>(null);
  const [showBackupPrompt, setShowBackupPrompt] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showBulkOrderUpload, setShowBulkOrderUpload] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [bulkUploadType, setBulkUploadType] = useState<'MY' | 'BD'>('MY');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    let checkInterval: NodeJS.Timeout;

    const checkOnlineStatus = async () => {
      if (!navigator.onLine) {
        setIsOffline(true);
        return;
      }
      try {
        // Ping a reliable small endpoint to verify actual internet access
        // We use fetch with cache: 'no-store' to bypass browser caching
        await fetch('https://1.1.1.1/cdn-cgi/trace', { mode: 'no-cors', cache: 'no-store' });
        setIsOffline(false);
      } catch (error) {
        setIsOffline(true);
      }
    };

    const handleOnline = () => checkOnlineStatus();
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Actively poll every 5 seconds to catch drop in actual internet
    checkInterval = setInterval(checkOnlineStatus, 5000);
    checkOnlineStatus();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(checkInterval);
    };
  }, []);

  const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 5): Promise<Response> => {
    let retries = maxRetries;
    let delay = 2000;
    let lastResponse: Response | null = null;

    while (retries > 0) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });

        lastResponse = response;
        const contentType = response.headers.get('content-type');

        // Success case
        if (response.ok && contentType && contentType.includes('application/json')) {
          return response;
        }

        // Handle HTML responses (likely platform loading page or SPA fallback)
        if (contentType && contentType.includes('text/html')) {
          const text = await response.text();
          // Use regex for more robust detection of the "Starting Server..." page
          const isStartingPage = /Starting Server\.\.\./i.test(text) || /<title>Starting Server\.\.\.<\/title>/i.test(text);
          
          if (isStartingPage) {
            console.log(`Server is still starting (retry ${maxRetries - retries + 1}/${maxRetries})...`);
            retries--;
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 1.5;
              continue;
            }
          }
          
          // If it's not the starting page, it might be the SPA fallback (404)
          // On mobile, we might get the SPA fallback if the route is wrong or server is in a weird state
          console.error('Server returned HTML instead of JSON. Content snippet:', text.substring(0, 200));
          throw new Error('Server returned an HTML page instead of JSON. This usually means the API route was not found or the server is restarting.');
        }

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (error: any) {
        // Don't retry if it's a confirmed HTML error that isn't the starting page
        if (error.message.includes('HTML page') && !error.message.includes('restarting')) {
          throw error;
        }
        
        if (retries <= 1) {
          throw error;
        }
        
        console.log(`Fetch failed, retrying (${maxRetries - retries + 1}/${maxRetries})...`, error.message);
        retries--;
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5;
      }
    }
    throw new Error(lastResponse ? `Failed after ${maxRetries} retries. Status: ${lastResponse.status}` : 'Failed to connect to server');
  };

  const handleBulkUpload = (type: 'MY' | 'BD') => {
    setBulkUploadType(type);
    setShowBulkUpload(true);
  };

  useEffect(() => {
    if (token) {
      const promptShown = localStorage.getItem('rf_backup_prompt_shown');
      if (!promptShown) {
        setShowBackupPrompt(true);
      }
    }
  }, [token]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    // Start real-time sync
    const unsubscribe = refresh();
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [refresh]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    try {
      const { users } = useAppStore.getState();
      const user = users.find(u => u.username === username && u.password === password);

      if (user) {
        const mockToken = 'firebase-session-' + Date.now();
        localStorage.setItem('token', mockToken);
        localStorage.setItem('user', JSON.stringify(user));
        setToken(mockToken);
        setUser(user);
      } else {
        alert('Invalid username or password');
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  // --- Inactivity Logout ---
  useEffect(() => {
    if (!token) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      const timeoutMinutes = parseInt(localStorage.getItem('inactivityTimeout') || '5') || 5;
      timeoutId = setTimeout(() => {
        handleLogout();
      }, timeoutMinutes * 60 * 1000);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('scroll', resetTimer);

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('scroll', resetTimer);
    };
  }, [token, handleLogout]);

  if (isOffline) {
    return (
      <div className="fixed inset-0 bg-slate-900 z-[9999] flex flex-col items-center justify-center text-white p-4">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-3xl font-bold mb-2 text-center">You are offline</h1>
        <p className="text-slate-400 max-w-sm text-center">This application requires an active internet connection to function securely.</p>
        <p className="text-slate-500 mt-4 text-sm text-center">Please connect to the internet to continue.</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
      <div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
          <Card className="p-8">
            <div className="mb-8 text-center">
              <div className="w-16 h-16 bg-slate-900 dark:bg-white rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Globe className="text-white dark:text-slate-900 w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Juel Money Transfer Apps</h1>
              <p className="text-slate-500 dark:text-slate-400">Money Transfer Management System</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input name="username" label="Username" placeholder="Enter username" required />
              <Input name="password" label="Password" type="password" placeholder="••••••••" required />
              <Button type="submit" className="w-full py-3" disabled={loading}>
                {loading ? 'Logging in...' : 'Login to Dashboard'}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen bg-slate-50 dark:bg-slate-950 flex transition-colors", fontSize, fontStyle)}>
      {/* Modals */}

      
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300 md:relative md:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 dark:bg-white rounded-xl flex items-center justify-center">
              <Globe className="text-white dark:text-slate-900 w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight dark:text-white">Juel Money Transfer Apps</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-slate-500">
            <Plus className="rotate-45" size={24} />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <NavItem active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} icon={<LayoutDashboard size={20} />} label="Dashboard" />
          <NavItem active={activeTab === 'default-rate'} onClick={() => { setActiveTab('default-rate'); setIsMobileMenuOpen(false); }} icon={<TrendingUp size={20} />} label="Default Rate" />
          <NavItem active={activeTab === 'rate-history'} onClick={() => { setActiveTab('rate-history'); setIsMobileMenuOpen(false); }} icon={<Clock size={20} />} label="Rate History" />
          <NavItem active={activeTab === 'my-agents'} onClick={() => { setActiveTab('my-agents'); setIsMobileMenuOpen(false); }} icon={<Users size={20} />} label="MY Agents" />
          <NavItem active={activeTab === 'bd-agents'} onClick={() => { setActiveTab('bd-agents'); setIsMobileMenuOpen(false); }} icon={<Globe size={20} />} label="BD Agents" />
          <NavItem active={activeTab === 'orders'} onClick={() => { setOrderFilters(null); setActiveTab('orders'); setIsMobileMenuOpen(false); }} icon={<ArrowRightLeft size={20} />} label="Orders" />
          <NavItem active={activeTab === 'conversion'} onClick={() => { setActiveTab('conversion'); setIsMobileMenuOpen(false); }} icon={<Banknote size={20} />} label="RM Conversion" />
          <NavItem active={activeTab === 'expenses'} onClick={() => { setActiveTab('expenses'); setIsMobileMenuOpen(false); }} icon={<Receipt size={20} />} label="Expenses" />
          <NavItem active={activeTab === 'balances'} onClick={() => { setActiveTab('balances'); setIsMobileMenuOpen(false); }} icon={<Scale size={20} />} label="Bank Balance" />
          <NavItem active={activeTab === 'calculation'} onClick={() => { setActiveTab('calculation'); setIsMobileMenuOpen(false); }} icon={<Calculator size={20} />} label="Calculation" />
          <NavItem active={activeTab === 'loan'} onClick={() => { setActiveTab('loan'); setIsMobileMenuOpen(false); }} icon={<FileText size={20} />} label="Loan" />
          <NavItem active={activeTab === 'reports'} onClick={() => { setReportFilters(null); setActiveTab('reports'); setIsMobileMenuOpen(false); }} icon={<BarChart3 size={20} />} label="Reports" />
        </nav>

        <div>
          <StorageWidget />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto h-screen flex flex-col">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
              <LayoutDashboard size={24} />
            </button>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white capitalize">{activeTab.replace('-', ' ')}</h2>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded-lg transition-colors group"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">{user?.username || 'Admin User'}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user?.role || 'Administrator'}</p>
              </div>
              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                <Users size={20} className="text-slate-600 dark:text-slate-400" />
              </div>
            </button>
          </div>
        </header>

        <div className="p-4">
          {activeTab === 'dashboard' && <Dashboard stats={stats} onReload={refresh} onViewAll={() => {
            const today = new Date().toISOString().split('T')[0];
            setOrderFilters({ start: today, end: today });
            setActiveTab('orders');
          }} />}
          {activeTab === 'default-rate' && <DefaultRateSettings setActiveTab={setActiveTab} />}
          {activeTab === 'rate-history' && <RateHistoryPage />}
          {activeTab === 'my-agents' && (
            <MYAgents 
              token={token!} 
              onBulkUpload={() => handleBulkUpload('MY')} 
            />
          )}
          {activeTab === 'bd-agents' && (
            <BDAgents 
              token={token!} 
              onBulkUpload={() => handleBulkUpload('BD')} 
            />
          )}
          {activeTab === 'orders' && <Orders token={token!} initialFilters={orderFilters} onBulkUpload={() => setShowBulkOrderUpload(true)} />}
          {activeTab === 'conversion' && <ConversionTab token={token!} />}
          {activeTab === 'expenses' && <Expenses token={token!} />}
          {activeTab === 'balances' && <BankBalancePage />}
          {activeTab === 'calculation' && <CalculationPage />}
          {activeTab === 'loan' && <LoanPage />}
          {activeTab === 'reports' && <Reports token={token!} stats={stats} initialFilters={reportFilters} />}
        </div>
      </main>

      <ProfileSidebar 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        theme={theme} 
        onThemeChange={setTheme}
        user={user}
        onLogout={handleLogout}
        fontSize={fontSize}
        setFontSize={setFontSize}
        fontStyle={fontStyle}
        setFontStyle={setFontStyle}
        onOpenSecurity={() => setShowSecurityModal(true)}
        onOpenStorage={() => setShowStorageModal(true)}
      />
      <SecurityModal isOpen={showSecurityModal} onClose={() => setShowSecurityModal(false)} />
      <StorageUtilizationModal isOpen={showStorageModal} onClose={() => setShowStorageModal(false)} />
      <BulkPaymentUploadModal 
        isOpen={showBulkUpload} 
        onClose={() => setShowBulkUpload(false)} 
        type={bulkUploadType} 
      />
      <BulkOrderUploadModal
        isOpen={showBulkOrderUpload}
        onClose={() => setShowBulkOrderUpload(false)}
      />
    </div>
  );
}

function NavItem({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 w-full rounded-lg transition-all duration-200",
        active 
          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md shadow-slate-200 dark:shadow-none" 
          : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
      )}
    >
      {React.cloneElement(icon as React.ReactElement, { size: 18 })}
      <span className="font-medium text-sm">{label}</span>
    </button>
  );
}

// --- Dashboard Component ---
function Dashboard({ stats, onViewAll, onReload }: { stats: any; onViewAll: () => void; onReload: () => void }) {
  const [isReloading, setIsReloading] = useState(false);

  if (!stats) return (
    <div className="flex flex-col items-center justify-center p-12 space-y-4">
      <div className="animate-spin text-slate-400">
        <RefreshCw size={32} />
      </div>
      <p className="text-slate-500 font-medium">Loading statistics...</p>
    </div>
  );

  const handleReload = async () => {
    setIsReloading(true);
    await onReload();
    // Artificial delay for better UX
    setTimeout(() => setIsReloading(false), 600);
  };

  const cards = [
    { 
      title: "Today's Orders", 
      value: stats.today?.count || 0, 
      icon: <ArrowRightLeft className="text-blue-600" />, 
      sub: "Total transactions",
      change: stats.changes?.count || 0
    },
    { 
      title: "Today's Volume", 
      value: formatCurrency(stats.today?.total_myr || 0), 
      icon: <TrendingUp className="text-emerald-600" />, 
      sub: (
        <div className="flex flex-col gap-0.5 mt-1">
          <span>{(stats.today?.total_bdt || 0).toLocaleString()} Tk</span>
          <span className="text-[9px] text-slate-400">Avg Order Rate: {stats.profitBreakdown?.avgOrderRate?.toFixed(2) || '0.00'}</span>
          <span className="text-[9px] text-slate-400">Avg Convert Rate: {stats.profitBreakdown?.avgConvertRate?.toFixed(2) || '0.00'}</span>
        </div>
      ),
      change: stats.changes?.volume || 0
    },
    { 
      title: "Total Net Profit", 
      value: formatCurrency(stats.netProfit || 0), 
      icon: <Wallet className="text-indigo-600" />, 
      sub: "Total earnings after expenses",
      change: stats.changes?.profit || 0
    },
    { 
      title: "Total Expenses", 
      value: formatCurrency(stats.expenses?.total_myr || 0), 
      icon: <Receipt className="text-red-600" />, 
      sub: "Operational costs",
      change: stats.changes?.expenses || 0
    },
  ];

  return (
    <div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4"
    >

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-md">{React.cloneElement(card.icon as React.ReactElement, { size: 18 })}</div>
              {card.change !== 0 && (
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  card.change > 0 
                    ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" 
                    : "text-red-600 bg-red-50 dark:bg-red-900/20"
                )}>
                  {card.change > 0 ? '+' : ''}{card.change.toFixed(1)}%
                </span>
              )}
            </div>
            <h3 className="text-slate-500 dark:text-slate-400 text-xs font-medium">{card.title}</h3>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{card.value}</p>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{card.sub}</div>
          </Card>
        ))}
        


        {/* Bank Balance Summary Card */}
        <Card className="p-4 col-span-1 md:col-span-2 lg:col-span-2 flex flex-col h-auto min-h-[200px]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-md"><Wallet className="text-slate-600" size={18} /></div>
              <h3 className="text-slate-900 dark:text-white text-sm font-bold">Bank Balance Summary</h3>
            </div>
          </div>
          <div className="space-y-2 flex-1 overflow-y-auto max-h-[200px] pr-2 custom-scrollbar">
            {stats.bankBalances?.length > 0 ? (
              <>
                {stats.bankBalances.map((balance: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-xs p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-1.5 h-1.5 rounded-full", balance.type === 'MY' ? "bg-emerald-500" : "bg-blue-500")} />
                      <span className="font-medium text-slate-700 dark:text-slate-300">{balance.name}</span>
                    </div>
                    <span className={cn(
                      "font-mono font-bold",
                      balance.balance < 0 ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white"
                    )}>
                      {balance.currency === 'MYR' ? formatCurrency(balance.balance) : `${balance.balance.toLocaleString()} Tk`}
                    </span>
                  </div>
                ))}
                
                {/* Total MYR Row without any log graph / indicator dot */}
                <div className="flex justify-between items-center text-xs p-2 bg-slate-100/65 dark:bg-slate-800 font-bold rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-700 dark:text-slate-300">Total MYR</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {formatCurrency(stats.bankBalances?.filter((b: any) => b.currency === 'MYR').reduce((sum: number, b: any) => sum + b.balance, 0) || 0)}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400 italic text-center py-4">No balances available</p>
            )}
          </div>
        </Card>

        {/* Outstanding Report Card */}
        <Card className="p-4 col-span-1 md:col-span-2 lg:col-span-2 flex flex-col h-auto min-h-[200px]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-md"><ArrowRightLeft className="text-slate-600" size={18} /></div>
              <h3 className="text-slate-900 dark:text-white text-sm font-bold">Outstanding Report</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
            {/* MY Agents Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded-full uppercase tracking-wider">MY Agents (Receivable)</span>
              </div>
              <div className="space-y-1 pr-2">
                {stats.myAgentsOutstanding?.agents?.length > 0 ? (
                  stats.myAgentsOutstanding.agents.map((agent: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-[10px]">
                      <span className="text-slate-600 dark:text-slate-400 truncate max-w-[60%]">{agent.name}</span>
                      <span className={cn(
                        "font-mono font-medium",
                        agent.outstanding < 0 ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white"
                      )}>
                        {formatCurrency(agent.outstanding)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-slate-400 italic">No outstanding balances</p>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Total</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">{formatCurrency(stats.myAgentsOutstanding?.total || 0)}</span>
              </div>
            </div>

            {/* BD Agents Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded-full uppercase tracking-wider">BD Agents (Payable)</span>
              </div>
              <div className="space-y-1 pr-2">
                {stats.bdAgentsOutstanding?.agents?.length > 0 ? (
                  stats.bdAgentsOutstanding.agents.map((agent: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-[10px]">
                      <span className="text-slate-600 dark:text-slate-400 truncate max-w-[60%]">{agent.name}</span>
                      <span className={cn(
                        "font-mono font-medium",
                        agent.outstanding < 0 ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white"
                      )}>
                        {agent.outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tk
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-slate-400 italic">No outstanding balances</p>
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Total</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">{(stats.bdAgentsOutstanding?.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tk</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function BulkOrderUploadModal({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
}) {
  const { myAgents, bdAgents } = useAppStore();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);

  const downloadSample = () => {
    const headers = ['MY Agent', 'BD Agent', 'Type', 'Amount BDT', 'Rate', 'Charge', 'Date', 'Remark'];
    const sampleData = [
      ['MY Agent A', 'BD Agent X', 'bkash', '10000', '25.5', '0', '2024-01-01', 'Sample Order'],
      ['MY Agent B', 'BD Agent Y', 'bank', '5000', '25.6', '10', '2024-01-02', 'Another Sample']
    ];
    
    const csvContent = Papa.unparse({ fields: headers, data: sampleData });
    saveAs(new Blob([csvContent], { type: "text/csv;charset=utf-8;" }), `bulk_order_sample.csv`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setSuccessCount(0);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const headers = results.meta.fields || [];
          const requiredHeaders = ['MY Agent', 'BD Agent', 'Type', 'Amount BDT', 'Rate', 'Charge', 'Date', 'Remark'];
          
          const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
          if (missingHeaders.length > 0) {
            const msg = `Critical Error: Column mismatch in CSV. Missing: ${missingHeaders.join(', ')}. Upload rejected.`;
            alert(msg);
            setError(msg);
            setIsUploading(false);
            return;
          }

          const data = results.data as any[];
          const errors: string[] = [];
          const validOrders: any[] = [];

          data.forEach((row: any, index: number) => {
            const myAgentName = row['MY Agent'];
            const bdAgentName = row['BD Agent'];
            const type = (row['Type'] || 'bkash').toLowerCase();
            const amountBdt = parseFloat(row['Amount BDT']);
            const rate = parseFloat(row['Rate']);
            const charge = parseFloat(row['Charge']) || 0;
            const date = row['Date'] || new Date().toISOString().split('T')[0];
            const remark = row['Remark'] || '';

            if (!myAgentName || !bdAgentName || isNaN(amountBdt) || isNaN(rate)) {
              errors.push(`Row ${index + 2}: Invalid data format (Check MY Agent, BD Agent, Amount BDT, Rate)`);
              return;
            }

            const myAgent = myAgents.find(a => a.name.toLowerCase() === myAgentName.toString().toLowerCase());
            const bdAgent = bdAgents.find(a => a.name.toLowerCase() === bdAgentName.toString().toLowerCase());

            if (!myAgent) {
              errors.push(`Row ${index + 2}: MY Agent "${myAgentName}" not found. Follow existing agent info.`);
            }
            if (!bdAgent) {
              errors.push(`Row ${index + 2}: BD Agent "${bdAgentName}" not found. Follow existing agent info.`);
            }

            if (myAgent && bdAgent) {
              const amountMyr = amountBdt / rate;
              validOrders.push({
                my_agent_id: myAgent.id,
                bd_agent_id: bdAgent.id,
                type: type as any,
                amount_bdt: amountBdt,
                rate,
                amount_myr: amountMyr.toFixed(2),
                charge,
                date,
                remark
              });
            }
          });

          if (errors.length > 0) {
            const errorMsg = `Upload Rejected. Found ${errors.length} errors:\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...and more.' : ''}`;
            alert(errorMsg);
            setError(errors.join('\n'));
            setIsUploading(false);
          } else {
            // All rows are valid, add them all
            validOrders.forEach(order => store.addOrder(order));
            setSuccessCount(validOrders.length);
            setIsUploading(false);
            setTimeout(() => {
              onClose();
            }, 1500);
          }
        },
        error: (err: any) => {
          const msg = 'Failed to parse CSV file: ' + err.message;
          alert(msg);
          setError(msg);
          setIsUploading(false);
        }
      });
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white">Bulk Upload Orders</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <Plus className="rotate-45 w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
            <div className="flex gap-3">
              <AlertCircle className="text-indigo-600 dark:text-indigo-400 w-5 h-5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-indigo-900 dark:text-indigo-100">Instructions</p>
                <p className="text-[10px] text-indigo-700 dark:text-indigo-300 leading-relaxed">
                  1. Download the sample CSV file.<br />
                  2. Fill in your order data.<br />
                  3. Ensure agent names match exactly.<br />
                  4. Upload the completed file.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button variant="outline" onClick={downloadSample} className="w-full gap-2">
              <Download size={16} /> Download Sample CSV (.csv)
            </Button>
            
            <div className="relative">
              <input 
                type="file" 
                accept=".csv" 
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
                disabled={isUploading}
              />
              <Button variant="primary" className="w-full gap-2" disabled={isUploading}>
                {isUploading ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                {isUploading ? 'Uploading...' : 'Upload CSV File'}
              </Button>
            </div>
          </div>

          {successCount > 0 && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-lg">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <Check size={14} /> Successfully uploaded {successCount} orders!
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg max-h-40 overflow-y-auto">
              <p className="text-[10px] font-mono text-red-700 dark:text-red-400 whitespace-pre-wrap">
                {error}
              </p>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

function BulkPaymentUploadModal({ 
  isOpen, 
  onClose, 
  type 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  type: 'MY' | 'BD'; 
}) {
  const { myAgents, bdAgents } = useAppStore();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);

  const downloadSample = () => {
    const headers = ['Agent Name', 'Amount', 'Method', 'Sub-Method', 'Date', 'Remark'];
    const sampleData = [
      ['Agent A', '1000', 'Bank', 'Maybank', '2024-01-01', 'Sample Payment'],
      ['Agent B', '500', 'Bkash', 'Personal', '2024-01-02', 'Another Sample']
    ];
    
    const csvContent = Papa.unparse({ fields: headers, data: sampleData });
    saveAs(new Blob([csvContent], { type: "text/csv;charset=utf-8;" }), `bulk_payment_sample_${type}.csv`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setSuccessCount(0);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const headers = results.meta.fields || [];
          const requiredHeaders = ['Agent Name', 'Amount', 'Method', 'Sub-Method', 'Date', 'Remark'];
          
          const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
          if (missingHeaders.length > 0) {
            const msg = `Critical Error: Column mismatch in CSV. Missing: ${missingHeaders.join(', ')}. Upload rejected.`;
            alert(msg);
            setError(msg);
            setIsUploading(false);
            return;
          }

          const data = results.data as any[];
          const errors: string[] = [];
          const validPayments: any[] = [];

          data.forEach((row: any, index: number) => {
            const agentName = row['Agent Name'];
            const amount = parseFloat(row['Amount']);
            const method = row['Method'];
            const subMethod = row['Sub-Method'] || '';
            const date = row['Date'] || new Date().toISOString().split('T')[0];
            const remark = row['Remark'] || '';

            if (!agentName || isNaN(amount) || !method) {
              errors.push(`Row ${index + 2}: Invalid data format (Check Agent Name, Amount, Method)`);
              return;
            }

            if (type === 'MY') {
              const agent = myAgents.find(a => a.name.toLowerCase() === agentName.toString().toLowerCase());
              if (!agent) {
                errors.push(`Row ${index + 2}: MY Agent "${agentName}" not found. Follow existing agent info.`);
                return;
              }
              validPayments.push({
                my_agent_id: agent.id,
                amount_myr: amount,
                payment_method: method,
                sub_method: subMethod,
                date,
                note: remark
              });
            } else {
              const agent = bdAgents.find(a => a.name.toLowerCase() === agentName.toString().toLowerCase());
              if (!agent) {
                errors.push(`Row ${index + 2}: BD Agent "${agentName}" not found. Follow existing agent info.`);
                return;
              }
              validPayments.push({
                bd_agent_id: agent.id,
                amount_bdt: amount,
                charge: parseFloat(row['Charge'] || row['charge'] || '0') || 0,
                payment_method: method,
                sub_method: subMethod,
                date,
                note: remark
              });
            }
          });

          if (errors.length > 0) {
            const errorMsg = `Upload Rejected. Found ${errors.length} errors:\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...and more.' : ''}`;
            alert(errorMsg);
            setError(errors.join('\n'));
            setIsUploading(false);
          } else {
            // All rows are valid
            validPayments.forEach(payment => {
              if (type === 'MY') {
                store.addMYPayment(payment);
              } else {
                store.addBDPayment(payment);
              }
            });
            setSuccessCount(validPayments.length);
            setIsUploading(false);
            setTimeout(() => {
              onClose();
            }, 1500);
          }
        },
        error: (err: any) => {
          const msg = 'Failed to parse CSV file: ' + err.message;
          alert(msg);
          setError(msg);
          setIsUploading(false);
        }
      });
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white">Bulk Upload {type} Payments</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <Plus className="rotate-45 w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
            <div className="flex gap-3">
              <AlertCircle className="text-blue-600 dark:text-blue-400 w-5 h-5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-blue-900 dark:text-blue-100">Instructions</p>
                <p className="text-[10px] text-blue-700 dark:text-blue-300 leading-relaxed">
                  1. Download the sample CSV file.<br />
                  2. Fill in your payment data.<br />
                  3. Ensure agent names match exactly.<br />
                  4. Upload the completed file.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button variant="outline" onClick={downloadSample} className="w-full gap-2">
              <Download size={16} /> Download Sample CSV (.csv)
            </Button>
            
            <div className="relative">
              <input 
                type="file" 
                accept=".csv" 
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
                disabled={isUploading}
              />
              <Button variant="primary" className="w-full gap-2" disabled={isUploading}>
                {isUploading ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                {isUploading ? 'Uploading...' : 'Upload CSV File'}
              </Button>
            </div>
          </div>

          {successCount > 0 && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-lg">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <Check size={14} /> Successfully uploaded {successCount} payments!
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg max-h-40 overflow-y-auto">
              <p className="text-[10px] font-mono text-red-700 dark:text-red-400 whitespace-pre-wrap">
                {error}
              </p>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

// --- Default Rate Settings Component ---
function DefaultRateSettings({ setActiveTab }: { setActiveTab: (tab: string) => void }) {
  const { defaultMobileRate, defaultBankRate, setDefaultRates } = useAppStore();
  const [mobileRate, setMobileRate] = useState((defaultMobileRate || 0).toString());
  const [bankRate, setBankRate] = useState((defaultBankRate || 0).toString());
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showSuccess, setShowSuccess] = useState(false);
  const history = [...store.getRateHistory()].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  useEffect(() => {
    setMobileRate((defaultMobileRate || 0).toString());
    setBankRate((defaultBankRate || 0).toString());
  }, [defaultMobileRate, defaultBankRate]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setDefaultRates(parseFloat(mobileRate) || 0, parseFloat(bankRate) || 0, date);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <div className="max-w-5xl mx-auto mt-8 relative">
      {showSuccess && (
        <div className="absolute -top-16 left-0 right-0 flex justify-center z-50">
          <div className="bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 font-bold">
            <Check className="w-5 h-5" />
            Default Rates Saved Successfully!
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                <TrendingUp className="text-indigo-600 dark:text-indigo-400" size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Default Order Rates</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Set the standard rates for new orders.</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {/* ... fields ... */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Select Date</label>
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
                required
              />
            </div>
            {/* ... fields ... */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Mobile Transfer Rate (BDT per RM)</label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.01"
                  value={mobileRate}
                  onChange={(e) => setMobileRate(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-bold focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
                  required
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">BDT</div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Bank Transfer Rate (BDT per RM)</label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.01"
                  value={bankRate}
                  onChange={(e) => setBankRate(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-bold focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
                  required
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">BDT</div>
              </div>
              <p className="text-[11px] text-slate-400 italic">These rates will be pre-filled when creating new orders.</p>
            </div>

            <Button type="submit" className="w-full py-3 text-sm font-bold shadow-lg shadow-indigo-500/20">
              Save Default Rates
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Rate History</h2>
            <Button variant="outline" size="sm" onClick={() => setActiveTab('rate-history')} className="text-[10px] h-8 gap-1">
              <Clock size={14} /> View All
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Mobile</th>
                  <th className="px-3 py-2">Bank</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 10).map((h, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-3">{new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                    <td className="px-3 py-3 font-mono">{(h.mobileRate || 0).toFixed(2)}</td>
                    <td className="px-3 py-3 font-mono">{(h.bankRate || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function RateHistoryPage() {
  const [history, setHistory] = useState<RateHistory[]>([...(store.getRateHistory() as RateHistory[])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))));
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editMobileRate, setEditMobileRate] = useState('');
  const [editBankRate, setEditBankRate] = useState('');
  
  const months = (Array.from(new Set(history.map((h: RateHistory) => h.date.slice(0, 7)))) as string[]).sort((a, b) => b.localeCompare(a));
  const filteredHistory = history.filter(h => h.date.startsWith(selectedMonth));
  
  const handleEdit = (h: RateHistory) => {
    setEditingId(h.id);
    setEditMobileRate(h.mobileRate.toString());
    setEditBankRate(h.bankRate.toString());
  };
  
  const handleSave = async (id: number) => {
    await store.updateRateHistoryItem(id, parseFloat(editMobileRate), parseFloat(editBankRate));
    setHistory([...(store.getRateHistory() as RateHistory[])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))));
    setEditingId(null);
  };
  
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Rate History</h2>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none dark:text-white"
        >
          {months.map(m => (
            <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</option>
          ))}
        </select>
      </div>
      
      <div className="space-y-3">
        {filteredHistory.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm italic">No history available for this month.</div>
        ) : (
          filteredHistory.map((h, idx) => (
            <div key={`${h.id}-${idx}`} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
              {editingId === h.id ? (
                <div className="flex gap-2 items-center flex-1">
                  <input type="number" value={editMobileRate} onChange={e => setEditMobileRate(e.target.value)} className="w-20 p-1 rounded border" />
                  <input type="number" value={editBankRate} onChange={e => setEditBankRate(e.target.value)} className="w-20 p-1 rounded border" />
                  <button onClick={() => handleSave(h.id)} className="bg-green-500 text-white p-1 rounded">Save</button>
                  <button onClick={() => setEditingId(null)} className="bg-gray-500 text-white p-1 rounded">Cancel</button>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">Mobile: {(h.mobileRate || 0).toFixed(2)}</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">Bank: {(h.bankRate || 0).toFixed(2)}</p>
                    <p className="text-[10px] text-slate-400 font-normal">Date: {h.date}</p>
                  </div>
                  <button onClick={() => handleEdit(h)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full">
                    <Edit size={16} />
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// --- MY Agents Component ---
function MYAgents({ 
  token, 
  onAgentAdded, 
  onBulkUpload,
  onViewLedger 
}: { 
  token: string; 
  onAgentAdded?: () => void; 
  onBulkUpload?: () => void;
  onViewLedger?: (agentId: number) => void;
}) {
  const { myAgents: agents } = useAppStore();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<MYAgent | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showView, setShowView] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [editingAgent, setEditingAgent] = useState<MYAgent | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const handleAddPayment = (agent: MYAgent) => {
    setSelectedAgent(agent);
    setShowPayment(true);
  };

  const handleViewPayments = (agent: MYAgent) => {
    setSelectedAgent(agent);
    setShowView(true);
  };

  const handleViewLedger = (agent: MYAgent) => {
    if (onViewLedger) {
      onViewLedger(agent.id);
    } else {
      setSelectedAgent(agent);
      setShowLedger(true);
    }
  };

  const filteredAgents = agents.filter(agent => 
    agent.name.toLowerCase().includes(searchTerm.toLowerCase())
  );


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const initial_balance = parseFloat(formData.get('initial_balance') as string) || 0;
    const initial_balance_date = formData.get('initial_balance_date') as string;
    const default_mobile_rate = parseFloat(formData.get('default_mobile_rate') as string) || 0;
    const default_bank_rate = parseFloat(formData.get('default_bank_rate') as string) || 0;
    
    if (editingAgent) {
      store.updateMYAgent(editingAgent.id, { name, initial_balance, initial_balance_date, default_mobile_rate, default_bank_rate });
    } else {
      store.addMYAgent(name, initial_balance, initial_balance_date, default_mobile_rate, default_bank_rate);
    }
    setShowAdd(false);
    setEditingAgent(null);
    if (onAgentAdded) onAgentAdded();
  };

  const handleEdit = (agent: MYAgent) => {
    setEditingAgent(agent);
    setShowAdd(true);
  };

  const handleDelete = (id: number) => {
    setAgentToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (agentToDelete) {
      store.deleteMYAgent(agentToDelete);
      if (onAgentAdded) onAgentAdded();
      setAgentToDelete(null);
      setShowDeleteConfirm(false);
    }
  };

  const totalPages = Math.ceil(filteredAgents.length / itemsPerPage);
  const currentAgents = filteredAgents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text(`MY Agent Report`, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
    
    const tableData = filteredAgents.map(a => [
      a.id,
      a.name,
      ((a.total_payments_myr - a.total_orders_myr) + (Number(a.initial_balance) || 0)).toLocaleString(),
      a.initial_balance_date
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['ID', 'Name', 'Balance (RM)', 'Date']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] }
    });

    doc.save('my_agents_report.pdf');
  };

  const exportToExcel = () => {
    const tableData = filteredAgents.map(a => ({
      'ID': a.id,
      'Name': a.name,
      'Balance (RM)': (a.total_payments_myr - a.total_orders_myr) + (Number(a.initial_balance) || 0),
      'Date': a.initial_balance_date
    }));

    const ws = XLSX.utils.json_to_sheet(tableData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MY Agents');
    XLSX.writeFile(wb, 'my_agents_report.xlsx');
  };

    const exportToCSV = () => {
      const csv = Papa.unparse(filteredAgents.map(a => ({
          'ID': a.id,
          'Name': a.name,
          'Balance (RM)': (a.total_payments_myr - a.total_orders_myr) + (Number(a.initial_balance) || 0),
          'Date': a.initial_balance_date
      })));
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, 'my_agents_report.csv');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search MY Agent..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 dark:focus:ring-white outline-none dark:text-white"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToPDF} className="text-xs py-1.5 whitespace-nowrap gap-2">PDF</Button>
          <Button variant="outline" onClick={exportToExcel} className="text-xs py-1.5 whitespace-nowrap gap-2">Excel</Button>
          <Button variant="outline" onClick={exportToCSV} className="text-xs py-1.5 whitespace-nowrap gap-2">CSV</Button>
          <Button variant="outline" onClick={onBulkUpload} className="text-xs py-1.5 whitespace-nowrap gap-2">
            <Download size={16} className="rotate-180" /> Bulk Upload
          </Button>
          <Button onClick={() => { setEditingAgent(null); setShowAdd(true); }} className="text-xs py-1.5 whitespace-nowrap"><Plus size={16} /> Add Agent</Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">Agent Name</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">Balance (RM)</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {currentAgents.map((agent, idx) => (
                <tr key={`${agent.id}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <td className="px-2 py-2 text-xs font-semibold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">
                    {agent.name}
                  </td>
                  <td className="px-2 py-2 text-xs font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">
                    {formatCurrency((agent.total_payments_myr - agent.total_orders_myr) + (Number(agent.initial_balance) || 0))}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-7 px-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 gap-1 whitespace-nowrap" 
                        onClick={() => handleAddPayment(agent)}
                        title="Add Payment"
                      >
                        <Plus size={12} /> Payment
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-7 px-2 text-[11px] text-slate-700 dark:text-slate-300 gap-1 whitespace-nowrap" 
                        onClick={() => handleViewPayments(agent)}
                        title="View Payments"
                      >
                        <Eye size={12} /> Payments
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-7 px-2 text-[11px] text-slate-700 dark:text-slate-300 gap-1 whitespace-nowrap" 
                        onClick={() => handleViewLedger(agent)}
                        title="View Ledger"
                      >
                        <Receipt size={12} /> Ledger
                      </Button>
                      <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-0.5" />
                      <button onClick={() => handleEdit(agent)} className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors" title="Edit Agent">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => handleDelete(agent.id)} className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors" title="Delete Agent">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {filteredAgents.length > 0 && (
              <tfoot className="bg-slate-50 dark:bg-slate-800 font-bold border-t-2 border-slate-200 dark:border-slate-700 sticky bottom-0 z-10">
                <tr>
                  <td className="px-2 py-2 text-xs text-slate-900 dark:text-white text-right border-r border-slate-200 dark:border-slate-700">TOTAL:</td>
                  <td className="px-2 py-2 text-xs text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">
                    {formatCurrency(filteredAgents.reduce((sum, agent) => sum + ((agent.total_payments_myr - agent.total_orders_myr) + (Number(agent.initial_balance) || 0)), 0))}
                  </td>
                  <td className="px-2 py-2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-between items-center pt-2">
          <div className="text-xs text-slate-500">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredAgents.length)} of {filteredAgents.length} entries
          </div>
          <div className="flex gap-1">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 px-2 text-xs"
            >
              Previous
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  className="h-8 w-8 p-0 text-xs"
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8 px-2 text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 z-50 overflow-y-auto">
          <div className="max-w-xl mx-auto p-4 md:p-6 min-h-screen flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{editingAgent ? 'Edit Malaysia Agent' : 'Add Malaysia Agent'}</h2>
              <button onClick={() => { setShowAdd(false); setEditingAgent(null); }} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"><Plus className="rotate-45 w-6 h-6 text-slate-600 dark:text-slate-400" /></button>
            </div>
            <Card className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input name="name" label="Agent Name" placeholder="e.g. Agent Alpha" defaultValue={editingAgent?.name} required />
                <Input name="default_mobile_rate" label="Default Mobile Rate" type="number" step="0.01" placeholder="0.00" defaultValue={editingAgent?.default_mobile_rate} />
                <Input name="default_bank_rate" label="Default Bank Rate" type="number" step="0.01" placeholder="0.00" defaultValue={editingAgent?.default_bank_rate} />

                <Input name="initial_balance" label="Initial Balance (RM)" type="number" step="0.01" placeholder="0.00" defaultValue={editingAgent?.initial_balance} />
                <Input name="initial_balance_date" label="Initial Balance Date" type="date" defaultValue={editingAgent?.initial_balance_date || new Date().toISOString().split('T')[0]} />
                <div className="flex gap-2 pt-4 border-t border-slate-100">
                  <Button variant="outline" className="flex-1" onClick={() => { setShowAdd(false); setEditingAgent(null); }} type="button">Cancel</Button>
                  <Button type="submit" className="flex-1">{editingAgent ? 'Update Agent' : 'Save Agent'}</Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Agent"
        message="Are you sure you want to delete this agent? This action cannot be undone and may affect related orders and payments."
      />

      {selectedAgent && (
        <>
          <PaymentModal 
            isOpen={showPayment} 
            onClose={() => setShowPayment(false)} 
            agent={selectedAgent} 
            type="MY" 
            token={token} 
            onSuccess={() => {
              if (onAgentAdded) onAgentAdded();
            }} 
          />
          <ViewPaymentsModal 
            isOpen={showView} 
            onClose={() => setShowView(false)} 
            agent={selectedAgent} 
            type="MY" 
            token={token} 
            onViewLedger={() => {
              setShowView(false);
              if (onViewLedger && selectedAgent) {
                onViewLedger(selectedAgent.id);
              } else {
                setShowLedger(true);
              }
            }}
            onSuccess={() => {
              if (onAgentAdded) onAgentAdded();
            }}
          />
          <ViewLedgerModal
            isOpen={showLedger}
            onClose={() => setShowLedger(false)}
            agent={selectedAgent}
            type="MY"
          />
        </>
      )}
    </div>
  );
}

// --- Orders Component ---
function Orders({ token, onOrderAdded, initialFilters, onBulkUpload }: { token: string; onOrderAdded?: () => void; initialFilters?: {start: string, end: string} | null; onBulkUpload?: () => void }) {
  const { orders, myAgents, bdAgents, refresh, defaultMobileRate, defaultBankRate, rateHistory } = useAppStore();
  const [showAdd, setShowAdd] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isReloading, setIsReloading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  
  // Filter states
  const [filterMYAgent, setFilterMYAgent] = useState('');
  const [filterBDAgent, setFilterBDAgent] = useState('');
  const [filterStartDate, setFilterStartDate] = useState(initialFilters?.start || '');
  const [filterEndDate, setFilterEndDate] = useState(initialFilters?.end || '');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    my_agent_id: '',
    bd_agent_id: localStorage.getItem('last_bd_agent_id') || '',
    type: 'bkash',
    amount_bdt: '',
    rate: '',
    amount_myr: '',
    charge: '0',
    date: localStorage.getItem('last_order_date') || new Date().toISOString().split('T')[0],
    remark: ''
  });

  const getActiveRate = (dateStr: string, transferType: string, agentId?: string | number) => {
    if (agentId) {
      const agent = myAgents.find(a => a.id === Number(agentId));
      if (agent) {
        const isMobile = ['bkash', 'nagad'].includes(transferType);
        const agentRate = isMobile ? agent.default_mobile_rate : agent.default_bank_rate;
        if (agentRate && agentRate > 0) {
          return agentRate;
        }
      }
    }

    const isMobile = ['bkash', 'nagad'].includes(transferType);
    const historyEntry = (rateHistory || []).find(h => h.date === dateStr);
    if (historyEntry) {
      const histRate = isMobile ? historyEntry.mobileRate : historyEntry.bankRate;
      if (histRate && histRate > 0) {
        return histRate;
      }
    }

    return isMobile ? defaultMobileRate : defaultBankRate;
  };

  const handleReload = async () => {
    setIsReloading(true);
    refresh();
    setTimeout(() => setIsReloading(false), 600);
  };

  const lastOrderDate = orders.length > 0 
    ? [...orders].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
    : new Date().toISOString().split('T')[0];

  const handleOpenNewOrder = useCallback(() => {
    const savedDate = localStorage.getItem('last_order_date') || lastOrderDate;
    const savedBDAgent = localStorage.getItem('last_bd_agent_id') || '';
    const initialRate = getActiveRate(savedDate, 'bkash');
    setEditingOrder(null);
    setFormData({
      my_agent_id: '',
      bd_agent_id: savedBDAgent,
      type: 'bkash',
      amount_bdt: '',
      rate: initialRate > 0 ? initialRate.toString() : '',
      amount_myr: '',
      charge: '0',
      date: savedDate,
      remark: ''
    });
    setShowAdd(true);
  }, [lastOrderDate, defaultMobileRate, defaultBankRate, rateHistory, myAgents]);

  // F2 Shortcut key to open New Order
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        handleOpenNewOrder();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOpenNewOrder]);

  // Submodal for creating a new agent directly inside Create New Order
  const [showCreateAgentModal, setShowCreateAgentModal] = useState<'my' | 'bd' | null>(null);
  const [newAgentType, setNewAgentType] = useState<'my' | 'bd'>('my');
  const [newAgentFormData, setNewAgentFormData] = useState({
    name: '',
    initial_balance: '0',
    initial_balance_date: new Date().toISOString().split('T')[0],
    default_mobile_rate: '',
    default_bank_rate: '',
    phone: ''
  });
  const [isSubmittingAgent, setIsSubmittingAgent] = useState(false);

  const handleOpenCreateAgent = (type: 'my' | 'bd' = 'my') => {
    setNewAgentType(type);
    setNewAgentFormData({
      name: '',
      initial_balance: '0',
      initial_balance_date: new Date().toISOString().split('T')[0],
      default_mobile_rate: '',
      default_bank_rate: '',
      phone: ''
    });
    setShowCreateAgentModal(type);
  };

  const handleCreateAgentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentFormData.name.trim()) return;
    setIsSubmittingAgent(true);
    try {
      if (newAgentType === 'my') {
        const created = await store.addMYAgent(
          newAgentFormData.name.trim(),
          parseFloat(newAgentFormData.initial_balance) || 0,
          newAgentFormData.initial_balance_date,
          parseFloat(newAgentFormData.default_mobile_rate) || 0,
          parseFloat(newAgentFormData.default_bank_rate) || 0
        );
        if (created) {
          const isMobile = ['bkash', 'nagad'].includes(formData.type);
          const agentRate = isMobile ? parseFloat(newAgentFormData.default_mobile_rate) : parseFloat(newAgentFormData.default_bank_rate);
          const effectiveRate = (agentRate && agentRate > 0) ? agentRate.toString() : (getActiveRate(formData.date || lastOrderDate, formData.type, created.id)?.toString() || formData.rate);
          
          setFormData(prev => {
            let myr = prev.amount_myr;
            if (prev.amount_bdt && effectiveRate) {
              const calcMyr = parseFloat(prev.amount_bdt) / parseFloat(effectiveRate);
              if (!isNaN(calcMyr)) myr = calcMyr.toFixed(2);
            }
            return {
              ...prev,
              my_agent_id: created.id.toString(),
              rate: effectiveRate || prev.rate,
              amount_myr: myr
            };
          });
        }
      } else {
        const created = await store.addBDAgent(
          newAgentFormData.name.trim(),
          parseFloat(newAgentFormData.initial_balance) || 0,
          newAgentFormData.initial_balance_date,
          newAgentFormData.phone.trim()
        );
        if (created) {
          setFormData(prev => ({
            ...prev,
            bd_agent_id: created.id.toString()
          }));
          localStorage.setItem('last_bd_agent_id', created.id.toString());
        }
      }
      setShowCreateAgentModal(null);
    } catch (err) {
      console.error("Failed to create agent:", err);
    } finally {
      setIsSubmittingAgent(false);
    }
  };

  const handleCalc = (bdt: string, rate: string) => {
    if (bdt && rate) {
      const myr = parseFloat(bdt) / parseFloat(rate);
      setFormData(prev => ({ ...prev, amount_bdt: bdt, rate, amount_myr: myr.toFixed(2) }));
    } else {
      setFormData(prev => ({ ...prev, amount_bdt: bdt, rate, amount_myr: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingOrder) {
      store.updateOrder(editingOrder.id, formData);
    } else {
      store.addOrder(formData);
    }
    setShowAdd(false);
    setEditingOrder(null);
    const nextRate = getActiveRate(formData.date || lastOrderDate, 'bkash', '');
    setFormData({
      my_agent_id: '',
      bd_agent_id: formData.bd_agent_id,
      type: 'bkash',
      amount_bdt: '',
      rate: nextRate > 0 ? nextRate.toString() : '',
      amount_myr: '',
      charge: '0',
      date: formData.date || lastOrderDate,
      remark: ''
    });
    localStorage.setItem('last_bd_agent_id', formData.bd_agent_id);
    localStorage.setItem('last_order_date', formData.date || lastOrderDate);
    if (onOrderAdded) onOrderAdded();
  };

  const handleDelete = (id: number) => {
    setOrderToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!orderToDelete) return;
    store.deleteOrder(orderToDelete);
    handleReload();
    if (onOrderAdded) onOrderAdded();
    setOrderToDelete(null);
  };

  const handleBulkDelete = () => {
    if (selectedOrders.size === 0) return;
    setShowBulkDeleteConfirm(true);
  };

  const confirmBulkDelete = async () => {
    selectedOrders.forEach(id => {
      store.deleteOrder(id);
    });
    setSelectedOrders(new Set());
    setShowBulkDeleteConfirm(false);
    handleReload();
    if (onOrderAdded) onOrderAdded();
  };

  const handleEdit = (order: Order) => {
    setEditingOrder(order);
    setFormData({
      my_agent_id: order.my_agent_id.toString(),
      bd_agent_id: order.bd_agent_id.toString(),
      type: order.type,
      amount_bdt: order.amount_bdt.toString(),
      rate: order.rate.toString(),
      amount_myr: order.amount_myr.toString(),
      charge: (order.charge || 0).toString(),
      date: order.date,
      remark: order.remark || ''
    });
    setShowAdd(true);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filterMYAgent, filterBDAgent, filterStartDate, filterEndDate, searchTerm]);

  const [sortBy, setSortBy] = useState<'date' | 'amount_bdt' | 'amount_myr'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredOrders = orders.filter(order => {
    const matchesMYAgent = filterMYAgent === '' || filterMYAgent === 'all' || order.my_agent_id === parseInt(filterMYAgent);
    const matchesBDAgent = filterBDAgent === '' || filterBDAgent === 'all' || order.bd_agent_id === parseInt(filterBDAgent);
    
    let matchesDate = true;
    if (filterStartDate && filterEndDate) {
      matchesDate = order.date >= filterStartDate && order.date <= filterEndDate;
    } else if (filterStartDate) {
      matchesDate = order.date >= filterStartDate;
    } else if (filterEndDate) {
      matchesDate = order.date <= filterEndDate;
    }

    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = searchTerm === '' || 
      order.my_agent_name?.toLowerCase().includes(searchLower) ||
      order.bd_agent_name?.toLowerCase().includes(searchLower) ||
      order.remark?.toLowerCase().includes(searchLower) ||
      order.amount_bdt.toString().includes(searchTerm) ||
      order.amount_myr.toString().includes(searchTerm);
    
    return matchesMYAgent && matchesBDAgent && matchesDate && matchesSearch;
  }).sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'date') {
      comparison = String(a.date || '').localeCompare(String(b.date || ''));
    } else if (sortBy === 'amount_bdt') {
      comparison = Number(a.amount_bdt) - Number(b.amount_bdt);
    } else if (sortBy === 'amount_myr') {
      comparison = Number(a.amount_myr) - Number(b.amount_myr);
    }
    
    if (comparison === 0) comparison = a.id - b.id;
    return sortOrder === 'desc' ? -comparison : comparison;
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const currentOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleToggleOrder = (id: number) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedOrders(newSelected);
  };

  const handleToggleAll = () => {
    if (selectedOrders.size === currentOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(currentOrders.map(o => o.id)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div className="flex flex-1 items-center gap-2 max-w-2xl w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search orders..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 dark:focus:ring-white outline-none dark:text-white"
            />
          </div>
          
          <div className="relative flex items-center">
            <div className="absolute left-3 pointer-events-none text-slate-500 dark:text-slate-400">
              <ArrowUpDown size={16} />
            </div>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [newSortBy, newSortOrder] = e.target.value.split('-');
                setSortBy(newSortBy as any);
                setSortOrder(newSortOrder as any);
              }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm pl-10 pr-10 py-2 outline-none dark:text-white min-w-[200px] appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="amount_bdt-desc">Amount BDT (High to Low)</option>
              <option value="amount_bdt-asc">Amount BDT (Low to High)</option>
              <option value="amount_myr-desc">Amount RM (High to Low)</option>
              <option value="amount_myr-asc">Amount RM (Low to High)</option>
            </select>
            <div className="absolute right-3 pointer-events-none text-slate-500 dark:text-slate-400">
              <ChevronDown size={16} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedOrders.size > 0 && (
            <Button variant="danger" onClick={handleBulkDelete} className="text-xs py-1.5 whitespace-nowrap gap-2">
              <Trash2 size={16} /> Delete Selected ({selectedOrders.size})
            </Button>
          )}
          <Button variant="outline" onClick={onBulkUpload} className="text-xs py-1.5 whitespace-nowrap gap-2">
            <Download size={16} className="rotate-180" /> Bulk Upload
          </Button>
          <Button 
            onClick={handleOpenNewOrder} 
            className="text-xs py-1.5 whitespace-nowrap gap-1.5 bg-indigo-600 hover:bg-indigo-700 shadow-sm"
            title="Create New Order (Press F2 shortcut)"
          >
            <Plus size={16} /> 
            <span>New Order</span>
            <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] bg-white/20 text-white rounded font-mono font-semibold">F2</kbd>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-3 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
          <SearchableSelect 
            label="MY Agent" 
            value={filterMYAgent}
            onChange={val => setFilterMYAgent(val)}
            options={[{value: '', label: 'Blank'}, {value: 'all', label: 'All MY Agents'}, ...myAgents.map(a => ({value: a.id, label: a.name}))]} 
          />
          <SearchableSelect 
            label="BD Agent" 
            value={filterBDAgent}
            onChange={val => setFilterBDAgent(val)}
            options={[{value: '', label: 'Blank'}, {value: 'all', label: 'All BD Agents'}, ...bdAgents.map(a => ({value: a.id, label: a.name}))]} 
          />
          <Input 
            label="Start Date" 
            type="date" 
            value={filterStartDate}
            onChange={e => setFilterStartDate(e.target.value)}
          />
          <Input 
            label="End Date" 
            type="date" 
            value={filterEndDate}
            onChange={e => setFilterEndDate(e.target.value)}
          />
          <div className="flex items-end">
            <Button variant="outline" className="w-full text-xs py-1.5" onClick={() => { 
              setFilterMYAgent(''); 
              setFilterBDAgent('');
              setFilterStartDate(''); 
              setFilterEndDate(''); 
              setSearchTerm('');
            }}>
              Clear
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-2 py-2 border-r border-slate-200 dark:border-slate-700 w-8 text-center">
                  <input 
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                    checked={currentOrders.length > 0 && selectedOrders.size === currentOrders.length}
                    onChange={handleToggleAll}
                  />
                </th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase w-32 border-r border-slate-200 dark:border-slate-700">Date</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">MY Agent</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">BD Agent</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">Type</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">BDT</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">Rate</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">RM</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">Charge (BD)</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">Remark</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {currentOrders.length > 0 ? currentOrders.map((order, idx) => (
                <tr key={`${order.id}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <td className="px-2 py-2 text-center border-r border-slate-200 dark:border-slate-700">
                    <input 
                      type="checkbox"
                      className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                      checked={selectedOrders.has(order.id)}
                      onChange={() => handleToggleOrder(order.id)}
                    />
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap border-r border-slate-200 dark:border-slate-700">{formatDate(order.date)}</td>
                  <td className="px-2 py-2 text-xs font-medium text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">{order.my_agent_name}</td>
                  <td className="px-2 py-2 text-xs text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700">{order.bd_agent_name}</td>
                  <td className="px-2 py-2 border-r border-slate-200 dark:border-slate-700">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                      order.type === 'bkash' ? "bg-pink-100 text-pink-700" : order.type === 'nagad' ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                    )}>
                      {order.type}
                    </span>
                  </td>
                  <td className="px-2 py-2 font-mono text-xs dark:text-slate-300 border-r border-slate-200 dark:border-slate-700">{order.amount_bdt.toLocaleString()}</td>
                  <td className="px-2 py-2 font-mono text-xs dark:text-slate-300 border-r border-slate-200 dark:border-slate-700">{order.rate && !isNaN(Number(order.rate)) ? Number(order.rate).toFixed(2) : order.rate || '-'}</td>
                  <td className="px-2 py-2 font-bold text-xs text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">{formatCurrency(order.amount_myr)}</td>
                  <td className="px-2 py-2 text-xs text-red-600 dark:text-red-400 border-r border-slate-200 dark:border-slate-700">{Number(order.charge || 0).toLocaleString()} <span className="text-[10px] opacity-70">BDT</span></td>
                  <td className="px-2 py-2 text-[10px] text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700 max-w-[150px] truncate" title={order.remark}>
                    {order.remark || '-'}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex gap-1.5">
                      <Button variant="outline" className="py-1 px-2 text-[10px]" onClick={() => handleEdit(order)}>Edit</Button>
                      <Button variant="danger" className="py-1 px-2 text-[10px]" onClick={() => handleDelete(order.id)}><Trash2 size={12} /></Button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={11} className="px-4 py-4 text-center text-slate-500 dark:text-slate-400 text-xs">No orders found matching the filters.</td>
                </tr>
              )}
            </tbody>
            {filteredOrders.length > 0 && (
              <tfoot className="bg-slate-50 dark:bg-slate-800 font-bold border-t-2 border-slate-200 dark:border-slate-700 sticky bottom-0 z-10">
                <tr>
                  <td colSpan={5} className="px-2 py-2 text-xs text-slate-900 dark:text-white text-right border-r border-slate-200 dark:border-slate-700">TOTAL:</td>
                  <td className="px-2 py-2 text-xs text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">{filteredOrders.reduce((sum, o) => sum + o.amount_bdt, 0).toLocaleString()}</td>
                  <td className="px-2 py-2 text-xs text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">-</td>
                  <td className="px-2 py-2 text-xs text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">{formatCurrency(filteredOrders.reduce((sum, o) => sum + Number(o.amount_myr), 0))}</td>
                  <td className="px-2 py-2 text-xs text-red-600 dark:text-red-400 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">
                    {filteredOrders.reduce((sum, o) => sum + Number(o.charge || 0), 0).toLocaleString()} <span className="text-[10px] opacity-70">BDT</span>
                  </td>
                  <td className="px-2 py-2"></td>
                  <td className="px-2 py-2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-between items-center pt-2">
          <div className="text-xs text-slate-500">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length} entries
          </div>
          <div className="flex gap-1">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 px-2 text-xs"
            >
              Previous
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  className="h-8 w-8 p-0 text-xs"
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8 px-2 text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-50 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-4 md:p-6 min-h-screen flex flex-col">
            <div className="flex justify-between items-start sm:items-center mb-6 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{editingOrder ? 'Edit Order' : 'Create New Order'}</h2>
                  {!editingOrder && (
                    <span className="px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-mono rounded-md font-semibold">
                      F2
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Enter transfer details or quickly register a new agent
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleOpenCreateAgent('my')} 
                  className="text-xs py-1.5 px-3 h-9 gap-1.5 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-medium"
                  title="Create a new Malaysia or Bangladesh Agent"
                >
                  <UserPlus size={15} /> 
                  <span>+ Create Agent</span>
                </Button>
                <button 
                  type="button"
                  onClick={() => { setShowAdd(false); setEditingOrder(null); }} 
                  className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                >
                  <Plus className="rotate-45 w-6 h-6 text-slate-600 dark:text-slate-400" />
                </button>
              </div>
            </div>
            <Card className="p-5 flex-1">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <SearchableSelect 
                    label="Malaysia Agent" 
                    value={formData.my_agent_id || ''}
                    options={myAgents.map(a => ({value: a.id, label: a.name}))} 
                    action={
                      <button 
                        type="button" 
                        onClick={() => handleOpenCreateAgent('my')}
                        className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-0.5 hover:underline"
                        title="Create new Malaysia Agent"
                      >
                        <Plus size={12} /> New MY Agent
                      </button>
                    }
                    onChange={val => {
                      const rate = getActiveRate(formData.date || lastOrderDate, formData.type, val);
                      setFormData(prev => {
                         const newRate = rate ? rate.toString() : prev.rate;
                         if (prev.amount_bdt && newRate) {
                             const myr = parseFloat(prev.amount_bdt) / parseFloat(newRate);
                             return { ...prev, my_agent_id: val, rate: newRate, amount_myr: myr.toFixed(2) };
                         }
                         return { ...prev, my_agent_id: val, rate: newRate };
                      });
                    }}
                    required
                  />
                  <SearchableSelect 
                    label="Bangladesh Agent" 
                    value={formData.bd_agent_id || ''}
                    options={bdAgents.map(a => ({value: a.id, label: a.name}))} 
                    action={
                      <button 
                        type="button" 
                        onClick={() => handleOpenCreateAgent('bd')}
                        className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-0.5 hover:underline"
                        title="Create new Bangladesh Agent"
                      >
                        <Plus size={12} /> New BD Agent
                      </button>
                    }
                    onChange={val => {
                      setFormData(prev => ({ ...prev, bd_agent_id: val }));
                      if (!editingOrder) {
                        localStorage.setItem('last_bd_agent_id', val);
                      }
                    }}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select 
                    label="Transfer Type" 
                    value={formData.type || ''}
                    options={[{value: 'bkash', label: 'Bkash'}, {value: 'bank', label: 'Bank Transfer'}, {value: 'nagad', label: 'Nagad'}]} 
                    onChange={e => {
                      const newType = e.target.value as any;
                      const rate = getActiveRate(formData.date || lastOrderDate, newType, formData.my_agent_id);
                      
                      setFormData(prev => {
                         const newRate = rate ? rate.toString() : prev.rate;
                         if (prev.amount_bdt && newRate) {
                             const myr = parseFloat(prev.amount_bdt) / parseFloat(newRate);
                             return { ...prev, type: newType, rate: newRate, amount_myr: myr.toFixed(2), charge: newType === 'bank' ? prev.charge : '0' };
                         }
                         return { ...prev, type: newType, rate: newRate, charge: newType === 'bank' ? prev.charge : '0' };
                      });
                    }}
                  />
                  <Input 
                    label="Date" 
                    type="date" 
                    value={formData.date || ''} 
                    onChange={e => {
                      const newDate = e.target.value;
                      if (!editingOrder) {
                        localStorage.setItem('last_order_date', newDate);
                      }
                      const rate = getActiveRate(newDate, formData.type, formData.my_agent_id);
                      setFormData(prev => {
                        const newRate = rate ? rate.toString() : prev.rate;
                        if (prev.amount_bdt && newRate) {
                          const myr = parseFloat(prev.amount_bdt) / parseFloat(newRate);
                          return { ...prev, date: newDate, rate: newRate, amount_myr: myr.toFixed(2) };
                        }
                        return { ...prev, date: newDate, rate: newRate };
                      });
                    }} 
                  />
                </div>
                <div className="w-full">
                  <Input 
                    label="BDT Amount" 
                    type="number" 
                    value={formData.amount_bdt || ''} 
                    placeholder="0.00" 
                    onChange={e => handleCalc(e.target.value, formData.rate)} 
                    required 
                    className="text-lg py-2 font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <Input label="Exchange Rate" type="number" step="0.01" value={formData.rate || ''} onChange={e => handleCalc(formData.amount_bdt, e.target.value)} required />
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total RM (Auto)</label>
                    <div className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white text-xs">
                      {formData.amount_myr || '0.00'}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input 
                    label="Charge (BD)" 
                    type="number" 
                    step="0.01"
                    disabled={formData.type !== 'bank'} 
                    value={formData.charge} 
                    onChange={e => setFormData(prev => ({ ...prev, charge: e.target.value }))}
                    className={formData.type !== 'bank' ? 'bg-slate-100 cursor-not-allowed opacity-60' : ''}
                  />
                </div>
                <Input 
                  label="Remark" 
                  value={formData.remark || ''} 
                  placeholder="Optional notes..." 
                  onChange={e => setFormData(prev => ({ ...prev, remark: e.target.value }))} 
                />
                <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-700 mt-4">
                  <Button variant="outline" className="flex-1" onClick={() => { setShowAdd(false); setEditingOrder(null); }} type="button">Cancel</Button>
                  <Button type="submit" className="flex-1">{editingOrder ? 'Update Order' : 'Confirm Order'}</Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}

      {/* Modal for Creating New Agent inside Order Flow */}
      {showCreateAgentModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {newAgentType === 'my' ? 'New Malaysia Agent' : 'New Bangladesh Agent'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Will be created and auto-selected for this order
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowCreateAgentModal(null)} 
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
              >
                <Plus className="rotate-45 w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAgentSubmit} className="p-5 space-y-4 overflow-y-auto">
              {/* Agent Type Selector */}
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setNewAgentType('my')}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all",
                    newAgentType === 'my' 
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  )}
                >
                  Malaysia (MY)
                </button>
                <button
                  type="button"
                  onClick={() => setNewAgentType('bd')}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all",
                    newAgentType === 'bd' 
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  )}
                >
                  Bangladesh (BD)
                </button>
              </div>

              <Input 
                label="Agent Name" 
                value={newAgentFormData.name} 
                onChange={e => setNewAgentFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={newAgentType === 'my' ? "e.g. KL Remit / Agent Name" : "e.g. Dhaka Express / Agent Name"} 
                required 
                autoFocus
              />

              <div className="grid grid-cols-2 gap-3">
                <Input 
                  label={newAgentType === 'my' ? "Initial Balance (RM)" : "Initial Balance (BDT)"} 
                  type="number"
                  step="0.01"
                  value={newAgentFormData.initial_balance} 
                  onChange={e => setNewAgentFormData(prev => ({ ...prev, initial_balance: e.target.value }))}
                  placeholder="0.00" 
                />
                <Input 
                  label="Balance Date" 
                  type="date"
                  value={newAgentFormData.initial_balance_date} 
                  onChange={e => setNewAgentFormData(prev => ({ ...prev, initial_balance_date: e.target.value }))}
                />
              </div>

              {newAgentType === 'my' ? (
                <div className="grid grid-cols-2 gap-3 p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-xl">
                  <Input 
                    label="Default Mobile Rate" 
                    type="number"
                    step="0.01"
                    value={newAgentFormData.default_mobile_rate} 
                    onChange={e => setNewAgentFormData(prev => ({ ...prev, default_mobile_rate: e.target.value }))}
                    placeholder="e.g. 27.50 (Optional)" 
                  />
                  <Input 
                    label="Default Bank Rate" 
                    type="number"
                    step="0.01"
                    value={newAgentFormData.default_bank_rate} 
                    onChange={e => setNewAgentFormData(prev => ({ ...prev, default_bank_rate: e.target.value }))}
                    placeholder="e.g. 28.00 (Optional)" 
                  />
                </div>
              ) : (
                <Input 
                  label="Phone Number" 
                  value={newAgentFormData.phone} 
                  onChange={e => setNewAgentFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+880 1XXX-XXXXXX (Optional)" 
                />
              )}

              <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowCreateAgentModal(null)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                  disabled={isSubmittingAgent || !newAgentFormData.name.trim()}
                >
                  {isSubmittingAgent ? 'Creating...' : `Create & Select Agent`}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Order"
        message="Are you sure you want to delete this order? This action cannot be undone."
      />
      
      <ConfirmationModal
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={confirmBulkDelete}
        title="Delete Selected Orders"
        message={`Are you sure you want to delete ${selectedOrders.size} selected order(s)? This action cannot be undone.`}
      />
    </div>
  );
}

// --- BD Agents Component ---
function BDAgents({ 
  token, 
  onAgentAdded, 
  onBulkUpload,
  onViewLedger 
}: { 
  token: string; 
  onAgentAdded?: () => void; 
  onBulkUpload?: () => void;
  onViewLedger?: (agentId: number) => void;
}) {
  const { bdAgents: agents } = useAppStore();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<BDAgent | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showView, setShowView] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [editingAgent, setEditingAgent] = useState<BDAgent | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const handleAddPayment = (agent: BDAgent) => {
    setSelectedAgent(agent);
    setShowPayment(true);
  };

  const handleViewPayments = (agent: BDAgent) => {
    setSelectedAgent(agent);
    setShowView(true);
  };

  const handleViewLedger = (agent: BDAgent) => {
    if (onViewLedger) {
      onViewLedger(agent.id);
    } else {
      setSelectedAgent(agent);
      setShowLedger(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const initial_balance = parseFloat(formData.get('initial_balance') as string) || 0;
    const initial_balance_date = formData.get('initial_balance_date') as string;
    
    if (editingAgent) {
      store.updateBDAgent(editingAgent.id, { name, initial_balance, initial_balance_date });
    } else {
      store.addBDAgent(name, initial_balance, initial_balance_date);
    }
    setShowAdd(false);
    setEditingAgent(null);
    if (onAgentAdded) onAgentAdded();
  };

  const handleEdit = (agent: BDAgent) => {
    setEditingAgent(agent);
    setShowAdd(true);
  };

  const handleDelete = (id: number) => {
    setAgentToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (agentToDelete) {
      store.deleteBDAgent(agentToDelete);
      if (onAgentAdded) onAgentAdded();
      setAgentToDelete(null);
      setShowDeleteConfirm(false);
    }
  };

  const filteredAgents = agents.filter(agent => 
    agent.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredAgents.length / itemsPerPage);
  const currentAgents = filteredAgents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text(`BD Agent Report`, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
    
    const tableData = filteredAgents.map(a => [
      a.id,
      a.name,
      a.initial_balance.toLocaleString(),
      a.initial_balance_date
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['ID', 'Name', 'Initial Balance', 'Date']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] }
    });

    doc.save('bd_agents_report.pdf');
  };

  const exportToExcel = () => {
    const tableData = filteredAgents.map(a => ({
      'ID': a.id,
      'Name': a.name,
      'Initial Balance': a.initial_balance,
      'Date': a.initial_balance_date
    }));

    const ws = XLSX.utils.json_to_sheet(tableData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BD Agents');
    XLSX.writeFile(wb, 'bd_agents_report.xlsx');
  };

    const exportToCSV = () => {
      const csv = Papa.unparse(filteredAgents.map(a => ({
          'ID': a.id,
          'Name': a.name,
          'Initial Balance': a.initial_balance,
          'Date': a.initial_balance_date
      })));
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, 'bd_agents_report.csv');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search BD agents..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 dark:focus:ring-white outline-none dark:text-white"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToPDF} className="text-xs py-1.5 whitespace-nowrap gap-2">PDF</Button>
          <Button variant="outline" onClick={exportToExcel} className="text-xs py-1.5 whitespace-nowrap gap-2">Excel</Button>
          <Button variant="outline" onClick={exportToCSV} className="text-xs py-1.5 whitespace-nowrap gap-2">CSV</Button>
          <Button variant="outline" onClick={onBulkUpload} className="text-xs py-1.5 whitespace-nowrap gap-2">
            <Download size={16} className="rotate-180" /> Bulk Upload
          </Button>
          <Button onClick={() => { setEditingAgent(null); setShowAdd(true); }} className="text-xs py-1.5 whitespace-nowrap"><Plus size={16} /> Add BD Agent</Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">Agent Name</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">Balance (BDT)</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {currentAgents.map((agent, idx) => (
                <tr key={`${agent.id}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <td className="px-2 py-2 text-xs font-semibold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">
                    {agent.name}
                  </td>
                  <td className="px-2 py-2 text-xs font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">
                    {(agent.total_payments_bdt - agent.total_orders_bdt + (Number(agent.initial_balance) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-7 px-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 gap-1 whitespace-nowrap" 
                        onClick={() => handleAddPayment(agent)}
                        title="Add Payment"
                      >
                        <Plus size={12} /> Payment
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-7 px-2 text-[11px] text-slate-700 dark:text-slate-300 gap-1 whitespace-nowrap" 
                        onClick={() => handleViewPayments(agent)}
                        title="View Payments"
                      >
                        <Eye size={12} /> Payments
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-7 px-2 text-[11px] text-slate-700 dark:text-slate-300 gap-1 whitespace-nowrap" 
                        onClick={() => handleViewLedger(agent)}
                        title="View Ledger"
                      >
                        <Receipt size={12} /> Ledger
                      </Button>
                      <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-0.5" />
                      <button onClick={() => handleEdit(agent)} className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors" title="Edit Agent">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => handleDelete(agent.id)} className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors" title="Delete Agent">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {filteredAgents.length > 0 && (
              <tfoot className="bg-slate-50 dark:bg-slate-800 font-bold border-t-2 border-slate-200 dark:border-slate-700 sticky bottom-0 z-10">
                <tr>
                  <td className="px-2 py-2 text-xs text-slate-900 dark:text-white text-right border-r border-slate-200 dark:border-slate-700">TOTAL:</td>
                  <td className="px-2 py-2 text-xs text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">
                    {filteredAgents.reduce((sum, agent) => sum + (agent.total_payments_bdt - agent.total_orders_bdt + (Number(agent.initial_balance) || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT
                  </td>
                  <td className="px-2 py-2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-between items-center pt-2">
          <div className="text-xs text-slate-500">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredAgents.length)} of {filteredAgents.length} entries
          </div>
          <div className="flex gap-1">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 px-2 text-xs"
            >
              Previous
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  className="h-8 w-8 p-0 text-xs"
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8 px-2 text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 z-50 overflow-y-auto">
          <div className="max-w-xl mx-auto p-4 md:p-6 min-h-screen flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{editingAgent ? 'Edit BD Agent' : 'Add BD Agent'}</h2>
              <button onClick={() => { setShowAdd(false); setEditingAgent(null); }} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"><Plus className="rotate-45 w-6 h-6 text-slate-600 dark:text-slate-400" /></button>
            </div>
            <Card className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input name="name" label="Agent Name" placeholder="e.g. BD Express" defaultValue={editingAgent?.name} required />

                <Input name="initial_balance" label="Initial Balance (BDT)" type="number" step="0.01" placeholder="0.00" defaultValue={editingAgent?.initial_balance} />
                <Input name="initial_balance_date" label="Initial Balance Date" type="date" defaultValue={editingAgent?.initial_balance_date || new Date().toISOString().split('T')[0]} />
                <div className="flex gap-2 pt-4 border-t border-slate-100">
                  <Button variant="outline" className="flex-1" onClick={() => { setShowAdd(false); setEditingAgent(null); }} type="button">Cancel</Button>
                  <Button type="submit" className="flex-1">{editingAgent ? 'Update Agent' : 'Save Agent'}</Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Agent"
        message="Are you sure you want to delete this agent? This action cannot be undone and may affect related orders and payments."
      />

      {selectedAgent && (
        <>
          <PaymentModal 
            isOpen={showPayment} 
            onClose={() => setShowPayment(false)} 
            agent={selectedAgent} 
            type="BD" 
            token={token} 
            onSuccess={() => {
              if (onAgentAdded) onAgentAdded();
            }} 
          />
          <ViewPaymentsModal 
            isOpen={showView} 
            onClose={() => setShowView(false)} 
            agent={selectedAgent} 
            type="BD" 
            token={token} 
            onViewLedger={() => {
              setShowView(false);
              if (onViewLedger && selectedAgent) {
                onViewLedger(selectedAgent.id);
              } else {
                setShowLedger(true);
              }
            }}
            onSuccess={() => {
              if (onAgentAdded) onAgentAdded();
            }}
          />
          <ViewLedgerModal
            isOpen={showLedger}
            onClose={() => setShowLedger(false)}
            agent={selectedAgent}
            type="BD"
          />
        </>
      )}
    </div>
  );
}

// --- Conversion Component ---
function ConversionTab({ token, onConversionAdded }: { token: string; onConversionAdded?: () => void }) {
  const { conversions, bdAgents, refresh } = useAppStore();
  const [showAdd, setShowAdd] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [editingConversion, setEditingConversion] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [conversionToDelete, setConversionToDelete] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [dateFilter, setDateFilter] = useState('');
  const [bdAgentFilter, setBdAgentFilter] = useState('');

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount_myr: '',
    rate: '',
    amount_bdt: '',
    bank_charges: '0',
    commission_enabled: false,
    pay_to_bd_agent_id: ''
  });

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
        direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const filteredConversions = conversions.filter(c => {
    let match = true;
    if (dateFilter && c.date !== dateFilter) match = false;
    if (bdAgentFilter && String(c.pay_to_bd_agent_id) !== bdAgentFilter) match = false;
    return match;
  });
 
  const sortedConversions = [...filteredConversions].sort((a, b) => {
    let aVal = a[sortConfig.key as keyof typeof a];
    let bVal = b[sortConfig.key as keyof typeof b];
    
    // Simple handling for date string comparisons
    if (sortConfig.key === 'date') {
        aVal = new Date(aVal as string).getTime();
        bVal = new Date(bVal as string).getTime();
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleReload = () => {
    setIsReloading(true);
    refresh();
    setTimeout(() => setIsReloading(false), 600);
  };

  // Calculate Final Rate and Amounts
  const baseRate = parseFloat(formData.rate) || 0;
  const finalRate = formData.commission_enabled ? baseRate * 1.025 : baseRate;
  
  // Recalculate amounts when inputs change
  const handleCalc = (myr: string, rate: string, commission_enabled: boolean) => {
    const myrVal = parseFloat(myr) || 0;
    const rateVal = parseFloat(rate) || 0;
    
    // Base BDT (before commission)
    const baseBdt = myrVal * rateVal;
    
    // Commission Amount
    const commission = commission_enabled ? baseBdt * 0.025 : 0;
    
    // Total BD Received (Base + Commission)
    // This is equivalent to myr * finalRate
    const totalBdt = baseBdt + commission;

    setFormData(prev => ({ 
      ...prev, 
      amount_myr: myr, 
      rate: rate, 
      commission_enabled: commission_enabled,
      amount_bdt: baseBdt.toFixed(2) // Store Base BDT for display/reference
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // We want to store the Final Rate and Total Amount
    // But store.ts expects 'rate' and 'amount_bdt'. 
    // If we store Final Rate as 'rate', then amount_bdt should be Total Amount.
    // However, we also want to track commission.
    
    // Let's calculate the values to send to store
    const myrVal = parseFloat(formData.amount_myr);
    const rateVal = parseFloat(formData.rate); // Base Rate
    const finalRateVal = formData.commission_enabled ? rateVal * 1.025 : rateVal;
    
    // We will store the Final Rate as the 'rate' so it reflects everywhere
    // And we store the Base Amount as 'amount_bdt' to keep commission calculation consistent in store?
    // Wait, store.ts calculates commission based on amount_bdt * 0.02 if enabled.
    // If we pass Final Rate, store might miscalculate.
    
    // Let's look at store.ts addConversion logic:
    // const commission_amount = data.commission_enabled ? Number(data.amount_bdt) * 0.02 : 0;
    // const total_bd_received = Number(data.amount_bdt) + commission_amount;
    
    // So store expects 'amount_bdt' to be the Base Amount.
    // And 'rate' to be the Base Rate (implied, since amount_bdt = myr * rate).
    
    // The user wants "Final Conversion Rate" reflected everywhere.
    // If we store Base Rate in DB, we must display Final Rate in UI by calculating it.
    // Let's do that. We store Base Rate and Base Amount.
    // In the table, we display Final Rate.
    
    if (editingConversion) {
      await store.updateConversion(editingConversion.id, formData);
    } else {
      await store.addConversion(formData);
    }
    setShowAdd(false);
    setEditingConversion(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      amount_myr: '',
      rate: '',
      amount_bdt: '',
      bank_charges: '0',
      commission_enabled: false,
      pay_to_bd_agent_id: ''
    });
    if (onConversionAdded) onConversionAdded();
  };

  const handleEdit = (conv: any) => {
    setEditingConversion(conv);
    setFormData({
      date: conv.date,
      amount_myr: conv.amount_myr.toString(),
      rate: conv.rate.toString(),
      amount_bdt: conv.amount_bdt.toString(),
      bank_charges: conv.bank_charges.toString(),
      commission_enabled: conv.commission_enabled || false,
      pay_to_bd_agent_id: conv.pay_to_bd_agent_id?.toString() || ''
    });
    setShowAdd(true);
  };

  const handleDelete = (id: number) => {
    setConversionToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (conversionToDelete) {
      await store.deleteConversion(conversionToDelete);
      if (onConversionAdded) onConversionAdded();
      setConversionToDelete(null);
      setShowDeleteConfirm(false);
    }
  };

  const commissionAmount = formData.commission_enabled && formData.amount_bdt 
    ? (parseFloat(formData.amount_bdt) * 0.025) 
    : 0;
  
  const totalBdReceived = formData.amount_bdt 
    ? parseFloat(formData.amount_bdt) + commissionAmount 
    : 0;
  
  const totalPages = Math.ceil(sortedConversions.length / itemsPerPage);
  const currentConversions = sortedConversions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-900">RM Convert</h2>
          <p className="text-xs text-slate-500">Track MYR to BDT conversions through banks.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReload} className="text-xs py-1.5 h-10">
            <RefreshCw size={16} className={cn(isReloading && "animate-spin")} />
          </Button>
          <Button onClick={() => { setEditingConversion(null); setShowAdd(true); }} className="text-xs py-1.5 h-10"><Plus size={16} /> Log RM Convert</Button>
        </div>
      </div>

      <Card className="p-4 flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Date</label>
          <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
        </div>
        <div className="flex-1">
          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Pay To BD Agent</label>
          <select 
            className="w-full h-10 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={bdAgentFilter}
            onChange={e => setBdAgentFilter(e.target.value)}
          >
            <option value="">All Agents</option>
            {bdAgents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <Button variant="outline" className="h-10 px-4" onClick={() => { setDateFilter(''); setBdAgentFilter(''); }}>Clear</Button>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase w-32 border-r border-slate-200 dark:border-slate-700 cursor-pointer" onClick={() => handleSort('date')}>
                    Date {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} className="inline" /> : <ChevronDown size={12} className="inline" />)}
                </th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700 cursor-pointer" onClick={() => handleSort('amount_myr')}>
                    Total Send RM {sortConfig.key === 'amount_myr' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} className="inline" /> : <ChevronDown size={12} className="inline" />)}
                </th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">Final Rate</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">BD Amount</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">2.5% Commission</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">Total BD Received</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">Pay To</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">Bank Charge</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {currentConversions.map((conv, idx) => {
                // Calculate Final Rate for display
                const displayRate = conv.commission_enabled ? conv.rate * 1.025 : conv.rate;
                return (
                  <tr key={`${conv.id}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-2 py-2 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap border-r border-slate-200 dark:border-slate-700">{formatDate(conv.date)}</td>
                    <td className="px-2 py-2 text-xs font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">{formatCurrency(conv.amount_myr)}</td>
                    <td className="px-2 py-2 text-xs text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700">{displayRate.toFixed(2)}</td>
                    <td className="px-2 py-2 text-xs font-mono text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">{conv.amount_bdt.toLocaleString()}</td>
                    <td className="px-2 py-2 text-xs text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700">{conv.commission_enabled ? (conv.amount_bdt * 0.025).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                    <td className="px-2 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 border-r border-slate-200 dark:border-slate-700">{(conv.total_bd_received || conv.amount_bdt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-2 py-2 text-xs text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700">{bdAgents.find(a => Number(a.id) === Number(conv.pay_to_bd_agent_id))?.name || '-'}</td>
                    <td className="px-2 py-2 text-xs text-red-600 dark:text-red-400 border-r border-slate-200 dark:border-slate-700">{formatCurrency(conv.bank_charges)}</td>
                    <td className="px-2 py-2 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => handleEdit(conv)} className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors" title="Edit Conversion">
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleDelete(conv.id)} className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors" title="Delete Conversion">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {sortedConversions.length > 0 && (
              <tfoot className="bg-slate-50 dark:bg-slate-800 font-bold border-t-2 border-slate-200 dark:border-slate-700 sticky bottom-0 z-10">
                <tr>
                  <td className="px-2 py-2 text-xs text-slate-900 dark:text-white text-right border-r border-slate-200 dark:border-slate-700">TOTAL:</td>
                  <td className="px-2 py-2 text-xs text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">{formatCurrency(sortedConversions.reduce((sum, c) => sum + Number(c.amount_myr), 0))}</td>
                  <td className="px-2 py-2 text-xs text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">-</td>
                  <td className="px-2 py-2 text-xs text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">{sortedConversions.reduce((sum, c) => sum + Number(c.amount_bdt), 0).toLocaleString()}</td>
                  <td className="px-2 py-2 text-xs text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">{sortedConversions.reduce((sum, c) => sum + (c.commission_enabled ? Number(c.amount_bdt) * 0.025 : 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-2 py-2 text-xs text-emerald-600 dark:text-emerald-400 border-r border-slate-200 dark:border-slate-700">{sortedConversions.reduce((sum, c) => sum + Number(c.total_bd_received || c.amount_bdt), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-2 py-2 text-xs text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">-</td>
                  <td className="px-2 py-2 text-xs text-red-600 dark:text-red-400 border-r border-slate-200 dark:border-slate-700">{formatCurrency(sortedConversions.reduce((sum, c) => sum + Number(c.bank_charges), 0))}</td>
                  <td className="px-2 py-2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-between items-center pt-2">
          <div className="text-xs text-slate-500">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, sortedConversions.length)} of {sortedConversions.length} entries
          </div>
          <div className="flex gap-1">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 px-2 text-xs"
            >
              Previous
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  className="h-8 w-8 p-0 text-xs"
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8 px-2 text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-50 overflow-y-auto">
          <div className="max-w-xl mx-auto p-4 md:p-6 min-h-screen flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{editingConversion ? 'Edit RM Convert' : 'Log RM Convert'}</h2>
              <button onClick={() => { setShowAdd(false); setEditingConversion(null); }} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"><Plus className="rotate-45 w-6 h-6 text-slate-600 dark:text-slate-400" /></button>
            </div>
            <Card className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Date" type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                
                <Input 
                  label="Total Send RM" 
                  type="number" 
                  step="0.01" 
                  value={formData.amount_myr} 
                  onChange={e => handleCalc(e.target.value, formData.rate, formData.commission_enabled)} 
                  required 
                />

                <Input 
                  label="Conversion Rate" 
                  type="number" 
                  step="0.01" 
                  value={formData.rate} 
                  onChange={e => handleCalc(formData.amount_myr, e.target.value, formData.commission_enabled)} 
                  required 
                />

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Final Conversion Rate</label>
                  <div className="w-full px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white">
                    {finalRate.toFixed(2)}
                  </div>
                </div>

                <Input 
                  label="BDT Amount (Auto)" 
                  type="number" 
                  value={formData.amount_bdt} 
                  readOnly 
                  className="bg-slate-50 dark:bg-slate-800 font-bold dark:text-white" 
                  required 
                />
                
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="commission" 
                      checked={formData.commission_enabled} 
                      onChange={e => handleCalc(formData.amount_myr, formData.rate, e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white focus:ring-slate-900 dark:focus:ring-white"
                    />
                    <label htmlFor="commission" className="text-sm font-medium text-slate-700 dark:text-slate-300">Add 2.5% Commission</label>
                  </div>
                  
                  <div className="flex justify-between text-sm p-2 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-700">
                    <span className="text-slate-500 dark:text-slate-400">Commission Amount:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{commissionAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT</span>
                  </div>
                  
                  <div className="flex justify-between text-sm p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded border border-emerald-100 dark:border-emerald-800/50">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Total BD Received:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{totalBdReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT</span>
                  </div>
                </div>

                <Select 
                  label="Pay To (BD Agent)" 
                  value={formData.pay_to_bd_agent_id}
                  options={[{value: '', label: 'Select Agent (Optional)'}, ...bdAgents.map(a => ({value: a.id, label: a.name}))]} 
                  onChange={e => setFormData({...formData, pay_to_bd_agent_id: e.target.value})}
                />

                <Input label="Bank Charges (RM)" type="number" step="0.01" value={formData.bank_charges} onChange={e => setFormData({...formData, bank_charges: e.target.value})} />
                
                <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <Button variant="outline" className="flex-1" onClick={() => { setShowAdd(false); setEditingConversion(null); }} type="button">Cancel</Button>
                  <Button type="submit" className="flex-1">{editingConversion ? 'Update RM Convert' : 'Save RM Convert'}</Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Conversion"
        message="Are you sure you want to delete this conversion record? This action cannot be undone."
      />
    </div>
  );
}

// --- Expenses Component ---
function Expenses({ token, onExpenseAdded }: { token: string; onExpenseAdded?: () => void }) {
  const { expenses, rateHistory, conversions, orders, defaultBankRate, defaultMobileRate } = useAppStore();
  const [showAdd, setShowAdd] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeCurrency, setActiveCurrency] = useState<'MYR' | 'BDT'>('MYR');
  const itemsPerPage = 50;

  const filteredExpenses = expenses
    .filter(e => e.currency === activeCurrency)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    if (editingExpense) {
      store.updateExpense(editingExpense.id, { ...data, currency: activeCurrency });
    } else {
      store.addExpense({ ...data, currency: activeCurrency });
    }
    setShowAdd(false);
    setEditingExpense(null);
    if (onExpenseAdded) onExpenseAdded();
  };

  const handleEdit = (expense: any) => {
    setEditingExpense(expense);
    setShowAdd(true);
  };

  const handleDelete = (id: number) => {
    setExpenseToDelete(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (expenseToDelete) {
      store.deleteExpense(expenseToDelete);
      if (onExpenseAdded) onExpenseAdded();
      setExpenseToDelete(null);
      setShowDeleteConfirm(false);
    }
  };

  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
  const currentExpenses = filteredExpenses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalBdtAmount = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount_myr || 0), 0);
  const totalBdtConvertedRm = filteredExpenses.reduce((sum, exp) => {
    const rate = getExchangeRateForDate(exp.date, rateHistory, conversions, orders, defaultBankRate, defaultMobileRate);
    return sum + (rate > 0 ? Number(exp.amount_myr || 0) / rate : 0);
  }, 0);
  const totalMyrAmount = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount_myr || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Expenses</h2>
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Track operational costs, overheads, and banking transaction charges</p>
        </div>
        <Button onClick={() => { setEditingExpense(null); setShowAdd(true); }} className="text-xs py-1.5 h-10 px-4 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20"><Plus size={18} /> Add Expense</Button>
      </div>

      <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl w-fit border border-slate-200/50 dark:border-slate-700/50">
        <button 
          onClick={() => { setActiveCurrency('MYR'); setCurrentPage(1); }}
          className={cn(
            "px-4 py-2 text-[10px] font-bold rounded-lg transition-all",
            activeCurrency === 'MYR' 
              ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm ring-1 ring-slate-200/20" 
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          Malaysia (RM)
        </button>
        <button 
          onClick={() => { setActiveCurrency('BDT'); setCurrentPage(1); }}
          className={cn(
            "px-4 py-2 text-[10px] font-bold rounded-lg transition-all",
            activeCurrency === 'BDT' 
              ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm ring-1 ring-slate-200/20" 
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          Bangladesh (BDT)
        </button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase w-32 border-r border-slate-200 dark:border-slate-700">Date</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">Category</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700 w-36">
                  {activeCurrency === 'BDT' ? 'Amount (BDT)' : 'Amount (RM)'}
                </th>
                {activeCurrency === 'BDT' && (
                  <>
                    <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700 w-28 text-center">Day Ex. Rate</th>
                    <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700 w-32">Equivalent (RM)</th>
                  </>
                )}
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-700">Note</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {currentExpenses.map((exp, idx) => {
                const dayRate = activeCurrency === 'BDT' ? getExchangeRateForDate(exp.date, rateHistory, conversions, orders, defaultBankRate, defaultMobileRate) : 1;
                const equivalentRm = activeCurrency === 'BDT' ? (dayRate > 0 ? Number(exp.amount_myr || 0) / dayRate : 0) : Number(exp.amount_myr || 0);

                return (
                  <tr key={`${exp.id}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-2 py-2 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap border-r border-slate-200 dark:border-slate-700">{formatDate(exp.date)}</td>
                    <td className="px-2 py-2 text-xs font-medium text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[11px] font-semibold",
                        exp.category === 'Banking Transaction Charge' || exp.category === 'Bank Charge' || exp.category === 'Order Charge'
                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"
                          : "text-slate-800 dark:text-slate-200"
                      )}>
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-xs font-bold text-red-600 dark:text-red-400 border-r border-slate-200 dark:border-slate-700 font-mono">
                      {activeCurrency === 'MYR' ? formatCurrency(exp.amount_myr) : `${Number(exp.amount_myr).toLocaleString()} BDT`}
                    </td>
                    {activeCurrency === 'BDT' && (
                      <>
                        <td className="px-2 py-2 text-xs font-mono text-slate-600 dark:text-slate-300 text-center border-r border-slate-200 dark:border-slate-700">
                          {dayRate.toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-xs font-bold font-mono text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">
                          {formatCurrency(equivalentRm)}
                        </td>
                      </>
                    )}
                    <td className="px-2 py-2 text-slate-500 dark:text-slate-400 text-[10px] border-r border-slate-200 dark:border-slate-700">{exp.note}</td>
                    <td className="px-2 py-2 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => handleEdit(exp)} className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors" title="Edit Expense">
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleDelete(exp.id)} className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors" title="Delete Expense">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {filteredExpenses.length > 0 && (
              <tfoot className="bg-slate-50 dark:bg-slate-800 font-bold border-t-2 border-slate-200 dark:border-slate-700 sticky bottom-0 z-10">
                <tr>
                  <td colSpan={2} className="px-2 py-2 text-xs text-slate-900 dark:text-white text-right border-r border-slate-200 dark:border-slate-700">TOTAL:</td>
                  <td className="px-2 py-2 text-xs text-red-600 dark:text-red-400 border-r border-slate-200 dark:border-slate-700 font-mono">
                    {activeCurrency === 'MYR' 
                      ? formatCurrency(totalMyrAmount)
                      : `${totalBdtAmount.toLocaleString()} BDT`
                    }
                  </td>
                  {activeCurrency === 'BDT' && (
                    <>
                      <td className="px-2 py-2 text-xs text-slate-500 dark:text-slate-400 text-center border-r border-slate-200 dark:border-slate-700 font-mono">
                        {totalBdtConvertedRm > 0 ? (totalBdtAmount / totalBdtConvertedRm).toFixed(2) : '-'}
                      </td>
                      <td className="px-2 py-2 text-xs text-indigo-600 dark:text-indigo-400 font-bold border-r border-slate-200 dark:border-slate-700 font-mono">
                        {formatCurrency(totalBdtConvertedRm)}
                      </td>
                    </>
                  )}
                  <td className="px-2 py-2 border-r border-slate-200 dark:border-slate-700 text-[10px] text-slate-400 font-normal">
                    {activeCurrency === 'BDT' ? 'Converted to RM at transaction date rate' : ''}
                  </td>
                  <td className="px-2 py-2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-between items-center pt-2">
          <div className="text-xs text-slate-500">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, expenses.length)} of {expenses.length} entries
          </div>
          <div className="flex gap-1">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 px-2 text-xs"
            >
              Previous
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  className="h-8 w-8 p-0 text-xs"
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8 px-2 text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-50 overflow-y-auto">
          <div className="max-w-xl mx-auto p-4 md:p-6 min-h-screen flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{editingExpense ? 'Edit Expense' : 'Add New Expense'}</h2>
              <button onClick={() => { setShowAdd(false); setEditingExpense(null); }} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"><Plus className="rotate-45 w-6 h-6 text-slate-600 dark:text-slate-400" /></button>
            </div>
            <Card className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input name="date" label="Date" type="date" defaultValue={editingExpense?.date || new Date().toISOString().split('T')[0]} required />
                <Select label="Category" defaultValue={editingExpense?.category || (activeCurrency === 'BDT' ? 'Banking Transaction Charge' : 'Rent')} options={[
                  {value: 'Banking Transaction Charge', label: 'Banking Transaction Charge'},
                  {value: 'Bank Charge', label: 'Bank Charge'},
                  {value: 'Rent', label: 'Rent'},
                  {value: 'Transportation', label: 'Transportation'},
                  {value: 'Incentives', label: 'Incentives'},
                  {value: 'Bad Debt', label: 'Bad Debt'},
                  {value: 'Other', label: 'Other'}
                ]} name="category" required />
                <Input name="amount_myr" label={`Amount (${activeCurrency})`} type="number" step="0.01" defaultValue={editingExpense?.amount_myr} required />
                <Input name="note" label="Note" placeholder="Optional description" defaultValue={editingExpense?.note} />
                <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <Button variant="outline" className="flex-1" onClick={() => { setShowAdd(false); setEditingExpense(null); }} type="button">Cancel</Button>
                  <Button type="submit" className="flex-1">{editingExpense ? 'Update Expense' : 'Save Expense'}</Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Expense"
        message="Are you sure you want to delete this expense? This action cannot be undone."
      />
    </div>
  );
}

// --- Loan Component ---

function LoanPage() {
  const { fontSize, fontStyle } = useAppStore();
  const [loans, setLoans] = useState<LoanEntity[]>([]);
  const [transactions, setTransactions] = useState<LoanTransaction[]>([]);
  const [activeLoan, setActiveLoan] = useState<LoanEntity | null>(null);

  // General States
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [loanName, setLoanName] = useState('');
  const [editingLoan, setEditingLoan] = useState<LoanEntity | null>(null);
  const [editingLoanName, setEditingLoanName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Loan Ledger Sorting and Filter States (Default: last added on below)
  const [ledgerSortField, setLedgerSortField] = useState<'added_date' | 'date' | 'description' | 'modify_date' | 'drAmount' | 'crAmount' | 'balance'>('added_date');
  const [ledgerSortDirection, setLedgerSortDirection] = useState<'asc' | 'desc'>('asc');
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState('');

  // Ledger states
  const [isExport, setIsExport] = useState(false);
  const [showAddTx, setShowAddTx] = useState(false);
  const [editingTx, setEditingTx] = useState<LoanTransaction | null>(null);
  const [addTxData, setAddTxData] = useState({ date: new Date().toISOString().split('T')[0], description: '', drAmount: '', crAmount: '' });

  // Sync to Firestore with LocalStorage migration helper
  useEffect(() => {
    let active = true;

    const runMigrationAndSync = async () => {
      // 1. Check local storage
      const localLoansSaved = localStorage.getItem('demo_loans');
      const localTxsSaved = localStorage.getItem('demo_loan_tx');

      if (localLoansSaved) {
        try {
          const parsedLocalLoans = JSON.parse(localLoansSaved);
          if (Array.isArray(parsedLocalLoans) && parsedLocalLoans.length > 0) {
            // Get existing loans from firestore first to avoid duplicate additions
            const q = query(collection(db, 'loans'));
            const snap = await getDocs(q);
            const existingIds = new Set(snap.docs.map(doc => doc.data().id));
            
            for (const l of parsedLocalLoans) {
              if (l && l.id && !existingIds.has(l.id)) {
                const now = new Date().toISOString();
                await addDoc(collection(db, 'loans'), {
                  id: l.id,
                  name: l.name || '',
                  created_at: l.created_at || now,
                  updated_at: l.updated_at || now,
                  added_date: l.added_date || now.split('T')[0],
                  modify_date: l.modify_date || now.split('T')[0]
                });
              }
            }
          }
          localStorage.removeItem('demo_loans');
        } catch (e) {
          console.error("Migration error for loans:", e);
        }
      }

      if (localTxsSaved) {
        try {
          const parsedLocalTxs = JSON.parse(localTxsSaved);
          if (Array.isArray(parsedLocalTxs) && parsedLocalTxs.length > 0) {
            // Get existing tx from firestore to avoid duplicates
            const q = query(collection(db, 'loan_transactions'));
            const snap = await getDocs(q);
            const existingIds = new Set(snap.docs.map(doc => doc.data().id));

            for (const t of parsedLocalTxs) {
              if (t && t.id && !existingIds.has(t.id)) {
                await addDoc(collection(db, 'loan_transactions'), {
                  id: t.id,
                  loanId: Number(t.loanId),
                  date: t.date || '',
                  description: t.description || '',
                  drAmount: t.drAmount || '',
                  crAmount: t.crAmount || ''
                });
              }
            }
          }
          localStorage.removeItem('demo_loan_tx');
        } catch (e) {
          console.error("Migration error for transactions:", e);
        }
      }
    };

    runMigrationAndSync();

    const unsubLoans = onSnapshot(collection(db, 'loans'), (snapshot) => {
      const fbLoans = snapshot.docs.map(doc => ({ ...doc.data(), firebase_id: doc.id })) as LoanEntity[];
      if (active) {
        setLoans(fbLoans);
      }
    });

    const unsubTx = onSnapshot(collection(db, 'loan_transactions'), (snapshot) => {
      const fbTx = snapshot.docs.map(doc => ({ ...doc.data(), firebase_id: doc.id })) as LoanTransaction[];
      if (active) {
        setTransactions(fbTx);
      }
    });

    return () => {
      active = false;
      unsubLoans();
      unsubTx();
    };
  }, []);

  const getAddedTime = (l: LoanEntity): number => {
    if (l.created_at) {
      const t = new Date(l.created_at).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    if (l.added_date) {
      const t = new Date(l.added_date).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    if (l.id && Number(l.id) > 1000000000) {
      return Number(l.id);
    }
    return Number(l.id) || 0;
  };

  const getModifyTime = (l: LoanEntity): number => {
    if (l.updated_at) {
      const t = new Date(l.updated_at).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    if (l.modify_date) {
      const t = new Date(l.modify_date).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    const loanTxs = transactions.filter(t => Number(t.loanId) === Number(l.id));
    if (loanTxs.length > 0) {
      const maxTxTime = Math.max(...loanTxs.map(t => {
        if (t.date) {
          const dt = new Date(t.date).getTime();
          if (!isNaN(dt) && dt > 0) return dt;
        }
        if (t.id && Number(t.id) > 1000000000) return Number(t.id);
        return 0;
      }));
      if (maxTxTime > 0) return maxTxTime;
    }
    return getAddedTime(l);
  };

  const getLoanBalance = (loanId: number): number => {
    const loanTxs = transactions.filter(t => Number(t.loanId) === Number(loanId));
    return loanTxs.reduce((sum, t) => sum + (parseFloat(t.drAmount) || 0) - (parseFloat(t.crAmount) || 0), 0);
  };

  const formatDisplayDate = (dateVal?: string | number): string => {
    if (!dateVal) return '-';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return String(dateVal);
    }
  };

  const totalCurrentBalance = loans.reduce((sum, loan) => {
    return sum + getLoanBalance(loan.id);
  }, 0);

  // Loans list (Ordered by last added on top)
  const displayLoans = [...loans]
    .filter(loan => {
      if (!searchTerm.trim()) return true;
      return (loan.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => {
      const timeA = getAddedTime(a);
      const timeB = getAddedTime(b);
      return timeB - timeA; // Last added on top
    });

  const updateLoanModifyTimestamp = async (loanId: number) => {
    try {
      const q = query(collection(db, 'loans'), where('id', '==', loanId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const now = new Date().toISOString();
        await updateDoc(doc(db, 'loans', snap.docs[0].id), {
          updated_at: now,
          modify_date: now.split('T')[0]
        });
      }
    } catch (err) {
      console.error("Error updating loan modify time:", err);
    }
  };

  const handleAddLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanName.trim()) return;
    try {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'loans'), { 
        id: Date.now(), 
        name: loanName.trim(),
        created_at: now,
        updated_at: now,
        added_date: now.split('T')[0],
        modify_date: now.split('T')[0]
      });
    } catch (err) {
      console.error("Error adding loan:", err);
    }
    setLoanName('');
    setShowAddLoan(false);
  };

  const handleUpdateLoanName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLoan || !editingLoanName.trim()) return;
    try {
      const q = query(collection(db, 'loans'), where('id', '==', editingLoan.id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const now = new Date().toISOString();
        await updateDoc(doc(db, 'loans', snap.docs[0].id), {
          name: editingLoanName.trim(),
          updated_at: now,
          modify_date: now.split('T')[0]
        });
      }
    } catch (err) {
      console.error("Error updating loan:", err);
    }
    setEditingLoan(null);
    setEditingLoanName('');
  };
  
  const handleDeleteLoan = async (id: number) => {
    if (confirm('Are you sure you want to delete this loan and all its transactions?')) {
      try {
        const q = query(collection(db, 'loans'), where('id', '==', id));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await deleteDoc(doc(db, 'loans', snap.docs[0].id));
        }

        const tq = query(collection(db, 'loan_transactions'), where('loanId', '==', id));
        const tSnap = await getDocs(tq);
        tSnap.forEach(async (d) => {
          await deleteDoc(doc(db, 'loan_transactions', d.id));
        });
      } catch (err) {
        console.error("Error deleting loan:", err);
      }
    }
  };

  const getTxAddedTime = (t: LoanTransaction): number => {
    if (t.created_at) {
      const time = new Date(t.created_at).getTime();
      if (!isNaN(time) && time > 0) return time;
    }
    if (t.added_date) {
      const time = new Date(t.added_date).getTime();
      if (!isNaN(time) && time > 0) return time;
    }
    if (t.id && Number(t.id) > 1000000000) {
      return Number(t.id);
    }
    if (t.date) {
      const time = new Date(t.date).getTime();
      if (!isNaN(time) && time > 0) return time;
    }
    return Number(t.id) || 0;
  };

  const getTxModifyTime = (t: LoanTransaction): number => {
    if (t.updated_at) {
      const time = new Date(t.updated_at).getTime();
      if (!isNaN(time) && time > 0) return time;
    }
    if (t.modify_date) {
      const time = new Date(t.modify_date).getTime();
      if (!isNaN(time) && time > 0) return time;
    }
    return getTxAddedTime(t);
  };

  const handleLedgerSort = (field: 'added_date' | 'date' | 'description' | 'modify_date' | 'drAmount' | 'crAmount' | 'balance') => {
    if (ledgerSortField === field) {
      setLedgerSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setLedgerSortField(field);
      setLedgerSortDirection(field === 'added_date' ? 'asc' : field === 'description' ? 'asc' : 'desc');
    }
  };

  const handleAddTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLoan) return;
    try {
      const now = new Date().toISOString();
      const today = now.split('T')[0];
      if (editingTx) {
        const q = query(collection(db, 'loan_transactions'), where('id', '==', editingTx.id));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await updateDoc(doc(db, 'loan_transactions', snap.docs[0].id), {
            date: addTxData.date,
            description: addTxData.description,
            drAmount: addTxData.drAmount,
            crAmount: addTxData.crAmount,
            updated_at: now,
            modify_date: today
          });
        }
      } else {
        await addDoc(collection(db, 'loan_transactions'), {
          id: Date.now(),
          loanId: activeLoan.id,
          date: addTxData.date,
          description: addTxData.description,
          drAmount: addTxData.drAmount,
          crAmount: addTxData.crAmount,
          created_at: now,
          updated_at: now,
          added_date: today,
          modify_date: today
        });
      }
      await updateLoanModifyTimestamp(activeLoan.id);
    } catch (err) {
      console.error("Error saving transaction:", err);
    }
    setShowAddTx(false);
    setEditingTx(null);
    setAddTxData({ date: new Date().toISOString().split('T')[0], description: '', drAmount: '', crAmount: '' });
  };
  
  const handleEditTx = (t: LoanTransaction) => {
    setEditingTx(t);
    setAddTxData({
      date: t.date,
      description: t.description,
      drAmount: t.drAmount,
      crAmount: t.crAmount
    });
    setShowAddTx(true);
  };
  
  const handleDeleteTx = async (id: number) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      try {
        const q = query(collection(db, 'loan_transactions'), where('id', '==', id));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await deleteDoc(doc(db, 'loan_transactions', snap.docs[0].id));
        }
        if (activeLoan) {
          await updateLoanModifyTimestamp(activeLoan.id);
        }
      } catch (err) {
        console.error("Error deleting transaction:", err);
      }
    }
  };

  const exportToPDF = () => {
    if (!activeLoan) return;
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text(`Loan Ledger: ${activeLoan.name}`, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
    
    // Sort transactions chronologically for accurate balance calculation
    const rawLoanTxs = transactions.filter(t => Number(t.loanId) === Number(activeLoan.id));
    const chronologicalTxs = [...rawLoanTxs].sort((a, b) => {
      const dateComp = (a.date || '').localeCompare(b.date || '');
      if (dateComp !== 0) return dateComp;
      return Number(a.id) - Number(b.id);
    });

    let running = 0;
    const txsWithBalance = chronologicalTxs.map(t => {
      const dr = parseFloat(t.drAmount) || 0;
      const cr = parseFloat(t.crAmount) || 0;
      running += (dr - cr);
      return { ...t, runningBalance: running };
    });

    const sortedForExport = [...txsWithBalance].sort((a, b) => {
      if (ledgerSortField === 'description') {
        const comp = (a.description || '').localeCompare(b.description || '', undefined, { sensitivity: 'base' });
        return ledgerSortDirection === 'asc' ? comp : -comp;
      } else if (ledgerSortField === 'date') {
        const comp = (a.date || '').localeCompare(b.date || '');
        if (comp !== 0) return ledgerSortDirection === 'asc' ? comp : -comp;
        return ledgerSortDirection === 'asc' ? Number(a.id) - Number(b.id) : Number(b.id) - Number(a.id);
      } else if (ledgerSortField === 'modify_date') {
        const timeA = getTxModifyTime(a);
        const timeB = getTxModifyTime(b);
        return ledgerSortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      } else if (ledgerSortField === 'drAmount') {
        const valA = parseFloat(a.drAmount) || 0;
        const valB = parseFloat(b.drAmount) || 0;
        return ledgerSortDirection === 'asc' ? valA - valB : valB - valA;
      } else if (ledgerSortField === 'crAmount') {
        const valA = parseFloat(a.crAmount) || 0;
        const valB = parseFloat(b.crAmount) || 0;
        return ledgerSortDirection === 'asc' ? valA - valB : valB - valA;
      } else if (ledgerSortField === 'balance') {
        return ledgerSortDirection === 'asc' ? a.runningBalance - b.runningBalance : b.runningBalance - a.runningBalance;
      } else {
        const timeA = getTxAddedTime(a);
        const timeB = getTxAddedTime(b);
        return ledgerSortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      }
    });

    const tableData = sortedForExport.map(t => [
      t.date,
      t.description || '-',
      t.drAmount || '-',
      t.crAmount || '-',
      t.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Date', 'Description', 'Cr Amount', 'Dr Amount', 'Balance']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] }
    });

    doc.save(`loan_ledger_${activeLoan.name}.pdf`);
  };

  const exportToExcel = () => {
    if (!activeLoan) return;
    const rawLoanTxs = transactions.filter(t => Number(t.loanId) === Number(activeLoan.id));
    const chronologicalTxs = [...rawLoanTxs].sort((a, b) => {
      const dateComp = (a.date || '').localeCompare(b.date || '');
      if (dateComp !== 0) return dateComp;
      return Number(a.id) - Number(b.id);
    });

    let running = 0;
    const txsWithBalance = chronologicalTxs.map(t => {
      const dr = parseFloat(t.drAmount) || 0;
      const cr = parseFloat(t.crAmount) || 0;
      running += (dr - cr);
      return { ...t, runningBalance: running };
    });

    const sortedForExport = [...txsWithBalance].sort((a, b) => {
      if (ledgerSortField === 'description') {
        const comp = (a.description || '').localeCompare(b.description || '', undefined, { sensitivity: 'base' });
        return ledgerSortDirection === 'asc' ? comp : -comp;
      } else if (ledgerSortField === 'date') {
        const comp = (a.date || '').localeCompare(b.date || '');
        if (comp !== 0) return ledgerSortDirection === 'asc' ? comp : -comp;
        return ledgerSortDirection === 'asc' ? Number(a.id) - Number(b.id) : Number(b.id) - Number(a.id);
      } else if (ledgerSortField === 'modify_date') {
        const timeA = getTxModifyTime(a);
        const timeB = getTxModifyTime(b);
        return ledgerSortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      } else if (ledgerSortField === 'drAmount') {
        const valA = parseFloat(a.drAmount) || 0;
        const valB = parseFloat(b.drAmount) || 0;
        return ledgerSortDirection === 'asc' ? valA - valB : valB - valA;
      } else if (ledgerSortField === 'crAmount') {
        const valA = parseFloat(a.crAmount) || 0;
        const valB = parseFloat(b.crAmount) || 0;
        return ledgerSortDirection === 'asc' ? valA - valB : valB - valA;
      } else if (ledgerSortField === 'balance') {
        return ledgerSortDirection === 'asc' ? a.runningBalance - b.runningBalance : b.runningBalance - a.runningBalance;
      } else {
        const timeA = getTxAddedTime(a);
        const timeB = getTxAddedTime(b);
        return ledgerSortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      }
    });

    const tableData = sortedForExport.map(t => ({
      'Date': t.date,
      'Description': t.description,
      'Cr Amount': t.drAmount,
      'Dr Amount': t.crAmount,
      'Balance': t.runningBalance.toFixed(2)
    }));

    const ws = XLSX.utils.json_to_sheet(tableData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Loan Ledger');
    XLSX.writeFile(wb, `loan_ledger_${activeLoan.name}.xlsx`);
  };

  const exportToJPG = async () => {
    setIsExport(true);
    await new Promise(r => setTimeout(r, 100));

    const element = document.getElementById('loan-ledger-content');
    if (element) {
      try {
        const width = element.scrollWidth;
        const height = element.scrollHeight;
        const dataUrl = await toJpeg(element, {
          backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
          pixelRatio: 2,
          width,
          height,
          skipFonts: true,
          fontEmbedCSS: '',
          style: { overflow: 'visible', height: height + 'px', width: width + 'px' }
        });
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `loan_ledger_${activeLoan?.name}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error('Export failed:', error);
      } finally {
        setIsExport(false);
      }
    } else {
      setIsExport(false);
    }
  };

  if (activeLoan) {
    const rawLoanTxs = transactions.filter(t => Number(t.loanId) === Number(activeLoan.id));
    
    // Overall ledger totals
    const totalCr = rawLoanTxs.reduce((sum, t) => sum + (parseFloat(t.drAmount) || 0), 0);
    const totalDr = rawLoanTxs.reduce((sum, t) => sum + (parseFloat(t.crAmount) || 0), 0);
    const netBalance = totalCr - totalDr;

    // 1. Calculate running balance chronologically (by date ascending, then id ascending)
    const chronologicalTxs = [...rawLoanTxs].sort((a, b) => {
      const dateComp = (a.date || '').localeCompare(b.date || '');
      if (dateComp !== 0) return dateComp;
      return Number(a.id) - Number(b.id);
    });

    let running = 0;
    const txsWithBalance = chronologicalTxs.map(t => {
      const dr = parseFloat(t.drAmount) || 0;
      const cr = parseFloat(t.crAmount) || 0;
      running += (dr - cr);
      return {
        ...t,
        runningBalance: running
      };
    });

    // 2. Filter by search term
    const filteredLedgerTxs = txsWithBalance.filter(t => {
      if (!ledgerSearchTerm.trim()) return true;
      const term = ledgerSearchTerm.toLowerCase();
      return (
        (t.description || '').toLowerCase().includes(term) ||
        (t.date || '').toLowerCase().includes(term) ||
        (t.drAmount || '').toLowerCase().includes(term) ||
        (t.crAmount || '').toLowerCase().includes(term)
      );
    });

    // 3. Sort by user selection (Default: Last added in top -> ledgerSortField = 'added_date', ledgerSortDirection = 'desc')
    const sortedLedgerTxs = [...filteredLedgerTxs].sort((a, b) => {
      if (ledgerSortField === 'description') {
        const comp = (a.description || '').localeCompare(b.description || '', undefined, { sensitivity: 'base' });
        return ledgerSortDirection === 'asc' ? comp : -comp;
      } else if (ledgerSortField === 'date') {
        const comp = (a.date || '').localeCompare(b.date || '');
        if (comp !== 0) return ledgerSortDirection === 'asc' ? comp : -comp;
        return ledgerSortDirection === 'asc' ? Number(a.id) - Number(b.id) : Number(b.id) - Number(a.id);
      } else if (ledgerSortField === 'modify_date') {
        const timeA = getTxModifyTime(a);
        const timeB = getTxModifyTime(b);
        return ledgerSortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      } else if (ledgerSortField === 'drAmount') {
        const valA = parseFloat(a.drAmount) || 0;
        const valB = parseFloat(b.drAmount) || 0;
        return ledgerSortDirection === 'asc' ? valA - valB : valB - valA;
      } else if (ledgerSortField === 'crAmount') {
        const valA = parseFloat(a.crAmount) || 0;
        const valB = parseFloat(b.crAmount) || 0;
        return ledgerSortDirection === 'asc' ? valA - valB : valB - valA;
      } else if (ledgerSortField === 'balance') {
        return ledgerSortDirection === 'asc' ? a.runningBalance - b.runningBalance : b.runningBalance - a.runningBalance;
      } else {
        // 'added_date' / Last added (Default)
        const timeA = getTxAddedTime(a);
        const timeB = getTxAddedTime(b);
        return ledgerSortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      }
    });
    
    return (
      <div className={cn("space-y-4", fontStyle, fontSize)}>
        {/* Ledger Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setActiveLoan(null)} 
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-600 dark:text-slate-300"
              title="Back to Loans list"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Loan Ledger: {activeLoan.name}
                <span className="text-xs px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-full font-normal">
                  {rawLoanTxs.length} {rawLoanTxs.length === 1 ? 'transaction' : 'transactions'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Detailed transaction statement and chronological ledger tracking.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setShowAddTx(true)} className="text-xs py-1.5 h-9 gap-1.5">
              <Plus size={15}/> Add Row
            </Button>
            <Button variant="outline" className="text-xs py-1.5 h-9 gap-1.5" onClick={exportToPDF}>
              <FileText size={15}/> Export PDF
            </Button>
            <Button variant="outline" className="text-xs py-1.5 h-9 gap-1.5" onClick={exportToExcel}>
              <FileText size={15}/> Export Excel
            </Button>
            <Button variant="outline" className="text-xs py-1.5 h-9 gap-1.5" onClick={exportToJPG}>
              <FileText size={15}/> Export JPG
            </Button>
          </div>
        </div>

        {/* Ledger Quick Summary Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500">Total Cr Amount</p>
            <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
              {totalCr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500">Total Dr Amount</p>
            <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
              {totalDr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500">Net Current Balance</p>
            <p className={cn("text-base font-bold mt-0.5", netBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
              {netBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500">Transactions</p>
            <p className="text-base font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
              {rawLoanTxs.length}
            </p>
          </div>
        </div>

        {/* Sorting & Search Toolbar directly inside the Ledger */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search ledger by description, date, amount..."
              value={ledgerSearchTerm}
              onChange={(e) => setLedgerSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white dark:text-white transition-all"
            />
          </div>

          {/* Quick Sorting Selector & Direction Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <ArrowUpDown size={14} className="text-slate-500 dark:text-slate-400 flex-shrink-0" />
              <span className="font-semibold text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Sort:</span>
              <select
                value={`${ledgerSortField}-${ledgerSortDirection}`}
                onChange={(e) => {
                  const [f, d] = e.target.value.split('-') as [any, any];
                  setLedgerSortField(f);
                  setLedgerSortDirection(d);
                }}
                className="bg-transparent text-xs font-medium text-slate-700 dark:text-slate-200 outline-none cursor-pointer pr-1"
              >
                <option value="added_date-asc" className="dark:bg-slate-900">Last Added on Below (Default)</option>
                <option value="added_date-desc" className="dark:bg-slate-900">Last Added on Top</option>
                <option value="date-desc" className="dark:bg-slate-900">Date (Newest First)</option>
                <option value="date-asc" className="dark:bg-slate-900">Date (Oldest First)</option>
                <option value="description-asc" className="dark:bg-slate-900">Description (A → Z)</option>
                <option value="description-desc" className="dark:bg-slate-900">Description (Z → A)</option>
                <option value="modify_date-desc" className="dark:bg-slate-900">Modify Date (Newest)</option>
                <option value="modify_date-asc" className="dark:bg-slate-900">Modify Date (Oldest)</option>
                <option value="drAmount-desc" className="dark:bg-slate-900">Cr Amount (High → Low)</option>
                <option value="crAmount-desc" className="dark:bg-slate-900">Dr Amount (High → Low)</option>
                <option value="balance-desc" className="dark:bg-slate-900">Balance (High → Low)</option>
                <option value="balance-asc" className="dark:bg-slate-900">Balance (Low → High)</option>
              </select>
            </div>

            {/* Direction toggle */}
            <button
              onClick={() => setLedgerSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))}
              className="p-1.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
              title={`Flip sort direction (currently ${ledgerSortDirection.toUpperCase()})`}
            >
              {ledgerSortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            </button>
          </div>
        </div>

        {/* Ledger Transactions Table */}
        <Card id="loan-ledger-content" className={cn("p-0 overflow-hidden shadow-sm", isExport ? "rounded-none border-0 shadow-none m-0 max-w-4xl" : "")}>
          <div className={cn("flex justify-between items-start border-b border-slate-100 dark:border-slate-800 p-4", !isExport && "hidden")}>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">LOAN LEDGER</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{activeLoan.name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Generated On</p>
              <p className="text-sm font-mono text-slate-900 dark:text-white">{new Date().toLocaleString()}</p>
            </div>
          </div>

          <div className={cn(isExport ? "" : "overflow-x-auto")}>
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 select-none">
                <tr>
                  {/* Date column (Sortable) */}
                  <th 
                    onClick={() => handleLedgerSort('date')}
                    className="px-3.5 py-3 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700 w-36 cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400" />
                        Date
                      </span>
                      <span className="text-slate-400">
                        {ledgerSortField === 'date' ? (
                          ledgerSortDirection === 'asc' ? <ArrowUp size={13} className="text-indigo-600 dark:text-indigo-400" /> : <ArrowDown size={13} className="text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ArrowUpDown size={12} className="opacity-40" />
                        )}
                      </span>
                    </div>
                  </th>

                  {/* Description column (Sortable a2z) */}
                  <th 
                    onClick={() => handleLedgerSort('description')}
                    className="px-3.5 py-3 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1">
                        Description
                        <span className="text-[10px] lowercase text-slate-400 font-normal">(a2z)</span>
                      </span>
                      <span className="text-slate-400">
                        {ledgerSortField === 'description' ? (
                          ledgerSortDirection === 'asc' ? <ArrowUp size={13} className="text-indigo-600 dark:text-indigo-400" /> : <ArrowDown size={13} className="text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ArrowUpDown size={12} className="opacity-40" />
                        )}
                      </span>
                    </div>
                  </th>

                  {/* Cr Amount column (Sortable) */}
                  <th 
                    onClick={() => handleLedgerSort('drAmount')}
                    className="px-3.5 py-3 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700 text-right w-36 cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Cr Amount</span>
                      <span className="text-slate-400">
                        {ledgerSortField === 'drAmount' ? (
                          ledgerSortDirection === 'asc' ? <ArrowUp size={13} className="text-indigo-600 dark:text-indigo-400" /> : <ArrowDown size={13} className="text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ArrowUpDown size={12} className="opacity-40" />
                        )}
                      </span>
                    </div>
                  </th>

                  {/* Dr Amount column (Sortable) */}
                  <th 
                    onClick={() => handleLedgerSort('crAmount')}
                    className="px-3.5 py-3 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700 text-right w-36 cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Dr Amount</span>
                      <span className="text-slate-400">
                        {ledgerSortField === 'crAmount' ? (
                          ledgerSortDirection === 'asc' ? <ArrowUp size={13} className="text-indigo-600 dark:text-indigo-400" /> : <ArrowDown size={13} className="text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ArrowUpDown size={12} className="opacity-40" />
                        )}
                      </span>
                    </div>
                  </th>

                  {/* Balance column (Sortable) */}
                  <th 
                    onClick={() => handleLedgerSort('balance')}
                    className="px-3.5 py-3 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700 text-right w-36 cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Balance</span>
                      <span className="text-slate-400">
                        {ledgerSortField === 'balance' ? (
                          ledgerSortDirection === 'asc' ? <ArrowUp size={13} className="text-indigo-600 dark:text-indigo-400" /> : <ArrowDown size={13} className="text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ArrowUpDown size={12} className="opacity-40" />
                        )}
                      </span>
                    </div>
                  </th>

                  {!isExport && (
                    <th className="px-3 py-3 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider w-20 text-center">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sortedLedgerTxs.map((t, idx) => {
                  return (
                    <tr key={`${t.id}-${idx}`} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-3.5 py-2.5 border-r border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500 whitespace-nowrap">
                        {t.date}
                      </td>
                      <td className="px-3.5 py-2.5 border-r border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white">
                        {t.description || '-'}
                      </td>
                      <td className="px-3.5 py-2.5 border-r border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white text-right">
                        {t.drAmount ? parseFloat(t.drAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="px-3.5 py-2.5 border-r border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white text-right">
                        {t.crAmount ? parseFloat(t.crAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className={cn("px-3.5 py-2.5 border-r border-slate-200 dark:border-slate-700 text-xs font-bold text-right", t.runningBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                        {t.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      {!isExport && (
                        <td className="px-2 py-2 text-center">
                          <div className="flex justify-center items-center gap-1">
                            <button 
                              onClick={() => handleEditTx(t)} 
                              className="p-1.5 text-slate-400 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-600 rounded-md transition-colors"
                              title="Edit transaction"
                            >
                              <Edit size={14} />
                            </button>
                            <button 
                              onClick={() => handleDeleteTx(t.id)} 
                              className="p-1.5 text-slate-400 hover:bg-red-50 dark:hover:bg-slate-800 hover:text-red-600 rounded-md transition-colors"
                              title="Delete transaction"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {sortedLedgerTxs.length === 0 && (
                  <tr>
                    <td colSpan={isExport ? 5 : 6} className="px-4 py-10 text-center text-slate-500 text-xs">
                      {ledgerSearchTerm ? `No transactions matching "${ledgerSearchTerm}".` : 'No transactions found for this loan. Click "+ Add Row" to create the first entry.'}
                    </td>
                  </tr>
                )}
              </tbody>
              {sortedLedgerTxs.length > 0 && (
                <tfoot className="bg-slate-100/90 dark:bg-slate-800/90 font-bold border-t-2 border-slate-300 dark:border-slate-600">
                  <tr>
                    <td className="px-3.5 py-3 text-xs font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">Total</td>
                    <td className="px-3.5 py-3 border-r border-slate-200 dark:border-slate-700"></td>
                    <td className="px-3.5 py-3 text-xs font-bold text-slate-900 dark:text-white text-right border-r border-slate-200 dark:border-slate-700">
                      {totalCr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3.5 py-3 text-xs font-bold text-slate-900 dark:text-white text-right border-r border-slate-200 dark:border-slate-700">
                      {totalDr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={cn("px-3.5 py-3 text-xs font-bold text-right border-r border-slate-200 dark:border-slate-700", netBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                      {netBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    {!isExport && <td></td>}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>

        {showAddTx && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 overflow-y-auto flex items-center justify-center p-4">
            <div className="max-w-md w-full">
              <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{editingTx ? 'Edit Transaction' : 'Add Transaction'}</h2>
                  <button onClick={() => { setShowAddTx(false); setEditingTx(null); }} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-colors">
                    <Plus className="rotate-45 w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleAddTx} className="space-y-4">
                  <Input label="Date" type="date" value={addTxData.date} onChange={(e) => setAddTxData({...addTxData, date: e.target.value})} required />
                  <Input label="Description" value={addTxData.description} onChange={(e) => setAddTxData({...addTxData, description: e.target.value})} placeholder="e.g. Cash received / loan repayment / transfer" />
                  <Input label="Cr Amount" type="number" step="any" value={addTxData.drAmount} onChange={(e) => setAddTxData({...addTxData, drAmount: e.target.value})} placeholder="0.00" />
                  <Input label="Dr Amount" type="number" step="any" value={addTxData.crAmount} onChange={(e) => setAddTxData({...addTxData, crAmount: e.target.value})} placeholder="0.00" />
                  <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                    <Button variant="outline" className="flex-1" onClick={() => { setShowAddTx(false); setEditingTx(null); }} type="button">Cancel</Button>
                    <Button type="submit" className="flex-1">{editingTx ? 'Update Transaction' : 'Save Transaction'}</Button>
                  </div>
                </form>
              </Card>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", fontStyle, fontSize)}>
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Loans
            <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full font-normal">
              {loans.length} {loans.length === 1 ? 'record' : 'records'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Manage individual loans and view detailed ledgers.</p>
        </div>
        <Button onClick={() => setShowAddLoan(true)} className="text-xs py-1.5 h-9 gap-1.5 whitespace-nowrap">
          <Plus size={16}/> Add Loan
        </Button>
      </div>

      {/* Search Toolbar */}
      <div className="flex items-center bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search loan by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white dark:text-white transition-all"
          />
        </div>
      </div>

      {/* Loans Table */}
      <Card className="p-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 select-none">
              <tr>
                <th className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700">
                  Name
                </th>
                <th className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700">
                  Added Date
                </th>
                <th className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700">
                  Modify Date
                </th>
                <th className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700 text-right">
                  Current Balance
                </th>
                <th className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-right w-44">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {displayLoans.map((loan, idx) => {
                const balance = getLoanBalance(loan.id);
                const addedTime = getAddedTime(loan);
                const modifyTime = getModifyTime(loan);
                
                return (
                  <tr key={`${loan.id}-${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors">
                    {/* Name */}
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{loan.name}</span>
                      </div>
                    </td>

                    {/* Added Date */}
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">
                      {formatDisplayDate(loan.created_at || loan.added_date || addedTime)}
                    </td>

                    {/* Modify Date */}
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">
                      {formatDisplayDate(loan.updated_at || loan.modify_date || modifyTime)}
                    </td>

                    {/* Balance */}
                    <td className={cn("px-4 py-3 text-sm font-bold text-right border-r border-slate-200 dark:border-slate-700", balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                      {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end items-center gap-1.5">
                        <button 
                          onClick={() => setActiveLoan(loan)} 
                          className="px-2.5 py-1 flex items-center gap-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm transition-colors"
                          title="View detailed ledger"
                        >
                          <Eye size={13} /> View Ledger
                        </button>
                        <button 
                          onClick={() => {
                            setEditingLoan(loan);
                            setEditingLoanName(loan.name);
                          }} 
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-md transition-colors" 
                          title="Edit Loan Name"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteLoan(loan.id)} 
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-md transition-colors" 
                          title="Delete Loan"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Total Row */}
              {displayLoans.length > 0 && (
                <tr className="bg-slate-100/90 dark:bg-slate-800/90 font-bold border-t-2 border-slate-300 dark:border-slate-600">
                  <td className="px-4 py-3 text-sm font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">Total</td>
                  <td className="px-4 py-3 border-r border-slate-200 dark:border-slate-700 text-xs text-slate-400">
                    {displayLoans.length} {displayLoans.length === 1 ? 'Loan' : 'Loans'}
                  </td>
                  <td className="px-4 py-3 border-r border-slate-200 dark:border-slate-700"></td>
                  <td className={cn("px-4 py-3 text-sm font-bold text-right border-r border-slate-200 dark:border-slate-700", totalCurrentBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                    {totalCurrentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right"></td>
                </tr>
              )}

              {/* Empty state */}
              {displayLoans.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500 text-sm">
                    {searchTerm ? `No loans matching "${searchTerm}".` : 'No loans found. Click "Add Loan" to create one.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Loan Modal */}
      {showAddLoan && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add New Loan</h2>
                <button onClick={() => setShowAddLoan(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-colors">
                  <Plus className="rotate-45 w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAddLoan} className="space-y-4">
                <Input label="Person or Entity Name" value={loanName} onChange={(e) => setLoanName(e.target.value)} required placeholder="e.g. John Doe, BD Office, Investment" autoFocus />
                <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <Button variant="outline" className="flex-1" onClick={() => setShowAddLoan(false)} type="button">Cancel</Button>
                  <Button type="submit" className="flex-1">Save Loan</Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}

      {/* Edit/Rename Loan Modal */}
      {editingLoan && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Loan Name</h2>
                <button onClick={() => setEditingLoan(null)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-colors">
                  <Plus className="rotate-45 w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleUpdateLoanName} className="space-y-4">
                <Input label="Person or Entity Name" value={editingLoanName} onChange={(e) => setEditingLoanName(e.target.value)} required placeholder="e.g. John Doe" autoFocus />
                <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <Button variant="outline" className="flex-1" onClick={() => setEditingLoan(null)} type="button">Cancel</Button>
                  <Button type="submit" className="flex-1">Update Name</Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Calculation Component ---
function CalculationPage() {
  const [isExport, setIsExport] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [addFormData, setAddFormData] = useState({ bdTk: '', rate: '', payment: '', lastDue: '' });
  const [rows, setRows] = useState<CalculationRow[]>([]);

  useEffect(() => {
    let active = true;

    const runMigrationAndSync = async () => {
      const saved = localStorage.getItem('demo_calculation_rows');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const q = query(collection(db, 'calculations'));
            const snap = await getDocs(q);
            const existingIds = new Set(snap.docs.map(doc => doc.data().id));
            
            for (const r of parsed) {
              if (r && r.id && !existingIds.has(r.id)) {
                // Ensure we don't accidentally import completely empty default rows
                if (r.bdTk || r.rate || r.payment || r.lastDue) {
                  await addDoc(collection(db, 'calculations'), {
                    id: r.id,
                    bdTk: r.bdTk || '',
                    rate: r.rate || '',
                    payment: r.payment || '',
                    lastDue: r.lastDue || '',
                    timestamp: r.timestamp || Date.now()
                  });
                }
              }
            }
          }
          localStorage.removeItem('demo_calculation_rows');
        } catch (e) {
          console.error("Migration error for calculations:", e);
        }
      }
    };

    runMigrationAndSync();

    const q = query(collection(db, 'calculations'), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      if (!active) return;
      const data = snapshot.docs.map(doc => ({ ...doc.data(), firebase_id: doc.id })) as CalculationRow[];
      if (data.length === 0) {
        // Provide an initial empty row in state (but don't save to db until edited)
        setRows([{ id: Date.now(), bdTk: '', rate: '', payment: '', lastDue: '' }]);
      } else {
        setRows(data);
      }
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  const submitRow = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRowId) {
        const q = query(collection(db, 'calculations'), where('id', '==', editingRowId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await updateDoc(doc(db, 'calculations', snap.docs[0].id), {
            bdTk: addFormData.bdTk,
            rate: addFormData.rate,
            payment: addFormData.payment,
            lastDue: addFormData.lastDue
          });
        } else if (rows.length === 1 && rows[0].id === editingRowId && !rows[0].firebase_id) {
            // It's the default unsaved row
            await addDoc(collection(db, 'calculations'), {
              id: editingRowId,
              bdTk: addFormData.bdTk,
              rate: addFormData.rate,
              payment: addFormData.payment,
              lastDue: addFormData.lastDue,
              timestamp: Date.now()
            });
        }
      } else {
        await addDoc(collection(db, 'calculations'), {
          id: Date.now(),
          bdTk: addFormData.bdTk,
          rate: addFormData.rate,
          payment: addFormData.payment,
          lastDue: addFormData.lastDue,
          timestamp: Date.now()
        });
      }
    } catch (err) {
      console.error("Error saving calculation row:", err);
    }
    setShowAddModal(false);
    setEditingRowId(null);
    setAddFormData({ bdTk: '', rate: '', payment: '', lastDue: '' });
  };

  const handleEditRowClick = (r: any) => {
    setEditingRowId(r.id);
    setAddFormData({
      bdTk: r.bdTk,
      rate: r.rate,
      payment: r.payment,
      lastDue: r.lastDue
    });
    setShowAddModal(true);
  };

  const updateRow = async (id: number, field: string, value: string) => {
    try {
      const q = query(collection(db, 'calculations'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(doc(db, 'calculations', snap.docs[0].id), {
          [field]: value
        });
      } else if (rows.length === 1 && rows[0].id === id && !rows[0].firebase_id) {
         // Default unsaved row
         await addDoc(collection(db, 'calculations'), {
            id,
            bdTk: '',
            rate: '',
            payment: '',
            lastDue: '',
            [field]: value,
            timestamp: Date.now()
          });
      }
    } catch (err) {
      console.error("Error updating field:", err);
    }
  };
  
  const removeRow = async (id: number) => {
    try {
      const q = query(collection(db, 'calculations'), where('id', '==', id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await deleteDoc(doc(db, 'calculations', snap.docs[0].id));
      }
    } catch (err) {
      console.error("Error deleting row:", err);
    }
  };

  const clearAll = async () => {
    if (confirm("Are you sure you want to clear all calculations?")) {
      try {
        const snap = await getDocs(collection(db, 'calculations'));
        const batch = writeBatch(db);
        snap.docs.forEach(d => {
          batch.delete(d.ref);
        });
        await batch.commit();
      } catch (err) {
        console.error("Error clearing calculations:", err);
      }
    }
  };

  const calculatedRows = rows.map((r, index) => {
    const bdTk = parseFloat(r.bdTk) || 0;
    const rate = parseFloat(r.rate) || 0;
    const payment = parseFloat(r.payment) || 0;
    
    // User enters Last Due manually
    const parsedLastDue = parseFloat(r.lastDue);
    const lastDue = !isNaN(parsedLastDue) && String(r.lastDue).trim() !== '' ? parsedLastDue : 0;
    
    // BD TK / Rate = RM
    const rm = rate > 0 ? (bdTk / rate) : 0;
    
    // RM + Last Due - Payment = Balance
    const balance = rm + lastDue - payment;
    
    return {
      ...r,
      sl: index + 1,
      lastDue: r.lastDue !== undefined && r.lastDue !== null && String(r.lastDue).trim() !== '' ? parsedLastDue : '',
      rm,
      balance
    };
  });

  const totals = calculatedRows.reduce((acc, r) => ({
      bdTk: acc.bdTk + (parseFloat(r.bdTk) || 0),
      payment: acc.payment + (parseFloat(r.payment) || 0),
      lastDue: acc.lastDue + (parseFloat(String(r.lastDue)) || 0),
      rm: acc.rm + r.rm,
      balance: acc.balance + r.balance,
  }), { bdTk: 0, payment: 0, lastDue: 0, rm: 0, balance: 0 });
  
  const lastBalance = calculatedRows.length > 0 ? calculatedRows[calculatedRows.length - 1].balance : 0;

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text(`Juel Money Transfer Apps: Calculation Report`, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
    
    const tableData = calculatedRows.map(r => [
      r.sl,
      r.bdTk && !isNaN(parseFloat(String(r.bdTk))) ? Number(r.bdTk).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-',
      r.rate && !isNaN(parseFloat(String(r.rate))) ? parseFloat(String(r.rate)).toFixed(2) : '-',
      r.rm.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      r.payment && !isNaN(parseFloat(String(r.payment))) ? Number(r.payment).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-',
      r.lastDue !== '' ? Number(r.lastDue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-',
      r.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    ]);

    const totalRow = [
      'Total',
      totals.bdTk.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      '-',
      totals.rm.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      totals.payment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      totals.lastDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      totals.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    ];

    autoTable(doc, {
      startY: 40,
      head: [['SL', 'BD TK', 'Rate', 'RM', 'Payment', 'Last Due', 'Balance']],
      body: tableData,
      foot: [totalRow],
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] },
      footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: 'bold' }
    });

    doc.save('calculation_report.pdf');
  };

  const exportToExcel = () => {
    const tableData = calculatedRows.map(r => ({
      'SL': r.sl,
      'BD TK': r.bdTk && !isNaN(parseFloat(String(r.bdTk))) ? Number(r.bdTk).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
      'Rate': r.rate && !isNaN(parseFloat(String(r.rate))) ? parseFloat(String(r.rate)).toFixed(2) : '',
      'RM': r.rm.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      'Payment': r.payment && !isNaN(parseFloat(String(r.payment))) ? Number(r.payment).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
      'Last Due': r.lastDue !== '' ? Number(r.lastDue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
      'Balance': r.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }));

    const ws = XLSX.utils.json_to_sheet(tableData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Calculations');
    XLSX.writeFile(wb, 'calculation_report.xlsx');
  };

  const exportToJPG = async () => {
    setIsExport(true);
    await new Promise(r => setTimeout(r, 450));

    const element = document.getElementById('calculation-content');
    if (element) {
      try {
        const width = element.scrollWidth;
        const height = element.scrollHeight;
        const dataUrl = await toJpeg(element, {
          backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
          pixelRatio: 2,
          width,
          height,
          skipFonts: true,
          fontEmbedCSS: '',
          style: { overflow: 'visible', height: height + 'px', width: width + 'px' }
        });
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'calculation_report.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error('Export failed:', error);
      } finally {
        setIsExport(false);
      }
    } else {
      setIsExport(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Calculator</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Custom RM and Balance calculations.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="text-xs py-1.5 h-10 gap-2" onClick={exportToPDF}><FileText size={16}/> Export PDF</Button>
          <Button variant="outline" className="text-xs py-1.5 h-10 gap-2" onClick={exportToExcel}><FileText size={16}/> Export Excel</Button>
          <Button variant="outline" className="text-xs py-1.5 h-10 gap-2" onClick={exportToJPG}><FileText size={16}/> Export JPG</Button>
        </div>
      </div>

      <Card id="calculation-content" className={cn("p-6", isExport ? "rounded-none border-0 shadow-none m-0 max-w-4xl" : "")}>
        <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">CALCULATION REPORT</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Juel Money Transfer Apps</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Generated On</p>
            <p className="text-sm font-mono text-slate-900 dark:text-white">{new Date().toLocaleString()}</p>
          </div>
        </div>

        <div className={cn(isExport ? "" : "overflow-x-auto")}>
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-3 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700 w-12 text-center">SL</th>
                <th className="px-3 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700 text-right">BD TK</th>
                <th className="px-3 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700 w-24">Rate</th>
                <th className="px-3 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700 text-right">RM</th>
                <th className="px-3 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700 text-right">Payment</th>
                <th className="px-3 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700 text-right">Last Due</th>
                <th className="px-3 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700 text-right">Balance</th>
                {!isExport && <th className="px-3 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-12 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {calculatedRows.map((r, idx) => (
                <tr key={`${r.id}-${idx}`} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500 text-center">{r.sl}</td>
                  <td className="px-1 py-1 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 relative">
                    <div className="text-xs px-2 py-1 text-slate-900 dark:text-white text-right">
                      {r.bdTk && !isNaN(parseFloat(String(r.bdTk))) ? Number(r.bdTk).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                    </div>
                  </td>
                  <td className="px-1 py-1 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 relative">
                    <div className="text-xs px-2 py-1 text-slate-900 dark:text-white">
                      {r.rate && !isNaN(parseFloat(String(r.rate))) ? parseFloat(String(r.rate)).toFixed(2) : '-'}
                    </div>
                  </td>
                  <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 text-xs font-bold text-indigo-600 dark:text-indigo-400 text-right bg-slate-50/50 dark:bg-slate-800/50">
                    {r.rm.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-1 py-1 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 relative">
                    <div className="text-xs px-2 py-1 text-slate-900 dark:text-white text-right">
                      {r.payment && !isNaN(parseFloat(String(r.payment))) ? Number(r.payment).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                    </div>
                  </td>
                  <td className="px-1 py-1 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 relative">
                    <div className="text-xs px-2 py-1 text-slate-900 dark:text-white text-right font-medium">{r.lastDue !== '' ? Number(r.lastDue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</div>
                  </td>
                  <td className={cn("px-3 py-2 border-r border-slate-200 dark:border-slate-700 text-xs font-bold text-right bg-slate-50/50 dark:bg-slate-800/50", r.balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                    {r.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  {!isExport && (
                    <td className="px-2 py-2 text-center">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => handleEditRowClick(r)} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 rounded-md transition-colors flex justify-center">
                           <Edit size={14} />
                        </button>
                        <button onClick={() => removeRow(r.id)} disabled={rows.length === 1} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-red-600 rounded-md transition-colors disabled:opacity-30 flex justify-center">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="font-bold">
              <tr className="bg-slate-100 dark:bg-slate-800">
                <td className="px-3 py-2 text-xs text-slate-900 dark:text-white text-right bg-slate-100 dark:bg-slate-800 border-t border-b border-r border-slate-200 dark:border-slate-700" colSpan={1}>Total</td>
                <td className="px-3 py-2 text-xs text-slate-900 dark:text-white text-right bg-slate-100 dark:bg-slate-800 border-t border-b border-r border-slate-200 dark:border-slate-700">{totals.bdTk.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-3 py-2 text-xs text-slate-900 dark:text-white text-center bg-slate-100 dark:bg-slate-800 border-t border-b border-r border-slate-200 dark:border-slate-700">-</td>
                <td className="px-3 py-2 text-xs text-slate-900 dark:text-white text-right bg-slate-100 dark:bg-slate-800 border-t border-b border-r border-slate-200 dark:border-slate-700">{totals.rm.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-3 py-2 text-xs text-slate-900 dark:text-white text-right bg-slate-100 dark:bg-slate-800 border-t border-b border-r border-slate-200 dark:border-slate-700">{totals.payment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-3 py-2 text-xs text-slate-900 dark:text-white text-right bg-slate-100 dark:bg-slate-800 border-t border-b border-r border-slate-200 dark:border-slate-700">{totals.lastDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-3 py-2 text-xs text-slate-900 dark:text-white text-right bg-slate-100 dark:bg-slate-800 border-t border-b border-slate-200 dark:border-slate-700">{totals.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                {!isExport && <td className="bg-slate-100 dark:bg-slate-800 border-t border-b border-slate-200 dark:border-slate-700" />}
              </tr>
            </tfoot>
          </table>
        </div>
        {!isExport && (
          <div className="mt-4 flex justify-between items-center">
            <Button onClick={clearAll} variant="outline" className="text-xs py-1.5 h-8 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 dark:border-red-900/30 dark:hover:bg-red-900/20"><Trash2 size={14}/> Clear All</Button>
            <Button onClick={() => setShowAddModal(true)} variant="outline" className="text-xs py-1.5 h-8 gap-1"><Plus size={14}/> Add Row</Button>
          </div>
        )}
      </Card>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-50 overflow-y-auto">
          <div className="max-w-xl mx-auto p-4 md:p-6 min-h-screen flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{editingRowId ? 'Edit Calculation Row' : 'Add Calculation Row'}</h2>
              <button onClick={() => { setShowAddModal(false); setEditingRowId(null); }} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"><Plus className="rotate-45 w-6 h-6 text-slate-600 dark:text-slate-400" /></button>
            </div>
            <Card className="p-6">
              <form onSubmit={submitRow} className="space-y-4">
                <Input label="BD TK" type="number" step="any" value={addFormData.bdTk} onChange={(e) => setAddFormData({...addFormData, bdTk: e.target.value})} placeholder="0.00" />
                <Input label="Rate" type="number" step="any" value={addFormData.rate} onChange={(e) => setAddFormData({...addFormData, rate: e.target.value})} placeholder="0.00" />
                <Input label="Payment" type="number" step="any" value={addFormData.payment} onChange={(e) => setAddFormData({...addFormData, payment: e.target.value})} placeholder="0.00" />
                <Input label="Last Due" type="number" step="any" value={addFormData.lastDue} onChange={(e) => setAddFormData({...addFormData, lastDue: e.target.value})} placeholder="0.00" helpText="Overrides the running balance for this row if provided." />
                <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <Button variant="outline" className="flex-1" onClick={() => { setShowAddModal(false); setEditingRowId(null); }} type="button">Cancel</Button>
                  <Button type="submit" className="flex-1">{editingRowId ? 'Update Row' : 'Add Row'}</Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Reports Component ---
function Reports({ token, stats, initialFilters }: { token: string; stats: any; initialFilters?: any }) {
  const { myAgents, bdAgents, conversions, orders, myPayments, bdPayments, expenses, rateHistory, defaultBankRate, defaultMobileRate } = useAppStore();
  const [reportType, setReportType] = useState('summary');
  const [filterMYAgent, setFilterMYAgent] = useState<string>('');
  const [filterBDAgent, setFilterBDAgent] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const getMonthlyProfitData = () => {
    const { orders, conversions, expenses } = useAppStore.getState();

    // Collect all unique months from orders, conversions, expenses
    const monthsSet = new Set<string>();
    orders.forEach(o => { if (o.date) monthsSet.add(o.date.substring(0, 7)); });
    conversions.forEach(c => { if (c.date) monthsSet.add(c.date.substring(0, 7)); });
    expenses.forEach(e => { if (e.date) monthsSet.add(e.date.substring(0, 7)); });

    // Sorted list of months
    const sortedMonths = Array.from(monthsSet).sort();
    
    const monthlyData = sortedMonths.map(month => {
      // 1. Filter orders for this month (respecting active filters)
      const monthlyOrders = orders.filter(o => o.date && o.date.startsWith(month));
      
      const filterOrdersByAgent = (data: any[]) => data.filter(item => {
        let match = true;
        const requiresMyAgentFilter = (req: any) => {
           if (!req) return false;
           if (typeof req === 'string') return req !== 'all' && req !== '';
           return req.length > 0 && !req.includes('all') && !(req.length === 1 && req[0] === '');
        };
        const matchAgentId = (item_agent: number | undefined, req: any) => {
           if (typeof req === 'string') return item_agent === Number(req);
           return item_agent !== undefined && req.includes(String(item_agent));
        };

        if (requiresMyAgentFilter(filterMYAgent)) {
          if (!matchAgentId(item.my_agent_id, filterMYAgent)) match = false;
        }
        if (requiresMyAgentFilter(filterBDAgent)) {
          if (!matchAgentId(item.bd_agent_id, filterBDAgent)) match = false;
        }
        return match;
      });

      const filteredMonthlyOrders = filterOrdersByAgent(monthlyOrders);

      // Conversions in this month
      const monthlyConversions = conversions.filter(c => c.date && c.date.startsWith(month));
      // Expenses in this month (MYR and BDT converted to RM at daily rates)
      const monthlyExpenses = expenses.filter(e => e.date && e.date.startsWith(month));

      const totalBdtOrder = filteredMonthlyOrders.reduce((sum, o) => sum + Number(o.amount_bdt), 0);
      const totalRmOrder = filteredMonthlyOrders.reduce((sum, o) => sum + Number(o.amount_myr), 0);
      
      const totalGlobalBdtOrder = monthlyOrders.reduce((sum, o) => sum + Number(o.amount_bdt), 0);
      
      const totalBdtConverted = monthlyConversions.reduce((sum, c) => sum + Number(c.total_bd_received || c.amount_bdt), 0);
      const totalRmConverted = monthlyConversions.reduce((sum, c) => sum + Number(c.amount_myr), 0);
      
      const avgConvertRate = totalRmConverted > 0 ? totalBdtConverted / totalRmConverted : 0;
      const totalConvertedRm = avgConvertRate > 0 ? totalBdtOrder / avgConvertRate : 0;
      const grossProfit = totalRmOrder - totalConvertedRm;
      
      const totalGlobalCharges = monthlyConversions.reduce((sum, c) => sum + Number(c.bank_charges), 0);
      
      let totalMonthlyMyrExp = 0;
      let totalMonthlyBdtExpRm = 0;
      monthlyExpenses.forEach(e => {
        if (e.currency === 'BDT') {
          const bdtAmt = Number(e.amount_myr || 0);
          const dayRate = getExchangeRateForDate(e.date, rateHistory, conversions, orders, defaultBankRate, defaultMobileRate);
          totalMonthlyBdtExpRm += dayRate > 0 ? bdtAmt / dayRate : 0;
        } else {
          totalMonthlyMyrExp += Number(e.amount_myr || 0);
        }
      });
      const totalGlobalExp = totalMonthlyMyrExp + totalMonthlyBdtExpRm;
      
      const requiresMyAgentFilter = (req: any) => {
         if (!req) return false;
         if (typeof req === 'string') return req !== 'all' && req !== '';
         return req.length > 0 && !req.includes('all') && !(req.length === 1 && req[0] === '');
      };
      const isAgentSelected = requiresMyAgentFilter(filterMYAgent) || requiresMyAgentFilter(filterBDAgent);
      const proRateFactor = (isAgentSelected && totalGlobalBdtOrder > 0) ? (totalBdtOrder / totalGlobalBdtOrder) : 1;
      
      const totalCharges = totalGlobalCharges * proRateFactor;
      const totalExp = totalGlobalExp * proRateFactor;
      
      const netProfit = grossProfit - totalCharges - totalExp;

      // Format month for display: e.g. "Jul 2026"
      let monthLabel = month;
      try {
        const [year, monthNum] = month.split('-');
        const dateObj = new Date(Number(year), Number(monthNum) - 1, 1);
        monthLabel = dateObj.toLocaleDateString('default', { month: 'short', year: 'numeric' });
      } catch (err) {
        console.error(err);
      }

      return {
        month,
        monthLabel,
        netProfit: Number(netProfit.toFixed(2)),
        grossProfit: Number(grossProfit.toFixed(2)),
        expenses: Number(totalExp.toFixed(2)),
        charges: Number(totalCharges.toFixed(2)),
        volume: Number(totalRmOrder.toFixed(2)),
      };
    });

    // Filter by start and end date filters if active
    return monthlyData.filter(d => {
      if (startDate && d.month < startDate.substring(0, 7)) return false;
      if (endDate && d.month > endDate.substring(0, 7)) return false;
      return true;
    });
  };

  useEffect(() => {
    if (initialFilters) {
      setReportType(initialFilters.type || 'summary');
      setFilterMYAgent(initialFilters.my_agent_id ? String(initialFilters.my_agent_id) : '');
      setFilterBDAgent(initialFilters.bd_agent_id ? String(initialFilters.bd_agent_id) : '');
    } else {
      setReportType('summary');
      setFilterMYAgent('');
      setFilterBDAgent('');
    }
  }, [initialFilters]);

  useEffect(() => {
    setCurrentPage(1);
    handleReload();
  }, [reportType, filterMYAgent, filterBDAgent, startDate, endDate, stats, conversions, orders, myPayments, bdPayments, expenses]);

  const handleReload = async () => {
    setLoading(true);
    setIsReloading(true);
    try {
      const params = {
        type: reportType,
        my_agent_id: filterMYAgent,
        bd_agent_id: filterBDAgent,
        start_date: startDate,
        end_date: endDate
      };
      setReportData(store.getReports(params));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setTimeout(() => setIsReloading(false), 600);
    }
  };

  const exportToPDF = () => {
    if (reportType !== 'monthly_profit' && !reportData) return;
    const doc = new jsPDF();
    
    const formatAgentName = (val: string, agentsList: any[]) => {
      if (val === '' || val === 'all') return 'All';
      const agent = agentsList.find(a => a.id.toString() === val);
      return agent ? agent.name : 'Unknown';
    };
    
    let agentName = "All Agents";
    const isMyAll = filterMYAgent === '' || filterMYAgent === 'all';
    const isBdAll = filterBDAgent === '' || filterBDAgent === 'all';
    
    if (!isMyAll && !isBdAll) {
       agentName = `${formatAgentName(filterMYAgent, myAgents)} / ${formatAgentName(filterBDAgent, bdAgents)}`;
    } else if (!isMyAll) {
       agentName = formatAgentName(filterMYAgent, myAgents);
    } else if (!isBdAll) {
       agentName = formatAgentName(filterBDAgent, bdAgents);
    }

    let titleText = `${reportType.replace('_', ' ').toUpperCase()} REPORT - ${agentName}`;
    if (reportType === 'monthly_profit') {
      titleText = `MONTHLY NET PROFIT REPORT - ${agentName}`;
    }

    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text(titleText, 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Juel Money Transfer Apps (${startDate ? formatDate(startDate) : 'Beginning'} — ${endDate ? formatDate(endDate) : 'Present'})`, 14, 28);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 34);
    
    if (reportType === 'monthly_profit') {
      const chartData = getMonthlyProfitData();
      const bodyData = chartData.map(d => [
        d.monthLabel,
        d.volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        d.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        d.expenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        d.charges.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        d.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      ]);
      const columnTotals = [
        'TOTAL',
        chartData.reduce((sum, d) => sum + d.volume, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        chartData.reduce((sum, d) => sum + d.grossProfit, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        chartData.reduce((sum, d) => sum + d.expenses, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        chartData.reduce((sum, d) => sum + d.charges, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        chartData.reduce((sum, d) => sum + d.netProfit, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      ];
      autoTable(doc, {
        startY: 50,
        head: [['Month', 'Order Volume (RM)', 'Gross Profit (RM)', 'Expenses (RM)', 'Bank Charges (RM)', 'Net Profit (RM)']],
        body: bodyData,
        foot: [columnTotals],
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] },
        footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: 'bold' }
      });
    } else if (reportType === 'summary') {
      if (!reportData.summary) return;
      const { summary } = reportData;
      const data = [
        ['Total Orders', summary.order_count],
        ['Order Volume (RM)', formatCurrency(summary.total_myr_orders)],
        ['Total Conversion (RM)', formatCurrency(summary.total_myr_converted)],
        ['Total Expenses (RM)', formatCurrency(summary.total_expenses)],
        ['Bank Charges (RM)', formatCurrency(summary.total_charges)],
        ['Avg Rate', summary.avg_rate?.toFixed(2)]
      ];
      autoTable(doc, {
        startY: 50,
        head: [['Metric', 'Value']],
        body: data,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] }
      });
    } else {
      if (!reportData.data || !reportData.columns) return;
      const { data, columns } = reportData;
      
      const columnTotals = columns.map((col: string, index: number) => {
        if (index === 0) return 'TOTAL';
        if (reportType === 'ledger' && col === 'Rate') return '';
        if (reportType === 'ledger' && col === 'Balance') {
          if (data.length === 0) return '';
          const lastRow = data[data.length - 1];
          const balance = Object.values(lastRow)[index];
          return typeof balance === 'number' ? balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
        }
        
        let sum = 0;
        let hasNumeric = false;
        data.forEach((row: any) => {
          const val = Object.values(row)[index];
          if (typeof val === 'number') {
            sum += val;
            hasNumeric = true;
          }
        });
        return hasNumeric ? sum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
      });

      const bodyData = data.map((row: any) => Object.values(row).map((val: any) => 
        typeof val === 'number' ? val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : val
      ));

      autoTable(doc, {
        startY: 50,
        head: [columns],
        body: bodyData,
        foot: [columnTotals],
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] },
        footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: 'bold' },
        didParseCell: (data) => {
          if (data.section === 'foot') {
            data.cell.styles.fillColor = [248, 250, 252];
            data.cell.styles.textColor = [15, 23, 42];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });
    }
    
    // Add Report Stamp
    const pageCount = doc.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
       doc.setPage(i);
       doc.setFontSize(8);
       doc.setTextColor(150);
       doc.text(`Generated by Juel Money Transfer Apps on ${new Date().toLocaleString()}`, 14, doc.internal.pageSize.height - 10);
    }
    
    doc.save(`remitflow_${reportType}_report.pdf`);
  };

  const exportToJPG = async () => {
    const element = document.getElementById('report-content-export') || document.getElementById('report-content');
    if (element) {
      try {
        // Ensure the element is visible for capture if it was hidden
        const isHidden = element.parentElement?.classList.contains('hidden');
        if (isHidden) {
          element.parentElement?.classList.remove('hidden');
          element.parentElement?.style.setProperty('position', 'absolute');
          element.parentElement?.style.setProperty('left', '-9999px');
          element.parentElement?.style.setProperty('display', 'block');
        }

        // Get the full dimensions
        const width = element.scrollWidth;
        const height = element.scrollHeight;

        const dataUrl = await toJpeg(element, {
          backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
          pixelRatio: 2,
          width: width,
          height: height,
          skipFonts: true,
          fontEmbedCSS: '',
          style: {
            overflow: 'visible',
            height: height + 'px',
            width: width + 'px'
          }
        });

        // Restore hidden state
        if (isHidden) {
          element.parentElement?.classList.add('hidden');
          element.parentElement?.style.removeProperty('position');
          element.parentElement?.style.removeProperty('left');
          element.parentElement?.style.removeProperty('display');
        }

        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `remitflow_${reportType}_report.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error('Export failed:', error);
        alert('Failed to export JPG. Please try again.');
      }
    }
  };

  const exportToExcel = () => {
    console.log('Exporting to Excel...', reportData);
    if (reportType !== 'monthly_profit' && !reportData) return;
    let ws;
    if (reportType === 'monthly_profit') {
      const chartData = getMonthlyProfitData();
      const exportData = chartData.map(d => ({
        'Month': d.monthLabel,
        'Order Volume (RM)': d.volume,
        'Gross Profit (RM)': d.grossProfit,
        'Expenses (RM)': d.expenses,
        'Bank Charges (RM)': d.charges,
        'Net Profit (RM)': d.netProfit
      }));
      // Add total row
      exportData.push({
        'Month': 'TOTAL',
        'Order Volume (RM)': Number(chartData.reduce((sum, d) => sum + d.volume, 0).toFixed(2)),
        'Gross Profit (RM)': Number(chartData.reduce((sum, d) => sum + d.grossProfit, 0).toFixed(2)),
        'Expenses (RM)': Number(chartData.reduce((sum, d) => sum + d.expenses, 0).toFixed(2)),
        'Bank Charges (RM)': Number(chartData.reduce((sum, d) => sum + d.charges, 0).toFixed(2)),
        'Net Profit (RM)': Number(chartData.reduce((sum, d) => sum + d.netProfit, 0).toFixed(2))
      });
      ws = XLSX.utils.json_to_sheet(exportData);
      
      // Apply styling to the total row in Excel
      if (exportData.length > 0) {
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        const lastRowIndex = range.e.r;
        for (let col = 0; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: lastRowIndex, c: col });
          if (ws[cellAddress]) {
            ws[cellAddress].s = {
              font: { bold: true, color: { rgb: "FFFFFF" } },
              fill: { fgColor: { rgb: "0F172A" }, patternType: "solid" },
              alignment: { vertical: "center", horizontal: "left" }
            };
          }
        }
      }
    } else if (reportType === 'summary') {
      if (!reportData.summary) return;
      const { summary } = reportData;
      const data = [{
        'Total Orders': summary.order_count,
        'Order Volume (RM)': summary.total_myr_orders.toFixed(2),
        'Total Conversion (RM)': summary.total_myr_converted.toFixed(2),
        'Total Expenses (RM)': summary.total_expenses.toFixed(2),
        'Bank Charges (RM)': summary.total_charges.toFixed(2),
        'Banking Transaction Charges (RM)': (summary.profitBreakdown?.bankingTransactionChargesRm || 0).toFixed(2),
        'Gross Profit (RM)': (summary.profitBreakdown?.grossProfit || 0).toFixed(2),
        'Net Profit (RM)': (summary.profitBreakdown?.netProfit || 0).toFixed(2),
        'Avg Rate': summary.avg_rate?.toFixed(2)
      }];
      ws = XLSX.utils.json_to_sheet(data);
    } else {
      if (!reportData.data || !reportData.columns) return;
      const { data, columns } = reportData;
      
      const columnTotals = columns.map((col: string, index: number) => {
        if (index === 0) return 'TOTAL';
        if (reportType === 'ledger' && col === 'Rate') return '';
        if (reportType === 'ledger' && col === 'Balance') {
          if (data.length === 0) return '';
          const lastRow = data[data.length - 1];
          const balance = Object.values(lastRow)[index];
          return typeof balance === 'number' ? balance.toFixed(2) : '';
        }

        let sum = 0;
        let hasNumeric = false;
        data.forEach((row: any) => {
          const val = Object.values(row)[index];
          if (typeof val === 'number') {
            sum += val;
            hasNumeric = true;
          }
        });
        return hasNumeric ? sum.toFixed(2) : '';
      });

      const exportData = data.map((row: any) => {
        const newRow: any = {};
        Object.keys(row).forEach((key, i) => {
          const val = Object.values(row)[i];
          newRow[columns[i]] = typeof val === 'number' ? val.toFixed(2) : val;
        });
        return newRow;
      });

      if (data.length > 0) {
        const totalRow: any = {};
        columns.forEach((col: string, i: number) => {
          totalRow[col] = columnTotals[i];
        });
        exportData.push(totalRow);
      }

      ws = XLSX.utils.json_to_sheet(exportData);

      // Apply styling to the total row in Excel
      if (data.length > 0) {
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        const lastRowIndex = range.e.r;
        for (let col = 0; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: lastRowIndex, c: col });
          if (ws[cellAddress]) {
            ws[cellAddress].s = {
              font: { bold: true, color: { rgb: "FFFFFF" } },
              fill: { fgColor: { rgb: "0F172A" }, patternType: "solid" },
              alignment: { vertical: "center", horizontal: "left" }
            };
          }
        }
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    
    // Use robust download method for better compatibility
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `remitflow_${reportType}_report.xlsx`);
    console.log('Download triggered');
  };

  const renderMonthlyProfitChart = () => {
    const chartData = getMonthlyProfitData();

    if (chartData.length === 0) {
      return (
        <Card className="p-8 text-center text-slate-500 text-xs italic bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          No monthly financial data found for the selected filters.
        </Card>
      );
    }

    const totalVolume = chartData.reduce((sum, d) => sum + d.volume, 0);
    const totalGrossProfit = chartData.reduce((sum, d) => sum + d.grossProfit, 0);
    const totalExpenses = chartData.reduce((sum, d) => sum + d.expenses, 0);
    const totalCharges = chartData.reduce((sum, d) => sum + d.charges, 0);
    const totalNetProfit = chartData.reduce((sum, d) => sum + d.netProfit, 0);

    return (
      <div id="report-content" className="space-y-6 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              MONTHLY NET PROFIT CHART
            </h1>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mt-1">
              Visualizing Monthly Net Profit &amp; Business Volume
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Net Profit</p>
            <p className={cn("text-lg font-bold font-mono", totalNetProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
              {formatCurrency(totalNetProfit)}
            </p>
          </div>
        </div>

        {/* Dynamic Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-none shadow-none">
            <h4 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Order Volume</h4>
            <p className="text-base font-bold text-slate-900 dark:text-white font-mono">{formatCurrency(totalVolume)}</p>
          </Card>
          <Card className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-none shadow-none">
            <h4 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Gross Profit</h4>
            <p className="text-base font-bold text-slate-900 dark:text-white font-mono">{formatCurrency(totalGrossProfit)}</p>
          </Card>
          <Card className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-none shadow-none">
            <h4 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Expenses &amp; Charges</h4>
            <p className="text-base font-bold text-slate-900 dark:text-white font-mono">{formatCurrency(totalExpenses + totalCharges)}</p>
          </Card>
          <Card className={cn("p-4 border-none shadow-none", totalNetProfit >= 0 ? "bg-emerald-50/30 dark:bg-emerald-950/10" : "bg-red-50/30 dark:bg-red-950/10")}>
            <h4 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Cumulative Net Profit</h4>
            <p className={cn("text-base font-bold font-mono", totalNetProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>{formatCurrency(totalNetProfit)}</p>
          </Card>
        </div>

        {/* The Recharts Bar Chart Card */}
        <Card className="p-4 bg-slate-50/20 dark:bg-slate-800/10">
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                <XAxis 
                  dataKey="monthLabel" 
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis 
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickFormatter={(value) => `${value.toLocaleString()}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    borderColor: '#1e293b',
                    borderRadius: '0.5rem',
                    color: '#f8fafc'
                  }}
                  formatter={(value: any) => [`RM ${value.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 'Net Profit']}
                />
                <Legend verticalAlign="top" height={36}/>
                <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} />
                <Bar dataKey="netProfit" name="Net Profit (RM)" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry: any, index: number) => {
                    const isPositive = entry.netProfit >= 0;
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={isPositive ? '#10b981' : '#ef4444'} 
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Detailed Breakdown List */}
        <div className="mt-4">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Monthly Breakdown Data</h3>
          <Card className="overflow-hidden border border-slate-100 dark:border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Month</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Order Volume</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Gross Profit</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Expenses</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Bank Charges</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Net Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {chartData.map((d, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2.5 text-xs font-semibold text-slate-900 dark:text-white">{d.monthLabel}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300 text-right font-mono">{formatCurrency(d.volume)}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300 text-right font-mono">{formatCurrency(d.grossProfit)}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300 text-right font-mono text-red-600 dark:text-red-400">{formatCurrency(d.expenses)}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300 text-right font-mono text-red-600 dark:text-red-400">{formatCurrency(d.charges)}</td>
                      <td className={cn("px-4 py-2.5 text-xs text-right font-mono font-bold", d.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                        {formatCurrency(d.netProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 font-bold">
                  <tr>
                    <td className="px-4 py-3 text-xs text-slate-900 dark:text-white uppercase">Total</td>
                    <td className="px-4 py-3 text-xs text-slate-900 dark:text-white text-right font-mono">{formatCurrency(totalVolume)}</td>
                    <td className="px-4 py-3 text-xs text-slate-900 dark:text-white text-right font-mono">{formatCurrency(totalGrossProfit)}</td>
                    <td className="px-4 py-3 text-xs text-red-600 dark:text-red-400 text-right font-mono">{formatCurrency(totalExpenses)}</td>
                    <td className="px-4 py-3 text-xs text-red-600 dark:text-red-400 text-right font-mono">{formatCurrency(totalCharges)}</td>
                    <td className={cn("px-4 py-3 text-xs text-right font-mono font-bold", totalNetProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                      {formatCurrency(totalNetProfit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>
      </div>
    );
  };

  const renderSummary = () => {
    if (!reportData || !reportData.summary) return null;
    const { summary } = reportData;
    const breakdown = summary.profitBreakdown;
    const grossProfit = breakdown?.grossProfit || 0;
    const netProfit = breakdown?.netProfit || 0;
    const bankingChargesRm = breakdown?.bankingTransactionChargesRm ?? breakdown?.bdtChargesRm ?? 0;
    const generalExpensesRm = breakdown?.generalExpensesRm ?? (Number(breakdown?.expenses || 0) - bankingChargesRm);

    return (
      <div id="report-content" className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl">
        <Card className="p-4 flex flex-col justify-between border-emerald-100 bg-emerald-50/30 dark:bg-emerald-900/10 dark:border-emerald-900/30">
          <div className="flex items-center justify-between mb-2">
            <div className="p-1.5 bg-white dark:bg-slate-800 rounded-md"><Wallet className="text-indigo-600 dark:text-indigo-400" size={18} /></div>
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded-full">Profit</span>
          </div>
          <h3 className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">Net Profit Breakdown</h3>
          <div className="mt-2 space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Total BDT Order:</span>
              <span className="font-mono text-slate-900 dark:text-white">{(breakdown?.totalBdtOrder || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Total RM Order:</span>
              <span className="font-mono text-slate-900 dark:text-white">{formatCurrency(breakdown?.totalRmOrder || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Ave. RM Convert Rate:</span>
              <span className="font-mono text-slate-900 dark:text-white">{breakdown?.avgConvertRate?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Total Converted RM:</span>
              <span className="font-mono text-slate-900 dark:text-white">{formatCurrency(breakdown?.totalConvertedRm || 0)}</span>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
            <div className="flex justify-between font-medium">
              <span className="text-slate-600 dark:text-slate-300">Gross Profit:</span>
              <span className="font-mono text-slate-900 dark:text-white">{formatCurrency(breakdown?.grossProfit || 0)}</span>
            </div>
            <div className="flex justify-between text-red-500 dark:text-red-400">
              <span>(-) Bank Charge (Conversion):</span>
              <span className="font-mono">{formatCurrency(breakdown?.bankCharges || 0)}</span>
            </div>
            <div className="flex justify-between text-red-500 dark:text-red-400" title="Banking transaction charges in BDT converted to RM as per transaction day exchange rate">
              <span className="flex items-center gap-1">
                (-) Banking Trans. Charge (BDT→RM):
              </span>
              <span className="font-mono">{formatCurrency(bankingChargesRm)}</span>
            </div>
            <div className="flex justify-between text-red-500 dark:text-red-400">
              <span>(-) General Expenses (RM):</span>
              <span className="font-mono">{formatCurrency(generalExpensesRm)}</span>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
            <div className="flex justify-between font-bold text-xs">
              <span className="text-slate-900 dark:text-white underline decoration-double underline-offset-2">Net Profit:</span>
              <span className={cn("font-mono", (breakdown?.netProfit || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                {formatCurrency(breakdown?.netProfit || 0)}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Volume Metrics</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-slate-600 dark:text-slate-400">Order Volume</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">{formatCurrency(summary.total_myr_orders || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-slate-600 dark:text-slate-400">Total Conversion</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">{formatCurrency(summary.total_myr_converted || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-slate-600 dark:text-slate-400">Avg. Conversion Rate</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {summary.total_myr_converted > 0 
                  ? (summary.total_bdt_converted / summary.total_myr_converted).toFixed(2) 
                  : '0.00'}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Quick Stats</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-slate-600 dark:text-slate-400">Total Orders</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">{summary.order_count || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-slate-600 dark:text-slate-400">Conversion Bank Charges</span>
              <span className="text-xs font-bold text-red-600 dark:text-red-400">{formatCurrency(summary.total_charges || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-slate-600 dark:text-slate-400">Banking Transaction Charges</span>
              <span className="text-xs font-bold text-red-600 dark:text-red-400">{formatCurrency(bankingChargesRm)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-slate-600 dark:text-slate-400">Total Expenses & Charges</span>
              <span className="text-xs font-bold text-red-600 dark:text-red-400">{formatCurrency((summary.total_expenses || 0) + (summary.total_charges || 0))}</span>
            </div>
          </div>
        </Card>

        <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
        </div>
      </div>
    );
  };

  const renderTableReport = (isExport = false) => {
    if (!reportData || !reportData.data) return null;
    const { data, columns } = reportData;

    const columnTotals = columns.map((col: string, index: number) => {
      if (index === 0) return 'TOTAL';
      if ((reportType === 'ledger' || reportType === 'collection') && col === 'Rate') return '';
      if ((reportType === 'ledger' || reportType === 'collection') && col === 'Balance') {
        if (data.length === 0) return '';
        const lastRow = data[data.length - 1];
        const balance = Object.values(lastRow)[index];
        return typeof balance === 'number' ? balance : '';
      }
      
      let sum = 0;
      let hasNumeric = false;
      
      data.forEach((row: any) => {
        const rowValues = Object.values(row);
        const val = rowValues[index];
        if (typeof val === 'number') {
          sum += val;
          hasNumeric = true;
        }
      });
      
      // Fix floating point precision for the sum
      return hasNumeric ? Number(sum.toFixed(2)) : '';
    });

    const totalPages = Math.ceil(data.length / itemsPerPage);
    const currentData = isExport ? data : data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const agentName = filterMYAgent ? myAgents.find(a => a.id.toString() === filterMYAgent.toString())?.name : 
                    filterBDAgent ? bdAgents.find(a => a.id.toString() === filterBDAgent.toString())?.name : 
                    (filterMYAgent === '' && filterBDAgent === '') ? 'All Agents' : 
                    (filterMYAgent === '' ? 'All MY Agents' : 'All BD Agents');

    return (
      <div id={isExport ? "report-content-export" : "report-content"} className={cn("space-y-4 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800", isExport && "w-fit min-w-full")}>
        <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              {reportType.replace('_', ' ').toUpperCase()} REPORT - {agentName}
            </h1>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mt-1">
              Juel Money Transfer Apps ({startDate ? formatDate(startDate) : 'Beginning'} - {endDate ? formatDate(endDate) : 'Present'})
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Generated On</p>
            <p className="text-sm font-mono text-slate-900 dark:text-white">{new Date().toLocaleString()}</p>
          </div>
        </div>

        <Card className="overflow-hidden border-none shadow-none bg-transparent">
          <div className={cn(isExport ? "" : "overflow-x-auto")}>
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  {columns.map((col: string) => (
                    <th key={col} className="px-3 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700 last:border-r-0">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {currentData.length > 0 ? currentData.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    {Object.values(row).map((val: any, j: number) => {
                      const colName = columns[j];
                      return (
                        <td key={j} className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 last:border-r-0 whitespace-nowrap">
                          {typeof val === 'number' ? (
                            <span className={cn(
                              reportType === 'daily_financial' && j === 6 ? (val >= 0 ? "text-emerald-600 font-bold" : "text-red-600 font-bold") : "",
                              (reportType === 'ledger' || reportType === 'collection') && colName === 'Debit' ? "text-red-600 dark:text-red-400 font-medium" : "",
                              (reportType === 'ledger' || reportType === 'collection') && colName === 'Credit' ? "text-emerald-600 dark:text-emerald-400 font-medium" : "",
                              (reportType === 'ledger' || reportType === 'collection') && colName === 'Withdraw' ? "text-red-600 dark:text-red-400 font-medium" : "",
                              (reportType === 'ledger' || reportType === 'collection') && colName.includes('Collection') ? "text-emerald-600 dark:text-emerald-400 font-medium" : "",
                              (reportType === 'ledger' || reportType === 'collection') && colName === 'Balance' ? "font-bold text-slate-900 dark:text-white" : ""
                            )}>
                              {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            colName.toLowerCase().includes('date') ? formatDate(val as string) : val
                          )}
                        </td>
                      );
                    })}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400 text-xs italic">No data found for this report period.</td>
                  </tr>
                )}
              </tbody>
              {data.length > 0 && (
                <tfoot className="bg-slate-50 dark:bg-slate-800 font-bold border-t-2 border-slate-200 dark:border-slate-700">
                  <tr>
                    {columnTotals.map((total: any, i: number) => (
                      <td key={i} className={cn(
                        "px-3 py-3 text-xs border-r border-slate-200 dark:border-slate-700 last:border-r-0",
                         i === 0 ? "text-slate-900 dark:text-white text-right tracking-wider uppercase font-bold" : "text-slate-900 dark:text-white"
                      )}>
                        {typeof total === 'number' ? total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : total}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>

        {!isExport && totalPages > 1 && (
          <div className="flex justify-between items-center pt-2">
            <div className="text-xs text-slate-500">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, data.length)} of {data.length} entries
            </div>
            <div className="flex gap-1">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 px-2 text-xs"
              >
                Previous
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="h-8 w-8 p-0 text-xs"
                  >
                    {pageNum}
                  </Button>
                );
              })}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 px-2 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Financial Reports</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Detailed insights into your business performance.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReload} className="text-xs py-1.5 h-10">
            <RefreshCw size={16} className={cn(isReloading && "animate-spin")} />
          </Button>
          <Button variant="outline" className="text-xs py-1.5 h-10" onClick={exportToPDF}>Export PDF (.pdf)</Button>
          <Button variant="outline" className="text-xs py-1.5 h-10" onClick={exportToExcel}>Export Excel (.xlsx)</Button>
          <Button variant="outline" className="text-xs py-1.5 h-10" onClick={exportToJPG}>Export JPG (.jpg)</Button>
        </div>
      </div>

      {/* Reports Section Sub-Tabs */}
      <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
        <button
          onClick={() => {
            if (reportType === 'monthly_profit') {
              setReportType('summary');
            }
          }}
          className={cn(
            "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
            reportType !== 'monthly_profit'
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          Tabular Reports
        </button>
        <button
          onClick={() => setReportType('monthly_profit')}
          className={cn(
            "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
            reportType === 'monthly_profit'
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          Monthly Net Profit Chart
        </button>
      </div>
 
      <Card className="p-3 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
          {reportType !== 'monthly_profit' ? (
            <Select 
              label="Report Type" 
              value={reportType}
              onChange={e => setReportType(e.target.value)}
              options={[
                {value: 'summary', label: 'Profit Summary'},
                {value: 'daily_financial', label: 'Daily Financial Report'},
                {value: 'orders', label: 'Order Report'},
                {value: 'payments', label: 'Payment Report'},
                {value: 'expenses', label: 'Expense Report'},
                {value: 'conversions', label: 'Conversion Report'},
                {value: 'outstanding', label: 'Outstanding Report'},
                {value: 'collection', label: 'Collection Report'},
                {value: 'ledger', label: 'Agent Ledger'}
              ]} 
            />
          ) : (
            <div className="flex flex-col justify-center px-3 bg-white/50 dark:bg-slate-900/50 rounded border border-dashed border-slate-200 dark:border-slate-800 h-[52px]">
              <span className="text-[9px] text-slate-400 font-bold uppercase">Active View</span>
              <span className="text-xs text-slate-900 dark:text-white font-semibold">Net Profit Chart</span>
            </div>
          )}
          <SearchableSelect 
            label="MY Agent" 
            value={filterMYAgent}
            onChange={val => setFilterMYAgent(val)}
            options={[{value: '', label: 'Blank'}, {value: 'all', label: 'All MY Agents'}, ...myAgents.map(a => ({value: a.id, label: a.name}))]} 
          />
          <SearchableSelect 
            label="BD Agent" 
            value={filterBDAgent}
            onChange={val => setFilterBDAgent(val)}
            options={[{value: '', label: 'Blank'}, {value: 'all', label: 'All BD Agents'}, ...bdAgents.map(a => ({value: a.id, label: a.name}))]} 
          />
          <Input 
            label="Start Date" 
            type="date" 
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
          <Input 
            label="End Date" 
            type="date" 
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>
      </Card>
 
      {loading ? (
        <div className="p-8 text-center text-slate-500 text-xs">Generating report...</div>
      ) : (
        <>
          <div className="mt-6">
            {reportType === 'monthly_profit' 
              ? renderMonthlyProfitChart() 
              : reportType === 'summary' 
                ? renderSummary() 
                : renderTableReport()}
          </div>
          
          {/* Hidden full report for export */}
          <div className="hidden">
            {reportType !== 'summary' && reportType !== 'monthly_profit' && renderTableReport(true)}
          </div>
        </>
      )}
    </div>
  );
}
