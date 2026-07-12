import { SignIn } from "@clerk/react";
import { useLocation } from "wouter";
import logoUrl from "@assets/logo_1780688383558.png";

export function LoginPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-secondary relative overflow-hidden items-center justify-center hero-pattern">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 rounded-full translate-x-1/3 -translate-y-1/3 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/15 rounded-full -translate-x-1/4 translate-y-1/4 blur-3xl" />
        <div className="relative text-center text-white px-12">
          <img src={logoUrl} alt="Karm Baba" className="h-16 mx-auto mb-6 brightness-200" />
          <h2 className="font-heading text-3xl font-bold mb-4 leading-tight">
            India's Largest
            <br />
            B2B Marketplace
          </h2>
          <p className="text-white/65 leading-relaxed mb-8">
            Secure sign-in powered by Clerk. Connect with verified manufacturers and wholesalers.
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
          <SignIn
            routing="hash"
            signUpUrl="/register"
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
