import { newId } from "../identity/tokens.js";
import type { PlatformStore } from "../platform/types.js";
import type { AuditAction, AuditEventRecord, AuditWriteInput } from "./types.js";

/**
 * Durable AuditEvent writers — Sprint 3 foundation only (no reporting).
 */
export class AuditService {
  constructor(private readonly store: PlatformStore) {}

  async write(input: AuditWriteInput): Promise<AuditEventRecord> {
    const now = new Date().toISOString();
    return this.store.appendAuditEvent({
      id: newId("aud"),
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      organizationId: input.organizationId ?? null,
      workspaceId: input.workspaceId ?? null,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      permission: input.permission ?? null,
      outcome: input.outcome,
      metadata: input.metadata ?? {},
      createdAt: now,
    });
  }

  async loginSuccess(actorUserId: string, organizationId: string | null): Promise<void> {
    await this.write({
      action: "login" satisfies AuditAction,
      actorUserId,
      organizationId,
      outcome: "success",
      resourceType: "session",
    });
  }

  async loginFailure(email: string): Promise<void> {
    await this.write({
      action: "login",
      actorUserId: null,
      outcome: "failure",
      resourceType: "session",
      metadata: { email },
    });
  }

  async logout(actorUserId: string | null, organizationId: string | null): Promise<void> {
    await this.write({
      action: "logout",
      actorUserId,
      organizationId,
      outcome: "success",
      resourceType: "session",
    });
  }

  async permissionGranted(
    actorUserId: string,
    permission: string,
    organizationId: string | null
  ): Promise<void> {
    await this.write({
      action: "permission.granted",
      actorUserId,
      organizationId,
      permission,
      outcome: "success",
    });
  }

  async permissionDenied(
    actorUserId: string | null,
    permission: string,
    organizationId: string | null,
    reason?: string
  ): Promise<void> {
    await this.write({
      action: "permission.denied",
      actorUserId,
      organizationId,
      permission,
      outcome: "failure",
      metadata: reason ? { reason } : {},
    });
  }
}
