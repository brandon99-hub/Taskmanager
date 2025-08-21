import { relations } from "drizzle-orm/relations";
import { teams, projects, users, teamMembers, tasks, taskDependencies, projectAttachments, notifications, userNotificationPreferences, userCalendarSettings, invoiceReports, invoiceCollections, teamMemberRoles, employeeRoles } from "./schema";

export const projectsRelations = relations(projects, ({one, many}) => ({
	team: one(teams, {
		fields: [projects.teamId],
		references: [teams.id]
	}),
	user: one(users, {
		fields: [projects.managerId],
		references: [users.id]
	}),
	tasks: many(tasks),
	projectAttachments: many(projectAttachments),
	invoiceReports: many(invoiceReports),
	invoiceCollections: many(invoiceCollections),
}));

export const teamsRelations = relations(teams, ({many}) => ({
	projects: many(projects),
	teamMembers: many(teamMembers),
	tasks: many(tasks),
}));

export const usersRelations = relations(users, ({many}) => ({
	projects: many(projects),
	teamMembers: many(teamMembers),
	tasks_assignedUserId: many(tasks, {
		relationName: "tasks_assignedUserId_users_id"
	}),
	tasks_createdById: many(tasks, {
		relationName: "tasks_createdById_users_id"
	}),
	projectAttachments: many(projectAttachments),
	notifications: many(notifications),
	userNotificationPreferences: many(userNotificationPreferences),
	userCalendarSettings: many(userCalendarSettings),
	invoiceReports: many(invoiceReports),
	invoiceCollections: many(invoiceCollections),
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

export const tasksRelations = relations(tasks, ({one, many}) => ({
	project: one(projects, {
		fields: [tasks.projectId],
		references: [projects.id]
	}),
	user_assignedUserId: one(users, {
		fields: [tasks.assignedUserId],
		references: [users.id],
		relationName: "tasks_assignedUserId_users_id"
	}),
	user_createdById: one(users, {
		fields: [tasks.createdById],
		references: [users.id],
		relationName: "tasks_createdById_users_id"
	}),
	team: one(teams, {
		fields: [tasks.assignedTeamId],
		references: [teams.id]
	}),
	taskDependencies_taskId: many(taskDependencies, {
		relationName: "taskDependencies_taskId_tasks_id"
	}),
	taskDependencies_dependsOnTaskId: many(taskDependencies, {
		relationName: "taskDependencies_dependsOnTaskId_tasks_id"
	}),
	invoiceReports: many(invoiceReports),
	invoiceCollections: many(invoiceCollections),
}));

export const taskDependenciesRelations = relations(taskDependencies, ({one}) => ({
	task_taskId: one(tasks, {
		fields: [taskDependencies.taskId],
		references: [tasks.id],
		relationName: "taskDependencies_taskId_tasks_id"
	}),
	task_dependsOnTaskId: one(tasks, {
		fields: [taskDependencies.dependsOnTaskId],
		references: [tasks.id],
		relationName: "taskDependencies_dependsOnTaskId_tasks_id"
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

export const notificationsRelations = relations(notifications, ({one}) => ({
	user: one(users, {
		fields: [notifications.userId],
		references: [users.id]
	}),
}));

export const userNotificationPreferencesRelations = relations(userNotificationPreferences, ({one}) => ({
	user: one(users, {
		fields: [userNotificationPreferences.userId],
		references: [users.id]
	}),
}));

export const userCalendarSettingsRelations = relations(userCalendarSettings, ({one}) => ({
	user: one(users, {
		fields: [userCalendarSettings.userId],
		references: [users.id]
	}),
}));

export const invoiceReportsRelations = relations(invoiceReports, ({one, many}) => ({
	task: one(tasks, {
		fields: [invoiceReports.taskId],
		references: [tasks.id]
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

export const invoiceCollectionsRelations = relations(invoiceCollections, ({one}) => ({
	invoiceReport: one(invoiceReports, {
		fields: [invoiceCollections.invoiceId],
		references: [invoiceReports.id]
	}),
	task: one(tasks, {
		fields: [invoiceCollections.taskId],
		references: [tasks.id]
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