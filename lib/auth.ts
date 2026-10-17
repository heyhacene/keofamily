import { cookies } from 'next/headers';

const AUTH_COOKIE_NAME = 'family_auth_session';

export function verifyPassword(password: string): boolean {
  const expectedPassword = process.env.APP_PASSWORD || 'famille2025';
  return password === expectedPassword;
}

export function isAuthenticated(): boolean {
  const cookieStore = cookies();
  const session = cookieStore.get(AUTH_COOKIE_NAME);
  return Boolean(session && session.value === 'authenticated');
}

export function createAuthCookieHeader(): { name: string; value: string; options: any } {
  return {
    name: AUTH_COOKIE_NAME,
    value: 'authenticated',
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 an
    },
  };
}

export function clearAuthCookieHeader(): { name: string; value: string; options: any } {
  return {
    name: AUTH_COOKIE_NAME,
    value: '',
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    },
  };
}
