import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 8) throw new Error("Set ADMIN_PASSWORD (8+ characters) in .env");
  await db.user.upsert({
    where: { email },
    create: { email, name: "Admin", role: "ADMIN", passwordHash: await bcrypt.hash(password, 11) },
    update: { role: "ADMIN", passwordHash: await bcrypt.hash(password, 11) },
  });
  console.log(`Admin ready: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
