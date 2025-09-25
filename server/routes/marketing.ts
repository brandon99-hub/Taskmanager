import type { Express } from "express";
import { db } from "../db";
import {
  marketingUsers,
  marketingLeads,
  marketingSalesWon,
  marketingExpectedOrders,
  marketingProspects,
  marketingAnnualSummary,
} from "../../shared/schema";
import {
  marketingUserLoginSchema,
  marketingUserRegisterSchema,
  marketingUserUpdateSchema,
  marketingLeadCreateSchema,
  marketingLeadUpdateSchema,
  marketingSalesWonCreateSchema,
  marketingSalesWonUpdateSchema,
  marketingExpectedOrdersCreateSchema,
  marketingExpectedOrdersUpdateSchema,
  marketingProspectsCreateSchema,
  marketingProspectsUpdateSchema,
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
import { eq, and, desc, asc, like, sql, count } from "drizzle-orm";
import { generateExcelBuffer } from "../utils/excelExport";
import { z } from "zod";

export function registerMarketingRoutes(app: Express) {
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
        } as any)
        .returning();

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

  // Marketing User Management Routes
  app.get("/api/marketing/users", marketingAuth, marketingAdminAuth, async (req, res) => {
    try {
      const { page, limit, search } = marketingQuerySchema.parse(req.query);

      const offset = (page - 1) * limit;
      let whereCondition = eq(marketingUsers.isActive, true);

      if (search) {
        whereCondition = and(
          eq(marketingUsers.isActive, true),
          sql`CONCAT(${marketingUsers.firstName}, ' ', ${marketingUsers.lastName}, ' ', ${marketingUsers.email}) ILIKE ${`%${search}%`}`
        );
      } else {
        whereCondition = eq(marketingUsers.isActive, true);
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

  // Leads Routes
  app.get("/api/marketing/leads", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { page, limit, search, year, quarter, marketerId } = marketingQuerySchema.parse(req.query);
      const offset = (page - 1) * limit;

      let whereCondition: any = eq(marketingLeads.marketerId, marketerId || req.marketingUser!.id);

      if (search) {
        whereCondition = and(
          whereCondition,
          like(marketingLeads.client, `%${search}%`)
        );
      }

      if (year) {
        whereCondition = and(
          whereCondition,
          sql`EXTRACT(YEAR FROM ${marketingLeads.date}) = ${year}`
        );
      }

      const [leads, totalCount] = await Promise.all([
        db
          .select()
          .from(marketingLeads)
          .where(whereCondition)
          .orderBy(desc(marketingLeads.date))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: count() })
          .from(marketingLeads)
          .where(whereCondition),
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

  app.post("/api/marketing/leads", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const leadData = marketingLeadCreateSchema.parse(req.body);

      const newLead = await db
        .insert(marketingLeads)
        .values({
          date: leadData.date,
          client: leadData.client,
          contactDetails: leadData.contactDetails,
          remarks: leadData.remarks,
          budget: leadData.budget?.toString(),
          salesStage: leadData.salesStage,
          facilitationCost: leadData.facilitationCost?.toString(),
          marketerId: req.marketingUser!.id,
        } as any)
        .returning();

      res.status(201).json({ lead: newLead[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/marketing/leads/:id", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = marketingLeadUpdateSchema.parse(req.body);

      // Check if lead belongs to user (unless admin)
      if (req.marketingUser!.role !== 'admin') {
        const existingLead = await db
          .select()
          .from(marketingLeads)
          .where(and(eq(marketingLeads.id, id), eq(marketingLeads.marketerId, req.marketingUser!.id)))
          .limit(1);

        if (existingLead.length === 0) {
          return res.status(404).json({ error: "Lead not found" });
        }
      }

      // Convert numeric fields to strings for decimal columns
      const processedUpdateData = {
        ...updateData,
        budget: updateData.budget?.toString(),
        facilitationCost: updateData.facilitationCost?.toString(),
        updatedAt: new Date().toISOString()
      };

      const updatedLead = await db
        .update(marketingLeads)
        .set(processedUpdateData)
        .where(eq(marketingLeads.id, id))
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

  app.delete("/api/marketing/leads/:id", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { id } = req.params;

      // Check if lead belongs to user (unless admin)
      if (req.marketingUser!.role !== 'admin') {
        const existingLead = await db
          .select()
          .from(marketingLeads)
          .where(and(eq(marketingLeads.id, id), eq(marketingLeads.marketerId, req.marketingUser!.id)))
          .limit(1);

        if (existingLead.length === 0) {
          return res.status(404).json({ error: "Lead not found" });
        }
      }

      await db.delete(marketingLeads).where(eq(marketingLeads.id, id));

      res.json({ message: "Lead deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Sales Won Routes
  app.get("/api/marketing/sales-won", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { page, limit, search, year, quarter, marketerId } = marketingQuerySchema.parse(req.query);
      const offset = (page - 1) * limit;

      let whereCondition: any = eq(marketingSalesWon.marketerId, marketerId || req.marketingUser!.id);

      if (search) {
        whereCondition = and(
          whereCondition,
          like(marketingSalesWon.organisationName, `%${search}%`)
        );
      }

      if (year) {
        whereCondition = and(
          whereCondition,
          sql`EXTRACT(YEAR FROM ${marketingSalesWon.createdAt}) = ${year}`
        );
      }

      if (quarter) {
        whereCondition = and(whereCondition, eq(marketingSalesWon.expectedQuarter, quarter));
      }

      const [salesWon, totalCount] = await Promise.all([
        db
          .select()
          .from(marketingSalesWon)
          .where(whereCondition)
          .orderBy(desc(marketingSalesWon.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: count() })
          .from(marketingSalesWon)
          .where(whereCondition),
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

  app.post("/api/marketing/sales-won", marketingAuth, marketingUserAuth, async (req, res) => {
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

  app.put("/api/marketing/sales-won/:id", marketingAuth, marketingUserAuth, async (req, res) => {
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
      const processedUpdateData = {
        ...updateData,
        contractAmount: updateData.contractAmount?.toString(),
        updatedAt: new Date().toISOString()
      };

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

  app.delete("/api/marketing/sales-won/:id", marketingAuth, marketingUserAuth, async (req, res) => {
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
      const { page, limit, search, year, quarter, marketerId } = marketingQuerySchema.parse(req.query);
      const offset = (page - 1) * limit;

      let whereCondition: any = eq(marketingExpectedOrders.marketerId, marketerId || req.marketingUser!.id);

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
          .select()
          .from(marketingExpectedOrders)
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
      const processedUpdateData = {
        ...updateData,
        revenue: updateData.revenue?.toString(),
        updatedAt: new Date().toISOString()
      };

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

  // Prospects Routes
  app.get("/api/marketing/prospects", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { page, limit, search, year, quarter, marketerId } = marketingQuerySchema.parse(req.query);
      const offset = (page - 1) * limit;

      let whereCondition: any = eq(marketingProspects.marketerId, marketerId || req.marketingUser!.id);

      if (search) {
        whereCondition = and(
          whereCondition,
          like(marketingProspects.organisationName, `%${search}%`)
        );
      }

      if (year) {
        whereCondition = and(
          whereCondition,
          sql`EXTRACT(YEAR FROM ${marketingProspects.createdAt}) = ${year}`
        );
      }

      if (quarter) {
        whereCondition = and(whereCondition, eq(marketingProspects.expectedQuarter, quarter));
      }

      const [prospects, totalCount] = await Promise.all([
        db
          .select()
          .from(marketingProspects)
          .where(whereCondition)
          .orderBy(desc(marketingProspects.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: count() })
          .from(marketingProspects)
          .where(whereCondition),
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

  app.post("/api/marketing/prospects", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const prospectsData = marketingProspectsCreateSchema.parse(req.body);

      const newProspects = await db
        .insert(marketingProspects)
        .values({
          organisationName: prospectsData.organisationName,
          sector: prospectsData.sector,
          product: prospectsData.product,
          revenue: prospectsData.revenue.toString(),
          expectedQuarter: prospectsData.expectedQuarter,
          comments: prospectsData.comments,
          marketerId: req.marketingUser!.id,
        } as any)
        .returning();

      res.status(201).json({ prospects: newProspects[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/marketing/prospects/:id", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = marketingProspectsUpdateSchema.parse(req.body);

      // Check if prospects belongs to user (unless admin)
      if (req.marketingUser!.role !== 'admin') {
        const existingProspects = await db
          .select()
          .from(marketingProspects)
          .where(and(eq(marketingProspects.id, id), eq(marketingProspects.marketerId, req.marketingUser!.id)))
          .limit(1);

        if (existingProspects.length === 0) {
          return res.status(404).json({ error: "Prospects record not found" });
        }
      }

      // Convert numeric fields to strings for decimal columns
      const processedUpdateData = {
        ...updateData,
        revenue: updateData.revenue?.toString(),
        updatedAt: new Date().toISOString()
      };

      const updatedProspects = await db
        .update(marketingProspects)
        .set(processedUpdateData)
        .where(eq(marketingProspects.id, id))
        .returning();

      if (updatedProspects.length === 0) {
        return res.status(404).json({ error: "Prospects record not found" });
      }

      res.json({ prospects: updatedProspects[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/marketing/prospects/:id", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { id } = req.params;

      // Check if prospects belongs to user (unless admin)
      if (req.marketingUser!.role !== 'admin') {
        const existingProspects = await db
          .select()
          .from(marketingProspects)
          .where(and(eq(marketingProspects.id, id), eq(marketingProspects.marketerId, req.marketingUser!.id)))
          .limit(1);

        if (existingProspects.length === 0) {
          return res.status(404).json({ error: "Prospects record not found" });
        }
      }

      await db.delete(marketingProspects).where(eq(marketingProspects.id, id));

      res.json({ message: "Prospects record deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Annual Summary Routes
  app.get("/api/marketing/annual-summary", marketingAuth, marketingUserAuth, async (req, res) => {
    try {
      const { page, limit, year, marketerId } = marketingQuerySchema.parse(req.query);
      const offset = (page - 1) * limit;

      let whereCondition: any = eq(marketingAnnualSummary.marketerId, marketerId || req.marketingUser!.id);

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

      let whereCondition: any = eq(marketingLeads.marketerId, marketerId || req.marketingUser!.id);
      let data: any[] = [];
      let filename = '';

      switch (type) {
        case 'leads':
          if (year) {
            whereCondition = and(
              whereCondition,
              sql`EXTRACT(YEAR FROM ${marketingLeads.date}) = ${year}`
            );
          }
          data = await db.select().from(marketingLeads).where(whereCondition);
          filename = `leads_${year || 'all'}.${format}`;
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
          whereCondition = eq(marketingProspects.marketerId, marketerId || req.marketingUser!.id);
          if (year) {
            whereCondition = and(
              whereCondition,
              sql`EXTRACT(YEAR FROM ${marketingProspects.createdAt}) = ${year}`
            );
          }
          if (quarter) {
            whereCondition = and(whereCondition, eq(marketingProspects.expectedQuarter, quarter));
          }
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
      const { year, marketerId } = marketingQuerySchema.parse(req.query);
      const currentYear = year || new Date().getFullYear();
      const targetMarketerId = marketerId || req.marketingUser!.id;

      // Get stats for the specified year
      const [leadsCount, salesWonTotal, expectedOrdersTotal, prospectsTotal, annualSummary] = await Promise.all([
        db
          .select({ count: count() })
          .from(marketingLeads)
          .where(
            and(
              eq(marketingLeads.marketerId, targetMarketerId),
              sql`EXTRACT(YEAR FROM ${marketingLeads.date}) = ${currentYear}`
            )
          ),
        db
          .select({ total: sql<number>`COALESCE(SUM(${marketingSalesWon.contractAmount}), 0)` })
          .from(marketingSalesWon)
          .where(
            and(
              eq(marketingSalesWon.marketerId, targetMarketerId),
              sql`EXTRACT(YEAR FROM ${marketingSalesWon.createdAt}) = ${currentYear}`
            )
          ),
        db
          .select({ total: sql<number>`COALESCE(SUM(${marketingExpectedOrders.revenue}), 0)` })
          .from(marketingExpectedOrders)
          .where(
            and(
              eq(marketingExpectedOrders.marketerId, targetMarketerId),
              sql`EXTRACT(YEAR FROM ${marketingExpectedOrders.createdAt}) = ${currentYear}`
            )
          ),
        db
          .select({ total: sql<number>`COALESCE(SUM(${marketingProspects.revenue}), 0)` })
          .from(marketingProspects)
          .where(
            and(
              eq(marketingProspects.marketerId, targetMarketerId),
              sql`EXTRACT(YEAR FROM ${marketingProspects.createdAt}) = ${currentYear}`
            )
          ),
        db
          .select()
          .from(marketingAnnualSummary)
          .where(
            and(
              eq(marketingAnnualSummary.marketerId, targetMarketerId),
              eq(marketingAnnualSummary.year, currentYear)
            )
          )
          .limit(1),
      ]);

      res.json({
        year: currentYear,
        leadsCount: leadsCount[0].count,
        salesWonTotal: Number(salesWonTotal[0].total),
        expectedOrdersTotal: Number(expectedOrdersTotal[0].total),
        prospectsTotal: Number(prospectsTotal[0].total),
        annualSummary: annualSummary[0] || null,
      });
    } catch (error) {
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
