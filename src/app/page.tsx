"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function HomePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClientComponentClient(), []);

  useEffect(() => {
    let active = true;

    const redirectToDestination = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;
      router.replace(user ? "/dashboard" : "/login");
    };

    redirectToDestination();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 text-gray-700">
      <p>Redirecting...</p>
    </main>
  );
}
