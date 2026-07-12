import { useLocation } from "wouter";
import { Home } from "lucide-react";

export function NotFoundPage() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-8xl font-black text-primary/20 mb-4">404</div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Page Not Found</h1>
        <p className="text-muted-foreground mb-6">The page you are looking for does not exist.</p>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl font-medium hover:bg-primary/90 transition-colors mx-auto"
        >
          <Home size={16} /> Go Home
        </button>
      </div>
    </div>
  );
}
