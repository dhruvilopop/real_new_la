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

    // ========================================
    // PHASE 1: Delete all independent records
    // ========================================
    
    // These don't depend on LoanApplication
    const workflowLogs = await db.workflowLog.deleteMany({});
    console.log('[System Reset] Deleted workflow logs:', workflowLogs.count);

    const auditLogs = await db.auditLog.deleteMany({});
    console.log('[System Reset] Deleted audit logs:', auditLogs.count);

    const notifications = await db.notification.deleteMany({});
    console.log('[System Reset] Deleted notifications:', notifications.count);

    const reminders = await db.reminder.deleteMany({});
    console.log('[System Reset] Deleted reminders:', reminders.count);

    const locationLogs = await db.locationLog.deleteMany({});
    console.log('[System Reset] Deleted location logs:', locationLogs.count);

    const actionLogs = await db.actionLog.deleteMany({});
    console.log('[System Reset] Deleted action logs:', actionLogs.count);

    const blacklists = await db.blacklist.deleteMany({});
    console.log('[System Reset] Deleted blacklist entries:', blacklists.count);

    const deviceFingerprints = await db.deviceFingerprint.deleteMany({});
    console.log('[System Reset] Deleted device fingerprints:', deviceFingerprints.count);

    const journalLines = await db.journalEntryLine.deleteMany({});
    console.log('[System Reset] Deleted journal entry lines:', journalLines.count);

    const journalEntries = await db.journalEntry.deleteMany({});
    console.log('[System Reset] Deleted journal entries:', journalEntries.count);

    const bankTransactions = await db.bankTransaction.deleteMany({});
    console.log('[System Reset] Deleted bank transactions:', bankTransactions.count);

    const expenses = await db.expense.deleteMany({});
    console.log('[System Reset] Deleted expenses:', expenses.count);

    const ledgerBalances = await db.ledgerBalance.deleteMany({});
    console.log('[System Reset] Deleted ledger balances:', ledgerBalances.count);

    const cashierSettlements = await db.cashierSettlement.deleteMany({});
    console.log('[System Reset] Deleted cashier settlements:', cashierSettlements.count);

    const dailyCollections = await db.dailyCollection.deleteMany({});
    console.log('[System Reset] Deleted daily collections:', dailyCollections.count);

    const creditTransactions = await db.creditTransaction.deleteMany({});
    console.log('[System Reset] Deleted credit transactions:', creditTransactions.count);

    // ========================================
    // PHASE 2: Delete all LoanApplication children
    // ========================================
    
    // Payments depend on EMISchedule and LoanApplication
    const payments = await db.payment.deleteMany({});
    console.log('[System Reset] Deleted payments:', payments.count);

    // EMI Reminder Logs depend on EMISchedule
    const emiReminders = await db.eMIReminderLog.deleteMany({});
    console.log('[System Reset] Deleted EMI reminder logs:', emiReminders.count);

    // EMI Schedules depend on LoanApplication - MUST DELETE BEFORE LoanApplication
    const emiSchedules = await db.eMISchedule.deleteMany({});
    console.log('[System Reset] Deleted EMI schedules:', emiSchedules.count);

    // Offline Loan EMIs depend on OfflineLoan
    const offlineEMIs = await db.offlineLoanEMI.deleteMany({});
    console.log('[System Reset] Deleted offline loan EMIs:', offlineEMIs.count);

    // Offline Loans
    const offlineLoans = await db.offlineLoan.deleteMany({});
    console.log('[System Reset] Deleted offline loans:', offlineLoans.count);

    // Session Forms depend on LoanApplication
    const sessionForms = await db.sessionForm.deleteMany({});
    console.log('[System Reset] Deleted session forms:', sessionForms.count);

    // Loan Forms depend on LoanApplication
    const loanForms = await db.loanForm.deleteMany({});
    console.log('[System Reset] Deleted loan forms:', loanForms.count);

    // All other loan-related records that depend on LoanApplication
    try { await db.loanTopUp.deleteMany({}); } catch (e) { console.log('[System Reset] No loan top-ups'); }
    try { await db.foreclosureRequest.deleteMany({}); } catch (e) { console.log('[System Reset] No foreclosure requests'); }
    try { await db.eMIDateChangeRequest.deleteMany({}); } catch (e) { console.log('[System Reset] No EMI date change requests'); }
    try { await db.counterOffer.deleteMany({}); } catch (e) { console.log('[System Reset] No counter offers'); }
    try { await db.documentRequest.deleteMany({}); } catch (e) { console.log('[System Reset] No document requests'); }
    try { await db.loanRestructure.deleteMany({}); } catch (e) { console.log('[System Reset] No loan restructures'); }
    try { await db.nPATracking.deleteMany({}); } catch (e) { console.log('[System Reset] No NPA tracking'); }
    try { await db.fraudAlert.deleteMany({}); } catch (e) { console.log('[System Reset] No fraud alerts'); }
    try { await db.appointment.deleteMany({}); } catch (e) { console.log('[System Reset] No appointments'); }
    try { await db.loanAgreement.deleteMany({}); } catch (e) { console.log('[System Reset] No loan agreements'); }
    try { await db.loanProgressTimeline.deleteMany({}); } catch (e) { console.log('[System Reset] No loan progress timelines'); }
    try { await db.applicationFingerprint.deleteMany({}); } catch (e) { console.log('[System Reset] No application fingerprints'); }
    try { await db.creditRiskScore.deleteMany({}); } catch (e) { console.log('[System Reset] No credit risk scores'); }
    console.log('[System Reset] Deleted all loan-related records');

    // Pre-approved offers
    try { await db.preApprovedOffer.deleteMany({}); } catch (e) { console.log('[System Reset] No pre-approved offers'); }

    // Referrals
    try { await db.referral.deleteMany({}); } catch (e) { console.log('[System Reset] No referrals'); }

    // ========================================
    // PHASE 3: NOW safe to delete Loan Applications
    // ========================================
    const loanApplications = await db.loanApplication.deleteMany({});
    console.log('[System Reset] Deleted loan applications:', loanApplications.count);

    // ========================================
    // PHASE 4: Other cleanup
    // ========================================
    try { await db.agentPerformance.deleteMany({}); } catch (e) { console.log('[System Reset] No agent performance'); }
    try { await db.commissionSlab.deleteMany({}); } catch (e) { console.log('[System Reset] No commission slabs'); }
    try { await db.gracePeriodConfig.deleteMany({}); } catch (e) { console.log('[System Reset] No grace period configs'); }
    try { await db.notificationSetting.deleteMany({}); } catch (e) { console.log('[System Reset] No notification settings'); }
    try { await db.reportsCache.deleteMany({}); } catch (e) { console.log('[System Reset] No reports cache'); }
    try { await db.uploadedFile.deleteMany({}); } catch (e) { console.log('[System Reset] No uploaded files'); }

    // ========================================
    // PHASE 5: Reset balances
    // ========================================
    
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
    } catch (e) { console.log('[System Reset] No bank accounts'); }
    console.log('[System Reset] Reset all bank account balances to 0');

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log(`[System Reset] Completed in ${duration} seconds`);

    return NextResponse.json({
      success: true,
      message: 'System reset completed successfully',
      stats: {
        duration: `${duration}s`,
        deleted: {
          loanApplications: loanApplications.count,
          emiSchedules: emiSchedules.count,
          payments: payments.count,
          offlineLoans: offlineLoans.count,
          notifications: notifications.count,
          creditTransactions: creditTransactions.count
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
