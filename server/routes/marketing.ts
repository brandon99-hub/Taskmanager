import type { Express } from "express";
import { db } from "../db";
import { logProjectAction } from "../middleware/comprehensiveAudit";
import {
  marketingUsers,
  marketingSectors,
  marketingProjects,
  marketingProspects,
  marketingSalesWon,
  marketingExpectedOrders,
  marketingAnnualSummary,
  marketingLostProjects,
} from "../../shared/schema";
import {
  marketingUserLoginSchema,
  marketingUserRegisterSchema,
  marketingUserUpdateSchema,
  marketingSectorCreateSchema,
  marketingSectorUpdateSchema,
  marketingProjectCreateSchema,
  marketingProjectUpdateSchema,
  marketingProspectCreateSchema,
  marketingProspectUpdateSchema,
  marketingSharedAccountSchema,
  marketingSalesWonCreateSchema,
  marketingSalesWonUpdateSchema,
  marketingExpectedOrdersCreateSchema,
  marketingExpectedOrdersUpdateSchema,
  marketingAnnualSummaryCreateSchema,
  marketingAnnualSummaryUpdateSchema,
  marketingQuerySchema,
  marketingExportSchema,
} from "../../shared/marketingSchema";
import {
  marketingAuth,
  marketingAdminAuth,
  marketingUserAuth,
  generateMarketingToken,
  hashMarketingPassword,
  verifyMarketingPassword,
} from "../middleware/marketingAuth";
import { eq, and, desc, asc, like, sql, count, lt, or } from "drizzle-orm";
import { generateExcelBuffer } from "../utils/excelExport";
import { z } from "zod";
import { emailService } from "../services/emailService";

export function registerMarketingRoutes(app: Express) {
  // Forgot password (marketing)
  app.post("/api/marketing/auth/forgot-password", async (req, res) => {
    try {
      const email = (req.body?.email || "").toString().trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Find active user
      const users = await db
        .select()
        .from(marketingUsers)
        .where(and(eq(marketingUsers.email, email), eq(marketingUsers.isActive, true)))
        .limit(1);

      // Always respond 200 to avoid user enumeration
      const baseUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || `${req.protocol}://${req.get('host')}`;

      if (users.length > 0) {
        const user = users[0];
        // Generate token
        const { randomUUID } = await import('crypto');
        const rawToken = randomUUID();

        // Hash token for storage
        const tokenHash = await hashMarketingPassword(rawToken);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

        await db
          .update(marketingUsers)
          .set({ resetToken: tokenHash as any, resetTokenExpiry: expiresAt as any })
          .where(eq(marketingUsers.id, user.id));

        const resetLink = `${baseUrl}/marketing/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;

        // Send email (best-effort)
        try {
          await emailService.sendPasswordResetEmail({ to: email, userName: user.firstName || email, resetLink });
        } catch (e) {
          console.error("Marketing forgot-password: failed to send email", e);
        }
      }

      return res.json({ message: "If the email exists, a reset link has been sent." });
    } catch (error) {
      console.error("Marketing forgot-password error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Reset password (marketing)
  app.post("/api/marketing/auth/reset-password", async (req, res) => {
    try {
      const token = (req.body?.token || "").toString();
      const newPassword = (req.body?.newPassword || "").toString();
      const email = (req.body?.email || "").toString().trim().toLowerCase();

      if (!token || !newPassword || !email) {
        return res.status(400).json({ error: "Token, email and newPassword are required" });
      }

      const users = await db
        .select()
        .from(marketingUsers)
        .where(and(eq(marketingUsers.email, email), eq(marketingUsers.isActive, true)))
        .limit(1);

      if (users.length === 0) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      const user = users[0] as any;
      if (!user.resetToken || !user.resetTokenExpiry) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      const nowIso = new Date().toISOString();
      if (nowIso > user.resetTokenExpiry) {
        return res.status(400).json({ error: "Reset token expired" });
      }

      const isTokenValid = await verifyMarketingPassword(token, user.resetToken);
      if (!isTokenValid) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      const hashed = await hashMarketingPassword(newPassword);

      await db
        .update(marketingUsers)
        .set({
          password: hashed as any,
          mustChangePassword: false as any,
          resetToken: null as any,
          resetTokenExpiry: null as any,
        })
        .where(eq(marketingUsers.id, user.id));

      return res.json({ message: "Password reset successful" });
    } catch (error) {
      console.error("Marketing reset-password error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  // Marketing Authentication Routes
  app.post("/api/marketing/auth/login", async (req, res) => {
    try {
      const { email, password } = marketingUserLoginSchema.parse(req.body);

      const users = await db
        .select()
        .from(marketingUsers)
        .where(and(eq(marketingUsers.email, email), eq(marketingUsers.isActive, true)))
        .limit(1);

      if (users.length === 0) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const user = users[0];
      const isValidPassword = await verifyMarketingPassword(password, user.password);

      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Update last login
      await db
        .update(marketingUsers)
        .set({ lastLoginAt: new Date().toISOString() } as any)
        .where(eq(marketingUsers.id, user.id));

      const token = generateMarketingToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/marketing/auth/register", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      const userData = marketingUserRegisterSchema.parse(req.body);
      const hashedPassword = await hashMarketingPassword(userData.password);

      const newUser = await db
        .insert(marketingUsers)
        .values({
          ...userData,
          password: hashedPassword,
          mustChangePassword: true, // Force password change on first login
        } as any)
        .returning();

      // Fire-and-forget welcome email with credentials
      (async () => {
        try {
          const loginUrl = (process.env.FRONTEND_URL || process.env.CLIENT_URL || "") + "/marketing/login";
          await emailService.sendEmail({
            to: newUser[0].email,
            subject: "Your TaskFlow Marketing Account",
            html: `
              <div style="font-family: Arial, sans-serif; line-height:1.5;">
                <h2>Welcome to TaskFlow Marketing</h2>
                <p>Hi ${newUser[0].firstName},</p>
                <p>Your marketing account has been created by the administrator. Use the credentials below to sign in.</p>
                <ul>
                  <li><strong>Email:</strong> ${newUser[0].email}</li>
                  <li><strong>Password:</strong> ${userData.password}</li>
                  <li><strong>Role:</strong> ${newUser[0].role}</li>
                </ul>
                <p>You can log in here: <a href="${loginUrl}">${loginUrl}</a></p>
                <p>For security, please change your password after your first login.</p>
                <p>Regards,<br/>TaskFlow Team</p>
              </div>
            `.trim(),
            text: `Welcome to TaskFlow Marketing

Email: ${newUser[0].email}
Password: ${userData.password}
Role: ${newUser[0].role}

Login: ${loginUrl}

Please change your password after first login.`
          });
        } catch (e) {
          console.error("Failed to send marketing user welcome email:", e);
        }
      })();

      res.status(201).json({
        user: {
          id: newUser[0].id,
          email: newUser[0].email,
          firstName: newUser[0].firstName,
          lastName: newUser[0].lastName,
          role: newUser[0].role,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Marketing Password Change Route
  app.post("/api/marketing/auth/change-password", marketingAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6),
      }).parse(req.body);

      const user = req.marketingUser!;
      
      // Verify current password
      const isValidPassword = await verifyMarketingPassword(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      // Hash new password
      const hashedNewPassword = await hashMarketingPassword(newPassword);

      // Update password and clear mustChangePassword flag
      await db
        .update(marketingUsers)
        .set({
          password: hashedNewPassword,
          mustChangePassword: false,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(marketingUsers.id, user.id));

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Password change error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Sectors Management Routes (Admin only for management, all users can read)
  app.get("/api/marketing/sectors", marketingAuth, async (req, res) => {
    try {
      const { page, limit, search } = marketingQuerySchema.parse(req.query);
      const offset = (page - 1) * limit;
      let whereCondition: any = eq(marketingSectors.isActive, true);

      if (search) {
        whereCondition = and(
          eq(marketingSectors.isActive, true),
          like(marketingSectors.name, `%${search}%`)
        );
      }

      const [sectors, totalCount] = await Promise.all([
        db
          .select()
          .from(marketingSectors)
          .where(whereCondition)
          .orderBy(desc(marketingSectors.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: count() })
          .from(marketingSectors)
          .where(whereCondition),
      ]);

      res.json({
        sectors,
        pagination: {
          page,
          limit,
          total: totalCount[0].count,
          pages: Math.ceil(totalCount[0].count / limit),
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/marketing/sectors", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      const sectorData = marketingSectorCreateSchema.parse(req.body);

      const newSector = await db
        .insert(marketingSectors)
        .values({
          ...sectorData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any)
        .returning();

      res.status(201).json({ sector: newSector[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/marketing/sectors/:id", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = marketingSectorUpdateSchema.parse(req.body);

      const updatedSector = await db
        .update(marketingSectors)
        .set({ ...updateData, updatedAt: new Date().toISOString() } as any)
        .where(eq(marketingSectors.id, id))
        .returning();

      if (updatedSector.length === 0) {
        return res.status(404).json({ error: "Sector not found" });
      }

      res.json({ sector: updatedSector[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/marketing/sectors/:id", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;

      const updatedSector = await db
        .update(marketingSectors)
        .set({ 
          isActive: false, 
          updatedAt: new Date().toISOString() 
        } as any)
        .where(eq(marketingSectors.id, id))
        .returning();

      if (updatedSector.length === 0) {
        return res.status(404).json({ error: "Sector not found" });
      }

      res.json({ message: "Sector deactivated successfully" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Projects Management Routes (Admin only)
  app.get("/api/marketing/projects", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      const { page, limit, search, sectorId } = marketingQuerySchema.parse(req.query);
      const offset = (page - 1) * limit;
      let whereCondition: any = undefined;

      if (search) {
        whereCondition = like(marketingProjects.institution, `%${search}%`);
      }

      if (sectorId) {
        whereCondition = whereCondition 
          ? and(whereCondition, eq(marketingProjects.sectorId, sectorId))
          : eq(marketingProjects.sectorId, sectorId);
      }

      const [projects, totalCount] = await Promise.all([
        db
          .select({
            id: marketingProjects.id,
            institution: marketingProjects.institution,
            status: marketingProjects.status,
            sectorId: marketingProjects.sectorId,
            leadMarketer: marketingProjects.leadMarketer,
            contactPerson: marketingProjects.contactPerson,
            contactNumber: marketingProjects.contactNumber,
            systemInPlace: marketingProjects.systemInPlace,
            needAvailability: marketingProjects.needAvailability,
            currentVendor: marketingProjects.currentVendor,
            remarks: marketingProjects.remarks,
            createdAt: marketingProjects.createdAt,
            updatedAt: marketingProjects.updatedAt,
            sectorName: marketingSectors.name,
            bdName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
            bdEmail: marketingUsers.email,
          })
          .from(marketingProjects)
          .leftJoin(marketingSectors, eq(marketingProjects.sectorId, marketingSectors.id))
          .leftJoin(marketingUsers, eq(marketingProjects.leadMarketer, marketingUsers.id))
          .where(whereCondition)
          .orderBy(desc(marketingProjects.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: count() })
          .from(marketingProjects)
          .where(whereCondition),
      ]);

      res.json({
        projects,
        pagination: {
          page,
          limit,
          total: totalCount[0].count,
          pages: Math.ceil(totalCount[0].count / limit),
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/marketing/projects", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      console.log("Received project creation request:", req.body);
      const projectData = marketingProjectCreateSchema.parse(req.body);

      const newProject = await db
        .insert(marketingProjects)
        .values({
          ...projectData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any)
        .returning();

      // Send email notification to assigned BD member (only if leadMarketer is assigned)
      if (projectData.leadMarketer) {
        try {
          const bdUser = await db
            .select()
            .from(marketingUsers)
            .where(eq(marketingUsers.id, projectData.leadMarketer))
            .limit(1);

        if (bdUser.length > 0) {
          const sector = await db
            .select()
            .from(marketingSectors)
            .where(eq(marketingSectors.id, projectData.sectorId))
            .limit(1);

          await emailService.sendEmail({
            to: bdUser[0].email,
            subject: "New Project Assignment",
            html: `
              <h2>New Project Assignment</h2>
              <p>Hello ${bdUser[0].firstName},</p>
              <p>A new project has been assigned to you:</p>
              <p><strong>Project:</strong> ${projectData.institution}</p>
              <p><strong>Sector:</strong> ${sector[0]?.name || 'Unknown'}</p>
              <p>Please log in to view details and start working on this project.</p>
            `,
            text: `New Project Assignment

Hello ${bdUser[0].firstName},

A new project has been assigned to you:
Project: ${projectData.institution}
Sector: ${sector[0]?.name || 'Unknown'}

Please log in to view details.`
          });
        }
        } catch (emailError) {
          console.error("Failed to send project assignment email:", emailError);
        }
      }

      res.status(201).json({ project: newProject[0] });
    } catch (error) {
      console.error("Project creation error:", error);
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.errors);
        return res.status(400).json({ 
          error: "Validation error", 
          details: error.errors,
          receivedData: req.body
        });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update Project Route
  app.put("/api/marketing/projects/:id", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      console.log("Received project update request:", {
        id,
        body: req.body
      });
      
      const updateData = marketingProjectUpdateSchema.parse(req.body);
      
      console.log("Parsed update data:", updateData);

      const updatedProject = await db
        .update(marketingProjects)
        .set({ ...updateData, updatedAt: new Date().toISOString() } as any)
        .where(eq(marketingProjects.id, id))
        .returning();

      if (updatedProject.length === 0) {
        return res.status(404).json({ error: "Project not found" });
      }

      res.json({ project: updatedProject[0] });
    } catch (error) {
      console.error("Project update error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Validation error", 
          details: error.errors,
          receivedData: req.body
        });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Marketing User Management Routes
  app.get("/api/marketing/users", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      const { page, limit, search } = marketingQuerySchema.parse(req.query);

      const offset = (page - 1) * limit;
      let whereCondition: any = eq(marketingUsers.isActive, true);

      if (search) {
        whereCondition = and(
          eq(marketingUsers.isActive, true),
          sql`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName}, ' ', ${marketingUsers.email}) ILIKE ${`%${search}%`}`
        );
      }

      const [users, totalCount] = await Promise.all([
        db
          .select({
            id: marketingUsers.id,
            email: marketingUsers.email,
            firstName: marketingUsers.firstName,
            lastName: marketingUsers.lastName,
            role: marketingUsers.role,
            isActive: marketingUsers.isActive,
            mustChangePassword: marketingUsers.mustChangePassword,
            lastLoginAt: marketingUsers.lastLoginAt,
            createdAt: marketingUsers.createdAt,
          })
          .from(marketingUsers)
          .where(whereCondition)
          .orderBy(desc(marketingUsers.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: count() })
          .from(marketingUsers)
          .where(whereCondition),
      ]);

      res.json({
        users,
        pagination: {
          page,
          limit,
          total: totalCount[0].count,
          pages: Math.ceil(totalCount[0].count / limit),
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/marketing/users/:id", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = marketingUserUpdateSchema.parse(req.body);

      const updatedUser = await db
        .update(marketingUsers)
        .set({ ...updateData, updatedAt: new Date().toISOString() } as any)
        .where(eq(marketingUsers.id, id))
        .returning();

      if (updatedUser.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        user: {
          id: updatedUser[0].id,
          email: updatedUser[0].email,
          firstName: updatedUser[0].firstName,
          lastName: updatedUser[0].lastName,
          role: updatedUser[0].role,
          isActive: updatedUser[0].isActive,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Marketing Project Assignment Route
  app.post("/api/marketing/projects/:id/assign", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { leadMarketer } = req.body;

      if (!leadMarketer) {
        return res.status(400).json({ error: "BD member assignment is required" });
      }

      // Check if project exists
      const existingProject = await db
        .select()
        .from(marketingProjects)
        .where(eq(marketingProjects.id, id))
        .limit(1);

      if (existingProject.length === 0) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Check if BD user exists and is active
      const bdUser = await db
        .select()
        .from(marketingUsers)
        .where(and(eq(marketingUsers.id, leadMarketer), eq(marketingUsers.isActive, true)))
        .limit(1);

      if (bdUser.length === 0) {
        return res.status(400).json({ error: "Invalid BD member" });
      }

      // Update project assignment
      const updatedProject = await db
        .update(marketingProjects)
        .set({
          leadMarketer,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(marketingProjects.id, id))
        .returning();

      // Create a prospect from the assigned project
      const project = existingProject[0];
      const newProspect = await db
        .insert(marketingProspects)
        .values({
          date: new Date().toISOString(),
          client: project.institution, // Using project institution as client name
          contactPerson: project.contactPerson || "To be determined",
          contactNumber: project.contactNumber || "To be determined", 
          contactEmail: "To be determined", // Projects don't store email, will need to be updated manually
          systemInPlace: project.systemInPlace || 'none',
          needAvailability: project.needAvailability || 'none',
          currentVendor: project.currentVendor || null,
          remarks: project.remarks ? `Converted from marketing project: ${project.institution}\n\nOriginal remarks: ${project.remarks}` : `Converted from marketing project: ${project.institution}`,
          stage: 'prospect',
          bdId: leadMarketer,
          sectorId: project.sectorId,
        })
        .returning();

      // Send email notification to assigned BD member
      try {
        await emailService.sendEmail({
          to: bdUser[0].email,
          subject: `🎯 New Project Assignment: ${project.institution}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; padding: 20px;">
              <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 30px;">
                  <div style="background-color: #3b82f6; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h1 style="margin: 0; font-size: 24px;">🎯 Project Assignment</h1>
                  </div>
                  <p style="color: #6b7280; font-size: 16px; margin: 0;">A new project has been assigned to you</p>
                </div>

                <!-- Project Details -->
                <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
                  <h2 style="color: #1e293b; margin-top: 0; margin-bottom: 15px; font-size: 20px;">📋 Project Details</h2>
                  <div style="margin-bottom: 10px;">
                    <strong style="color: #374151;">Institution:</strong>
                    <span style="color: #1f2937; margin-left: 8px;">${project.institution}</span>
                  </div>
                  <div style="margin-bottom: 10px;">
                    <strong style="color: #374151;">Prospect ID:</strong>
                    <span style="color: #1f2937; margin-left: 8px; font-family: monospace; background-color: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${newProspect[0].id}</span>
                  </div>
                  ${project.contactPerson && project.contactPerson !== "To be determined" ? `
                  <div style="margin-bottom: 10px;">
                    <strong style="color: #374151;">Contact Person:</strong>
                    <span style="color: #1f2937; margin-left: 8px;">${project.contactPerson}</span>
                  </div>
                  ` : ''}
                  ${project.contactNumber && project.contactNumber !== "To be determined" ? `
                  <div style="margin-bottom: 10px;">
                    <strong style="color: #374151;">Contact Number:</strong>
                    <span style="color: #1f2937; margin-left: 8px;">${project.contactNumber}</span>
                  </div>
                  ` : ''}
                </div>

                <!-- Next Steps -->
                <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 25px;">
                  <h3 style="color: #92400e; margin-top: 0; margin-bottom: 10px;">🚀 Next Steps</h3>
                  <ul style="color: #92400e; margin: 0; padding-left: 20px;">
                    <li>Log in to your marketing dashboard</li>
                    <li>Review the prospect details in the Prospects section</li>
                    <li>Update contact information if needed</li>
                    <li>Begin your outreach and qualification process</li>
                  </ul>
                </div>

                <!-- Call to Action -->
                <div style="text-align: center;">
                  <a href="${process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5000'}/marketing/dashboard" 
                     style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                    📊 View Dashboard
                  </a>
                </div>

                <!-- Footer -->
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                  <p style="color: #6b7280; font-size: 14px; margin: 0;">
                    This is an automated notification from TaskFlow Marketing Pipeline
                  </p>
                </div>
              </div>
            </div>
          `,
          text: `Project Assignment Notification

Hello ${bdUser[0].firstName},

A new project has been assigned to you:

Institution: ${project.institution}
Prospect ID: ${newProspect[0].id}
Contact Person: ${project.contactPerson || 'To be determined'}
Contact Number: ${project.contactNumber || 'To be determined'}

Next Steps:
- Log in to your marketing dashboard
- Review the prospect details
- Update contact email if available
- Begin your outreach process

Dashboard: ${process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5000'}/marketing/dashboard`
        });
      } catch (emailError) {
        console.error("Failed to send assignment email:", emailError);
      }

      res.json({
        message: "Project assigned successfully",
        project: updatedProject[0],
        prospect: newProspect[0],
      });
    } catch (error) {
      console.error("Failed to assign project:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Prospects Routes (updated from leads)
  app.get("/api/marketing/prospects", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { page, limit, search, year, quarter, bdId, sectorId, stage } = marketingQuerySchema.parse(req.query);
      const offset = (page - 1) * limit;

      let whereCondition: any = bdId 
        ? eq(marketingProspects.bdId, bdId)
        : req.marketingUser!.role === 'admin' 
          ? undefined 
          : eq(marketingProspects.bdId, req.marketingUser!.id);

      if (search) {
        whereCondition = whereCondition 
          ? and(whereCondition, like(marketingProspects.client, `%${search}%`))
          : like(marketingProspects.client, `%${search}%`);
      }

      if (year) {
        whereCondition = whereCondition 
          ? and(whereCondition, sql`EXTRACT(YEAR FROM ${marketingProspects.date}) = ${year}`)
          : sql`EXTRACT(YEAR FROM ${marketingProspects.date}) = ${year}`;
      }

      if (sectorId) {
        whereCondition = whereCondition 
          ? and(whereCondition, eq(marketingProspects.sectorId, sectorId))
          : eq(marketingProspects.sectorId, sectorId);
      }

      if (stage) {
        whereCondition = whereCondition 
          ? and(whereCondition, eq(marketingProspects.stage, stage))
          : eq(marketingProspects.stage, stage);
      }

      // Build the base query
      const baseQuery = db
        .select({
          id: marketingProspects.id,
          date: marketingProspects.date,
          client: marketingProspects.client,
          contactPerson: marketingProspects.contactPerson,
          contactNumber: marketingProspects.contactNumber,
          contactEmail: marketingProspects.contactEmail,
          systemInPlace: marketingProspects.systemInPlace,
          needAvailability: marketingProspects.needAvailability,
          currentVendor: marketingProspects.currentVendor,
          remarks: marketingProspects.remarks,
          revenue: marketingProspects.revenue,
          stage: marketingProspects.stage,
          bdId: marketingProspects.bdId,
          sectorId: marketingProspects.sectorId,
          sharedWithBdId: marketingProspects.sharedWithBdId,
          revenueSplit: marketingProspects.revenueSplit,
          createdAt: marketingProspects.createdAt,
          updatedAt: marketingProspects.updatedAt,
          // Include BD and sector info
          bdName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
          bdEmail: marketingUsers.email,
          sectorName: marketingSectors.name,
        })
        .from(marketingProspects)
        .leftJoin(marketingUsers, eq(marketingProspects.bdId, marketingUsers.id))
        .leftJoin(marketingSectors, eq(marketingProspects.sectorId, marketingSectors.id));

      const countQuery = db
        .select({ count: count() })
        .from(marketingProspects);

      // Apply where condition if it exists
      const prospectsQuery = whereCondition ? baseQuery.where(whereCondition) : baseQuery;
      const totalCountQuery = whereCondition ? countQuery.where(whereCondition) : countQuery;

      const [prospects, totalCount] = await Promise.all([
        prospectsQuery
          .orderBy(desc(marketingProspects.date))
          .limit(limit)
          .offset(offset),
        totalCountQuery,
      ]);

      res.json({
        prospects,
        pagination: {
          page,
          limit,
          total: totalCount[0].count,
          pages: Math.ceil(totalCount[0].count / limit),
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Leads endpoint (alias for prospects with stage=lead)
  app.get("/api/marketing/leads", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { page, limit, search, year, quarter, bdId, sectorId, marketerId } = marketingQuerySchema.parse(req.query);
      const offset = (page - 1) * limit;

      let whereCondition: any = and(
        eq(marketingProspects.stage, 'lead'),
        bdId 
          ? eq(marketingProspects.bdId, bdId)
          : marketerId
            ? eq(marketingProspects.bdId, marketerId)
            : req.marketingUser!.role === 'admin' 
              ? undefined 
              : eq(marketingProspects.bdId, req.marketingUser!.id)
      );

      if (search) {
        whereCondition = whereCondition 
          ? and(whereCondition, like(marketingProspects.client, `%${search}%`))
          : and(eq(marketingProspects.stage, 'lead'), like(marketingProspects.client, `%${search}%`));
      }

      if (year) {
        whereCondition = whereCondition 
          ? and(whereCondition, sql`EXTRACT(YEAR FROM ${marketingProspects.date}) = ${year}`)
          : and(eq(marketingProspects.stage, 'lead'), sql`EXTRACT(YEAR FROM ${marketingProspects.date}) = ${year}`);
      }

      if (sectorId) {
        whereCondition = whereCondition 
          ? and(whereCondition, eq(marketingProspects.sectorId, sectorId))
          : and(eq(marketingProspects.stage, 'lead'), eq(marketingProspects.sectorId, sectorId));
      }

      const baseQuery = db
        .select({
          id: marketingProspects.id,
          date: marketingProspects.date,
          client: marketingProspects.client,
          contactPerson: marketingProspects.contactPerson,
          contactNumber: marketingProspects.contactNumber,
          contactEmail: marketingProspects.contactEmail,
          systemInPlace: marketingProspects.systemInPlace,
          needAvailability: marketingProspects.needAvailability,
          currentVendor: marketingProspects.currentVendor,
          remarks: marketingProspects.remarks,
          revenue: marketingProspects.revenue,
          stage: marketingProspects.stage,
          bdId: marketingProspects.bdId,
          sectorId: marketingProspects.sectorId,
          sharedWithBdId: marketingProspects.sharedWithBdId,
          revenueSplit: marketingProspects.revenueSplit,
          createdAt: marketingProspects.createdAt,
          updatedAt: marketingProspects.updatedAt,
          // Include BD and sector info
          bdName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
          bdEmail: marketingUsers.email,
          sectorName: marketingSectors.name,
        })
        .from(marketingProspects)
        .leftJoin(marketingUsers, eq(marketingProspects.bdId, marketingUsers.id))
        .leftJoin(marketingSectors, eq(marketingProspects.sectorId, marketingSectors.id));

      const countQuery = db
        .select({ count: count() })
        .from(marketingProspects);

      // Apply where condition if it exists
      const leadsQuery = whereCondition ? baseQuery.where(whereCondition) : baseQuery.where(eq(marketingProspects.stage, 'lead'));
      const totalCountQuery = whereCondition ? countQuery.where(whereCondition) : countQuery.where(eq(marketingProspects.stage, 'lead'));

      const [leads, totalCount] = await Promise.all([
        leadsQuery
          .orderBy(desc(marketingProspects.date))
          .limit(limit)
          .offset(offset),
        totalCountQuery,
      ]);

      res.json({
        leads,
        pagination: {
          page,
          limit,
          total: totalCount[0].count,
          pages: Math.ceil(totalCount[0].count / limit),
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/marketing/prospects", marketingAuth, marketingUserAuth, logProjectAction('create'), async (req, res) => {
    try {
      const prospectData = marketingProspectCreateSchema.parse(req.body);

      // Check for duplicate prospects
      const existingProspects = await db
        .select()
        .from(marketingProspects)
        .where(
          and(
            eq(marketingProspects.client, prospectData.client),
            or(
              eq(marketingProspects.contactEmail, prospectData.contactEmail),
              eq(marketingProspects.contactNumber, prospectData.contactNumber)
            )
          )
        )
        .limit(1);

      if (existingProspects.length > 0) {
        return res.status(409).json({ 
          error: "Duplicate prospect found",
          duplicateProspect: existingProspects[0],
          message: "A prospect with this client name and contact information already exists. Would you like to share this account?"
        });
      }

      const newProspect = await db
        .insert(marketingProspects)
        .values({
          date: prospectData.date,
          client: prospectData.client,
          contactPerson: prospectData.contactPerson,
          contactNumber: prospectData.contactNumber,
          contactEmail: prospectData.contactEmail,
          systemInPlace: prospectData.systemInPlace,
          needAvailability: prospectData.needAvailability,
          currentVendor: prospectData.currentVendor,
          remarks: prospectData.remarks,
          revenue: prospectData.revenue?.toString(),
          stage: prospectData.stage,
          bdId: req.marketingUser!.id,
          sectorId: prospectData.sectorId || null,
        } as any)
        .returning();

      res.status(201).json({ prospect: newProspect[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update Prospect Route
  app.put("/api/marketing/prospects/:id", marketingAuth, marketingUserAuth, logProjectAction('update'), async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = marketingProspectUpdateSchema.parse(req.body);

      // Check if prospect belongs to user (unless admin)
      if (req.marketingUser!.role !== 'admin') {
        const existingProspect = await db
          .select()
          .from(marketingProspects)
          .where(and(eq(marketingProspects.id, id), eq(marketingProspects.bdId, req.marketingUser!.id)))
          .limit(1);

        if (existingProspect.length === 0) {
          return res.status(404).json({ error: "Prospect not found" });
        }
      }

      // Convert numeric fields to strings for decimal columns
      const processedUpdateData: any = {
        ...updateData,
        revenue: updateData.revenue?.toString(),
        updatedAt: new Date().toISOString()
      };

      // Handle bdId assignment for admin users
      if (req.marketingUser!.role === 'admin' && updateData.bdId) {
        processedUpdateData.bdId = updateData.bdId;
      }

      const updatedProspect = await db
        .update(marketingProspects)
        .set(processedUpdateData)
        .where(eq(marketingProspects.id, id))
        .returning();

      if (updatedProspect.length === 0) {
        return res.status(404).json({ error: "Prospect not found" });
      }

      res.json({ prospect: updatedProspect[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/marketing/leads/:id", marketingAuth, marketingUserAuth, logProjectAction('update'), async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = marketingProspectUpdateSchema.parse(req.body);

      // Check if lead belongs to user (unless admin)
      if (req.marketingUser!.role !== 'admin') {
        const existingLead = await db
          .select()
          .from(marketingProspects)
          .where(and(eq(marketingProspects.id, id), eq(marketingProspects.bdId, req.marketingUser!.id)))
          .limit(1);

        if (existingLead.length === 0) {
          return res.status(404).json({ error: "Lead not found" });
        }
      }

      // Convert numeric fields to strings for decimal columns
      const processedUpdateData: any = {
        ...updateData,
        revenue: updateData.revenue?.toString(),
        updatedAt: new Date().toISOString()
      };

      // Handle bdId assignment for admin users
      if (req.marketingUser!.role === 'admin' && updateData.bdId) {
        processedUpdateData.bdId = updateData.bdId;
      }

      const updatedLead = await db
        .update(marketingProspects)
        .set(processedUpdateData)
        .where(eq(marketingProspects.id, id))
        .returning();

      if (updatedLead.length === 0) {
        return res.status(404).json({ error: "Lead not found" });
      }

      res.json({ lead: updatedLead[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/marketing/prospects/:id", marketingAuth, marketingUserAuth, logProjectAction('delete'), async (req, res) => {
    try {
      const { id } = req.params;

      // Check if prospect belongs to user (unless admin)
      if (req.marketingUser!.role !== 'admin') {
        const existingProspect = await db
          .select()
          .from(marketingProspects)
          .where(and(eq(marketingProspects.id, id), eq(marketingProspects.bdId, req.marketingUser!.id)))
          .limit(1);

        if (existingProspect.length === 0) {
          return res.status(404).json({ error: "Prospect not found" });
        }
      }

      await db.delete(marketingProspects).where(eq(marketingProspects.id, id));

      res.json({ message: "Prospect deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Shared Account Routes
  app.post("/api/marketing/prospects/check-duplicate", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { client, contactEmail, contactNumber } = req.body;

      const existingProspects = await db
        .select({
          id: marketingProspects.id,
          client: marketingProspects.client,
          contactPerson: marketingProspects.contactPerson,
          contactEmail: marketingProspects.contactEmail,
          contactNumber: marketingProspects.contactNumber,
          bdName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
          bdEmail: marketingUsers.email,
        })
        .from(marketingProspects)
        .leftJoin(marketingUsers, eq(marketingProspects.bdId, marketingUsers.id))
        .where(
          and(
            eq(marketingProspects.client, client),
            or(
              eq(marketingProspects.contactEmail, contactEmail),
              eq(marketingProspects.contactNumber, contactNumber)
            )
          )
        )
        .limit(5);

      res.json({ 
        isDuplicate: existingProspects.length > 0,
        duplicates: existingProspects 
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/marketing/prospects/:id/split-account", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { sharedWithBdId, revenueSplit } = marketingSharedAccountSchema.parse(req.body);

      // Get original prospect
      const originalProspect = await db
        .select()
        .from(marketingProspects)
        .where(eq(marketingProspects.id, id))
        .limit(1);

      if (originalProspect.length === 0) {
        return res.status(404).json({ error: "Prospect not found" });
      }

      // Update original prospect with shared account info
      const updatedProspect = await db
        .update(marketingProspects)
        .set({
          sharedWithBdId,
          revenueSplit: revenueSplit.toString(),
          updatedAt: new Date().toISOString(),
        } as any)
        .where(eq(marketingProspects.id, id))
        .returning();

      // Get BD member info for email notifications
      const [originalBd, sharedBd] = await Promise.all([
        db.select().from(marketingUsers).where(eq(marketingUsers.id, originalProspect[0].bdId)).limit(1),
        db.select().from(marketingUsers).where(eq(marketingUsers.id, sharedWithBdId)).limit(1),
      ]);

      // Send email notification to original marketer only
      try {
        if (originalBd.length > 0) {
          await emailService.sendEmail({
            to: originalBd[0].email,
            subject: "Account Shared - Revenue Split Confirmed",
            html: `
              <h2>Account Shared - Revenue Split Confirmed</h2>
              <p>Hello ${originalBd[0].firstName},</p>
              <p>Your prospect "${originalProspect[0].client}" has been shared with ${sharedBd[0]?.firstName} ${sharedBd[0]?.lastName}.</p>
              <p><strong>Revenue Split:</strong> ${100 - revenueSplit}% (you) / ${revenueSplit}% (${sharedBd[0]?.firstName})</p>
              <p>Both of you will now work together on this account.</p>
            `,
            text: `Account Shared - Revenue Split Confirmed

Hello ${originalBd[0].firstName},

Your prospect "${originalProspect[0].client}" has been shared with ${sharedBd[0]?.firstName} ${sharedBd[0]?.lastName}.
Revenue Split: ${100 - revenueSplit}% (you) / ${revenueSplit}% (${sharedBd[0]?.firstName})

Both of you will now work together on this account.`
          });
        }

      } catch (emailError) {
        console.error("Failed to send revenue sharing notification:", emailError);
      }

      res.json({ 
        message: "Account shared successfully",
        prospect: updatedProspect[0] 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Stage Progression Route
  app.put("/api/marketing/prospects/:id/stage", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { stage, revenue, lostReason } = req.body;

      // Get the existing prospect
      const existingProspect = await db
        .select()
        .from(marketingProspects)
        .where(eq(marketingProspects.id, id))
        .limit(1);

      if (existingProspect.length === 0) {
        return res.status(404).json({ error: "Prospect not found" });
      }

      const prospect = existingProspect[0];

      // Check if prospect belongs to user (unless admin)
      if (req.marketingUser!.role !== 'admin' && prospect.bdId !== req.marketingUser!.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      // If stage is sales_won or expected_order, move to appropriate table
      if (stage === 'sales_won') {
        // Create entry in sales_won table
        const newSalesWon = await db
          .insert(marketingSalesWon)
          .values({
            organisationName: prospect.client,
            sector: prospect.sectorId || 'Unknown',
            product: 'Service', // Default value, could be made configurable
            contractAmount: revenue ? revenue.toString() : '0',
            expectedQuarter: 'Q1', // Default value, could be calculated from date
            comments: prospect.remarks,
            marketerId: prospect.bdId,
            contactPerson: prospect.contactPerson,
            contactNumber: prospect.contactNumber,
            contactEmail: prospect.contactEmail,
            createdAt: prospect.date, // Preserve original prospect date
          })
          .returning();

        // Delete from prospects table
        await db
          .delete(marketingProspects)
          .where(eq(marketingProspects.id, id));

        return res.json({ 
          message: "Prospect moved to sales won",
          salesWon: newSalesWon[0]
        });
      } else if (stage === 'expected_order') {
        // Create entry in expected_orders table
        const newExpectedOrder = await db
          .insert(marketingExpectedOrders)
          .values({
            organisationName: prospect.client,
            sector: prospect.sectorId || 'Unknown',
            product: 'Service', // Default value, could be made configurable
            revenue: revenue ? revenue.toString() : '0',
            expectedQuarter: 'Q1', // Default value, could be calculated from date
            comments: prospect.remarks,
            marketerId: prospect.bdId,
            contactPerson: prospect.contactPerson,
            contactNumber: prospect.contactNumber,
            contactEmail: prospect.contactEmail,
            createdAt: prospect.date, // Preserve original prospect date
          })
          .returning();

        // Delete from prospects table
        await db
          .delete(marketingProspects)
          .where(eq(marketingProspects.id, id));

        return res.json({ 
          message: "Prospect moved to expected orders",
          expectedOrder: newExpectedOrder[0]
        });
      } else if (stage === 'lost') {
        // Validate lost reason
        if (!lostReason || lostReason.trim().length < 10) {
          return res.status(400).json({ error: "Lost reason is required and must be at least 10 characters long" });
        }

        // Create entry in lost_projects table
        const newLostProject = await db
          .insert(marketingLostProjects)
          .values({
            organisationName: prospect.client,
            sector: prospect.sectorId || 'Unknown',
            product: 'Service',
            revenue: revenue ? revenue.toString() : prospect.revenue || '0',
            expectedQuarter: 'Q1',
            comments: prospect.remarks,
            marketerId: prospect.bdId,
            contactPerson: prospect.contactPerson,
            contactNumber: prospect.contactNumber,
            contactEmail: prospect.contactEmail,
            lostReason: lostReason.trim(),
            lostDate: new Date().toISOString(),
          })
          .returning();

        // Delete from prospects table
        await db
          .delete(marketingProspects)
          .where(eq(marketingProspects.id, id));

        return res.json({ 
          message: "Prospect moved to lost projects",
          lostProject: newLostProject[0]
        });
      } else {
        // For other stages (prospect, lead), just update the stage
        const updateData: any = {
          stage,
          updatedAt: new Date().toISOString(),
        };

        if (revenue !== undefined) {
          updateData.revenue = revenue.toString();
        }

        const updatedProspect = await db
          .update(marketingProspects)
          .set(updateData)
          .where(eq(marketingProspects.id, id))
          .returning();

        return res.json({ prospect: updatedProspect[0] });
      }
    } catch (error) {
      console.error("Error updating prospect stage:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Sales Won Routes
  app.get("/api/marketing/sales-won", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { page, limit, search, year, quarter, bdId } = marketingQuerySchema.parse(req.query);
      const offset = (page - 1) * limit;

      let whereCondition: any = bdId 
        ? eq(marketingSalesWon.marketerId, bdId)
        : req.marketingUser!.role === 'admin' 
          ? undefined 
          : eq(marketingSalesWon.marketerId, req.marketingUser!.id);

      if (search) {
        whereCondition = whereCondition 
          ? and(whereCondition, like(marketingSalesWon.organisationName, `%${search}%`))
          : like(marketingSalesWon.organisationName, `%${search}%`);
      }

      if (year) {
        whereCondition = whereCondition 
          ? and(whereCondition, sql`EXTRACT(YEAR FROM ${marketingSalesWon.createdAt}) = ${year}`)
          : sql`EXTRACT(YEAR FROM ${marketingSalesWon.createdAt}) = ${year}`;
      }

      if (quarter) {
        whereCondition = whereCondition 
          ? and(whereCondition, eq(marketingSalesWon.expectedQuarter, quarter))
          : eq(marketingSalesWon.expectedQuarter, quarter);
      }

      // Build the base query
      const baseQuery = db
        .select({
          id: marketingSalesWon.id,
          organisationName: marketingSalesWon.organisationName,
          sector: sql<string>`COALESCE(${marketingSectors.name}, ${marketingSalesWon.sector})`,
          product: marketingSalesWon.product,
          contractAmount: marketingSalesWon.contractAmount,
          expectedQuarter: marketingSalesWon.expectedQuarter,
          comments: marketingSalesWon.comments,
          marketerId: marketingSalesWon.marketerId,
          contactPerson: marketingSalesWon.contactPerson,
          contactNumber: marketingSalesWon.contactNumber,
          contactEmail: marketingSalesWon.contactEmail,
          createdAt: marketingSalesWon.createdAt,
          updatedAt: marketingSalesWon.updatedAt,
          // Include marketer info for admin views
          marketerName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
          marketerEmail: marketingUsers.email,
        })
        .from(marketingSalesWon)
        .leftJoin(marketingUsers, eq(marketingSalesWon.marketerId, marketingUsers.id))
        .leftJoin(marketingSectors, eq(marketingSalesWon.sector, marketingSectors.id));

      const countQuery = db
        .select({ count: count() })
        .from(marketingSalesWon);

      // Apply where condition if it exists
      const salesWonQuery = whereCondition ? baseQuery.where(whereCondition) : baseQuery;
      const totalCountQuery = whereCondition ? countQuery.where(whereCondition) : countQuery;

      const [salesWon, totalCount] = await Promise.all([
        salesWonQuery
          .orderBy(desc(marketingSalesWon.createdAt))
          .limit(limit)
          .offset(offset),
        totalCountQuery,
      ]);

      res.json({
        salesWon,
        pagination: {
          page,
          limit,
          total: totalCount[0].count,
          pages: Math.ceil(totalCount[0].count / limit),
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/marketing/sales-won", marketingAuth, marketingUserAuth, logProjectAction('create'), async (req, res) => {
    try {
      const salesWonData = marketingSalesWonCreateSchema.parse(req.body);

      const newSalesWon = await db
        .insert(marketingSalesWon)
        .values({
          organisationName: salesWonData.organisationName,
          sector: salesWonData.sector,
          product: salesWonData.product,
          contractAmount: salesWonData.contractAmount.toString(),
          expectedQuarter: salesWonData.expectedQuarter,
          comments: salesWonData.comments,
          marketerId: req.marketingUser!.id,
        } as any)
        .returning();

      res.status(201).json({ salesWon: newSalesWon[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/marketing/sales-won/:id", marketingAuth, marketingUserAuth, logProjectAction('update'), async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = marketingSalesWonUpdateSchema.parse(req.body);

      // Check if sales won belongs to user (unless admin)
      if (req.marketingUser!.role !== 'admin') {
        const existingSalesWon = await db
          .select()
          .from(marketingSalesWon)
          .where(and(eq(marketingSalesWon.id, id), eq(marketingSalesWon.marketerId, req.marketingUser!.id)))
          .limit(1);

        if (existingSalesWon.length === 0) {
          return res.status(404).json({ error: "Sales won record not found" });
        }
      }

      // Convert numeric fields to strings for decimal columns
      const processedUpdateData: any = {
        ...updateData,
        contractAmount: updateData.contractAmount?.toString(),
        updatedAt: new Date().toISOString()
      };

      // Handle marketerId assignment for admin users
      if (req.marketingUser!.role === 'admin' && updateData.marketerId) {
        processedUpdateData.marketerId = updateData.marketerId;
      }

      const updatedSalesWon = await db
        .update(marketingSalesWon)
        .set(processedUpdateData)
        .where(eq(marketingSalesWon.id, id))
        .returning();

      if (updatedSalesWon.length === 0) {
        return res.status(404).json({ error: "Sales won record not found" });
      }

      res.json({ salesWon: updatedSalesWon[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/marketing/sales-won/:id", marketingAuth, marketingUserAuth, logProjectAction('delete'), async (req, res) => {
    try {
      const { id } = req.params;

      // Check if sales won belongs to user (unless admin)
      if (req.marketingUser!.role !== 'admin') {
        const existingSalesWon = await db
          .select()
          .from(marketingSalesWon)
          .where(and(eq(marketingSalesWon.id, id), eq(marketingSalesWon.marketerId, req.marketingUser!.id)))
          .limit(1);

        if (existingSalesWon.length === 0) {
          return res.status(404).json({ error: "Sales won record not found" });
        }
      }

      await db.delete(marketingSalesWon).where(eq(marketingSalesWon.id, id));

      res.json({ message: "Sales won record deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Expected Orders Routes
  app.get("/api/marketing/expected-orders", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { page, limit, search, year, quarter, bdId } = marketingQuerySchema.parse(req.query);
      const offset = (page - 1) * limit;

      let whereCondition: any = bdId 
        ? eq(marketingExpectedOrders.marketerId, bdId)
        : req.marketingUser!.role === 'admin' 
          ? undefined 
          : eq(marketingExpectedOrders.marketerId, req.marketingUser!.id);

      if (search) {
        whereCondition = and(
          whereCondition,
          like(marketingExpectedOrders.organisationName, `%${search}%`)
        );
      }

      if (year) {
        whereCondition = and(
          whereCondition,
          sql`EXTRACT(YEAR FROM ${marketingExpectedOrders.createdAt}) = ${year}`
        );
      }

      if (quarter) {
        whereCondition = and(whereCondition, eq(marketingExpectedOrders.expectedQuarter, quarter));
      }

      const [expectedOrders, totalCount] = await Promise.all([
        db
          .select({
            id: marketingExpectedOrders.id,
            organisationName: marketingExpectedOrders.organisationName,
            sector: sql<string>`COALESCE(${marketingSectors.name}, ${marketingExpectedOrders.sector})`,
            product: marketingExpectedOrders.product,
            revenue: marketingExpectedOrders.revenue,
            expectedQuarter: marketingExpectedOrders.expectedQuarter,
            comments: marketingExpectedOrders.comments,
            marketerId: marketingExpectedOrders.marketerId,
            contactPerson: marketingExpectedOrders.contactPerson,
            contactNumber: marketingExpectedOrders.contactNumber,
            contactEmail: marketingExpectedOrders.contactEmail,
            createdAt: marketingExpectedOrders.createdAt,
            updatedAt: marketingExpectedOrders.updatedAt,
            // Include marketer info for admin views
            marketerName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
            marketerEmail: marketingUsers.email,
          })
          .from(marketingExpectedOrders)
          .leftJoin(marketingUsers, eq(marketingExpectedOrders.marketerId, marketingUsers.id))
          .leftJoin(marketingSectors, eq(marketingExpectedOrders.sector, marketingSectors.id))
          .where(whereCondition)
          .orderBy(desc(marketingExpectedOrders.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: count() })
          .from(marketingExpectedOrders)
          .where(whereCondition),
      ]);

      res.json({
        expectedOrders,
        pagination: {
          page,
          limit,
          total: totalCount[0].count,
          pages: Math.ceil(totalCount[0].count / limit),
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/marketing/expected-orders", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const expectedOrdersData = marketingExpectedOrdersCreateSchema.parse(req.body);

      const newExpectedOrders = await db
        .insert(marketingExpectedOrders)
        .values({
          organisationName: expectedOrdersData.organisationName,
          sector: expectedOrdersData.sector,
          product: expectedOrdersData.product,
          revenue: expectedOrdersData.revenue.toString(),
          expectedQuarter: expectedOrdersData.expectedQuarter,
          comments: expectedOrdersData.comments,
          marketerId: req.marketingUser!.id,
        } as any)
        .returning();

      res.status(201).json({ expectedOrders: newExpectedOrders[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/marketing/expected-orders/:id", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = marketingExpectedOrdersUpdateSchema.parse(req.body);

      // Check if expected orders belongs to user (unless admin)
      if (req.marketingUser!.role !== 'admin') {
        const existingExpectedOrders = await db
          .select()
          .from(marketingExpectedOrders)
          .where(and(eq(marketingExpectedOrders.id, id), eq(marketingExpectedOrders.marketerId, req.marketingUser!.id)))
          .limit(1);

        if (existingExpectedOrders.length === 0) {
          return res.status(404).json({ error: "Expected orders record not found" });
        }
      }

      // Convert numeric fields to strings for decimal columns
      const processedUpdateData: any = {
        ...updateData,
        revenue: updateData.revenue?.toString(),
        updatedAt: new Date().toISOString()
      };

      // Handle marketerId assignment for admin users
      if (req.marketingUser!.role === 'admin' && updateData.marketerId) {
        processedUpdateData.marketerId = updateData.marketerId;
      }

      const updatedExpectedOrders = await db
        .update(marketingExpectedOrders)
        .set(processedUpdateData)
        .where(eq(marketingExpectedOrders.id, id))
        .returning();

      if (updatedExpectedOrders.length === 0) {
        return res.status(404).json({ error: "Expected orders record not found" });
      }

      res.json({ expectedOrders: updatedExpectedOrders[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/marketing/expected-orders/:id", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { id } = req.params;

      // Check if expected orders belongs to user (unless admin)
      if (req.marketingUser!.role !== 'admin') {
        const existingExpectedOrders = await db
          .select()
          .from(marketingExpectedOrders)
          .where(and(eq(marketingExpectedOrders.id, id), eq(marketingExpectedOrders.marketerId, req.marketingUser!.id)))
          .limit(1);

        if (existingExpectedOrders.length === 0) {
          return res.status(404).json({ error: "Expected orders record not found" });
        }
      }

      await db.delete(marketingExpectedOrders).where(eq(marketingExpectedOrders.id, id));

      res.json({ message: "Expected orders record deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Change expected order stage
  app.put("/api/marketing/expected-orders/:id/stage", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { stage, revenue, lostReason } = req.body;

      if (!stage) {
        return res.status(400).json({ error: "Stage is required" });
      }

      // Get the expected order
      const expectedOrder = await db
        .select()
        .from(marketingExpectedOrders)
        .where(eq(marketingExpectedOrders.id, id))
        .limit(1);

      if (expectedOrder.length === 0) {
        return res.status(404).json({ error: "Expected order not found" });
      }

      const order = expectedOrder[0];

      // Check permissions (admin or owner)
      if (req.marketingUser!.role !== 'admin' && order.marketerId !== req.marketingUser!.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Handle different stage transitions
      if (stage === 'sales_won') {
        // Create entry in sales_won table
        const newSalesWon = await db
          .insert(marketingSalesWon)
          .values({
            organisationName: order.organisationName,
            sector: order.sector,
            product: order.product,
            contractAmount: revenue ? revenue.toString() : order.revenue,
            expectedQuarter: order.expectedQuarter,
            comments: order.comments,
            marketerId: order.marketerId,
            contactPerson: order.contactPerson,
            contactNumber: order.contactNumber,
            contactEmail: order.contactEmail,
            createdAt: order.createdAt, // Preserve original date
          })
          .returning();

        // Delete from expected_orders table
        await db
          .delete(marketingExpectedOrders)
          .where(eq(marketingExpectedOrders.id, id));

        return res.json({ 
          message: "Expected order moved to sales won",
          salesWon: newSalesWon[0]
        });
      } else if (stage === 'lead' || stage === 'prospect') {
        // Create entry in prospects table
        const newProspect = await db
          .insert(marketingProspects)
          .values({
            date: order.createdAt, // Preserve original date
            client: order.organisationName,
            contactPerson: order.contactPerson,
            contactNumber: order.contactNumber,
            contactEmail: order.contactEmail,
            systemInPlace: 'none' as any,
            needAvailability: 'none' as any,
            currentVendor: '',
            remarks: order.comments,
            revenue: revenue ? revenue.toString() : order.revenue,
            stage: stage,
            bdId: order.marketerId,
            sectorId: order.sector,
          } as any)
          .returning();

        // Delete from expected_orders table
        await db
          .delete(marketingExpectedOrders)
          .where(eq(marketingExpectedOrders.id, id));

        return res.json({ 
          message: `Expected order moved to ${stage}`,
          prospect: newProspect[0]
        });
      } else if (stage === 'lost') {
        // Validate lost reason
        if (!lostReason || lostReason.trim().length < 10) {
          return res.status(400).json({ error: "Lost reason is required and must be at least 10 characters long" });
        }

        // Create entry in lost_projects table
        const newLostProject = await db
          .insert(marketingLostProjects)
          .values({
            organisationName: order.organisationName,
            sector: order.sector,
            product: order.product,
            revenue: revenue ? revenue.toString() : order.revenue,
            expectedQuarter: order.expectedQuarter,
            comments: order.comments,
            marketerId: order.marketerId,
            contactPerson: order.contactPerson,
            contactNumber: order.contactNumber,
            contactEmail: order.contactEmail,
            lostReason: lostReason.trim(),
            lostDate: new Date().toISOString(),
          })
          .returning();

        // Delete from expected_orders table
        await db
          .delete(marketingExpectedOrders)
          .where(eq(marketingExpectedOrders.id, id));

        return res.json({ 
          message: "Expected order moved to lost projects",
          lostProject: newLostProject[0]
        });
      }

      res.status(400).json({ error: "Invalid stage transition" });
    } catch (error) {
      console.error("Error changing expected order stage:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Duplicate routes removed - using the first set above

  // Annual Summary Routes
  app.get("/api/marketing/annual-summary", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { page, limit, year, bdId } = marketingQuerySchema.parse(req.query);
      const offset = (page - 1) * limit;

      let whereCondition: any = eq(marketingAnnualSummary.marketerId, bdId || req.marketingUser!.id);

      if (year) {
        whereCondition = and(whereCondition, eq(marketingAnnualSummary.year, year));
      }

      const [annualSummary, totalCount] = await Promise.all([
        db
          .select()
          .from(marketingAnnualSummary)
          .where(whereCondition)
          .orderBy(desc(marketingAnnualSummary.year))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: count() })
          .from(marketingAnnualSummary)
          .where(whereCondition),
      ]);

      res.json({
        annualSummary,
        pagination: {
          page,
          limit,
          total: totalCount[0].count,
          pages: Math.ceil(totalCount[0].count / limit),
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/marketing/annual-summary", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const annualSummaryData = marketingAnnualSummaryCreateSchema.parse(req.body);

      const newAnnualSummary = await db
        .insert(marketingAnnualSummary)
        .values({
          salesExecutive: annualSummaryData.salesExecutive,
          won: annualSummaryData.won.toString(),
          target: annualSummaryData.target.toString(),
          targetAchieved: annualSummaryData.targetAchieved.toString(),
          expectedOrders: annualSummaryData.expectedOrders.toString(),
          statusQuo: annualSummaryData.statusQuo.toString(),
          deviationFromTarget: annualSummaryData.deviationFromTarget.toString(),
          sumSalesExpected: annualSummaryData.sumSalesExpected.toString(),
          expectedTarget: annualSummaryData.expectedTarget.toString(),
          year: annualSummaryData.year,
          marketerId: req.marketingUser!.id,
        } as any)
        .returning();

      res.status(201).json({ annualSummary: newAnnualSummary[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin endpoint to set targets for any user
  app.post("/api/marketing/admin/set-target", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      const { marketerId, year, target, revisedTarget } = req.body;

      if (!marketerId || !year || !target) {
        return res.status(400).json({ error: "marketerId, year, and target are required" });
      }

      // Check if annual summary already exists for this marketer and year
      const existingSummary = await db
        .select()
        .from(marketingAnnualSummary)
        .where(and(
          eq(marketingAnnualSummary.marketerId, marketerId),
          eq(marketingAnnualSummary.year, year)
        ))
        .limit(1);

      const targetData = {
        year,
        salesExecutive: "", // Will be filled from user data
        target: parseFloat(target),
        revisedTarget: parseFloat(revisedTarget || target),
        won: existingSummary[0]?.won || "0",
        targetAchieved: existingSummary[0]?.targetAchieved || "0",
        expectedOrders: existingSummary[0]?.expectedOrders || "0",
        statusQuo: existingSummary[0]?.statusQuo || "0",
        deviationFromTarget: existingSummary[0]?.deviationFromTarget || "0",
        sumSalesExpected: existingSummary[0]?.sumSalesExpected || "0",
        expectedTarget: parseFloat(revisedTarget || target),
        marketerId,
      };

      if (existingSummary.length > 0) {
        // Update existing summary
        const updatedSummary = await db
          .update(marketingAnnualSummary)
          .set({
            target: targetData.target.toString(),
            revisedTarget: targetData.revisedTarget.toString(),
            expectedTarget: targetData.expectedTarget.toString(),
            updatedAt: new Date().toISOString()
          })
          .where(eq(marketingAnnualSummary.id, existingSummary[0].id))
          .returning();

        res.json({ annualSummary: updatedSummary[0] });
      } else {
        // Create new summary
        // Get user name for sales executive
        const user = await db
          .select({
            firstName: marketingUsers.firstName,
            lastName: marketingUsers.lastName,
          })
          .from(marketingUsers)
          .where(eq(marketingUsers.id, marketerId))
          .limit(1);

        const salesExecutive = user[0] ? `${user[0].firstName} ${user[0].lastName}` : "Unknown";

        const newSummary = await db
          .insert(marketingAnnualSummary)
          .values({
            ...targetData,
            salesExecutive,
            target: targetData.target.toString(),
            revisedTarget: targetData.revisedTarget.toString(),
            won: targetData.won,
            targetAchieved: targetData.targetAchieved,
            expectedOrders: targetData.expectedOrders,
            statusQuo: targetData.statusQuo,
            deviationFromTarget: targetData.deviationFromTarget,
            sumSalesExpected: targetData.sumSalesExpected,
            expectedTarget: targetData.expectedTarget.toString(),
          } as any)
          .returning();

        res.status(201).json({ annualSummary: newSummary[0] });
      }
    } catch (error) {
      console.error("Error setting target:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/marketing/annual-summary/:id", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = marketingAnnualSummaryUpdateSchema.parse(req.body);

      // Check if annual summary belongs to user (unless admin)
      if (req.marketingUser!.role !== 'admin') {
        const existingAnnualSummary = await db
          .select()
          .from(marketingAnnualSummary)
          .where(and(eq(marketingAnnualSummary.id, id), eq(marketingAnnualSummary.marketerId, req.marketingUser!.id)))
          .limit(1);

        if (existingAnnualSummary.length === 0) {
          return res.status(404).json({ error: "Annual summary record not found" });
        }
      }

      // Convert numeric fields to strings for decimal columns
      const processedUpdateData = {
        ...updateData,
        won: updateData.won?.toString(),
        target: updateData.target?.toString(),
        targetAchieved: updateData.targetAchieved?.toString(),
        expectedOrders: updateData.expectedOrders?.toString(),
        statusQuo: updateData.statusQuo?.toString(),
        deviationFromTarget: updateData.deviationFromTarget?.toString(),
        sumSalesExpected: updateData.sumSalesExpected?.toString(),
        expectedTarget: updateData.expectedTarget?.toString(),
        updatedAt: new Date().toISOString()
      };

      const updatedAnnualSummary = await db
        .update(marketingAnnualSummary)
        .set(processedUpdateData)
        .where(eq(marketingAnnualSummary.id, id))
        .returning();

      if (updatedAnnualSummary.length === 0) {
        return res.status(404).json({ error: "Annual summary record not found" });
      }

      res.json({ annualSummary: updatedAnnualSummary[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/marketing/annual-summary/:id", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { id } = req.params;

      // Check if annual summary belongs to user (unless admin)
      if (req.marketingUser!.role !== 'admin') {
        const existingAnnualSummary = await db
          .select()
          .from(marketingAnnualSummary)
          .where(and(eq(marketingAnnualSummary.id, id), eq(marketingAnnualSummary.marketerId, req.marketingUser!.id)))
          .limit(1);

        if (existingAnnualSummary.length === 0) {
          return res.status(404).json({ error: "Annual summary record not found" });
        }
      }

      await db.delete(marketingAnnualSummary).where(eq(marketingAnnualSummary.id, id));

      res.json({ message: "Annual summary record deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Export Routes
  app.get("/api/marketing/export", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { type, format, year, quarter, marketerId } = marketingExportSchema.parse(req.query);

      let whereCondition: any = eq(marketingProspects.bdId, marketerId || req.marketingUser!.id);
      let data: any[] = [];
      let filename = '';

      switch (type) {
        case 'leads':
          if (year) {
            whereCondition = and(
              whereCondition,
              sql`EXTRACT(YEAR FROM ${marketingProspects.date}) = ${year}`
            );
          }
          data = await db.select().from(marketingProspects).where(whereCondition);
          filename = `prospects_${year || 'all'}.${format}`;
          break;

        case 'sales-won':
          whereCondition = eq(marketingSalesWon.marketerId, marketerId || req.marketingUser!.id);
          if (year) {
            whereCondition = and(
              whereCondition,
              sql`EXTRACT(YEAR FROM ${marketingSalesWon.createdAt}) = ${year}`
            );
          }
          if (quarter) {
            whereCondition = and(whereCondition, eq(marketingSalesWon.expectedQuarter, quarter));
          }
          data = await db.select().from(marketingSalesWon).where(whereCondition);
          filename = `sales_won_${year || 'all'}_${quarter || 'all'}.${format}`;
          break;

        case 'expected-orders':
          whereCondition = eq(marketingExpectedOrders.marketerId, marketerId || req.marketingUser!.id);
          if (year) {
            whereCondition = and(
              whereCondition,
              sql`EXTRACT(YEAR FROM ${marketingExpectedOrders.createdAt}) = ${year}`
            );
          }
          if (quarter) {
            whereCondition = and(whereCondition, eq(marketingExpectedOrders.expectedQuarter, quarter));
          }
          data = await db.select().from(marketingExpectedOrders).where(whereCondition);
          filename = `expected_orders_${year || 'all'}_${quarter || 'all'}.${format}`;
          break;

        case 'prospects':
          whereCondition = eq(marketingProspects.bdId, marketerId || req.marketingUser!.id);
          if (year) {
            whereCondition = and(
              whereCondition,
              sql`EXTRACT(YEAR FROM ${marketingProspects.createdAt}) = ${year}`
            );
          }
          // Note: Quarter filtering not applicable to prospects table
          data = await db.select().from(marketingProspects).where(whereCondition);
          filename = `prospects_${year || 'all'}_${quarter || 'all'}.${format}`;
          break;

        case 'annual-summary':
          whereCondition = eq(marketingAnnualSummary.marketerId, marketerId || req.marketingUser!.id);
          if (year) {
            whereCondition = and(whereCondition, eq(marketingAnnualSummary.year, year));
          }
          data = await db.select().from(marketingAnnualSummary).where(whereCondition);
          filename = `annual_summary_${year || 'all'}.${format}`;
          break;
      }

      if (format === 'excel') {
        const buffer = await generateExcelBuffer({ data, reportType: type, filename });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
      } else {
        // CSV export
        const csv = convertToCSV(data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
      }
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Dashboard Stats Route
  app.get("/api/marketing/dashboard/stats", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { year, bdId } = marketingQuerySchema.parse(req.query);
      const currentYear = year || new Date().getFullYear();
      const targetBdId = bdId || req.marketingUser!.id;

      // Get stats for the specified year using the new prospects table
      const [prospectsCount, leadsCount, expectedOrdersCount, salesWonCount, totalRevenue, targetData] = await Promise.all([
        // Prospects count
        db
          .select({ count: count() })
          .from(marketingProspects)
          .where(
            and(
              eq(marketingProspects.bdId, targetBdId),
              eq(marketingProspects.stage, 'prospect'),
              sql`EXTRACT(YEAR FROM ${marketingProspects.date}) = ${currentYear}`
            )
          ),
        // Leads count
        db
          .select({ count: count() })
          .from(marketingProspects)
          .where(
            and(
              eq(marketingProspects.bdId, targetBdId),
              eq(marketingProspects.stage, 'lead'),
              sql`EXTRACT(YEAR FROM ${marketingProspects.date}) = ${currentYear}`
            )
          ),
        // Expected Orders count - from actual expected orders table
        db
          .select({ count: count() })
          .from(marketingExpectedOrders)
          .where(
            and(
              eq(marketingExpectedOrders.marketerId, targetBdId),
              sql`EXTRACT(YEAR FROM ${marketingExpectedOrders.createdAt}) = ${currentYear}`
            )
          ),
        // Sales Won count - from actual sales won table
        db
          .select({ count: count() })
          .from(marketingSalesWon)
          .where(
            and(
              eq(marketingSalesWon.marketerId, targetBdId),
              sql`EXTRACT(YEAR FROM ${marketingSalesWon.createdAt}) = ${currentYear}`
            )
          ),
        // Total revenue - from sales won only (actual closed deals)
        db
          .select({ total: sql<number>`COALESCE(SUM(${marketingSalesWon.contractAmount}), 0)` })
          .from(marketingSalesWon)
          .where(
            and(
              eq(marketingSalesWon.marketerId, targetBdId),
              sql`EXTRACT(YEAR FROM ${marketingSalesWon.createdAt}) = ${currentYear}`
            )
          ),
        // Target data from annual summary
        db
          .select({ 
            target: marketingAnnualSummary.target,
            revisedTarget: marketingAnnualSummary.revisedTarget,
            expectedTarget: marketingAnnualSummary.expectedTarget
          })
          .from(marketingAnnualSummary)
          .where(
            and(
              eq(marketingAnnualSummary.marketerId, targetBdId),
              eq(marketingAnnualSummary.year, currentYear)
            )
          )
          .limit(1),
      ]);

      const target = targetData[0] ? Number(targetData[0].target) : 0;
      const revisedTarget = targetData[0] ? Number((targetData[0] as any).revisedTarget || 0) : 0;
      const expectedTarget = targetData[0] ? Number(targetData[0].expectedTarget) : 0;
      const actualRevenue = Number(totalRevenue[0].total);
      
      // Calculate target achievement percentage based on sales won vs expected target
      // Use expectedTarget (which is the revised target) if available, otherwise use initial target
      const targetForCalculation = expectedTarget > 0 ? expectedTarget : (revisedTarget > 0 ? revisedTarget : target);
      const targetAchievement = targetForCalculation > 0 ? ((actualRevenue / targetForCalculation) * 100) : 0;

      res.json({
        year: currentYear,
        prospectsCount: prospectsCount[0].count,
        leadsCount: leadsCount[0].count,
        expectedOrdersCount: expectedOrdersCount[0].count,
        salesWonCount: salesWonCount[0].count,
        totalRevenue: actualRevenue,
        target: target,
        revisedTarget: revisedTarget,
        expectedTarget: expectedTarget,
        targetAchievement: Math.round(targetAchievement * 100) / 100,
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin Dashboard Stats - Aggregated across all BD members
  app.get("/api/marketing/admin/dashboard/stats", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      const { year } = marketingQuerySchema.parse(req.query);
      const currentYear = year || new Date().getFullYear();

      // Get aggregated stats across all BD members using the new prospects table
      const [prospectsCount, leadsCount, expectedOrdersCount, salesWonCount, totalRevenue, totalExpectedOrdersRevenue, bdStats] = await Promise.all([
        // Total prospects count
        db
          .select({ count: count() })
          .from(marketingProspects)
          .where(
            and(
              eq(marketingProspects.stage, 'prospect'),
              sql`EXTRACT(YEAR FROM ${marketingProspects.date}) = ${currentYear}`
            )
          ),
        // Total leads count
        db
          .select({ count: count() })
          .from(marketingProspects)
          .where(
            and(
              eq(marketingProspects.stage, 'lead'),
              sql`EXTRACT(YEAR FROM ${marketingProspects.date}) = ${currentYear}`
            )
          ),
        // Total expected orders count - from actual expected orders table
        db
          .select({ count: count() })
          .from(marketingExpectedOrders)
          .where(
            sql`EXTRACT(YEAR FROM ${marketingExpectedOrders.createdAt}) = ${currentYear}`
          ),
        // Total sales won count - from actual sales won table
        db
          .select({ count: count() })
          .from(marketingSalesWon)
          .where(
            sql`EXTRACT(YEAR FROM ${marketingSalesWon.createdAt}) = ${currentYear}`
          ),
        // Total revenue - from sales won table (actual contract values)
        db
          .select({ total: sql<number>`COALESCE(SUM(${marketingSalesWon.contractAmount}), 0)` })
          .from(marketingSalesWon)
          .where(sql`EXTRACT(YEAR FROM ${marketingSalesWon.createdAt}) = ${currentYear}`),
        // Total expected orders revenue - from expected orders table
        db
          .select({ total: sql<number>`COALESCE(SUM(${marketingExpectedOrders.revenue}), 0)` })
          .from(marketingExpectedOrders)
          .where(sql`EXTRACT(YEAR FROM ${marketingExpectedOrders.createdAt}) = ${currentYear}`),
        // Get individual BD member performance (simplified without targets for now)
        db
          .select({
            bdId: marketingUsers.id,
            bdName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
            prospectsCount: sql<number>`COALESCE(COUNT(CASE WHEN ${marketingProspects.stage} = 'prospect' THEN 1 END), 0)`,
            leadsCount: sql<number>`COALESCE(COUNT(CASE WHEN ${marketingProspects.stage} = 'lead' THEN 1 END), 0)`,
            expectedOrdersCount: sql<number>`COALESCE(COUNT(CASE WHEN ${marketingProspects.stage} = 'expected_order' THEN 1 END), 0)`,
            salesWonCount: sql<number>`COALESCE(COUNT(CASE WHEN ${marketingProspects.stage} = 'sales_won' THEN 1 END), 0)`,
            totalRevenue: sql<number>`COALESCE((SELECT SUM(${marketingSalesWon.contractAmount}) FROM marketing_sales_won WHERE marketer_id = ${marketingUsers.id} AND EXTRACT(YEAR FROM created_at) = ${currentYear}), 0)`,
            target: sql<number>`0`, // Default target for now
          })
          .from(marketingUsers)
          .leftJoin(marketingProspects, and(
            eq(marketingProspects.bdId, marketingUsers.id),
            sql`EXTRACT(YEAR FROM ${marketingProspects.date}) = ${currentYear}`
          ))
          .where(eq(marketingUsers.isActive, true))
          .groupBy(marketingUsers.id, marketingUsers.firstName, marketingUsers.lastName)
          .orderBy(desc(sql`COALESCE(SUM(${marketingProspects.revenue}), 0)`)),
      ]);

      res.json({
        year: currentYear,
        totalProspectsCount: prospectsCount[0].count,
        totalLeadsCount: leadsCount[0].count,
        totalExpectedOrdersCount: expectedOrdersCount[0].count,
        totalSalesWonCount: salesWonCount[0].count,
        totalRevenue: Number(totalRevenue[0].total),
        totalExpectedOrdersRevenue: Number(totalExpectedOrdersRevenue[0].total),
        bdStats: bdStats.map(stat => ({
          ...stat,
          totalRevenue: Number(stat.totalRevenue),
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin User Management - Delete user
  app.delete("/api/marketing/users/:id", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;

      // Soft delete by setting isActive to false
      const updatedUser = await db
        .update(marketingUsers)
        .set({ 
          isActive: false, 
          updatedAt: new Date().toISOString() 
        } as any)
        .where(eq(marketingUsers.id, id))
        .returning();

      if (updatedUser.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ message: "User deactivated successfully" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin Bulk Operations - Delete multiple records
  app.post("/api/marketing/admin/bulk-delete", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      const { type, ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "Invalid IDs provided" });
      }

      let deletedCount = 0;
      const idPlaceholders = ids.map(() => '?').join(',');

      switch (type) {
        case 'leads':
          await db.delete(marketingProspects).where(sql`id IN (${idPlaceholders})`);
          deletedCount = ids.length;
          break;
        case 'sales-won':
          await db.delete(marketingSalesWon).where(sql`id IN (${idPlaceholders})`);
          deletedCount = ids.length;
          break;
        case 'expected-orders':
          await db.delete(marketingExpectedOrders).where(sql`id IN (${idPlaceholders})`);
          deletedCount = ids.length;
          break;
        case 'prospects':
          await db.delete(marketingProspects).where(sql`id IN (${idPlaceholders})`);
          deletedCount = ids.length;
          break;
        case 'annual-summary':
          await db.delete(marketingAnnualSummary).where(sql`id IN (${idPlaceholders})`);
          deletedCount = ids.length;
          break;
        default:
          return res.status(400).json({ error: "Invalid type specified" });
      }

      res.json({ 
        message: `${deletedCount} ${type} records deleted successfully`,
        deletedCount 
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin Analytics - Get detailed analytics
  app.get("/api/marketing/admin/analytics", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      const { year, quarter, month } = marketingQuerySchema.parse(req.query);
      const currentYear = year || new Date().getFullYear();
      
      // Build date filter conditions
      let dateFilter = sql`EXTRACT(YEAR FROM ${marketingProspects.date}) = ${currentYear}`;
      if (month) {
        dateFilter = sql`EXTRACT(YEAR FROM ${marketingProspects.date}) = ${currentYear} AND EXTRACT(MONTH FROM ${marketingProspects.date}) = ${month}`;
      }
      
      // Analytics query filters
      const queryFilters = { currentYear, month };

      // Get conversion rates and pipeline health
      const [conversionRates, quarterlyStats, topPerformers, salesWonPerMarketer, expectedOrdersShare, monthlyTrends, bdStats] = await Promise.all([
        // Conversion rates by stage
        db
          .select({
            stage: marketingProspects.stage,
            count: count(),
            percentage: sql<number>`ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2)`
          })
          .from(marketingProspects)
          .where(dateFilter)
          .groupBy(marketingProspects.stage),
        
        // Quarterly performance - Simplified to avoid GROUP BY issues
        db
          .select({
            quarter: sql<string>`'Q3'`, // Hardcoded for now to avoid GROUP BY issues
            leadsCount: count(marketingProspects.id),
            salesWonTotal: sql<number>`0`, // Simplified for now
          })
          .from(marketingProspects)
          .where(dateFilter),

        // Top performers - Weighted scoring system (Sales Won 40%, Expected Orders 25%, Leads 20%, Conversion Rate 15%)
        db
          .select({
            bdId: marketingUsers.id,
            marketerName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
            salesWonAmount: sql<number>`COALESCE((SELECT SUM(${marketingSalesWon.contractAmount}) FROM marketing_sales_won WHERE marketer_id = ${marketingUsers.id} AND EXTRACT(YEAR FROM created_at) = ${currentYear}), 0)`,
            expectedOrdersAmount: sql<number>`COALESCE((SELECT SUM(${marketingExpectedOrders.revenue}) FROM marketing_expected_orders WHERE marketer_id = ${marketingUsers.id} AND EXTRACT(YEAR FROM created_at) = ${currentYear}), 0)`,
            leadsCount: sql<number>`COALESCE(COUNT(CASE WHEN ${marketingProspects.stage} = 'lead' THEN 1 END), 0)`,
            totalProspectsHandled: sql<number>`COALESCE(COUNT(${marketingProspects.id}), 0)`,
            target: sql<number>`COALESCE(CAST(${marketingAnnualSummary.expectedTarget} AS DECIMAL), CAST(${marketingAnnualSummary.revisedTarget} AS DECIMAL), CAST(${marketingAnnualSummary.target} AS DECIMAL), 0)`,
          })
          .from(marketingUsers)
          .leftJoin(marketingProspects, and(
            eq(marketingProspects.bdId, marketingUsers.id),
            sql`EXTRACT(YEAR FROM ${marketingProspects.date}) = ${currentYear}`
          ))
          .leftJoin(marketingAnnualSummary, and(
            eq(marketingAnnualSummary.marketerId, marketingUsers.id),
            eq(marketingAnnualSummary.year, currentYear)
          ))
          .where(eq(marketingUsers.isActive, true))
          .groupBy(marketingUsers.id, marketingUsers.firstName, marketingUsers.lastName, marketingAnnualSummary.expectedTarget, marketingAnnualSummary.revisedTarget, marketingAnnualSummary.target)
          .limit(10),

        // Sales Won Per Marketer - Real data with actual targets
        db
          .select({
            bdId: marketingUsers.id,
            marketerName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
            salesWon: sql<number>`COALESCE(SUM(${marketingSalesWon.contractAmount}), 0)`,
            target: sql<number>`COALESCE(CAST(${marketingAnnualSummary.expectedTarget} AS DECIMAL), CAST(${marketingAnnualSummary.revisedTarget} AS DECIMAL), CAST(${marketingAnnualSummary.target} AS DECIMAL), 0)`,
          })
          .from(marketingUsers)
          .leftJoin(marketingSalesWon, and(
            eq(marketingSalesWon.marketerId, marketingUsers.id),
            month ? sql`EXTRACT(YEAR FROM ${marketingSalesWon.createdAt}) = ${currentYear} AND EXTRACT(MONTH FROM ${marketingSalesWon.createdAt}) = ${month}` : sql`EXTRACT(YEAR FROM ${marketingSalesWon.createdAt}) = ${currentYear}`
          ))
          .leftJoin(marketingAnnualSummary, and(
            eq(marketingAnnualSummary.marketerId, marketingUsers.id),
            eq(marketingAnnualSummary.year, currentYear)
          ))
          .where(eq(marketingUsers.isActive, true))
          .groupBy(marketingUsers.id, marketingUsers.firstName, marketingUsers.lastName, marketingAnnualSummary.expectedTarget, marketingAnnualSummary.revisedTarget, marketingAnnualSummary.target)
          .orderBy(desc(sql`COALESCE(SUM(${marketingSalesWon.contractAmount}), 0)`)),

        // Expected Orders Share - Real data
        db
          .select({
            bdId: marketingUsers.id,
            marketerName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
            expectedOrders: sql<number>`COALESCE(SUM(${marketingExpectedOrders.revenue}), 0)`,
          })
          .from(marketingUsers)
          .leftJoin(marketingExpectedOrders, and(
            eq(marketingExpectedOrders.marketerId, marketingUsers.id),
            month ? sql`EXTRACT(YEAR FROM ${marketingExpectedOrders.createdAt}) = ${currentYear} AND EXTRACT(MONTH FROM ${marketingExpectedOrders.createdAt}) = ${month}` : sql`EXTRACT(YEAR FROM ${marketingExpectedOrders.createdAt}) = ${currentYear}`
          ))
          .where(eq(marketingUsers.isActive, true))
          .groupBy(marketingUsers.id, marketingUsers.firstName, marketingUsers.lastName)
          .orderBy(desc(sql`COALESCE(SUM(${marketingExpectedOrders.revenue}), 0)`)),

        // Monthly Trends - Get data from all three tables separately and combine
        db
          .select({
            month: sql<string>`month_label`,
            leads: sql<number>`COALESCE(leads_amount, 0)`,
            salesWon: sql<number>`COALESCE(sales_won_amount, 0)`,
            expectedOrders: sql<number>`COALESCE(expected_orders_amount, 0)`,
          })
          .from(sql`(
            WITH monthly_data AS (
              -- Get leads revenue from prospects table
              SELECT 
                TO_CHAR(date, 'Mon YYYY') as month_label,
                COALESCE(SUM(CAST(revenue AS DECIMAL)), 0) as leads_amount,
                0 as sales_won_amount,
                0 as expected_orders_amount
              FROM marketing_prospects 
              WHERE stage = 'lead' 
                AND EXTRACT(YEAR FROM date) >= ${currentYear - 1}
              GROUP BY TO_CHAR(date, 'Mon YYYY')
              
              UNION ALL
              
              -- Get sales won revenue from sales won table
              SELECT 
                TO_CHAR(created_at, 'Mon YYYY') as month_label,
                0 as leads_amount,
                COALESCE(SUM(CAST(contract_amount AS DECIMAL)), 0) as sales_won_amount,
                0 as expected_orders_amount
              FROM marketing_sales_won 
              WHERE EXTRACT(YEAR FROM created_at) >= ${currentYear - 1}
              GROUP BY TO_CHAR(created_at, 'Mon YYYY')
              
              UNION ALL
              
              -- Get expected orders revenue from expected orders table
              SELECT 
                TO_CHAR(created_at, 'Mon YYYY') as month_label,
                0 as leads_amount,
                0 as sales_won_amount,
                COALESCE(SUM(CAST(revenue AS DECIMAL)), 0) as expected_orders_amount
              FROM marketing_expected_orders 
              WHERE EXTRACT(YEAR FROM created_at) >= ${currentYear - 1}
              GROUP BY TO_CHAR(created_at, 'Mon YYYY')
            )
            SELECT 
              month_label,
              SUM(leads_amount) as leads_amount,
              SUM(sales_won_amount) as sales_won_amount,
              SUM(expected_orders_amount) as expected_orders_amount
            FROM monthly_data
            GROUP BY month_label
            ORDER BY month_label
          ) as combined_data`),

        // BD Stats for Annual Summary Table - Get data from all relevant tables
        db
          .select({
            bdId: marketingUsers.id,
            bdName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
            prospectsCount: sql<number>`COALESCE(COUNT(CASE WHEN ${marketingProspects.stage} = 'prospect' THEN 1 END), 0)`,
            leadsCount: sql<number>`COALESCE(COUNT(CASE WHEN ${marketingProspects.stage} = 'lead' THEN 1 END), 0)`,
            // Get actual sales won amount from sales won table
            salesWonAmount: sql<number>`COALESCE((SELECT SUM(${marketingSalesWon.contractAmount}) FROM marketing_sales_won WHERE marketer_id = ${marketingUsers.id} AND EXTRACT(YEAR FROM created_at) = ${currentYear}), 0)`,
            // Get actual expected orders amount from expected orders table
            expectedOrdersAmount: sql<number>`COALESCE((SELECT SUM(${marketingExpectedOrders.revenue}) FROM marketing_expected_orders WHERE marketer_id = ${marketingUsers.id} AND EXTRACT(YEAR FROM created_at) = ${currentYear}), 0)`,
            // Total revenue from sales won only (actual closed deals)
            totalRevenue: sql<number>`COALESCE((SELECT SUM(${marketingSalesWon.contractAmount}) FROM marketing_sales_won WHERE marketer_id = ${marketingUsers.id} AND EXTRACT(YEAR FROM created_at) = ${currentYear}), 0)`,
            // Get actual targets from annual summary table
            target: sql<number>`COALESCE(CAST(${marketingAnnualSummary.expectedTarget} AS DECIMAL), CAST(${marketingAnnualSummary.revisedTarget} AS DECIMAL), CAST(${marketingAnnualSummary.target} AS DECIMAL), 0)`,
          })
          .from(marketingUsers)
          .leftJoin(marketingProspects, and(
            eq(marketingProspects.bdId, marketingUsers.id),
            sql`EXTRACT(YEAR FROM ${marketingProspects.date}) = ${currentYear}`
          ))
          .leftJoin(marketingAnnualSummary, and(
            eq(marketingAnnualSummary.marketerId, marketingUsers.id),
            eq(marketingAnnualSummary.year, currentYear)
          ))
          .where(eq(marketingUsers.isActive, true))
          .groupBy(marketingUsers.id, marketingUsers.firstName, marketingUsers.lastName, marketingAnnualSummary.expectedTarget, marketingAnnualSummary.revisedTarget, marketingAnnualSummary.target)
          .orderBy(desc(sql`COALESCE(SUM(${marketingProspects.revenue}), 0)`))
      ]);


      res.json({
        year: currentYear,
        conversionRates: conversionRates.map(rate => ({
          ...rate,
          count: Number(rate.count),
          percentage: Number(rate.percentage)
        })),
        quarterlyStats: quarterlyStats.map(stat => ({
          ...stat,
          leadsCount: Number(stat.leadsCount),
          salesWonTotal: Number(stat.salesWonTotal)
        })),
        topPerformers: topPerformers.map(performer => {
          const salesWonAmount = Number(performer.salesWonAmount);
          const expectedOrdersAmount = Number(performer.expectedOrdersAmount);
          const leadsCount = Number(performer.leadsCount);
          const totalProspectsHandled = Number(performer.totalProspectsHandled);
          const target = Number(performer.target);
          
          // Calculate conversion rate (sales won / target, or sales won / total prospects if no target)
          const conversionRate = target > 0 ? ((salesWonAmount / target) * 100) : 
                                (totalProspectsHandled > 0 ? (salesWonAmount > 0 ? 100 : 0) : 0);
          
          // Weighted scoring: Sales Won 40%, Expected Orders 25%, Leads 20%, Conversion Rate 15%
          // Normalize values (assuming max values for scoring)
          const maxSalesWon = Math.max(...topPerformers.map(p => Number(p.salesWonAmount)), 1);
          const maxExpectedOrders = Math.max(...topPerformers.map(p => Number(p.expectedOrdersAmount)), 1);
          const maxLeads = Math.max(...topPerformers.map(p => Number(p.leadsCount)), 1);
          const maxConversion = Math.max(...topPerformers.map(p => {
            const target = Number(p.target);
            const salesWon = Number(p.salesWonAmount);
            const prospects = Number(p.totalProspectsHandled);
            return target > 0 ? ((salesWon / target) * 100) : (prospects > 0 ? (salesWon > 0 ? 100 : 0) : 0);
          }), 1);
          
          const salesWonScore = (salesWonAmount / maxSalesWon) * 40;
          const expectedOrdersScore = (expectedOrdersAmount / maxExpectedOrders) * 25;
          const leadsScore = (leadsCount / maxLeads) * 20;
          const conversionScore = (conversionRate / maxConversion) * 15;
          
          const weightedScore = salesWonScore + expectedOrdersScore + leadsScore + conversionScore;
          
          return {
          ...performer,
            salesWonAmount,
            expectedOrdersAmount,
            leadsCount,
            totalProspectsHandled,
            target,
            conversionRate: Math.round(conversionRate * 100) / 100,
            weightedScore: Math.round(weightedScore * 100) / 100,
            totalRevenue: salesWonAmount // For backward compatibility
          };
        }).sort((a, b) => b.weightedScore - a.weightedScore),
        salesWonPerMarketer: salesWonPerMarketer.length > 0 ? salesWonPerMarketer.map(marketer => {
          const salesWon = Number(marketer.salesWon);
          const target = Number(marketer.target);
          return {
            marketerId: marketer.bdId,
            marketerName: marketer.marketerName,
            salesWon,
            target,
            achievementRate: target > 0 ? Math.round((salesWon / target) * 100) : 0
          };
        }) : [],
        expectedOrdersShare: (() => {
          if (expectedOrdersShare.length === 0) return [];
          const totalOrders = expectedOrdersShare.reduce((sum, marketer) => sum + Number(marketer.expectedOrders), 0);
          const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];
          return expectedOrdersShare.map((marketer, index) => {
            const expectedOrders = Number(marketer.expectedOrders);
            return {
              ...marketer,
              expectedOrders,
              percentage: totalOrders > 0 ? Math.round((expectedOrders / totalOrders) * 100) : 0,
              color: colors[index % colors.length]
            };
          });
        })(),
        monthlyTrends: monthlyTrends.length > 0 ? monthlyTrends.map(trend => ({
          ...trend,
          leads: Number(trend.leads),
          salesWon: Number(trend.salesWon),
          expectedOrders: Number(trend.expectedOrders)
        })) : (() => {
          // Generate sample data for the last 6 months if no real data exists
          const months = [];
          const currentDate = new Date();
          for (let i = 5; i >= 0; i--) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
            months.push({
              month: date.toLocaleString('default', { month: 'short' }) + ' ' + date.getFullYear(),
          leads: 0,
          salesWon: 0,
          expectedOrders: 0
            });
          }
          return months;
        })(),
        bdStats: bdStats.map(stat => ({
          ...stat,
          totalRevenue: Number(stat.totalRevenue),
          target: Number(stat.target),
          salesWonAmount: Number(stat.salesWonAmount),
          expectedOrdersAmount: Number(stat.expectedOrdersAmount),
        }))
      });
      
      // Analytics data processed successfully
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Lost Projects Routes
  app.get("/api/marketing/lost-projects", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { page = 1, limit = 50, year, marketerId, search, quarter, sectorId } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;
      const currentYear = year ? parseInt(year as string) : new Date().getFullYear();

      let whereCondition: any = sql`1=1`;
      
      // Filter by year
      whereCondition = sql`EXTRACT(YEAR FROM ${marketingLostProjects.lostDate}) = ${currentYear}`;
      
      // Filter by marketer if provided (admin can filter, regular users see only their own)
      if (marketerId) {
        whereCondition = sql`${whereCondition} AND ${marketingLostProjects.marketerId} = ${marketerId}`;
      } else if (req.marketingUser?.role !== 'admin') {
        whereCondition = sql`${whereCondition} AND ${marketingLostProjects.marketerId} = ${req.marketingUser!.id}`;
      }

      // Filter by search term
      if (search) {
        whereCondition = sql`${whereCondition} AND (
          ${marketingLostProjects.organisationName} ILIKE ${'%' + search + '%'} OR
          ${marketingLostProjects.lostReason} ILIKE ${'%' + search + '%'}
        )`;
      }

      // Filter by quarter
      if (quarter) {
        const quarterMap: { [key: string]: string } = {
          'Q1': '01,02,03',
          'Q2': '04,05,06', 
          'Q3': '07,08,09',
          'Q4': '10,11,12'
        };
        const months = quarterMap[quarter as string];
        if (months) {
          whereCondition = sql`${whereCondition} AND EXTRACT(MONTH FROM ${marketingLostProjects.lostDate}) IN (${months})`;
        }
      }

      // Filter by sector
      if (sectorId) {
        whereCondition = sql`${whereCondition} AND ${marketingLostProjects.sector} = ${sectorId}`;
      }

      const [lostProjects, totalCount] = await Promise.all([
        db
          .select({
            id: marketingLostProjects.id,
            organisationName: marketingLostProjects.organisationName,
            sector: marketingLostProjects.sector,
            product: marketingLostProjects.product,
            revenue: marketingLostProjects.revenue,
            expectedQuarter: marketingLostProjects.expectedQuarter,
            comments: marketingLostProjects.comments,
            marketerId: marketingLostProjects.marketerId,
            contactPerson: marketingLostProjects.contactPerson,
            contactNumber: marketingLostProjects.contactNumber,
            contactEmail: marketingLostProjects.contactEmail,
            lostReason: marketingLostProjects.lostReason,
            lostDate: marketingLostProjects.lostDate,
            canRevive: marketingLostProjects.canRevive,
            createdAt: marketingLostProjects.createdAt,
            updatedAt: marketingLostProjects.updatedAt,
            marketerName: sql<string>`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName})`,
            marketerEmail: marketingUsers.email,
          })
          .from(marketingLostProjects)
          .leftJoin(marketingUsers, eq(marketingLostProjects.marketerId, marketingUsers.id))
          .where(whereCondition)
          .orderBy(desc(marketingLostProjects.lostDate))
          .limit(limitNum)
          .offset(offset),
        db
          .select({ count: count() })
          .from(marketingLostProjects)
          .where(whereCondition)
      ]);

      res.json({
        lostProjects,
        totalCount: totalCount[0].count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount[0].count / limitNum)
      });
    } catch (error) {
      console.error("Error fetching lost projects:", error);
      res.status(500).json({ error: "Internal server error" });
    }
});

  // Revive lost project (move back to prospects)
  app.put("/api/marketing/lost-projects/:id/revive", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { stage = 'prospect' } = req.body;

      // Get the lost project
      const lostProject = await db
        .select()
        .from(marketingLostProjects)
        .where(eq(marketingLostProjects.id, id))
        .limit(1);

      if (lostProject.length === 0) {
        return res.status(404).json({ error: "Lost project not found" });
      }

      const project = lostProject[0];

      // Check permissions (admin or project owner)
      if (req.marketingUser?.role !== 'admin' && project.marketerId !== req.marketingUser?.id) {
        return res.status(403).json({ error: "Unauthorized to revive this project" });
      }

      // Create new prospect entry
      const newProspect = await db
        .insert(marketingProspects)
        .values({
          date: project.lostDate,
          client: project.organisationName,
          contactPerson: project.contactPerson || 'Contact Person',
          contactNumber: project.contactNumber || 'N/A',
          contactEmail: project.contactEmail || 'contact@example.com',
          systemInPlace: 'none' as any,
          needAvailability: 'none' as any,
          currentVendor: '',
          remarks: project.comments || `Revived from lost projects. Original lost reason: ${project.lostReason}`,
          revenue: project.revenue || '0',
          stage: stage as any,
          bdId: project.marketerId,
          sectorId: project.sector,
        } as any)
        .returning();

      // Delete from lost projects
      await db
        .delete(marketingLostProjects)
        .where(eq(marketingLostProjects.id, id));

      res.json({ 
        message: "Project revived successfully",
        prospect: newProspect[0]
      });
    } catch (error) {
      console.error("Error reviving lost project:", error);
      res.status(500).json({ error: "Internal server error" });
    }
});

  // Update lost project reason
  app.put("/api/marketing/lost-projects/:id", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { lostReason } = req.body;

      if (!lostReason || lostReason.trim().length < 10) {
        return res.status(400).json({ error: "Lost reason must be at least 10 characters long" });
      }

      // Check if project exists and user has permission
      const existingProject = await db
        .select()
        .from(marketingLostProjects)
        .where(eq(marketingLostProjects.id, id))
        .limit(1);

      if (existingProject.length === 0) {
        return res.status(404).json({ error: "Lost project not found" });
      }

      // Check permissions (admin or project owner)
      if (req.marketingUser?.role !== 'admin' && existingProject[0].marketerId !== req.marketingUser?.id) {
        return res.status(403).json({ error: "Unauthorized to update this project" });
      }

      const updatedProject = await db
        .update(marketingLostProjects)
        .set({
          lostReason,
          updatedAt: new Date().toISOString()
        })
        .where(eq(marketingLostProjects.id, id))
        .returning();

      res.json({ 
        message: "Lost reason updated successfully",
        lostProject: updatedProject[0]
      });
    } catch (error) {
      console.error("Error updating lost project:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}

// Helper function to convert data to CSV
function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(','))
  ].join('\n');

  return csvContent;
}
