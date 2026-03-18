# SMFC Finance - Digital Loan Management Platform

A production-ready, multi-role loan management system built with Next.js, Prisma, and SQLite.

## 🚀 Features

### Role-Based Access Control
- **Super Admin**: Complete system control, user management, analytics
- **Company**: Approve loans, manage agents, portfolio management
- **Agent**: Create loan sessions, manage staff, EMI calculator
- **Staff**: Verify loan applications, field visits
- **Cashier**: Disburse loans, manage payments
- **Customer**: Apply for loans, track EMIs, make payments

### Loan Workflow
1. Customer applies for loan
2. Super Admin approves and assigns to Company
3. Company approves and assigns to Agent
4. Agent assigns Staff for verification
5. Staff completes verification form
6. Agent creates loan session with EMI details
7. Customer approves session
8. Super Admin gives final approval
9. Cashier disburses the loan
10. EMI schedule auto-generated

### Key Features
- ✅ Firebase Authentication (Email/Password, Google)
- ✅ Multi-stage loan approval workflow
- ✅ EMI calculation engine with amortization schedule
- ✅ Real-time notifications
- ✅ Location tracking for field visits
- ✅ Mobile-responsive design
- ✅ Toast notifications
- ✅ Settings management
- ✅ CMS for loan products

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Database**: SQLite with Prisma ORM
- **Auth**: Firebase Authentication
- **Icons**: Lucide React
- **Animations**: Framer Motion

## 📦 Installation

```bash
# Clone the repository
git clone <repository-url>
cd my-project

# Install dependencies
bun install

# Setup database
bun run db:push

# Seed database with test data
bun run db:seed

# Start development server
bun run dev
```

## 🔐 Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@smfc.com | admin123 |
| Company | company@smfc.com | company123 |
| Agent | agent@smfc.com | agent123 |
| Staff | staff@smfc.com | staff123 |
| Cashier | cashier@smfc.com | cashier123 |
| Customer | customer@test.com | customer123 |

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/           # Authentication routes
│   │   ├── workflow/       # Loan workflow routes
│   │   ├── loan/           # Loan management
│   │   ├── emi/            # EMI schedule management
│   │   ├── user/           # User CRUD operations
│   │   ├── session/        # Loan session management
│   │   ├── notification/   # Notifications
│   │   ├── location/       # GPS tracking
│   │   ├── settings/       # System settings
│   │   └── cms/            # Content management
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── admin/              # Super Admin dashboard
│   ├── agent/              # Agent dashboard
│   ├── cashier/            # Cashier dashboard
│   ├── company/            # Company dashboard
│   ├── customer/           # Customer dashboard
│   ├── staff/              # Staff dashboard
│   ├── landing/            # Landing page
│   ├── layout/             # Shared layout
│   ├── notification/       # Notification components
│   └── ui/                 # UI components (shadcn)
├── contexts/
│   ├── AuthContext.tsx     # Authentication state
│   └── SettingsContext.tsx # App settings
├── hooks/
│   └── use-toast.ts        # Toast notifications
├── lib/
│   ├── db.ts               # Prisma client
│   ├── firebase.ts         # Firebase config
│   └── utils.ts            # Utility functions
└── utils/
    └── helpers.ts          # Helper functions (EMI calc, etc.)
```

## 🔧 Available Scripts

```bash
bun run dev        # Start development server
bun run build      # Build for production
bun run start      # Start production server
bun run lint       # Run ESLint
bun run db:push    # Push schema to database
bun run db:seed    # Seed database with test data
```

## 📊 Database Schema

### Core Tables
- **User**: Multi-role user management
- **Company**: Lending companies
- **LoanApplication**: Loan applications with full lifecycle
- **SessionForm**: Loan session details (amount, EMI, tenure)
- **EMISchedule**: EMI installments
- **Payment**: Payment records
- **WorkflowLog**: Audit trail

### Supporting Tables
- **Notification**: User notifications
- **LocationLog**: GPS tracking
- **AuditLog**: System audit
- **CMSService**: Loan products
- **SystemSetting**: App configuration

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/staff-login` - Staff authentication
- `POST /api/auth/customer-login` - Customer authentication
- `POST /api/auth/customer-register` - Customer registration
- `POST /api/auth/sync` - Sync user with database

### Workflow
- `POST /api/workflow/approve` - Process workflow actions
- `GET /api/workflow/approve` - Get workflow status

### Loans
- `GET /api/loan/list` - List loans (role-filtered)
- `POST /api/loan/apply` - Submit new application

### EMI
- `GET /api/emi` - Get EMI schedules
- `POST /api/emi` - Generate EMI schedule

### Payments
- `GET /api/customer/payment` - Get payments
- `POST /api/customer/payment` - Process payment

## 🎨 UI Components

Built with shadcn/ui:
- Dialog, Sheet, Popover
- Form inputs (Input, Select, Textarea)
- Cards, Badges, Buttons
- Toast notifications
- Scroll areas, Avatars

## 📱 Responsive Design

- Mobile-first approach
- Bottom navigation for mobile
- Responsive sidebar for desktop
- Touch-friendly interactions

## 🔒 Security

- Password hashing with bcrypt
- Firebase authentication
- Role-based access control
- Session management
- Location tracking for field staff

## 📈 Production Checklist

- [ ] Configure production Firebase project
- [ ] Set up proper SSL certificates
- [ ] Configure production database
- [ ] Set up backup strategy
- [ ] Configure email/SMS services
- [ ] Set up monitoring and logging
- [ ] Configure CDN for static assets
- [ ] Set up rate limiting
- [ ] Configure CORS properly
- [ ] Review and update security headers

## 📄 License

MIT License

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open Pull Request
