# Work Log

---
Task ID: 1
Agent: Main Agent
Task: Fix duplicate dashboard cards, add clickable stats, implement caching for DB connections

Work Log:
- Analyzed the issue: duplicate stats cards showing in all sections of role dashboards
- Updated DashboardLayout to only show stats when `activeTab === 'dashboard'`
- Added onClick handlers to stats in all dashboard components to make cards clickable
- Removed duplicate stats rendering from renderContent() in each dashboard
- Created `/src/lib/cache.ts` - In-memory caching utility to reduce database queries
- Updated `/src/lib/db.ts` - Optimized Prisma client configuration for limited connections
- Verified payment settings API exists at `/src/app/api/settings/payment/route.ts`
- Settings dialog UI in PaymentRequestsSection already complete
- Reduced polling intervals across all credit-related components:
  - DashboardLayout: removed interval polling completely
  - CreditManagementSection: 5s -> removed interval
  - MyCreditPassbook: autoRefresh disabled by default
  - CreditManagementPage: autoRefresh disabled by default
- Increased credit API cache TTL from 30s to 60s
- Disabled NotificationBell 30s polling
- Disabled AccountantDashboard real-time updates (isRealTimeEnabled = false)
- Disabled SecurityContext real-time updates (isRealTimeEnabled = false)
- Fixed customer portal sanction acceptance:
  - Added sessionForm to loan list API response for customer role
  - Customer can now see sanction details (approved amount, EMI, tenure)
  - Review & Accept button properly shows for SESSION_CREATED status loans

Stage Summary:
- Fixed duplicate cards in: SuperAdminDashboard, AgentDashboard, StaffDashboard, CompanyDashboard, CashierDashboard
- Stats cards now clickable with hover effects and navigation to relevant sections
- Caching utility created with TTL support and key generators for common queries
- Payment settings API with caching already implemented
- Significantly reduced database query frequency to prevent connection limit issues
- Customer portal now properly shows sanction acceptance button and dialog
- All changes committed and pushed to git

Note: Database connection limit (500/hour) was exceeded initially. 
The caching solution and removed polling intervals will prevent this issue in the future.

---
Task ID: 2
Agent: Main Agent
Task: Implement Payment Page System with Per-EMI Payment Options

Work Log:
- Reviewed Prisma schema - EMIPaymentSetting and SecondaryPaymentPage models already exist
- Updated /api/bank-account/route.ts with UPI ID, QR Code URL, isDefault fields
- Updated /api/accounting/bank-accounts/route.ts with UPI ID and QR Code URL fields
- Created EMISettingsDialog component for per-EMI payment options
- Added Settings icon import to CustomerLoanDetailPage
- Added Settings button to each EMI item with clickable toggle
- Added showSettingsDialog state for settings dialog
- Integrated EMISettingsDialog with loan details and company ID
- Updated AccountantDashboard bank dialog with:
  - UPI ID input field
  - QR Code URL input field
  - "Set as Default Account" checkbox
  - "Payment Settings for Customer Payment Page" section
- Updated newBankData state to include upiId, qrCodeUrl, isDefault fields
- Updated resetBankForm to reset new fields

Stage Summary:
- Per-EMI Payment Option Toggle implemented with visual UI
- Company Bank Account management enhanced with UPI ID, QR Code, Default toggle
- Default Payment Page = Company's default bank account
- Secondary Payment Pages API exists for display-only payment details
- All transactions tracked in default company bank account
- All changes committed and pushed to git (commit 3a25c29)

---
Task ID: 3
Agent: Main Agent
Task: Fix TypeScript Errors and Integrate Company Bank Account with Payment System

Work Log:
- Fixed TypeScript error in ActiveLoansSection.tsx: Added `id` field to company type
- Fixed TypeScript error in CustomerLoanDetailPage.tsx: Added `loanApplicationId` to EMISchedule interface
- Fixed TypeScript error in CustomerLoanDetailPage.tsx: Fixed `proofUrl` type annotation (string | null)
- Fixed TypeScript error in EMISettingsDialog.tsx: Made `emi` prop nullable
- Fixed TypeScript error in EMISettingsDialog.tsx: Made `loanApplicationId` optional
- Fixed TypeScript error in EMISettingsDialog.tsx: Added null check for formatDate call
- Updated /api/payment-request/route.ts to fetch company's default bank account details:
  - Added automatic companyId lookup from loanApplicationId
  - Fetches default bank account (isDefault: true) for the company
  - Returns bankAccountId, bankName, bankAccountNumber, bankIfscCode, bankBranch, companyUpiId, companyQrCodeUrl
  - Merged bank account details with payment settings response
- Updated AccountantDashboard.tsx:
  - Added `branchName` field to newBankData state and resetBankForm
  - Added Branch Name input field in bank account creation form
  - Updated BankAccount interface with: ifscCode, branchName, upiId, qrCodeUrl
  - Enhanced bank account detail dialog to show IFSC Code, Branch Name, UPI ID, QR Code image
  - Added "Default Account" badge styling for default accounts
- Fixed TypeScript error in payment-request/route.ts: Added proper type annotation for bankAccountDetails variable

Stage Summary:
- All TypeScript errors resolved - build passes successfully
- Customer payment page now receives company's default bank account details
- Accountant can configure: Bank Name, Account Number, IFSC Code, Branch Name, UPI ID, QR Code URL
- Default bank account is automatically shown to customers for EMI payments
- Git commits pushed:
  - 3defd35: fix: resolve TypeScript type errors
  - e096488: feat: integrate company bank account with payment settings
  - f9d4d03: fix: resolve TypeScript type error in payment-request API

Key Files Modified:
1. /src/app/api/payment-request/route.ts - Added bank account details to settings response
2. /src/components/accountant/AccountantDashboard.tsx - Enhanced bank account management
3. /src/components/customer/CustomerLoanDetailPage.tsx - Fixed type errors
4. /src/components/customer/EMISettingsDialog.tsx - Fixed type errors
5. /src/components/admin/modules/ActiveLoansSection.tsx - Fixed type errors

How the Payment Flow Works Now:
1. Accountant creates a bank account with UPI ID, QR Code URL, marks it as Default
2. Customer views their loan and clicks "Pay EMI"
3. Payment dialog shows company's default bank account details (UPI ID, QR Code, Bank Name, Account Number, IFSC)
4. Customer can scan QR or use UPI ID to make payment

---
Task ID: 4
Agent: Main Agent
Task: Fix Per-EMI Payment Settings Not Being Applied in Customer Payment Dialog

Work Log:
- Identified issue: Per-EMI settings from EMIPaymentSetting model were not being fetched when customer opens payment dialog
- The payment options (Full/Partial/Interest Only) were only checking global settings, not per-EMI settings
- Added `emiSpecificSettings` state to CustomerLoanDetailPage to store per-EMI settings
- Created `fetchEmiSpecificSettings()` function to fetch settings from `/api/emi-payment-settings?emiScheduleId=xxx`
- Updated payment dialog open handler to fetch EMI-specific settings when EMI is selected
- Updated payment option conditions to use EMI-specific settings with fallback to global settings:
  - Full Payment: `(emiSpecificSettings?.enableFullPayment ?? (!paymentSettings || paymentSettings.enableFullPayment))`
  - Partial Payment: `(emiSpecificSettings?.enablePartialPayment ?? (!paymentSettings || paymentSettings.enablePartialPayment))`
  - Interest Only: `(emiSpecificSettings?.enableInterestOnly ?? (!paymentSettings || paymentSettings.enableInterestOnly))`

Stage Summary:
- Per-EMI payment settings now properly applied when customer views payment options
- If EMI has specific settings, those are used; otherwise falls back to global/company settings
- Admin/Accountant can now control payment options for each individual EMI
- Git commits:
  - (pending): fix: apply per-EMI payment settings in customer payment dialog

Key Files Modified:
1. /src/components/customer/CustomerLoanDetailPage.tsx - Added EMI-specific settings fetch and application

---

# COMPLETE SESSION SUMMARY

## Features Implemented Today

### 1. Per-EMI Payment Option Toggle ✅
**What it does:** Admin/Accountant can control which payment types are available for each individual EMI
**Files:**
- `/src/components/customer/EMISettingsDialog.tsx` - Dialog component with toggles
- `/src/app/api/emi-payment-settings/route.ts` - API for CRUD operations
- `/src/components/customer/CustomerLoanDetailPage.tsx` - Settings button on each EMI

**How to Check:**
1. Login as Customer
2. Go to any active loan
3. You will see a Settings (⚙️) icon on each EMI row
4. Click Settings icon to open the dialog
5. Toggle Full Payment / Partial Payment / Interest Only options
6. Save settings
7. Now click on that EMI to pay - you will only see the enabled payment options

### 2. Company Bank Account System ✅
**What it does:** Accountant can manage company bank accounts with UPI ID, QR Code, and set default account
**Files:**
- `/src/components/accountant/AccountantDashboard.tsx` - Bank account management UI
- `/src/app/api/bank-account/route.ts` - API with UPI ID, QR Code, isDefault fields
- `/src/app/api/payment-request/route.ts` - Returns default bank account details to customer

**How to Check:**
1. Login as Accountant
2. Go to "Bank Accounts" section
3. Click "Add Bank Account"
4. Fill in: Bank Name, Account Number, Account Name, IFSC Code, Branch Name
5. Fill in Payment Settings: UPI ID (e.g., company@upi), QR Code URL
6. Check "Set as Default Account"
7. Save

### 3. Customer Payment Page Shows Company Bank Details ✅
**What it does:** When customer clicks "Pay EMI", they see company's default bank account details
**Files:**
- `/src/components/customer/CustomerLoanDetailPage.tsx` - Payment dialog with bank details
- `/src/app/api/payment-request/route.ts` - Fetches default bank account

**How to Check:**
1. Login as Customer
2. Go to any active loan
3. Click on an EMI to pay
4. Payment dialog shows: UPI ID, QR Code image, Bank Name, Account Number, IFSC Code

### 4. Secondary Payment Pages (Display Only) ✅
**What it does:** Create additional payment pages for display purposes (money still tracked in default account)
**Files:**
- `/src/app/api/emi-payment-settings/route.ts` - API with PUT endpoint for secondary pages
- Prisma model: `SecondaryPaymentPage`

**How to Check:**
1. Use API: POST /api/emi-payment-settings with action=secondary-pages
2. Secondary pages can be selected in EMI Settings dialog

### 5. TypeScript Errors Fixed ✅
All TypeScript errors resolved, build passes successfully

---

## Database Models Used

### EMIPaymentSetting Model
```prisma
model EMIPaymentSetting {
  emiScheduleId          String   @unique
  enableFullPayment      Boolean  @default(true)
  enablePartialPayment   Boolean  @default(true)
  enableInterestOnly     Boolean  @default(true)
  useDefaultCompanyPage  Boolean  @default(true)
  secondaryPaymentPageId String?
}
```

### SecondaryPaymentPage Model
```prisma
model SecondaryPaymentPage {
  name          String
  upiId         String?
  qrCodeUrl     String?
  bankName      String?
  accountNumber String?
}
```

### BankAccount Model (Enhanced)
```prisma
model BankAccount {
  bankName      String
  accountNumber String
  ifscCode      String?
  branchName    String?
  upiId         String?   // NEW
  qrCodeUrl     String?   // NEW
  isDefault     Boolean   @default(false)  // NEW
}
```

---

## Git Commits This Session
1. `3defd35` - fix: resolve TypeScript type errors
2. `e096488` - feat: integrate company bank account with payment settings
3. `f9d4d03` - fix: resolve TypeScript type error in payment-request API
4. `3478202` - docs: update worklog with session changes
5. `ea4c59a` - feat: apply per-EMI payment settings in customer payment dialog
6. `8a7fce9` - feat: add Secondary Payment Pages UI management in AccountantDashboard

---

## CURRENT SESSION (Morning Recovery)

### What was recovered:
1. Pulled all commits from remote repository
2. Verified all features are in place:
   - Per-EMI Payment Option Toggle ✅
   - Company Bank Account System with UPI/QR ✅
   - Customer Payment Page shows Company Bank Details ✅
   - Secondary Payment Pages UI ✅

### Added this session:
- Secondary Payment Pages UI section in AccountantDashboard
- Create Payment Page dialog with all fields
- Delete functionality for secondary pages

---

## How to Check Each Feature

### 1. Per-EMI Payment Settings
1. Login as Customer
2. Go to any active loan
3. See Settings (⚙️) icon on each EMI row
4. Click to toggle Full/Partial/Interest Only options

### 2. Company Bank Account
1. Login as Accountant
2. Go to Bank Accounts section
3. Add Bank Account with UPI ID, QR Code URL
4. Set as Default

### 3. Customer Payment
1. Customer views loan → clicks EMI
2. Sees company's default bank account details

### 4. Secondary Payment Pages
1. Accountant → Bank Accounts section
2. Scroll to "Secondary Payment Pages"
3. Add/Delete payment pages

---

---
Task ID: 5
Agent: Main Agent
Task: Move Per-EMI Settings from Customer View to Staff Roles

Work Log:
- Removed Settings icon from CustomerLoanDetailPage (customer view)
- Added EMI Settings to SuperAdminDashboard loan detail panel
- Added EMI Settings to EMICollectionSection (used by Agent, Staff, Company dashboards)
- Added EMI Settings to LoanDetailPanel (used by Staff, Cashier dashboards)
- Updated all components with proper state management for EMI settings dialog
- Fixed TypeScript errors and verified all changes compile correctly

Stage Summary:
- Customers can no longer change EMI payment settings
- Staff roles (SuperAdmin, Agent, Staff, Company, Cashier) can now control payment options per EMI
- Settings available in:
  - SuperAdminDashboard → Active Loans → View Loan → EMI Tab
  - EMICollectionSection → Settings icon on each EMI card
  - LoanDetailPanel → Settings icon on each EMI row
- Git commit: 605eb9b - pushed to master

Key Files Modified:
1. /src/components/customer/CustomerLoanDetailPage.tsx - Removed Settings icon
2. /src/components/admin/SuperAdminDashboard.tsx - Added EMI Settings button
3. /src/components/emi/EMICollectionSection.tsx - Added EMI Settings button
4. /src/components/loan/LoanDetailPanel.tsx - Added EMI Settings button

---

---
Task ID: 6
Agent: Main Agent
Task: Add Secondary Payment Pages Section to All Staff Roles (Except Accountant)

Work Log:
- Created reusable SecondaryPaymentPagesSection component in src/components/payment/
- Added the component to SuperAdminDashboard (in Settings tab)
- Added the component to AgentDashboard (in EMI Collection tab)
- Added the component to CompanyDashboard (in EMI Collection tab)
- Added the component to StaffDashboard (in Active Loans tab)
- Added the component to CashierDashboard (in Active Loans and Payment Requests tabs)
- Removed old Secondary Payment Pages UI from AccountantDashboard
- Updated API to fetch all secondary pages or filter by company
- Added API endpoint for creating secondary pages via POST with action parameter

Stage Summary:
- All staff roles (SuperAdmin, Agent, Staff, Company, Cashier) now have Secondary Payment Pages section
- Accountant role does NOT have this section (per user requirement)
- Each company can have multiple secondary payment pages
- When staff changes EMI payment settings, they only see pages belonging to the loan's company
- Customers will see the selected payment page when paying their EMI
- Git commit: ae3c708 - pushed to master

Key Files Created:
1. /src/components/payment/SecondaryPaymentPagesSection.tsx - New reusable component

Key Files Modified:
1. /src/components/admin/SuperAdminDashboard.tsx
2. /src/components/agent/AgentDashboard.tsx
3. /src/components/company/CompanyDashboard.tsx
4. /src/components/staff/StaffDashboard.tsx
5. /src/components/cashier/CashierDashboard.tsx
6. /src/components/accountant/AccountantDashboard.tsx
7. /src/app/api/emi-payment-settings/route.ts

Flow:
1. Staff (any role except Accountant) creates a Secondary Payment Page for their company
2. When another staff member opens EMI Settings for a loan:
   - If loan is from Company A → only Company A's secondary pages are shown
   - Staff selects a payment page (e.g., "Partner Collection Point A1")
3. Customer pays EMI → sees the selected payment page details

---

---
Task ID: 7
Agent: Main Agent
Task: Verify Secondary Payment Pages Implementation with Image Upload

Work Log:
- Reviewed all dashboards for SecondaryPaymentPagesSection integration
- Verified component is added to: SuperAdminDashboard, AgentDashboard, StaffDashboard, CompanyDashboard, CashierDashboard
- Verified AccountantDashboard does NOT have SecondaryPaymentPagesSection (correct per requirements)
- Verified image upload functionality uses file upload (not URL link) via /api/upload/qr-code endpoint
- The QR code upload: saves to /public/uploads/qr-codes/ with unique filename
- No URL input field - only upload button for QR code images

Stage Summary:
- Secondary Payment Pages feature is fully implemented with IMAGE UPLOAD (not links)
- All staff roles except Accountant can create secondary payment pages
- QR Code images are uploaded directly to server (public/uploads/qr-codes/)
- Maximum file size: 5MB
- Allowed formats: PNG, JPG, WEBP, GIF
- Images are stored locally and served from /uploads/qr-codes/

Image Upload Implementation Details:
1. File input with accept="image/*"
2. Upload button triggers file selection
3. On select, file is sent to /api/upload/qr-code via POST
4. Server validates file type and size
5. Creates unique filename with timestamp
6. Saves to public/uploads/qr-codes/
7. Returns URL path (/uploads/qr-codes/filename.png)
8. Preview shown in dialog with remove option

Key Files:
1. /src/components/payment/SecondaryPaymentPagesSection.tsx - UI with upload
2. /src/app/api/upload/qr-code/route.ts - Server-side upload handling

---

---
Task ID: 8
Agent: Main Agent
Task: Add Dedicated Payment Pages Section to All Roles (Except Accountant)

Work Log:
- Added 'payment-pages' menu item to all roles in DashboardLayout.tsx:
  - SUPER_ADMIN: Payment Pages menu item added
  - COMPANY: Payment Pages menu item added
  - AGENT: Payment Pages menu item added
  - STAFF: Payment Pages menu item added
  - CASHIER: Payment Pages menu item added
  - ACCOUNTANT: No Payment Pages (per requirement)
  - CUSTOMER: No Payment Pages (customer role)
- Removed embedded SecondaryPaymentPagesSection from all dashboards
- Added dedicated 'payment-pages' case in renderContent() for each dashboard
- Each dashboard now has a proper separate tab for Payment Pages
- All users (except Accountant) see the SAME payment pages - shared data

Stage Summary:
- Payment Pages is now a dedicated sidebar menu item
- All roles except Accountant can access and manage payment pages
- Everyone sees and edits the same shared payment pages
- Image upload (not links) for QR codes
- CompanyDashboard passes companyId prop for company-specific filtering

Key Files Modified:
1. /src/components/layout/DashboardLayout.tsx - Added menu items
2. /src/components/admin/SuperAdminDashboard.tsx - Added payment-pages case
3. /src/components/agent/AgentDashboard.tsx - Added payment-pages case
4. /src/components/staff/StaffDashboard.tsx - Added payment-pages case
5. /src/components/company/CompanyDashboard.tsx - Added payment-pages case
6. /src/components/cashier/CashierDashboard.tsx - Added payment-pages case

---
Task ID: 8
Agent: Main Agent
Task: Add Dedicated 'payment-pages' Tab to All 5 Dashboards

Work Log:
- Updated SuperAdminDashboard.tsx:
  - Removed embedded SecondaryPaymentPagesSection from 'settings' case
  - Added new 'payment-pages' case in renderContent()
- Updated AgentDashboard.tsx:
  - Removed embedded SecondaryPaymentPagesSection from 'emi-collection' case
  - Added new 'payment-pages' case in renderContent()
- Updated StaffDashboard.tsx:
  - Removed embedded SecondaryPaymentPagesSection from 'activeLoans' case
  - Added new 'payment-pages' case in renderContent()
- Updated CompanyDashboard.tsx:
  - Removed embedded SecondaryPaymentPagesSection from 'emi-collection' case
  - Added new 'payment-pages' case in renderContent() with companyId prop
- Updated CashierDashboard.tsx:
  - Removed embedded SecondaryPaymentPagesSection from 'activeLoans' case
  - Removed embedded SecondaryPaymentPagesSection from 'paymentRequests' case
  - Added new 'payment-pages' case in renderContent()

Stage Summary:
- All 5 dashboards now have a dedicated 'payment-pages' tab in the renderContent() function
- SecondaryPaymentPagesSection is no longer embedded in other tabs
- Each dashboard has a clean, dedicated section for managing secondary payment pages
- CompanyDashboard includes the companyId prop, others just use userId
- Lint passes with no errors
- Dev server running without issues

Key Files Modified:
1. /src/components/admin/SuperAdminDashboard.tsx
2. /src/components/agent/AgentDashboard.tsx
3. /src/components/staff/StaffDashboard.tsx
4. /src/components/company/CompanyDashboard.tsx
5. /src/components/cashier/CashierDashboard.tsx

---
Task ID: 1
Agent: Main Agent
Task: Modify Location History Feature - User List First, Then User-Specific Logs

Work Log:
- Read the current LocationHistoryViewer.tsx component
- Analyzed the existing location track API for POST and GET endpoints
- Completely rewrote LocationHistoryViewer.tsx with the following changes:
  - Added `selectedUser` state to track which user is being viewed
  - Added `userSearchQuery` state for filtering users
  - Added `capturingLocation` state for the live location capture button
  - Created `usersWithLocationCounts` computed array from location data
  - Created `filteredUsers` for user search/filter functionality
  - Split rendering into two functions: `renderUserList()` and `renderUserLocationLogs()`
  - `renderUserList()` shows:
    - Header stats cards (Total Records, Unique Users, Today's Activity)
    - Role filter buttons
    - Searchable user list with avatar, name, email, role badge, location count
  - `renderUserLocationLogs()` shows:
    - Back to Users button
    - User info header with avatar, name, email, role badge
    - "Capture Live Location" button with prominent emerald styling
    - Location logs filtered for selected user
  - Added `captureLiveLocation()` function that:
    - Uses `navigator.geolocation.getCurrentPosition()` to get browser location
    - Detects device type, browser, and OS from user agent
    - Makes POST request to `/api/location/track` to save the location
    - Shows success/error toast notifications
    - Refreshes location list after successful capture
  - Added error handling for geolocation permission denied, position unavailable, timeout

Stage Summary:
- Location History now shows user list first (not direct location logs)
- Users displayed with: avatar, name, email, role badge, location count
- Search/filter functionality for users
- Click on user to see their specific location logs
- "Capture Live Location" button captures browser location and saves to database
- "Back to Users" button to return to user list
- Lint passes with no errors
- Dev server running without issues

Key Files Modified:
1. /src/components/admin/LocationHistoryViewer.tsx - Complete rewrite with user-first approach

Features Implemented:
1. **User List View**:
   - Shows all users with location history
   - Displays avatar, name, email, role badge, location count
   - Searchable by name, email, phone
   - Filterable by role

2. **User-Specific Location Logs**:
   - Click on a user to see their logs
   - Back button to return to user list
   - Shows same location log details as before

3. **Capture Live Location**:
   - Prominent green button in user detail view
   - Uses browser's Geolocation API
   - Auto-detects device type, browser, OS
   - Saves to database via API
   - Success/error toast notifications

---
Task ID: 2
Agent: Main Agent
Task: Create Money Section Component for Super Admin Dashboard

Work Log:
- Analyzed existing patterns from SuperAdminMyCredit.tsx and CreditManagementPage.tsx
- Reviewed Prisma schema for CreditTransaction, Company, BankAccount, and User models
- Created API endpoint /api/reports/money-summary/route.ts with:
  - Date filter support (single date or date range)
  - In-memory caching (60 second TTL)
  - Total EMI collected calculation
  - Total money collected from all sources
  - Breakdown by payment mode (CASH, UPI, BANK_TRANSFER, CHEQUE, ONLINE)
  - Company-wise breakdown of collections
  - Collector-wise performance data
  - Company credit summary (all companies with credit status)
  - Money flow tracking (bank accounts, credit management)
- Created MoneySection.tsx component with:
  - Date picker (single date or date range mode)
  - Today's Summary cards (EMI collected, total collected, company credits, personal credits)
  - Payment mode breakdown with visual progress bars
  - Tabs for:
    - Company-wise Income (company collection table)
    - Collector Performance (staff collection breakdown)
    - Money Flow (bank accounts + credit management)
    - Credit Summary (company-wise credit status)
  - Responsive design with proper styling
  - Uses existing shadcn/ui components
  - Follows existing codebase patterns

Stage Summary:
- API endpoint provides comprehensive money summary data
- Component shows all required features:
  - Today's Summary with totals and breakdown
  - Date Filter (single/range)
  - Company-wise Income table
  - Money Flow visualization (bank accounts, credit holders)
- Lint passes with no errors
- Dev server running without issues

Key Files Created:
1. /src/app/api/reports/money-summary/route.ts - API endpoint for money summary
2. /src/components/credit/MoneySection.tsx - Money Section component

---
