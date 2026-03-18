import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const userId = searchParams.get('userId');
    const actionFilter = searchParams.get('action');
    const moduleFilter = searchParams.get('module');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    
    if (userId) where.userId = userId;
    if (actionFilter) where.action = { contains: actionFilter, mode: 'insensitive' };
    if (moduleFilter) where.module = { contains: moduleFilter, mode: 'insensitive' };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true }
          },
          loanApplication: {
            select: { id: true, applicationNo: true }
          }
        }
      }),
      db.auditLog.count({ where })
    ]);

    // Get unique modules and actions for filters
    const moduleList = await db.auditLog.findMany({
      where: {},
      select: { module: true },
      distinct: ['module']
    });

    const actionList = await db.auditLog.findMany({
      where: {},
      select: { action: true },
      distinct: ['action']
    });

    return NextResponse.json({
      logs,
      modules: moduleList.map((m: { module: string }) => m.module),
      actions: actionList.map((a: { action: string }) => a.action),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
