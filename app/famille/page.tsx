'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import { useAuth } from '@/lib/authContext';
import { supabase, isSupabaseConfigured, Profile } from '@/lib/supabase';
import {
  Users,
  UserPlus,
  CheckCircle,
  XCircle,
  Shield,
  LogOut,
  MessageSquare,
  Clock,
  AlertCircle,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Monitor,
  Palette,
  Settings as SettingsIcon,
  KeyRound,
  SlidersHorizontal,
  Edit2,
  Check,
  X,
  ShieldAlert,
  ShieldCheck,
  UserX,
  UserCheck,
  Camera,
  Upload,
  Smile,
  Trash2,
  Sparkles,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from '@/lib/theme';
import { getLocalDocuments, getExpiryStatus } from '@/lib/documentVault';

const PRESET_EMOJIS = [
  '👨', '🧔', '👩', '👱‍♀️', '👧', '👦', '👶', '👵', '👴', '🧕',
  '🐱', '🐶', '🦊', '🐻', '🐼', '🦁', '🐯', '🐨', '🦄', '🌸',
  '🍕', '🍔', '🥞', '☕', '⚽', '🎸', '🎮', '🚀', '⭐', '❤️', '🕶️', '👑'
];

function renderAvatar(
  p?: { avatar_url?: string; full_name?: string },
  sizeClass = 'w-10 h-10',
  textSizeClass = 'text-sm'
) {
  const isPhoto =
    p?.avatar_url &&
    (p.avatar_url.startsWith('data:image') || p.avatar_url.startsWith('http'));
  const isEmoji = p?.avatar_url && !isPhoto;
  const initial = p?.full_name ? p.full_name[0].toUpperCase() : 'U';

  if (isPhoto) {
    return (
      <img
        src={p!.avatar_url}
        alt=""
        className={`${sizeClass} rounded-full object-cover shadow-xs`}
      />
    );
  }
  if (isEmoji) {
    return (
      <div
        className={`${sizeClass} rounded-full bg-orange-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 shadow-xs leading-none`}
      >
        <span className={textSizeClass}>{p!.avatar_url}</span>
      </div>
    );
  }
  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-bold flex items-center justify-center flex-shrink-0 shadow-xs ${textSizeClass}`}
    >
      {initial}
    </div>
  );
}

export default function FamillePage() {
  const router = useRouter();
  const { user, profile, isAdmin, signOut, loading: authLoading, refreshProfile } = useAuth();
  const { preference, setPreference } = useTheme();

  useEffect(() => {
    if (!authLoading && !user && isSupabaseConfigured()) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Documents familiaux
  const [docCount, setDocCount] = useState(0);
  const [expiringDocCount, setExpiringDocCount] = useState(0);

  useEffect(() => {
    const docs = getLocalDocuments();
    setDocCount(docs.length);
    const expiring = docs.filter((d) => {
      const s = getExpiryStatus(d.expiry_date);
      return s.isExpired || s.isExpiringSoon;
    }).length;
    setExpiringDocCount(expiring);
  }, []);

  // Avatar Modal
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Formulaire d'ajout direct par l'Admin
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [addingUser, setAddingUser] = useState(false);

  // Gestion avancée des membres par l'Admin
  const [managingMemberId, setManagingMemberId] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Changement de mot de passe par l'utilisateur connecté
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentNewPassword, setCurrentNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPwdText, setShowPwdText] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setAvatarLoading(true);
    setAvatarError(null);

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          try {
            const canvas = document.createElement('canvas');
            const maxDim = 160;
            const width = img.width;
            const height = img.height;

            const minDim = Math.min(width, height);
            const sx = (width - minDim) / 2;
            const sy = (height - minDim) / 2;

            canvas.width = maxDim;
            canvas.height = maxDim;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, maxDim, maxDim);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

              if (!isSupabaseConfigured()) {
                const rawP = localStorage.getItem('keofamily_local_profile');
                if (rawP) {
                  const p = JSON.parse(rawP);
                  p.avatar_url = dataUrl;
                  localStorage.setItem('keofamily_local_profile', JSON.stringify(p));
                }
                const rawM = localStorage.getItem('keofamily_local_members');
                if (rawM) {
                  const list = JSON.parse(rawM).map((m: Profile) =>
                    m.id === user.id ? { ...m, avatar_url: dataUrl } : m
                  );
                  localStorage.setItem('keofamily_local_members', JSON.stringify(list));
                }
              } else {
                const { error: upErr } = await supabase
                  .from('profiles')
                  .update({ avatar_url: dataUrl })
                  .eq('id', user.id);

                if (upErr) throw upErr;
              }

              await refreshProfile();
              await fetchMembers();
              setAvatarSuccess('Photo de profil mise à jour !');
              setTimeout(() => {
                setShowAvatarModal(false);
                setAvatarSuccess(null);
              }, 1200);
            }
          } catch (err: any) {
            console.error('Erreur redimensionnement image:', err);
            setAvatarError('Impossible de traiter la photo.');
          } finally {
            setAvatarLoading(false);
          }
        };
        img.onerror = () => {
          setAvatarError('Fichier image invalide.');
          setAvatarLoading(false);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('Erreur upload avatar:', err);
      setAvatarError('Erreur lors du chargement de l’image.');
      setAvatarLoading(false);
    }
  }

  async function handleSelectEmoji(emoji: string) {
    if (!user) return;
    setAvatarLoading(true);
    setAvatarError(null);
    try {
      if (!isSupabaseConfigured()) {
        const rawP = localStorage.getItem('keofamily_local_profile');
        if (rawP) {
          const p = JSON.parse(rawP);
          p.avatar_url = emoji;
          localStorage.setItem('keofamily_local_profile', JSON.stringify(p));
        }
        const rawM = localStorage.getItem('keofamily_local_members');
        if (rawM) {
          const list = JSON.parse(rawM).map((m: Profile) =>
            m.id === user.id ? { ...m, avatar_url: emoji } : m
          );
          localStorage.setItem('keofamily_local_members', JSON.stringify(list));
        }
      } else {
        const { error: upErr } = await supabase
          .from('profiles')
          .update({ avatar_url: emoji })
          .eq('id', user.id);

        if (upErr) throw upErr;
      }

      await refreshProfile();
      await fetchMembers();
      setAvatarSuccess('Avatar emoji sélectionné !');
      setTimeout(() => {
        setShowAvatarModal(false);
        setAvatarSuccess(null);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setAvatarError('Erreur lors de la sélection de l’emoji.');
    } finally {
      setAvatarLoading(false);
    }
  }

  async function handleRemoveAvatar() {
    if (!user) return;
    setAvatarLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        const rawP = localStorage.getItem('keofamily_local_profile');
        if (rawP) {
          const p = JSON.parse(rawP);
          delete p.avatar_url;
          localStorage.setItem('keofamily_local_profile', JSON.stringify(p));
        }
        const rawM = localStorage.getItem('keofamily_local_members');
        if (rawM) {
          const list = JSON.parse(rawM).map((m: Profile) =>
            m.id === user.id ? { ...m, avatar_url: undefined } : m
          );
          localStorage.setItem('keofamily_local_members', JSON.stringify(list));
        }
      } else {
        await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
      }
      await refreshProfile();
      await fetchMembers();
      setShowAvatarModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setAvatarLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    if (!currentNewPassword || currentNewPassword.length < 6) {
      setPwdError('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    if (currentNewPassword !== confirmNewPassword) {
      setPwdError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    if (!isSupabaseConfigured()) {
      setPwdSuccess('Votre mot de passe local a été enregistré !');
      setCurrentNewPassword('');
      setConfirmNewPassword('');
      return;
    }

    setPwdLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: currentNewPassword,
      });

      if (error) throw error;

      setPwdSuccess('Votre mot de passe a été modifié avec succès !');
      setCurrentNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => {
        setShowPasswordForm(false);
        setPwdSuccess(null);
      }, 2500);
    } catch (err: any) {
      console.error('Erreur changement mot de passe:', err);
      setPwdError(err.message || 'Impossible de modifier le mot de passe.');
    } finally {
      setPwdLoading(false);
    }
  }

  useEffect(() => {
    fetchMembers();
  }, []);

  async function fetchMembers() {
    if (!isSupabaseConfigured()) {
      try {
        const rawM = localStorage.getItem('keofamily_local_members');
        if (rawM) {
          setMembers(JSON.parse(rawM));
        } else {
          const rawP = localStorage.getItem('keofamily_local_profile');
          if (rawP) {
            const p = JSON.parse(rawP);
            setMembers([p]);
            localStorage.setItem('keofamily_local_members', JSON.stringify([p]));
          }
        }
      } catch {
        // ignore
      }
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMembers(data as Profile[]);
    } catch (err: any) {
      console.error(err);
      setError('Impossible de charger la liste des membres.');
    } finally {
      setLoading(false);
    }
  }

  // Valider ou refuser un membre en attente (Admin seulement)
  async function handleUpdateStatus(userId: string, newStatus: 'approved' | 'rejected') {
    setError(null);
    setActionSuccess(null);
    try {
      if (!isSupabaseConfigured()) {
        const updated = members.map((m) => (m.id === userId ? { ...m, status: newStatus } : m));
        localStorage.setItem('keofamily_local_members', JSON.stringify(updated));
        setMembers(updated);
        setActionSuccess(newStatus === 'approved' ? 'Accès validé avec succès !' : 'Accès révoqué / suspendu.');
        return;
      }
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', userId);

      if (error) throw error;

      setActionSuccess(newStatus === 'approved' ? 'Accès validé avec succès !' : 'Accès révoqué / suspendu.');
      fetchMembers();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la mise à jour.');
    }
  }

  // Modifier le rôle d'un membre (Admin seulement)
  async function handleUpdateRole(userId: string, newRole: 'admin' | 'member') {
    setError(null);
    setActionSuccess(null);
    try {
      if (!isSupabaseConfigured()) {
        const updated = members.map((m) => (m.id === userId ? { ...m, role: newRole } : m));
        localStorage.setItem('keofamily_local_members', JSON.stringify(updated));
        setMembers(updated);
        setActionSuccess(`Rôle mis à jour (${newRole === 'admin' ? 'Administrateur' : 'Membre simple'}) !`);
        return;
      }
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;
      setActionSuccess(`Rôle mis à jour (${newRole === 'admin' ? 'Administrateur' : 'Membre simple'}) !`);
      fetchMembers();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la mise à jour du rôle.');
    }
  }

  // Modifier le nom d'un membre (Admin seulement)
  async function handleUpdateFullName(userId: string, newName: string) {
    if (!newName.trim()) return;
    setError(null);
    setActionSuccess(null);
    try {
      if (!isSupabaseConfigured()) {
        const updated = members.map((m) => (m.id === userId ? { ...m, full_name: newName.trim() } : m));
        localStorage.setItem('keofamily_local_members', JSON.stringify(updated));
        setMembers(updated);
        if (user?.id === userId) {
          const rawP = localStorage.getItem('keofamily_local_profile');
          if (rawP) {
            const p = JSON.parse(rawP);
            p.full_name = newName.trim();
            localStorage.setItem('keofamily_local_profile', JSON.stringify(p));
            await refreshProfile();
          }
        }
        setActionSuccess('Nom du membre mis à jour !');
        setEditingMemberId(null);
        return;
      }
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: newName.trim() })
        .eq('id', userId);

      if (error) throw error;
      setActionSuccess('Nom du membre mis à jour !');
      setEditingMemberId(null);
      fetchMembers();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la mise à jour du nom.');
    }
  }

  // Création directe d'un membre par l'Admin
  async function handleCreateMember(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setActionSuccess(null);
    setAddingUser(true);

    try {
      if (!isSupabaseConfigured()) {
        const newMember: Profile = {
          id: 'local-member-' + Date.now(),
          email: newEmail.trim() || `${newFullName.trim().toLowerCase().replace(/\s+/g, '.')}@keofamily.local`,
          full_name: newFullName.trim(),
          role: 'member',
          status: 'approved',
          avatar_url: '🧑',
          created_at: new Date().toISOString(),
        };
        const updated = [...members, newMember];
        localStorage.setItem('keofamily_local_members', JSON.stringify(updated));
        setMembers(updated);
        setActionSuccess(`Le membre ${newFullName} a été ajouté à votre famille !`);
        setNewFullName('');
        setNewEmail('');
        setNewPassword('');
        setShowAddForm(false);
        return;
      }
      // Inscription via Supabase Auth
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: newEmail.trim(),
        password: newPassword,
        options: {
          data: { full_name: newFullName.trim() },
        },
      });

      if (signUpErr) throw signUpErr;

      // Approuver immédiatement ce compte créé par l'admin
      if (data.user) {
        await supabase
          .from('profiles')
          .update({ status: 'approved' })
          .eq('id', data.user.id);
      }

      setActionSuccess(`Le compte de ${newFullName} a été créé et approuvé !`);
      setNewFullName('');
      setNewEmail('');
      setNewPassword('');
      setShowAddForm(false);
      fetchMembers();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la création du compte.');
    } finally {
      setAddingUser(false);
    }
  }

  // Démarrer une conversation privée
  async function handleStartDirectChat(targetUser: Profile) {
    if (!user) return;
    try {
      // Vérifier si une conversation existe déjà
      const { data: convs } = await supabase
        .from('conversations')
        .select('id, is_group, conversation_participants!inner(user_id)')
        .eq('is_group', false);

      const existing = convs?.find((c: any) =>
        c.conversation_participants?.some((p: any) => p.user_id === targetUser.id)
      );

      if (existing) {
        router.push(`/messages?conv=${existing.id}`);
        return;
      }

      // Créer une nouvelle conversation privée
      const { data: newConv, error: convErr } = await supabase
        .from('conversations')
        .insert({ is_group: false, created_by: user.id })
        .select()
        .single();

      if (convErr) throw convErr;

      // Ajouter les deux participants
      await supabase.from('conversation_participants').insert([
        { conversation_id: newConv.id, user_id: user.id },
        { conversation_id: newConv.id, user_id: targetUser.id },
      ]);

      router.push(`/messages?conv=${newConv.id}`);
    } catch (err: any) {
      console.error(err);
      router.push('/messages');
    }
  }

  const pendingMembers = members.filter((m) => m.status === 'pending');
  const approvedMembers = members.filter((m) => m.status === 'approved');
  const rejectedMembers = members.filter((m) => m.status === 'rejected');

  return (
    <div className="pb-32">
      <Header title="Membres de la Famille" />

      <div className="p-4 space-y-6">
        {/* MON COMPTE & DÉCONNEXION */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div
                onClick={() => setShowAvatarModal(true)}
                className="relative group cursor-pointer flex-shrink-0"
                title="Changer ma photo de profil ou mon avatar"
              >
                {renderAvatar(profile || undefined, 'w-13 h-13', 'text-xl')}
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center shadow-md border-2 border-white group-hover:scale-110 transition">
                  <Camera className="w-3 h-3" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 text-sm sm:text-base">
                    {profile?.full_name || 'Utilisateur'}
                  </span>
                  {isAdmin && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{user?.email || profile?.email}</p>
                <button
                  type="button"
                  onClick={() => setShowAvatarModal(true)}
                  className="text-[11px] font-semibold text-primary-600 hover:text-primary-700 hover:underline mt-0.5 flex items-center gap-1 transition"
                >
                  <Camera className="w-3 h-3" />
                  <span>Modifier mon avatar</span>
                </button>
              </div>
            </div>
            <button
              onClick={async () => {
                await signOut();
                router.push('/login');
              }}
              title="Se déconnecter"
              className="p-2 text-gray-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* CHANGER LE MOT DE PASSE */}
          <div className="pt-2 border-t border-gray-100">
            {!showPasswordForm ? (
              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm(true);
                  setPwdError(null);
                  setPwdSuccess(null);
                }}
                className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1.5 transition py-1"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Changer mon mot de passe</span>
              </button>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-primary-600" />
                    Nouveau mot de passe
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setCurrentNewPassword('');
                      setConfirmNewPassword('');
                      setPwdError(null);
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Annuler
                  </button>
                </div>

                {pwdError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{pwdError}</span>
                  </div>
                )}

                {pwdSuccess && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 font-semibold">
                    <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                    <span>{pwdSuccess}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type={showPwdText ? 'text' : 'password'}
                      value={currentNewPassword}
                      onChange={(e) => setCurrentNewPassword(e.target.value)}
                      placeholder="Nouveau mot de passe (min. 6 car.)"
                      required
                      minLength={6}
                      className="w-full px-3 py-2 pr-10 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwdText(!showPwdText)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPwdText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={showPwdText ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Confirmer le nouveau mot de passe"
                      required
                      minLength={6}
                      className="w-full px-3 py-2 pr-10 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-xs"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setCurrentNewPassword('');
                      setConfirmNewPassword('');
                      setPwdError(null);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition"
                  >
                    Fermer
                  </button>
                  <button
                    type="submit"
                    disabled={pwdLoading}
                    className="px-3.5 py-1.5 rounded-xl bg-primary-600 text-white text-xs font-bold hover:bg-primary-700 transition disabled:opacity-50 shadow-xs"
                  >
                    {pwdLoading ? 'Mise à jour...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* COFFRE DE DOCUMENTS FAMILIAUX */}
        <Link
          href="/documents"
          className="block bg-gradient-to-r from-orange-50/70 via-amber-50/70 to-orange-50/70 dark:from-slate-800 dark:via-slate-800 dark:to-slate-800 rounded-2xl border border-orange-200/80 dark:border-slate-700 p-4 shadow-xs hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-primary-600 to-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-primary-600/30">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                    Coffre de Documents Familiaux
                  </h3>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300">
                    Sécurisé
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                  {docCount > 0
                    ? `${docCount} document(s) classé(s) (passeports, santé, baux...)`
                    : 'Passeports, cartes vitales, contrats, baux...'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {expiringDocCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                  {expiringDocCount} alerte(s)
                </span>
              )}
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-primary-600 group-hover:translate-x-0.5 transition" />
            </div>
          </div>
        </Link>

        {/* APPARENCE & MODE SOMBRE */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary-600" />
              <h2 className="font-bold text-sm text-gray-900">Apparence & Mode sombre</h2>
            </div>
            <Link
              href="/settings"
              className="text-xs text-primary-600 hover:underline font-semibold flex items-center gap-1"
            >
              <SettingsIcon className="w-3.5 h-3.5" /> Paramètres
            </Link>
          </div>
          <div className="grid grid-cols-3 p-1 bg-gray-100 rounded-2xl text-xs font-bold">
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
                  preference === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* MESSAGES D'ACTION */}
        {actionSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* SECTION ADMIN : DEMANDES EN ATTENTE */}
        {isAdmin && pendingMembers.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-amber-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Demandes d'accès en attente ({pendingMembers.length})</span>
              </h2>
            </div>
            <p className="text-xs text-amber-700">
              Ces personnes ont demandé à rejoindre l'espace familial. Validez leur accès pour leur ouvrir le site :
            </p>

            <div className="space-y-2 mt-2">
              {pendingMembers.map((m) => (
                <div
                  key={m.id}
                  className="bg-white rounded-2xl p-3 border border-amber-200/80 flex items-center justify-between shadow-xs"
                >
                  <div className="flex items-center gap-2.5">
                    {renderAvatar(m, 'w-8 h-8', 'text-xs')}
                    <div>
                      <h3 className="font-bold text-xs text-gray-900">{m.full_name}</h3>
                      <p className="text-[11px] text-gray-500">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateStatus(m.id, 'approved')}
                      className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-xl text-xs hover:bg-emerald-700 transition flex items-center gap-1 shadow-xs"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Valider</span>
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(m.id, 'rejected')}
                      className="px-2.5 py-1.5 bg-gray-100 text-gray-600 font-bold rounded-xl text-xs hover:bg-red-50 hover:text-red-700 transition flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Refuser</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION ADMIN : CRÉER UN MEMBRE DIRECTEMENT */}
        {isAdmin && (
          <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary-600" />
                <h2 className="font-bold text-gray-900 text-sm">Ajouter un membre de la famille</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className="text-xs font-bold text-primary-600 hover:text-primary-700"
              >
                {showAddForm ? 'Fermer' : '+ Nouveau compte'}
              </button>
            </div>

            {showAddForm && (
              <form onSubmit={handleCreateMember} className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Prénom & Nom
                  </label>
                  <input
                    type="text"
                    required
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="Ex: Karim, Sarah, Lucas..."
                    className="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
                {isSupabaseConfigured() && (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                        Adresse email
                      </label>
                      <input
                        type="email"
                        required
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="email@famille.fr"
                        className="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                        Mot de passe initial
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Minimum 6 caractères"
                          className="w-full pl-3 pr-10 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition"
                          title={showNewPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        >
                          {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
                <button
                  type="submit"
                  disabled={addingUser}
                  className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs shadow-sm transition disabled:opacity-50"
                >
                  {addingUser ? 'Création en cours...' : 'Créer et valider ce membre'}
                </button>

                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl text-[11px] text-amber-900 leading-relaxed space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-amber-950">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    Important pour la première connexion :
                  </p>
                  <p className="text-amber-800">
                    Si le nouveau membre voit le message <em>« Email not confirmed »</em> à la connexion, validez son e-mail en 1 clic dans votre tableau de bord Supabase (<strong>Authentication &gt; Users &gt; ... &gt; Confirm User</strong>), ou désactivez l'option <strong>Confirm email</strong> dans <strong>Authentication &gt; Providers &gt; Email</strong>.
                  </p>
                </div>
              </form>
            )}
          </div>
        )}

        {/* LISTE DES MEMBRES ACTIFS */}
        <div className="space-y-3">
          <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-primary-600" />
            <span>Membres de la famille ({approvedMembers.length})</span>
          </h2>

          <div className="space-y-2">
            {approvedMembers.map((m) => {
              const isMe = m.id === user?.id;
              const isManaging = managingMemberId === m.id;
              const isEditing = editingMemberId === m.id;

              return (
                <div key={m.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs hover:border-gray-200 transition">
                  <div className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      {renderAvatar(m, 'w-10 h-10', 'text-base')}
                      <div className="min-w-0">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 py-0.5">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="px-2 py-1 text-xs border border-primary-500 rounded-lg focus:outline-none bg-gray-50 font-bold"
                              placeholder="Nom du membre"
                              autoFocus
                            />
                            <button
                              onClick={() => handleUpdateFullName(m.id, editingName)}
                              title="Valider"
                              className="p-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingMemberId(null)}
                              title="Annuler"
                              className="p-1 text-gray-400 hover:text-gray-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-gray-900 truncate">{m.full_name}</span>
                            {isMe && <span className="text-[10px] text-gray-400">(Vous)</span>}
                            {m.role === 'admin' && (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-100 text-amber-800 flex items-center gap-0.5">
                                <Shield className="w-2.5 h-2.5" /> Admin
                              </span>
                            )}
                          </div>
                        )}
                        <span className="text-[11px] text-gray-400 block truncate">{m.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {!isMe && (
                        <button
                          onClick={() => handleStartDirectChat(m)}
                          title="Envoyer un message privé"
                          className="p-2 text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-xl transition"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      )}

                      {isAdmin && !isMe && (
                        <button
                          onClick={() => {
                            setManagingMemberId(isManaging ? null : m.id);
                            setEditingMemberId(null);
                          }}
                          title="Gérer ce membre"
                          className={`p-2 rounded-xl transition flex items-center gap-1 text-xs font-semibold ${
                            isManaging
                              ? 'bg-primary-600 text-white shadow-xs'
                              : 'text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Gérer</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* PANNEAU D'ADMINISTRATION DU MEMBRE */}
                  {isAdmin && !isMe && isManaging && (
                    <div className="p-3 bg-gray-50 border-t border-gray-100 space-y-2.5 text-xs animate-in fade-in duration-150">
                      <div className="flex items-center justify-between text-gray-500 font-semibold text-[11px]">
                        <span>Gestion du compte de {m.full_name}</span>
                        <button
                          onClick={() => setManagingMemberId(null)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          Fermer
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* Renommer */}
                        <button
                          onClick={() => {
                            setEditingMemberId(m.id);
                            setEditingName(m.full_name);
                          }}
                          className="p-2 rounded-xl bg-white border border-gray-200 hover:border-primary-400 text-gray-700 hover:text-primary-700 transition flex items-center justify-center gap-1.5 font-medium shadow-xs"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                          <span>Modifier le nom</span>
                        </button>

                        {/* Changer de rôle */}
                        {m.role === 'member' ? (
                          <button
                            onClick={() => {
                              if (confirm(`Promouvoir ${m.full_name} en tant qu'Administrateur ?`)) {
                                handleUpdateRole(m.id, 'admin');
                              }
                            }}
                            className="p-2 rounded-xl bg-white border border-amber-200 hover:bg-amber-50 text-amber-900 transition flex items-center justify-center gap-1.5 font-medium shadow-xs"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                            <span>Nommer Admin</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (confirm(`Rétrograder ${m.full_name} en tant que Membre simple ?`)) {
                                handleUpdateRole(m.id, 'member');
                              }
                            }}
                            className="p-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 transition flex items-center justify-center gap-1.5 font-medium shadow-xs"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 text-gray-400" />
                            <span>Rétrograder Membre</span>
                          </button>
                        )}

                        {/* Bloquer / Suspendre */}
                        <button
                          onClick={() => {
                            if (confirm(`Êtes-vous sûr de vouloir suspendre l'accès de ${m.full_name} ? Il ne pourra plus se connecter.`)) {
                              handleUpdateStatus(m.id, 'rejected');
                            }
                          }}
                          className="p-2 rounded-xl bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 transition flex items-center justify-center gap-1.5 font-medium shadow-xs"
                        >
                          <UserX className="w-3.5 h-3.5 text-red-600" />
                          <span>Suspendre l'accès</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION ADMIN : MEMBRES SUSPENDUS OU REFUSÉS */}
        {isAdmin && rejectedMembers.length > 0 && (
          <div className="bg-red-50/70 border border-red-200 rounded-3xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-red-900 text-sm flex items-center gap-2">
                <UserX className="w-4 h-4 text-red-600" />
                <span>Membres suspendus ou refusés ({rejectedMembers.length})</span>
              </h2>
            </div>
            <p className="text-xs text-red-700">
              Ces personnes n'ont plus accès à l'application familiale. Vous pouvez réactiver leur accès à tout moment :
            </p>

            <div className="space-y-2 mt-2">
              {rejectedMembers.map((m) => (
                <div
                  key={m.id}
                  className="bg-white rounded-2xl p-3 border border-red-200 flex items-center justify-between shadow-xs"
                >
                  <div className="flex items-center gap-2.5">
                    {renderAvatar(m, 'w-8 h-8', 'text-xs')}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-xs text-gray-900">{m.full_name}</h3>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-800">
                          Accès révoqué
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500">{m.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUpdateStatus(m.id, 'approved')}
                    className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-xl text-xs hover:bg-emerald-700 transition flex items-center gap-1 shadow-xs"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Réactiver l'accès</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL PERSONNALISATION DE L'AVATAR */}
      {showAvatarModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-sm w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between flex-shrink-0 bg-white dark:bg-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-primary-950 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">Photo de profil / Avatar</h3>
                  <p className="text-[10px] text-gray-400">Visible par toute la famille</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAvatarModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* APERÇU ACTUEL */}
              <div className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-slate-750 rounded-2xl border border-gray-100 dark:border-slate-700">
                {renderAvatar(profile || undefined, 'w-20 h-20', 'text-3xl')}
                <p className="font-bold text-xs text-gray-900 dark:text-white mt-2">
                  {profile?.full_name}
                </p>
                <span className="text-[10px] text-gray-400">Aperçu actuel</span>
              </div>

              {/* MESSAGES */}
              {avatarSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 font-semibold">
                  <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                  <span>{avatarSuccess}</span>
                </div>
              )}

              {avatarError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{avatarError}</span>
                </div>
              )}

              {/* SECTION 1 : UPLOAD PHOTO */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-primary-600" />
                  <span>Votre propre photo</span>
                </h4>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={avatarLoading}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 rounded-xl border border-dashed border-primary-400 hover:border-primary-600 bg-orange-50/50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-300 text-xs font-bold flex items-center justify-center gap-2 transition hover:bg-orange-100/50"
                >
                  <Camera className="w-4 h-4" />
                  <span>{avatarLoading ? 'Traitement...' : 'Prendre ou choisir une photo'}</span>
                </button>
                <p className="text-[10px] text-gray-400 text-center">
                  Recadrée automatiquement en carré et optimisée.
                </p>
              </div>

              {/* SECTION 2 : CHOIX EMOJI */}
              <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Smile className="w-3.5 h-3.5 text-primary-600" />
                  <span>Ou choisir un avatar express :</span>
                </h4>
                <div className="grid grid-cols-8 gap-1.5 bg-gray-50 dark:bg-slate-750 p-2 rounded-2xl border border-gray-100 dark:border-slate-700">
                  {PRESET_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      disabled={avatarLoading}
                      onClick={() => handleSelectEmoji(emoji)}
                      className={`h-9 rounded-xl flex items-center justify-center text-lg hover:scale-125 transition ${
                        profile?.avatar_url === emoji
                          ? 'bg-orange-200 dark:bg-primary-900 ring-2 ring-primary-500 scale-110'
                          : 'hover:bg-white dark:hover:bg-slate-700'
                      }`}
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* SECTION 3 : RÉINITIALISER */}
              {profile?.avatar_url && (
                <div className="pt-2 border-t border-gray-100 dark:border-slate-700">
                  <button
                    type="button"
                    disabled={avatarLoading}
                    onClick={handleRemoveAvatar}
                    className="w-full py-2 text-xs font-semibold text-gray-500 hover:text-red-600 flex items-center justify-center gap-1.5 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Réinitialiser (afficher mes initiales)</span>
                  </button>
                </div>
              )}
            </div>

            <div className="p-3 bg-gray-50 dark:bg-slate-750 border-t border-gray-100 dark:border-slate-700 flex justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowAvatarModal(false)}
                className="w-full py-2 rounded-xl border border-gray-200 dark:border-slate-600 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
