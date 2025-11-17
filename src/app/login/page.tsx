"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type AuthFormState = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

const initialFormState: AuthFormState = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
};

const inputClasses =
  "w-full rounded-lg border border-white/10 bg-white/10 p-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/60";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClientComponentClient(), []);

  const [formValues, setFormValues] = useState<AuthFormState>(initialFormState);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { firstName, lastName, email, password } = formValues;
  const actionLabel = isSignUp ? "Sign Up" : "Sign In";
  const buttonLabel = loading
    ? `${isSignUp ? "Signing up" : "Signing in"}...`
    : actionLabel;

  const updateField = useCallback(
    (field: keyof AuthFormState) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const { value } = event.target;
        setFormValues((prev) => ({ ...prev, [field]: value }));
      },
    []
  );

  useEffect(() => {
    let active = true;
    const checkSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && active) router.replace("/dashboard");
    };
    checkSession();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();

      const authResponse = isSignUp
        ? await supabase.auth.signUp({
            email: trimmedEmail,
            password: trimmedPassword,
            options: {
              data: {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
              },
            },
          })
        : await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password: trimmedPassword,
          });

      if (authResponse.error) throw authResponse.error;

      router.push("/dashboard");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-4 py-10">
        <div className="flex w-full flex-col gap-6 rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-slate-900/40 backdrop-blur md:max-w-xl">
          <div className="flex flex-col gap-2 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {isSignUp ? "Create account" : "Welcome back"}
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              {isSignUp ? "Create Account" : "Sign in to Habit Tracker"}
            </h1>
            <p className="text-sm text-slate-300">
              Track, build, and celebrate your routines.
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder="First name"
                  value={firstName}
                  onChange={updateField("firstName")}
                  className={inputClasses}
                  required
                />
                <input
                  type="text"
                  placeholder="Last name"
                  value={lastName}
                  onChange={updateField("lastName")}
                  className={inputClasses}
                  required
                />
              </div>
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={updateField("email")}
              className={inputClasses}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={updateField("password")}
              className={inputClasses}
              required
            />

            {error && (
              <p className="text-sm text-red-400 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {buttonLabel}
            </button>
          </form>

          <div className="flex items-center justify-center gap-2 text-sm text-slate-300">
            <span>
              {isSignUp ? "Already have an account?" : "Don't have an account?"}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsSignUp((prev) => !prev);
                setError("");
              }}
              className="text-emerald-300 hover:text-emerald-200 font-semibold"
              disabled={loading}
            >
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
