import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { processBankTransaction, getAllBankAccountsSummary } from '@/lib/bank-transaction-service';

/**
 * POST - Process a bank transaction
 * This endpoint handles all bank transactions with proper double-entry bookkeeping
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      bankAccountId,
      transactionType,
      amount,
      description,
      referenceType,
      referenceId,
      createdById,
      companyId,
      loanId,
      customerId,
      principalComponent,
      interestComponent,
      penaltyComponent,
      paymentMode,
      chequeNumber,
      bankRefNumber
    } = body;

    // Validate required fields
    if (!bankAccountId || !transactionType || !amount || !description || !createdById || !companyId) {
      return NextResponse.json({ 
        error: 'Missing required fields: bankAccountId, transactionType, amount, description, createdById, companyId' 
      }, { status: 400 });
    }

    const result = await processBankTransaction({
      bankAccountId,
      transactionType,
      amount: parseFloat(amount),
      description,
      referenceType,
      referenceId,
      createdById,
      companyId,
      loanId,
      customerId,
      principalComponent: principalComponent ? parseFloat(principalComponent) : undefined,
      interestComponent: interestComponent ? parseFloat(interestComponent) : undefined,
      penaltyComponent: penaltyComponent ? parseFloat(penaltyComponent) : undefined,
      paymentMode,
      chequeNumber,
      bankRefNumber
    });

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Bank transaction error:', error);
    return NextResponse.json({ 
      error: 'Failed to process bank transaction',
      details: (error as Error).message 
    }, { status: 500 });
  }
}

/**
 * GET - Get bank accounts summary with all transactions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const bankAccountId = searchParams.get('bankAccountId');
    const action = searchParams.get('action');

    // Get summary for all bank accounts
    if (action === 'summary' && companyId) {
      const summary = await getAllBankAccountsSummary(companyId);
      return NextResponse.json(summary);
    }

    // Get transactions for a specific bank account
    if (bankAccountId) {
      const bankAccount = await db.bankAccount.findUnique({
        where: { id: bankAccountId },
        include: {
          transactions: {
            orderBy: { transactionDate: 'desc' },
            take: 100
          }
        }
      });

      if (!bankAccount) {
        return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
      }

      // Get journal entries linked to this bank account
      const journalEntries = await db.journalEntry.findMany({
        where: { bankAccountId },
        orderBy: { entryDate: 'desc' },
        take: 50,
        include: {
          lines: {
            include: { account: true }
          }
        }
      });

      return NextResponse.json({
        bankAccount,
        journalEntries
      });
    }

    // Get all bank accounts for company
    if (companyId) {
      const bankAccounts = await db.bankAccount.findMany({
        where: { companyId, isActive: true },
        include: {
          transactions: {
            orderBy: { transactionDate: 'desc' },
            take: 20
          },
          _count: { select: { transactions: true } }
        },
        orderBy: { isDefault: 'desc' }
      });

      return NextResponse.json({ bankAccounts });
    }

    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching bank transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch bank transactions' }, { status: 500 });
  }
}
