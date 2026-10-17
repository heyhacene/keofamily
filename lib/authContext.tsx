'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured, Profile } from './supabase';
import { User } from '@supabase/supabase-js';

export const LOCAL_PROFILE_STORAGE_KEY = 'keofamily_local_profile';
export const LOCAL_MEMBERS_STORAGE_KEY = 'keofamily_local_members';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isApproved: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isApproved: false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadLocalProfile = () => {
    if (typeof window === 'undefined') return false;
    try {
      const raw = localStorage.getItem(LOCAL_PROFILE_STORAGE_KEY);
      if (raw) {
        const prof: Profile = JSON.parse(raw);
        setProfile(prof);
        setUser({ id: prof.id, email: prof.email } as any);
        return true;
      }
    } catch (_) {}
    return false;
  };

  async function fetchProfile(userId: string) {
    if (!isSupabaseConfigured()) {
      loadLocalProfile();
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setProfile(data as Profile);
      }
    } catch (err) {
      console.error('Erreur chargement profil:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      loadLocalProfile();
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id);
      } else {
        loadLocalProfile();
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id);
      } else if (!loadLocalProfile()) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOCAL_PROFILE_STORAGE_KEY);
    }
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (isSupabaseConfigured() && user) {
      await fetchProfile(user.id);
    } else {
      loadLocalProfile();
    }
  };

  const value = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    isApproved: profile?.status === 'approved',
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
