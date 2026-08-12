import { useLocation } from "wouter";

export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [, navigate] = useLocation();
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <button
        type="button"
        onClick={() => navigate("/")}
        className="text-sm text-primary font-medium mb-6 hover:underline"
      >
        ← Back to marketplace
      </button>
      <h1 className="font-heading text-3xl font-bold mb-4">{title}</h1>
      <div className="prose prose-sm text-muted-foreground space-y-3 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        Karm Baba collects account, business, and inquiry details you submit so buyers and
        sellers can connect on the marketplace. We use this information to operate RFQs, CRM
        leads, verification, and support.
      </p>
      <p>
        We do not sell personal data. Access is limited to your counterparties on a need-to-know
        basis (for example, a seller seeing a buyer inquiry you sent). Contact{" "}
        <a href="mailto:karm@karmbaba.com" className="text-primary">
          karm@karmbaba.com
        </a>{" "}
        for privacy requests.
      </p>
      <p className="text-xs">Last updated: August 2026</p>
    </LegalPage>
  );
}

export function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        By using Karm Baba you agree to provide accurate business information, respect other
        users, and use the platform only for lawful B2B trade. Listings, RFQs, and quotes are
        between buyers and sellers; Karm Baba is a marketplace facilitator, not a party to every
        transaction.
      </p>
      <p>
        We may suspend accounts that abuse the platform, misrepresent GST/company details, or
        attempt unauthorized access. Paid plans may be provisioned for testing until billing is
        enabled.
      </p>
      <p className="text-xs">Last updated: August 2026</p>
    </LegalPage>
  );
}

export function RefundPage() {
  return (
    <LegalPage title="Refund Policy">
      <p>
        Marketplace browsing, RFQs, and Free shop plans are free. When paid subscriptions go
        live, refunds for unused prepaid periods will follow the plan terms shown at checkout.
      </p>
      <p>
        Until payment gateway launch, provisional plan upgrades are for testing and are not
        charged. Email{" "}
        <a href="mailto:karm@karmbaba.com" className="text-primary">
          karm@karmbaba.com
        </a>{" "}
        for billing questions.
      </p>
      <p className="text-xs">Last updated: August 2026</p>
    </LegalPage>
  );
}
