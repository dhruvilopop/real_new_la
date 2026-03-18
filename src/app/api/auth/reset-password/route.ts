import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, verificationCode, newPassword } = body;

    if (!email || !verificationCode || !newPassword) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.verificationCode !== verificationCode) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    if (user.verificationCodeExpiry && new Date() > user.verificationCodeExpiry) {
      return NextResponse.json({ error: 'Verification code has expired' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        plainPassword: newPassword,
        verificationCode: null,
        verificationCodeExpiry: null,
        failedLoginAttempts: 0,
        isLocked: false
      }
    });

    await db.auditLog.create({
      data: {
        userId: user.id,
        action: 'PASSWORD_RESET',
        module: 'AUTH',
        description: 'Password reset successfully',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      }
    });

    return NextResponse.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
