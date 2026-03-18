import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const user = await db.user.update({
      where: { id: userId },
      data: {
        isLocked: false,
        failedLoginAttempts: 0
      }
    });

    await db.auditLog.create({
      data: {
        userId: userId,
        action: 'UNLOCK',
        module: 'USER',
        description: 'Account unlocked',
        recordId: userId,
        recordType: 'User',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Account unlocked successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isLocked: user.isLocked
      }
    });
  } catch (error) {
    console.error('Unlock user error:', error);
    return NextResponse.json(
      { error: 'Failed to unlock user' },
      { status: 500 }
    );
  }
}
