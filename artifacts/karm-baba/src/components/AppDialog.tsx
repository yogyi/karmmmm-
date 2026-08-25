import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AlertOptions = {
  title?: string;
  message: string;
  okLabel?: string;
};

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style confirm as a destructive action (red). */
  destructive?: boolean;
};

type DialogRequest =
  | {
      kind: "alert";
      title: string;
      message: string;
      okLabel: string;
      resolve: () => void;
    }
  | {
      kind: "confirm";
      title: string;
      message: string;
      confirmLabel: string;
      cancelLabel: string;
      destructive: boolean;
      resolve: (ok: boolean) => void;
    };

type AppDialogApi = {
  alert: (opts: AlertOptions | string) => Promise<void>;
  confirm: (opts: ConfirmOptions | string) => Promise<boolean>;
};

const AppDialogContext = createContext<AppDialogApi | null>(null);

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const settledRef = useRef(false);

  const close = useCallback(() => {
    setRequest(null);
  }, []);

  const settle = useCallback(
    (fn: () => void) => {
      if (settledRef.current) return;
      settledRef.current = true;
      fn();
      setRequest(null);
    },
    [],
  );

  const alert = useCallback(
    async (opts: AlertOptions | string) => {
      const normalized =
        typeof opts === "string"
          ? { title: "Notice", message: opts, okLabel: "OK" }
          : {
              title: opts.title ?? "Notice",
              message: opts.message,
              okLabel: opts.okLabel ?? "OK",
            };
      return new Promise<void>((resolve) => {
        settledRef.current = false;
        setRequest({
          kind: "alert",
          ...normalized,
          resolve: () => resolve(),
        });
      });
    },
    [],
  );

  const confirm = useCallback(async (opts: ConfirmOptions | string) => {
    const normalized =
      typeof opts === "string"
        ? {
            title: "Please confirm",
            message: opts,
            confirmLabel: "Confirm",
            cancelLabel: "Cancel",
            destructive: false,
          }
        : {
            title: opts.title ?? "Please confirm",
            message: opts.message,
            confirmLabel: opts.confirmLabel ?? "Confirm",
            cancelLabel: opts.cancelLabel ?? "Cancel",
            destructive: opts.destructive ?? false,
          };
    return new Promise<boolean>((resolve) => {
      settledRef.current = false;
      setRequest({
        kind: "confirm",
        ...normalized,
        resolve: (ok) => resolve(ok),
      });
    });
  }, []);

  const api = useMemo(() => ({ alert, confirm }), [alert, confirm]);

  return (
    <AppDialogContext.Provider value={api}>
      {children}
      <AlertDialog
        open={request != null}
        onOpenChange={(open) => {
          if (!open && request) {
            settle(() => {
              if (request.kind === "confirm") request.resolve(false);
              else request.resolve();
            });
          }
        }}
      >
        {request && (
          <AlertDialogContent className="rounded-2xl sm:rounded-2xl max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-heading text-left">
                {request.title}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-left whitespace-pre-wrap">
                {request.message}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              {request.kind === "confirm" ? (
                <>
                  <AlertDialogCancel
                    onClick={() => settle(() => request.resolve(false))}
                    className="rounded-xl min-h-11"
                  >
                    {request.cancelLabel}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => settle(() => request.resolve(true))}
                    className={
                      request.destructive
                        ? "rounded-xl min-h-11 bg-red-600 hover:bg-red-700 focus:ring-red-600"
                        : "rounded-xl min-h-11"
                    }
                  >
                    {request.confirmLabel}
                  </AlertDialogAction>
                </>
              ) : (
                <AlertDialogAction
                  onClick={() => settle(() => request.resolve())}
                  className="rounded-xl min-h-11"
                >
                  {request.okLabel}
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </AppDialogContext.Provider>
  );
}

export function useAppDialog(): AppDialogApi {
  const ctx = useContext(AppDialogContext);
  if (!ctx) {
    // Soft fallback so HMR never crashes — prefer provider in App.
    return {
      alert: async (opts) => {
        const message = typeof opts === "string" ? opts : opts.message;
        // eslint-disable-next-line no-alert
        window.alert(message);
      },
      confirm: async (opts) => {
        const message = typeof opts === "string" ? opts : opts.message;
        // eslint-disable-next-line no-alert
        return window.confirm(message);
      },
    };
  }
  return ctx;
}
