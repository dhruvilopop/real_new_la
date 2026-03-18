import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

const PERMANENT_SUPER_ADMIN_EMAIL = 'moneymitra@gmail.com';
const PERMANENT_SUPER_ADMIN_PASSWORD = '1122334455';

async function ensureSuperAdmin() {
  const hashedPassword = await bcrypt.hash(PERMANENT_SUPER_ADMIN_PASSWORD, 10);
  const admin = await db.user.upsert({
    where: { email: PERMANENT_SUPER_ADMIN_EMAIL },
    update: {
      password: hashedPassword,
      plainPassword: PERMANENT_SUPER_ADMIN_PASSWORD,
      isActive: true,
      role: 'SUPER_ADMIN'
    },
    create: {
      email: PERMANENT_SUPER_ADMIN_EMAIL,
      password: hashedPassword,
      plainPassword: PERMANENT_SUPER_ADMIN_PASSWORD,
      name: 'Money Mitra Admin',
      firebaseUid: 'super-admin-permanent',
      role: 'SUPER_ADMIN',
      isActive: true
    }
  });
  return admin;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, location } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Ensure super admin exists when trying to login
    if (email === PERMANENT_SUPER_ADMIN_EMAIL) {
      await ensureSuperAdmin();
    }

    const user = await db.user.findUnique({
      where: { email }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (user.isLocked) {
      return NextResponse.json(
        { error: 'Account is locked. Please contact support.' },
        { status: 403 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is deactivated. Please contact support.' },
        { status: 403 }
      );
    }

    if (!user.password) {
      return NextResponse.json(
        { error: 'Please use the correct login method for this account' },
        { status: 400 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      const failedAttempts = user.failedLoginAttempts + 1;
      const updateData: Record<string, unknown> = { failedLoginAttempts: failedAttempts };
      
      if (failedAttempts >= 5) {
        updateData.isLocked = true;
      }

      await db.user.update({
        where: { id: user.id },
        data: updateData
      });

      return NextResponse.json(
        { error: `Invalid email or password. ${5 - failedAttempts} attempts remaining.` },
        { status: 401 }
      );
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastActivityAt: new Date(),
        lastLocation: location ? JSON.stringify(location) : null,
        failedLoginAttempts: 0,
        isLocked: false
      }
    });

    if (location && location.latitude && location.longitude) {
      await db.locationLog.create({
        data: {
          userId: user.id,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          action: 'LOGIN',
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          deviceType: request.headers.get('sec-ch-ua-platform') || 'unknown',
          browser: request.headers.get('user-agent')?.split(' ')[0] || 'unknown'
        }
      });
    }

    await db.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        module: 'AUTH',
        description: 'Customer logged in via email/password',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        location: location ? JSON.stringify(location) : null
      }
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        isActive: user.isActive,
        isLocked: user.isLocked
      }
    });
  } catch (error) {
    console.error('Customer login error:', error);
    return NextResponse.json(
      { error: 'Failed to login' },
      { status: 500 }
    );
  }
}
