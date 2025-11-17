"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { User } from "@supabase/supabase-js";
import { useTheme } from "@/components/ThemeProvider";

type ProfileFormState = {
  firstName: string;
  lastName: string;
  email: string;
};

type PasswordFormState = {
  newPassword: string;
  confirmPassword: string;
};

const defaultProfileForm: ProfileFormState = {
  firstName: "",
  lastName: "",
  email: "",
};

const defaultPasswordForm: PasswordFormState = {
  newPassword: "",
  confirmPassword: "",
};

const inputClasses =
  "w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/60";

export default function ProfilePage() {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileFormState>(defaultProfileForm);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(defaultPasswordForm);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { theme, setTheme, mounted: themeReady } = useTheme();
  const resolvedTheme = themeReady ? theme : "dark";

  const { firstName, lastName, email } = profileForm;
  const { newPassword, confirmPassword } = passwordForm;

  const handleProfileFieldChange = useCallback(
    (field: keyof ProfileFormState) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const { value } = event.target;
        setProfileForm((prev) => ({ ...prev, [field]: value }));
      },
    []
  );

  const handlePasswordFieldChange = useCallback(
    (field: keyof PasswordFormState) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const { value } = event.target;
        setPasswordForm((prev) => ({ ...prev, [field]: value }));
      },
    []
  );

  useEffect(() => {
    let active = true;
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUser(data.user);
      setProfileForm({
        firstName: (data.user.user_metadata?.first_name as string) || "",
        lastName: (data.user.user_metadata?.last_name as string) || "",
        email: data.user.email || "",
      });
      setLoading(false);
    };

    fetchUser();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const trimmedEmail = email.trim();
      const trimmedPassword = newPassword.trim();
      const trimmedConfirm = confirmPassword.trim();

      if (trimmedPassword && trimmedPassword !== trimmedConfirm) {
        setError("New password and confirmation do not match.");
        setSaving(false);
        return;
      }

      const metadataPayload = {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        },
      };

      // Always update metadata first
      const { data: metaUpdated, error: metaError } = await supabase.auth.updateUser(metadataPayload);
      if (metaError) throw metaError;
      if (metaUpdated?.user) setUser(metaUpdated.user);

      // Update email only when changed
      if (trimmedEmail && trimmedEmail !== user.email) {
        const { data: emailUpdated, error: emailError } = await supabase.auth.updateUser({
          email: trimmedEmail,
        });
        if (emailError) throw emailError;
        if (emailUpdated?.user) setUser(emailUpdated.user);
      }

      // Update password only if provided
      if (trimmedPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: trimmedPassword,
        });
        if (passwordError) throw passwordError;
      }

      const emailChanged = trimmedEmail && trimmedEmail !== user.email;
      const passwordChanged = Boolean(trimmedPassword);
      if (emailChanged) {
        setMessage("Profile updated. Please confirm your new email if required.");
      } else if (passwordChanged) {
        setMessage("Password updated.");
      } else {
        setMessage("Profile updated.");
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong while updating your profile.");
      }
    } finally {
      setSaving(false);
      setPasswordForm(defaultPasswordForm);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <p className="text-sm font-medium">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Account</p>
            <h1 className="text-3xl font-bold tracking-tight text-white">Profile settings</h1>
            <p className="text-sm text-slate-300">
              Edit your personal details, email, or password.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/15"
            >
              Back to dashboard
            </Link>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push("/login");
              }}
              className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-red-400"
            >
              Log out
            </button>
          </div>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-900/40 backdrop-blur">
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1 pl-2">
                <p className="text-sm font-semibold text-white">Appearance</p>
                <p className="text-xs text-slate-400">Switch between light and dark mode for the whole app.</p>
              </div>
              <div className="flex items-center gap-2 pr-1">
                <button
                  type="button"
                  aria-pressed={resolvedTheme === "light"}
                  onClick={() => setTheme("light")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    resolvedTheme === "light"
                    ? "bg-emerald-500 text-slate-900 shadow shadow-emerald-500/30"
                      : "bg-white/10 text-slate-200 hover:bg-white/15"
                  }`}
                >
                  Light
                </button>
                <button
                  type="button"
                  aria-pressed={resolvedTheme === "dark"}
                  onClick={() => setTheme("dark")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    resolvedTheme === "dark"
                    ? "bg-emerald-500 text-slate-900 shadow shadow-emerald-500/30"
                      : "bg-white/10 text-slate-200 hover:bg-white/15"
                  }`}
                >
                  Dark
                </button>
              </div>
            </div>
            <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="px-2 text-sm font-semibold text-white">Personal details</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="block pl-2 text-slate-300">First name</span>
                  <input
                    type="text"
                    value={firstName}
                    onChange={handleProfileFieldChange("firstName")}
                    className={inputClasses}
                    required
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block pl-2 text-slate-300">Last name</span>
                  <input
                    type="text"
                    value={lastName}
                    onChange={handleProfileFieldChange("lastName")}
                    className={inputClasses}
                    required
                  />
                </label>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="px-2 text-sm font-semibold text-white">Contact</p>
              <label className="space-y-1 text-sm">
                <span className="block pl-2 text-slate-300">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={handleProfileFieldChange("email")}
                  className={inputClasses}
                  required
                />
                <span className="block pl-2 text-[11px] text-slate-400 pb-1">
                  Changing email may require confirmation.
                </span>
              </label>
            </div>

            <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="px-2 text-sm font-semibold text-white">Security</p>
              <label className="space-y-1 text-sm">
                <span className="block pl-2 text-slate-300">New password</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={handlePasswordFieldChange("newPassword")}
                  placeholder="Leave blank to keep current password"
                  className={inputClasses}
                />
                <span className="block pl-2 text-[11px] text-slate-400 pb-1">
                  Minimum 6 characters recommended.
                </span>
              </label>
              <label className="space-y-1 text-sm">
                <span className="block pl-2 text-slate-300">Confirm new password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={handlePasswordFieldChange("confirmPassword")}
                  placeholder="Re-enter new password"
                  className={inputClasses}
                />
              </label>
            </div>

            {message && (
              <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 border border-emerald-500/30">
                {message}
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200 border border-red-500/30">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="rounded-md bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/15"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
