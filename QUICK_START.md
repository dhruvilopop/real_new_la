# QUICK REFERENCE - Resume Guide

## Start Commands
```bash
cd /home/z/my-project
bun run dev
```

## Test URLs
- Main: http://localhost:3000
- Staff Login: superadmin@smfc.com / password123

## Last Tasks Done
1. ✅ Login pages - Modern white design
2. ✅ Customer loan detail - Fixed "loan not found" 
3. ✅ EMI date change - For non-accountant roles
4. ✅ Partial payment - Pay part, rest later
5. ✅ Interest only - Pay interest, defer principal
6. ✅ UI transparency - Fixed dialogs/panels

## Pending
1. Test all features
2. Scan transactions API (not written)
3. Hostinger deployment (future)

## Check Errors
```bash
tail -f /home/z/my-project/dev.log
bun run lint
```

## Key Files Changed
- src/components/auth/StaffLoginPage.tsx
- src/components/auth/CustomerLoginPage.tsx
- src/components/loan/LoanDetailPanel.tsx
- src/components/customer/CustomerLoanDetailPage.tsx
- src/app/api/emi/change-date/route.ts (NEW)
- src/app/globals.css

## Database
```bash
bunx prisma studio
```
