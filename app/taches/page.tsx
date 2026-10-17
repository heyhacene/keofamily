'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/Header';
import { useAuth } from '@/lib/authContext';
import { supabase, isSupabaseConfigured, Profile, FamilyTask } from '@/lib/supabase';
import {
  CheckSquare,
  Plus,
  Trash2,
  Users,
  CheckCircle2,
  Circle,
  AlertCircle,
  Calendar,
  Filter,
  Sparkles,
  WifiOff,
} from 'lucide-react';

const TASKS_LOCAL_STORAGE_KEY = 'dar_family_tasks';
const PENDING_TASKS_SYNC_KEY = 'dar_pending_tasks_sync';

function isPhotoUrl(url?: string): boolean {
  return Boolean(url && (url.startsWith('data:image') || url.startsWith('http')));
}

export default function TachesPage() {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<FamilyTask[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  // Formulaire d'ajout rapide
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [assignedToId, setAssignedToId] = useState<string>('all'); // 'all' = personne en particulier
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [dueDate, setDueDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtres
  const [filterAssignee, setFilterAssignee] = useState<string>('all'); // 'all', 'me', 'unassigned', or specific userId
  const [filterStatus, setFilterStatus] = useState<'todo' | 'done' | 'all'>('todo');

  // 1. Chargement du cache local
  function loadLocalTasks(): FamilyTask[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(TASKS_LOCAL_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveLocalTasks(items: FamilyTask[]) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(TASKS_LOCAL_STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }

  // Synchronisation des tâches en attente quand le réseau revient
  async function flushTasksOfflineQueue() {
    if (typeof window === 'undefined' || !isSupabaseConfigured()) return;
    try {
      const pendingRaw = localStorage.getItem(PENDING_TASKS_SYNC_KEY);
      if (!pendingRaw) return;
      const pendingList: FamilyTask[] = JSON.parse(pendingRaw);
      if (pendingList && pendingList.length > 0) {
        for (const t of pendingList) {
          await supabase.from('family_tasks').upsert(t);
        }
        localStorage.removeItem(PENDING_TASKS_SYNC_KEY);
      }
    } catch (e) {
      console.warn('Erreur flush tasks offline queue:', e);
    }
  }

  // 2. Chargement depuis Supabase
  async function fetchCloudTasks() {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    try {
      flushTasksOfflineQueue().catch(() => {});

      const { data, error } = await supabase
        .from('family_tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setTasks(data as FamilyTask[]);
        saveLocalTasks(data as FamilyTask[]);
      }
    } catch (err) {
      console.warn('Erreur chargement tâches cloud, fallback local:', err);
    } finally {
      setLoading(false);
    }
  }

  // Charger la liste des membres pour l'affectation
  async function fetchProfiles() {
    if (!isSupabaseConfigured()) {
      try {
        const rawM = localStorage.getItem('keofamily_local_members');
        if (rawM) {
          setProfiles(JSON.parse(rawM));
        }
      } catch {
        // ignore
      }
      return;
    }
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('status', 'approved')
        .order('full_name', { ascending: true });

      if (data) {
        setProfiles(data as Profile[]);
      }
    } catch (err) {
      console.warn('Erreur chargement profils:', err);
    }
  }

  useEffect(() => {
    // Immédiat depuis le stockage local
    const local = loadLocalTasks();
    if (local.length > 0) {
      setTasks(local);
    }

    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine);
      const onOnline = () => {
        setIsOffline(false);
        fetchCloudTasks();
      };
      const onOffline = () => {
        setIsOffline(true);
      };
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);

      fetchProfiles();
      fetchCloudTasks();

      // Écoute temps réel
      if (isSupabaseConfigured()) {
        const channel = supabase
          .channel('family_tasks_realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'family_tasks' },
            () => {
              fetchCloudTasks();
            }
          )
          .subscribe();

        return () => {
          window.removeEventListener('online', onOnline);
          window.removeEventListener('offline', onOffline);
          supabase.removeChannel(channel);
        };
      }

      return () => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      };
    }
  }, []);

  // 3. Actions utilisateur
  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setIsSubmitting(true);

    const isUnassigned = assignedToId === 'all';
    const targetProfile = !isUnassigned ? profiles.find((p) => p.id === assignedToId) : null;

    const newTask: FamilyTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: newTaskTitle.trim(),
      assigned_to: isUnassigned ? null : assignedToId,
      assigned_name: targetProfile ? targetProfile.full_name : undefined,
      assigned_avatar: targetProfile?.avatar_url || undefined,
      priority,
      due_date: dueDate || null,
      completed: false,
      created_by: user?.id || null,
      created_by_name: profile?.full_name || 'Membre de la famille',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Mise à jour locale synchrone immédiate
    const updated = [newTask, ...tasks];
    setTasks(updated);
    saveLocalTasks(updated);

    setNewTaskTitle('');
    setDueDate('');
    setIsSubmitting(false);

    // Synchronisation Supabase
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('family_tasks').insert(newTask);
        if (error) throw error;
      } catch (err) {
        console.warn('Mise en attente tâche hors-ligne:', err);
        try {
          const currentPending = JSON.parse(localStorage.getItem(PENDING_TASKS_SYNC_KEY) || '[]');
          localStorage.setItem(PENDING_TASKS_SYNC_KEY, JSON.stringify([...currentPending, newTask]));
        } catch {}
      }
    }
  }

  async function toggleTask(task: FamilyTask) {
    const nextCompleted = !task.completed;
    const nowIso = new Date().toISOString();

    const updatedTask: FamilyTask = {
      ...task,
      completed: nextCompleted,
      completed_at: nextCompleted ? nowIso : null,
      completed_by: nextCompleted ? user?.id : null,
      updated_at: nowIso,
    };

    // Mise à jour locale immédiate
    const updated = tasks.map((t) => (t.id === task.id ? updatedTask : t));
    setTasks(updated);
    saveLocalTasks(updated);

    // Sync cloud
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('family_tasks')
          .update({
            completed: nextCompleted,
            completed_at: nextCompleted ? nowIso : null,
            completed_by: nextCompleted ? user?.id : null,
            updated_at: nowIso,
          })
          .eq('id', task.id);

        if (error) throw error;
      } catch (err) {
        console.warn('Hors-ligne : mise à jour tâche enregistrée localement');
      }
    }
  }

  async function deleteTask(taskId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const updated = tasks.filter((t) => t.id !== taskId);
    setTasks(updated);
    saveLocalTasks(updated);

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('family_tasks').delete().eq('id', taskId);
      } catch (err) {
        console.warn('Erreur suppression tâche Supabase:', err);
      }
    }
  }

  // Filtrage des tâches affichées
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // 1. Filtre état (à faire vs terminées)
      if (filterStatus === 'todo' && t.completed) return false;
      if (filterStatus === 'done' && !t.completed) return false;

      // 2. Filtre affectation
      if (filterAssignee === 'all') return true;
      if (filterAssignee === 'me') return t.assigned_to === user?.id;
      if (filterAssignee === 'unassigned') return !t.assigned_to;
      return t.assigned_to === filterAssignee;
    });
  }, [tasks, filterStatus, filterAssignee, user]);

  const todoCount = useMemo(() => tasks.filter((t) => !t.completed).length, [tasks]);
  const doneCount = useMemo(() => tasks.filter((t) => t.completed).length, [tasks]);

  return (
    <div className="pb-32 bg-gray-50 dark:bg-slate-900 min-h-screen">
      <Header title="Tâches Familiales" onRefresh={fetchCloudTasks} />

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* BANNIÈRE HORS-LIGNE SI BESOIN */}
        {isOffline && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-3 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2.5 shadow-xs animate-in fade-in">
            <WifiOff className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1">
              <span className="font-bold">Mode hors-ligne :</span> Vous pouvez consulter et cocher vos tâches. Elles sont enregistrées sur votre appareil et seront synchronisées au retour du réseau.
            </div>
          </div>
        )}

        {/* FORMULAIRE AJOUT RAPIDE DE TÂCHE */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 border border-gray-100 dark:border-slate-700 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-bold text-xs">
            <Plus className="w-4 h-4" />
            <span>Nouvelle tâche pour la famille</span>
          </div>

          <form onSubmit={handleCreateTask} className="space-y-3">
            <div>
              <input
                type="text"
                required
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Ex: Sortir la poubelle, Acheter des piles, Appeler le plombier..."
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-700/80 border border-gray-200 dark:border-slate-600 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {/* SÉLECTEUR D'AFFECTATION */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                  Affecter à :
                </label>
                <select
                  value={assignedToId}
                  onChange={(e) => setAssignedToId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl text-xs font-semibold text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">👥 Personne en particulier (Tout le monde)</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      👤 {p.full_name} {p.id === user?.id ? '(Moi)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* PRIORITÉ & ÉCHÉANCE */}
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Priorité :
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-2 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl text-xs font-semibold text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="normal">Normale</option>
                    <option value="high">🔥 Urgente</option>
                    <option value="low">🌱 Faible</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Échéance :
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl text-xs text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !newTaskTitle.trim()}
              className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter la tâche</span>
            </button>
          </form>
        </div>

        {/* BARRE D'ONGLETS / STATUTS : À FAIRE vs TERMINÉES */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center p-1 bg-gray-200/70 dark:bg-slate-800 rounded-2xl text-xs font-bold shadow-xs">
            <button
              type="button"
              onClick={() => setFilterStatus('todo')}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                filterStatus === 'todo'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span>À faire</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300">
                {todoCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('done')}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                filterStatus === 'done'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span>Terminées</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-gray-100 dark:bg-slate-600 text-gray-600 dark:text-gray-300">
                {doneCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1.5 rounded-xl transition ${
                filterStatus === 'all'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Toutes
            </button>
          </div>
        </div>

        {/* FILTRE PAR MEMBRE DE LA FAMILLE */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setFilterAssignee('all')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition border ${
              filterAssignee === 'all'
                ? 'bg-primary-600 text-white border-primary-600 shadow-xs'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-750'
            }`}
          >
            Tous les membres
          </button>

          {user && (
            <button
              type="button"
              onClick={() => setFilterAssignee('me')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition border flex items-center gap-1.5 ${
                filterAssignee === 'me'
                  ? 'bg-primary-600 text-white border-primary-600 shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-750'
              }`}
            >
              <span>Mes tâches</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setFilterAssignee('unassigned')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition border flex items-center gap-1.5 ${
              filterAssignee === 'unassigned'
                ? 'bg-primary-600 text-white border-primary-600 shadow-xs'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-750'
            }`}
          >
            <span>👥 Pour tous</span>
          </button>

          {profiles.map((p) => {
            const isSelected = filterAssignee === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setFilterAssignee(p.id)}
                className={`px-2.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition border flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-primary-600 text-white border-primary-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-750'
                }`}
              >
                <div className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center text-[9px] bg-orange-100 dark:bg-slate-700 flex-shrink-0">
                  {p.avatar_url && isPhotoUrl(p.avatar_url) ? (
                    <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{p.full_name ? p.full_name[0].toUpperCase() : 'U'}</span>
                  )}
                </div>
                <span>{p.full_name}</span>
              </button>
            );
          })}
        </div>

        {/* LISTE DES TÂCHES */}
        <div className="space-y-2">
          {filteredTasks.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 text-center border border-gray-100 dark:border-slate-700 shadow-xs space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 mx-auto flex items-center justify-center">
                <CheckSquare className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-gray-800 dark:text-white">
                {filterStatus === 'done'
                  ? 'Aucune tâche terminée'
                  : 'Toutes les tâches sont terminées ! 🎉'}
              </h3>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                {filterStatus === 'done'
                  ? 'Les tâches que vous cochez apparaîtront ici.'
                  : 'Ajoutez une nouvelle tâche ci-dessus pour vous ou un membre de la famille.'}
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isUrgent = task.priority === 'high';
              const isLow = task.priority === 'low';
              const assignedUser = task.assigned_to
                ? profiles.find((p) => p.id === task.assigned_to)
                : null;
              const assignedName = assignedUser?.full_name || task.assigned_name;
              const assignedAvatar = assignedUser?.avatar_url || task.assigned_avatar;

              return (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task)}
                  className={`group w-full text-left bg-white dark:bg-slate-800 rounded-2xl p-3.5 border transition shadow-xs flex items-center gap-3 cursor-pointer ${
                    task.completed
                      ? 'border-gray-100 dark:border-slate-800/80 bg-gray-50/70 dark:bg-slate-850/60 opacity-60'
                      : 'border-gray-200 dark:border-slate-700 hover:border-orange-200 dark:hover:border-slate-600'
                  }`}
                >
                  {/* CHECKBOX */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTask(task);
                    }}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
                      task.completed
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-gray-300 dark:border-slate-600 group-hover:border-primary-500'
                    }`}
                  >
                    {task.completed && <CheckCircle2 className="w-4 h-4" />}
                  </button>

                  {/* CONTENU TÂCHE */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p
                        className={`text-sm font-semibold text-gray-900 dark:text-white leading-tight break-words ${
                          task.completed ? 'line-through text-gray-400 dark:text-slate-500' : ''
                        }`}
                      >
                        {task.title}
                      </p>

                      {/* BADGE PRIORITÉ */}
                      {isUrgent && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-bold flex items-center gap-0.5">
                          <AlertCircle className="w-3 h-3" />
                          Urgent
                        </span>
                      )}
                    </div>

                    {/* DÉTAILS D'AFFECTATION & ÉCHÉANCE */}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px] text-gray-500 dark:text-gray-400">
                      {/* AFFECTATION */}
                      {task.assigned_to ? (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 font-medium">
                          <div className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center text-[8px] bg-orange-200 dark:bg-primary-800 flex-shrink-0">
                            {assignedAvatar && isPhotoUrl(assignedAvatar) ? (
                              <img src={assignedAvatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span>{assignedName ? assignedName[0].toUpperCase() : 'U'}</span>
                            )}
                          </div>
                          <span className="truncate max-w-[120px]">{assignedName}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 font-medium">
                          <Users className="w-3 h-3" />
                          <span>Pour tous</span>
                        </div>
                      )}

                      {/* ÉCHÉANCE */}
                      {task.due_date && (
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-slate-400">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {new Date(task.due_date).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* BOUTON SUPPRIMER */}
                  <button
                    type="button"
                    onClick={(e) => deleteTask(task.id, e)}
                    className="p-2 text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-slate-700 rounded-xl transition flex-shrink-0"
                    title="Supprimer la tâche"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
