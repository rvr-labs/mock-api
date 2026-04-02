export interface LoanAccount {
  // Required fields for the assignment
  accountId: string;
  typeOfLoan: string;
  tenure: number; // in months
  interest_rate: number;
  principal_pending: number;
  interest_pending: number;
  nominee: string;
  
  // Extra fields to simulate "massive JSON payload" for Token Optimization scenario
  internalBankCode: string;
  auditDate: string;
  currency: string;
  loanStartDate: string;
  loanEndDate: string;
  branchCode: string;
  officerId: string;
  status: 'ACTIVE' | 'CLOSED' | 'DEFAULT';
  lastPaymentDate: string;
  nextEquatedMonthlyInstallment: number;
  customerId: string;
}
