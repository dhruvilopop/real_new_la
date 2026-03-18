import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// PERMANENT SUPER ADMIN - This email is reserved and cannot be deleted
const PERMANENT_SUPER_ADMIN_EMAIL = 'moneymitra@gmail.com';
const PERMANENT_SUPER_ADMIN_PASSWORD = '1122334455';

async function ensurePermanentSuperAdmin() {
  try {
    const existingAdmin = await db.user.findUnique({
      where: { email: PERMANENT_SUPER_ADMIN_EMAIL }
    });

    const hashedPassword = await bcrypt.hash(PERMANENT_SUPER_ADMIN_PASSWORD, 10);

    if (!existingAdmin) {
      await db.user.create({
        data: {
          email: PERMANENT_SUPER_ADMIN_EMAIL,
          firebaseUid: `permanent-super-admin-${Date.now()}`,
          name: 'Money Mitra Admin',
          role: UserRole.SUPER_ADMIN,
          password: hashedPassword,
          plainPassword: PERMANENT_SUPER_ADMIN_PASSWORD,
          isActive: true,
          isLocked: false,
          lastLoginAt: new Date()
        }
      });
    } else {
      // Ensure admin has correct role and is active
      if (existingAdmin.role !== UserRole.SUPER_ADMIN || !existingAdmin.isActive) {
        await db.user.update({
          where: { id: existingAdmin.id },
          data: {
            role: UserRole.SUPER_ADMIN,
            isActive: true,
            isLocked: false,
            password: hashedPassword,
            plainPassword: PERMANENT_SUPER_ADMIN_PASSWORD
          }
        });
      }
    }
  } catch (error) {
    console.error('Error ensuring permanent super admin:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Always ensure super admin exists
    await ensurePermanentSuperAdmin();

    const body = await request.json();
    const { email, firebaseUid, name, profilePicture, phone, role } = body;

    if (!email || !firebaseUid) {
      return NextResponse.json(
        { error: 'Email and Firebase UID are required' },
        { status: 400 }
      );
    }

    if (email === PERMANENT_SUPER_ADMIN_EMAIL) {
      let admin = await db.user.findUnique({
        where: { email: PERMANENT_SUPER_ADMIN_EMAIL },
        include: { company: true, agent: true }
      });
      
      if (!admin) {
        const hashedPassword = await bcrypt.hash(PERMANENT_SUPER_ADMIN_PASSWORD, 10);
        admin = await db.user.create({
          data: {
            email: PERMANENT_SUPER_ADMIN_EMAIL,
            firebaseUid,
            name: 'Money Mitra Admin',
            role: 'SUPER_ADMIN',
            password: hashedPassword,
            plainPassword: PERMANENT_SUPER_ADMIN_PASSWORD,
            isActive: true,
            lastLoginAt: new Date()
          },
          include: { company: true, agent: true }
        });
      } else {
        admin = await db.user.update({
          where: { id: admin.id },
          data: { lastLoginAt: new Date(), firebaseUid },
          include: { company: true, agent: true }
        });
      }
      
      return NextResponse.json({
        user: {
          id: admin.id,
          firebaseUid: admin.firebaseUid,
          email: admin.email,
          name: admin.name,
          role: admin.role,
          isActive: admin.isActive,
          isLocked: admin.isLocked,
          companyId: admin.companyId,
          agentId: admin.agentId,
          company: admin.company,
          agent: admin.agent,
          agentCode: admin.agentCode,
          staffCode: admin.staffCode,
          cashierCode: admin.cashierCode
        }
      });
    }

    const deletedUserCheck = await db.deletedUser.findFirst({
      where: {
        OR: [
          { email: email },
          { firebaseUid: firebaseUid }
        ]
      }
    });

    if (deletedUserCheck) {
      return NextResponse.json(
        { error: 'This user account has been permanently deleted', deleted: true },
        { status: 403 }
      );
    }

    let user = await db.user.findUnique({
      where: { firebaseUid },
      include: { company: true, agent: true }
    });

    if (!user) {
      user = await db.user.findUnique({
        where: { email },
        include: { company: true, agent: true }
      });
    }

    if (user) {
      if (user.deletedAt) {
        return NextResponse.json(
          { error: 'User account has been deleted', deleted: true },
          { status: 403 }
        );
      }

      user = await db.user.update({
        where: { id: user.id },
        data: {
          firebaseUid,
          name: name || user.name,
          profilePicture: profilePicture || user.profilePicture,
          phone: phone || user.phone,
          lastLoginAt: new Date(),
          failedLoginAttempts: 0,
          isLocked: false
        },
        include: { company: true, agent: true }
      });
    } else {
      const userRole = role && Object.values(UserRole).includes(role) ? role : UserRole.CUSTOMER;
      
      let companyId: string | undefined;
      let createdCompany: { id: string; name: string; code: string } | null = null;
      
      if (userRole === 'COMPANY') {
        const companyCode = `COMP-${Date.now().toString(36).toUpperCase()}`;
        createdCompany = await db.company.create({
          data: {
            name: name || email.split('@')[0],
            code: companyCode,
            contactEmail: email,
            isActive: true
          }
        });
        companyId = createdCompany.id;
      }
      
      user = await db.user.create({
        data: {
          firebaseUid,
          email,
          name: name || email.split('@')[0],
          profilePicture,
          phone,
          role: userRole,
          companyId,
          lastLoginAt: new Date(),
          termsAccepted: false,
          privacyAccepted: false
        },
        include: { company: true, agent: true }
      });

      await db.auditLog.create({
        data: {
          userId: user.id,
          action: 'CREATE',
          module: 'USER',
          description: 'New user registered',
          recordId: user.id,
          recordType: 'User',
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
        }
      });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        phone: user.phone,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        isLocked: user.isLocked,
        profilePicture: user.profilePicture,
        companyId: user.companyId || user.company?.id || null,
        agentId: user.agentId || null,
        company: user.company ? { id: user.company.id, name: user.company.name, code: user.company.code } : null,
        agent: user.agent ? { id: user.agent.id, name: user.agent.name, agentCode: user.agent.agentCode } : null,
        agentCode: user.agentCode,
        staffCode: user.staffCode,
        cashierCode: user.cashierCode
      }
    });
  } catch (error) {
    console.error('Auth sync error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const firebaseUid = request.headers.get('x-firebase-uid');

    if (!firebaseUid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { firebaseUid },
      include: { company: true, agent: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        phone: user.phone,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        isLocked: user.isLocked,
        profilePicture: user.profilePicture,
        companyId: user.companyId || user.company?.id || null,
        agentId: user.agentId || null,
        company: user.company ? { id: user.company.id, name: user.company.name, code: user.company.code } : null,
        agent: user.agent ? { id: user.agent.id, name: user.agent.name, agentCode: user.agent.agentCode } : null,
        agentCode: user.agentCode,
        staffCode: user.staffCode,
        cashierCode: user.cashierCode
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
