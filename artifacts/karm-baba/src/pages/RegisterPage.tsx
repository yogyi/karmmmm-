import { SignUp } from "@clerk/react";
import { useLocation } from "wouter";
import logoUrl from "@assets/logo_1780688383558.png";

export function RegisterPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-2/5 bg-secondary relative overflow-hidden flex-col items-center justify-center hero-pattern px-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full translate-x-1/3 -translate-y-1/3 blur-3xl" />
        <div className="relative text-white w-full max-w-sm">
          <img src={logoUrl} alt="Karm Baba" className="h-12 mb-8 brightness-200" />
          <h2 className="font-heading text-2xl font-bold mb-2">Join Karm Baba Free</h2>
          <p className="text-white/60 text-sm mb-8 leading-relaxed">
            Create your account with Clerk — passwordless options, social login, and enterprise-grade security.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-[#f9f8f6]">
        <div className="w-full max-w-md">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="lg:hidden mb-6 flex items-center gap-2 mx-auto"
          >
            <img src={logoUrl} alt="Karm Baba" className="h-10" />
          </button>
          <SignUp
            routing="hash"
            signInUrl="/login"
            fallbackRedirectUrl="/"
            appearance={{
              elements: {
                rootBox: "mx-auto w-full",
                card: "shadow-xl border border-border rounded-2xl",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
