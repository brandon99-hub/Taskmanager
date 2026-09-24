import { z } from "zod";

// Marketing User Schemas
export const marketingUserRoleSchema = z.enum(['admin', 'marketer', 'business_development']);
export const salesStageSchema = z.enum(['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']);
export const quarterSchema = z.enum(['Q1', 'Q2', 'Q3', 'Q4']);
export const systemInPlaceSchema = z.enum(['navision', '365_bc', 'none', 'open_source', 'oracle', 'sap']);
export const needAvailabilitySchema = z.enum(['upgrade', 'under_implementation', 'none']);
export const prospectStageSchema = z.enum(['prospect', 'lead', 'expected_order', 'sales_won']);

// Marketing User Schemas
export const marketingUserLoginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const marketingUserRegisterSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phoneNumber: z.string().optional(),
  role: marketingUserRoleSchema.default('marketer'),
});

export const marketingUserUpdateSchema = z.object({
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  phoneNumber: z.string().optional(),
  role: marketingUserRoleSchema.optional(),
  isActive: z.boolean().optional(),
  target: z.number().positive("Target must be positive").optional(),
});

// Sector Schemas
export const marketingSectorCreateSchema = z.object({
  name: z.string().min(1, "Sector name is required").max(200, "Sector name too long"),
  description: z.string().optional(),
});

export const marketingSectorUpdateSchema = marketingSectorCreateSchema.partial();

// Project Schemas
export const marketingProjectCreateSchema = z.object({
  sectorId: z.string().min(1, "Sector is required"),
  institution: z.string().min(1, "Institution name is required").max(200, "Institution name too long"),
  leadMarketer: z.string().optional(),
  contactPerson: z.string().max(200, "Contact person name too long").optional(),
  contactNumber: z.string().max(20, "Contact number too long").optional(),
  systemInPlace: systemInPlaceSchema.optional(),
  needAvailability: needAvailabilitySchema.optional(),
  currentVendor: z.string().max(200, "Current vendor name too long").optional(),
  remarks: z.string().optional(),
  status: z.enum(['active', 'completed', 'paused']).default('active'),
});

export const marketingProjectUpdateSchema = z.object({
  institution: z.string().min(1, "Institution name is required").max(200, "Institution name too long").optional(),
  leadMarketer: z.string().nullable().optional(),
  contactPerson: z.string().max(200, "Contact person name too long").optional(),
  contactNumber: z.string().max(20, "Contact number too long").optional(),
  systemInPlace: systemInPlaceSchema.optional(),
  needAvailability: needAvailabilitySchema.optional(),
  currentVendor: z.string().max(200, "Current vendor name too long").optional(),
  remarks: z.string().optional(),
  status: z.enum(['active', 'completed', 'paused']).optional(),
  sectorId: z.string().optional(),
}).transform((data) => {
  // Convert empty strings to undefined for optional fields
  return {
    ...data,
    leadMarketer: data.leadMarketer === "" ? undefined : data.leadMarketer,
    contactPerson: data.contactPerson === "" ? undefined : data.contactPerson,
    contactNumber: data.contactNumber === "" ? undefined : data.contactNumber,
    currentVendor: data.currentVendor === "" ? undefined : data.currentVendor,
    remarks: data.remarks === "" ? undefined : data.remarks,
  };
});

// Prospect Schemas (updated from leads)
export const marketingProspectCreateSchema = z.object({
  date: z.string().datetime("Invalid date format"),
  client: z.string().min(1, "Client name is required").max(200, "Client name too long"),
  contactPerson: z.string().min(1, "Contact person is required").max(200, "Contact person name too long"),
  contactNumber: z.string().min(1, "Contact number is required").max(20, "Contact number too long"),
  contactEmail: z.string().email("Valid email required").max(255, "Email too long"),
  systemInPlace: systemInPlaceSchema,
  needAvailability: needAvailabilitySchema,
  currentVendor: z.string().max(200, "Current vendor name too long").optional(),
  remarks: z.string().optional(),
  revenue: z.number().positive("Revenue must be positive").optional(),
  stage: prospectStageSchema.default('prospect'),
  sectorId: z.string().optional(),
});

export const marketingProspectUpdateSchema = marketingProspectCreateSchema.partial().extend({
  bdId: z.string().optional(),
});

// Shared Account Schemas
export const marketingSharedAccountSchema = z.object({
  originalProspectId: z.string().min(1, "Original prospect ID is required"),
  sharedWithBdId: z.string().min(1, "BD member to share with is required"),
  revenueSplit: z.number().min(0, "Revenue split must be positive").max(100, "Revenue split cannot exceed 100%"),
});

// Sales Won Schemas
export const marketingSalesWonCreateSchema = z.object({
  organisationName: z.string().min(1, "Organisation name is required").max(200, "Organisation name too long"),
  sector: z.string().min(1, "Sector is required").max(100, "Sector name too long"),
  product: z.string().min(1, "Product is required").max(200, "Product name too long"),
  contractAmount: z.number().positive("Contract amount must be positive"),
  expectedQuarter: quarterSchema,
  comments: z.string().optional(),
});

export const marketingSalesWonUpdateSchema = marketingSalesWonCreateSchema.partial().extend({
  marketerId: z.string().optional(),
});

// Expected Orders Schemas
export const marketingExpectedOrdersCreateSchema = z.object({
  organisationName: z.string().min(1, "Organisation name is required").max(200, "Organisation name too long"),
  sector: z.string().min(1, "Sector is required").max(100, "Sector name too long"),
  product: z.string().min(1, "Product is required").max(200, "Product name too long"),
  revenue: z.number().positive("Revenue must be positive"),
  expectedQuarter: quarterSchema,
  comments: z.string().optional(),
});

export const marketingExpectedOrdersUpdateSchema = marketingExpectedOrdersCreateSchema.partial().extend({
  marketerId: z.string().optional(),
});


// Annual Summary Schemas
export const marketingAnnualSummaryCreateSchema = z.object({
  year: z.number().int().min(2020, "Year must be 2020 or later").max(2030, "Year must be 2030 or earlier"),
  salesExecutive: z.string().min(1, "Sales executive name is required").max(200, "Sales executive name too long"),
  won: z.number().min(0, "Won amount cannot be negative").default(0),
  target: z.number().positive("Target must be positive"),
  targetAchieved: z.number().min(0, "Target achieved cannot be negative").max(100, "Target achieved cannot exceed 100%").default(0),
  expectedOrders: z.number().min(0, "Expected orders cannot be negative").default(0),
  statusQuo: z.number().min(0, "Status quo cannot be negative").default(0),
  deviationFromTarget: z.number().default(0),
  sumSalesExpected: z.number().min(0, "Sum sales expected cannot be negative").default(0),
  expectedTarget: z.number().min(0, "Expected target cannot be negative").default(0),
});

export const marketingAnnualSummaryUpdateSchema = marketingAnnualSummaryCreateSchema.partial();

// Query Schemas
export const marketingQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default("1"),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default("10"),
  search: z.string().optional(),
  year: z.string().transform(Number).pipe(z.number().int()).optional(),
  quarter: quarterSchema.optional(),
  sector: z.string().optional(),
  marketerId: z.string().optional(),
  bdId: z.string().optional(),
  sectorId: z.string().optional(),
  stage: prospectStageSchema.optional(),
  month: z.string().transform(Number).pipe(z.number().int().min(1).max(12)).optional(),
});

// Export Schemas
export const marketingExportSchema = z.object({
  type: z.enum(['leads', 'sales-won', 'expected-orders', 'prospects', 'annual-summary']),
  format: z.enum(['csv', 'excel']).default('excel'),
  year: z.string().transform(Number).pipe(z.number().int()).optional(),
  quarter: quarterSchema.optional(),
  marketerId: z.string().optional(),
});
