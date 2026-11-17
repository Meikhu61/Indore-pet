import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAP_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { clampStr, SCHEMA_LIMITS, UserPrivate, UserProfile } from '../types/domain';
import { fetchUserPrivate } from '../services/firestoreService';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  privateInfo: UserPrivate | null;
  isAdmin: boolean;
  isBootstrapAdmin: boolean;
  authReady: boolean;
  signingIn: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshPrivateInfo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [privateInfo, setPrivateInfo] = useState<UserPrivate | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBootstrapAdmin, setIsBootstrapAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const syncUserDocuments = useCallback(async (firebaseUser: User) => {
    const uid = firebaseUser.uid;
    const bootstrapAdmin =
      Boolean(firebaseUser.emailVerified) &&
      firebaseUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;

    let adminDocExists = false;
    if (!bootstrapAdmin) {
      try {
        const adminSnap = await getDoc(doc(db, 'admins', uid));
        adminDocExists = adminSnap.exists();
      } catch {
        adminDocExists = false;
      }
    }

    const userIsAdmin = bootstrapAdmin || adminDocExists;
    setIsBootstrapAdmin(bootstrapAdmin);
    setIsAdmin(userIsAdmin);

    const displayName = clampStr(
      firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'A1 Customer',
      SCHEMA_LIMITS.CUSTOMER_NAME_MAX
    );
    const initials = computeInitials(displayName);
    const profileRef = doc(db, 'user_profiles', uid);
    const privateRef = doc(db, 'user_private', uid);

    try {
      const profileSnap = await getDoc(profileRef);
      if (!profileSnap.exists()) {
        await setDoc(profileRef, {
          uid,
          displayName,
          avatarInitials: initials,
          role: userIsAdmin ? 'admin' : 'customer',
          isPublicProfile: true,
          totalBookings: 0,
          completedBookings: 0,
          cancelledBookings: 0,
          tradeInCount: 0,
          totalProjectedValue: 0,
          preferredBrand: 'all',
          lastActiveAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(profileRef, {
          displayName,
          avatarInitials: initials,
          lastActiveAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const freshSnap = await getDoc(profileRef);
      if (freshSnap.exists()) {
        const d = freshSnap.data();
        setProfile({
          uid: String(d.uid || uid),
          displayName: String(d.displayName || displayName),
          avatarInitials: String(d.avatarInitials || initials),
          role: d.role === 'admin' ? 'admin' : 'customer',
          isPublicProfile: true,
          totalBookings: Number(d.totalBookings || 0),
          completedBookings: Number(d.completedBookings || 0),
          cancelledBookings: Number(d.cancelledBookings || 0),
          tradeInCount: Number(d.tradeInCount || 0),
          totalProjectedValue: Number(d.totalProjectedValue || 0),
          preferredBrand: d.preferredBrand || 'all',
        });
      }
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.WRITE, `user_profiles/${uid}`);
      } catch (wrapped) {
        console.error(wrapped);
      }
    }

    try {
      const privSnap = await getDoc(privateRef);
      const safeEmail = clampStr(firebaseUser.email || 'user@a1mobile.local', 160);
      if (!privSnap.exists()) {
        await setDoc(privateRef, {
          uid,
          email: safeEmail,
          phone: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      const privData = await fetchUserPrivate(uid);
      setPrivateInfo(privData);
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.WRITE, `user_private/${uid}`);
      } catch (wrapped) {
        console.error(wrapped);
      }
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await syncUserDocuments(firebaseUser);
        setUser(firebaseUser);
      } else {
        setUser(null);
        setProfile(null);
        setPrivateInfo(null);
        setIsAdmin(false);
        setIsBootstrapAdmin(false);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [syncUserDocuments]);

  const signInWithGoogle = useCallback(async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to sign in with Google.';
      setAuthError(msg);
    } finally {
      setSigningIn(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setAuthError(null);
    await signOut(auth);
  }, []);

  const refreshPrivateInfo = useCallback(async () => {
    if (!user) return;
    const data = await fetchUserPrivate(user.uid);
    setPrivateInfo(data);
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        privateInfo,
        isAdmin,
        isBootstrapAdmin,
        authReady,
        signingIn,
        authError,
        signInWithGoogle,
        logout,
        refreshPrivateInfo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
