import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import type { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const scryptAsync = promisify(scrypt);

export const SESSION_COOKIE_NAME =
  process.env.AUTH_SESSION_COOKIE_NAME || "lazyai_session";
const SESSION_DURATION_DAYS = 30;

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: "user" | "admin";
};

type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  role: "user" | "admin";
  password_hash: string | null;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validatePassword(password: string) {
  return password.length >= 8;
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;

  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;

  const storedKey = Buffer.from(key, "hex");
  const derivedKey = (await scryptAsync(password, salt, storedKey.length)) as Buffer;

  return (
    storedKey.length === derivedKey.length &&
    timingSafeEqual(storedKey, derivedKey)
  );
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
  };
}

export async function createUserWithPassword({
  email,
  password,
  displayName,
}: {
  email: string;
  password: string;
  displayName?: string;
}) {
  const db = getDb();
  const normalizedEmail = normalizeEmail(email);
  const passwordHash = await hashPassword(password);

  const [row] = await db<UserRow[]>`
    insert into users (email, password_hash, display_name)
    values (${normalizedEmail}, ${passwordHash}, ${displayName || null})
    returning id, email, display_name, role, password_hash
  `;

  return toAuthUser(row);
}

export async function verifyUserCredentials({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const db = getDb();
  const normalizedEmail = normalizeEmail(email);
  const [row] = await db<UserRow[]>`
    select id, email, display_name, role, password_hash
    from users
    where email = ${normalizedEmail}
    limit 1
  `;

  if (!row?.password_hash) return null;

  const valid = await verifyPassword(password, row.password_hash);
  return valid ? toAuthUser(row) : null;
}

export async function createSession(userId: string) {
  const db = getDb();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  await db`
    insert into user_sessions (user_id, token_hash, expires_at)
    values (${userId}, ${tokenHash}, ${expiresAt})
  `;

  return {
    token,
    expiresAt,
  };
}

export async function deleteSession(token: string) {
  const db = getDb();
  await db`
    delete from user_sessions
    where token_hash = ${hashSessionToken(token)}
  `;
}

export async function getCurrentUser(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const db = getDb();
  const [row] = await db<UserRow[]>`
    select u.id, u.email, u.display_name, u.role, u.password_hash
    from user_sessions s
    join users u on u.id = s.user_id
    where s.token_hash = ${hashSessionToken(token)}
      and s.expires_at > now()
    limit 1
  `;

  if (!row) return null;

  await db`
    update user_sessions
    set last_seen_at = now()
    where token_hash = ${hashSessionToken(token)}
  `;

  return toAuthUser(row);
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date
) {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
