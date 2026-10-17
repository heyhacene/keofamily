'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckSquare,
  ShoppingCart,
  Send,
  Calendar,
  X,
  Check,
  Loader2,
  FileText,
  Square,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { supabase, isSupabaseConfigured, FamilyTask, FamilyEvent } from '@/lib/supabase';
import { loadLocalData, saveLocalData, syncKitchenCloud } from '@/lib/storage';
import { ShoppingItem } from '@/types';

export interface KeoNoteIncomingPayload {
  source?: string;
  target?: 'taches' | 'courses' | 'messages' | 'agenda';
  title: string;
  content: string;
  summary?: string;
  todos?: { text: string; completed: boolean }[];
  tags?: string[];
  createdAt?: number;
}

function autoDetectShoppingCategory(name?: string): string {
  if (!name) return 'epicerie';
  const n = String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/pomme|poire|banane|orange|citron|fraise|tomate|carotte|salade|courgette|oignon|echalote|ail|avocat|poireau|pomme de terre|champignon|concombre|poivron|haricot|herbe|persil|coriandre|basilic|epinard|legume|fruit|radis|chou|melon|pasteque|peche|abricot/i.test(n)) {
    return 'fruits_legumes';
  }
  if (/lait|beurre|creme|yaourt|fromage|gruyere|parmesan|mozzarella|creme fraiche|emmental|oeuf|comte|chevre|feta|ricotta|mascarpone/i.test(n)) {
    return 'frais_cremerie';
  }
  if (/poulet|boeuf|porc|veau|steak|viande|saumon|cabillaud|thon|crevette|jambon|dinde|lard|saucisse|poisson|bifteck|hache|escalope|merguez|chipolata/i.test(n)) {
    return 'viandes_poissons';
  }
  if (/pain|baguette|croissant|brioche|mie|biscotte|patisserie|pain au chocolat/i.test(n)) {
    return 'boulangerie';
  }
  if (/eau|jus|coca|soda|biere|vin|cafe|the|sirop|boisson|limonade|cidre/i.test(n)) {
    return 'boissons';
  }
  if (/savon|dentifrice|shampoing|gel douche|lessive|eponge|sopalin|papier toilette|vaisselle|poubelle|nettoyant|javel|coton|shampooing|adoucissant/i.test(n)) {
    return 'hygiene';
  }
  return 'epicerie';
}

export default function KeoNoteImportHandler() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [payload, setPayload] = useState<KeoNoteIncomingPayload | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<'taches' | 'courses' | 'messages' | 'agenda'>('taches');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [eventDate, setEventDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [eventTime, setEventTime] = useState<string>('18:00');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const decodeAndOpenPayload = (b64: string) => {
    try {
      const jsonStr = decodeURIComponent(escape(window.atob(b64)));
      const parsed: KeoNoteIncomingPayload = JSON.parse(jsonStr);
      if (parsed && (parsed.title || parsed.content)) {
        setPayload(parsed);
        const target = parsed.target || 'taches';
        setSelectedTarget(target);

        // Extraire les lignes/tâches sélectionnables pour Tâches ou Courses
        if (parsed.todos && parsed.todos.length > 0) {
          setSelectedItems(parsed.todos.map((t) => t.text).filter(Boolean));
        } else if (parsed.content) {
          const lines = parsed.content
            .split(/\n|•|-/)
            .map((l) => l.trim())
            .filter((l) => l.length > 1);
          setSelectedItems(lines.length > 0 ? lines : [parsed.title]);
        } else {
          setSelectedItems([parsed.title]);
        }
        setSuccessMsg(null);
      }
    } catch (err) {
      console.error('Erreur décodage import Keo Note:', err);
    }
  };

  const openFromRawText = (rawText: string, rawTitle?: string) => {
    const text = String(rawText);
    const firstLine = text.split('\n')[0]?.replace(/^[📝*\s]+|[*]+$/g, '').trim();
    const title = rawTitle || firstLine?.slice(0, 60) || 'Note importée';
    setPayload({
      source: 'android_share',
      target: 'taches',
      title,
      content: text,
      todos: [],
    });
    setSelectedTarget('taches');
    const lines = text
      .split(/\n/)
      .map((l) => l.replace(/^[•\-⬜✅📝✨📋🏷️*_]+\s*/, '').replace(/[*_]+$/, '').trim())
      .filter(
        (l) =>
          l.length > 2 &&
          !l.startsWith('Partagé depuis') &&
          !l.startsWith('— Partagé') &&
          !l.startsWith('Actions / À faire')
      );
    setSelectedItems(lines.length > 0 ? lines : [title]);
    setSuccessMsg(null);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkPendingImports = () => {
      // 1. Vérifier paramètre URL ?keonote_import=...
      const params = new URLSearchParams(window.location.search);
      const importParam = params.get('keonote_import');
      if (importParam) {
        decodeAndOpenPayload(importParam);
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
        return;
      }

      // 2. Vérifier sessionStorage & localStorage (envoyé depuis MainActivity Android Intent)
      const pendingB64 =
        sessionStorage.getItem('dar_pending_keonote_import') ||
        localStorage.getItem('dar_pending_keonote_import');
      if (pendingB64) {
        sessionStorage.removeItem('dar_pending_keonote_import');
        localStorage.removeItem('dar_pending_keonote_import');
        decodeAndOpenPayload(pendingB64);
        return;
      }

      const pendingRaw =
        sessionStorage.getItem('dar_pending_keonote_raw') ||
        localStorage.getItem('dar_pending_keonote_raw');
      if (pendingRaw) {
        sessionStorage.removeItem('dar_pending_keonote_raw');
        localStorage.removeItem('dar_pending_keonote_raw');
        try {
          const parsedRaw = JSON.parse(pendingRaw);
          openFromRawText(parsedRaw.rawText || pendingRaw, parsedRaw.title);
        } catch (_) {
          openFromRawText(pendingRaw);
        }
      }
    };

    checkPendingImports();
    const t1 = setTimeout(checkPendingImports, 600);
    const t2 = setTimeout(checkPendingImports, 1800);

    // 3. Écouter l'événement personnalisé dar:keonote-import
    const handleCustomEvent = (e: any) => {
      const b64 = e?.detail?.b64;
      if (b64) {
        sessionStorage.removeItem('dar_pending_keonote_import');
        localStorage.removeItem('dar_pending_keonote_import');
        decodeAndOpenPayload(b64);
      } else if (e?.detail?.rawText) {
        sessionStorage.removeItem('dar_pending_keonote_raw');
        localStorage.removeItem('dar_pending_keonote_raw');
        openFromRawText(e.detail.rawText, e?.detail?.title);
      }
    };

    window.addEventListener('dar:keonote-import', handleCustomEvent);
    window.addEventListener('focus', checkPendingImports);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('dar:keonote-import', handleCustomEvent);
      window.removeEventListener('focus', checkPendingImports);
    };
  }, []);

  if (!payload) return null;

  const toggleItem = (item: string) => {
    setSelectedItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const handleConfirmImport = async () => {
    setIsSaving(true);
    try {
      if (selectedTarget === 'taches') {
        const itemsToCreate = selectedItems.length > 0 ? selectedItems : [payload.title];
        const rawLocal = localStorage.getItem('dar_family_tasks');
        const existingLocal: FamilyTask[] = rawLocal ? JSON.parse(rawLocal) : [];

        const newTasks: FamilyTask[] = itemsToCreate.map((text, idx) => ({
          id: `task-keonote-${Date.now()}-${idx}`,
          title: text,
          description: payload.summary || payload.content || undefined,
          priority: 'normal',
          completed: false,
          created_by: user?.id || null,
          created_by_name: profile?.full_name || 'Keo Note',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        const updatedTasks = [...newTasks, ...existingLocal];
        localStorage.setItem('dar_family_tasks', JSON.stringify(updatedTasks));

        if (isSupabaseConfigured()) {
          for (const t of newTasks) {
            await supabase.from('family_tasks').upsert(t);
          }
        }

        setSuccessMsg(`${newTasks.length} tâche(s) ajoutée(s) à Keo Family !`);
        setTimeout(() => {
          setPayload(null);
          router.push('/taches');
          window.location.href = '/taches';
        }, 900);
      } else if (selectedTarget === 'courses') {
        const itemsToCreate = selectedItems.length > 0 ? selectedItems : [payload.title];
        const appData = loadLocalData();
        const newShoppingItems: ShoppingItem[] = itemsToCreate.map((text, idx) => ({
          id: `shop-keonote-${Date.now()}-${idx}`,
          name: text,
          quantity: 1,
          unit: '',
          category: autoDetectShoppingCategory(text),
          checked: false,
          isCustom: true,
        }));

        const updatedData = {
          ...appData,
          customShoppingItems: [...newShoppingItems, ...(appData.customShoppingItems || [])],
          lastSync: new Date().toISOString(),
        };
        saveLocalData(updatedData);
        await syncKitchenCloud(updatedData);

        setSuccessMsg(`${newShoppingItems.length} article(s) ajouté(s) à la liste de courses !`);
        setTimeout(() => {
          setPayload(null);
          router.push('/courses');
          window.location.href = '/courses';
        }, 900);
      } else if (selectedTarget === 'messages') {
        const msgLines = [`📝 **${payload.title}**`];
        if (payload.summary) msgLines.push(`_${payload.summary}_`);
        if (payload.content) msgLines.push(payload.content);
        if (payload.todos && payload.todos.length > 0) {
          msgLines.push(
            payload.todos.map((t) => `${t.completed ? '✅' : '⬜'} ${t.text}`).join('\n')
          );
        }
        const messageText = msgLines.join('\n\n');

        if (isSupabaseConfigured() && user) {
          const { data: convs } = await supabase
            .from('conversations')
            .select('id, name')
            .eq('is_group', true)
            .limit(1);

          const convId = convs?.[0]?.id;
          if (convId) {
            await supabase.from('messages').insert({
              conversation_id: convId,
              sender_id: user.id,
              content: messageText,
            });
          }
        }

        setSuccessMsg('Note publiée dans le Chat Familial !');
        setTimeout(() => {
          setPayload(null);
          router.push('/messages');
          window.location.href = '/messages';
        }, 900);
      } else if (selectedTarget === 'agenda') {
        const startIso = new Date(`${eventDate}T${eventTime || '18:00'}:00`).toISOString();
        const endIso = new Date(new Date(startIso).getTime() + 3600000).toISOString();

        if (isSupabaseConfigured()) {
          await supabase.from('events').insert({
            title: payload.title,
            description: payload.content,
            start_date: startIso,
            end_date: endIso,
            all_day: false,
            category: 'famille',
            color: '#8b5cf6',
            created_by: user?.id || null,
          });
        }

        setSuccessMsg("Événement ajouté à l'Agenda Familial !");
        setTimeout(() => {
          setPayload(null);
          router.push('/agenda');
          window.location.href = '/agenda';
        }, 900);
      }
    } catch (err) {
      console.error('Erreur import Keo Note dans Keo Family:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const allCandidateLines = Array.from(
    new Set([
      ...(payload.todos?.map((t) => t.text) || []),
      ...(payload.content
        ? payload.content
            .split(/\n/)
            .map((l) => l.trim())
            .filter((l) => l.length > 1)
        : []),
      payload.title,
    ])
  ).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 flex flex-col shadow-2xl border border-gray-150 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-6 duration-200 max-h-[90vh] overflow-y-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-xl">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">
                Note reçue depuis Keo Note
              </h3>
              <p className="text-[11px] text-gray-400 truncate max-w-[230px]">
                Choisissez où l’ajouter dans Keo Family
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setPayload(null)}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CHOIX DE LA DESTINATION */}
        <div className="grid grid-cols-4 gap-1.5 mt-4">
          <button
            type="button"
            onClick={() => setSelectedTarget('taches')}
            className={`p-2 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1 border transition ${
              selectedTarget === 'taches'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Tâches</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedTarget('courses')}
            className={`p-2 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1 border transition ${
              selectedTarget === 'courses'
                ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                : 'bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Courses</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedTarget('messages')}
            className={`p-2 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1 border transition ${
              selectedTarget === 'messages'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedTarget('agenda')}
            className={`p-2 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1 border transition ${
              selectedTarget === 'agenda'
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                : 'bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Agenda</span>
          </button>
        </div>

        {/* APERÇU & CONFIGURATION SELON LA CIBLE */}
        <div className="mt-4 space-y-3">
          <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-gray-150 dark:border-slate-700">
            <div className="font-bold text-xs text-gray-900 dark:text-white mb-1">
              {payload.title}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-line line-clamp-4">
              {payload.content}
            </p>
          </div>

          {(selectedTarget === 'taches' || selectedTarget === 'courses') && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
                {selectedTarget === 'taches'
                  ? 'Sélectionnez les tâches à ajouter :'
                  : 'Sélectionnez les articles de courses à ajouter :'}
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {allCandidateLines.map((line, i) => {
                  const isChecked = selectedItems.includes(line);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleItem(line)}
                      className={`w-full p-2 rounded-xl border text-left text-xs flex items-center gap-2 transition ${
                        isChecked
                          ? 'bg-orange-50/80 dark:bg-slate-750 border-orange-300 dark:border-amber-500/50 text-gray-900 dark:text-white font-semibold'
                          : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500'
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-orange-500 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                      <span className="truncate">{line}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedTarget === 'agenda' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-gray-500 block mb-1">Date</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 block mb-1">Heure</label>
                <input
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {successMsg && (
          <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* BOUTON DE VALIDATION */}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setPayload(null)}
            className="px-4 py-2.5 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={isSaving}
            className="flex-1 py-2.5 px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/25"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Ajout en cours...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>
                  {selectedTarget === 'taches' && 'Ajouter aux Tâches Famille'}
                  {selectedTarget === 'courses' && 'Ajouter aux Courses'}
                  {selectedTarget === 'messages' && 'Publier dans le Chat'}
                  {selectedTarget === 'agenda' && "Ajouter à l'Agenda"}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
