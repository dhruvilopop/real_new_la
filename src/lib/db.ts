import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Prisma configuration optimized for limited database connections
// Hostinger MySQL has max_connections_per_hour limit (500)
// We use connection pooling and keep-alive to minimize connections

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    // Connection pooling is configured in DATABASE_URL
    // But we also set these options for better connection management
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })
}

// Use global singleton to prevent multiple Prisma instances in development
// This is crucial for preventing connection pool exhaustion
export const db = globalForPrisma.prisma || prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Graceful shutdown to properly close connections
if (typeof window === 'undefined') {
  // Only run on server side
  process.on('beforeExit', async () => {
    await db.$disconnect()
  })
}

// MySQL connected to Hostinger database - Optimized with connection pooling
