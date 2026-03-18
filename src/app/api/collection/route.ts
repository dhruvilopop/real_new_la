import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PaymentModeType } from '@prisma/client';

// GET - Fetch daily collection data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const dateStr = searchParams.get('date');
    const companyId = searchParams.get('companyId');

    // Get today's collection summary
    if (action === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayCollection = await db.dailyCollection.findFirst({
        where: { date: today }
      });

      // If no record exists, calculate from transactions
      if (!todayCollection) {
        const todayTransactions = await db.creditTransaction.findMany({
          where: {
            createdAt: { gte: today },
            transactionType: 'CREDIT_INCREASE'
          },
          include: {
            user: { select: { role: true } }
          }
        });

        const summary = {
          date: today,
          totalCash: todayTransactions.filter(t => t.paymentMode === 'CASH').reduce((sum, t) => sum + t.amount, 0),
          totalCheque: todayTransactions.filter(t => t.paymentMode === 'CHEQUE').reduce((sum, t) => sum + t.amount, 0),
          totalOnline: todayTransactions.filter(t => t.paymentMode === 'ONLINE' || t.paymentMode === 'UPI' || t.paymentMode === 'BANK_TRANSFER').reduce((sum, t) => sum + t.amount, 0),
          totalAmount: todayTransactions.reduce((sum, t) => sum + t.amount, 0),
          totalTransactions: todayTransactions.length,
          emiPaymentsCount: todayTransactions.filter(t => t.sourceType === 'EMI_PAYMENT').length,
          settlementsCount: 0,
          superAdminCollection: todayTransactions.filter(t => t.user?.role === 'SUPER_ADMIN').reduce((sum, t) => sum + t.amount, 0),
          companyCollection: todayTransactions.filter(t => t.user?.role === 'COMPANY').reduce((sum, t) => sum + t.amount, 0),
          agentCollection: todayTransactions.filter(t => t.user?.role === 'AGENT').reduce((sum, t) => sum + t.amount, 0),
          staffCollection: todayTransactions.filter(t => t.user?.role === 'STAFF').reduce((sum, t) => sum + t.amount, 0),
          cashierCollection: todayTransactions.filter(t => t.user?.role === 'CASHIER').reduce((sum, t) => sum + t.amount, 0),
          customerDirect: todayTransactions.filter(t => t.user?.role === 'CUSTOMER').reduce((sum, t) => sum + t.amount, 0)
        };

        return NextResponse.json({ success: true, collection: summary, fromTransactions: true });
      }

      return NextResponse.json({ success: true, collection: todayCollection });
    }

    // Get collection history
    if (action === 'history') {
      const days = parseInt(searchParams.get('days') || '7');
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const collections = await db.dailyCollection.findMany({
        where: {
          date: { gte: startDate }
        },
        orderBy: { date: 'desc' }
      });

      return NextResponse.json({ success: true, collections, days });
    }

    // Get monthly summary
    if (action === 'monthly') {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const [currentMonth, previousMonth] = await Promise.all([
        db.dailyCollection.findMany({
          where: { date: { gte: startOfMonth } }
        }),
        db.dailyCollection.findMany({
          where: {
            date: { gte: startOfPrevMonth, lt: startOfMonth }
          }
        })
      ]);

      const currentMonthTotal = currentMonth.reduce((sum, c) => sum + c.totalAmount, 0);
      const previousMonthTotal = previousMonth.reduce((sum, c) => sum + c.totalAmount, 0);

      const summary = {
        currentMonth: {
          total: currentMonthTotal,
          cash: currentMonth.reduce((sum, c) => sum + c.totalCash, 0),
          cheque: currentMonth.reduce((sum, c) => sum + c.totalCheque, 0),
          online: currentMonth.reduce((sum, c) => sum + c.totalOnline, 0),
          transactions: currentMonth.reduce((sum, c) => sum + c.totalTransactions, 0),
          days: currentMonth.length
        },
        previousMonth: {
          total: previousMonthTotal,
          days: previousMonth.length
        },
        growth: previousMonthTotal > 0 ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal * 100).toFixed(2) : 0
      };

      return NextResponse.json({ success: true, summary });
    }

    // Get specific date collection
    if (dateStr) {
      const date = new Date(dateStr);
      date.setHours(0, 0, 0, 0);

      const collection = await db.dailyCollection.findFirst({
        where: { date }
      });

      // Get detailed breakdown
      const transactions = await db.creditTransaction.findMany({
        where: {
          createdAt: {
            gte: date,
            lt: new Date(date.getTime() + 24 * 60 * 60 * 1000)
          },
          transactionType: 'CREDIT_INCREASE'
        },
        include: {
          user: { select: { id: true, name: true, role: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      return NextResponse.json({
        success: true,
        collection,
        transactions
      });
    }

    // Get all users' credit summary
    if (action === 'credits-summary') {
      const users = await db.user.findMany({
        where: {
          role: { in: ['SUPER_ADMIN', 'COMPANY', 'AGENT', 'STAFF', 'CASHIER'] },
          isActive: true
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          credit: true
        },
        orderBy: { credit: 'desc' }
      });

      const totalCredit = users.reduce((sum, u) => sum + u.credit, 0);

      return NextResponse.json({
        success: true,
        users,
        totalCredit,
        usersWithCredit: users.filter(u => u.credit > 0).length
      });
    }

    // Default: get recent collections
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (companyId) where.companyId = companyId;

    const [collections, total] = await Promise.all([
      db.dailyCollection.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit
      }),
      db.dailyCollection.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      collections,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Collection fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch collection data' }, { status: 500 });
  }
}
