'use client';

import { useEffect, useState } from 'react';
import { THEME_STORAGE_KEY } from './themeScript';

export type ThemePreference = 'light' | 'dark' | 'system';

const THEME_EVENT = 'dar-theme-change';

function readThemeCookie(): ThemePreference | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + THEME_STORAGE_KEY + '=([^;]+)'));
  if (match && (match[2] === 'light' || match[2] === 'dark' || match[2] === 'system')) {
    return match[2] as ThemePreference;
  }
  return null;
}

export function getThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch (e) {}

  const fromCookie = readThemeCookie();
  if (fromCookie) return fromCookie;

  return 'system';
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(pref: ThemePreference) {
  if (typeof document === 'undefined') return;
  const dark = pref === 'dark' || (pref === 'system' && systemPrefersDark());
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0f172a' : '#ee7318');
}

export function setThemePreference(pref: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch (e) {}

  try {
    // 1 an de persistance par cookie
    document.cookie = `${THEME_STORAGE_KEY}=${pref}; path=/; max-age=31536000; SameSite=Lax`;
  } catch (e) {}

  applyTheme(pref);
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Hook React : préférence courante + indicateur « sombre effectif ». */
export function useTheme() {
  const [pref, setPref] = useState<ThemePreference>(() => {
    return typeof window !== 'undefined' ? getThemePreference() : 'system';
  });
  const [isDark, setIsDark] = useState<boolean>(() => {
    return typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false;
  });

  useEffect(() => {
    const sync = () => {
      const p = getThemePreference();
      setPref(p);
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    sync();

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => {
      if (getThemePreference() === 'system') {
        applyTheme('system');
        sync();
      }
    };
    window.addEventListener(THEME_EVENT, sync);
    mq.addEventListener('change', onSystemChange);
    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      mq.removeEventListener('change', onSystemChange);
    };
  }, []);

  return {
    preference: pref,
    isDark,
    setPreference: setThemePreference,
    toggle: () => setThemePreference(isDark ? 'light' : 'dark'),
  };
}
