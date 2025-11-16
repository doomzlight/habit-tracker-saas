"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [firstName, setFirstName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      const { data, error } = await supabase.auth.getUser();

      if (error) {
        setErrorMessage("Unable to load your session. Please try signing in again.");
        setLoading(false);
        return;
      }

      if (!data.user) {
        router.push("/login");
        return;
      }

      const name =
        typeof data.user.user_metadata?.first_name === "string"
          ? data.user.user_metadata.first_name
          : null;

      setFirstName(name);
      setErrorMessage("");
      setLoading(false);
    };

    fetchUser();
  }, [router, supabase]);

  const greetingName = firstName?.trim() || "there";

  return (
    <main className="min-h-screen bg-linear-to-br from-slate-900 via-slate-950 to-slate-900 text-white flex items-center justify-center px-4">
      <div className="relative w-full max-w-3xl">
        <div className="absolute inset-0 rounded-3xl bg-linear-to-r from-blue-500/40 via-purple-500/40 to-cyan-500/40 blur-3xl" />
        <div className="relative rounded-3xl bg-slate-900/70 backdrop-blur-lg border border-white/10 shadow-2xl p-10">
          <div className="flex flex-col gap-4">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-300/70">Dashboard</p>
            <h1 className="text-4xl font-bold leading-tight">
              {loading ? (
                <span className="text-slate-200">Loading your space...</span>
              ) : (
                <>
                  Hey, <span className="text-transparent bg-clip-text bg-linear-to-r from-cyan-300 via-blue-300 to-purple-300">{greetingName}</span>
                </>
              )}
            </h1>
            <p className="text-lg text-slate-300 max-w-2xl">
              {loading
                ? "Getting things ready..."
                : "Welcome back! Here is your personal space to track habits and celebrate wins."}
            </p>
            {errorMessage && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                {errorMessage}
              </p>
            )}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="col-span-2 rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="text-sm text-slate-300 mb-2">Streak</p>
              <div className="text-3xl font-semibold">�</div>
              <p className="text-slate-400 mt-2 text-sm">
                Hook your data up to see your streaks here.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="text-sm text-slate-300 mb-2">Next step</p>
              <p className="text-slate-200">
                Start by adding your first habit to keep the momentum going.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
