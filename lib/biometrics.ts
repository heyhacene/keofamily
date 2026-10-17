/**
 * DAR / KEOFAMILY — BIOMETRICS & WEBAUTHN MANAGER
 * Support bi-moteur :
 * 1. Moteur Natif Mobile (Android / iOS) via @capgo/capacitor-native-biometric & Android Keystore
 * 2. Moteur Web via WebAuthn (PublicKeyCredential)
 */

import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';

const NATIVE_SERVER_ID = 'fr.keo.family';
const NATIVE_STORAGE_KEY = 'dar_native_bio_active_v1';
const NATIVE_USER_KEY = 'dar_native_bio_user_v1';
const WEBAUTHN_STORAGE_KEY = 'dar_biometrics_v1';

// Convertit Buffer <-> Base64URL
function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getRelyingPartyId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const hostname = window.location.hostname;
  if (!hostname || hostname === '' || hostname === 'localhost' || hostname === '127.0.0.1') {
    return undefined;
  }
  return hostname;
}

/**
 * Vérifie si l'appareil dispose d'un capteur biométrique (Empreinte, Face ID, Windows Hello)
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // 1. Mobile Android / iOS Natif
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await NativeBiometric.isAvailable();
      return Boolean(res && res.isAvailable);
    } catch (err) {
      console.warn('Erreur détection biométrie native:', err);
      try {
        const resFallback = await NativeBiometric.isAvailable({ useFallback: true });
        return Boolean(resFallback && resFallback.isAvailable);
      } catch {
        return false;
      }
    }
  }

  // 2. Web / Navigateur (WebAuthn)
  if (!window.PublicKeyCredential) return false;
  try {
    const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return Boolean(available);
  } catch (err) {
    console.warn('Erreur détection biométrie WebAuthn:', err);
    return true;
  }
}

/**
 * Vérifie si la connexion biométrique est déjà configurée sur cet appareil
 */
export function isBiometricConfigured(): boolean {
  if (typeof window === 'undefined') return false;

  if (Capacitor.isNativePlatform()) {
    return localStorage.getItem(NATIVE_STORAGE_KEY) === 'true';
  }

  try {
    const raw = localStorage.getItem(WEBAUTHN_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed && parsed.credentialId && parsed.encryptedPayload);
  } catch {
    return false;
  }
}

/**
 * Récupère l'utilisateur enregistré pour la biométrie (email et nom d'affichage)
 */
export function getBiometricUser(): { email: string; displayName?: string } | null {
  if (typeof window === 'undefined') return null;

  if (Capacitor.isNativePlatform()) {
    try {
      const raw = localStorage.getItem(NATIVE_USER_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  try {
    const raw = localStorage.getItem(WEBAUTHN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.email) {
      return {
        email: parsed.email,
        displayName: parsed.displayName,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Enregistre l'empreinte digitale pour Dar
 */
export async function enableBiometric(
  email: string,
  password: string,
  displayName?: string
): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Environnement non disponible' };
  }

  const cleanEmail = email.trim().toLowerCase();

  // 1. Mobile Android / iOS Natif
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeBiometric.setCredentials({
        username: cleanEmail,
        password: password,
        server: NATIVE_SERVER_ID,
      });

      localStorage.setItem(NATIVE_STORAGE_KEY, 'true');
      localStorage.setItem(
        NATIVE_USER_KEY,
        JSON.stringify({ email: cleanEmail, displayName: displayName || cleanEmail.split('@')[0] })
      );

      return { success: true };
    } catch (err: any) {
      console.error('Erreur activation biométrie native:', err);
      return { success: false, error: err.message || 'Impossible d’activer l’empreinte sur cet appareil.' };
    }
  }

  // 2. Web via WebAuthn
  if (!window.PublicKeyCredential) {
    return { success: false, error: 'Biométrie non supportée sur ce navigateur' };
  }

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = new TextEncoder().encode(cleanEmail);
    const rpId = getRelyingPartyId();

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'Dar',
          ...(rpId ? { id: rpId } : {}),
        },
        user: {
          id: userId,
          name: cleanEmail,
          displayName: displayName || cleanEmail.split('@')[0],
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },   // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (!credential) {
      return { success: false, error: 'Enregistrement de l’empreinte annulé' };
    }

    const credIdBase64 = bufferToBase64Url(credential.rawId);

    // Dériver une clé AES-GCM à partir de l'ID du credential
    const enc = new TextEncoder();
    const rawKeyMaterial = await crypto.subtle.digest('SHA-256', enc.encode(credIdBase64 + ':' + cleanEmail));
    const sealedKey = await crypto.subtle.importKey(
      'raw',
      rawKeyMaterial,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );

    // Chiffrer les identifiants
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const payloadBytes = enc.encode(JSON.stringify({ email: cleanEmail, password }));
    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      sealedKey,
      payloadBytes
    );

    const combined = new Uint8Array(iv.length + cipherBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipherBuffer), iv.length);

    const record = {
      credentialId: credIdBase64,
      encryptedPayload: bufferToBase64Url(combined),
      email: cleanEmail,
      displayName: displayName || cleanEmail.split('@')[0],
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem(WEBAUTHN_STORAGE_KEY, JSON.stringify(record));
    return { success: true };
  } catch (err: any) {
    console.error('Erreur activation biométrie WebAuthn:', err);
    if (err.name === 'NotAllowedError') {
      return { success: false, error: 'Autorisation biométrique refusée ou annulée.' };
    }
    return { success: false, error: err.message || 'Impossible d’activer l’empreinte digitale.' };
  }
}

/**
 * Déverrouille avec l'empreinte et renvoie les identifiants de connexion
 */
export async function authenticateBiometric(): Promise<{
  success: boolean;
  email?: string;
  password?: string;
  error?: string;
}> {
  if (typeof window === 'undefined') return { success: false, error: 'Environnement non disponible' };

  // 1. Mobile Android / iOS Natif
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeBiometric.verifyIdentity({
        reason: 'Connectez-vous à Dar avec votre empreinte',
        title: 'Dar — Connexion',
        subtitle: 'Identification biométrique',
        description: 'Posez votre doigt sur le capteur',
      });

      const credentials = await NativeBiometric.getCredentials({
        server: NATIVE_SERVER_ID,
      });

      if (!credentials || !credentials.password) {
        return { success: false, error: 'Aucun identifiant trouvé dans le trousseau sécurisé.' };
      }

      const user = getBiometricUser();

      return {
        success: true,
        email: credentials.username || user?.email,
        password: credentials.password,
      };
    } catch (err: any) {
      console.error('Erreur déverrouillage biométrique natif:', err);
      const msg = err.message || '';
      if (msg.includes('cancel') || msg.includes('Cancel') || msg.includes('annulé') || msg.includes('user cancelled')) {
        return { success: false, error: 'Reconnaissance biométrique annulée.' };
      }
      return { success: false, error: msg || 'Échec de la reconnaissance biométrique.' };
    }
  }

  // 2. Web via WebAuthn
  try {
    const raw = localStorage.getItem(WEBAUTHN_STORAGE_KEY);
    if (!raw) return { success: false, error: 'Biométrie non configurée sur cet appareil' };

    const record = JSON.parse(raw);
    const credentialIdBytes = base64UrlToBuffer(record.credentialId);
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const rpId = getRelyingPartyId();

    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        ...(rpId ? { rpId } : {}),
        allowCredentials: [
          {
            id: credentialIdBytes as unknown as BufferSource,
            type: 'public-key',
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (!assertion) {
      return { success: false, error: 'Vérification biométrique annulée' };
    }

    // Déchiffrement des identifiants scellés
    const enc = new TextEncoder();
    const rawKeyMaterial = await crypto.subtle.digest(
      'SHA-256',
      enc.encode(record.credentialId + ':' + record.email)
    );
    const sealedKey = await crypto.subtle.importKey(
      'raw',
      rawKeyMaterial,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const combined = base64UrlToBuffer(record.encryptedPayload);
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      sealedKey,
      data
    );

    const decryptedJson = new TextDecoder().decode(decryptedBuffer);
    const { email, password } = JSON.parse(decryptedJson);

    return { success: true, email, password };
  } catch (err: any) {
    console.error('Erreur déverrouillage biométrique WebAuthn:', err);
    if (err.name === 'NotAllowedError') {
      return { success: false, error: 'Reconnaissance biométrique annulée.' };
    }
    return { success: false, error: err.message || 'Échec de la reconnaissance biométrique.' };
  }
}

/**
 * Désactive l'empreinte digitale pour Dar
 */
export async function disableBiometric(): Promise<void> {
  if (typeof window !== 'undefined') {
    if (Capacitor.isNativePlatform()) {
      try {
        await NativeBiometric.deleteCredentials({ server: NATIVE_SERVER_ID });
      } catch (e) {
        console.warn('Erreur suppression credentials native:', e);
      }
      localStorage.removeItem(NATIVE_STORAGE_KEY);
      localStorage.removeItem(NATIVE_USER_KEY);
    } else {
      localStorage.removeItem(WEBAUTHN_STORAGE_KEY);
    }
  }
}
