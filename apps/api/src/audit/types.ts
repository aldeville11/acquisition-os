/**
 * AuditEvent types — Sprint 3 foundation (ADR 0009).
 * No reporting / analytics.
 */

export const AUDIT_ACTIONS = [
  "login",
  "logout",
  "organization.created",
  "organization.updated",
  "workspace.created",
  "workspace.updated",
  "membership.assigned",
  "membership.revoked",
  "permission.granted",
  "permission.denied",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditOutcome = "success" | "failure";

export type AuditEventRecord = {
  id: string;
  action: AuditAction | string;
  actorUserId: string | null;
  organizationId: string | null;
  workspaceId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  permission: string | null;
  outcome: AuditOutcome;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AuditWriteInput = {
  action: AuditAction | string;
  actorUserId?: string | null;
  organizationId?: string | null;
  workspaceId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  permission?: string | null;
  outcome: AuditOutcome;
  metadata?: Record<string, unknown>;
};
