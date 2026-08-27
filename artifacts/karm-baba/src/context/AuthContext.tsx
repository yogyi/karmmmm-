import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type Context,
  type ReactNode,
} from "react";
import {
  useAuth as useClerkAuth,
  useUser,
  useClerk,
} from "@clerk/react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "buyer" | "seller" | "admin";
  company?: string | null;
  avatarUrl?: string | null;
  supplierId?: number | null;
  onboardingCompleted?: boolean;
  /** Set up buyer side — required (with sellerEnabled) for free role switch. */
  buyerEnabled?: boolean;
  /** Set up seller side — required (with buyerEnabled) for free role switch. */
  sellerEnabled?: boolean;
  clerkId?: string | null;
  buyerCountry?: string | null;
  buyerCompanyEmail?: string | null;
  buyerCompanyEmailVerified?: boolean;
  buyerWhatsapp?: string | null;
  buyerWhatsappVerified?: boolean;
  buyerRegistrationNumber?: string | null;
  buyerWebsite?: string | null;
  buyerKycCompleted?: boolean;
  buyerKycCompletedAt?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
  isLoggedIn: boolean;
  isLoaded: boolean;
  /** True once Clerk is loaded and (if signed in) profile sync finished. */
  profileReady: boolean;
  refreshProfile: () => Promise<void>;
}

const AUTH_CONTEXT_KEY = "__karmbaba_auth_context__";

/**
 * Keep a single Context identity across Vite HMR. Otherwise AuthProvider can
 * publish on an old Context while useAuth reads a newly created one → null crash.
 */
function getAuthContext(): Context<AuthContextType | null> {
  const g = globalThis as typeof globalThis & {
    [AUTH_CONTEXT_KEY]?: Context<AuthContextType | null>;
  };
  if (!g[AUTH_CONTEXT_KEY]) {
    g[AUTH_CONTEXT_KEY] = createContext<AuthContextType | null>(null);
  }
  return g[AUTH_CONTEXT_KEY];
}

const AuthContext = getAuthContext();

/** Exported for soft reads (e.g. OnboardingGate) during Vite HMR context splits. */
export { AuthContext };

async function syncProfile(getToken: () => Promise<string | null>): Promise<AuthUser | null> {
  const token = await getToken();
  if (!token) return null;

  const res = await fetch("/api/users/sync", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    console.error("Failed to sync Clerk user", await res.text());
    return null;
  }

  return (await res.json()) as AuthUser;
}

const guestAuth: AuthContextType = {
  user: null,
  login: () => undefined,
  logout: () => undefined,
  isLoggedIn: false,
  isLoaded: false,
  profileReady: false,
  refreshProfile: async () => undefined,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, getToken, userId } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profileReady, setProfileReady] = useState(false);

  const refreshProfile = useCallback(async () => {
    if (!isSignedIn) {
      setUser(null);
      setProfileReady(true);
      return;
    }
    const profile = await syncProfile(getToken);
    setUser(profile);
    setProfileReady(true);
  }, [isSignedIn, getToken]);

  useEffect(() => {
    setAuthTokenGetter(async () => {
      if (!isSignedIn) return null;
      return getToken();
    });
    return () => setAuthTokenGetter(null);
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !userId) {
      setUser(null);
      setProfileReady(true);
      return;
    }
    setProfileReady(false);
    void refreshProfile();
  }, [isLoaded, isSignedIn, userId, clerkUser?.id, refreshProfile]);

  const login = useCallback((userData: AuthUser) => {
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    void signOut({ redirectUrl: "/" });
  }, [signOut]);

  // Only use the synced API profile. Do not invent role/onboarding defaults from Clerk
  // when sync fails — that forced buyers into wrong portals and onboarding loops.
  const displayUser: AuthUser | null = user
    ? {
        ...user,
        name:
          user.name ||
          ([clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ").trim() ||
            clerkUser?.primaryEmailAddress?.emailAddress ||
            user.email ||
            "User"),
        email: user.email || clerkUser?.primaryEmailAddress?.emailAddress || "",
        avatarUrl: user.avatarUrl || clerkUser?.imageUrl || null,
        clerkId: user.clerkId ?? userId,
      }
    : null;

  return (
    <AuthContext.Provider
      value={{
        user: displayUser,
        login,
        logout,
        isLoggedIn: !!isSignedIn,
        isLoaded,
        profileReady,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  // Soft fallback: Vite HMR can briefly desync Context identity before full reload.
  if (!ctx) return guestAuth;
  return ctx;
}
