import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SettlementStatus, PaymentModeType, CreditTransactionType } from '@prisma/client';
import { createSettlementEntry } from '@/lib/accounting-service';

// Generate unique settlement number
function generateSettlementNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SET${dateStr}${random}`;
}

// GET - Fetch settlements
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const cashierId = searchParams.get('cashierId');
    const status = searchParams.get('status');

    // Get pending settlements for cashier to receive
    if (action === 'pending') {
      const pendingSettlements = await db.cashierSettlement.findMany({
        where: { status: SettlementStatus.PENDING },
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, role: true, credit: true } }
        }
      });
      return NextResponse.json({ success: true, settlements: pendingSettlements });
    }

    // Get settlements by user (who gave money)
    if (userId) {
      const settlements = await db.cashierSettlement.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          cashier: { select: { id: true, name: true, role: true } }
        }
      });
      return NextResponse.json({ success: true, settlements });
    }

    // Get settlements received by cashier
    if (cashierId) {
      const settlements = await db.cashierSettlement.findMany({
        where: { cashierId },
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } }
        }
      });
      return NextResponse.json({ success: true, settlements });
    }

    // Get all settlements (for accountant/super admin)
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const [settlements, total] = await Promise.all([
      db.cashierSettlement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          cashier: { select: { id: true, name: true, role: true } }
        }
      }),
      db.cashierSettlement.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      settlements,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Settlement fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch settlements' }, { status: 500 });
  }
}

// POST - Create a new settlement (role wants to give money to cashier)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      cashierId,
      amount,
      paymentMode,
      chequeNumber,
      chequeDate,
      bankRefNumber,
      utrNumber,
      cashDenominations,
      remarks
    } = body;

    if (!userId || !cashierId || !amount || !paymentMode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate user has enough credit
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { credit: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.credit < amount) {
      return NextResponse.json({
        error: 'Insufficient credit balance',
        currentCredit: user.credit,
        requestedAmount: amount
      }, { status: 400 });
    }

    // Validate cashier exists
    const cashier = await db.user.findUnique({
      where: { id: cashierId },
      select: { id: true, role: true }
    });

    if (!cashier || cashier.role !== 'CASHIER') {
      return NextResponse.json({ error: 'Invalid cashier' }, { status: 400 });
    }

    const settlementNumber = generateSettlementNumber();

    // Create settlement and decrease user's credit
    const [settlement, creditTx] = await db.$transaction([
      db.cashierSettlement.create({
        data: {
          settlementNumber,
          userId,
          cashierId,
          amount,
          paymentMode: paymentMode as PaymentModeType,
          chequeNumber,
          chequeDate: chequeDate ? new Date(chequeDate) : null,
          bankRefNumber,
          utrNumber,
          cashDenominations,
          remarks
        }
      }),
      db.user.update({
        where: { id: userId },
        data: { credit: { decrement: amount } }
      }),
      db.creditTransaction.create({
        data: {
          userId,
          transactionType: CreditTransactionType.CREDIT_DECREASE,
          amount,
          paymentMode: paymentMode as PaymentModeType,
          balanceAfter: user.credit - amount,
          sourceType: 'SETTLEMENT',
          remarks: `Settlement ${settlementNumber}`
        }
      })
    ]);

    // Update credit transaction with settlement ID
    await db.creditTransaction.update({
      where: { id: creditTx.id },
      data: { settlementId: settlement.id }
    });

    // Update daily collection
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const existingRecord = await db.dailyCollection.findFirst({
      where: { date: today }
    });

    if (existingRecord) {
      await db.dailyCollection.update({
        where: { id: existingRecord.id },
        data: {
          settlementsCount: { increment: 1 }
        }
      });
    }

    return NextResponse.json({
      success: true,
      settlement: {
        ...settlement,
        creditTx
      },
      newCreditBalance: user.credit - amount
    });
  } catch (error) {
    console.error('Settlement creation error:', error);
    return NextResponse.json({ error: 'Failed to create settlement' }, { status: 500 });
  }
}

// PUT - Update settlement status (cashier/accountant verifies)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { settlementId, action, verifiedById, rejectionReason } = body;

    if (!settlementId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const settlement = await db.cashierSettlement.findUnique({
      where: { id: settlementId },
      include: { user: { select: { id: true, credit: true } } }
    });

    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    if (action === 'verify') {
      // Cashier verifies they received the money
      const updatedSettlement = await db.cashierSettlement.update({
        where: { id: settlementId },
        data: {
          status: SettlementStatus.VERIFIED,
          verifiedById,
          verifiedAt: new Date()
        }
      });

      return NextResponse.json({ success: true, settlement: updatedSettlement });
    }

    if (action === 'complete') {
      // Accountant marks as completed
      const updatedSettlement = await db.cashierSettlement.update({
        where: { id: settlementId },
        data: {
          status: SettlementStatus.COMPLETED
        }
      });

      // Create accounting entry for settlement
      try {
        const settlementUser = await db.user.findUnique({
          where: { id: settlement.userId },
          select: { companyId: true }
        });
        
        if (settlementUser?.companyId) {
          await createSettlementEntry({
            companyId: settlementUser.companyId,
            settlementId: settlement.id,
            fromUserId: settlement.userId,
            toUserId: settlement.cashierId,
            amount: settlement.amount,
            paymentMode: settlement.paymentMode,
            settlementDate: new Date(),
            createdById: verifiedById || settlement.cashierId
          });
        }
      } catch (accountingError) {
        console.error('Settlement accounting entry failed:', accountingError);
        // Don't fail the settlement if accounting fails
      }

      // Add credit transaction for cashier (they received the money)
      const cashier = await db.user.findUnique({
        where: { id: settlement.cashierId },
        select: { credit: true, role: true }
      });

      if (cashier) {
        await db.$transaction([
          db.creditTransaction.create({
            data: {
              userId: settlement.cashierId,
              transactionType: CreditTransactionType.SETTLEMENT,
              amount: settlement.amount,
              paymentMode: settlement.paymentMode,
              balanceAfter: cashier.credit + settlement.amount,
              sourceType: 'SETTLEMENT',
              sourceId: settlementId,
              settlementId: settlementId,
              description: `Received from ${settlement.user?.id || 'user'}`
            }
          }),
          db.user.update({
            where: { id: settlement.cashierId },
            data: { credit: { increment: settlement.amount } }
          })
        ]);
      }

      return NextResponse.json({ success: true, settlement: updatedSettlement });
    }

    if (action === 'reject') {
      // Rejected - return credit to user
      const updatedSettlement = await db.cashierSettlement.update({
        where: { id: settlementId },
        data: {
          status: SettlementStatus.REJECTED,
          rejectionReason
        }
      });

      // Return credit to user
      await db.$transaction([
        db.creditTransaction.create({
          data: {
            userId: settlement.userId,
            transactionType: CreditTransactionType.ADJUSTMENT,
            amount: settlement.amount,
            paymentMode: settlement.paymentMode,
            balanceAfter: (settlement.user?.credit || 0) + settlement.amount,
            sourceType: 'SETTLEMENT',
            sourceId: settlementId,
            settlementId: settlementId,
            description: 'Settlement rejected - credit returned',
            remarks: rejectionReason
          }
        }),
        db.user.update({
          where: { id: settlement.userId },
          data: { credit: { increment: settlement.amount } }
        })
      ]);

      return NextResponse.json({ success: true, settlement: updatedSettlement });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Settlement update error:', error);
    return NextResponse.json({ error: 'Failed to update settlement' }, { status: 500 });
  }
}
