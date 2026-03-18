import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Scan all past loan transactions and create bank transactions
export async function POST(request: NextRequest) {
  try {
    console.log('[scan-loan-transactions] Starting scan...');
    
    // Get system user for createdById
    const systemUser = await db.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true }
    }) || await db.user.findFirst({ select: { id: true } });
    
    if (!systemUser) {
      return NextResponse.json({ error: 'No system user found' }, { status: 500 });
    }
    
    const createdById = systemUser.id;

    // Get all active loans (online)
    const onlineLoans = await db.loanApplication.findMany({
      where: {
        status: { in: ['ACTIVE', 'DISBURSED'] }
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        emiSchedules: {
          where: { paymentStatus: 'PAID' },
          orderBy: { paidDate: 'asc' }
        },
        payments: true,
        sessionForm: true
      }
    });

    // Get all active offline loans
    const offlineLoans = await db.offlineLoan.findMany({
      where: { status: 'ACTIVE' },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        emis: {
          where: { paymentStatus: 'PAID' },
          orderBy: { paidDate: 'asc' }
        }
      }
    });

    // Get or create default bank account
    let defaultBank = await db.bankAccount.findFirst({
      where: { isDefault: true }
    });

    if (!defaultBank) {
      defaultBank = await db.bankAccount.findFirst();
    }

    if (!defaultBank) {
      // Create a default bank account
      defaultBank = await db.bankAccount.create({
        data: {
          bankName: 'SMFC Primary Account',
          accountNumber: '0000000000',
          accountName: 'SMFC Finance',
          ifscCode: 'SMFC0000001',
          accountType: 'CURRENT',
          currentBalance: 0,
          isDefault: true
        }
      });
    }

    let totalTransactions = 0;
    let totalCredits = 0;
    let totalDebits = 0;
    const transactionDetails: any[] = [];

    // Process online loan disbursements
    for (const loan of onlineLoans) {
      // Check if disbursement transaction exists
      const existingDisbursement = await db.bankTransaction.findFirst({
        where: {
          referenceType: 'LOAN_DISBURSEMENT',
          referenceId: loan.id
        }
      });

      if (!existingDisbursement && loan.disbursedAmount && loan.disbursedAt) {
        // Create disbursement transaction (debit - money going out)
        const amount = loan.disbursedAmount;
        await db.bankTransaction.create({
          data: {
            bankAccountId: defaultBank.id,
            transactionType: 'DEBIT',
            amount: amount,
            balanceAfter: defaultBank.currentBalance - amount,
            description: `Loan Disbursement - ${loan.applicationNo} (${loan.customer?.name || 'Customer'})`,
            referenceType: 'LOAN_DISBURSEMENT',
            referenceId: loan.id,
            createdById: createdById,
            transactionDate: loan.disbursedAt
          }
        });
        
        // Update bank balance
        await db.bankAccount.update({
          where: { id: defaultBank.id },
          data: { currentBalance: { decrement: amount } }
        });
        
        defaultBank.currentBalance -= amount;
        totalDebits += amount;
        totalTransactions++;
        transactionDetails.push({
          type: 'DISBURSEMENT',
          loanNo: loan.applicationNo,
          amount: amount,
          date: loan.disbursedAt
        });
      }

      // Process EMI payments
      for (const emi of loan.emiSchedules) {
        const existingPayment = await db.bankTransaction.findFirst({
          where: {
            referenceType: 'EMI_PAYMENT',
            referenceId: emi.id
          }
        });

        if (!existingPayment && emi.paidAmount && emi.paidDate) {
          // Create EMI payment transaction (credit - money coming in)
          const amount = emi.paidAmount;
          await db.bankTransaction.create({
            data: {
              bankAccountId: defaultBank.id,
              transactionType: 'CREDIT',
              amount: amount,
              balanceAfter: defaultBank.currentBalance + amount,
              description: `EMI Payment - ${loan.applicationNo} EMI #${emi.installmentNumber} (${loan.customer?.name || 'Customer'})`,
              referenceType: 'EMI_PAYMENT',
              referenceId: emi.id,
              createdById: createdById,
              transactionDate: emi.paidDate
            }
          });

          // Update bank balance
          await db.bankAccount.update({
            where: { id: defaultBank.id },
            data: { currentBalance: { increment: amount } }
          });

          defaultBank.currentBalance += amount;
          totalCredits += amount;
          totalTransactions++;
          transactionDetails.push({
            type: 'EMI_PAYMENT',
            loanNo: loan.applicationNo,
            emiNo: emi.installmentNumber,
            amount: amount,
            date: emi.paidDate
          });
        }
      }
    }

    // Process offline loan disbursements
    for (const loan of offlineLoans) {
      const existingDisbursement = await db.bankTransaction.findFirst({
        where: {
          referenceType: 'OFFLINE_LOAN_DISBURSEMENT',
          referenceId: loan.id
        }
      });

      if (!existingDisbursement && loan.disbursementDate) {
        // Create disbursement transaction (debit)
        const amount = loan.loanAmount;
        await db.bankTransaction.create({
          data: {
            bankAccountId: defaultBank.id,
            transactionType: 'DEBIT',
            amount: amount,
            balanceAfter: defaultBank.currentBalance - amount,
            description: `Offline Loan Disbursement - ${loan.loanNumber} (${loan.customerName})`,
            referenceType: 'OFFLINE_LOAN_DISBURSEMENT',
            referenceId: loan.id,
            createdById: createdById,
            transactionDate: loan.disbursementDate
          }
        });

        // Update bank balance
        await db.bankAccount.update({
          where: { id: defaultBank.id },
          data: { currentBalance: { decrement: amount } }
        });

        defaultBank.currentBalance -= amount;
        totalDebits += amount;
        totalTransactions++;
        transactionDetails.push({
          type: 'OFFLINE_DISBURSEMENT',
          loanNo: loan.loanNumber,
          amount: amount,
          date: loan.disbursementDate
        });
      }

      // Process offline EMI payments
      for (const emi of loan.emis) {
        const existingPayment = await db.bankTransaction.findFirst({
          where: {
            referenceType: 'OFFLINE_EMI_PAYMENT',
            referenceId: emi.id
          }
        });

        if (!existingPayment && emi.paidAmount && emi.paidDate) {
          const amount = emi.paidAmount;
          await db.bankTransaction.create({
            data: {
              bankAccountId: defaultBank.id,
              transactionType: 'CREDIT',
              amount: amount,
              balanceAfter: defaultBank.currentBalance + amount,
              description: `Offline EMI Payment - ${loan.loanNumber} EMI #${emi.installmentNumber} (${loan.customerName})`,
              referenceType: 'OFFLINE_EMI_PAYMENT',
              referenceId: emi.id,
              createdById: createdById,
              transactionDate: emi.paidDate
            }
          });

          // Update bank balance
          await db.bankAccount.update({
            where: { id: defaultBank.id },
            data: { currentBalance: { increment: amount } }
          });

          defaultBank.currentBalance += amount;
          totalCredits += amount;
          totalTransactions++;
          transactionDetails.push({
            type: 'OFFLINE_EMI_PAYMENT',
            loanNo: loan.loanNumber,
            emiNo: emi.installmentNumber,
            amount: amount,
            date: emi.paidDate
          });
        }
      }
    }

    // Get updated bank balance
    const updatedBank = await db.bankAccount.findUnique({
      where: { id: defaultBank.id }
    });

    console.log(`[scan-loan-transactions] Completed. Total transactions: ${totalTransactions}`);

    return NextResponse.json({
      success: true,
      message: `Scanned ${onlineLoans.length + offlineLoans.length} loans`,
      totalLoans: onlineLoans.length + offlineLoans.length,
      onlineLoans: onlineLoans.length,
      offlineLoans: offlineLoans.length,
      totalTransactions,
      totalCredits,
      totalDebits,
      currentBankBalance: updatedBank?.currentBalance || 0,
      transactions: transactionDetails.slice(0, 20) // Return first 20 for preview
    });

  } catch (error) {
    console.error('Error scanning loan transactions:', error);
    return NextResponse.json({ 
      error: 'Failed to scan loan transactions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
