import 'dotenv/config';
import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from 'bcryptjs';

// Admin credentials configuration
const ADMIN_CONFIG = {
  email: "admin@taskflow.com",
  password: "Admin123!",
  firstName: "System",
  lastName: "Administrator",
  role: "admin" as const
};

async function createAdminUser() {
  try {
    console.log("Creating admin user...");
    
    // Check if admin already exists
    const existingAdmin = await db.select().from(users).where(eq(users.email, ADMIN_CONFIG.email));
    if (existingAdmin.length > 0) {
      console.log("❌ Admin user already exists!");
      console.log("Email:", ADMIN_CONFIG.email);
      console.log("If you need to reset the password, delete the user first or use the seeder script.");
      process.exit(1);
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(ADMIN_CONFIG.password, 12);
    
    // Create admin user
    const [admin] = await db.insert(users).values({
      email: ADMIN_CONFIG.email,
      password: hashedPassword,
      firstName: ADMIN_CONFIG.firstName,
      lastName: ADMIN_CONFIG.lastName,
      role: ADMIN_CONFIG.role,
      isActive: true,
    }).returning();
    
    console.log("✅ Admin user created successfully!");
    console.log("Email:", ADMIN_CONFIG.email);
    console.log("Password:", ADMIN_CONFIG.password);
    console.log("Please change the password after first login.");
    console.log("");
    console.log("💡 Tip: Use 'npm run db:seed' to populate the database with sample data!");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
    process.exit(1);
  }
}

createAdminUser();
