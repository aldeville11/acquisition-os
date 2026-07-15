import type { ApiConfig } from "../config.js";
import type { AuditService } from "../audit/service.js";
import {
  buildSessionCookie,
  clearSessionCookie,
  readCookie,
  SESSION_COOKIE_NAME,
} from "./cookies.js";
import { hashPassword, verifyPassword } from "./password.js";
import { toAuthContext } from "./rbac.js";
import type { PlatformStore } from "../platform/types.js";
import { generateSessionToken, hashSessionToken, newId } from "./tokens.js";
import type { AuthContext, PublicUser, UserRecord } from "./types.js";

export type AuthErrorStatus = 400 | 401 | 403 | 404 | 409 | 500;

export class AuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: AuthErrorStatus
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export class AuthService {
  private audit: AuditService | null = null;

  constructor(
    private readonly store: PlatformStore,
    private readonly config: ApiConfig
  ) {}

  /** Wire AuditService after construction (avoids circular createApp ordering). */
  setAudit(audit: AuditService): void {
    this.audit = audit;
  }

  async seedDemoUser(input: {
    email: string;
    password: string;
    name: string;
  }): Promise<UserRecord> {
    const existing = await this.store.findUserByEmail(input.email);
    if (existing) return existing;
    const now = new Date().toISOString();
    return this.store.createUser({
      id: newId("usr"),
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash: await hashPassword(input.password, this.config.bcryptCost),
      status: "active",
      createdAt: now,
      lastSeenAt: null,
    });
  }

  toPublicUser(user: UserRecord): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
    };
  }

  private async buildAuthContext(user: UserRecord, sessionId: string): Promise<AuthContext> {
    const membership = await this.store.findActiveMembershipForUser(user.id);
    return toAuthContext({
      userId: user.id,
      email: user.email,
      status: user.status,
      sessionId,
      organizationId: membership?.organizationId ?? null,
      workspaceId: membership?.workspaceId ?? null,
      role: membership?.roleKey ?? null,
      locationScope: membership?.locationScope ?? [],
    });
  }

  async login(
    email: string,
    password: string
  ): Promise<{ user: PublicUser; setCookie: string; auth: AuthContext }> {
    const normalized = email.trim().toLowerCase();
    const user = await this.store.findUserByEmail(normalized);
    if (!user || !user.passwordHash || user.status !== "active") {
      await this.audit?.loginFailure(normalized);
      throw new AuthError("INVALID_CREDENTIALS", "Invalid email or password.", 401);
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      await this.audit?.loginFailure(normalized);
      throw new AuthError("INVALID_CREDENTIALS", "Invalid email or password.", 401);
    }

    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token, this.config.sessionPepper);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.sessionTtlMs);
    const session = await this.store.createSession({
      id: newId("ses"),
      userId: user.id,
      tokenHash,
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
      revokedAt: null,
    });

    const updated: UserRecord = {
      ...user,
      lastSeenAt: now.toISOString(),
    };
    await this.store.updateUser(updated);

    const auth = await this.buildAuthContext(updated, session.id);
    await this.audit?.loginSuccess(auth.userId, auth.organizationId);

    return {
      user: this.toPublicUser(updated),
      setCookie: buildSessionCookie(token, {
        secure: this.config.cookieSecure,
        maxAgeSeconds: Math.floor(this.config.sessionTtlMs / 1000),
      }),
      auth,
    };
  }

  async logout(cookieHeader: string | undefined): Promise<{ setCookie: string }> {
    const token = readCookie(cookieHeader, SESSION_COOKIE_NAME);
    let actorUserId: string | null = null;
    let organizationId: string | null = null;
    if (token) {
      const tokenHash = hashSessionToken(token, this.config.sessionPepper);
      const session = await this.store.findSessionByTokenHash(tokenHash);
      if (session && !session.revokedAt) {
        const user = await this.store.findUserById(session.userId);
        if (user) {
          const auth = await this.buildAuthContext(user, session.id);
          actorUserId = auth.userId;
          organizationId = auth.organizationId;
        } else {
          actorUserId = session.userId;
        }
        await this.store.revokeSession(session.id, new Date().toISOString());
      }
    }
    await this.audit?.logout(actorUserId, organizationId);
    return { setCookie: clearSessionCookie(this.config.cookieSecure) };
  }

  async resolveSession(cookieHeader: string | undefined): Promise<AuthContext | null> {
    const token = readCookie(cookieHeader, SESSION_COOKIE_NAME);
    if (!token) return null;

    const tokenHash = hashSessionToken(token, this.config.sessionPepper);
    const session = await this.store.findSessionByTokenHash(tokenHash);
    if (!session || session.revokedAt) return null;
    if (new Date(session.expiresAt).getTime() <= Date.now()) return null;

    const user = await this.store.findUserById(session.userId);
    if (!user || user.status === "deactivated") return null;

    return this.buildAuthContext(user, session.id);
  }

  async me(cookieHeader: string | undefined): Promise<{ user: PublicUser; auth: AuthContext }> {
    const auth = await this.resolveSession(cookieHeader);
    if (!auth) {
      throw new AuthError("UNAUTHENTICATED", "Not authenticated.", 401);
    }
    const user = await this.store.findUserById(auth.userId);
    if (!user) {
      throw new AuthError("UNAUTHENTICATED", "Not authenticated.", 401);
    }
    return { user: this.toPublicUser(user), auth };
  }
}
