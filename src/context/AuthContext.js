import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  setTokens,
  getAccessToken,
  getStoredUser,
  setStoredUser,
  clearTokens,
  clearStoredUser,
  getRefreshToken,
} from "../services/tokenStore";
import {
  login as loginService,
  register as registerService,
  logout as logoutService,
  hydrateUserFromToken,
} from "../services/authService";
import { setCurrentAlias, setShiftStart } from "../services/userStore";
import { ROLES } from "../constants/roles";

const LOG = "[AuthCtx]";
const AuthContext = createContext(null);

/**
 * Read access_token and stored user from secure storage.
 * Mirrors the previous AppNavigator bootstrap so behaviour is unchanged.
 * @returns {Promise<{ user: object | null, token: string | null }>}
 */
async function readSession() {
  try {
    await hydrateUserFromToken();
    const [token, stored] = await Promise.all([getAccessToken(), getStoredUser()]);
    if (token && stored) {
      return { user: stored, token };
    }
    return { user: null, token: null };
  } catch (e) {
    console.warn(`${LOG} readSession error:`, e?.message || e);
    return { user: null, token: null };
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      console.log(`${LOG} bootstrapping...`);
      const { user: stored } = await readSession();
      if (!mounted) return;
      if (stored) {
        setUser({ userId: stored.userId, email: stored.email });
        setRole(stored.role);
        setCurrentAlias(stored.alias || "");
        if (stored.role === ROLES.OFFICER) setShiftStart(Date.now());
        console.log(`${LOG} user ready:`, stored.role, stored.alias || "no alias");
      } else {
        console.log(`${LOG} no stored session`);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  /**
   * After a successful REST login/register, persist tokens + user and
   * update React state so AppNavigator re-renders past the AuthStack.
   */
  const signIn = useCallback(async (sessionUser) => {
    try {
      await setStoredUser(sessionUser);
      if (sessionUser?.alias) setCurrentAlias(sessionUser.alias);
      if (sessionUser?.role === ROLES.OFFICER) setShiftStart(Date.now());
    } catch (e) {
      console.warn(`${LOG} signIn persist error:`, e?.message || e);
    }
    setUser({ userId: sessionUser.userId, email: sessionUser.email });
    setRole(sessionUser.role);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logoutService();
    } catch (e) {
      console.warn(`${LOG} signOut error:`, e?.message || e);
    }
    setUser(null);
    setRole(null);
  }, []);

  const value = useMemo(
    () => ({ user, role, loading, signIn, signOut }),
    [user, role, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

export { loginService, registerService };