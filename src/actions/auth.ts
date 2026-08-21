'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { timingSafeEqual } from 'node:crypto';
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from '@/lib/auth';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get('password') ?? '');
  const expected = process.env.AUTH_PASSWORD;
  if (!expected) return { error: 'AUTH_PASSWORD не настроен на сервере' };
  if (!password || !safeEqual(password, expected)) {
    return { error: 'Неверный пароль' };
  }
  const token = await createSessionToken();
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  redirect('/');
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}
