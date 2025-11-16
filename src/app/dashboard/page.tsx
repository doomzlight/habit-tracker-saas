"use client";

import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { User } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

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

  if (loading) {
    return <p className="text-center mt-10 text-gray-500">Loading...</p>;
  }

  const isCompleted = (habitId: string) =>
    logs.some((l) => l.habit_id === habitId && l.date === today);

  // calculate 7-day completion and streak
  const getHabitStats = (habitId: string) => {
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
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-100 p-8">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg border border-gray-200">
        <div className="mb-6 flex justify-between items-center border-b border-gray-200 pb-3">
          <h1 className="text-3xl font-bold text-gray-800">Habit Dashboard</h1>
          <button
            onClick={handleLogout}
            className="rounded-md bg-red-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-600 transition"
          >
            Log Out
          </button>
        </div>

        {/* Add habit form */}
        <form onSubmit={addHabit} className="mb-6 space-y-3">
          <input
            type="text"
            placeholder="Habit name"
            value={newHabit.name}
            onChange={(e) =>
              setNewHabit({ ...newHabit, name: e.target.value })
            }
            className="w-full rounded-md border text-black p-2"
            required
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newHabit.description}
            onChange={(e) =>
              setNewHabit({ ...newHabit, description: e.target.value })
            }
            className="w-full rounded-md border text-black p-2"
          />
          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 text-white font-medium p-2 hover:bg-blue-700 active:bg-blue-800 transition"
          >
            Add Habit
          </button>
        </form>

        {/* Calendar */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">
              Monthly completion
            </h2>
            <span className="text-sm text-gray-500">{monthLabel}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Green days = all habits completed
          </p>
          <div className="mt-3 grid grid-cols-7 gap-2 text-sm">
            {weekdayLabels.map((day) => (
              <div
                key={day}
                className="text-center text-gray-500 font-semibold uppercase tracking-wide"
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
                className={`flex h-12 flex-col items-center justify-center rounded-md border text-sm font-semibold ${
                  day.completeAll
                    ? "bg-green-100 border-green-500 text-green-800"
                    : "bg-gray-50 border-gray-200 text-gray-800"
                } ${day.isToday ? "ring-2 ring-blue-400" : ""}`}
              >
                {day.label}
              </div>
            ))}
          </div>
        </div>

        {/* Habit list */}
        {habits.length === 0 ? (
          <p className="text-center text-gray-500">
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
                  className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-linear-to-r from-white via-slate-50 to-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3
                          className={`font-semibold text-lg ${
                            completedToday
                              ? "line-through text-green-600"
                              : "text-gray-900"
                          }`}
                        >
                          {habit.name}
                        </h3>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            completedToday
                              ? "bg-green-100 text-green-700 border border-green-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {completedToday ? "Done today" : "Pending"}
                        </span>
                      </div>
                      {habit.description && (
                        <p className="text-sm text-gray-600">
                          {habit.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1 text-xs font-semibold text-gray-600">
                      <span className="rounded-full bg-gray-100 px-3 py-1">
                        Streak: {stats.streak} days
                      </span>
                      <span className="rounded-full bg-gray-100 px-3 py-1">
                        Last 7 days: {stats.completion}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-2 bg-linear-to-r from-green-400 to-green-600 rounded-full transition-all duration-500"
                        style={{ width: `${stats.completion}%` }}
                      ></div>
                    </div>
                    <span className="min-w-12 text-right text-xs font-semibold text-gray-600">
                      {stats.completion}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="h-2 w-2 rounded-full bg-green-500"></span>
                      {completedToday
                        ? "Nice work! Logged for today."
                        : "Log today to keep the streak going."}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleHabit(habit.id)}
                        className={`px-3 py-1 rounded-md text-white text-sm font-medium transition ${
                          completedToday
                            ? "bg-green-500 hover:bg-green-600"
                            : "bg-blue-500 hover:bg-blue-600"
                        }`}
                      >
                        {completedToday ? "Unmark" : "Mark done"}
                      </button>

                      <button
                        onClick={() => deleteHabit(habit.id)}
                        className="text-red-500 hover:text-red-600 text-sm font-medium"
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
      </div>
    </div>
  );
}


