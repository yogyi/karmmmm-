import type { ReactNode } from "react";
import { useLocation } from "wouter";
import logoUrl from "@assets/logo_1780688383558.png";
import { cn } from "@/lib/utils";

export type BuyerVerifyStep = {
  id: string;
  label: string;
};

export function BuyerVerifyLayout({
  email,
  title,
  subtitle,
  steps,
  activeStep,
  children,
}: {
  email?: string | null;
  title: string;
  subtitle?: string;
  steps?: BuyerVerifyStep[];
  activeStep?: string;
  children: ReactNode;
}) {
  const [, navigate] = useLocation();
  const activeIdx = steps?.findIndex((s) => s.id === activeStep) ?? -1;

  return (
    <div className="min-h-screen flex flex-col kb-page">
      <header className="border-b border-border/60 bg-white/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto w-full px-6 py-4 flex items-center justify-between gap-4">
          <button type="button" onClick={() => navigate("/")} className="shrink-0">
            <img src={logoUrl} alt="Karm Baba" className="h-9" />
          </button>
          {email ? (
            <span className="text-sm text-muted-foreground truncate">{email}</span>
          ) : null}
        </div>
      </header>

      <main className="flex-1 px-4 py-8 sm:py-12">
        <div className="max-w-2xl mx-auto w-full">
          <div className="text-center mb-8 sm:mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
              Buyer verification
            </p>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-lg mx-auto">
                {subtitle}
              </p>
            ) : null}
          </div>

          {steps && steps.length > 0 && activeIdx >= 0 ? (
            <nav aria-label="Verification progress" className="mb-8">
              <ol className="flex items-center justify-center gap-2 sm:gap-0">
                {steps.map((step, i) => {
                  const done = i < activeIdx;
                  const current = i === activeIdx;
                  return (
                    <li key={step.id} className="flex items-center">
                      <div className="flex flex-col items-center gap-1.5 min-w-[4.5rem] sm:min-w-[5.5rem]">
                        <span
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold border-2 transition-colors",
                            done && "bg-primary border-primary text-white",
                            current && "border-primary text-primary bg-primary/10",
                            !done && !current && "border-border text-muted-foreground bg-white",
                          )}
                        >
                          {done ? "✓" : i + 1}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] sm:text-xs font-medium text-center leading-tight",
                            current ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {step.label}
                        </span>
                      </div>
                      {i < steps.length - 1 ? (
                        <div
                          className={cn(
                            "hidden sm:block w-12 lg:w-16 h-0.5 mx-1 mb-5",
                            i < activeIdx ? "bg-primary" : "bg-border",
                          )}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </nav>
          ) : null}

          <div className="kb-card p-6 sm:p-8 shadow-sm">{children}</div>

          <p className="text-center text-xs text-muted-foreground mt-6 leading-relaxed">
            No document uploads · No video calls · Same buyer login worldwide
          </p>
        </div>
      </main>
    </div>
  );
}
