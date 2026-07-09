"use client";

import { useEffect } from "react";
import { useIdentityStore } from "@/store/useIdentityStore";

export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useIdentityStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return <>{children}</>;
}
