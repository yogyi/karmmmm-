import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import App from "./App";
import "./index.css";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  console.warn(
    "Missing VITE_CLERK_PUBLISHABLE_KEY — add your Clerk key to .env (see .env.example)",
  );
}

createRoot(document.getElementById("root")!).render(
  <ClerkProvider
    publishableKey={publishableKey ?? ""}
    afterSignOutUrl="/"
    signInUrl="/login"
    signUpUrl="/register"
  >
    <App />
  </ClerkProvider>,
);
