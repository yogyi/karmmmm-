import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { OnboardingGate } from "@/components/OnboardingGate";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HomePage } from "@/pages/HomePage";
import { ProductsPage } from "@/pages/ProductsPage";
import { ProductDetailPage } from "@/pages/ProductDetailPage";
import { SuppliersPage } from "@/pages/SuppliersPage";
import { SupplierDetailPage } from "@/pages/SupplierDetailPage";
import { RfqNewPage } from "@/pages/RfqNewPage";
import { RfqListPage } from "@/pages/RfqListPage";
import { RfqDetailPage } from "@/pages/RfqDetailPage";
import { ShortlistPage } from "@/pages/ShortlistPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { BuyerCentralPage } from "@/pages/BuyerCentralPage";
import { SellerVerificationPage } from "@/pages/SellerVerificationPage";
import { SellerLeadsPage } from "@/pages/SellerLeadsPage";
import { SellerShopPlansPage } from "@/pages/SellerShopPlansPage";
import { ShareProfilePage } from "@/pages/ShareProfilePage";
import { PrivacyPage, TermsPage, RefundPage } from "@/pages/LegalPages";
import { ProfilePage } from "@/pages/ProfilePage";
import { DashboardPage } from "@/pages/DashboardPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-primary focus:text-white focus:px-3 focus:py-2 focus:rounded-lg focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>
      <Header />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </div>
  );
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <PageLayout><HomePage /></PageLayout>} />
      <Route path="/products" component={() => <PageLayout><ProductsPage /></PageLayout>} />
      <Route path="/products/:id" component={({ params }) => <PageLayout><ProductDetailPage params={params} /></PageLayout>} />
      <Route path="/suppliers" component={() => <PageLayout><SuppliersPage /></PageLayout>} />
      <Route path="/suppliers/:id" component={({ params }) => <PageLayout><SupplierDetailPage params={params} /></PageLayout>} />
      <Route path="/rfq/new" component={() => <PageLayout><RfqNewPage /></PageLayout>} />
      <Route path="/rfq/:id" component={({ params }) => <PageLayout><RfqDetailPage params={params} /></PageLayout>} />
      <Route path="/rfq" component={() => <PageLayout><RfqListPage /></PageLayout>} />
      <Route path="/shortlist" component={() => <PageLayout><ShortlistPage /></PageLayout>} />
      <Route path="/buyer" component={() => <PageLayout><BuyerCentralPage /></PageLayout>} />
      <Route path="/seller/verify" component={() => <PageLayout><SellerVerificationPage /></PageLayout>} />
      <Route path="/seller/leads" component={() => <PageLayout><SellerLeadsPage /></PageLayout>} />
      <Route path="/seller/plans" component={() => <PageLayout><SellerShopPlansPage /></PageLayout>} />
      <Route path="/account" component={() => <PageLayout><ProfilePage /></PageLayout>} />
      <Route path="/seller" component={() => <PageLayout><DashboardPage /></PageLayout>} />
      <Route path="/dashboard" component={() => <PageLayout><DashboardPage /></PageLayout>} />
      <Route path="/s/:slug" component={({ params }) => <PageLayout><ShareProfilePage params={params} /></PageLayout>} />
      <Route path="/privacy" component={() => <PageLayout><PrivacyPage /></PageLayout>} />
      <Route path="/terms" component={() => <PageLayout><TermsPage /></PageLayout>} />
      <Route path="/refund" component={() => <PageLayout><RefundPage /></PageLayout>} />
      <Route path="/onboarding" component={() => <AuthLayout><OnboardingPage /></AuthLayout>} />
      <Route path="/login" component={() => <AuthLayout><LoginPage /></AuthLayout>} />
      <Route path="/register" component={() => <AuthLayout><RegisterPage /></AuthLayout>} />
      <Route component={() => <PageLayout><NotFoundPage /></PageLayout>} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MotionConfig reducedMotion="user">
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <OnboardingGate />
              <Router />
            </WouterRouter>
            <Toaster />
          </AuthProvider>
        </MotionConfig>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
