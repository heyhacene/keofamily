'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import Header from '@/components/Header';
import { useAuth } from '@/lib/authContext';
import { supabase, isSupabaseConfigured, Message, Conversation, Profile } from '@/lib/supabase';
import {
  Send,
  ArrowLeft,
  Plus,
  Users,
  User,
  MessageCircle,
  Clock,
  Smile,
  BarChart2,
  CheckCircle2,
  Bell,
  Trash2,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { sendLocalNotification, isNotificationSupported, getNotificationPermission, requestNotificationPermission } from '@/lib/notifications';

interface PollOption {
  id: string;
  text: string;
  voterIds: string[];
}

interface PollData {
  question: string;
  options: PollOption[];
  multiple?: boolean;
}

function parsePoll(content: string): PollData | null {
  if (!content || !content.startsWith('POLL:')) return null;
  try {
    return JSON.parse(content.slice(5));
  } catch {
    return null;
  }
}

function isPhotoUrl(url?: string): boolean {
  return Boolean(url && (url.startsWith('data:image') || url.startsWith('http')));
}

function isCentralFamilyConv(c?: Conversation | null): boolean {
  if (!c || !c.name) return false;
  const n = c.name.trim().toLowerCase();
  return n === 'toute la famille' || n === 'famille';
}

const QUICK_EMOJIS = ['❤️', '👍', '😂', '🎉', '🍕', '☕', '👏', '🚗', '🛒'];

const QUICK_PHRASES = [
  'À table ! 🍽️',
  'J’arrive ! 🚗',
  'Je passe aux courses 🛒',
  'Qui est dispo ? 🤔',
  'Bonne journée ! ☀️',
];

function MessagesContent() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const initialConvId = searchParams.get('conv');

  useEffect(() => {
    if (!authLoading && !user && isSupabaseConfigured()) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({});

  // Notifications prompt
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [showNotifBanner, setShowNotifBanner] = useState(false);

  // Modal nouveau groupe / DM
  const [showNewModal, setShowNewModal] = useState(false);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');

  // Modal Sondage
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollMultiple, setPollMultiple] = useState(false);
  const [isSubmittingPoll, setIsSubmittingPoll] = useState(false);

  // Suppression de conversation (appui long)
  const [convToDelete, setConvToDelete] = useState<Conversation | null>(null);
  const [isDeletingConv, setIsDeletingConv] = useState(false);
  const [infoToast, setInfoToast] = useState<string | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressActiveRef = useRef(false);

  // Quick bar
  const [showQuickBar, setShowQuickBar] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Vérifier la permission des notifications
  useEffect(() => {
    if (isNotificationSupported()) {
      const perm = getNotificationPermission();
      setNotifPermission(perm);
      if (perm === 'default') {
        setShowNotifBanner(true);
      }
    }
  }, []);

  async function handleEnableNotifications() {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    setShowNotifBanner(false);
  }

  // Charger la liste des profils
  useEffect(() => {
    async function loadProfiles() {
      if (!isSupabaseConfigured()) {
        try {
          const rawM = localStorage.getItem('keofamily_local_members');
          if (rawM) {
            const list: Profile[] = JSON.parse(rawM);
            const map: Record<string, Profile> = {};
            list.forEach((p) => {
              map[p.id] = p;
            });
            setProfilesMap(map);
            setAllProfiles(list);
          }
        } catch {
          // ignore
        }
        return;
      }
      const { data } = await supabase.from('profiles').select('*').eq('status', 'approved');
      if (data) {
        const map: Record<string, Profile> = {};
        data.forEach((p) => {
          map[p.id] = p;
        });
        setProfilesMap(map);
        setAllProfiles(data);
      }
    }
    loadProfiles();
  }, []);

  // Charger les conversations
  const loadConversations = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured()) {
      try {
        const rawC = localStorage.getItem('keofamily_local_convs');
        let convList: Conversation[] = rawC ? JSON.parse(rawC) : [];
        if (convList.length === 0) {
          const defaultConv: Conversation = {
            id: 'local-conv-family',
            name: 'Toute la Famille',
            is_group: true,
            created_by: user.id,
            created_at: new Date().toISOString(),
            participantIds: [user.id],
          };
          convList = [defaultConv];
          localStorage.setItem('keofamily_local_convs', JSON.stringify(convList));
        }
        setConversations(convList);
        if (initialConvId) {
          const found = convList.find((c) => c.id === initialConvId);
          if (found) setActiveConv(found);
        }
      } catch {
        // ignore
      }
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // 1. Récupérer les participations de l'utilisateur
      const { data: myParticipations, error } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (error) throw error;

      const convIds = (myParticipations || []).map((p: any) => p.conversation_id);
      if (convIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // 2. Récupérer TOUS les participants de ces conversations
      const { data: allParts } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', convIds);

      const partsMap: Record<string, string[]> = {};
      (allParts || []).forEach((ap: any) => {
        if (!partsMap[ap.conversation_id]) partsMap[ap.conversation_id] = [];
        partsMap[ap.conversation_id].push(ap.user_id);
      });

      // 3. Récupérer les conversations
      const { data: convListRaw } = await supabase
        .from('conversations')
        .select('*')
        .in('id', convIds)
        .order('created_at', { ascending: false });

      const convList: Conversation[] = (convListRaw || []).map((c: any) => ({
        ...c,
        participantIds: partsMap[c.id] || [],
      }));

      setConversations(convList);

      if (initialConvId) {
        const found = convList.find((c) => c.id === initialConvId);
        if (found) setActiveConv(found);
      }
    } catch (err) {
      console.error('Erreur conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [user, initialConvId]);

  useEffect(() => {
    loadConversations();

    // ÉCOUTE EN TEMPS RÉEL : Ajout / Suppression de conversations
    if (isSupabaseConfigured()) {
      const channel = supabase
        .channel('conversations_list_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'conversations' },
          () => {
            loadConversations();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'conversation_participants' },
          () => {
            loadConversations();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [loadConversations]);

  // Détection de l'appui long
  function startLongPress(c: Conversation, clientX: number, clientY: number) {
    isLongPressActiveRef.current = false;
    touchStartPosRef.current = { x: clientX, y: clientY };

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(60);
        } catch {}
      }

      if (isCentralFamilyConv(c)) {
        setInfoToast("La conversation 'Toute la Famille' est la discussion centrale et ne peut pas être supprimée.");
        setTimeout(() => setInfoToast(null), 3500);
      } else {
        setConvToDelete(c);
      }
    }, 550);
  }

  function cancelLongPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!touchStartPosRef.current) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(t.clientY - touchStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      cancelLongPress();
    }
  }

  // Confirmation de suppression de conversation
  async function confirmDeleteConversation() {
    if (!convToDelete || !user) return;
    setIsDeletingConv(true);
    const convId = convToDelete.id;

    try {
      if (!isSupabaseConfigured()) {
        const updatedConvs = conversations.filter((c) => c.id !== convId);
        localStorage.setItem('keofamily_local_convs', JSON.stringify(updatedConvs));
        setConversations(updatedConvs);
        if (activeConv?.id === convId) setActiveConv(null);
        setConvToDelete(null);
        return;
      }
      // 1. Supprimer les messages de la conversation
      await supabase.from('messages').delete().eq('conversation_id', convId);

      // 2. Supprimer les participants
      await supabase.from('conversation_participants').delete().eq('conversation_id', convId);

      // 3. Supprimer la ligne conversation
      const { error } = await supabase.from('conversations').delete().eq('id', convId);
      if (error) {
        console.warn('Erreur suppression conv, tentative retrait participant fallback:', error);
        await supabase
          .from('conversation_participants')
          .delete()
          .match({ conversation_id: convId, user_id: user.id });
      }

      // Mise à jour optimiste
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConv?.id === convId) {
        setActiveConv(null);
      }
      setConvToDelete(null);
    } catch (err: any) {
      console.error('Erreur suppression conversation:', err);
      alert('Impossible de supprimer la conversation : ' + (err?.message || 'Erreur inconnue'));
    } finally {
      setIsDeletingConv(false);
    }
  }

  // Charger les messages et écouter en temps réel
  useEffect(() => {
    if (!activeConv) return;
    const convId = activeConv.id;

    if (!isSupabaseConfigured()) {
      try {
        const rawM = localStorage.getItem(`keofamily_local_msgs_${convId}`);
        setMessages(rawM ? JSON.parse(rawM) : []);
      } catch {
        setMessages([]);
      }
      return;
    }

    async function fetchMessages() {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data as Message[]);
      }
    }

    fetchMessages();

    // ÉCOUTE EN TEMPS RÉEL (REALTIME SUPABASE INSERT & UPDATE)
    const channel = supabase
      .channel(`chat_${convId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${convId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // Envoyer une notification locale si le message provient d'un autre utilisateur
          if (user && newMsg.sender_id !== user.id) {
            const senderName = profilesMap[newMsg.sender_id]?.full_name || 'Keo Family';
            const pollData = parsePoll(newMsg.content);
            const notifBody = pollData
              ? `📊 Sondage : ${pollData.question}`
              : newMsg.content;

            sendLocalNotification(senderName, {
              body: notifBody,
              url: `/messages?conv=${convId}`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${convId}`,
        },
        (payload) => {
          const updatedMsg = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConv, user, profilesMap]);

  // Défilement automatique vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Envoi d'un message standard
  async function handleSendMessage(e?: React.FormEvent, customText?: string) {
    if (e) e.preventDefault();
    const textToSend = (customText !== undefined ? customText : newMessageText).trim();
    if (!textToSend || !activeConv || !user) return;

    if (customText === undefined) setNewMessageText('');

    try {
      if (!isSupabaseConfigured()) {
        const localMsg: Message = {
          id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          conversation_id: activeConv.id,
          sender_id: user.id,
          content: textToSend,
          created_at: new Date().toISOString(),
        };
        const updated = [...messages, localMsg];
        setMessages(updated);
        localStorage.setItem(`keofamily_local_msgs_${activeConv.id}`, JSON.stringify(updated));
        return;
      }
      const { error } = await supabase.from('messages').insert({
        conversation_id: activeConv.id,
        sender_id: user.id,
        content: textToSend,
      });

      if (error) {
        console.error('Erreur envoi message:', error);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Voter dans un sondage
  async function handleVotePoll(messageId: string, pollData: PollData, optionId: string) {
    if (!user) return;

    const updatedOptions = pollData.options.map((opt) => {
      const hasVoted = opt.voterIds.includes(user.id);

      if (pollData.multiple) {
        // Choix multiple : basculer le vote sur cette option
        if (opt.id === optionId) {
          return {
            ...opt,
            voterIds: hasVoted
              ? opt.voterIds.filter((id) => id !== user.id)
              : [...opt.voterIds, user.id],
          };
        }
        return opt;
      } else {
        // Choix unique : enlever son vote partout, et l'ajouter seulement si pas déjà voté
        if (opt.id === optionId) {
          return {
            ...opt,
            voterIds: hasVoted ? [] : [user.id],
          };
        } else {
          return {
            ...opt,
            voterIds: opt.voterIds.filter((id) => id !== user.id),
          };
        }
      }
    });

    const updatedPoll: PollData = {
      ...pollData,
      options: updatedOptions,
    };

    const newContent = `POLL:${JSON.stringify(updatedPoll)}`;

    // Mise à jour optimiste locale
    const updatedList = messages.map((m) => (m.id === messageId ? { ...m, content: newContent } : m));
    setMessages(updatedList);

    if (!isSupabaseConfigured() && activeConv) {
      localStorage.setItem(`keofamily_local_msgs_${activeConv.id}`, JSON.stringify(updatedList));
      return;
    }

    try {
      await supabase
        .from('messages')
        .update({ content: newContent })
        .eq('id', messageId);
    } catch (err) {
      console.error('Erreur vote sondage:', err);
    }
  }

  // Création d'un nouveau sondage
  async function handleCreatePoll(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activeConv || !pollQuestion.trim()) return;

    const validOptions = pollOptions
      .map((o) => o.trim())
      .filter((o) => o.length > 0);

    if (validOptions.length < 2) {
      alert('Veuillez renseigner au moins 2 options de réponse.');
      return;
    }

    setIsSubmittingPoll(true);
    try {
      const pollData: PollData = {
        question: pollQuestion.trim(),
        multiple: pollMultiple,
        options: validOptions.map((text, idx) => ({
          id: `opt_${Date.now()}_${idx}`,
          text,
          voterIds: [],
        })),
      };

      if (!isSupabaseConfigured()) {
        const localMsg: Message = {
          id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          conversation_id: activeConv.id,
          sender_id: user.id,
          content: `POLL:${JSON.stringify(pollData)}`,
          created_at: new Date().toISOString(),
        };
        const updated = [...messages, localMsg];
        setMessages(updated);
        localStorage.setItem(`keofamily_local_msgs_${activeConv.id}`, JSON.stringify(updated));
        setShowPollModal(false);
        setPollQuestion('');
        setPollOptions(['', '']);
        setPollMultiple(false);
        return;
      }

      const { error } = await supabase.from('messages').insert({
        conversation_id: activeConv.id,
        sender_id: user.id,
        content: `POLL:${JSON.stringify(pollData)}`,
      });

      if (error) throw error;

      setShowPollModal(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      setPollMultiple(false);
    } catch (err) {
      console.error('Erreur création sondage:', err);
      alert('Erreur lors de la création du sondage.');
    } finally {
      setIsSubmittingPoll(false);
    }
  }

  // Création d'une nouvelle conversation (DM ou Groupe)
  async function handleCreateConversation() {
    if (!user || selectedUserIds.length === 0) return;

    try {
      const isGroup = selectedUserIds.length > 1 || Boolean(groupName.trim());
      const name = isGroup ? (groupName.trim() || 'Nouveau groupe') : null;

      if (!isSupabaseConfigured()) {
        const localConv: Conversation = {
          id: 'local-conv-' + Date.now(),
          name: name || undefined,
          is_group: isGroup,
          created_by: user.id,
          created_at: new Date().toISOString(),
          participantIds: Array.from(new Set([...selectedUserIds, user.id])),
        };
        const updated = [localConv, ...conversations];
        localStorage.setItem('keofamily_local_convs', JSON.stringify(updated));
        setConversations(updated);
        setActiveConv(localConv);
        setShowNewModal(false);
        setSelectedUserIds([]);
        setGroupName('');
        return;
      }

      const { data: newConv, error: convErr } = await supabase
        .from('conversations')
        .insert({
          name,
          is_group: isGroup,
          created_by: user.id,
        })
        .select()
        .single();

      if (convErr) throw convErr;

      const participantsToAdd = Array.from(new Set([...selectedUserIds, user.id])).map((uid) => ({
        conversation_id: newConv.id,
        user_id: uid,
      }));

      await supabase.from('conversation_participants').insert(participantsToAdd);

      setConversations((prev) => [newConv, ...prev]);
      setActiveConv(newConv);
      setShowNewModal(false);
      setSelectedUserIds([]);
      setGroupName('');
    } catch (err) {
      console.error(err);
    }
  }

  function getOtherParticipant(c: Conversation): Profile | undefined {
    if (!c.participantIds) return undefined;
    const otherId = c.participantIds.find((id) => id !== user?.id);
    return otherId ? profilesMap[otherId] : undefined;
  }

  function getConvTitle(c: Conversation): string {
    if (c.name) return c.name;
    if (c.participantIds && c.participantIds.length > 0) {
      const otherIds = c.participantIds.filter((id) => id !== user?.id);
      const otherNames = otherIds
        .map((id) => profilesMap[id]?.full_name)
        .filter(Boolean);
      if (otherNames.length > 0) {
        return otherNames.join(', ');
      }
    }
    return 'Message privé';
  }

  // --- VUE 1 : DANS UNE CONVERSATION (CHAT ROOM) ---
  if (activeConv) {
    const otherProfile = getOtherParticipant(activeConv);
    const convTitle = getConvTitle(activeConv);

    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] max-w-lg mx-auto bg-gray-50 dark:bg-slate-900">
        {/* EN-TÊTE DE LA CONVERSATION */}
        <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between shadow-xs sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveConv(null)}
              className="p-1.5 -ml-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 shadow-xs">
              {otherProfile?.avatar_url && !activeConv.name ? (
                isPhotoUrl(otherProfile.avatar_url) ? (
                  <img src={otherProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-orange-100 dark:bg-slate-700 flex items-center justify-center text-base">
                    {otherProfile.avatar_url}
                  </div>
                )
              ) : !activeConv.name && otherProfile ? (
                <div className="w-full h-full bg-gradient-to-tr from-orange-400 to-amber-500 text-white font-bold flex items-center justify-center text-xs">
                  {otherProfile.full_name ? otherProfile.full_name[0].toUpperCase() : 'U'}
                </div>
              ) : (
                <div className="w-full h-full bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 font-bold flex items-center justify-center text-xs">
                  <Users className="w-4 h-4" />
                </div>
              )}
            </div>
            <div>
              <h2 className="font-bold text-sm text-gray-900 dark:text-white leading-tight">
                {convTitle}
              </h2>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                En direct
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowPollModal(true)}
              className="p-2 text-primary-600 dark:text-primary-400 hover:bg-orange-50 dark:hover:bg-slate-700 rounded-xl transition flex items-center gap-1 text-xs font-bold"
              title="Créer un sondage"
            >
              <BarChart2 className="w-4 h-4" />
              <span className="hidden sm:inline">Sondage</span>
            </button>
          </div>
        </div>

        {/* LISTE DES MESSAGES */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 pb-36">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-slate-500 text-xs">
              Aucun message pour l'instant. Dites bonjour ! 👋
            </div>
          ) : (
            messages.map((m) => {
              const isMine = m.sender_id === user?.id;
              const sender = profilesMap[m.sender_id];
              const timeStr = new Date(m.created_at).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              });

              const pollData = parsePoll(m.content);

              // AFFICHAGE SONDAGE INTERACTIF
              if (pollData) {
                const totalVotes = pollData.options.reduce(
                  (sum, opt) => sum + opt.voterIds.length,
                  0
                );

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} w-full`}
                  >
                    {!isMine && (
                      <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-2">
                        {sender?.full_name || 'Membre'}
                      </span>
                    )}
                    <div className="w-full max-w-[92%] sm:max-w-[85%] bg-white dark:bg-slate-800 rounded-3xl p-4 border border-orange-200/80 dark:border-slate-700 shadow-sm space-y-3">
                      <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700/60 pb-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-primary-600 dark:text-primary-400">
                          <BarChart2 className="w-4 h-4" />
                          <span>Sondage familial</span>
                        </div>
                        <span className="text-[10px] text-gray-400 dark:text-slate-500">
                          {pollData.multiple ? 'Choix multiple' : 'Choix unique'}
                        </span>
                      </div>

                      <h4 className="font-bold text-sm text-gray-900 dark:text-white leading-snug">
                        {pollData.question}
                      </h4>

                      {/* OPTIONS */}
                      <div className="space-y-2">
                        {pollData.options.map((opt) => {
                          const hasVoted = user ? opt.voterIds.includes(user.id) : false;
                          const percent =
                            totalVotes > 0
                              ? Math.round((opt.voterIds.length / totalVotes) * 100)
                              : 0;

                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleVotePoll(m.id, pollData, opt.id)}
                              className={`w-full text-left rounded-2xl p-2.5 border transition relative overflow-hidden flex flex-col gap-1 ${
                                hasVoted
                                  ? 'border-primary-500 bg-orange-50/50 dark:bg-primary-950/30'
                                  : 'border-gray-100 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-750 hover:border-gray-200 dark:hover:border-slate-600'
                              }`}
                            >
                              {/* Barre de progression d'arrière-plan */}
                              <div
                                className={`absolute left-0 top-0 bottom-0 transition-all duration-300 pointer-events-none ${
                                  hasVoted
                                    ? 'bg-primary-100/60 dark:bg-primary-900/40'
                                    : 'bg-gray-200/50 dark:bg-slate-700/50'
                                }`}
                                style={{ width: `${percent}%` }}
                              />

                              <div className="relative z-10 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div
                                    className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] flex-shrink-0 ${
                                      hasVoted
                                        ? 'bg-primary-600 text-white border-primary-600'
                                        : 'border-gray-300 dark:border-slate-500'
                                    }`}
                                  >
                                    {hasVoted && '✓'}
                                  </div>
                                  <span className="text-xs font-semibold text-gray-900 dark:text-slate-100 truncate">
                                    {opt.text}
                                  </span>
                                </div>
                                <span className="text-[11px] font-bold text-gray-600 dark:text-slate-300 whitespace-nowrap">
                                  {percent}%
                                </span>
                              </div>

                              {/* Votants */}
                              {opt.voterIds.length > 0 && (
                                <div className="relative z-10 flex items-center gap-1 mt-0.5 pl-6 flex-wrap">
                                  {opt.voterIds.map((vId) => {
                                    const vProfile = profilesMap[vId];
                                    const initials = vProfile?.full_name
                                      ? vProfile.full_name.slice(0, 2).toUpperCase()
                                      : 'M';
                                    return (
                                      <span
                                        key={vId}
                                        title={vProfile?.full_name || 'Membre'}
                                        className="text-[9px] px-1.5 py-0.2 rounded-md bg-white/90 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 font-bold text-gray-700 dark:text-gray-200"
                                      >
                                        {vProfile?.full_name || initials}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between pt-1 text-[10px] text-gray-400 dark:text-slate-500">
                        <span>{totalVotes} vote{totalVotes > 1 ? 's' : ''} au total</span>
                        <span>{timeStr}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              // MESSAGE TEXTE NORMAL
              return (
                <div
                  key={m.id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start items-end gap-2'}`}
                >
                  {!isMine && (
                    <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 mb-1 shadow-xs flex items-center justify-center">
                      {sender?.avatar_url ? (
                        isPhotoUrl(sender.avatar_url) ? (
                          <img src={sender.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-orange-100 dark:bg-slate-700 flex items-center justify-center text-xs">
                            {sender.avatar_url}
                          </div>
                        )
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-orange-400 to-amber-500 text-white font-bold text-[10px] flex items-center justify-center">
                          {sender?.full_name ? sender.full_name[0].toUpperCase() : 'M'}
                        </div>
                      )}
                    </div>
                  )}

                  <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    {!isMine && (
                      <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-0.5 ml-1">
                        {sender?.full_name || 'Membre'}
                      </span>
                    )}
                    <div
                      className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm shadow-xs break-words ${
                        isMine
                          ? 'bg-primary-600 text-white rounded-br-xs'
                          : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-100 dark:border-slate-700 rounded-bl-xs'
                      }`}
                    >
                      <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                      <div
                        className={`text-[9px] mt-1 text-right ${
                          isMine ? 'text-orange-100' : 'text-gray-400 dark:text-slate-400'
                        }`}
                      >
                        {timeStr}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* BARRE INFÉRIEURE : ENVOI + QUICK EMOJIS */}
        <div className="fixed bottom-16 left-0 right-0 max-w-lg mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-gray-200 dark:border-slate-800 p-2 z-40">
          {/* BARRE RAPIDE EMOJIS ET SUGGESTIONS */}
          {showQuickBar && (
            <div className="mb-2 p-2 bg-gray-50 dark:bg-slate-800/80 rounded-2xl border border-gray-100 dark:border-slate-700 space-y-2 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-base">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSendMessage(undefined, emoji)}
                    className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition hover:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                {QUICK_PHRASES.map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() => handleSendMessage(undefined, phrase)}
                    className="whitespace-nowrap px-2.5 py-1 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-full hover:bg-orange-50 dark:hover:bg-primary-950/40 hover:text-primary-600 transition"
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={(e) => handleSendMessage(e)} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowQuickBar(!showQuickBar)}
              className={`p-2.5 rounded-full transition ${
                showQuickBar
                  ? 'bg-orange-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
              title="Suggestions rapides & emojis"
            >
              <Smile className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setShowPollModal(true)}
              className="p-2.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition"
              title="Créer un sondage"
            >
              <BarChart2 className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              placeholder="Écrivez un message..."
              className="flex-1 px-4 py-2.5 rounded-full border border-gray-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50/70 dark:bg-slate-800 dark:text-white"
            />

            <button
              type="submit"
              disabled={!newMessageText.trim()}
              className="p-2.5 bg-primary-600 text-white rounded-full hover:bg-primary-700 active:bg-primary-800 transition disabled:opacity-40 shadow-xs"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* MODAL CRÉATION DE SONDAGE */}
        {showPollModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-sm w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">Créer un sondage</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPollModal(false)}
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreatePoll} className="flex-1 flex flex-col min-h-0">
                <div className="p-4 space-y-4 overflow-y-auto flex-1">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      Question du sondage
                    </label>
                    <input
                      type="text"
                      required
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      placeholder="Ex: On mange quoi ce soir ? / Activité ce week-end ?"
                      className="w-full px-3.5 py-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      Options de réponse
                    </label>
                    <div className="space-y-2">
                      {pollOptions.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            required={idx < 2}
                            value={opt}
                            onChange={(e) => {
                              const next = [...pollOptions];
                              next[idx] = e.target.value;
                              setPollOptions(next);
                            }}
                            placeholder={`Option ${idx + 1}`}
                            className="flex-1 px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                          />
                          {pollOptions.length > 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                setPollOptions(pollOptions.filter((_, i) => i !== idx));
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-500 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {pollOptions.length < 6 && (
                      <button
                        type="button"
                        onClick={() => setPollOptions([...pollOptions, ''])}
                        className="mt-2 text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                      >
                        + Ajouter une option
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                    <input
                      type="checkbox"
                      id="pollMultipleCheck"
                      checked={pollMultiple}
                      onChange={(e) => setPollMultiple(e.target.checked)}
                      className="rounded text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor="pollMultipleCheck" className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                      Autoriser les choix multiples (plusieurs votes par personne)
                    </label>
                  </div>
                </div>

                <div className="p-3.5 bg-gray-50 dark:bg-slate-750 border-t border-gray-100 dark:border-slate-700 flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowPollModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPoll || !pollQuestion.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-xs font-bold hover:bg-primary-700 transition disabled:opacity-40 shadow-xs"
                  >
                    Publier le sondage
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- VUE 2 : LISTE DES CONVERSATIONS ---
  return (
    <div className="pb-32 bg-gray-50 dark:bg-slate-900 min-h-screen">
      <Header title="Messagerie Familiale" />

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* BANNIÈRE ACTIVATION NOTIFICATIONS */}
        {showNotifBanner && notifPermission === 'default' && (
          <div className="bg-orange-50 dark:bg-primary-950/40 border border-orange-200 dark:border-primary-800 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300 rounded-xl">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-gray-900 dark:text-white">Activez les notifications</h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Pour être prévenu instantanément des messages</p>
              </div>
            </div>
            <button
              onClick={handleEnableNotifications}
              className="px-3 py-1.5 bg-primary-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-primary-700 transition whitespace-nowrap"
            >
              Activer
            </button>
          </div>
        )}

        {/* BANNIÈRE NOUVELLE CONVERSATION */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Vos conversations</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Discussions familiales • Appui long pour supprimer
            </p>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="py-2 px-3.5 bg-primary-600 text-white font-bold rounded-xl text-xs hover:bg-primary-700 transition flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau chat</span>
          </button>
        </div>

        {/* LISTE DES CONVERSATIONS */}
        {loading ? (
          <div className="text-center py-10 text-gray-400 dark:text-slate-500 text-xs">Chargement des messages...</div>
        ) : conversations.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 p-8 text-center space-y-3">
            <MessageCircle className="w-10 h-10 text-primary-400 mx-auto" />
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">Aucune discussion pour le moment</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Créez une discussion avec la famille ou envoyez un message privé à un membre.
            </p>
            <button
              onClick={() => setShowNewModal(true)}
              className="mt-2 py-2 px-4 bg-primary-600 text-white font-bold rounded-xl text-xs"
            >
              Démarrer une discussion
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((c) => {
              const other = getOtherParticipant(c);
              const title = getConvTitle(c);
              const isCentral = isCentralFamilyConv(c);

              return (
                <div
                  key={c.id}
                  className="relative group select-none"
                  onTouchStart={(e) => startLongPress(c, e.touches[0].clientX, e.touches[0].clientY)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={cancelLongPress}
                  onTouchCancel={cancelLongPress}
                  onMouseDown={(e) => startLongPress(c, e.clientX, e.clientY)}
                  onMouseUp={cancelLongPress}
                  onMouseLeave={cancelLongPress}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (isCentral) {
                      setInfoToast("La conversation 'Toute la Famille' est la discussion centrale et ne peut pas être supprimée.");
                      setTimeout(() => setInfoToast(null), 3500);
                    } else {
                      setConvToDelete(c);
                    }
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (isLongPressActiveRef.current) {
                        isLongPressActiveRef.current = false;
                        return;
                      }
                      setActiveConv(c);
                    }}
                    className="w-full text-left bg-white dark:bg-slate-800 rounded-2xl p-3.5 border border-gray-100 dark:border-slate-700 hover:border-orange-200 dark:hover:border-slate-600 transition shadow-xs flex items-center gap-3 active:scale-[0.99]"
                  >
                    <div className="w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0 shadow-xs">
                      {other?.avatar_url && !c.name ? (
                        isPhotoUrl(other.avatar_url) ? (
                          <img src={other.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-orange-100 dark:bg-slate-700 flex items-center justify-center text-2xl">
                            {other.avatar_url}
                          </div>
                        )
                      ) : !c.name && other ? (
                        <div className="w-full h-full bg-gradient-to-tr from-orange-400 to-amber-500 text-white font-bold text-base flex items-center justify-center">
                          {other.full_name ? other.full_name[0].toUpperCase() : 'U'}
                        </div>
                      ) : (
                        <div className="w-full h-full bg-orange-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold">
                          <Users className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                            {title}
                          </h3>
                          {isCentral && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-orange-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300 flex-shrink-0">
                              Centrale
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 flex items-center gap-1 flex-shrink-0">
                          <Clock className="w-3 h-3" />
                          {new Date(c.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        Ouvrir la conversation en temps réel...
                      </p>
                    </div>
                  </button>

                  {/* Bouton poubelle rapide au survol sur PC (hors conversation centrale) */}
                  {!isCentral && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConvToDelete(c);
                      }}
                      title="Supprimer cette conversation"
                      className="hidden sm:group-hover:flex absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/60 dark:hover:bg-red-900/80 text-red-600 dark:text-red-400 transition shadow-xs items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL NOUVELLE CONVERSATION */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-sm w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold text-base text-gray-900 dark:text-white">Nouvelle discussion</h3>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3.5 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Sélectionnez les membres à inviter :
                </label>
                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-gray-100 dark:border-slate-700 rounded-2xl p-2">
                  {allProfiles
                    .filter((p) => p.id !== user?.id)
                    .map((p) => {
                      const isSelected = selectedUserIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedUserIds((prev) =>
                              isSelected ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                            );
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition ${
                            isSelected
                              ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 font-bold'
                              : 'hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <span>{p.full_name}</span>
                          <span
                            className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                              isSelected
                                ? 'bg-primary-600 text-white border-primary-600'
                                : 'border-gray-300 dark:border-slate-500'
                            }`}
                          >
                            {isSelected && '✓'}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>

              {selectedUserIds.length > 1 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Nom du groupe (optionnel) :
                  </label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Ex: Les Vacances, Projet travaux..."
                    className="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  />
                </div>
              )}
            </div>

            <div className="p-3.5 bg-gray-50 dark:bg-slate-750 border-t border-gray-100 dark:border-slate-700 flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={selectedUserIds.length === 0}
                onClick={handleCreateConversation}
                className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-xs font-bold hover:bg-primary-700 transition disabled:opacity-40 shadow-sm"
              >
                Démarrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST D'INFORMATION (ex: protection Toute la Famille) */}
      {infoToast && (
        <div className="fixed top-16 left-4 right-4 max-w-sm mx-auto p-3 rounded-2xl bg-slate-900 text-white text-xs font-semibold shadow-2xl z-[120] flex items-center gap-2.5 animate-in slide-in-from-top border border-slate-700">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="flex-1 leading-tight">{infoToast}</span>
        </div>
      )}

      {/* MODAL DE CONFIRMATION DE SUPPRESSION DE CONVERSATION */}
      {convToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[130] flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4 border border-gray-100 dark:border-slate-700 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="font-bold text-base text-gray-900 dark:text-white">
                Supprimer la conversation ?
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Voulez-vous supprimer la discussion avec{' '}
                <strong className="text-gray-900 dark:text-white font-bold">
                  {getConvTitle(convToDelete)}
                </strong>{' '}
                ? Tous les messages de ce fil seront effacés pour les participants.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConvToDelete(null)}
                disabled={isDeletingConv}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDeleteConversation}
                disabled={isDeletingConv}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50"
              >
                {isDeletingConv ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-xs text-gray-400">
          Chargement de la messagerie...
        </div>
      }
    >
      <MessagesContent />
    </Suspense>
  );
}
