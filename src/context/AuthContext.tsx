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

export interface PermisosRol {
  accesoAdmin: boolean;
  verCapas: boolean;
  editarCapas: boolean;
  verLineas: boolean;
  editarLineas: boolean;
  verRutas: boolean;
  editarRutas: boolean;
  gestionarGrupos: boolean;
  gestionarUsuarios: boolean;
}

export interface DbUser {
  id: string;
  firebaseUid: string;
  email: string;
  nombre: string | null;
  rol: string;
  creadoEn: string;
  permisos?: PermisosRol;
}

interface AuthContextType {
  user: User | null;
  dbUser: DbUser | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (e: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  dbUser: null,
  loading: true,
  loginWithGoogle: async () => {},
  loginWithEmail: async () => {},
  logout: async () => {},
  getIdToken: async () => '',
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);

  const isBypass = process.env.NEXT_PUBLIC_BYPASS_FIREBASE === 'true' || 
                   process.env.NEXT_PUBLIC_FIREBASE_API_KEY === 'AIzaSyPlaceholder...';

  useEffect(() => {
    if (isBypass) {
      const savedUser = localStorage.getItem('gis_lanus_mock_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        // Sync with db
        fetch('/api/auth/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: parsed.uid,
            email: parsed.email,
            nombre: parsed.displayName,
          }),
        })
          .then(res => {
            if (res.ok) return res.json();
            throw new Error('Sync failed');
          })
          .then(data => setDbUser(data))
          .catch(err => console.error("Error syncing mock user:", err))
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
      return;
    }

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
  }, [isBypass]);

  const loginWithGoogle = async () => {
    if (isBypass) {
      const mockUser = {
        uid: 'dev-google-uid-123',
        email: 'julianmcancelo@gmail.com',
        displayName: 'Julian Cancelo (Dev)',
        emailVerified: true,
      };
      localStorage.setItem('gis_lanus_mock_user', JSON.stringify(mockUser));
      setUser(mockUser as any);
      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: mockUser.uid,
          email: mockUser.email,
          nombre: mockUser.displayName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDbUser(data);
      }
      return;
    }

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error logging in with Google:", error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    if (isBypass) {
      const mockUser = {
        uid: `dev-email-uid-${email.replace(/[^a-zA-Z0-9]/g, '')}`,
        email: email,
        displayName: email.split('@')[0],
        emailVerified: true,
      };
      localStorage.setItem('gis_lanus_mock_user', JSON.stringify(mockUser));
      setUser(mockUser as any);
      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: mockUser.uid,
          email: mockUser.email,
          nombre: mockUser.displayName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDbUser(data);
      }
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error("Error logging in with Email:", error);
      throw error;
    }
  };

  const getIdToken = async (): Promise<string> => {
    if (isBypass) return 'bypass-token';
    if (!user) throw new Error('No hay usuario autenticado');
    return user.getIdToken();
  };

  const logout = async () => {
    if (isBypass) {
      localStorage.removeItem('gis_lanus_mock_user');
      setUser(null);
      setDbUser(null);
      return;
    }

    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error logging out:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, dbUser, loading, loginWithGoogle, loginWithEmail, logout, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
