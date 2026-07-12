import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
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
  clerkId?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
  isLoggedIn: boolean;
  isLoaded: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, getToken, userId } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const [user, setUser] = useState<AuthUser | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!isSignedIn) {
      setUser(null);
      return;
    }
    const profile = await syncProfile(getToken);
    setUser(profile);
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
      return;
    }
    void refreshProfile();
  }, [isLoaded, isSignedIn, userId, clerkUser?.id, refreshProfile]);

  const login = useCallback((userData: AuthUser) => {
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    void signOut({ redirectUrl: "/" });
  }, [signOut]);

  const fallbackUser: AuthUser | null =
    isSignedIn && clerkUser
      ? {
          id: user?.id ?? 0,
          name:
            user?.name ??
            ([clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
              clerkUser.primaryEmailAddress?.emailAddress ||
              "User"),
          email: user?.email ?? clerkUser.primaryEmailAddress?.emailAddress ?? "",
          role: user?.role ?? "buyer",
          company: user?.company ?? null,
          avatarUrl: user?.avatarUrl ?? clerkUser.imageUrl ?? null,
          supplierId: user?.supplierId ?? null,
          clerkId: userId,
        }
      : user;

  return (
    <AuthContext.Provider
      value={{
        user: fallbackUser,
        login,
        logout,
        isLoggedIn: !!isSignedIn,
        isLoaded,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
