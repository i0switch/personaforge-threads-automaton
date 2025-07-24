
import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  console.log('AuthProvider initialized'); // デバッグ用ログ追加
  
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let initialLoadComplete = false;
    console.log('Setting up auth state listener');

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log('Auth state change:', event, session?.user?.id);
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Always update loading state on auth changes
        if (mounted) {
          setLoading(false);
          initialLoadComplete = true;
        }
      }
    );

    // Check for existing session
    const initializeAuth = async () => {
      try {
        console.log('Checking for existing session');
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting session:', error);
          if (mounted && !initialLoadComplete) {
            setLoading(false);
          }
          return;
        }
        
        if (mounted && !initialLoadComplete) {
          console.log('Found existing session:', !!session);
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
          initialLoadComplete = true;
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted && !initialLoadComplete) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      console.log('Cleaning up auth listener');
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    try {
      console.log('Attempting signup for:', email); // デバッグ用ログ追加
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: displayName
          }
        }
      });
      console.log('Signup result:', error ? 'error' : 'success'); // デバッグ用ログ追加
      return { error };
    } catch (error) {
      console.error('Signup error:', error); // デバッグ用ログ追加
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Attempting signin for:', email); // デバッグ用ログ追加
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      console.log('Signin result:', error ? 'error' : 'success'); // デバッグ用ログ追加
      return { error };
    } catch (error) {
      console.error('Signin error:', error); // デバッグ用ログ追加
      return { error };
    }
  };

  const signOut = async () => {
    try {
      console.log('Attempting signout'); // デバッグ用ログ追加
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Handle specific error cases
        if (error.message.includes('session_not_found') || 
            error.message.includes('Session not found')) {
          // Session already invalid, just clear local state
          setSession(null);
          setUser(null);
          return;
        }
        throw error;
      }
      
      // Clear local state on successful sign out
      setSession(null);
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      // On any error, clear local state to prevent inconsistent state
      setSession(null);
      setUser(null);
      throw error;
    }
  };

  const value = {
    user,
    session,
    signUp,
    signIn,
    signOut,
    loading,
  };

  console.log('AuthProvider rendering with user:', !!user, 'loading:', loading); // デバッグ用ログ追加

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
