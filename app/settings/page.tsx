'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { loadLocalData, saveLocalData } from '@/lib/storage';
import { AppData } from '@/types';
import {
  Cloud,
  Download,
  Upload,
  ShieldCheck,
  Palette,
  Sun,
  Moon,
  Monitor,
  Bell,
  BellRing,
  Check,
  RefreshCw,
  Sparkles,
  Smartphone,
  ExternalLink,
  Volume2,
  VolumeX,
  Music,
  Fingerprint,
  Coffee,
  Heart,
  LifeBuoy,
  Bot,
} from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/authContext';
import {
  isBiometricAvailable,
  isBiometricConfigured,
  enableBiometric,
  disableBiometric,
} from '@/lib/biometrics';
import {
  isNotificationSupported,
  getNotificationPermission,
  getNotificationPermissionStatus,
  getSystemNotificationPreference,
  setSystemNotificationPreference,
  requestNotificationPermission,
  requestNotificationPermissionDetailed,
  sendLocalNotification,
  getNotificationSoundPreference,
  setNotificationSoundPreference,
  playNotificationSound,
  NOTIFICATION_SOUNDS,
  NotificationSoundType,
} from '@/lib/notifications';
import {
  fetchLatestDarApk,
  getDirectDarApkUrl,
  getDirectDarApkFilename,
  LatestApkRelease,
} from '@/lib/apkUpdate';

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const [data, setData] = useState<AppData | null>(null);
  const { preference, setPreference } = useTheme();
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [systemNotifEnabled, setSystemNotifEnabled] = useState(false);
  const [testSent, setTestSent] = useState(false);

  // Préférences sonores des notifications
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundType, setSoundType] = useState<NotificationSoundType>('chime');

  // Biométrie
  const [bioSupported, setBioSupported] = useState(false);
  const [bioConfigured, setBioConfigured] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [bioMsg, setBioMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showBioPasswordPrompt, setShowBioPasswordPrompt] = useState(false);
  const [bioPassword, setBioPassword] = useState('');

  // Mises à jour
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [latestApk, setLatestApk] = useState<LatestApkRelease | null>(null);

  useEffect(() => {
    setData(loadLocalData());
    if (isNotificationSupported()) {
      getNotificationPermissionStatus().then((perm) => {
        setNotifPermission(perm);
        const pref = getSystemNotificationPreference();
        setSystemNotifEnabled(pref && perm === 'granted');
      });
    }
    const soundPref = getNotificationSoundPreference();
    setSoundEnabled(soundPref.enabled);
    setSoundType(soundPref.sound);

    isBiometricAvailable().then((avail) => setBioSupported(avail));
    setBioConfigured(isBiometricConfigured());
    fetchLatestDarApk().then((apk) => setLatestApk(apk));
  }, []);

  const handleToggleBio = () => {
    setBioMsg(null);
    if (bioConfigured) {
      disableBiometric();
      setBioConfigured(false);
      setBioMsg({ text: 'Connexion par empreinte désactivée.', type: 'success' });
    } else {
      setShowBioPasswordPrompt(true);
    }
  };

  const handleConfirmBioPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bioPassword) return;
    setBioLoading(true);
    setBioMsg(null);
    try {
      const emailToUse = user?.email || 'famille@dar.app';
      const res = await enableBiometric(emailToUse, bioPassword, profile?.full_name);
      if (res.success) {
        setBioConfigured(true);
        setShowBioPasswordPrompt(false);
        setBioPassword('');
        setBioMsg({ text: 'Empreinte digitale configurée avec succès !', type: 'success' });
      } else {
        setBioMsg({ text: res.error || 'Échec de l’activation biométrique.', type: 'error' });
      }
    } catch (err: any) {
      setBioMsg({ text: err.message || 'Erreur inconnue.', type: 'error' });
    } finally {
      setBioLoading(false);
    }
  };

  async function handleToggleSystemNotifications() {
    if (!systemNotifEnabled) {
      const result = await requestNotificationPermissionDetailed();
      setNotifPermission(result.status);

      if (result.status === 'granted') {
        setSystemNotifEnabled(true);
        setSystemNotificationPreference(true);
        await sendLocalNotification('Notifications activées ! 🎉', {
          body: 'Le volet de notification de votre appareil est désormais connecté à Keo Family.',
        });
      } else if (result.needsApkUpdate) {
        setSystemNotifEnabled(false);
        setSystemNotificationPreference(false);
        alert(
          "📲 Mise à jour de l'application Keo Family requise :\n\n" +
          "Pour faire apparaître les alertes dans le volet Android, vous devez installer le nouvel APK.\n\n" +
          "La nouvelle version intègre les pilotes natifs Android. Téléchargez-la via le bouton 'Télécharger le nouvel APK' ci-dessous."
        );
      } else {
        setSystemNotifEnabled(false);
        setSystemNotificationPreference(false);
        alert(
          "Les notifications sont bloquées par votre appareil ou navigateur.\n\n" +
          "1. Ouvrez Paramètres du téléphone > Applications > Keo Family > Notifications et activez 'Autoriser'.\n" +
          "2. Si vous accédez à Keo Family depuis Chrome, cliquez sur les paramètres du site (icône cadenas) pour autoriser les notifications."
        );
      }
    } else {
      setSystemNotifEnabled(false);
      setSystemNotificationPreference(false);
    }
  }

  async function handleForceUpdate() {
    setCheckingUpdate(true);
    setUpdateStatus('Purger le cache et vérifier la dernière version...');
    try {
      if (typeof window !== 'undefined' && 'caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
        }
      }
      localStorage.setItem('dar_app_version', '1.2.0');
      setUpdateStatus('Mise à jour terminée ! Rechargement de Keo Family...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch {
      setUpdateStatus('Erreur lors de la vérification');
      setCheckingUpdate(false);
    }
  }

  function handleExport() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sauvegarde-repas-famille-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        saveLocalData(parsed);
        setData(parsed);
        alert('Sauvegarde restaurée avec succès !');
      } catch (err) {
        alert('Fichier JSON invalide');
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="pb-32 bg-gray-50 dark:bg-slate-900 min-h-screen">
      <Header title="Paramètres & Mises à jour" />

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* MISE À JOUR DE L'APPLICATION */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-orange-100 dark:bg-primary-950 text-primary-600 dark:text-primary-400 rounded-xl">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-sm text-gray-900 dark:text-white leading-tight">
                  Mises à jour de l'application
                </h2>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Version installée : <span className="font-bold text-primary-600 dark:text-primary-400">Keo Family v1.2.0</span>
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
              En ligne
            </span>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Recherchez et appliquez immédiatement la toute dernière version déployée sans avoir à supprimer votre raccourci.
          </p>

          {updateStatus && (
            <div className="p-2.5 rounded-2xl bg-orange-50 dark:bg-primary-950/40 border border-orange-200 dark:border-primary-800 text-xs text-primary-800 dark:text-primary-200 font-semibold flex items-center gap-2 animate-in fade-in">
              <RefreshCw className={`w-4 h-4 ${checkingUpdate ? 'animate-spin' : ''}`} />
              <span>{updateStatus}</span>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleForceUpdate}
              disabled={checkingUpdate}
              className="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${checkingUpdate ? 'animate-spin' : ''}`} />
              <span>{checkingUpdate ? 'Mise à jour en cours...' : 'Vérifier et forcer la mise à jour'}</span>
            </button>

            <a
              href={latestApk ? latestApk.downloadUrl : getDirectDarApkUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2 px-3 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-655 text-gray-700 dark:text-gray-300 font-semibold rounded-2xl text-xs flex items-center justify-center gap-2 transition"
            >
              <Smartphone className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              <span>
                {latestApk
                  ? `Télécharger ${latestApk.filename}`
                  : `Télécharger ${getDirectDarApkFilename()}`}
              </span>
              <ExternalLink className="w-3.5 h-3.5 opacity-60" />
            </a>
          </div>
        </div>

        {/* SÉCURITÉ & CONNEXION PAR EMPREINTE */}
        {bioSupported && (
          <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-100 dark:bg-primary-950 text-primary-600 dark:text-primary-400 rounded-xl">
                  <Fingerprint className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-sm text-gray-900 dark:text-white leading-tight">
                    Connexion par empreinte
                  </h2>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {bioConfigured
                      ? 'Actif sur cet appareil (Empreinte / Face ID / Windows Hello)'
                      : 'Connectez-vous en 1 touche sans retaper votre mot de passe'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={bioConfigured}
                disabled={bioLoading}
                onClick={handleToggleBio}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  bioConfigured ? 'bg-primary-600' : 'bg-gray-200 dark:bg-slate-700'
                } ${bioLoading ? 'opacity-50 cursor-wait' : ''}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    bioConfigured ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {bioMsg && (
              <div
                className={`p-2.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                  bioMsg.type === 'error'
                    ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50'
                }`}
              >
                <span>{bioMsg.text}</span>
              </div>
            )}

            {showBioPasswordPrompt && (
              <form
                onSubmit={handleConfirmBioPassword}
                className="p-3 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 space-y-2"
              >
                <p className="text-[11px] text-gray-600 dark:text-gray-300 font-medium">
                  Confirmez votre mot de passe pour enregistrer l’empreinte sur cet appareil :
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    required
                    placeholder="Votre mot de passe"
                    value={bioPassword}
                    onChange={(e) => setBioPassword(e.target.value)}
                    className="flex-1 py-1.5 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-primary-500 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={!bioPassword || bioLoading}
                    className="py-1.5 px-3 bg-primary-600 text-white font-bold rounded-xl text-xs hover:bg-primary-700 disabled:opacity-50 transition"
                  >
                    {bioLoading ? '...' : 'Activer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBioPasswordPrompt(false)}
                    className="py-1.5 px-2 text-gray-400 hover:text-gray-600 text-xs"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* APPARENCE & THÈME */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h2 className="font-bold text-sm text-gray-900 dark:text-white">Apparence</h2>
          </div>
          <div className="grid grid-cols-3 p-1 bg-gray-100 dark:bg-slate-700 rounded-2xl text-xs font-bold">
            {(
              [
                { value: 'light', label: 'Clair', Icon: Sun },
                { value: 'dark', label: 'Sombre', Icon: Moon },
                { value: 'system', label: 'Auto', Icon: Monitor },
              ] as const
            ).map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setPreference(value)}
                className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                  preference === value
                    ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-xs'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            « Auto » suit le réglage clair/sombre de votre téléphone. Le choix est sauvegardé pour 1 an.
          </p>
        </div>

        {/* NOTIFICATIONS & SONS */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <h2 className="font-bold text-sm text-gray-900 dark:text-white">Notifications & Sons</h2>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                systemNotifEnabled && notifPermission === 'granted'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : notifPermission === 'denied'
                  ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300'
              }`}
            >
              {systemNotifEnabled && notifPermission === 'granted'
                ? 'Volet actif'
                : notifPermission === 'denied'
                ? 'Bloqué'
                : 'Désactivé'}
            </span>
          </div>

          {/* INTERRUPTEUR BASCULE ON / OFF DU VOLET DE NOTIFICATION */}
          <div className="bg-gray-50 dark:bg-slate-750 p-3.5 rounded-2xl border border-gray-100 dark:border-slate-700 flex items-center justify-between gap-3">
            <div className="space-y-0.5 flex-1 pr-2">
              <div className="flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  Volet de notification de l'appareil
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                Afficher une alerte dans la barre supérieure de votre téléphone lors de nouveaux messages ou rendez-vous.
              </p>
            </div>

            {/* BOUTON POUSSOIR ON / OFF */}
            <button
              type="button"
              role="switch"
              aria-checked={systemNotifEnabled && notifPermission === 'granted'}
              onClick={handleToggleSystemNotifications}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                systemNotifEnabled && notifPermission === 'granted'
                  ? 'bg-emerald-500'
                  : 'bg-gray-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  systemNotifEnabled && notifPermission === 'granted' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* RÉGLAGE DU SON */}
          <div className="pt-2 border-t border-gray-100 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-gray-400" />
                )}
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                  Sonnerie des notifications
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !soundEnabled;
                  setSoundEnabled(next);
                  setNotificationSoundPreference(next, soundType);
                  if (next) playNotificationSound(soundType);
                }}
                className={`px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-1 ${
                  soundEnabled
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300'
                    : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-400'
                }`}
              >
                {soundEnabled ? 'Son activé' : 'Muet'}
              </button>
            </div>

            {soundEnabled && (
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  Choisir la mélodie :
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {NOTIFICATION_SOUNDS.map((s) => {
                    const isSelected = soundType === s.id;
                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          setSoundType(s.id);
                          setNotificationSoundPreference(true, s.id);
                          playNotificationSound(s.id);
                        }}
                        className={`p-2.5 rounded-2xl border text-left cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? 'border-primary-500 bg-orange-50/70 dark:bg-primary-950/40 text-primary-900 dark:text-primary-100 ring-1 ring-primary-500'
                            : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-gray-50/60 dark:bg-slate-750'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-1">
                          <div className="font-bold text-xs truncate flex items-center gap-1">
                            <Music className="w-3 h-3 opacity-60 flex-shrink-0" />
                            <span>{s.name}</span>
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                            {s.description}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playNotificationSound(s.id);
                          }}
                          title="Écouter"
                          className="w-7 h-7 rounded-xl bg-white dark:bg-slate-700 shadow-2xs flex items-center justify-center text-primary-600 dark:text-primary-300 hover:scale-105 active:scale-95 transition flex-shrink-0"
                        >
                          ▶
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* BOUTON TEST NOTIFICATION + VOLET */}
          <div className="pt-2 border-t border-gray-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                sendLocalNotification('Notification de test Keo Family 🔔', {
                  body: `La notification apparaît dans votre volet avec la sonnerie « ${
                    NOTIFICATION_SOUNDS.find((s) => s.id === soundType)?.name || 'Carillon'
                  } » !`,
                  sound: soundEnabled,
                });
                setTestSent(true);
                setTimeout(() => setTestSent(false), 3000);
              }}
              className="w-full py-2.5 px-3 rounded-2xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-650 text-gray-700 dark:text-gray-200 text-xs font-semibold transition flex items-center justify-center gap-1.5"
            >
              {testSent ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700 dark:text-emerald-300">
                    Notification envoyée dans le volet !
                  </span>
                </>
              ) : (
                <>
                  <BellRing className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  <span>Tester la sonnerie et l'apparition dans le volet</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* TÉLÉCHARGEMENT APPLICATION ANDROID (APK) */}
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-slate-800 dark:to-slate-800 p-4 rounded-3xl border border-orange-200/80 dark:border-slate-700 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-orange-500 text-white rounded-xl">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-sm text-gray-900 dark:text-white">Application Android (APK)</h2>
                <p className="text-[11px] text-gray-600 dark:text-gray-400">
                  Version native avec volet de notifications et fichiers .ics
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300">
              v1.3.0
            </span>
          </div>

          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
            Pour que les alertes dans le volet et l'ouverture automatique des fichiers calendrier (*.ics) fonctionnent, installez la dernière version de <strong>Keo Family</strong>.
          </p>

          <a
            href={latestApk ? latestApk.downloadUrl : getDirectDarApkUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>
              {latestApk
                ? `Télécharger ${latestApk.filename}`
                : `Télécharger ${getDirectDarApkFilename()}`}
            </span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>
        </div>

        {/* SOUTIEN DU PROJET & ASSISTANCE */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-800 p-4 rounded-3xl border border-amber-200/80 dark:border-slate-700 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-tr from-amber-500 to-orange-500 text-white rounded-xl shadow-xs">
              <Heart className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-gray-900 dark:text-white">Soutenir le projet & Assistance</h2>
              <p className="text-[11px] text-gray-600 dark:text-gray-400">
                Une suggestion, un besoin d'aide ou envie d'encourager le développement ?
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('dar:open-chatbot'));
                }
              }}
              className="w-full sm:col-span-2 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-primary-600 to-amber-500 hover:from-primary-700 hover:to-amber-600 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs"
            >
              <Bot className="w-4 h-4" />
              <span>Discuter avec l'Assistant Keo (Chatbot)</span>
            </button>

            <a
              href="https://ko-fi.com/keo_app"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-3 rounded-2xl bg-[#FF5E5B] hover:bg-[#e04f4c] text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs"
            >
              <Coffee className="w-4 h-4" />
              <span>Offrir un café sur Ko-fi</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>

            <a
              href="mailto:heyhacene@gmail.com?subject=%5BKeo%20Family%5D%20Assistance%20%26%20Feedback"
              className="w-full py-2.5 px-3 rounded-2xl bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-650 text-gray-800 dark:text-white border border-gray-200 dark:border-slate-600 text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs"
            >
              <LifeBuoy className="w-4 h-4 text-orange-500" />
              <span>Assistance & Feedback</span>
            </a>
          </div>
        </div>

        {/* SYNCHRONISATION DES DONNÉES */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h2 className="font-bold text-sm text-gray-900 dark:text-white">Synchronisation des données</h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Vos recettes, plannings et courses sont synchronisés avec Supabase Cloud et conservés en local pour l'accès sans réseau en magasin.
          </p>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 flex items-center gap-2 text-emerald-800 dark:text-emerald-200 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Stockage hybride Cloud & Hors-ligne actif</span>
          </div>
        </div>

        {/* SAUVEGARDE MANUELLE JSON */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm space-y-3">
          <h2 className="font-bold text-sm text-gray-900 dark:text-white">Sauvegarde manuelle (JSON)</h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExport}
              className="py-2.5 px-3 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-650 text-gray-800 dark:text-gray-200 font-semibold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition"
            >
              <Download className="w-4 h-4" /> Exporter
            </button>

            <label className="py-2.5 px-3 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-650 text-gray-800 dark:text-gray-200 font-semibold rounded-2xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition">
              <Upload className="w-4 h-4" /> Importer
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </div>

        {/* RÉINITIALISATION */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-red-100 dark:border-red-950/50 shadow-sm space-y-2">
          <h2 className="font-bold text-sm text-gray-900 dark:text-white">Nettoyage des données</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Remettre à zéro le planning de la semaine et la liste de courses en un clic (vos recettes sont conservées).
          </p>
          <button
            onClick={() => {
              if (confirm('Voulez-vous vraiment vider tout le planning et toute la liste de courses ?')) {
                const updated = {
                  ...data!,
                  weeklyPlan: {},
                  customShoppingItems: [],
                  checkedItems: {},
                };
                saveLocalData(updated);
                setData(updated);
                alert('Planning et liste de courses vidés !');
              }
            }}
            className="w-full py-2.5 px-3 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 font-semibold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition"
          >
            Vider le planning & la liste de courses
          </button>
        </div>
      </div>
    </div>
  );
}
