'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/authContext';
import { supabase, isSupabaseConfigured, Message, FamilyAlert, FamilyTask } from '@/lib/supabase';
import { sendLocalNotification } from '@/lib/notifications';
import { loadLocalData } from '@/lib/storage';

function parsePollText(content: string): string | null {
  if (!content || !content.startsWith('POLL:')) return null;
  try {
    const data = JSON.parse(content.slice(5));
    return `📊 Sondage : ${data.question}`;
  } catch {
    return '📊 Nouveau sondage';
  }
}

const FRENCH_DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'] as const;

export default function GlobalNotificationListener() {
  const { user } = useAuth();
  const profilesCache = useRef<Record<string, string>>({});
  const lastKitchenUpdateRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return;

    // 1. Précharger les noms des profils pour afficher "Sarah : ..." au lieu d'un ID
    async function loadProfileNames() {
      const { data } = await supabase.from('profiles').select('id, full_name');
      if (data) {
        data.forEach((p) => {
          profilesCache.current[p.id] = p.full_name || 'Un membre de la famille';
        });
      }
    }
    loadProfileNames();

    // 2. Écoute globale des nouveaux messages
    const messagesChannel = supabase
      .channel('global_messages_listener')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as Message;
          if (!newMsg || newMsg.sender_id === user.id) return;

          const isViewingThisConv =
            typeof window !== 'undefined' &&
            !document.hidden &&
            window.location.pathname === '/messages' &&
            window.location.search.includes(`conv=${newMsg.conversation_id}`);

          if (isViewingThisConv) return;

          const senderName = profilesCache.current[newMsg.sender_id] || 'Nouveau message familial';
          const pollText = parsePollText(newMsg.content);
          const bodyText = pollText || newMsg.content;

          sendLocalNotification(senderName, {
            body: bodyText,
            url: `/messages?conv=${newMsg.conversation_id}`,
            tag: `msg-${newMsg.conversation_id}`,
            sound: true,
          });
        }
      )
      .subscribe();

    // 3. Écoute globale des nouvelles alertes familiales
    const alertsChannel = supabase
      .channel('global_alerts_listener')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'family_alerts' },
        (payload) => {
          const newAlert = payload.new as FamilyAlert;
          if (!newAlert || newAlert.created_by === user.id || !newAlert.is_active) return;

          const levelEmoji =
            newAlert.level === 'urgent' ? '🔥 URGENT' : newAlert.level === 'warning' ? '⚠️ Attention' : 'ℹ️ Info';
          const title = `Alerte Familiale (${levelEmoji})`;

          sendLocalNotification(title, {
            body: newAlert.message,
            url: '/',
            tag: `alert-${newAlert.id}`,
            sound: true,
          });
        }
      )
      .subscribe();

    // 4. Écoute globale des tâches assignées
    const tasksChannel = supabase
      .channel('global_tasks_listener')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'family_tasks' },
        (payload) => {
          const newTask = payload.new as FamilyTask;
          if (!newTask || newTask.created_by === user.id) return;

          if (newTask.assigned_to === user.id) {
            sendLocalNotification('Nouvelle tâche assignée ! 📋', {
              body: newTask.title,
              url: '/taches',
              tag: `task-${newTask.id}`,
              sound: true,
            });
          }
        }
      )
      .subscribe();

    // 5. Écoute en temps réel des courses & cuisine partagées (family_kitchen)
    const kitchenChannel = supabase
      .channel('global_kitchen_listener')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'family_kitchen' },
        (payload) => {
          // Éviter les boucles de notification trop rapprochées (min 5s)
          const now = Date.now();
          if (now - lastKitchenUpdateRef.current < 5000) return;
          lastKitchenUpdateRef.current = now;

          // Ne pas notifier si l'utilisateur est activement sur la page courses
          if (typeof window !== 'undefined' && !document.hidden && window.location.pathname === '/courses') {
            return;
          }

          sendLocalNotification('🛒 Courses familiales synchronisées', {
            body: 'Un article a été coché ou ajouté à la liste des courses.',
            url: '/courses',
            tag: 'kitchen-sync',
            sound: true,
          });
        }
      )
      .subscribe();

    // 6. Écoute des nouveaux événements d'agenda
    const eventsChannel = supabase
      .channel('global_events_listener')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events' },
        (payload: any) => {
          const newEvent = payload.new;
          if (!newEvent || newEvent.created_by === user.id) return;

          sendLocalNotification(`📅 Nouvel événement : ${newEvent.title}`, {
            body: `Ajouté à l'agenda familial.`,
            url: '/agenda',
            tag: `event-${newEvent.id}`,
            sound: true,
          });
        }
      )
      .subscribe();

    // 7. Vérificateur périodique : Rappels des Repas du Jour & Rendez-vous
    const checkDailyReminders = () => {
      try {
        const now = new Date();
        const hour = now.getHours();
        const todayStr = now.toISOString().split('T')[0];
        const dayOfWeek = FRENCH_DAYS[now.getDay()];

        const appData = loadLocalData();
        const weeklyPlan = appData.weeklyPlan || {};
        const recipes = appData.recipes || [];

        // RAPPEL DU MIDI (11h45 - 12h45)
        if (hour === 12) {
          const key = `dar_meal_notif_midi_${todayStr}`;
          if (!localStorage.getItem(key)) {
            // Trouver le repas de midi
            const mealKey = Object.keys(weeklyPlan).find(
              (k) => k.includes(dayOfWeek) && k.endsWith('midi')
            );
            if (mealKey && weeklyPlan[mealKey]) {
              const meal = weeklyPlan[mealKey];
              const recipe = meal.recipeId ? recipes.find((r) => r.id === meal.recipeId) : null;
              const title = recipe ? recipe.title : meal.customTitle;

              if (title) {
                sendLocalNotification('🍽️ Repas du midi prévu', {
                  body: `Au menu ce midi : ${title}`,
                  url: '/planning',
                  tag: `meal-midi-${todayStr}`,
                  sound: true,
                });
                localStorage.setItem(key, 'true');
              }
            }
          }
        }

        // RAPPEL DU SOIR (18h45 - 19h45)
        if (hour === 19) {
          const key = `dar_meal_notif_soir_${todayStr}`;
          if (!localStorage.getItem(key)) {
            const mealKey = Object.keys(weeklyPlan).find(
              (k) => k.includes(dayOfWeek) && k.endsWith('soir')
            );
            if (mealKey && weeklyPlan[mealKey]) {
              const meal = weeklyPlan[mealKey];
              const recipe = meal.recipeId ? recipes.find((r) => r.id === meal.recipeId) : null;
              const title = recipe ? recipe.title : meal.customTitle;

              if (title) {
                sendLocalNotification('🍲 Repas de ce soir', {
                  body: `Au menu ce soir : ${title}`,
                  url: '/planning',
                  tag: `meal-soir-${todayStr}`,
                  sound: true,
                });
                localStorage.setItem(key, 'true');
              }
            }
          }
        }
      } catch (err) {
        console.warn('Erreur vérification rappels quotidiens:', err);
      }
    };

    // Lancer une première vérification au démarrage puis toutes les 15 minutes
    checkDailyReminders();
    const reminderInterval = setInterval(checkDailyReminders, 15 * 60 * 1000);

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(alertsChannel);
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(kitchenChannel);
      supabase.removeChannel(eventsChannel);
      clearInterval(reminderInterval);
    };
  }, [user]);

  return null;
}
