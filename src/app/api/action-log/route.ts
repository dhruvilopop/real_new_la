import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch action logs for a user (for undo/redo)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const userRole = searchParams.get('userRole');
    const recordId = searchParams.get('recordId');
    const moduleType = searchParams.get('module');

    // Get undoable actions for a user
    if (action === 'undoable') {
      if (!userId) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 });
      }

      const actions = await db.actionLog.findMany({
        where: {
          userId,
          canUndo: true,
          isUndone: false,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      return NextResponse.json({ success: true, actions });
    }

    // Get redoable actions for a user
    if (action === 'redoable') {
      if (!userId) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 });
      }

      const actions = await db.actionLog.findMany({
        where: {
          userId,
          canRedo: true,
          isUndone: true,
          isRedone: false,
          undoneAt: {
            gte: new Date(Date.now() - 1 * 60 * 60 * 1000) // Last 1 hour
          }
        },
        orderBy: { undoneAt: 'desc' },
        take: 10
      });

      return NextResponse.json({ success: true, actions });
    }

    // Get action history
    if (action === 'history') {
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {};
      
      if (userId) where.userId = userId;
      if (moduleType) where.module = moduleType;
      if (recordId) where.recordId = recordId;
      
      // Non-super-admin can only see their own actions
      if (userRole !== 'SUPER_ADMIN' && userId) {
        where.userId = userId;
      }

      const [actions, total] = await Promise.all([
        db.actionLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        db.actionLog.count({ where })
      ]);

      return NextResponse.json({
        success: true,
        actions,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Action log fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch action logs' }, { status: 500 });
  }
}

// POST - Log a new action
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      userRole,
      actionType,
      module: moduleValue,
      recordId,
      recordType,
      previousData,
      newData,
      description,
      canUndo = true
    } = body;

    if (!userId || !actionType || !moduleValue || !recordId || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const actionLog = await db.actionLog.create({
      data: {
        userId,
        userRole: userRole || 'UNKNOWN',
        actionType,
        module: moduleValue,
        recordId,
        recordType: recordType || moduleValue,
        previousData: previousData ? JSON.stringify(previousData) : null,
        newData: newData ? JSON.stringify(newData) : null,
        description,
        canUndo
      }
    });

    return NextResponse.json({ success: true, actionLog });
  } catch (error) {
    console.error('Action log creation error:', error);
    return NextResponse.json({ error: 'Failed to create action log' }, { status: 500 });
  }
}

// PUT - Undo or Redo an action
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, actionLogId, userId } = body;

    if (!actionLogId || !userId) {
      return NextResponse.json({ error: 'actionLogId and userId are required' }, { status: 400 });
    }

    const actionLog = await db.actionLog.findUnique({
      where: { id: actionLogId }
    });

    if (!actionLog) {
      return NextResponse.json({ error: 'Action log not found' }, { status: 404 });
    }

    // Verify ownership
    if (actionLog.userId !== userId) {
      return NextResponse.json({ error: 'You can only undo/redo your own actions' }, { status: 403 });
    }

    // UNDO ACTION
    if (action === 'undo') {
      if (!actionLog.canUndo || actionLog.isUndone) {
        return NextResponse.json({ error: 'This action cannot be undone' }, { status: 400 });
      }

      const previousData = actionLog.previousData ? JSON.parse(actionLog.previousData) : null;
      
      // Perform the undo based on module and action type
      let undoResult: { type: string; recordId: string } | null = null;

      switch (actionLog.module) {
        case 'OFFLINE_LOAN':
          if (actionLog.actionType === 'CREATE') {
            // Undo loan creation - mark as closed
            await db.offlineLoan.update({
              where: { id: actionLog.recordId },
              data: { status: 'CLOSED' }
            });
            // Delete EMIs
            await db.offlineLoanEMI.deleteMany({
              where: { offlineLoanId: actionLog.recordId }
            });
            undoResult = { type: 'loan_deleted', recordId: actionLog.recordId };
          } else if (actionLog.actionType === 'DELETE' && previousData) {
            // Restore deleted loan
            await db.offlineLoan.update({
              where: { id: actionLog.recordId },
              data: { status: previousData.status || 'ACTIVE' }
            });
            undoResult = { type: 'loan_restored', recordId: actionLog.recordId };
          } else if (actionLog.actionType === 'UPDATE' && previousData) {
            // Revert update
            await db.offlineLoan.update({
              where: { id: actionLog.recordId },
              data: previousData
            });
            undoResult = { type: 'loan_reverted', recordId: actionLog.recordId };
          }
          break;

        case 'EMI_PAYMENT':
          if (actionLog.actionType === 'PAY' && previousData) {
            // Revert EMI payment
            const emiData = previousData;
            await db.offlineLoanEMI.update({
              where: { id: actionLog.recordId },
              data: {
                paidAmount: emiData.paidAmount || 0,
                paidPrincipal: emiData.paidPrincipal || 0,
                paidInterest: emiData.paidInterest || 0,
                paymentStatus: emiData.paymentStatus || 'PENDING',
                paidDate: null,
                paymentMode: null,
                collectedById: null,
                collectedByName: null,
                collectedAt: null
              }
            });

            // Revert credit
            if (actionLog.newData) {
              const newData = JSON.parse(actionLog.newData);
              if (newData.collectorId && newData.paymentAmount) {
                const user = await db.user.findUnique({
                  where: { id: newData.collectorId },
                  select: { credit: true }
                });
                await db.user.update({
                  where: { id: newData.collectorId },
                  data: { credit: Math.max(0, (user?.credit || 0) - newData.paymentAmount) }
                });
              }
            }
            undoResult = { type: 'payment_reverted', recordId: actionLog.recordId };
          }
          break;

        case 'SETTLEMENT':
          if (actionLog.actionType === 'CREATE' && previousData) {
            // Revert settlement
            await db.cashierSettlement.update({
              where: { id: actionLog.recordId },
              data: { status: 'REJECTED' }
            });
            // Restore user credit
            const settlement = await db.cashierSettlement.findUnique({
              where: { id: actionLog.recordId }
            });
            if (settlement) {
              const user = await db.user.findUnique({
                where: { id: settlement.userId },
                select: { credit: true }
              });
              await db.user.update({
                where: { id: settlement.userId },
                data: { credit: (user?.credit || 0) + settlement.amount }
              });
            }
            undoResult = { type: 'settlement_reverted', recordId: actionLog.recordId };
          }
          break;
      }

      // Mark action as undone
      await db.actionLog.update({
        where: { id: actionLogId },
        data: {
          isUndone: true,
          undoneAt: new Date(),
          undoneById: userId,
          canRedo: true
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Action undone successfully',
        undoResult
      });
    }

    // REDO ACTION
    if (action === 'redo') {
      if (!actionLog.canRedo || !actionLog.isUndone || actionLog.isRedone) {
        return NextResponse.json({ error: 'This action cannot be redone' }, { status: 400 });
      }

      const newData = actionLog.newData ? JSON.parse(actionLog.newData) : null;

      // Perform the redo based on module and action type
      let redoResult: { type: string; recordId: string } | null = null;

      switch (actionLog.module) {
        case 'OFFLINE_LOAN':
          if (actionLog.actionType === 'CREATE') {
            // Restore loan
            await db.offlineLoan.update({
              where: { id: actionLog.recordId },
              data: { status: 'ACTIVE' }
            });
            redoResult = { type: 'loan_restored', recordId: actionLog.recordId };
          } else if (actionLog.actionType === 'UPDATE' && newData) {
            // Re-apply update
            await db.offlineLoan.update({
              where: { id: actionLog.recordId },
              data: newData
            });
            redoResult = { type: 'loan_updated', recordId: actionLog.recordId };
          }
          break;

        case 'EMI_PAYMENT':
          if (actionLog.actionType === 'PAY' && newData) {
            // Re-apply payment
            await db.offlineLoanEMI.update({
              where: { id: actionLog.recordId },
              data: {
                paidAmount: newData.paidAmount,
                paidPrincipal: newData.paidPrincipal,
                paidInterest: newData.paidInterest,
                paymentStatus: newData.paymentStatus,
                paidDate: new Date(),
                paymentMode: newData.paymentMode,
                collectedById: newData.collectorId,
                collectedByName: newData.collectorName,
                collectedAt: new Date()
              }
            });

            // Re-add credit
            if (newData.collectorId && newData.paymentAmount) {
              const user = await db.user.findUnique({
                where: { id: newData.collectorId },
                select: { credit: true }
              });
              await db.user.update({
                where: { id: newData.collectorId },
                data: { credit: (user?.credit || 0) + newData.paymentAmount }
              });
            }
            redoResult = { type: 'payment_applied', recordId: actionLog.recordId };
          }
          break;
      }

      // Mark action as redone
      await db.actionLog.update({
        where: { id: actionLogId },
        data: {
          isRedone: true,
          redoneAt: new Date(),
          redoneById: userId,
          canRedo: false
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Action redone successfully',
        redoResult
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Action undo/redo error:', error);
    return NextResponse.json({ error: 'Failed to process undo/redo' }, { status: 500 });
  }
}
