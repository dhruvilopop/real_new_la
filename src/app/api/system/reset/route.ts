import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST - Reset entire system but keep users
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { confirmReset, userId } = body;

    if (!confirmReset || confirmReset !== 'RESET_SYSTEM') {
      return NextResponse.json({ 
        error: 'Please type "RESET_SYSTEM" to confirm' 
      }, { status: 400 });
    }

    // Verify the requester is a SUPER_ADMIN
    const requester = await db.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!requester || requester.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ 
        error: 'Only Super Admin can reset the system' 
      }, { status: 403 });
    }

    console.log('[System Reset] Starting system reset...');
    const startTime = Date.now();

    // Delete in order of foreign key dependencies
    // 1. Workflow Logs
    const workflowLogs = await db.workflowLog.deleteMany({});
    console.log('[System Reset] Deleted workflow logs:', workflowLogs.count);

    // 2. Audit Logs
    const auditLogs = await db.auditLog.deleteMany({});
    console.log('[System Reset] Deleted audit logs:', auditLogs.count);

    // 3. Payments
    const payments = await db.payment.deleteMany({});
    console.log('[System Reset] Deleted payments:', payments.count);

    // 4. EMI Schedules
    const emiSchedules = await db.eMISchedule.deleteMany({});
    console.log('[System Reset] Deleted EMI schedules:', emiSchedules.count);

    // 5. Session Forms
    const sessionForms = await db.sessionForm.deleteMany({});
    console.log('[System Reset] Deleted session forms:', sessionForms.count);

    // 6. Loan Forms
    const loanForms = await db.loanForm.deleteMany({});
    console.log('[System Reset] Deleted loan forms:', loanForms.count);

    // 7. Loan Applications
    const loanApplications = await db.loanApplication.deleteMany({});
    console.log('[System Reset] Deleted loan applications:', loanApplications.count);

    // 8. Offline Loan EMIs
    const offlineEMIs = await db.offlineLoanEMI.deleteMany({});
    console.log('[System Reset] Deleted offline loan EMIs:', offlineEMIs.count);

    // 9. Offline Loans
    const offlineLoans = await db.offlineLoan.deleteMany({});
    console.log('[System Reset] Deleted offline loans:', offlineLoans.count);

    // 10. Credit Transactions
    const creditTransactions = await db.creditTransaction.deleteMany({});
    console.log('[System Reset] Deleted credit transactions:', creditTransactions.count);

    // 11. Cashier Settlements
    const cashierSettlements = await db.cashierSettlement.deleteMany({});
    console.log('[System Reset] Deleted cashier settlements:', cashierSettlements.count);

    // 12. Daily Collections
    const dailyCollections = await db.dailyCollection.deleteMany({});
    console.log('[System Reset] Deleted daily collections:', dailyCollections.count);

    // 13. Notifications
    const notifications = await db.notification.deleteMany({});
    console.log('[System Reset] Deleted notifications:', notifications.count);

    // 14. Reminders
    const reminders = await db.reminder.deleteMany({});
    console.log('[System Reset] Deleted reminders:', reminders.count);

    // 15. Location Logs
    const locationLogs = await db.locationLog.deleteMany({});
    console.log('[System Reset] Deleted location logs:', locationLogs.count);

    // 16. Action Logs
    const actionLogs = await db.actionLog.deleteMany({});
    console.log('[System Reset] Deleted action logs:', actionLogs.count);

    // 17. EMI Reminder Logs
    const emiReminders = await db.eMIReminderLog.deleteMany({});
    console.log('[System Reset] Deleted EMI reminder logs:', emiReminders.count);

    // 18. Blacklist entries
    const blacklists = await db.blacklist.deleteMany({});
    console.log('[System Reset] Deleted blacklist entries:', blacklists.count);

    // 19. Device Fingerprints
    const deviceFingerprints = await db.deviceFingerprint.deleteMany({});
    console.log('[System Reset] Deleted device fingerprints:', deviceFingerprints.count);

    // 20. Journal Entry Lines
    const journalLines = await db.journalEntryLine.deleteMany({});
    console.log('[System Reset] Deleted journal entry lines:', journalLines.count);

    // 21. Journal Entries
    const journalEntries = await db.journalEntry.deleteMany({});
    console.log('[System Reset] Deleted journal entries:', journalEntries.count);

    // 22. Bank Transactions
    const bankTransactions = await db.bankTransaction.deleteMany({});
    console.log('[System Reset] Deleted bank transactions:', bankTransactions.count);

    // 23. Expenses
    const expenses = await db.expense.deleteMany({});
    console.log('[System Reset] Deleted expenses:', expenses.count);

    // 24. Ledger Balances
    const ledgerBalances = await db.ledgerBalance.deleteMany({});
    console.log('[System Reset] Deleted ledger balances:', ledgerBalances.count);

    // 25. Loan related records (top-ups, foreclosures, etc.)
    try { await db.loanTopUp.deleteMany({}); } catch (e) {}
    try { await db.foreclosureRequest.deleteMany({}); } catch (e) {}
    try { await db.eMIDateChangeRequest.deleteMany({}); } catch (e) {}
    try { await db.counterOffer.deleteMany({}); } catch (e) {}
    try { await db.documentRequest.deleteMany({}); } catch (e) {}
    try { await db.loanRestructure.deleteMany({}); } catch (e) {}
    try { await db.nPATracking.deleteMany({}); } catch (e) {}
    try { await db.fraudAlert.deleteMany({}); } catch (e) {}
    try { await db.appointment.deleteMany({}); } catch (e) {}
    try { await db.loanAgreement.deleteMany({}); } catch (e) {}
    try { await db.loanProgressTimeline.deleteMany({}); } catch (e) {}
    try { await db.applicationFingerprint.deleteMany({}); } catch (e) {}
    console.log('[System Reset] Deleted loan related records');

    // 26. Pre-approved offers
    try { await db.preApprovedOffer.deleteMany({}); } catch (e) {}
    console.log('[System Reset] Deleted pre-approved offers');

    // 27. Credit Risk Scores
    try { await db.creditRiskScore.deleteMany({}); } catch (e) {}
    console.log('[System Reset] Deleted credit risk scores');

    // 28. Referrals
    try { await db.referral.deleteMany({}); } catch (e) {}
    console.log('[System Reset] Deleted referrals');

    // 29. Agent Performance
    try { await db.agentPerformance.deleteMany({}); } catch (e) {}
    console.log('[System Reset] Deleted agent performance records');

    // 30. Commission Slabs
    try { await db.commissionSlab.deleteMany({}); } catch (e) {}
    console.log('[System Reset] Deleted commission slabs');

    // 31. Grace Period Configs
    try { await db.gracePeriodConfig.deleteMany({}); } catch (e) {}
    console.log('[System Reset] Deleted grace period configs');

    // 32. Notification Settings (reset to default)
    try { await db.notificationSetting.deleteMany({}); } catch (e) {}
    console.log('[System Reset] Deleted notification settings');

    // 33. Reports Cache
    try { await db.reportsCache.deleteMany({}); } catch (e) {}
    console.log('[System Reset] Deleted reports cache');

    // 34. Uploaded Files
    try { await db.uploadedFile.deleteMany({}); } catch (e) {}
    console.log('[System Reset] Deleted uploaded files');

    // Reset User credits to 0 (but keep users)
    await db.user.updateMany({
      data: {
        companyCredit: 0,
        personalCredit: 0,
        credit: 0
      }
    });
    console.log('[System Reset] Reset all user credits to 0');

    // Reset Company credits to 0
    await db.company.updateMany({
      data: {
        companyCredit: 0
      }
    });
    console.log('[System Reset] Reset all company credits to 0');

    // Reset Bank Account balances to 0
    try {
      await db.bankAccount.updateMany({
        data: {
          currentBalance: 0,
          openingBalance: 0
        }
      });
    } catch (e) {}
    console.log('[System Reset] Reset all bank account balances to 0');

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log(`[System Reset] Completed in ${duration} seconds`);

    // Create a system reset action log (use ActionLog model)
    try {
      await db.actionLog.create({
        data: {
          userId: userId,
          userRole: 'SUPER_ADMIN',
          actionType: 'SYSTEM_RESET',
          module: 'SYSTEM',
          recordId: 'system',
          recordType: 'System',
          description: `System reset completed in ${duration} seconds. All data cleared except users.`,
          previousData: '{}',
          newData: JSON.stringify({
            duration: `${duration}s`,
            deleted: {
              workflowLogs: workflowLogs.count,
              auditLogs: auditLogs.count,
              payments: payments.count,
              emiSchedules: emiSchedules.count,
              sessionForms: sessionForms.count,
              loanForms: loanForms.count,
              loanApplications: loanApplications.count,
              offlineLoans: offlineLoans.count,
              creditTransactions: creditTransactions.count
            }
          }),
          canUndo: false
        }
      });
    } catch (e) {
      console.log('[System Reset] Could not create action log:', e);
    }

    return NextResponse.json({
      success: true,
      message: 'System reset completed successfully',
      stats: {
        duration: `${duration}s`,
        deleted: {
          workflowLogs: workflowLogs.count,
          auditLogs: auditLogs.count,
          payments: payments.count,
          emiSchedules: emiSchedules.count,
          sessionForms: sessionForms.count,
          loanForms: loanForms.count,
          loanApplications: loanApplications.count,
          offlineLoans: offlineLoans.count,
          creditTransactions: creditTransactions.count,
          notifications: notifications.count
        }
      }
    });

  } catch (error) {
    console.error('[System Reset] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to reset system',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
