import type { AuditService } from "../audit/service.js";
import { newId } from "../identity/tokens.js";
import { AuthError } from "../identity/auth-service.js";
import { CONSTITUTION_ROLE_KEYS } from "../identity/rbac.js";
import { TenantIsolationError } from "../platform/sql-store.js";
import type {
  LocationRecord,
  MembershipRecord,
  OrganizationRecord,
  PlatformStore,
  TenantContext,
  WorkspaceRecord,
} from "../platform/types.js";
import type { AuthContext } from "../identity/types.js";

export const DOMAIN_EVENT = {
  ORGANIZATION_CREATED: "organization.created",
  LOCATION_CREATED: "location.created",
  WORKSPACE_CREATED: "workspace.created",
  MEMBERSHIP_ASSIGNED: "membership.assigned",
  MEMBERSHIP_REVOKED: "membership.revoked",
} as const;

export class TenancyService {
  constructor(
    private readonly store: PlatformStore,
    private readonly audit: AuditService
  ) {}

  async createOrganization(
    actor: AuthContext,
    input: {
      name: string;
      legalName: string;
      type: OrganizationRecord["type"];
      billingEntity?: string;
      status?: OrganizationRecord["status"];
    }
  ): Promise<OrganizationRecord> {
    requireActive(actor);
    const now = new Date().toISOString();
    const org = await this.store.createOrganization({
      id: newId("org"),
      name: input.name.trim(),
      legalName: input.legalName.trim(),
      type: input.type,
      billingEntity: input.billingEntity?.trim() || null,
      status: input.status ?? "active",
      createdAt: now,
    });
    await this.store.appendDomainEvent({
      id: newId("evt"),
      type: DOMAIN_EVENT.ORGANIZATION_CREATED,
      organizationId: org.id,
      workspaceId: null,
      payload: { organizationId: org.id, name: org.name, actorUserId: actor.userId },
      createdAt: now,
    });
    await this.audit.write({
      action: "organization.created",
      actorUserId: actor.userId,
      organizationId: org.id,
      resourceType: "organization",
      resourceId: org.id,
      outcome: "success",
    });
    return org;
  }

  async updateOrganization(
    actor: AuthContext,
    organizationId: string,
    input: {
      name?: string;
      legalName?: string;
      billingEntity?: string | null;
      status?: OrganizationRecord["status"];
    }
  ): Promise<OrganizationRecord> {
    await this.resolveTenant(actor, organizationId);
    const existing = await this.store.getOrganization(organizationId);
    if (!existing) throw new AuthError("NOT_FOUND", "Organization not found.", 404);
    const updated = await this.store.updateOrganization({
      ...existing,
      name: input.name?.trim() ?? existing.name,
      legalName: input.legalName?.trim() ?? existing.legalName,
      billingEntity:
        input.billingEntity === undefined
          ? existing.billingEntity
          : input.billingEntity?.trim() || null,
      status: input.status ?? existing.status,
    });
    await this.audit.write({
      action: "organization.updated",
      actorUserId: actor.userId,
      organizationId,
      resourceType: "organization",
      resourceId: organizationId,
      outcome: "success",
    });
    return updated;
  }

  async createLocation(
    actor: AuthContext,
    organizationId: string,
    input: {
      name: string;
      timezone: string;
      address?: string;
      phone?: string;
      gbpLink?: string;
      status?: LocationRecord["status"];
    }
  ): Promise<LocationRecord> {
    const tenant = await this.resolveTenant(actor, organizationId);
    const now = new Date().toISOString();
    const location = await this.store.createLocation(tenant, {
      id: newId("loc"),
      organizationId: tenant.organizationId,
      name: input.name.trim(),
      timezone: input.timezone.trim(),
      address: input.address?.trim() || null,
      phone: input.phone?.trim() || null,
      gbpLink: input.gbpLink?.trim() || null,
      status: input.status ?? "setup",
      createdAt: now,
    });
    await this.store.appendDomainEvent({
      id: newId("evt"),
      type: DOMAIN_EVENT.LOCATION_CREATED,
      organizationId: tenant.organizationId,
      workspaceId: null,
      payload: { locationId: location.id, organizationId: tenant.organizationId },
      createdAt: now,
    });
    return location;
  }

  async createWorkspace(
    actor: AuthContext,
    organizationId: string,
    input: {
      name: string;
      locationIds: string[];
      planTier?: string;
      status?: WorkspaceRecord["status"];
    }
  ): Promise<WorkspaceRecord> {
    const tenant = await this.resolveTenant(actor, organizationId);
    const now = new Date().toISOString();
    try {
      const workspace = await this.store.createWorkspace(tenant, {
        id: newId("wks"),
        organizationId: tenant.organizationId,
        name: input.name.trim(),
        locationIds: input.locationIds,
        planTier: input.planTier?.trim() || "standard",
        settings: {},
        status: input.status ?? "active",
        createdAt: now,
      });
      await this.store.appendDomainEvent({
        id: newId("evt"),
        type: DOMAIN_EVENT.WORKSPACE_CREATED,
        organizationId: tenant.organizationId,
        workspaceId: workspace.id,
        payload: {
          workspaceId: workspace.id,
          organizationId: tenant.organizationId,
          locationIds: workspace.locationIds,
        },
        createdAt: now,
      });
      await this.audit.write({
        action: "workspace.created",
        actorUserId: actor.userId,
        organizationId: tenant.organizationId,
        workspaceId: workspace.id,
        resourceType: "workspace",
        resourceId: workspace.id,
        outcome: "success",
      });
      return workspace;
    } catch (err) {
      mapStoreError(err);
    }
  }

  async updateWorkspace(
    actor: AuthContext,
    organizationId: string,
    workspaceId: string,
    input: {
      name?: string;
      planTier?: string;
      status?: WorkspaceRecord["status"];
    }
  ): Promise<WorkspaceRecord> {
    const tenant = await this.resolveTenant(actor, organizationId);
    const existing = await this.store.getWorkspace(tenant, workspaceId);
    if (!existing) throw new AuthError("NOT_FOUND", "Workspace not found.", 404);
    const workspace = await this.store.updateWorkspace(tenant, {
      ...existing,
      name: input.name?.trim() ?? existing.name,
      planTier: input.planTier?.trim() ?? existing.planTier,
      status: input.status ?? existing.status,
    });
    await this.audit.write({
      action: "workspace.updated",
      actorUserId: actor.userId,
      organizationId: tenant.organizationId,
      workspaceId: workspace.id,
      resourceType: "workspace",
      resourceId: workspace.id,
      outcome: "success",
    });
    return workspace;
  }

  async assignMembership(
    actor: AuthContext,
    organizationId: string,
    input: {
      userId: string;
      workspaceId: string;
      roleKey: string;
      locationScope?: string[];
      status?: MembershipRecord["status"];
    }
  ): Promise<MembershipRecord> {
    const tenant = await this.resolveTenant(actor, organizationId);
    if (!(CONSTITUTION_ROLE_KEYS as readonly string[]).includes(input.roleKey)) {
      throw new AuthError(
        "INVALID_ROLE",
        "role_key must be a RBAC Vocabulary role (owner|administrator|manager|operator|viewer).",
        400
      );
    }
    const now = new Date().toISOString();
    try {
      const membership = await this.store.assignMembership(tenant, {
        id: newId("mem"),
        userId: input.userId,
        workspaceId: input.workspaceId,
        organizationId: tenant.organizationId,
        roleKey: input.roleKey,
        locationScope: input.locationScope ?? [],
        status: input.status ?? "active",
        createdAt: now,
      });
      await this.store.appendDomainEvent({
        id: newId("evt"),
        type: DOMAIN_EVENT.MEMBERSHIP_ASSIGNED,
        organizationId: tenant.organizationId,
        workspaceId: membership.workspaceId,
        payload: {
          membershipId: membership.id,
          userId: membership.userId,
          workspaceId: membership.workspaceId,
          roleKey: membership.roleKey,
        },
        createdAt: now,
      });
      await this.audit.write({
        action: "membership.assigned",
        actorUserId: actor.userId,
        organizationId: tenant.organizationId,
        workspaceId: membership.workspaceId,
        resourceType: "membership",
        resourceId: membership.id,
        outcome: "success",
        metadata: { roleKey: membership.roleKey, userId: membership.userId },
      });
      return membership;
    } catch (err) {
      mapStoreError(err);
    }
  }

  async revokeMembership(
    actor: AuthContext,
    organizationId: string,
    membershipId: string
  ): Promise<MembershipRecord> {
    const tenant = await this.resolveTenant(actor, organizationId);
    const now = new Date().toISOString();
    try {
      const membership = await this.store.revokeMembership(tenant, membershipId, now);
      await this.store.appendDomainEvent({
        id: newId("evt"),
        type: DOMAIN_EVENT.MEMBERSHIP_REVOKED,
        organizationId: tenant.organizationId,
        workspaceId: membership.workspaceId,
        payload: { membershipId: membership.id, userId: membership.userId },
        createdAt: now,
      });
      await this.audit.write({
        action: "membership.revoked",
        actorUserId: actor.userId,
        organizationId: tenant.organizationId,
        workspaceId: membership.workspaceId,
        resourceType: "membership",
        resourceId: membership.id,
        outcome: "success",
      });
      return membership;
    } catch (err) {
      mapStoreError(err);
    }
  }

  async getLocation(actor: AuthContext, organizationId: string, locationId: string) {
    const tenant = await this.resolveTenant(actor, organizationId);
    return this.store.getLocation(tenant, locationId);
  }

  async getWorkspace(actor: AuthContext, organizationId: string, workspaceId: string) {
    const tenant = await this.resolveTenant(actor, organizationId);
    return this.store.getWorkspace(tenant, workspaceId);
  }

  async listMemberships(actor: AuthContext, organizationId: string, workspaceId?: string) {
    const tenant = await this.resolveTenant(actor, organizationId);
    return this.store.listMemberships(tenant, workspaceId);
  }

  async listAuditEvents(actor: AuthContext, organizationId: string) {
    const tenant = await this.resolveTenant(actor, organizationId);
    return this.store.listAuditEvents(tenant);
  }

  /**
   * Tenant context resolution:
   * - Prefer actor's Membership organization when present.
   * - Never accept a foreign organizationId when actor has a membership for another org.
   */
  async resolveTenant(actor: AuthContext, organizationId: string): Promise<TenantContext> {
    requireActive(actor);
    if (actor.organizationId && actor.organizationId !== organizationId) {
      throw new AuthError(
        "TENANT_ISOLATION",
        "Authenticated tenant context does not match requested organization.",
        403
      );
    }
    const org = await this.store.getOrganization(organizationId);
    if (!org) {
      throw new AuthError("NOT_FOUND", "Organization not found.", 404);
    }
    return { organizationId };
  }
}

function requireActive(actor: AuthContext): void {
  if (actor.status !== "active") {
    throw new AuthError("UNAUTHENTICATED", "User is not active.", 401);
  }
}

function mapStoreError(err: unknown): never {
  if (err instanceof TenantIsolationError) {
    throw new AuthError("TENANT_ISOLATION", err.message, 403);
  }
  if (err instanceof Error) {
    if (err.message === "WORKSPACE_REQUIRES_LOCATION") {
      throw new AuthError("INVALID_BODY", "Workspace requires at least one location.", 400);
    }
    if (err.message === "USER_NOT_FOUND") {
      throw new AuthError("NOT_FOUND", "User not found.", 404);
    }
    if (err.message === "MEMBERSHIP_EXISTS") {
      throw new AuthError("CONFLICT", "Membership already exists for user/workspace.", 409);
    }
  }
  throw err;
}
