import { useEffect, useState } from "react";
import {
  currencyFromCountry,
  detectDefaultCurrency,
  type TrialCurrency,
} from "@/lib/trialPricing";
import { guessUserCountry } from "@/lib/guessCountry";

export function useTrialCurrency() {
  const [currency, setCurrency] = useState<TrialCurrency>(detectDefaultCurrency);
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void guessUserCountry().then((country) => {
      if (cancelled) return;
      if (country) {
        setCurrency(currencyFromCountry(country));
      }
      setDetected(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { currency, setCurrency, detected };
}
