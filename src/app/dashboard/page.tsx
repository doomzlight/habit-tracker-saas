"use client";

import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useMemo } from "react";

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


const { today, sevenDaysAgo } = useMemo(() => {
  const now = new Date();
  const t = now.toISOString().slice(0, 10);
  const s = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return { today: t, sevenDaysAgo: s };
}, []); // only runs once


  // Load user, habits, and logs for last 7 days
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
        .gte("date", sevenDaysAgo)
        .lte("date", today);

      setHabits(habitsData || []);
      setLogs(logsData || []);
      setLoading(false);
    };

    loadData();
  }, [router, supabase, today, sevenDaysAgo]);

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
      const d = new Date();
      d.setDate(d.getDate() - i);
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
            className="w-full rounded-md border border-gray-300 p-2"
            required
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newHabit.description}
            onChange={(e) =>
              setNewHabit({ ...newHabit, description: e.target.value })
            }
            className="w-full rounded-md border border-gray-300 p-2"
          />
          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 text-white font-medium p-2 hover:bg-blue-700 active:bg-blue-800 transition"
          >
            Add Habit
          </button>
        </form>

        {/* Habit list */}
        {habits.length === 0 ? (
          <p className="text-center text-gray-500">
            No habits yet. Add one above!
          </p>
        ) : (
          <ul className="space-y-3">
            {habits.map((habit) => {
              const stats = getHabitStats(habit.id);
              return (
                <li
                  key={habit.id}
                  className="flex flex-col rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p
                        className={`font-semibold ${
                          isCompleted(habit.id)
                            ? "line-through text-green-600"
                            : "text-black"
                        }`}
                      >
                        {habit.name}
                      </p>
                      {habit.description && (
                        <p className="text-sm text-black">
                          {habit.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        🔥 Streak: {stats.streak} days • {stats.completion}% last 7 days
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleHabit(habit.id)}
                        className={`px-3 py-1 rounded-md text-white text-sm font-medium transition ${
                          isCompleted(habit.id)
                            ? "bg-green-500 hover:bg-green-600"
                            : "bg-gray-400 hover:bg-gray-500"
                        }`}
                      >
                        {isCompleted(habit.id) ? "Done" : "Mark"}
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteHabit(habit.id)}
                        className="text-sm text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-2 bg-green-500"
                      style={{ width: `${stats.completion}%` }}
                    ></div>
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
