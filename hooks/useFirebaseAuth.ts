import { 
  getAuth, 
  onIdTokenChanged, 
  User, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  getRedirectResult
} from "firebase/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import app from "../firebaseConfig";

export default function useFirebaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth(app);

    // Capture and handle the result of the redirect flow on mount
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log("Successfully logged in via redirect:", result.user);
          setUser(result.user);
        }
      })
      .catch((error) => {
        console.error("Error finalizing redirect sign-in:", error);
      });

    // onIdTokenChanged is critical for Convex auth syncing handshakes
    return onIdTokenChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });
  }, []);

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (!user) return null;
      return await user.getIdToken(forceRefreshToken);
    },
    [user]
  );

  const loginWithGoogle = useCallback(async () => {
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google popup:", error);
    }
  }, []);

  const logout = useCallback(async () => {
    const auth = getAuth(app);
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }, []);

  return useMemo(
    () => ({
      isLoading,
      isAuthenticated: !!user,
      user,
      fetchAccessToken,
      loginWithGoogle,
      logout,
    }),
    [isLoading, user, fetchAccessToken, loginWithGoogle, logout]
  );
}
