import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { processBankTransaction } from '@/lib/bank-transaction-service';
import { EMIPaymentStatus } from '@prisma/client';

// Generate unique loan number
function generateLoanNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `OFF${dateStr}${random}`;
}

// GET - Fetch offline loans (All users can see all company loans)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const userRole = searchParams.get('userRole');
    const status = searchParams.get('status');
    const loanId = searchParams.get('loanId');
    const companyId = searchParams.get('companyId');

    // Get specific loan details
    if (loanId) {
      const loan = await db.offlineLoan.findUnique({
        where: { id: loanId },
        include: {
          emis: {
            orderBy: { installmentNumber: 'asc' }
          },
          company: { select: { id: true, name: true } }
        }
      });

      if (!loan) {
        return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
      }

      // Calculate summary
      const summary = {
        totalEMIs: loan.emis.length,
        paidEMIs: loan.emis.filter(e => e.paymentStatus === 'PAID').length,
        pendingEMIs: loan.emis.filter(e => e.paymentStatus === 'PENDING').length,
        overdueEMIs: loan.emis.filter(e => e.paymentStatus === 'OVERDUE').length,
        totalAmount: loan.emis.reduce((sum, e) => sum + e.totalAmount, 0),
        totalPaid: loan.emis.reduce((sum, e) => sum + e.paidAmount, 0),
        totalOutstanding: loan.emis.reduce((sum, e) => sum + (e.totalAmount - e.paidAmount), 0)
      };

      return NextResponse.json({ success: true, loan, summary });
    }

    // Get today's and tomorrow's EMIs to collect
    if (action === 'emi-to-collect') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);

      // Get all pending/overdue EMIs (NO CREATOR FILTERING - show all company loans)
      const whereClause: Record<string, unknown> = {
        paymentStatus: { in: ['PENDING', 'OVERDUE'] }
      };

      const emis = await db.offlineLoanEMI.findMany({
        where: whereClause,
        include: {
          offlineLoan: {
            select: {
              id: true,
              loanNumber: true,
              customerName: true,
              customerPhone: true,
              customerAddress: true,
              emiAmount: true,
              loanAmount: true,
              createdById: true,
              createdByRole: true,
              companyId: true
            }
          }
        },
        orderBy: { dueDate: 'asc' }
      });

      const todayEMIs = emis.filter(e => {
        const dueDate = new Date(e.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate.getTime() === today.getTime();
      });

      const tomorrowEMIs = emis.filter(e => {
        const dueDate = new Date(e.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate.getTime() === tomorrow.getTime();
      });

      const overdueEMIs = emis.filter(e => {
        const dueDate = new Date(e.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate.getTime() < today.getTime();
      });

      return NextResponse.json({
        success: true,
        todayEMIs,
        tomorrowEMIs,
        overdueEMIs,
        summary: {
          todayCount: todayEMIs.length,
          todayAmount: todayEMIs.reduce((sum, e) => sum + e.totalAmount, 0),
          tomorrowCount: tomorrowEMIs.length,
          tomorrowAmount: tomorrowEMIs.reduce((sum, e) => sum + e.totalAmount, 0),
          overdueCount: overdueEMIs.length,
          overdueAmount: overdueEMIs.reduce((sum, e) => sum + e.totalAmount, 0)
        }
      });
    }

    // Get EMI calendar view
    if (action === 'emi-calendar') {
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      const start = startDate ? new Date(startDate) : new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);

      const end = endDate ? new Date(endDate) : new Date(start);
      end.setMonth(end.getMonth() + 1);
      end.setHours(23, 59, 59, 999);

      const whereClause: Record<string, unknown> = {
        dueDate: { gte: start, lte: end }
      };

      const emis = await db.offlineLoanEMI.findMany({
        where: whereClause,
        include: {
          offlineLoan: {
            select: {
              loanNumber: true,
              customerName: true,
              customerPhone: true
            }
          }
        },
        orderBy: { dueDate: 'asc' }
      });

      // Group by date
      const calendar: Record<string, { emis: typeof emis; total: number; paid: number }> = {};
      
      for (const emi of emis) {
        const dateKey = new Date(emi.dueDate).toISOString().slice(0, 10);
        if (!calendar[dateKey]) {
          calendar[dateKey] = { emis: [], total: 0, paid: 0 };
        }
        calendar[dateKey].emis.push(emi);
        calendar[dateKey].total += emi.totalAmount;
        if (emi.paymentStatus === 'PAID') {
          calendar[dateKey].paid += emi.paidAmount;
        }
      }

      return NextResponse.json({ success: true, calendar });
    }

    // Get list of offline loans (ALL COMPANY LOANS - NO CREATOR FILTERING)
    const where: Record<string, unknown> = {};
    
    // NO LONGER FILTER BY CREATOR - Show all company loans to everyone
    // Only filter by status and company
    if (status) {
      where.status = status;
    }

    if (companyId) {
      where.companyId = companyId;
    }

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const [loans, total] = await Promise.all([
      db.offlineLoan.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { emis: true } },
          company: { select: { id: true, name: true, code: true } }
        }
      }),
      db.offlineLoan.count({ where })
    ]);

    // Calculate summary for each loan
    const loansWithSummary = await Promise.all(
      loans.map(async (loan) => {
        const emis = await db.offlineLoanEMI.findMany({
          where: { offlineLoanId: loan.id }
        });

        const paidCount = emis.filter(e => e.paymentStatus === 'PAID').length;
        const pendingCount = emis.filter(e => e.paymentStatus === 'PENDING').length;
        const overdueCount = emis.filter(e => e.paymentStatus === 'OVERDUE').length;

        return {
          ...loan,
          summary: {
            totalEMIs: emis.length,
            paidEMIs: paidCount,
            pendingEMIs: pendingCount,
            overdueEMIs: overdueCount,
            lastPaidEMI: paidCount > 0 ? emis.filter(e => e.paymentStatus === 'PAID').slice(-1)[0]?.paidDate : null,
            nextDueEMI: pendingCount > 0 ? emis.find(e => e.paymentStatus === 'PENDING')?.dueDate : null
          }
        };
      })
    );

    return NextResponse.json({
      success: true,
      loans: loansWithSummary,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Offline loan fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch offline loans' }, { status: 500 });
  }
}

// POST - Create a new offline loan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      createdById,
      createdByRole,
      companyId,
      // Customer details
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      customerAadhaar,
      customerPan,
      customerAddress,
      customerCity,
      customerState,
      customerPincode,
      customerDOB,
      customerOccupation,
      customerMonthlyIncome,
      // References
      reference1Name,
      reference1Phone,
      reference1Relation,
      reference2Name,
      reference2Phone,
      reference2Relation,
      // Loan details
      loanType,
      loanAmount,
      interestRate,
      tenure,
      emiAmount,
      processingFee,
      disbursementDate,
      disbursementMode,
      disbursementRef,
      startDate,
      notes,
      internalNotes
    } = body;

    // Validate required fields (COMPANY IS NOW REQUIRED)
    if (!createdById || !createdByRole || !customerName || !customerPhone ||
        !loanAmount || !interestRate || !tenure || !emiAmount || !disbursementDate || !startDate || !companyId) {
      return NextResponse.json({ error: 'Missing required fields (Company is required)' }, { status: 400 });
    }

    const loanNumber = generateLoanNumber();

    // Create loan
    const loan = await db.offlineLoan.create({
      data: {
        loanNumber,
        createdById,
        createdByRole,
        companyId,
        customerId,
        customerName,
        customerPhone,
        customerEmail,
        customerAadhaar,
        customerPan,
        customerAddress,
        customerCity,
        customerState,
        customerPincode,
        customerDOB: customerDOB ? new Date(customerDOB) : null,
        customerOccupation,
        customerMonthlyIncome,
        reference1Name,
        reference1Phone,
        reference1Relation,
        reference2Name,
        reference2Phone,
        reference2Relation,
        loanType: loanType || 'PERSONAL',
        loanAmount,
        interestRate,
        tenure,
        emiAmount,
        processingFee: processingFee || 0,
        disbursementDate: new Date(disbursementDate),
        disbursementMode,
        disbursementRef,
        status: 'ACTIVE',
        startDate: new Date(startDate),
        notes,
        internalNotes
      }
    });

    // Generate EMI schedule
    const emiStartDate = new Date(startDate);
    const emis: Array<{
      offlineLoanId: string;
      installmentNumber: number;
      dueDate: Date;
      principalAmount: number;
      interestAmount: number;
      totalAmount: number;
      outstandingPrincipal: number;
      paymentStatus: EMIPaymentStatus;
    }> = [];

    // Calculate principal per EMI and interest per EMI
    const monthlyInterestRate = interestRate / 100 / 12;
    const principalPerEmi = loanAmount / tenure;
    
    let outstandingPrincipal = loanAmount;

    for (let i = 1; i <= tenure; i++) {
      const dueDate = new Date(emiStartDate);
      dueDate.setMonth(dueDate.getMonth() + i);

      const interestAmount = outstandingPrincipal * monthlyInterestRate;
      const totalAmount = principalPerEmi + interestAmount;

      emis.push({
        offlineLoanId: loan.id,
        installmentNumber: i,
        dueDate,
        principalAmount: principalPerEmi,
        interestAmount,
        totalAmount,
        outstandingPrincipal,
        paymentStatus: EMIPaymentStatus.PENDING
      });

      outstandingPrincipal -= principalPerEmi;
    }

    // Create all EMIs
    await db.offlineLoanEMI.createMany({
      data: emis
    });

    // Create bank transaction for loan disbursement
    let bankTransactionResult: Awaited<ReturnType<typeof processBankTransaction>> | null = null;
    try {
      // Get default bank account for the company
      const defaultBank = await db.bankAccount.findFirst({
        where: { companyId, isDefault: true }
      });

      if (defaultBank) {
        bankTransactionResult = await processBankTransaction({
          bankAccountId: defaultBank.id,
          transactionType: 'LOAN_DISBURSEMENT',
          amount: loanAmount,
          description: `Offline Loan Disbursement - ${loanNumber} to ${customerName}`,
          referenceType: 'OFFLINE_LOAN',
          referenceId: loan.id,
          createdById,
          companyId,
          loanId: loan.id,
          customerId: customerId || undefined,
          paymentMode: disbursementMode || 'BANK_TRANSFER',
          bankRefNumber: disbursementRef
        });
      }
    } catch (bankError) {
      console.error('Bank transaction for loan disbursement failed:', bankError);
      // Don't fail the loan creation if bank transaction fails
    }

    // Log action for undo
    await db.actionLog.create({
      data: {
        userId: createdById,
        userRole: createdByRole,
        actionType: 'CREATE',
        module: 'OFFLINE_LOAN',
        recordId: loan.id,
        recordType: 'OfflineLoan',
        newData: JSON.stringify({
          loanNumber,
          customerName,
          loanAmount,
          companyId
        }),
        description: `Created offline loan ${loanNumber} for ${customerName}`,
        canUndo: true
      }
    });

    // Create notification
    await db.notification.create({
      data: {
        userId: createdById,
        type: 'OFFLINE_LOAN_CREATED',
        title: 'Offline Loan Created',
        message: `Offline loan ${loanNumber} created for ${customerName}. Amount: ₹${loanAmount}`,
        data: JSON.stringify({ loanId: loan.id, loanNumber })
      }
    });

    return NextResponse.json({
      success: true,
      loan,
      emiCount: emis.length,
      bankTransaction: bankTransactionResult ? {
        id: bankTransactionResult.bankTransactionId,
        balanceAfter: bankTransactionResult.balanceAfter
      } : null
    });
  } catch (error) {
    console.error('Offline loan creation error:', error);
    return NextResponse.json({ error: 'Failed to create offline loan' }, { status: 500 });
  }
}

// PUT - Update offline loan or pay EMI
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, loanId, emiId, userId, userRole } = body;

    // Pay EMI with partial payment support
    if (action === 'pay-emi' && emiId && userId) {
      const { paymentMode, paymentReference, amount, paymentType, bankAccountId, creditType } = body;
      // paymentType: 'FULL', 'PARTIAL', 'INTEREST_ONLY'
      // creditType: 'COMPANY', 'PERSONAL'

      const emi = await db.offlineLoanEMI.findUnique({
        where: { id: emiId },
        include: { offlineLoan: true }
      });

      if (!emi) {
        return NextResponse.json({ error: 'EMI not found' }, { status: 404 });
      }

      // Check if payment type is allowed for this loan
      if (paymentType === 'INTEREST_ONLY' && emi.offlineLoan.allowInterestOnly === false) {
        return NextResponse.json({ error: 'Interest-only payments are not allowed for this loan' }, { status: 400 });
      }
      if (paymentType === 'PARTIAL' && emi.offlineLoan.allowPartialPayment === false) {
        return NextResponse.json({ error: 'Partial payments are not allowed for this loan' }, { status: 400 });
      }

      // Get user details for credit
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, credit: true, companyCredit: true, personalCredit: true, role: true, name: true }
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Store previous state for undo
      const previousState = {
        paidAmount: emi.paidAmount,
        paidPrincipal: emi.paidPrincipal,
        paidInterest: emi.paidInterest,
        paymentStatus: emi.paymentStatus
      };

      let paidPrincipal = emi.paidPrincipal || 0;
      let paidInterest = emi.paidInterest || 0;
      let paidAmount = emi.paidAmount || 0;
      let paymentStatus = emi.paymentStatus;
      const now = new Date();

      // Calculate based on payment type
      if (paymentType === 'FULL') {
        paidAmount = emi.totalAmount;
        paidPrincipal = emi.principalAmount;
        paidInterest = emi.interestAmount;
        paymentStatus = 'PAID';
      } else if (paymentType === 'PARTIAL') {
        // Partial payment - distribute proportionally
        const remainingAmount = emi.totalAmount - paidAmount;
        const paymentRatio = amount / remainingAmount;
        paidPrincipal += emi.principalAmount * paymentRatio;
        paidInterest += emi.interestAmount * paymentRatio;
        paidAmount += amount;
        paymentStatus = paidAmount >= emi.totalAmount ? 'PAID' : 'PARTIALLY_PAID';
      } else if (paymentType === 'INTEREST_ONLY') {
        // Interest-only payment: collect interest, defer full EMI to end
        paidInterest = emi.interestAmount;
        paidAmount = emi.interestAmount;
        paidPrincipal = 0; // Principal is NOT paid
        paymentStatus = 'INTEREST_ONLY_PAID';
        // Note: A new deferred EMI will be created at the end of the schedule
      }

      const paymentAmount = amount || emi.totalAmount;
      
      // For interest-only, the payment amount is just the interest
      const actualPaymentAmount = paymentType === 'INTEREST_ONLY' ? emi.interestAmount : paymentAmount;
      
      // Update credit based on credit type selection
      let creditUpdateData: any = {};
      let creditTypeUsed = creditType || 'COMPANY';
      
      if (creditTypeUsed === 'COMPANY') {
        const newCompanyCredit = (user.companyCredit || 0) + actualPaymentAmount;
        creditUpdateData = { companyCredit: newCompanyCredit };
      } else {
        const newPersonalCredit = (user.personalCredit || 0) + actualPaymentAmount;
        creditUpdateData = { personalCredit: newPersonalCredit };
      }

      // Get company's default bank account if not provided
      let targetBankAccountId = bankAccountId;
      if (!targetBankAccountId && emi.offlineLoan.companyId) {
        const defaultBank = await db.bankAccount.findFirst({
          where: { companyId: emi.offlineLoan.companyId, isDefault: true }
        });
        if (defaultBank) {
          targetBankAccountId = defaultBank.id;
        }
      }

      // Process bank transaction for CASH payments (updates bank balance)
      let bankTransactionResult: Awaited<ReturnType<typeof processBankTransaction>> | null = null;
      if (paymentMode === 'CASH' && targetBankAccountId && emi.offlineLoan.companyId) {
        try {
          bankTransactionResult = await processBankTransaction({
            bankAccountId: targetBankAccountId,
            transactionType: 'EMI_PAYMENT',
            amount: actualPaymentAmount,
            description: `EMI #${emi.installmentNumber} collected for ${emi.offlineLoan.loanNumber} - ${paymentType}${paymentType === 'INTEREST_ONLY' ? ' (Interest Only - EMI Deferred)' : ''}`,
            referenceType: 'OFFLINE_EMI',
            referenceId: emiId,
            createdById: userId,
            companyId: emi.offlineLoan.companyId,
            loanId: emi.offlineLoanId,
            customerId: emi.offlineLoan.customerId || undefined,
            principalComponent: paidPrincipal,
            interestComponent: paidInterest,
            paymentMode: paymentMode || 'CASH',
            bankRefNumber: paymentReference
          });
        } catch (bankError) {
          console.error('Bank transaction failed (continuing without):', bankError);
          // Continue without bank transaction - don't fail the EMI payment
        }
      }

      // For Interest-Only: Create a deferred EMI at the end of the schedule
      let deferredEMI: Awaited<ReturnType<typeof db.offlineLoanEMI.create>> | null = null;
      if (paymentType === 'INTEREST_ONLY') {
        // Get the current highest installment number
        const lastEMI = await db.offlineLoanEMI.findFirst({
          where: { offlineLoanId: emi.offlineLoanId },
          orderBy: { installmentNumber: 'desc' }
        });
        
        const nextInstallmentNumber = (lastEMI?.installmentNumber || 0) + 1;
        
        // Calculate the due date for the deferred EMI (one month after the last EMI)
        const newDueDate = new Date(lastEMI?.dueDate || new Date());
        newDueDate.setMonth(newDueDate.getMonth() + 1);
        
        // Create deferred EMI with the full amount (principal + interest)
        deferredEMI = await db.offlineLoanEMI.create({
          data: {
            offlineLoanId: emi.offlineLoanId,
            installmentNumber: nextInstallmentNumber,
            dueDate: newDueDate,
            principalAmount: emi.principalAmount, // Same principal
            interestAmount: emi.interestAmount,   // Same interest
            totalAmount: emi.totalAmount,         // Full EMI amount
            outstandingPrincipal: emi.principalAmount, // Outstanding principal remains
            paymentStatus: 'PENDING',
            isDeferred: true, // Mark as deferred
            deferredFromEMI: emi.installmentNumber // Reference to original EMI
          }
        });
      }

      // Update EMI and add credit
      const [updatedEmi] = await db.$transaction([
        db.offlineLoanEMI.update({
          where: { id: emiId },
          data: {
            paidAmount,
            paidPrincipal,
            paidInterest,
            paymentStatus,
            paidDate: now,
            paymentMode,
            paymentReference,
            collectedById: userId,
            collectedByName: user.name,
            collectedAt: now
          }
        }),
        db.user.update({
          where: { id: userId },
          data: creditUpdateData
        }),
        db.creditTransaction.create({
          data: {
            userId,
            transactionType: 'CREDIT_INCREASE',
            amount: paymentAmount,
            paymentMode: paymentMode || 'CASH',
            creditType: creditTypeUsed,
            companyBalanceAfter: creditTypeUsed === 'COMPANY' ? (user.companyCredit || 0) + paymentAmount : user.companyCredit,
            personalBalanceAfter: creditTypeUsed === 'PERSONAL' ? (user.personalCredit || 0) + paymentAmount : user.personalCredit,
            balanceAfter: (user.credit || 0) + paymentAmount,
            sourceType: 'EMI_PAYMENT',
            sourceId: emi.id,
            description: `EMI #${emi.installmentNumber} collected for ${emi.offlineLoan.loanNumber} (${creditTypeUsed} credit)`,
            loanApplicationNo: emi.offlineLoan.loanNumber,
            emiDueDate: emi.dueDate,
            emiAmount: emi.totalAmount,
            principalComponent: paidPrincipal,
            interestComponent: paidInterest,
            collectedFrom: emi.offlineLoan.customerName,
            collectedFromPhone: emi.offlineLoan.customerPhone
          }
        }),
        // Log action for undo
        db.actionLog.create({
          data: {
            userId,
            userRole: user.role,
            actionType: 'PAY',
            module: 'EMI_PAYMENT',
            recordId: emiId,
            recordType: 'OfflineLoanEMI',
            previousData: JSON.stringify(previousState),
            newData: JSON.stringify({
              paidAmount,
              paidPrincipal,
              paidInterest,
              paymentStatus,
              paymentAmount,
              collectorId: userId,
              collectorName: user.name,
              paymentMode,
              bankTransactionId: bankTransactionResult?.bankTransactionId
            }),
            description: `Collected EMI #${emi.installmentNumber} for ${emi.offlineLoan.loanNumber}`,
            canUndo: true
          }
        })
      ]);

      // Check if all EMIs are paid
      const allEmis = await db.offlineLoanEMI.findMany({
        where: { offlineLoanId: emi.offlineLoanId }
      });

      const allPaid = allEmis.every(e => e.paymentStatus === 'PAID');

      if (allPaid) {
        await db.offlineLoan.update({
          where: { id: emi.offlineLoanId },
          data: { status: 'CLOSED', closedAt: new Date() }
        });
      }

      return NextResponse.json({
        success: true,
        emi: updatedEmi,
        creditAdded: paymentAmount,
        creditType: creditTypeUsed,
        newCompanyCredit: creditTypeUsed === 'COMPANY' ? (user.companyCredit || 0) + paymentAmount : user.companyCredit,
        newPersonalCredit: creditTypeUsed === 'PERSONAL' ? (user.personalCredit || 0) + paymentAmount : user.personalCredit,
        bankTransaction: bankTransactionResult ? {
          id: bankTransactionResult.bankTransactionId,
          balanceAfter: bankTransactionResult.balanceAfter
        } : null
      });
    }

    // Update loan status
    if (action === 'update-status' && loanId) {
      const { status } = body;

      const loan = await db.offlineLoan.update({
        where: { id: loanId },
        data: { status }
      });

      return NextResponse.json({ success: true, loan });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Offline loan update error:', error);
    return NextResponse.json({ error: 'Failed to update offline loan' }, { status: 500 });
  }
}

// DELETE - Delete offline loan (SuperAdmin only)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const loanId = searchParams.get('loanId');
    const userRole = searchParams.get('userRole');

    if (!loanId) {
      return NextResponse.json({ error: 'Loan ID is required' }, { status: 400 });
    }

    // Only SuperAdmin can delete
    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only SuperAdmin can delete offline loans' }, { status: 403 });
    }

    // Check if any EMIs are paid
    const paidEmis = await db.offlineLoanEMI.count({
      where: { offlineLoanId: loanId, paymentStatus: 'PAID' }
    });

    if (paidEmis > 0) {
      return NextResponse.json({
        error: 'Cannot delete loan with paid EMIs'
      }, { status: 400 });
    }

    // Get loan details before deletion for undo
    const loan = await db.offlineLoan.findUnique({
      where: { id: loanId },
      include: {
        emis: true
      }
    });

    // Delete EMIs first
    await db.offlineLoanEMI.deleteMany({
      where: { offlineLoanId: loanId }
    });

    // Delete loan
    await db.offlineLoan.delete({
      where: { id: loanId }
    });

    // Log action for undo (soft delete approach - can restore)
    await db.actionLog.create({
      data: {
        userId: searchParams.get('userId') || 'system',
        userRole: userRole,
        actionType: 'DELETE',
        module: 'OFFLINE_LOAN',
        recordId: loanId,
        recordType: 'OfflineLoan',
        previousData: JSON.stringify(loan),
        description: `Deleted offline loan ${loan?.loanNumber}`,
        canUndo: true
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Offline loan delete error:', error);
    return NextResponse.json({ error: 'Failed to delete offline loan' }, { status: 500 });
  }
}
