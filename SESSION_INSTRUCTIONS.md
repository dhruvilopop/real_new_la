# Money Mitra - Loan Management System

## 🚀 Quick Start

### First Time Setup
```bash
bun install
bun run db:generate
bun run dev
```

### Environment Setup
Create a `.env` file with:
```
DATABASE_URL="mysql://u366636586_new_loan:Mahadev%406163@77.37.35.177:3306/u366636586_new_loan"
```

## 📦 GitHub Repository
- Repository: https://github.com/dhruvilopop/real_new_la

## 🔄 Session Continuity

### Before Closing Session
Run this to sync all changes to GitHub:
```bash
git add -A
git commit -m "save: Progress update"
git push origin master
```

### When Starting New Session
1. Clone or pull the latest code:
```bash
git pull origin master
```
2. Install dependencies and setup:
```bash
bun install
bun run db:generate
```

## 🗄️ Database
- **Host:** 77.37.35.177 (srv914.hstgr.io)
- **Database:** u366636586_new_loan
- **Tables:** 62 tables (MySQL)

## 🌐 Vercel Deployment

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel:
   - `DATABASE_URL`: Your MySQL connection string
3. Deploy!

### Vercel CLI (Optional)
```bash
vercel --prod
```

## 📁 Project Structure
- `/src/app` - Next.js App Router pages and API routes
- `/src/components` - React components
- `/src/lib` - Utilities and database client
- `/prisma` - Database schema

## 🛠️ Tech Stack
- Next.js 16 with Turbopack
- TypeScript
- Prisma ORM
- MySQL (Hostinger)
- Tailwind CSS
- shadcn/ui Components
