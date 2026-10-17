'use client';

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export type NotificationSoundType = 'chime' | 'bell' | 'pop' | 'harp';

export interface NotificationSoundOption {
  id: NotificationSoundType;
  name: string;
  description: string;
}

export const NOTIFICATION_SOUNDS: NotificationSoundOption[] = [
  { id: 'chime', name: 'Carillon doux', description: 'Mélodie chaleureuse à 3 tons' },
  { id: 'bell', name: 'Clochette cristalline', description: 'Tintement doux et net' },
  { id: 'pop', name: 'Pop moderne', description: 'Son de bulle dynamique' },
  { id: 'harp', name: 'Arpège zen', description: 'Cascade de 4 notes apaisantes' },
];

/**
 * Initialisation de l'écouteur de clic sur notification native (Capacitor)
 */
if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
  try {
    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const url = action.notification.extra?.url;
      if (url && typeof window !== 'undefined') {
        window.location.href = url;
      }
    });
  } catch (e) {
    // Non bloquant
  }
}

/**
 * Vérifie si les notifications sont supportées (Capacitor natif ou Web Notifications)
 */
export function isNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (Capacitor.isNativePlatform()) return true;
  return 'Notification' in window;
}

/**
 * Retourne le statut de la permission système ('granted', 'denied', 'default')
 */
export async function getNotificationPermissionStatus(): Promise<NotificationPermission> {
  if (typeof window === 'undefined') return 'denied';

  if (Capacitor.isNativePlatform()) {
    try {
      const check = await LocalNotifications.checkPermissions();
      if (check.display === 'granted') return 'granted';
      if (check.display === 'denied') return 'denied';
      return 'default';
    } catch {
      return 'default';
    }
  }

  if ('Notification' in window) {
    return Notification.permission;
  }
  return 'denied';
}

/**
 * Version synchrone pour rendu initial rapide (avec secours Web)
 */
export function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined') return 'denied';
  if (Capacitor.isNativePlatform()) {
    const cached = localStorage.getItem('dar_native_notif_perm');
    return (cached as NotificationPermission) || 'default';
  }
  if ('Notification' in window) {
    return Notification.permission;
  }
  return 'denied';
}

/**
 * Résultat détaillé de la demande de permission
 */
export interface NotificationPermissionResult {
  status: NotificationPermission;
  needsApkUpdate: boolean;
  errorMessage?: string;
  platform: 'android' | 'ios' | 'web';
}

/**
 * Demande la permission d'afficher des notifications dans le volet du système avec détails
 */
export async function requestNotificationPermissionDetailed(): Promise<NotificationPermissionResult> {
  if (typeof window === 'undefined') {
    return { status: 'denied', needsApkUpdate: false, platform: 'web' };
  }

  // 1. Environnement Android Natif (Capacitor)
  if (Capacitor.isNativePlatform()) {
    try {
      let status: NotificationPermission = 'default';

      // 1.1 Vérifier si déjà accordé dans les paramètres du téléphone (ex: l'utilisateur a activé dans Paramètres > Applications > Keo Family)
      try {
        const check = await LocalNotifications.checkPermissions();
        if (check.display === 'granted') {
          status = 'granted';
        }
      } catch (checkErr: any) {
        const msg = String(checkErr?.message || checkErr || '').toLowerCase();
        if (msg.includes('not implemented') || checkErr?.code === 'UNIMPLEMENTED') {
          return {
            status: 'denied',
            needsApkUpdate: true,
            errorMessage: "Le plugin natif n'est pas encore présent dans l'APK installé sur l'appareil.",
            platform: 'android',
          };
        }
      }

      // 1.2 Si pas encore accordé, demander la permission système
      if (status !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        status = req.display === 'granted' ? 'granted' : req.display === 'denied' ? 'denied' : 'default';
      }

      localStorage.setItem('dar_native_notif_perm', status);

      if (status === 'granted') {
        localStorage.setItem('dar_system_notif_enabled', 'true');
        // Initialiser le canal haute priorité de manière sécurisée et non-bloquante
        try {
          await LocalNotifications.createChannel({
            id: 'dar_alerts',
            name: 'Alertes Keo Family',
            description: 'Messages de la famille, rappels calendrier et tâches',
            importance: 5, // IMPORTANCE_HIGH
            visibility: 1, // PUBLIC
            vibration: true,
            lights: true,
            lightColor: '#ee7318',
          });
        } catch (chanErr) {
          console.warn('Erreur non-bloquante création canal Android:', chanErr);
        }
      }

      return {
        status,
        needsApkUpdate: false,
        platform: 'android',
      };
    } catch (err: any) {
      console.warn('Erreur demande permission native Capacitor:', err);
      const msg = String(err?.message || err || '').toLowerCase();
      const isUnimplemented = msg.includes('not implemented') || err?.code === 'UNIMPLEMENTED';

      if (isUnimplemented) {
        return {
          status: 'denied',
          needsApkUpdate: true,
          errorMessage: "L'application Keo Family sur votre téléphone doit être mise à jour avec le nouvel APK.",
          platform: 'android',
        };
      }

      return {
        status: 'denied',
        needsApkUpdate: false,
        errorMessage: err?.message || String(err),
        platform: 'android',
      };
    }
  }

  // 2. Environnement Navigateur / PWA
  if ('Notification' in window) {
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        localStorage.setItem('dar_system_notif_enabled', 'true');
      }
      return {
        status: perm,
        needsApkUpdate: false,
        platform: 'web',
      };
    } catch (err: any) {
      console.error('Erreur demande permission notifications:', err);
      return {
        status: 'denied',
        needsApkUpdate: false,
        errorMessage: err?.message || String(err),
        platform: 'web',
      };
    }
  }

  return { status: 'denied', needsApkUpdate: false, platform: 'web' };
}

/**
 * Demande la permission d'afficher des notifications dans le volet du système
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  const res = await requestNotificationPermissionDetailed();
  return res.status;
}

/**
 * Préférence utilisateur pour le volet de notification (Bouton poussoir ON/OFF)
 */
export function getSystemNotificationPreference(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem('dar_system_notif_enabled');
  if (stored !== null) {
    return stored === 'true';
  }
  // Par défaut, activé si la permission est déjà accordée
  const perm = getNotificationPermission();
  return perm === 'granted';
}

export function setSystemNotificationPreference(enabled: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('dar_system_notif_enabled', enabled ? 'true' : 'false');
}

/**
 * Préférences pour le son des notifications
 */
export function getNotificationSoundPreference(): { enabled: boolean; sound: NotificationSoundType } {
  if (typeof window === 'undefined') {
    return { enabled: true, sound: 'chime' };
  }
  const enabledStr = localStorage.getItem('dar_notif_sound_enabled');
  const soundStr = (localStorage.getItem('dar_notif_sound_type') as NotificationSoundType) || 'chime';
  return {
    enabled: enabledStr !== 'false',
    sound: NOTIFICATION_SOUNDS.some((s) => s.id === soundStr) ? soundStr : 'chime',
  };
}

export function setNotificationSoundPreference(enabled: boolean, sound: NotificationSoundType) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('dar_notif_sound_enabled', enabled ? 'true' : 'false');
  localStorage.setItem('dar_notif_sound_type', sound);
}

/**
 * Joue la tonalité audio synthétisée choisie via Web Audio API (100% hors-ligne)
 */
export function playNotificationSound(soundType?: NotificationSoundType) {
  if (typeof window === 'undefined') return;

  const pref = getNotificationSoundPreference();
  if (!pref.enabled && !soundType) return;

  const chosen = soundType || pref.sound;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (chosen === 'chime') {
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.4);
      });
    } else if (chosen === 'bell') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      osc2.frequency.setValueAtTime(1760, ctx.currentTime);
      gain.gain.setValueAtTime(0.28, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.65);
      osc2.stop(ctx.currentTime + 0.65);
    } else if (chosen === 'pop') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(850, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.16);
    } else if (chosen === 'harp') {
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.075);
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.075);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + idx * 0.075 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.075 + 0.38);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.075);
        osc.stop(ctx.currentTime + idx * 0.075 + 0.42);
      });
    }
  } catch (err) {
    console.warn('AudioContext playback error:', err);
  }
}

/**
 * Envoie une notification dans le volet du système (Android, Windows, etc.) et joue la sonnerie paramétrée
 */
export async function sendLocalNotification(
  title: string,
  options: {
    body?: string;
    url?: string;
    sound?: boolean;
    tag?: string;
    data?: any;
    icon?: string;
  } = {}
) {
  // 1. Déclencher la sonnerie audio si activée
  if (options.sound !== false) {
    playNotificationSound();
  }

  // 2. Vérifier si l'utilisateur a activé le bouton poussoir du volet système
  if (!getSystemNotificationPreference()) {
    return;
  }

  // 3. Cas A : Application Android Native (Capacitor)
  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        const requested = await LocalNotifications.requestPermissions();
        if (requested.display !== 'granted') return;
      }

      await LocalNotifications.createChannel({
        id: 'dar_alerts',
        name: 'Alertes Keo Family',
        description: 'Messages, agenda et alertes familiales',
        importance: 5,
        visibility: 1,
        vibration: true,
        lights: true,
        lightColor: '#ee7318',
      });

      const notifId = Math.floor(Math.random() * 900000) + 100000;
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title: title,
            body: options.body || '',
            channelId: 'dar_alerts',
            smallIcon: 'ic_launcher',
            extra: {
              url: options.url || '/',
            },
          },
        ],
      });
      return;
    } catch (err) {
      console.warn('Erreur notification native Capacitor:', err);
    }
  }

  // 4. Cas B : Web / PWA Navigateur
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const defaultOptions: any = {
    body: options.body || '',
    icon: options.icon || '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: options.tag || `dar-notif-${Date.now()}`,
    renotify: true,
    requireInteraction: false,
    data: {
      url: options.url || '/messages',
      ...(options.data || {}),
    },
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, defaultOptions);
        return;
      }
    }
    new Notification(title, defaultOptions);
  } catch (err) {
    console.warn('Impossible d’afficher la notification dans le volet système:', err);
  }
}
