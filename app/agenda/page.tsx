'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Header from '@/components/Header';
import { useAuth } from '@/lib/authContext';
import { supabase, isSupabaseConfigured, FamilyEvent, Profile } from '@/lib/supabase';
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Check,
  CalendarDays,
  CalendarRange,
  Sun,
  X,
  Users,
  User,
  UploadCloud,
  Download,
  FileUp,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { parseICS, generateICS, ParsedICSEvent } from '@/lib/icsParser';

type CalendarViewMode = 'jour' | 'semaine' | 'mois' | 'annee';

const CATEGORIES = [
  { key: 'famille', label: 'Famille', color: 'bg-orange-500 text-white', dot: 'bg-orange-500' },
  { key: 'anniversaire', label: 'Anniversaire', color: 'bg-pink-500 text-white', dot: 'bg-pink-500' },
  { key: 'ecole', label: 'École & Enfants', color: 'bg-blue-500 text-white', dot: 'bg-blue-500' },
  { key: 'sante', label: 'Santé & RDV', color: 'bg-emerald-500 text-white', dot: 'bg-emerald-500' },
  { key: 'sortie', label: 'Sorties & Vacances', color: 'bg-purple-500 text-white', dot: 'bg-purple-500' },
  { key: 'general', label: 'Autre', color: 'bg-gray-500 text-white', dot: 'bg-gray-500' },
];

const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

function isSameDay(d1: Date, d2: Date) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function getStartOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toLocalDateString(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helpers pour l'assignation des membres encodée dans la description
function parseEventMembers(description?: string | null): string[] {
  if (!description) return [];
  const match = description.match(/<!--members:(\[.*?\])-->/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch {
      return [];
    }
  }
  return [];
}

function cleanEventDescription(description?: string | null): string {
  if (!description) return '';
  return description.replace(/<!--members:\[.*?\]-->/g, '').trim();
}

function buildEventDescription(cleanDesc: string, memberIds: string[]): string {
  const meta = memberIds.length > 0 ? `<!--members:${JSON.stringify(memberIds)}-->` : '';
  const trimmed = cleanDesc.trim();
  return meta ? `${meta} ${trimmed}`.trim() : trimmed;
}

export default function AgendaPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user && isSupabaseConfigured()) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Profils pour assignation et filtrage
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({});
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string | null>(null);

  // Vue active (Jour / Semaine / Mois / Année)
  const [viewMode, setViewMode] = useState<CalendarViewMode>('mois');

  // Date de référence actuellement sélectionnée
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Modal d'ajout d'événement
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDateStr, setStartDateStr] = useState(toLocalDateString(new Date()));
  const [startTimeStr, setStartTimeStr] = useState('10:00');
  const [allDay, setAllDay] = useState(true);
  const [category, setCategory] = useState<FamilyEvent['category']>('famille');
  const [assignedMemberIds, setAssignedMemberIds] = useState<string[]>([]);

  // Import et Export de fichiers calendriers (.ics)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedEvents, setImportedEvents] = useState<ParsedICSEvent[]>([]);
  const [selectedImportIndices, setSelectedImportIndices] = useState<number[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Charger les profils de la famille
  useEffect(() => {
    async function loadProfiles() {
      if (!isSupabaseConfigured()) {
        try {
          const rawM = localStorage.getItem('keofamily_local_members');
          if (rawM) {
            const list: Profile[] = JSON.parse(rawM);
            setProfiles(list);
            const map: Record<string, Profile> = {};
            list.forEach((p) => {
              map[p.id] = p;
            });
            setProfilesMap(map);
          }
        } catch {
          // ignore
        }
        return;
      }
      const { data } = await supabase.from('profiles').select('*').eq('status', 'approved');
      if (data) {
        setProfiles(data);
        const map: Record<string, Profile> = {};
        data.forEach((p) => {
          map[p.id] = p;
        });
        setProfilesMap(map);
      }
    }
    loadProfiles();
  }, []);

  // Charger les événements
  async function loadEvents() {
    if (!isSupabaseConfigured()) {
      try {
        const raw = localStorage.getItem('keofamily_local_events');
        if (raw) {
          setEvents(JSON.parse(raw));
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
        .from('events')
        .select('*')
        .order('start_date', { ascending: true });

      if (!error && data) {
        setEvents(data as FamilyEvent[]);
      }
    } catch (err) {
      console.error('Erreur events:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();

    if (isSupabaseConfigured()) {
      const channel = supabase
        .channel('family_events_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'events' },
          () => {
            loadEvents();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, []);

  // Ouvrir la modale d'ajout pour un jour donné
  function handleOpenAddModal(dateToPreset?: Date) {
    const target = dateToPreset || selectedDate;
    setStartDateStr(toLocalDateString(target));
    setTitle('');
    setDescription('');
    setAllDay(true);
    setCategory('famille');
    setAssignedMemberIds(user ? [user.id] : []);
    setShowAddModal(true);
  }

  // Ajouter un événement
  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !user) return;

    try {
      const fullStartDate = allDay
        ? new Date(`${startDateStr}T00:00:00`).toISOString()
        : new Date(`${startDateStr}T${startTimeStr}:00`).toISOString();

      const catObj = CATEGORIES.find((c) => c.key === category);
      const fullDescription = buildEventDescription(description, assignedMemberIds);

      if (!isSupabaseConfigured()) {
        const newEvent: FamilyEvent = {
          id: 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          title: title.trim(),
          description: fullDescription || undefined,
          start_date: fullStartDate,
          all_day: allDay,
          category,
          color: catObj?.color || '#ee7318',
          created_by: user.id,
          created_at: new Date().toISOString(),
        };
        const updated = [...events, newEvent].sort((a, b) => a.start_date.localeCompare(b.start_date));
        localStorage.setItem('keofamily_local_events', JSON.stringify(updated));
        setEvents(updated);
        setShowAddModal(false);
        return;
      }

      const { error } = await supabase.from('events').insert({
        title: title.trim(),
        description: fullDescription || null,
        start_date: fullStartDate,
        all_day: allDay,
        category,
        color: catObj?.color || '#ee7318',
        created_by: user.id,
      });

      if (error) throw error;

      setShowAddModal(false);
      loadEvents();
    } catch (err) {
      console.error(err);
    }
  }

  // Supprimer un événement
  async function handleDeleteEvent(id: string) {
    if (!confirm('Supprimer cet événement du calendrier ?')) return;
    try {
      if (!isSupabaseConfigured()) {
        const updated = events.filter((e) => e.id !== id);
        localStorage.setItem('keofamily_local_events', JSON.stringify(updated));
        setEvents(updated);
        return;
      }
      await supabase.from('events').delete().eq('id', id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  // Lecture et traitement du texte .ics
  function processICSText(text: string, fileName: string) {
    if (!text) return;
    setImportFileName(fileName);
    try {
      const parsed = parseICS(text);
      if (parsed.length === 0) {
        alert('Aucun événement valide trouvé dans ce fichier .ics.');
        return;
      }
      setImportedEvents(parsed);
      setSelectedImportIndices(parsed.map((_, i) => i)); // Sélectionner tout par défaut
      setShowImportModal(true);
    } catch (err) {
      console.error('Erreur lecture ICS:', err);
      alert('Impossible de lire ce fichier calendrier .ics.');
    }
  }

  // Lecture et traitement du fichier .ics
  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    readAndParseICS(file);
    e.target.value = '';
  }

  function readAndParseICS(file: File) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        processICSText(text, file.name);
      }
    };
    reader.readAsText(file);
  }

  // 1. Vérifier si un fichier ICS a été stocké par MainActivity (Android)
  useEffect(() => {
    if (authLoading) return;
    try {
      const pendingContent = sessionStorage.getItem('dar_pending_ics_content');
      const pendingName = sessionStorage.getItem('dar_pending_ics_name') || 'rendez-vous.ics';
      if (pendingContent) {
        sessionStorage.removeItem('dar_pending_ics_content');
        sessionStorage.removeItem('dar_pending_ics_name');
        processICSText(pendingContent, pendingName);
      }
    } catch (err) {
      console.error('Erreur lecture pending ICS sessionStorage:', err);
    }
  }, [authLoading, user]);

  // Écoute de l'ouverture de fichiers .ics via Android (Capacitor), PWA file_handlers ou Glisser-Déposer
  useEffect(() => {
    // 1. Android Capacitor Intent dispatch en temps réel
    const handleCapacitorICS = (e: any) => {
      if (e.detail?.content) {
        processICSText(e.detail.content, e.detail.name || 'rendez-vous.ics');
      }
    };
    window.addEventListener('dar:open-ics', handleCapacitorICS);

    // 2. Web / PWA LaunchQueue API
    if (typeof window !== 'undefined' && 'launchQueue' in window && (window as any).launchQueue?.setConsumer) {
      (window as any).launchQueue.setConsumer(async (launchParams: any) => {
        if (!launchParams?.files?.length) return;
        try {
          const fileHandle = launchParams.files[0];
          const file = await fileHandle.getFile();
          if (file) {
            readAndParseICS(file);
          }
        } catch (err) {
          console.error('Erreur launchQueue file handling:', err);
        }
      });
    }

    // 3. Glisser-déposer (Drag & Drop) d'un fichier .ics directement sur la page
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.name.toLowerCase().endsWith('.ics') || file.type.includes('calendar')) {
          readAndParseICS(file);
        }
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dar:open-ics', handleCapacitorICS);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);
  async function handleConfirmImport() {
    if (!user || selectedImportIndices.length === 0) return;
    setIsImporting(true);

    try {
      const toInsert = selectedImportIndices.map((idx) => {
        const evt = importedEvents[idx];
        const catObj = CATEGORIES.find((c) => c.key === evt.category);
        return {
          title: evt.title.trim(),
          description: evt.description || null,
          start_date: evt.startDate.toISOString(),
          end_date: evt.endDate ? evt.endDate.toISOString() : null,
          all_day: evt.allDay,
          category: evt.category,
          color: catObj?.color || '#ee7318',
          created_by: user.id,
        };
      });

      const { error } = await supabase.from('events').insert(toInsert);
      if (error) throw error;

      setShowImportModal(false);
      setImportedEvents([]);
      setSelectedImportIndices([]);
      await loadEvents();
      alert(`🎉 ${toInsert.length} événement(s) importé(s) avec succès dans l'agenda partagé !`);
    } catch (err: any) {
      console.error('Erreur import événements:', err);
      alert('Erreur lors de l’importation : ' + (err?.message || 'Erreur inconnue'));
    } finally {
      setIsImporting(false);
    }
  }

  // Exporter l'agenda au format standard .ics
  function handleExportICS() {
    if (events.length === 0) {
      alert('Aucun événement à exporter pour le moment.');
      return;
    }
    const icsContent = generateICS(events);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keo-family-agenda-${new Date().toISOString().slice(0, 10)}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Navigation dans le temps (Précédent / Suivant / Aujourd'hui)
  function handleNavigate(direction: -1 | 1) {
    const next = new Date(selectedDate);
    if (viewMode === 'jour') {
      next.setDate(next.getDate() + direction);
    } else if (viewMode === 'semaine') {
      next.setDate(next.getDate() + direction * 7);
    } else if (viewMode === 'mois') {
      next.setMonth(next.getMonth() + direction);
    } else if (viewMode === 'annee') {
      next.setFullYear(next.getFullYear() + direction);
    }
    setSelectedDate(next);
  }

  function handleGoToday() {
    setSelectedDate(new Date());
  }

  // Titre d'en-tête selon la vue
  const headerTitle = useMemo(() => {
    if (viewMode === 'jour') {
      return selectedDate.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
    if (viewMode === 'semaine') {
      const start = getStartOfWeek(selectedDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.getDate()} ${start.toLocaleDateString('fr-FR', { month: 'short' })} – ${end.getDate()} ${end.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`;
    }
    if (viewMode === 'mois') {
      return selectedDate.toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
      });
    }
    return String(selectedDate.getFullYear());
  }, [viewMode, selectedDate]);

  // Événements filtrés selon le membre sélectionné
  const filteredEvents = useMemo(() => {
    if (!selectedMemberFilter) return events;
    return events.filter((e) => {
      const members = parseEventMembers(e.description);
      if (members.length > 0) {
        return members.includes(selectedMemberFilter);
      }
      return e.created_by === selectedMemberFilter;
    });
  }, [events, selectedMemberFilter]);

  // Événements pour un jour précis
  function getEventsForDay(d: Date) {
    return filteredEvents.filter((e) => {
      const evtDate = new Date(e.start_date);
      return isSameDay(evtDate, d);
    });
  }

  // --- VUE MOIS : Calcul des jours de la grille ---
  const monthDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days: { date: Date; currentMonth: boolean }[] = [];

    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month, -i),
        currentMonth: false,
      });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({
        date: new Date(year, month, i),
        currentMonth: true,
      });
    }

    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        days.push({
          date: new Date(year, month + 1, i),
          currentMonth: false,
        });
      }
    }

    return days;
  }, [selectedDate]);

  // --- VUE SEMAINE : Calcul des 7 jours ---
  const weekDays = useMemo(() => {
    const start = getStartOfWeek(selectedDate);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [selectedDate]);

  // Événements du jour sélectionné
  const selectedDayEvents = useMemo(() => {
    return getEventsForDay(selectedDate);
  }, [selectedDate, filteredEvents]);

  const today = new Date();

  return (
    <div className="pb-32 bg-gray-50 dark:bg-slate-900 min-h-screen">
      <Header title="Agenda Familial" />

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* SÉLECTEUR DE VUES (Jour / Semaine / Mois / Année) */}
        <div className="flex items-center justify-between gap-2">
          <div className="grid grid-cols-4 p-1 bg-gray-200/70 dark:bg-slate-800 rounded-2xl text-xs font-bold flex-1 shadow-xs">
            <button
              onClick={() => setViewMode('jour')}
              className={`py-2 rounded-xl transition ${
                viewMode === 'jour'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Jour
            </button>
            <button
              onClick={() => setViewMode('semaine')}
              className={`py-2 rounded-xl transition ${
                viewMode === 'semaine'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Semaine
            </button>
            <button
              onClick={() => setViewMode('mois')}
              className={`py-2 rounded-xl transition ${
                viewMode === 'mois'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Mois
            </button>
            <button
              onClick={() => setViewMode('annee')}
              className={`py-2 rounded-xl transition ${
                viewMode === 'annee'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Année
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept=".ics,text/calendar"
              onChange={handleFileSelected}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="py-2 px-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 font-bold rounded-xl text-xs hover:bg-gray-50 dark:hover:bg-slate-700 transition flex items-center gap-1 shadow-xs"
              title="Importer un fichier calendrier .ics (Doctolib, Apple, Google, école...)"
            >
              <UploadCloud className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              <span className="hidden sm:inline">Importer .ics</span>
            </button>

            <button
              onClick={handleExportICS}
              className="p-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 font-bold rounded-xl text-xs hover:bg-gray-50 dark:hover:bg-slate-700 transition shadow-xs"
              title="Exporter l'agenda au format .ics"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleOpenAddModal()}
              className="py-2 px-3 bg-primary-600 text-white font-bold rounded-xl text-xs hover:bg-primary-700 transition flex items-center gap-1 shadow-xs whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Ajouter</span>
            </button>
          </div>
        </div>

        {/* FILTRE PAR MEMBRE DE LA FAMILLE */}
        {profiles.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500 whitespace-nowrap mr-1">
              Filtre :
            </span>
            <button
              onClick={() => setSelectedMemberFilter(null)}
              className={`px-3 py-1.5 rounded-full font-bold transition whitespace-nowrap text-xs shadow-2xs ${
                selectedMemberFilter === null
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              👨‍👩‍👧‍👦 Tous ({events.length})
            </button>
            {profiles.map((p) => {
              const isSelected = selectedMemberFilter === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedMemberFilter(isSelected ? null : p.id)}
                  className={`px-3 py-1.5 rounded-full font-bold transition whitespace-nowrap text-xs flex items-center gap-1.5 shadow-2xs ${
                    isSelected
                      ? 'bg-primary-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-orange-400" />
                  <span>{p.full_name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* BARRE DE NAVIGATION TEMPORELLE */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-3 shadow-xs flex items-center justify-between">
          <button
            onClick={() => handleNavigate(-1)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition text-gray-600 dark:text-gray-300"
            title="Précédent"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-center">
            <h2 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white capitalize">
              {headerTitle}
            </h2>
            <button
              onClick={handleGoToday}
              className="text-[10px] font-bold px-2 py-0.5 bg-orange-100 dark:bg-primary-950/70 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-orange-200 transition"
              title="Aller à aujourd'hui"
            >
              Aujourd'hui
            </button>
          </div>

          <button
            onClick={() => handleNavigate(1)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition text-gray-600 dark:text-gray-300"
            title="Suivant"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* VUE 1 : MOIS (MENSUEL)                                         */}
        {/* ------------------------------------------------------------- */}
        {viewMode === 'mois' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 p-3 shadow-xs">
              {/* Jours de la semaine */}
              <div className="grid grid-cols-7 mb-1 text-center">
                {WEEK_DAYS.map((wd) => (
                  <span key={wd} className="text-[11px] font-bold text-gray-400 dark:text-slate-500 py-1">
                    {wd}
                  </span>
                ))}
              </div>

              {/* Grille des jours */}
              <div className="grid grid-cols-7 gap-1">
                {monthDays.map(({ date, currentMonth }, idx) => {
                  const isSelected = isSameDay(date, selectedDate);
                  const isToday = isSameDay(date, today);
                  const dayEvents = getEventsForDay(date);

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedDate(date)}
                      className={`min-h-[46px] rounded-2xl p-1 flex flex-col items-center justify-between transition relative ${
                        isSelected
                          ? 'bg-primary-50 dark:bg-primary-950/50 border-2 border-primary-500 text-primary-900 dark:text-primary-200 font-bold'
                          : isToday
                          ? 'bg-orange-100/70 dark:bg-slate-700 text-primary-800 dark:text-primary-300 font-bold'
                          : currentMonth
                          ? 'text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-750'
                          : 'text-gray-300 dark:text-slate-600'
                      }`}
                    >
                      <span className={`text-xs ${isToday && !isSelected ? 'text-primary-700 dark:text-primary-400' : ''}`}>
                        {date.getDate()}
                      </span>

                      {/* Pastilles des événements */}
                      <div className="flex items-center justify-center gap-0.5 mt-0.5 flex-wrap max-w-full">
                        {dayEvents.slice(0, 3).map((e) => {
                          const catObj = CATEGORIES.find((c) => c.key === e.category);
                          return (
                            <span
                              key={e.id}
                              className={`w-1.5 h-1.5 rounded-full ${catObj?.dot || 'bg-orange-500'}`}
                            />
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <span className="text-[8px] text-gray-400 font-bold leading-none">+</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DÉTAIL DU JOUR SÉLECTIONNÉ */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-2">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700 dark:text-gray-300 capitalize">
                    {selectedDate.toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </h3>
                </div>
                <button
                  onClick={() => handleOpenAddModal(selectedDate)}
                  className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700"
                >
                  + Ajouter un événement
                </button>
              </div>

              {selectedDayEvents.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400 dark:text-slate-500 space-y-1">
                  <p>Aucun événement prévu pour ce jour.</p>
                  <button
                    onClick={() => handleOpenAddModal(selectedDate)}
                    className="text-primary-600 dark:text-primary-400 font-semibold underline text-xs"
                  >
                    Ajouter un rendez-vous ou une note
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDayEvents.map((evt) => {
                    const dateObj = new Date(evt.start_date);
                    const timeStr = evt.all_day
                      ? 'Journée entière'
                      : dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    const catInfo = CATEGORIES.find((c) => c.key === evt.category) || CATEGORIES[0];
                    const canDelete = isAdmin || evt.created_by === user?.id;
                    const assignedIds = parseEventMembers(evt.description);
                    const cleanDesc = cleanEventDescription(evt.description);

                    return (
                      <div
                        key={evt.id}
                        className="p-3 rounded-2xl border border-gray-100 dark:border-slate-700 flex items-start justify-between hover:border-gray-200 dark:hover:border-slate-600 transition shadow-xs bg-white dark:bg-slate-800"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${catInfo.dot}`} />
                            <h4 className="font-bold text-xs text-gray-900 dark:text-white truncate">{evt.title}</h4>
                          </div>
                          <div className="flex items-center gap-2 mt-1 pl-4 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${catInfo.color}`}>
                              {catInfo.label}
                            </span>
                            <span className="text-[10px] text-gray-400 dark:text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {timeStr}
                            </span>
                          </div>

                          {/* Membres assignés */}
                          {assignedIds.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap mt-1.5 pl-4">
                              {assignedIds.map((uid) => {
                                const p = profilesMap[uid];
                                return (
                                  <span
                                    key={uid}
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-orange-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 border border-orange-200/80 dark:border-primary-800"
                                  >
                                    👤 {p?.full_name || 'Membre'}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {cleanDesc && (
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 pl-4 truncate">{cleanDesc}</p>
                          )}
                        </div>

                        {canDelete && (
                          <button
                            onClick={() => handleDeleteEvent(evt.id)}
                            className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg transition"
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
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VUE 2 : SEMAINE (HEBDOMADAIRE)                                 */}
        {/* ------------------------------------------------------------- */}
        {viewMode === 'semaine' && (
          <div className="space-y-3">
            {weekDays.map((dayDate) => {
              const dayEvts = getEventsForDay(dayDate);
              const isToday = isSameDay(dayDate, today);
              const dayName = dayDate.toLocaleDateString('fr-FR', { weekday: 'long' });
              const dayNum = dayDate.getDate();
              const monthShort = dayDate.toLocaleDateString('fr-FR', { month: 'short' });

              return (
                <div
                  key={dayDate.toISOString()}
                  className={`bg-white dark:bg-slate-800 rounded-2xl border p-3.5 shadow-xs transition ${
                    isToday
                      ? 'border-primary-300 dark:border-primary-600 ring-1 ring-primary-100 dark:ring-primary-900'
                      : 'border-gray-100 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-gray-50 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-xs capitalize ${isToday ? 'text-primary-700 dark:text-primary-400' : 'text-gray-900 dark:text-white'}`}>
                        {dayName} {dayNum} {monthShort}
                      </span>
                      {isToday && (
                        <span className="px-1.5 py-0.2 rounded-md bg-orange-100 dark:bg-primary-950/70 text-primary-700 dark:text-primary-300 text-[10px] font-bold">
                          Aujourd'hui
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleOpenAddModal(dayDate)}
                      className="p-1 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
                      title="Ajouter pour ce jour"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="pt-2">
                    {dayEvts.length === 0 ? (
                      <p className="text-[11px] text-gray-400 dark:text-slate-500 italic">Rien de prévu</p>
                    ) : (
                      <div className="space-y-1.5">
                        {dayEvts.map((evt) => {
                          const dateObj = new Date(evt.start_date);
                          const timeStr = evt.all_day
                            ? 'Journée'
                            : dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                          const catInfo = CATEGORIES.find((c) => c.key === evt.category) || CATEGORIES[0];
                          const canDelete = isAdmin || evt.created_by === user?.id;
                          const assignedIds = parseEventMembers(evt.description);

                          return (
                            <div
                              key={evt.id}
                              className="flex items-center justify-between p-2 rounded-xl bg-gray-50/70 dark:bg-slate-750 border border-gray-100 dark:border-slate-700"
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-2 flex-wrap">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${catInfo.dot}`} />
                                <span className="text-xs font-bold text-gray-900 dark:text-white truncate">{evt.title}</span>
                                <span className="text-[10px] text-gray-400 dark:text-slate-400 whitespace-nowrap">({timeStr})</span>
                                {assignedIds.length > 0 && (
                                  <div className="flex items-center gap-1">
                                    {assignedIds.map((uid) => {
                                      const p = profilesMap[uid];
                                      return (
                                        <span
                                          key={uid}
                                          className="text-[8px] font-bold px-1 py-0.2 bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-slate-600"
                                        >
                                          {p?.full_name?.slice(0, 2).toUpperCase() || 'M'}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                              {canDelete && (
                                <button
                                  onClick={() => handleDeleteEvent(evt.id)}
                                  className="text-gray-300 hover:text-red-500 p-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VUE 3 : JOUR (JOURNALIER)                                      */}
        {/* ------------------------------------------------------------- */}
        {viewMode === 'jour' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white capitalize">
                    {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{selectedDayEvents.length} événement(s) programmé(s)</p>
                </div>
                <button
                  onClick={() => handleOpenAddModal(selectedDate)}
                  className="py-2 px-3 bg-primary-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs hover:bg-primary-700"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajouter</span>
                </button>
              </div>

              {selectedDayEvents.length === 0 ? (
                <div className="text-center py-12 text-gray-400 dark:text-slate-500 space-y-2">
                  <Sun className="w-10 h-10 text-amber-300 mx-auto animate-pulse" />
                  <p className="text-xs font-medium">Journée libre, aucun engagement noté.</p>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {selectedDayEvents.map((evt) => {
                    const dateObj = new Date(evt.start_date);
                    const timeStr = evt.all_day
                      ? 'Toute la journée'
                      : dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    const catInfo = CATEGORIES.find((c) => c.key === evt.category) || CATEGORIES[0];
                    const canDelete = isAdmin || evt.created_by === user?.id;
                    const assignedIds = parseEventMembers(evt.description);
                    const cleanDesc = cleanEventDescription(evt.description);

                    return (
                      <div
                        key={evt.id}
                        className="p-4 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-xs flex items-start justify-between bg-gradient-to-r from-white to-orange-50/20 dark:from-slate-800 dark:to-slate-800/80"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${catInfo.color}`}>
                              {catInfo.label}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {timeStr}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white">{evt.title}</h4>

                          {/* Membres assignés */}
                          {assignedIds.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                              {assignedIds.map((uid) => {
                                const p = profilesMap[uid];
                                return (
                                  <span
                                    key={uid}
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-primary-950/50 text-primary-800 dark:text-primary-300 border border-orange-200 dark:border-primary-800 flex items-center gap-1"
                                  >
                                    <User className="w-3 h-3" />
                                    <span>{p?.full_name || 'Membre'}</span>
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {cleanDesc && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed pt-1">{cleanDesc}</p>
                          )}
                        </div>

                        {canDelete && (
                          <button
                            onClick={() => handleDeleteEvent(evt.id)}
                            className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg transition"
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
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VUE 4 : ANNÉE (ANNUEL)                                         */}
        {/* ------------------------------------------------------------- */}
        {viewMode === 'annee' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {MONTHS_FR.map((monthName, monthIndex) => {
                const year = selectedDate.getFullYear();
                const firstDay = new Date(year, monthIndex, 1);
                const lastDay = new Date(year, monthIndex + 1, 0);

                const monthEvents = filteredEvents.filter((e) => {
                  const d = new Date(e.start_date);
                  return d.getFullYear() === year && d.getMonth() === monthIndex;
                });

                return (
                  <button
                    key={monthName}
                    type="button"
                    onClick={() => {
                      setSelectedDate(new Date(year, monthIndex, 1));
                      setViewMode('mois');
                    }}
                    className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-3 shadow-xs hover:border-primary-300 dark:hover:border-primary-600 transition text-left flex flex-col justify-between min-h-[105px]"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-gray-900 dark:text-white">{monthName}</span>
                        {monthEvents.length > 0 && (
                          <span className="px-1.5 py-0.2 rounded-md bg-orange-100 dark:bg-primary-950/70 text-primary-700 dark:text-primary-300 text-[10px] font-bold">
                            {monthEvents.length}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500">
                        {lastDay.getDate()} jours
                      </p>
                    </div>

                    <div className="mt-2 pt-2 border-t border-gray-50 dark:border-slate-700 flex items-center justify-between text-[10px] text-primary-600 dark:text-primary-400 font-semibold">
                      <span>Voir le mois</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MODAL AJOUT D'ÉVÉNEMENT */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-sm w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold text-base text-gray-900 dark:text-white">Ajouter à l'agenda</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEvent} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-4 space-y-3.5 overflow-y-auto flex-1">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Titre de l'événement
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: RDV Dentiste Lina, Anniversaire..."
                    className="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  />
                </div>

                {/* MEMBRES ASSIGNÉS */}
                {profiles.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Membres concernés
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (assignedMemberIds.length === profiles.length) {
                            setAssignedMemberIds([]);
                          } else {
                            setAssignedMemberIds(profiles.map((p) => p.id));
                          }
                        }}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition ${
                          assignedMemberIds.length === profiles.length && profiles.length > 0
                            ? 'bg-orange-100 border-primary-500 text-primary-800 dark:bg-primary-950/60 dark:text-primary-300'
                            : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        👨‍👩‍👧‍👦 Toute la famille
                      </button>
                      {profiles.map((p) => {
                        const isAssigned = assignedMemberIds.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setAssignedMemberIds((prev) =>
                                isAssigned ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                              );
                            }}
                            className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                              isAssigned
                                ? 'bg-primary-50 border-primary-500 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300'
                                : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                            }`}
                          >
                            <span>{p.full_name}</span>
                            {isAssigned && <Check className="w-3 h-3 text-primary-600 dark:text-primary-400" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Catégorie
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setCategory(cat.key as any)}
                        className={`p-2 rounded-xl text-[11px] font-bold border text-left transition flex items-center justify-between ${
                          category === cat.key
                            ? 'border-primary-500 bg-orange-50 dark:bg-primary-950/40 text-primary-800 dark:text-primary-300'
                            : 'border-gray-100 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span>{cat.label}</span>
                        {category === cat.key && <Check className="w-3 h-3 text-primary-600 dark:text-primary-400" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={startDateStr}
                      onChange={(e) => setStartDateStr(e.target.value)}
                      className="w-full px-2.5 py-1.5 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500 bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    />
                  </div>
                  {!allDay && (
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">Heure</label>
                      <input
                        type="time"
                        value={startTimeStr}
                        onChange={(e) => setStartTimeStr(e.target.value)}
                        className="w-full px-2.5 py-1.5 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500 bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="allDayCheck"
                    checked={allDay}
                    onChange={(e) => setAllDay(e.target.checked)}
                    className="rounded text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="allDayCheck" className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                    Toute la journée
                  </label>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Notes (optionnel)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Lieu, détails..."
                    className="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500 bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                  />
                </div>
              </div>

              {/* FOOTER TOUJOURS VISIBLE ET CLICABLE */}
              <div className="p-3.5 bg-gray-50 dark:bg-slate-750 border-t border-gray-100 dark:border-slate-700 flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-xs font-bold hover:bg-primary-700 transition shadow-sm"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL D'IMPORTATION DE FICHIER .ICS */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            {/* Header de la modale */}
            <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between flex-shrink-0 bg-primary-50/50 dark:bg-primary-950/20">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold">
                  <FileUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Importer dans l'agenda
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[240px]">
                    {importFileName || 'Fichier .ics'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Barre de sélection globale */}
            <div className="px-4 py-2 bg-gray-50 dark:bg-slate-750 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between text-xs flex-shrink-0">
              <span className="text-gray-600 dark:text-gray-300 font-medium">
                {importedEvents.length} événement{importedEvents.length > 1 ? 's' : ''} trouvé{importedEvents.length > 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (selectedImportIndices.length === importedEvents.length) {
                    setSelectedImportIndices([]);
                  } else {
                    setSelectedImportIndices(importedEvents.map((_, i) => i));
                  }
                }}
                className="text-primary-600 dark:text-primary-400 font-bold hover:underline"
              >
                {selectedImportIndices.length === importedEvents.length
                  ? 'Tout désélectionner'
                  : 'Tout sélectionner'}
              </button>
            </div>

            {/* Liste défilable des événements */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
              {importedEvents.map((evt, idx) => {
                const isChecked = selectedImportIndices.includes(idx);
                const catObj = CATEGORIES.find((c) => c.key === evt.category);
                const dateDisplay = evt.startDate.toLocaleDateString('fr-FR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });
                const timeDisplay = evt.allDay
                  ? 'Journée entière'
                  : `${String(evt.startDate.getHours()).padStart(2, '0')}:${String(
                      evt.startDate.getMinutes()
                    ).padStart(2, '0')}`;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedImportIndices((prev) =>
                        prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                      );
                    }}
                    className={`p-3 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
                      isChecked
                        ? 'border-primary-500 bg-orange-50/40 dark:bg-primary-950/20'
                        : 'border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-750 opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="mt-1 rounded text-primary-600 focus:ring-primary-500 pointer-events-none"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            catObj?.color || 'bg-gray-500 text-white'
                          }`}
                        >
                          {catObj?.label || 'Autre'}
                        </span>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 font-medium">
                          <Clock className="w-3 h-3" />
                          {dateDisplay} • {timeDisplay}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs text-gray-900 dark:text-white truncate">
                        {evt.title}
                      </h4>
                      {evt.location && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                          📍 {evt.location}
                        </p>
                      )}
                      {evt.description && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                          {evt.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer de la modale */}
            <div className="p-3.5 bg-gray-50 dark:bg-slate-750 border-t border-gray-100 dark:border-slate-700 flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                disabled={isImporting}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isImporting || selectedImportIndices.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-xs font-bold hover:bg-primary-700 disabled:opacity-50 transition shadow-sm flex items-center justify-center gap-1.5"
              >
                {isImporting ? (
                  <span>Importation en cours...</span>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Importer ({selectedImportIndices.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
