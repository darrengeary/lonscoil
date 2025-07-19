// prisma/seed.js
const { PrismaClient, UserRole } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // 1) Create an admin
  await prisma.user.upsert({
    where: { email: 'admin@school.io' },
    update: {},
    create: {
      name:  'Site Admin',
      email: 'admin@school.io',
      role:  UserRole.ADMIN,
      // emailVerified: new Date(),
    },
  })

  // 2) Create a normal user
  await prisma.user.upsert({
    where: { email: 'user@school.io' },
    update: {},
    create: {
      name:  'Jane Doe',
      email: 'user@school.io',
      role:  UserRole.USER,
    },
  })

  console.log('✅ Seed completed')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
