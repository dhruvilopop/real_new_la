import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { CreditTransactionType, PaymentModeType, CreditType } from '@prisma/client';
import { createEMIPaymentEntry } from '@/lib/accounting-service';

// ============================================
// DUAL CREDIT SYSTEM API
// Company Credit: Only CASH payments increase this
// Personal Credit: Requires proof for ALL transactions
// ============================================

// Simple in-memory cache for credit summary (to prevent DB connection limit issues)
const creditCache: Map<string, { data: any; timestamp: number }> = new Map();
const CACHE_TTL = 30000; // 30 seconds cache

// GET - Fetch credit balance and history for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const creditType = searchParams.get('creditType'); // COMPANY or PERSONAL

    // Get all credit transactions (for Super Admin)
    if (action === 'all-transactions') {
      const transactions = await db.creditTransaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      });

      return NextResponse.json({
        success: true,
        transactions
      });
    }

    // Get all users with any credit (for Super Admin)
    if (action === 'all-personal-credits') {
      const usersWithCredit = await db.user.findMany({
        where: {
          OR: [
            { personalCredit: { gt: 0 } },
            { companyCredit: { gt: 0 } }
          ]
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          personalCredit: true,
          companyCredit: true,
          credit: true,
          createdAt: true,
          company: { select: { name: true } },
          _count: {
            select: {
              creditTransactions: true
            }
          }
        },
        orderBy: { credit: 'desc' }
      });

      return NextResponse.json({
        success: true,
        users: usersWithCredit,
        totalPersonalCredit: usersWithCredit.reduce((sum, u) => sum + u.personalCredit, 0),
        totalCompanyCredit: usersWithCredit.reduce((sum, u) => sum + u.companyCredit, 0)
      });
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Check cache for summary action (most frequently called)
    if (action === 'summary') {
      const cacheKey = `summary_${userId}_${creditType || 'all'}`;
      const cached = creditCache.get(cacheKey);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < CACHE_TTL) {
        return NextResponse.json(cached.data);
      }
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyCredit: true,
        personalCredit: true,
        credit: true,
        companyId: true,
        company: { select: { name: true, companyCredit: true } }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get credit summary with dual credit breakdown
    if (action === 'summary') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const whereClause: Record<string, unknown> = { userId };
      if (creditType) {
        whereClause.creditType = creditType;
      }

      const todayTransactions = await db.creditTransaction.findMany({
        where: {
          ...whereClause,
          createdAt: { gte: today }
        }
      });

      const allTransactions = await db.creditTransaction.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      const summary = {
        // Total credits
        totalCredit: user.credit,
        companyCredit: user.companyCredit,
        personalCredit: user.personalCredit,
        
        // Today's breakdown
        todayTotal: todayTransactions.reduce((sum, t) => 
          t.transactionType === 'CREDIT_INCREASE' || t.transactionType === 'PERSONAL_COLLECTION'
            ? sum + t.amount 
            : sum - t.amount, 0),
        
        // Company credit (CASH only)
        todayCompanyCreditIncrease: todayTransactions
          .filter(t => t.creditType === 'COMPANY' && t.transactionType === 'CREDIT_INCREASE')
          .reduce((sum, t) => sum + t.amount, 0),
        
        // Personal credit (requires proof)
        todayPersonalCreditIncrease: todayTransactions
          .filter(t => t.creditType === 'PERSONAL' && 
            (t.transactionType === 'CREDIT_INCREASE' || t.transactionType === 'PERSONAL_COLLECTION'))
          .reduce((sum, t) => sum + t.amount, 0),
        
        // Payment mode breakdown
        cashCollected: todayTransactions
          .filter(t => t.transactionType === 'CREDIT_INCREASE' && t.paymentMode === 'CASH')
          .reduce((sum, t) => sum + t.amount, 0),
        chequeCollected: todayTransactions
          .filter(t => t.transactionType === 'CREDIT_INCREASE' && t.paymentMode === 'CHEQUE')
          .reduce((sum, t) => sum + t.amount, 0),
        onlineCollected: todayTransactions
          .filter(t => t.transactionType === 'CREDIT_INCREASE' && 
            (t.paymentMode === 'ONLINE' || t.paymentMode === 'UPI' || t.paymentMode === 'BANK_TRANSFER'))
          .reduce((sum, t) => sum + t.amount, 0),
        
        // Transaction counts
        todayTransactions: todayTransactions.length,
        totalTransactions: allTransactions.length,
        
        // Pending proofs
        pendingProofs: allTransactions.filter(t => 
          (t.paymentMode !== 'CASH' || t.creditType === 'PERSONAL') && !t.proofDocument
        ).length,
        
        // Company info
        company: user.company
      };

      const responseData = { success: true, summary, user };
      
      // Cache the result
      const cacheKey = `summary_${userId}_${creditType || 'all'}`;
      creditCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
      
      // Clean old cache entries (keep cache size reasonable)
      if (creditCache.size > 100) {
        const oldestKeys = Array.from(creditCache.keys()).slice(0, 50);
        oldestKeys.forEach(key => creditCache.delete(key));
      }

      return NextResponse.json(responseData);
    }

    // Get all users with personal credit (for Super Admin)
    if (action === 'all-personal-credits') {
      const usersWithPersonalCredit = await db.user.findMany({
        where: {
          personalCredit: { gt: 0 }
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          personalCredit: true,
          companyCredit: true,
          company: { select: { name: true } },
          _count: {
            select: {
              creditTransactions: {
                where: { creditType: 'PERSONAL' }
              }
            }
          }
        },
        orderBy: { personalCredit: 'desc' }
      });

      return NextResponse.json({
        success: true,
        users: usersWithPersonalCredit,
        totalPersonalCredit: usersWithPersonalCredit.reduce((sum, u) => sum + u.personalCredit, 0)
      });
    }

    // Get credit history with pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };
    
    if (searchParams.get('type')) {
      where.transactionType = searchParams.get('type');
    }
    if (searchParams.get('paymentMode')) {
      where.paymentMode = searchParams.get('paymentMode');
    }
    if (creditType) {
      where.creditType = creditType;
    }

    const [transactions, total] = await Promise.all([
      db.creditTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          settlement: {
            select: {
              settlementNumber: true,
              status: true,
              cashier: { select: { name: true, role: true } }
            }
          }
        }
      }),
      db.creditTransaction.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      user,
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Credit fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch credit data' }, { status: 500 });
  }
}

// POST - Add credit (EMI payment collection)
// Company Credit: Only increased by CASH payments
// Personal Credit: Increased by any payment collected in personal account (requires proof)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      amount,
      paymentMode,
      sourceType, // EMI_PAYMENT, PERSONAL_COLLECTION
      sourceId,
      loanApplicationId,
      emiScheduleId,
      customerId,
      installmentNumber,
      chequeNumber,
      chequeDate,
      bankRefNumber,
      utrNumber,
      description,
      remarks,
      // New fields for dual credit system
      creditType, // COMPANY or PERSONAL - determines which credit to increase
      // Customer details
      customerName,
      customerPhone,
      loanApplicationNo,
      // EMI details
      emiDueDate,
      emiAmount,
      principalComponent,
      interestComponent,
      // Proof document
      proofDocument,
      proofType,
      // Collection details
      collectedFrom,
      collectedFromPhone,
      collectionLocation,
      collectionLatitude,
      collectionLongitude,
      // Transaction date
      transactionDate
    } = body;

    if (!userId || !amount || !paymentMode || !sourceType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Determine credit type based on payment mode and explicit selection
    // If creditType is explicitly PERSONAL, always use personal credit
    // Otherwise, COMPANY credit only for CASH payments
    const actualCreditType: CreditType = creditType === 'PERSONAL' 
      ? CreditType.PERSONAL 
      : (paymentMode === 'CASH' ? CreditType.COMPANY : CreditType.PERSONAL);

    // Validate proof requirements
    // CHEQUE, ONLINE, UPI, BANK_TRANSFER always require proof
    // PERSONAL credit type always requires proof
    if ((paymentMode !== 'CASH' || actualCreditType === 'PERSONAL') && !proofDocument) {
      return NextResponse.json({ 
        error: 'Proof document is required for non-CASH payments and personal credit transactions',
        requiresProof: true 
      }, { status: 400 });
    }

    // Get current user credit
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { 
        credit: true, 
        companyCredit: true, 
        personalCredit: true, 
        role: true,
        companyId: true 
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Calculate new balances
    const newCompanyCredit = actualCreditType === 'COMPANY' 
      ? user.companyCredit + amount 
      : user.companyCredit;
    const newPersonalCredit = actualCreditType === 'PERSONAL' 
      ? user.personalCredit + amount 
      : user.personalCredit;
    const newTotalCredit = newCompanyCredit + newPersonalCredit;

    // Determine transaction type
    const transactionType: CreditTransactionType = actualCreditType === 'PERSONAL'
      ? CreditTransactionType.PERSONAL_COLLECTION
      : CreditTransactionType.CREDIT_INCREASE;

    // Create credit transaction and update user credit
    const [transaction] = await db.$transaction([
      db.creditTransaction.create({
        data: {
          userId,
          transactionType,
          amount,
          paymentMode: paymentMode as PaymentModeType,
          creditType: actualCreditType,
          companyBalanceAfter: newCompanyCredit,
          personalBalanceAfter: newPersonalCredit,
          balanceAfter: newTotalCredit,
          sourceType,
          sourceId,
          loanApplicationId,
          emiScheduleId,
          customerId,
          installmentNumber,
          customerName,
          customerPhone,
          loanApplicationNo,
          emiDueDate: emiDueDate ? new Date(emiDueDate) : null,
          emiAmount,
          principalComponent,
          interestComponent,
          chequeNumber,
          chequeDate: chequeDate ? new Date(chequeDate) : null,
          bankRefNumber,
          utrNumber,
          description,
          remarks,
          proofDocument,
          proofType,
          proofUploadedAt: proofDocument ? new Date() : null,
          proofVerified: paymentMode === 'CASH' && actualCreditType === 'COMPANY', // Auto-verify CASH company transactions
          collectedFrom,
          collectedFromPhone,
          collectionLocation,
          collectionLatitude,
          collectionLongitude,
          transactionDate: transactionDate ? new Date(transactionDate) : new Date()
        }
      }),
      db.user.update({
        where: { id: userId },
        data: { 
          credit: newTotalCredit,
          companyCredit: newCompanyCredit,
          personalCredit: newPersonalCredit
        }
      })
    ]);

    // Update company credit if applicable
    if (actualCreditType === 'COMPANY' && user.companyId) {
      await db.company.update({
        where: { id: user.companyId },
        data: { companyCredit: { increment: amount } }
      });
    }

    // Update daily collection
    await updateDailyCollection(amount, paymentMode, user.role, actualCreditType);

    // Create accounting entry for EMI payment
    if (sourceType === 'EMI_PAYMENT' && loanApplicationId && customerId) {
      try {
        // Get EMI details for proper principal/interest split
        let principalComp = principalComponent || 0;
        let interestComp = interestComponent || 0;
        
        // If not provided, estimate based on typical loan structure (rough estimate)
        if (!principalComp && !interestComp && emiAmount) {
          // Assume 70% principal, 30% interest as default split
          principalComp = emiAmount * 0.7;
          interestComp = emiAmount * 0.3;
        }
        
        await createEMIPaymentEntry({
          loanId: loanApplicationId,
          customerId: customerId,
          paymentId: transaction.id,
          totalAmount: amount,
          principalComponent: principalComp,
          interestComponent: interestComp,
          paymentDate: new Date(),
          createdById: userId,
          paymentMode: paymentMode
        });
      } catch (accountingError) {
        console.error('Accounting entry for EMI payment failed:', accountingError);
        // Don't fail the transaction if accounting fails
      }
    }

    return NextResponse.json({
      success: true,
      transaction,
      creditBreakdown: {
        companyCredit: newCompanyCredit,
        personalCredit: newPersonalCredit,
        totalCredit: newTotalCredit
      }
    });
  } catch (error) {
    console.error('Credit add error:', error);
    return NextResponse.json({ error: 'Failed to add credit' }, { status: 500 });
  }
}

// PUT - Decrease credit (settlement or personal credit clearance)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      amount,
      paymentMode,
      settlementId,
      chequeNumber,
      chequeDate,
      bankRefNumber,
      utrNumber,
      remarks,
      // New fields for dual credit system
      creditType, // COMPANY or PERSONAL
      clearPersonalCredit, // Boolean - for Super Admin to clear personal credit
      // Proof for clearance
      proofDocument,
      proofType
    } = body;

    if (!userId || !amount || !paymentMode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { 
        credit: true, 
        companyCredit: true, 
        personalCredit: true,
        role: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Determine which credit to decrease
    const decreaseCompany = creditType === 'COMPANY' || (!creditType && !clearPersonalCredit);
    const decreasePersonal = creditType === 'PERSONAL' || clearPersonalCredit;

    // Validate sufficient balance
    if (decreaseCompany && user.companyCredit < amount) {
      return NextResponse.json({ 
        error: 'Insufficient company credit balance',
        available: user.companyCredit 
      }, { status: 400 });
    }
    if (decreasePersonal && user.personalCredit < amount) {
      return NextResponse.json({ 
        error: 'Insufficient personal credit balance',
        available: user.personalCredit 
      }, { status: 400 });
    }

    // Calculate new balances
    const newCompanyCredit = decreaseCompany ? user.companyCredit - amount : user.companyCredit;
    const newPersonalCredit = decreasePersonal ? user.personalCredit - amount : user.personalCredit;
    const newTotalCredit = newCompanyCredit + newPersonalCredit;

    // Determine transaction type
    const transactionType: CreditTransactionType = clearPersonalCredit
      ? CreditTransactionType.PERSONAL_CLEARANCE
      : CreditTransactionType.CREDIT_DECREASE;

    const actualCreditType: CreditType = decreasePersonal ? CreditType.PERSONAL : CreditType.COMPANY;

    const [transaction] = await db.$transaction([
      db.creditTransaction.create({
        data: {
          userId,
          transactionType,
          amount,
          paymentMode: paymentMode as PaymentModeType,
          creditType: actualCreditType,
          companyBalanceAfter: newCompanyCredit,
          personalBalanceAfter: newPersonalCredit,
          balanceAfter: newTotalCredit,
          sourceType: clearPersonalCredit ? 'PERSONAL_CLEARANCE' : 'SETTLEMENT',
          sourceId: settlementId,
          settlementId,
          chequeNumber,
          chequeDate: chequeDate ? new Date(chequeDate) : null,
          bankRefNumber,
          utrNumber,
          remarks,
          proofDocument,
          proofType,
          proofUploadedAt: proofDocument ? new Date() : null,
          proofVerified: true // Auto-verify clearance transactions
        }
      }),
      db.user.update({
        where: { id: userId },
        data: { 
          credit: newTotalCredit,
          companyCredit: newCompanyCredit,
          personalCredit: newPersonalCredit
        }
      })
    ]);

    return NextResponse.json({
      success: true,
      transaction,
      creditBreakdown: {
        companyCredit: newCompanyCredit,
        personalCredit: newPersonalCredit,
        totalCredit: newTotalCredit
      }
    });
  } catch (error) {
    console.error('Credit decrease error:', error);
    return NextResponse.json({ error: 'Failed to decrease credit' }, { status: 500 });
  }
}

// Helper function to update daily collection
async function updateDailyCollection(
  amount: number, 
  paymentMode: string, 
  role: string, 
  creditType: CreditType
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingRecord = await db.dailyCollection.findFirst({
    where: { date: today }
  });

  const modeField = paymentMode === 'CASH' ? 'totalCash' :
                    paymentMode === 'CHEQUE' ? 'totalCheque' : 'totalOnline';

  const roleField = role === 'SUPER_ADMIN' ? 'superAdminCollection' :
                    role === 'COMPANY' ? 'companyCollection' :
                    role === 'AGENT' ? 'agentCollection' :
                    role === 'STAFF' ? 'staffCollection' :
                    role === 'CASHIER' ? 'cashierCollection' : 'customerDirect';

  // Only count towards company totals if it's company credit (CASH)
  const shouldCountAsCompanyTotal = creditType === 'COMPANY';

  if (existingRecord) {
    await db.dailyCollection.update({
      where: { id: existingRecord.id },
      data: {
        [modeField]: { increment: amount },
        totalAmount: shouldCountAsCompanyTotal ? { increment: amount } : undefined,
        totalTransactions: { increment: 1 },
        emiPaymentsCount: { increment: 1 },
        [roleField]: { increment: amount }
      }
    });
  } else {
    await db.dailyCollection.create({
      data: {
        date: today,
        [modeField]: amount,
        totalAmount: shouldCountAsCompanyTotal ? amount : 0,
        totalTransactions: 1,
        emiPaymentsCount: 1,
        [roleField]: amount
      }
    });
  }
}
