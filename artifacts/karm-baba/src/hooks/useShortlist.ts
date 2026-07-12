import { useCallback, useEffect, useState } from "react";

const KEY = "kb_shortlist";

function readIds(): number[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

export function useShortlist() {
  const [ids, setIds] = useState<number[]>(() =>
    typeof window === "undefined" ? [] : readIds(),
  );

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(ids));
  }, [ids]);

  const toggle = useCallback((productId: number) => {
    setIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId],
    );
  }, []);

  const has = useCallback((productId: number) => ids.includes(productId), [ids]);

  const clear = useCallback(() => setIds([]), []);

  return { ids, toggle, has, clear, count: ids.length };
}
