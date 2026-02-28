export interface EmployeeWithStats {
  id: string;
  code: string;
  name: string;
  payRate: number;
  overtimeEnabled: boolean;
  overtimeThreshold: number;
  overtimeMultiplier: number;
  active: boolean;
  totalPunches?: number;
  issueCount?: number;
}

export interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  newEmployees: number;
  manualPunchesPreserved: number;
}

export interface TimesheetEntry {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  days: {
    date: string;
    dayOfWeek: string;
    pairs: { clockIn: string; clockOut: string | null; hours: number }[];
    totalHours: number;
    hasIssue: boolean;
  }[];
  weekTotal: number;
  overtimeHours: number;
  regularHours: number;
}

export interface PayoutData {
  id: string;
  employeeId: string;
  amount: number;
  type: "ADVANCE" | "LOAN" | "PAYMENT" | "LOAN_REPAYMENT";
  method?: string | null;
  description: string;
  date: string;
  employee?: {
    id: string;
    code: string;
    name: string;
  };
}

export interface PaystubData {
  employee: {
    name: string;
    code: string;
    payRate: number;
  };
  period: {
    start: string;
    end: string;
    label: string;
  };
  dailyBreakdown: {
    date: string;
    dayOfWeek: string;
    pairs: { clockIn: string; clockOut: string; hours: number }[];
    dayTotal: number;
  }[];
  payouts: {
    date: string;
    type: string;
    description: string;
    amount: number;
  }[];
  summary: {
    totalHours: number;
    regularHours: number;
    overtimeHours: number;
    regularPay: number;
    overtimePay: number;
    grossPay: number;
    totalPayouts: number;
    netPay: number;
    payRate: number;
    overtimeRate: number;
    overtimeMultiplier: number;
    totalPaid: number;
    balanceDue: number;
    priorBalance: number;
  };
}

export interface DashboardStats {
  totalHoursThisWeek: number;
  totalCostThisWeek: number;
  activeEmployees: number;
  overtimeHoursThisWeek: number;
  missingPunches: number;
  totalPayouts: number;
  employeeHours: { name: string; regular: number; overtime: number }[];
}

// QuickBooks Online Types

export interface QBOInvoice {
  id: string;
  docNumber: string;
  customerName: string;
  customerId: string;
  totalAmt: number;
  balance: number;
  dueDate: string;
  txnDate: string;
  status: "paid" | "partial" | "unpaid";
}

export interface QBOCustomer {
  id: string;
  displayName: string;
}

export interface QBOPaymentMethod {
  id: string;
  name: string;
  type: string;
}

// QBO Item/Sale Types

export interface QBOItem {
  id: string;
  name: string;
  description: string;
  unitPrice: number;
  type: string;
}

export interface SaleCartItem {
  itemId: string;
  name: string;
  price: number;
  qty: number;
}

// Cash Manager Types

export interface CashEntryData {
  id: string;
  type: "CASH_IN" | "CASH_OUT" | "DEPOSIT" | "WITHDRAWAL";
  amount: number;
  registerAmount: number;
  depositAmount: number;
  changeGiven: number;
  category: string | null;
  source: string; // "REGISTER" or "DEPOSIT"
  customerName: string | null;
  invoiceNumber: string | null;
  notes: string | null;
  date: string;
  userId: string;
  user?: { id: string; username: string };
  createdAt: string;
}

export interface ExpenseData {
  id: string;
  amount: number;
  description: string;
  category: string;
  source: string; // "REGISTER" or "DEPOSIT"
  paidById: string | null;
  paidByName: string;
  outOfPocket: boolean;
  reimbursed: boolean;
  receiptPath: string | null;
  date: string;
  userId: string;
  user?: { id: string; username: string };
  createdAt: string;
}

export interface CashReconciliationData {
  id: string;
  expectedBalance: number;
  actualBalance: number;
  discrepancy: number;
  registerExpected: number;
  registerActual: number;
  depositExpected: number;
  depositActual: number;
  notes: string | null;
  date: string;
  userId: string;
  user?: { id: string; username: string };
  createdAt: string;
}

export interface CashSummaryData {
  registerBalance: number;
  depositBalance: number;
  todayCashIn: number;
  todayCashOut: number;
  todayExpenses: number;
  weeklyStartingBalance: number;
  lastReconciliation?: {
    date: string;
    registerActual: number;
    depositActual: number;
  } | null;
}
