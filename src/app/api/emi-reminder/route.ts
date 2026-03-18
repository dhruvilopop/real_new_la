import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Get EMI reminders for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const userRole = searchParams.get('userRole');

    if (!userId || !userRole) {
      return NextResponse.json({ error: 'userId and userRole are required' }, { status: 400 });
    }

    // Get today's and tomorrow's EMIs (both online and offline)
    if (action === 'today-tomorrow') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);

      // Get online loan EMIs
      const onlineEmiWhere: Record<string, unknown> = {
        paymentStatus: { in: ['PENDING', 'OVERDUE'] }
      };

      // For agents, filter by their loans
      if (userRole === 'AGENT') {
        onlineEmiWhere.loanApplication = {
          sessionForm: { agentId: userId }
        };
      }

      const onlineEmis = await db.eMISchedule.findMany({
        where: onlineEmiWhere,
        include: {
          loanApplication: {
            select: {
              id: true,
              applicationNo: true,
              firstName: true,
              lastName: true,
              phone: true,
              address: true
            }
          }
        }
      });

      // Get offline loan EMIs
      const offlineEmiWhere: Record<string, unknown> = {
        paymentStatus: { in: ['PENDING', 'OVERDUE'] }
      };

      if (userRole === 'AGENT') {
        offlineEmiWhere.offlineLoan = { createdById: userId };
      }

      const offlineEmis = await db.offlineLoanEMI.findMany({
        where: offlineEmiWhere,
        include: {
          offlineLoan: {
            select: {
              id: true,
              loanNumber: true,
              customerName: true,
              customerPhone: true,
              customerAddress: true
            }
          }
        }
      });

      // Categorize EMIs
      const todayEmis = {
        online: onlineEmis.filter(e => {
          const dueDate = new Date(e.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate.getTime() === today.getTime();
        }),
        offline: offlineEmis.filter(e => {
          const dueDate = new Date(e.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate.getTime() === today.getTime();
        })
      };

      const tomorrowEmis = {
        online: onlineEmis.filter(e => {
          const dueDate = new Date(e.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate.getTime() === tomorrow.getTime();
        }),
        offline: offlineEmis.filter(e => {
          const dueDate = new Date(e.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate.getTime() === tomorrow.getTime();
        })
      };

      const overdueEmis = {
        online: onlineEmis.filter(e => {
          const dueDate = new Date(e.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate.getTime() < today.getTime();
        }),
        offline: offlineEmis.filter(e => {
          const dueDate = new Date(e.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate.getTime() < today.getTime();
        })
      };

      // Calculate totals
      const summary = {
        today: {
          count: todayEmis.online.length + todayEmis.offline.length,
          amount: [...todayEmis.online, ...todayEmis.offline].reduce((sum, e) => sum + e.totalAmount, 0)
        },
        tomorrow: {
          count: tomorrowEmis.online.length + tomorrowEmis.offline.length,
          amount: [...tomorrowEmis.online, ...tomorrowEmis.offline].reduce((sum, e) => sum + e.totalAmount, 0)
        },
        overdue: {
          count: overdueEmis.online.length + overdueEmis.offline.length,
          amount: [...overdueEmis.online, ...overdueEmis.offline].reduce((sum, e) => sum + e.totalAmount, 0)
        }
      };

      return NextResponse.json({
        success: true,
        todayEmis,
        tomorrowEmis,
        overdueEmis,
        summary
      });
    }

    // Get calendar view
    if (action === 'calendar') {
      const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
      const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // Get online EMIs
      const onlineEmiWhere: Record<string, unknown> = {
        dueDate: { gte: startDate, lte: endDate }
      };

      if (userRole === 'AGENT') {
        onlineEmiWhere.loanApplication = {
          sessionForm: { agentId: userId }
        };
      }

      const onlineEmis = await db.eMISchedule.findMany({
        where: onlineEmiWhere,
        include: {
          loanApplication: {
            select: {
              applicationNo: true,
              firstName: true,
              lastName: true,
              phone: true
            }
          }
        }
      });

      // Get offline EMIs
      const offlineEmiWhere: Record<string, unknown> = {
        dueDate: { gte: startDate, lte: endDate }
      };

      if (userRole === 'AGENT') {
        offlineEmiWhere.offlineLoan = { createdById: userId };
      }

      const offlineEmis = await db.offlineLoanEMI.findMany({
        where: offlineEmiWhere,
        include: {
          offlineLoan: {
            select: {
              loanNumber: true,
              customerName: true,
              customerPhone: true
            }
          }
        }
      });

      // Group by date
      interface CalendarDay {
        date: string;
        online: typeof onlineEmis;
        offline: typeof offlineEmis;
        total: number;
        paid: number;
      }

      const calendar: Record<string, CalendarDay> = {};

      for (const emi of onlineEmis) {
        const dateKey = new Date(emi.dueDate).toISOString().slice(0, 10);
        if (!calendar[dateKey]) {
          calendar[dateKey] = { date: dateKey, online: [], offline: [], total: 0, paid: 0 };
        }
        calendar[dateKey].online.push(emi);
        calendar[dateKey].total += emi.totalAmount;
        if (emi.paymentStatus === 'PAID') {
          calendar[dateKey].paid += emi.paidAmount;
        }
      }

      for (const emi of offlineEmis) {
        const dateKey = new Date(emi.dueDate).toISOString().slice(0, 10);
        if (!calendar[dateKey]) {
          calendar[dateKey] = { date: dateKey, online: [], offline: [], total: 0, paid: 0 };
        }
        calendar[dateKey].offline.push(emi);
        calendar[dateKey].total += emi.totalAmount;
        if (emi.paymentStatus === 'PAID') {
          calendar[dateKey].paid += emi.paidAmount;
        }
      }

      // Convert to array and sort
      const calendarArray = Object.values(calendar).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      return NextResponse.json({
        success: true,
        year,
        month,
        calendar: calendarArray
      });
    }

    // Get reminder history
    if (action === 'history') {
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const skip = (page - 1) * limit;

      const [reminders, total] = await Promise.all([
        db.eMIReminderLog.findMany({
          where: { userId },
          orderBy: { sentAt: 'desc' },
          skip,
          take: limit
        }),
        db.eMIReminderLog.count({ where: { userId } })
      ]);

      return NextResponse.json({
        success: true,
        reminders,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    }

    // Get all EMIs to collect (for SuperAdmin view)
    if (action === 'all-to-collect') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);

      // Get all pending/overdue EMIs
      const [onlineEmis, offlineEmis] = await Promise.all([
        db.eMISchedule.findMany({
          where: {
            paymentStatus: { in: ['PENDING', 'OVERDUE'] },
            dueDate: { lt: dayAfter }
          },
          include: {
            loanApplication: {
              select: {
                id: true,
                applicationNo: true,
                firstName: true,
                lastName: true,
                phone: true,
                address: true
              }
            }
          }
        }),
        db.offlineLoanEMI.findMany({
          where: {
            paymentStatus: { in: ['PENDING', 'OVERDUE'] },
            dueDate: { lt: dayAfter }
          },
          include: {
            offlineLoan: {
              select: {
                id: true,
                loanNumber: true,
                customerName: true,
                customerPhone: true,
                customerAddress: true,
                createdById: true,
                createdByRole: true
              }
            }
          }
        })
      ]);

      // Group by creator for offline loans
      const groupedByCreator = offlineEmis.reduce((acc, emi) => {
        const creatorId = emi.offlineLoan.createdById;
        if (!acc[creatorId]) {
          acc[creatorId] = [];
        }
        acc[creatorId].push(emi);
        return acc;
      }, {} as Record<string, typeof offlineEmis>);

      return NextResponse.json({
        success: true,
        onlineEmis,
        offlineEmis,
        groupedByCreator,
        summary: {
          onlineCount: onlineEmis.length,
          offlineCount: offlineEmis.length,
          onlineAmount: onlineEmis.reduce((sum, e) => sum + e.totalAmount, 0),
          offlineAmount: offlineEmis.reduce((sum, e) => sum + e.totalAmount, 0)
        }
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('EMI reminder fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch EMI reminders' }, { status: 500 });
  }
}

// POST - Create/send EMI reminders
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userId } = body;

    // Send daily reminders to all roles
    if (action === 'send-daily-reminders') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get all active staff who should receive reminders
      const users = await db.user.findMany({
        where: {
          role: { in: ['SUPER_ADMIN', 'AGENT', 'STAFF', 'COMPANY', 'CASHIER'] },
          isActive: true
        }
      });

      let remindersSent = 0;

      for (const user of users) {
        // Get EMIs for this user based on role
        let onlineEmis: typeof onlineEmisInner = [];
        let offlineEmis: typeof offlineEmisInner = [];

        const onlineEmisInner = await db.eMISchedule.findMany({
          where: {
            paymentStatus: { in: ['PENDING', 'OVERDUE'] },
            dueDate: { gte: today, lt: tomorrow }
          },
          include: {
            loanApplication: {
              select: { applicationNo: true, firstName: true, lastName: true }
            }
          }
        });

        const offlineEmisInner = await db.offlineLoanEMI.findMany({
          where: {
            paymentStatus: { in: ['PENDING', 'OVERDUE'] },
            dueDate: { gte: today, lt: tomorrow }
          },
          include: {
            offlineLoan: {
              select: { loanNumber: true, customerName: true, createdById: true }
            }
          }
        });

        // For agents, filter by their loans
        if (user.role === 'AGENT') {
          const agentLoanIds = await db.sessionForm.findMany({
            where: { agentId: user.id },
            select: { loanApplicationId: true }
          });
          const loanIdSet = new Set(agentLoanIds.map(s => s.loanApplicationId));
          
          onlineEmis = onlineEmisInner.filter(e => loanIdSet.has(e.loanApplicationId));
          
          offlineEmis = offlineEmisInner.filter(e => 
            e.offlineLoan.createdById === user.id
          );
        } else {
          onlineEmis = onlineEmisInner;
          offlineEmis = offlineEmisInner;
        }

        // Send notification if there are EMIs
        if (onlineEmis.length > 0 || offlineEmis.length > 0) {
          const totalEmis = onlineEmis.length + offlineEmis.length;
          const totalAmount = [...onlineEmis, ...offlineEmis].reduce((sum, e) => sum + e.totalAmount, 0);

          await db.notification.create({
            data: {
              userId: user.id,
              type: 'EMI_REMINDER_DAILY',
              title: `${totalEmis} EMIs Due Today`,
              message: `You have ${totalEmis} EMIs to collect today. Total amount: ₹${totalAmount.toFixed(0)}`,
              data: JSON.stringify({ count: totalEmis, amount: totalAmount })
            }
          });

          remindersSent++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Sent ${remindersSent} daily reminders`,
        remindersSent
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('EMI reminder error:', error);
    return NextResponse.json({ error: 'Failed to process EMI reminder' }, { status: 500 });
  }
}
