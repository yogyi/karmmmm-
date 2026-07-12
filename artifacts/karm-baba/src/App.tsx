import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
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
      <Header />
      <main className="flex-1">{children}</main>
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
      <Route path="/dashboard" component={() => <PageLayout><DashboardPage /></PageLayout>} />
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
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
