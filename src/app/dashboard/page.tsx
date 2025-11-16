"use client";

import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";

type Habit = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

type HabitLog = {
  id: string;
  habit_id: string;
  date: string;
  completed: boolean;
};

export default function Dashboard() {
  const supabase = createClientComponentClient();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [newHabit, setNewHabit] = useState({ name: "", description: "" });
  const [loading, setLoading] = useState(true);

  const {
    today,
    startOfMonth,
    daysInMonth,
    firstDayOffset,
    year,
    month,
    monthLabel,
  } = useMemo(() => {
    const now = new Date();
    const todayDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const y = todayDate.getUTCFullYear();
    const m = todayDate.getUTCMonth();
    const start = new Date(Date.UTC(y, m, 1));
    const end = new Date(Date.UTC(y, m + 1, 0));
    const formatter = new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

    return {
      today: todayDate.toISOString().slice(0, 10), // current date in YYYY-MM-DD
      startOfMonth: start.toISOString().slice(0, 10),
      daysInMonth: end.getUTCDate(),
      // shift so Monday = 0, Sunday = 6
      firstDayOffset: (start.getUTCDay() + 6) % 7,
      year: y,
      month: m,
      monthLabel: formatter.format(start),
    };
  }, []); // only runs once

  // Load user, habits, and logs for the current month
  useEffect(() => {
    const loadData = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        router.push("/login");
        return;
      }
      setUser(userData.user);

      const { data: habitsData } = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });

      const { data: logsData } = await supabase
        .from("habit_logs")
        .select("*")
        .eq("user_id", userData.user.id)
        .gte("date", startOfMonth)
        .lte("date", today);

      setHabits(habitsData || []);
      setLogs(logsData || []);
      setLoading(false);
    };

    loadData();
  }, [router, supabase, startOfMonth, today]);

  const addHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabit.name.trim() || !user) return;
    await supabase.from("habits").insert([
      {
        user_id: user.id,
        name: newHabit.name,
        description: newHabit.description,
      },
    ]);
    setNewHabit({ name: "", description: "" });
    const { data: updated } = await supabase
      .from("habits")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setHabits(updated || []);
  };

  const deleteHabit = async (id: string) => {
    await supabase.from("habits").delete().eq("id", id);
    setHabits((prev) => prev.filter((h) => h.id !== id));
  };

  const toggleHabit = async (habitId: string) => {
    if (!user) return;
    const existing = logs.find(
      (l) => l.habit_id === habitId && l.date === today
    );

    if (existing) {
      await supabase.from("habit_logs").delete().eq("id", existing.id);
      setLogs((prev) => prev.filter((l) => l.id !== existing.id));
    } else {
      const { data, error } = await supabase
        .from("habit_logs")
        .insert([
          {
            user_id: user.id,
            habit_id: habitId,
            date: today,
            completed: true,
          },
        ])
        .select();
      if (!error && data) setLogs((prev) => [...prev, data[0]]);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const monthDays = useMemo(() => {
    const habitCount = habits.length;
    return Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(Date.UTC(year, month, i + 1));
      const iso = date.toISOString().slice(0, 10);
      const completeAll =
        habitCount > 0 &&
        habits.every((h) =>
          logs.some((l) => l.habit_id === h.id && l.date === iso && l.completed)
        );

      return {
        label: i + 1,
        iso,
        completeAll,
        isToday: iso === today,
      };
    });
  }, [
    daysInMonth,
    habits,
    logs,
    month,
    today,
    year,
  ]);

  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: "UTC",
    });
    const monday = new Date(Date.UTC(2023, 0, 2)); // Monday anchor
    return Array.from({ length: 7 }, (_, i) =>
      formatter.format(new Date(monday.getTime() + i * 24 * 60 * 60 * 1000))
    );
  }, []);

  const isCompleted = useCallback(
    (habitId: string) =>
      logs.some((l) => l.habit_id === habitId && l.date === today),
    [logs, today]
  );

  // calculate 7-day completion and streak
  const getHabitStats = useCallback(
    (habitId: string) => {
      const habitLogs = logs.filter((l) => l.habit_id === habitId);
      let streak = 0;
      let count = 0;
      const dates = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(today);
        d.setUTCDate(d.getUTCDate() - i);
        return d.toISOString().slice(0, 10);
      });

      for (const date of dates) {
        if (habitLogs.some((l) => l.date === date && l.completed)) {
          count++;
          streak++;
        } else {
          // streak breaks if today or any earlier day missing
          if (date === today) continue;
          if (streak > 0) break;
        }
      }

      return {
        streak,
        completion: Math.round((count / 7) * 100),
      };
    },
    [logs, today]
  );

  const overview = useMemo(() => {
    const total = habits.length;
    const completedToday = habits.filter((h) => isCompleted(h.id)).length;
    const completionToday = total === 0 ? 0 : Math.round((completedToday / total) * 100);
    const streaks = habits.map((habit) => getHabitStats(habit.id).streak);
    const longestStreak = streaks.length ? Math.max(...streaks) : 0;
    const avgCompletion =
      habits.length === 0
        ? 0
        : Math.round(
            habits.reduce(
              (sum, habit) => sum + getHabitStats(habit.id).completion,
              0
            ) / habits.length
          );

    return {
      total,
      completedToday,
      completionToday,
      longestStreak,
      avgCompletion,
    };
  }, [habits, getHabitStats, isCompleted]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <p className="text-sm font-medium">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
        <header className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-900/40 backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Daily Focus</p>
              <h1 className="text-3xl font-bold tracking-tight text-white">Habit Dashboard</h1>
              <p className="text-sm text-slate-300">
                Track, plan, and celebrate the small wins that build momentum.
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-500/30 transition hover:-translate-y-0.5 hover:bg-red-400"
            >
              Log Out
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">Active habits</p>
              <p className="text-2xl font-semibold text-white">{overview.total}</p>
              <p className="text-xs text-slate-400">{overview.completedToday} logged today</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">Today completion</p>
              <p className="text-2xl font-semibold text-white">{overview.completionToday}%</p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-white/10">
                <div
                  className="h-1.5 rounded-full bg-emerald-400"
                  style={{ width: `${overview.completionToday}%` }}
                />
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">Longest streak</p>
              <p className="text-2xl font-semibold text-white">{overview.longestStreak}d</p>
              <p className="text-xs text-slate-400">Keep the chain growing</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">Avg last 7 days</p>
              <p className="text-2xl font-semibold text-white">{overview.avgCompletion}%</p>
              <p className="text-xs text-slate-400">Across all habits</p>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_1.35fr]">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-900/40 backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Create a habit</p>
                <h2 className="text-xl font-semibold text-white">Add a new routine</h2>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                Consistency is king
              </span>
            </div>
            <form onSubmit={addHabit} className="space-y-3">
              <input
                type="text"
                placeholder="Habit name"
                value={newHabit.name}
                onChange={(e) =>
                  setNewHabit({ ...newHabit, name: e.target.value })
                }
                className="w-full rounded-lg border border-white/10 bg-white/10 p-3 text-sm text-white placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                required
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={newHabit.description}
                onChange={(e) =>
                  setNewHabit({ ...newHabit, description: e.target.value })
                }
                className="w-full rounded-lg border border-white/10 bg-white/10 p-3 text-sm text-white placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
              />
              <button
                type="submit"
                className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-400"
              >
                Add Habit
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-900/40 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Progress at a glance</p>
                <h2 className="text-xl font-semibold text-white">Monthly completion</h2>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                {monthLabel}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Green days mean every habit was completed.
            </p>
            <div className="mt-4 grid grid-cols-7 gap-2 text-sm">
              {weekdayLabels.map((day) => (
                <div
                  key={day}
                  className="text-center text-slate-300 font-semibold uppercase tracking-wide"
                >
                  {day}
                </div>
              ))}
              {Array.from({ length: firstDayOffset }).map((_, idx) => (
                <div key={`blank-${idx}`} />
              ))}
              {monthDays.map((day) => (
                <div
                  key={day.iso}
                  className={`flex h-12 flex-col items-center justify-center rounded-lg border text-sm font-semibold ${
                    day.completeAll
                      ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-200"
                      : "border-white/10 bg-white/5 text-slate-100"
                  } ${
                    day.isToday
                      ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900"
                      : ""
                  }`}
                >
                  {day.label}
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-900/40 backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Your habits</p>
              <h2 className="text-xl font-semibold text-white">Stay on top of your routines</h2>
            </div>
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200">
              {overview.completionToday}% today
            </span>
          </div>

          {/* Habit list */}
          {habits.length === 0 ? (
            <p className="text-center text-slate-300">
              No habits yet. Add one above!
            </p>
          ) : (
            <ul className="space-y-3">
              {habits.map((habit) => {
                const stats = getHabitStats(habit.id);
                const completedToday = isCompleted(habit.id);
                return (
                  <li
                    key={habit.id}
                    className="flex flex-col gap-4 rounded-xl border border-white/10 bg-linear-to-r from-white/5 via-white/10 to-white/5 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3
                            className={`font-semibold text-lg ${
                              completedToday
                                ? "line-through text-emerald-300"
                                : "text-white"
                            }`}
                          >
                            {habit.name}
                          </h3>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              completedToday
                                ? "bg-emerald-500/15 text-emerald-200 border border-emerald-300/30"
                                : "bg-sky-500/15 text-sky-200 border border-sky-300/30"
                            }`}
                          >
                            {completedToday ? "Done today" : "Pending"}
                          </span>
                        </div>
                        {habit.description && (
                          <p className="text-sm text-slate-200">
                            {habit.description}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1 text-xs font-semibold text-slate-200">
                        <span className="rounded-full bg-white/10 px-3 py-1">
                          Streak: {stats.streak} days
                        </span>
                        <span className="rounded-full bg-white/10 px-3 py-1">
                          Last 7 days: {stats.completion}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-2 bg-linear-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${stats.completion}%` }}
                        ></div>
                      </div>
                      <span className="min-w-12 text-right text-xs font-semibold text-slate-200">
                        {stats.completion}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/10 pt-3">
                      <div className="flex items-center gap-2 text-xs text-slate-300">
                        <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                        {completedToday
                          ? "Nice work! Logged for today."
                          : "Log today to keep the streak going."}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleHabit(habit.id)}
                          className={`px-3 py-1 rounded-md text-white text-sm font-medium transition ${
                            completedToday
                              ? "bg-emerald-500 hover:bg-emerald-400"
                              : "bg-sky-500 hover:bg-sky-400"
                          }`}
                        >
                          {completedToday ? "Unmark" : "Mark done"}
                        </button>

                        <button
                          onClick={() => deleteHabit(habit.id)}
                          className="text-sm font-medium text-red-300 hover:text-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
