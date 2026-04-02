import { Router } from 'express';
import type { Request, Response } from 'express';
import type { LoanAccount } from '../types/index.js';
import crypto from 'crypto';

const router: Router = Router();

// In-memory predetermined OTPs
const VALID_OTPS = [1234, 5678, 7889, 1209];

// Helper functions for deterministic values based on a string seed
function getDeterministicNumber(seed: string, min: number, max: number): number {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  const intVal = parseInt(hash.substring(0, 8), 16);
  return min + (intVal % (max - min));
}

function getDeterministicFloat(seed: string, min: number, max: number, decimals: number): number {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  const intVal = parseInt(hash.substring(8, 16), 16);
  const floatVal = min + (intVal / 0xFFFFFFFF) * (max - min);
  return parseFloat(floatVal.toFixed(decimals));
}

function getDeterministicBoolean(seed: string, probability: number): boolean {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  const intVal = parseInt(hash.substring(16, 24), 16);
  return (intVal / 0xFFFFFFFF) < probability;
}

// Mock data generator for loans
const generateLoanData = (accountId: string): LoanAccount => {
  const types = ['Home Loan', 'Auto Loan', 'Personal Loan', 'Education Loan'];
  const typeIdx = getDeterministicNumber(accountId + 'type', 0, types.length);
  const typeOfLoan = types[typeIdx];

  let minTenure = 12, maxTenure = 60, minRate = 10, maxRate = 15, minPrin = 100000, maxPrin = 500000;

  switch (typeOfLoan) {
    case 'Home Loan':
      minTenure = 120; maxTenure = 181; // 10-15 years
      minRate = 7; maxRate = 9;
      minPrin = 2000000; maxPrin = 10000000; // 20L - 1Cr
      break;
    case 'Auto Loan':
      minTenure = 36; maxTenure = 49; // 3-4 years
      minRate = 8; maxRate = 12;
      minPrin = 500000; maxPrin = 2000000; // 5L - 20L
      break;
    case 'Education Loan':
      minTenure = 36; maxTenure = 49; // 3-4 years
      minRate = 9; maxRate = 14;
      minPrin = 500000; maxPrin = 3000000; // 5L - 30L
      break;
    case 'Personal Loan':
      minTenure = 12; maxTenure = 37; // 1-3 years
      minRate = 12; maxRate = 18;
      minPrin = 100000; maxPrin = 1000000; // 1L - 10L
      break;
  }

  const tenure = getDeterministicNumber(accountId + 'tenure', minTenure, maxTenure);

  // Calculate mathematically consistent dates based on the tenure
  const startOffsetMonths = getDeterministicNumber(accountId + 'startOffset', 1, tenure); // how many months ago it started
  const loanStartDate = new Date(Date.now());
  loanStartDate.setMonth(loanStartDate.getMonth() - startOffsetMonths);
  
  const loanEndDate = new Date(loanStartDate.getTime());
  loanEndDate.setMonth(loanEndDate.getMonth() + tenure);

  // audit/payment should be recently active
  const lastPaymentDaysAgo = getDeterministicNumber(accountId + 'payment', 1, 30);
  const lastPaymentDate = new Date(Date.now() - lastPaymentDaysAgo * 24 * 60 * 60 * 1000);
  
  const auditDaysAgo = getDeterministicNumber(accountId + 'audit', 1, 15);
  const auditDate = new Date(Date.now() - auditDaysAgo * 24 * 60 * 60 * 1000);

  return {
    // Required base fields for initial listing & DRM
    accountId,
    typeOfLoan: typeOfLoan!,
    tenure,

    // Required fields for specific loan details DRM
    interest_rate: getDeterministicFloat(accountId + 'rate', minRate, maxRate, 2),
    principal_pending: getDeterministicNumber(accountId + 'principal', minPrin, maxPrin),
    interest_pending: getDeterministicNumber(accountId + 'interest', Math.floor(minPrin * 0.01), Math.floor(maxPrin * 0.05)),
    nominee: getDeterministicBoolean(accountId + 'nominee', 0.5) ? 'Spouse' : 'Parent',

    // Mock massive JSON payload fields (Token Optimization)
    internalBankCode: `BNK-${getDeterministicNumber(accountId + 'bankCode', 1, 1000)}`,
    auditDate: auditDate.toISOString().split('T')[0]!,
    currency: 'INR',
    loanStartDate: loanStartDate.toISOString().split('T')[0]!,
    loanEndDate: loanEndDate.toISOString().split('T')[0]!,
    branchCode: `BR-${getDeterministicNumber(accountId + 'branch', 1, 50)}`,
    officerId: `EMP-${getDeterministicNumber(accountId + 'officer', 1, 10000)}`,
    status: getDeterministicBoolean(accountId + 'status', 0.9) ? 'ACTIVE' : 'DEFAULT',
    lastPaymentDate: lastPaymentDate.toISOString().split('T')[0]!,
    nextEquatedMonthlyInstallment: getDeterministicNumber(accountId + 'emi', 5000, 50000),
    customerId: `USER-${getDeterministicNumber(accountId + 'customer', 1, 99999)}`
  };
};

/**
 * 1. OTP Trigger
 * Generates one of the predetermined values (1234, 5678, 7889, or 1209).
 */
router.post('/triggerOTP', (req: Request, res: Response) => {
  const { phoneNumber, dob } = req.body;

  if (!phoneNumber || !dob) {
    return res.status(400).json({ error: 'Missing required parameters: phoneNumber, dob' });
  }

  // To make OTP deterministic by phone number (optional) but the assignment specifies to generate one.
  // We will keep it as random to follow standard OTP trigger flow, or we can make it deterministic.
  // Wait, the assignment says: "generates one of the following predetermined values". 
  // Let's make it deterministic by phone as well for an absolutely consistent test experience.
  const otpIdx = getDeterministicNumber(phoneNumber + 'otp', 0, VALID_OTPS.length);
  const generatedOtp = VALID_OTPS[otpIdx];

  return res.json({
    success: true,
    otp: generatedOtp,
    message: 'OTP generated successfully'
  });
});

/**
 * 2. Loan Account ID Retrieval (Workflow A)
 * Returns a list of massive JSON objects representing the user's loans deterministically.
 */
router.post('/getLoanAccounts', (req: Request, res: Response) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ error: 'Missing required parameter: phoneNumber' });
  }

  // Generate 1 to 3 random accounts for this specific phone number consistently
  const numAccounts = getDeterministicNumber(phoneNumber + 'count', 1, 4);
  const accountIds = Array.from({ length: numAccounts }).map((_, i) => {
    return `LN-${getDeterministicNumber(phoneNumber + i, 10000, 99999)}`;
  });

  const accounts = accountIds.map(id => {
    const fullData = generateLoanData(id);
    return {
      accountId: fullData.accountId,
      typeOfLoan: fullData.typeOfLoan,
      tenure: fullData.tenure
    };
  });

  // Return minimal data for the accounts list
  return res.json({
    success: true,
    data: accounts
  });
});

/**
 * 3. Details Retrieval (Workflow B)
 * Returns raw technical data for a specific loan account.
 */
router.post('/loanDetails', (req: Request, res: Response) => {
  const { accountId } = req.body;

  if (!accountId) {
    return res.status(400).json({ error: 'Missing required parameter: accountId' });
  }

  // Assuming it fetches real details. We simply generate deterministic details for the ID.
  const accountDetails = generateLoanData(accountId);

  // Return the full "massive JSON" object when specific details are asked for
  return res.json({
    success: true,
    data: accountDetails
  });
});

export default router;
