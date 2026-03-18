import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, firebaseUid } = body;

    console.log('[check-login] Checking login for:', { email, firebaseUid });

    if (!email) {
      console.log('[check-login] No email provided');
      return NextResponse.json({ canLogin: false, error: 'Email required' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email }
    });

    console.log('[check-login] User found:', user ? { id: user.id, role: user.role, isActive: user.isActive, isLocked: user.isLocked } : null);

    if (!user) {
      // User not found in database - allow login for new registration flow
      console.log('[check-login] User not found, allowing login');
      return NextResponse.json({ canLogin: true });
    }

    const deletedUser = await db.deletedUser.findFirst({
      where: {
        OR: [
          { email },
          { firebaseUid }
        ]
      }
    });

    if (deletedUser) {
      console.log('[check-login] User was deleted');
      return NextResponse.json({ canLogin: false, reason: 'Account has been deleted' });
    }

    if (user.isLocked) {
      console.log('[check-login] User is locked');
      return NextResponse.json({ canLogin: false, reason: 'Account is locked' });
    }

    if (!user.isActive) {
      console.log('[check-login] User is inactive');
      return NextResponse.json({ canLogin: false, reason: 'Account is deactivated' });
    }

    console.log('[check-login] User can login');
    return NextResponse.json({ canLogin: true });
  } catch (error) {
    console.error('[check-login] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
