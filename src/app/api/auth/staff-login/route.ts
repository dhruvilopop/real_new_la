import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

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

    const emailLower = email.toLowerCase();

    const user = await db.user.findUnique({
      where: { email: emailLower }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const staffRoles: UserRole[] = [
      UserRole.SUPER_ADMIN, 
      UserRole.COMPANY, 
      UserRole.AGENT, 
      UserRole.STAFF, 
      UserRole.CASHIER,
      UserRole.ACCOUNTANT
    ];
    
    if (!staffRoles.includes(user.role)) {
      return NextResponse.json(
        { error: 'Access denied. This login is for staff only.' },
        { status: 403 }
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

    let passwordValid = false;
    
    if (user.password) {
      passwordValid = await bcrypt.compare(password, user.password);
    }

    if (!passwordValid) {
      const newAttempts = (user.failedLoginAttempts || 0) + 1;
      
      if (newAttempts >= 5) {
        await db.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: newAttempts,
            isLocked: true
          }
        });
        
        return NextResponse.json(
          { error: 'Account locked due to too many failed attempts.' },
          { status: 403 }
        );
      }
      
      await db.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: newAttempts }
      });
      
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lastLoginAt: new Date(),
        lastActivityAt: new Date(),
        lastLocation: location ? JSON.stringify(location) : null,
        loginType: 'EMAIL'
      }
    });

    if (location && location.latitude && location.longitude) {
      await db.locationLog.create({
        data: {
          userId: user.id,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          action: 'STAFF_LOGIN',
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
        description: `Staff logged in via email (${user.role})`,
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
        companyId: user.companyId,
        agentId: user.agentId,
        agentCode: user.agentCode,
        staffCode: user.staffCode,
        cashierCode: user.cashierCode,
        isActive: user.isActive,
        isLocked: user.isLocked
      }
    });
  } catch (error) {
    console.error('Staff login error:', error);
    return NextResponse.json(
      { error: 'Failed to login' },
      { status: 500 }
    );
  }
}
