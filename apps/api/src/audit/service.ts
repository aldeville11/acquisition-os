import { newId } from "../identity/tokens.js";
import type { AuthContext } from "../identity/types.js";
import type { PlatformStore } from "../platform/types.js";

export const AUDIT_EVENT = {
  PERMISSION_DENIED: "permission.denied",
  USERS_INVITED: "users.invited",
  SESSION_LOGGED_IN: "session.logged_in",
  SESSION_LOGGED_OUT: "session.logged_out",
} as const;

export class AuditService {
  constructor(private readonly store: PlatformStore) {}

  list(actor: AuthContext, limit: number) {
    if (!actor.organizationId) return [];
    return this.store.listDomainEvents({ organizationId: actor.organizationId }, limit);
  }

  async recordPermissionDenied(input: {
    actor: AuthContext | null;
    permission: string | null;
    method: string;
    path: string;
  }): Promise<void> {
    const { actor } = input;
    if (!actor) return;
    await this.store.appendDomainEvent({
      id: newId("evt"),
      type: AUDIT_EVENT.PERMISSION_DENIED,
      organizationId: actor.organizationId,
      workspaceId: actor.workspaceId,
      payload: {
        actorUserId: actor.userId,
        organizationId: actor.organizationId,
        workspaceId: actor.workspaceId,
        permission: input.permission,
        method: input.method,
        path: input.path,
      },
      createdAt: new Date().toISOString(),
    });
  }
}
