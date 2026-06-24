'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

export interface DbUser {
  id: string;
  firebaseUid: string;
  email: string;
  nombre: string | null;
  rol: string;
  creadoEn: string;
}

interface AuthContextType {
  user: User | null;
  dbUser: DbUser | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (e: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  dbUser: null,
  loading: true,
  loginWithGoogle: async () => {},
  loginWithEmail: async () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const res = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uid: currentUser.uid,
              email: currentUser.email,
              nombre: currentUser.displayName,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            setDbUser(data);
          }
        } catch (error) {
          console.error("Error al sincronizar con la base de datos", error);
        }
      } else {
        setDbUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error logging in with Google:", error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error("Error logging in with Email:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error logging out:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, dbUser, loading, loginWithGoogle, loginWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
