import { relations } from "drizzle-orm/relations";
import { projects, modules, users, teams, milestones, moduleDependencies, moduleMilestones, notifications, invoiceReports, projectPhases, projectAttachments, teamMembers, teamMemberRoles, employeeRoles, userCalendarSettings, userNotificationPreferences, subtasks, invoiceCollections, subtaskDependencies } from "./schema";

export const modulesRelations = relations(modules, ({one, many}) => ({
	project: one(projects, {
		fields: [modules.projectId],
		references: [projects.id]
	}),
	user_assignedUserId: one(users, {
		fields: [modules.assignedUserId],
		references: [users.id],
		relationName: "modules_assignedUserId_users_id"
	}),
	team: one(teams, {
		fields: [modules.assignedTeamId],
		references: [teams.id]
	}),
	user_createdById: one(users, {
		fields: [modules.createdById],
		references: [users.id],
		relationName: "modules_createdById_users_id"
	}),
	moduleDependencies_moduleId: many(moduleDependencies, {
		relationName: "moduleDependencies_moduleId_modules_id"
	}),
	moduleDependencies_dependsOnModuleId: many(moduleDependencies, {
		relationName: "moduleDependencies_dependsOnModuleId_modules_id"
	}),
	moduleMilestones: many(moduleMilestones),
	invoiceReports: many(invoiceReports),
	subtasks: many(subtasks),
	invoiceCollections: many(invoiceCollections),
}));

export const projectsRelations = relations(projects, ({one, many}) => ({
	modules: many(modules),
	milestones: many(milestones),
	invoiceReports: many(invoiceReports),
	projectPhases: many(projectPhases),
	projectAttachments: many(projectAttachments),
	team: one(teams, {
		fields: [projects.teamId],
		references: [teams.id]
	}),
	user: one(users, {
		fields: [projects.managerId],
		references: [users.id]
	}),
	invoiceCollections: many(invoiceCollections),
}));

export const usersRelations = relations(users, ({many}) => ({
	modules_assignedUserId: many(modules, {
		relationName: "modules_assignedUserId_users_id"
	}),
	modules_createdById: many(modules, {
		relationName: "modules_createdById_users_id"
	}),
	milestones: many(milestones),
	notifications: many(notifications),
	invoiceReports: many(invoiceReports),
	projectAttachments: many(projectAttachments),
	projects: many(projects),
	teamMembers: many(teamMembers),
	userCalendarSettings: many(userCalendarSettings),
	userNotificationPreferences: many(userNotificationPreferences),
	subtasks_assignedUserId: many(subtasks, {
		relationName: "subtasks_assignedUserId_users_id"
	}),
	subtasks_assignedDevId: many(subtasks, {
		relationName: "subtasks_assignedDevId_users_id"
	}),
	subtasks_assignedConsultantId: many(subtasks, {
		relationName: "subtasks_assignedConsultantId_users_id"
	}),
	subtasks_createdById: many(subtasks, {
		relationName: "subtasks_createdById_users_id"
	}),
	invoiceCollections: many(invoiceCollections),
}));

export const teamsRelations = relations(teams, ({many}) => ({
	modules: many(modules),
	projects: many(projects),
	teamMembers: many(teamMembers),
}));

export const milestonesRelations = relations(milestones, ({one, many}) => ({
	project: one(projects, {
		fields: [milestones.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [milestones.createdById],
		references: [users.id]
	}),
	moduleMilestones: many(moduleMilestones),
}));

export const moduleDependenciesRelations = relations(moduleDependencies, ({one}) => ({
	module_moduleId: one(modules, {
		fields: [moduleDependencies.moduleId],
		references: [modules.id],
		relationName: "moduleDependencies_moduleId_modules_id"
	}),
	module_dependsOnModuleId: one(modules, {
		fields: [moduleDependencies.dependsOnModuleId],
		references: [modules.id],
		relationName: "moduleDependencies_dependsOnModuleId_modules_id"
	}),
}));

export const moduleMilestonesRelations = relations(moduleMilestones, ({one}) => ({
	module: one(modules, {
		fields: [moduleMilestones.moduleId],
		references: [modules.id]
	}),
	milestone: one(milestones, {
		fields: [moduleMilestones.milestoneId],
		references: [milestones.id]
	}),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	user: one(users, {
		fields: [notifications.userId],
		references: [users.id]
	}),
}));

export const invoiceReportsRelations = relations(invoiceReports, ({one, many}) => ({
	module: one(modules, {
		fields: [invoiceReports.moduleId],
		references: [modules.id]
	}),
	project: one(projects, {
		fields: [invoiceReports.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [invoiceReports.sentBy],
		references: [users.id]
	}),
	invoiceCollections: many(invoiceCollections),
}));

export const projectPhasesRelations = relations(projectPhases, ({one}) => ({
	project: one(projects, {
		fields: [projectPhases.projectId],
		references: [projects.id]
	}),
}));

export const projectAttachmentsRelations = relations(projectAttachments, ({one}) => ({
	project: one(projects, {
		fields: [projectAttachments.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [projectAttachments.uploadedById],
		references: [users.id]
	}),
}));

export const teamMembersRelations = relations(teamMembers, ({one, many}) => ({
	team: one(teams, {
		fields: [teamMembers.teamId],
		references: [teams.id]
	}),
	user: one(users, {
		fields: [teamMembers.userId],
		references: [users.id]
	}),
	teamMemberRoles: many(teamMemberRoles),
}));

export const teamMemberRolesRelations = relations(teamMemberRoles, ({one}) => ({
	teamMember: one(teamMembers, {
		fields: [teamMemberRoles.teamMemberId],
		references: [teamMembers.id]
	}),
	employeeRole: one(employeeRoles, {
		fields: [teamMemberRoles.roleId],
		references: [employeeRoles.id]
	}),
}));

export const employeeRolesRelations = relations(employeeRoles, ({many}) => ({
	teamMemberRoles: many(teamMemberRoles),
}));

export const userCalendarSettingsRelations = relations(userCalendarSettings, ({one}) => ({
	user: one(users, {
		fields: [userCalendarSettings.userId],
		references: [users.id]
	}),
}));

export const userNotificationPreferencesRelations = relations(userNotificationPreferences, ({one}) => ({
	user: one(users, {
		fields: [userNotificationPreferences.userId],
		references: [users.id]
	}),
}));

export const subtasksRelations = relations(subtasks, ({one, many}) => ({
	module: one(modules, {
		fields: [subtasks.moduleId],
		references: [modules.id]
	}),
	user_assignedUserId: one(users, {
		fields: [subtasks.assignedUserId],
		references: [users.id],
		relationName: "subtasks_assignedUserId_users_id"
	}),
	user_assignedDevId: one(users, {
		fields: [subtasks.assignedDevId],
		references: [users.id],
		relationName: "subtasks_assignedDevId_users_id"
	}),
	user_assignedConsultantId: one(users, {
		fields: [subtasks.assignedConsultantId],
		references: [users.id],
		relationName: "subtasks_assignedConsultantId_users_id"
	}),
	user_createdById: one(users, {
		fields: [subtasks.createdById],
		references: [users.id],
		relationName: "subtasks_createdById_users_id"
	}),
	subtaskDependencies_subtaskId: many(subtaskDependencies, {
		relationName: "subtaskDependencies_subtaskId_subtasks_id"
	}),
	subtaskDependencies_dependsOnSubtaskId: many(subtaskDependencies, {
		relationName: "subtaskDependencies_dependsOnSubtaskId_subtasks_id"
	}),
}));

export const invoiceCollectionsRelations = relations(invoiceCollections, ({one}) => ({
	invoiceReport: one(invoiceReports, {
		fields: [invoiceCollections.invoiceId],
		references: [invoiceReports.id]
	}),
	module: one(modules, {
		fields: [invoiceCollections.moduleId],
		references: [modules.id]
	}),
	project: one(projects, {
		fields: [invoiceCollections.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [invoiceCollections.collectedBy],
		references: [users.id]
	}),
}));

export const subtaskDependenciesRelations = relations(subtaskDependencies, ({one}) => ({
	subtask_subtaskId: one(subtasks, {
		fields: [subtaskDependencies.subtaskId],
		references: [subtasks.id],
		relationName: "subtaskDependencies_subtaskId_subtasks_id"
	}),
	subtask_dependsOnSubtaskId: one(subtasks, {
		fields: [subtaskDependencies.dependsOnSubtaskId],
		references: [subtasks.id],
		relationName: "subtaskDependencies_dependsOnSubtaskId_subtasks_id"
	}),
}));