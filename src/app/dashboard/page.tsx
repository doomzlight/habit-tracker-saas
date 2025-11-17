"use client";


import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";

type Habit = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
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
  const [newHabit, setNewHabit] = useState({ name: "", description: "", category: "" });
  const [newCategoryMode, setNewCategoryMode] = useState<"list" | "custom">("list");
  const [loading, setLoading] = useState(true);
  const [completionSettings, setCompletionSettings] = useState<
    Record<string, { mode: "window" | "lifetime"; days: number }>
  >({});
  const [settingsOpen, setSettingsOpen] = useState<Record<string, boolean>>({});
  const [habitFilter, setHabitFilter] = useState<"all" | "pending" | "completed">("all");
  const [habitQuery, setHabitQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ name: "", description: "", category: "" });
  const [editCategoryMode, setEditCategoryMode] = useState<"list" | "custom">("list");
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>({});
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const palette = useMemo(
    () => ["#22c55e", "#06b6d4", "#a855f7", "#f59e0b", "#ef4444", "#3b82f6", "#10b981"],
    []
  );

  const todayInfo = useMemo(() => {
    const now = new Date();
    const todayDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    return {
      today: todayDate.toISOString().slice(0, 10),
      year: todayDate.getUTCFullYear(),
      month: todayDate.getUTCMonth(),
    };
  }, []);

  const [viewDate, setViewDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  });

  const { today } = todayInfo;

  const getCategoryColor = useCallback(
    (category: string) => {
      const trimmed = category.trim();
      if (!trimmed) return "#334155";
      if (categoryColors[trimmed]) return categoryColors[trimmed];
      const hash = trimmed.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      return palette[hash % palette.length];
    },
    [categoryColors, palette]
  );

  const calendarMeta = useMemo(() => {
    const viewYear = viewDate.getUTCFullYear();
    const viewMonth = viewDate.getUTCMonth();
    const start = new Date(Date.UTC(viewYear, viewMonth, 1));
    const end = new Date(Date.UTC(viewYear, viewMonth + 1, 0));
    const formatter = new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

    return {
      daysInMonth: end.getUTCDate(),
      firstDayOffset: (start.getUTCDay() + 6) % 7,
      viewYear,
      viewMonth,
      monthLabel: formatter.format(start),
    };
  }, [viewDate]);

  const { daysInMonth, firstDayOffset, viewYear, viewMonth, monthLabel } = calendarMeta;

  // Hydrate category colors from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("habit-category-colors");
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, string>;
        setCategoryColors(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

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
        .eq("user_id", userData.user.id);

      setHabits(habitsData || []);
      setLogs(logsData || []);
      setLoading(false);
    };

    loadData();
  }, [router, supabase]);

  const addHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!newHabit.name.trim() || !user) return;
    const payload = {
      user_id: user.id,
      name: newHabit.name,
      description: newHabit.description,
      category: newHabit.category || null,
    };

    const { error: insertError } = await supabase.from("habits").insert([payload]);

    if (insertError) {
      const message = insertError.message || "Unable to add habit.";
      setFormError(message);
      console.error("Error adding habit", insertError?.message, insertError);
      return;
    }

    setNewHabit({ name: "", description: "", category: "" });
    const { data: updated } = await supabase
      .from("habits")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setHabits(updated || []);
  };

  const deleteHabit = async (id: string) => {
    // Remove related logs before removing the habit to avoid orphaned entries
    await supabase.from("habit_logs").delete().eq("habit_id", id);
    await supabase.from("habits").delete().eq("id", id);
    setHabits((prev) => prev.filter((h) => h.id !== id));
    setLogs((prev) => prev.filter((log) => log.habit_id !== id));
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
    return Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(Date.UTC(viewYear, viewMonth, i + 1));
      const iso = date.toISOString().slice(0, 10);
      const isFuture = iso > today;
      const activeHabits = habits.filter((h) => h.created_at.slice(0, 10) <= iso);
      const activeCount = activeHabits.length;
      const completeAll =
        activeCount > 0 &&
        activeHabits.every((h) =>
          logs.some((l) => l.habit_id === h.id && l.date === iso && l.completed)
        );
      const completedCount = activeHabits.filter((h) =>
        logs.some((l) => l.habit_id === h.id && l.date === iso && l.completed)
      ).length;

      return {
        label: i + 1,
        iso,
        completeAll,
        completedCount,
        activeCount,
        isFuture,
        isToday: iso === today,
      };
    });
  }, [
    daysInMonth,
    habits,
    logs,
    viewMonth,
    today,
    viewYear,
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

  const normalizeIso = (dateString: string) => {
    const d = new Date(dateString);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  };

  const isHabitActiveOn = useCallback(
    (habit: Habit, isoDate: string) => habit.created_at.slice(0, 10) <= isoDate,
    []
  );

  const isCompleted = useCallback(
    (habitId: string) =>
      logs.some((l) => l.habit_id === habitId && l.date === today),
    [logs, today]
  );

  // calculate streak and dynamic completion window
  const getHabitStats = useCallback(
    (habit: Habit, windowDays: number, mode: "window" | "lifetime") => {
      const habitLogs = logs.filter((l) => l.habit_id === habit.id);
      let streak = 0;
      const dates = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(today);
        d.setUTCDate(d.getUTCDate() - i);
        return d.toISOString().slice(0, 10);
      });

      for (const date of dates) {
        if (habitLogs.some((l) => l.date === date && l.completed)) {
          streak++;
        } else {
          // streak breaks if today or any earlier day missing
          if (date === today) continue;
          if (streak > 0) break;
        }
      }

      const endDate = new Date(today);
      const startDate =
        mode === "lifetime"
          ? normalizeIso(habit.created_at)
          : (() => {
              const d = new Date(today);
              d.setUTCDate(d.getUTCDate() - Math.max(windowDays, 1) + 1);
              return normalizeIso(d.toISOString());
            })();

      const msInDay = 24 * 60 * 60 * 1000;
      const totalDays =
        Math.floor((endDate.getTime() - startDate.getTime()) / msInDay) + 1;

      const completedCount = habitLogs.reduce((acc, log) => {
        const logDate = normalizeIso(log.date);
        if (
          logDate.getTime() >= startDate.getTime() &&
          logDate.getTime() <= endDate.getTime() &&
          log.completed
        ) {
          return acc + 1;
        }
        return acc;
      }, 0);

      return {
        streak,
        completion: Math.max(
          0,
          Math.min(100, Math.round((completedCount / Math.max(totalDays, 1)) * 100))
        ),
      };
    },
    [logs, today]
  );

  const getCompletionSetting = useCallback(
    (habitId: string) =>
      completionSettings[habitId] || { mode: "window", days: 7 },
    [completionSettings]
  );

  const overview = useMemo(() => {
    const total = habits.length;
    const completedToday = habits.filter((h) => isCompleted(h.id)).length;
    const completionToday = total === 0 ? 0 : Math.round((completedToday / total) * 100);
    const streaks = habits.map((habit) => getHabitStats(habit, 7, "window").streak);
    const longestStreak = streaks.length ? Math.max(...streaks) : 0;
    const avgCompletion =
      habits.length === 0
        ? 0
        : Math.round(
            habits.reduce(
              (sum, habit) => sum + getHabitStats(habit, 7, "window").completion,
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

  const allCompletedToday = useMemo(
    () => habits.length > 0 && habits.every((habit) => isCompleted(habit.id)),
    [habits, isCompleted]
  );

  const { categoryOptions, hasUncategorized } = useMemo(() => {
    const set = new Set<string>();
    let uncategorized = false;
    habits.forEach((habit) => {
      const value = (habit.category || "").trim();
      if (value) set.add(value);
      else uncategorized = true;
    });
    return {
      categoryOptions: Array.from(set).sort((a, b) => a.localeCompare(b)),
      hasUncategorized: uncategorized,
    };
  }, [habits]);

  const newCategoryIsCustom =
    newCategoryMode === "custom" ||
    (newHabit.category && !categoryOptions.includes(newHabit.category));

  // Keep category color map in sync with current categories and store in localStorage
  useEffect(() => {
    setCategoryColors((prev) => {
      const next = { ...prev };
      let changed = false;
      categoryOptions.forEach((cat) => {
        if (!next[cat]) {
          const hash = cat.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
          next[cat] = palette[hash % palette.length];
          changed = true;
        }
      });
      // remove orphaned
      Object.keys(next).forEach((key) => {
        if (!categoryOptions.includes(key)) {
          delete next[key];
          changed = true;
        }
      });
      if (changed) {
        try {
          localStorage.setItem("habit-category-colors", JSON.stringify(next));
        } catch {
          // ignore storage errors
        }
      }
      return next;
    });
  }, [categoryOptions, palette]);

  useEffect(() => {
    try {
      localStorage.setItem("habit-category-colors", JSON.stringify(categoryColors));
    } catch {
      // ignore
    }
  }, [categoryColors]);

  const logsByHabit = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    logs.forEach((log) => {
      if (!log.completed) return;
      if (!map[log.habit_id]) map[log.habit_id] = new Set<string>();
      map[log.habit_id]?.add(log.date);
    });
    return map;
  }, [logs]);

  const last7Days = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });
    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - (6 - idx));
      return {
        iso: d.toISOString().slice(0, 10),
        label: formatter.format(d),
      };
    });
  }, [today]);

  const habitLookup = useMemo(() => {
    return habits.reduce<Record<string, string>>((acc, habit) => {
      acc[habit.id] = habit.name;
      return acc;
    }, {});
  }, [habits]);

  const recentActivity = useMemo(() => {
    return logs
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8)
      .map((log) => ({
        ...log,
        habitName: habitLookup[log.habit_id] || "Unknown habit",
      }));
  }, [habitLookup, logs]);

  const activityDateFormatter = useMemo(
    () => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }),
    []
  );

  const selectedDayHabits = useMemo(() => {
    if (!selectedDate) return [];
    const completedSet = new Set(
      logs.filter((log) => log.completed && log.date === selectedDate).map((log) => log.habit_id)
    );
    return habits
      .filter((habit) => isHabitActiveOn(habit, selectedDate))
      .map((habit) => ({
        habit,
        done: completedSet.has(habit.id),
      }));
  }, [habits, isHabitActiveOn, logs, selectedDate]);

  const filteredHabits = useMemo(() => {
    const base =
      habitFilter === "all"
        ? habits
        : habitFilter === "completed"
        ? habits.filter((h) => isCompleted(h.id))
        : habits.filter((h) => !isCompleted(h.id));

    const applyCategory = (habit: Habit) => {
      if (categoryFilter === "all") return true;
      if (categoryFilter === "uncategorized") return !habit.category;
      return habit.category === categoryFilter;
    };

    const categoryFiltered = base.filter(applyCategory);

    if (!habitQuery.trim()) return categoryFiltered;
    const query = habitQuery.toLowerCase();

    return categoryFiltered.filter((habit) => {
      const nameMatch = habit.name.toLowerCase().includes(query);
      const descMatch = (habit.description || "").toLowerCase().includes(query);
      const categoryMatch = (habit.category || "").toLowerCase().includes(query);
      return nameMatch || descMatch || categoryMatch;
    });
  }, [categoryFilter, habitFilter, habitQuery, habits, isCompleted]);

  const toggleAllToday = async () => {
    if (!user || habits.length === 0) return;

    if (allCompletedToday) {
      const todaysLogs = logs.filter((log) => log.date === today).map((log) => log.id);
      if (todaysLogs.length === 0) return;

      await supabase.from("habit_logs").delete().in("id", todaysLogs);
      setLogs((prev) => prev.filter((log) => log.date !== today));
      return;
    }

    const outstanding = habits.filter((habit) => !isCompleted(habit.id));
    if (outstanding.length === 0) return;

    const { data, error } = await supabase
      .from("habit_logs")
      .insert(
        outstanding.map((habit) => ({
          user_id: user.id,
          habit_id: habit.id,
          date: today,
          completed: true,
        }))
      )
      .select();

    if (!error && data) {
      setLogs((prev) => [...prev, ...data]);
    }
  };

  const startEditingHabit = (habit: Habit) => {
    setEditingHabitId(habit.id);
    setEditValues({
      name: habit.name,
      description: habit.description || "",
      category: habit.category || "",
    });
    const inList = habit.category ? categoryOptions.includes(habit.category) : false;
    setEditCategoryMode(inList ? "list" : "custom");
  };

  const cancelEditingHabit = () => {
    setEditingHabitId(null);
    setEditValues({ name: "", description: "", category: "" });
    setEditCategoryMode("list");
  };

  const saveHabitEdits = async () => {
    if (!editingHabitId || !editValues.name.trim()) return;

    const payload = {
      name: editValues.name.trim(),
      description: editValues.description.trim() || null,
      category: editValues.category.trim() || null,
    };

    const { error: updateError } = await supabase
      .from("habits")
      .update(payload)
      .eq("id", editingHabitId);

    if (updateError) {
      console.error("Error updating habit", updateError?.message, updateError);
      return;
    }

    setHabits((prev) =>
      prev.map((habit) =>
        habit.id === editingHabitId ? { ...habit, ...payload } : habit
      )
    );
    cancelEditingHabit();
  };

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
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/profile"
                className="inline-flex items-center justify-center rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/15"
              >
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="inline-flex items-center justify-center rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-red-400"
              >
                Log Out
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">Active habits</p>
              <p className="text-2xl font-semibold text-white">{overview.total}</p>
              <p className="text-xs text-slate-400">{overview.completedToday} logged today</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">Today completed</p>
              <p className="text-2xl font-semibold text-white">
                {overview.completedToday}/{overview.total || 0}
              </p>
              <p className="text-xs text-slate-400">Habits done today</p>
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
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewCategoryMode("list");
                      setNewHabit((prev) => ({ ...prev, category: "" }));
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      !newCategoryIsCustom && newHabit.category === ""
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                        : "border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
                    }`}
                  >
                    Uncategorized
                  </button>
                  {categoryOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setNewCategoryMode("list");
                        setNewHabit((prev) => ({ ...prev, category: option }));
                      }}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        newHabit.category === option
                          ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                          : "border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setNewCategoryMode("custom");
                      setNewHabit((prev) => ({ ...prev, category: "" }));
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      newCategoryIsCustom
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                        : "border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
                    }`}
                  >
                    + New category
                  </button>
                </div>
                {newCategoryIsCustom && (
                  <input
                    type="text"
                    placeholder="Custom category"
                    value={newHabit.category}
                    onChange={(e) =>
                      setNewHabit((prev) => ({
                        ...prev,
                        category: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-white/10 p-3 text-sm text-white placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                )}
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/30"
              >
                Add Habit
              </button>
              {formError && (
                <p className="text-sm text-red-300">
                  {formError}
                </p>
              )}
            </form>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-900/40 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Progress at a glance</p>
                <h2 className="text-xl font-semibold text-white">Monthly completion</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setViewDate((prev) => {
                      const d = new Date(prev);
                      d.setUTCMonth(d.getUTCMonth() - 1);
                      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
                    })
                  }
                  className="rounded-full bg-white/10 px-2 py-1 text-xs font-semibold text-slate-100 hover:bg-white/15"
                  aria-label="Previous month"
                >
                  Prev
                </button>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                  {monthLabel}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setViewDate((prev) => {
                      const d = new Date(prev);
                      d.setUTCMonth(d.getUTCMonth() + 1);
                      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
                    })
                  }
                  className="rounded-full bg-white/10 px-2 py-1 text-xs font-semibold text-slate-100 hover:bg-white/15"
                  aria-label="Next month"
                >
                  Next
                </button>
              </div>
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
                <button
                  key={day.iso}
                  type="button"
                  onClick={() => setSelectedDate(day.iso)}
                  className={`flex h-12 flex-col items-center justify-center rounded-lg border text-sm font-semibold transition ${
                    day.isFuture || day.activeCount === 0
                      ? "border-white/10 bg-white/5 text-slate-100"
                      : day.completeAll
                      ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-200"
                      : day.completedCount > 0
                      ? "border-amber-400/60 bg-amber-500/15 text-amber-50"
                      : "border-red-400/60 bg-red-500/15 text-red-50"
                  } ${
                    day.isToday
                      ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900"
                      : ""
                  } hover:border-emerald-300/60 hover:bg-emerald-500/10`}
                  title={`View habits on ${day.iso}`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-900/40 backdrop-blur">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Your habits</p>
              <h2 className="text-xl font-semibold text-white whitespace-nowrap">
                Stay on top of your routines
              </h2>
            </div>
            <div className="flex w-full flex-col items-start gap-2 sm:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200">
                  {overview.completedToday}/{overview.total || 0} today
                </span>
                <div className="flex items-center gap-1 rounded-full bg-white/10 p-1 text-xs font-semibold text-slate-100">
                  <button
                    type="button"
                    onClick={() => setHabitFilter("all")}
                    className={`rounded-full px-2 py-1 transition ${
                      habitFilter === "all" ? "bg-white/30 text-slate-900" : "hover:bg-white/15"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setHabitFilter("pending")}
                    className={`rounded-full px-2 py-1 transition ${
                      habitFilter === "pending" ? "bg-white/30 text-slate-900" : "hover:bg-white/15"
                    }`}
                  >
                    Pending
                  </button>
                  <button
                    type="button"
                    onClick={() => setHabitFilter("completed")}
                    className={`rounded-full px-2 py-1 transition ${
                      habitFilter === "completed" ? "bg-white/30 text-slate-900" : "hover:bg-white/15"
                    }`}
                  >
                    Done
                  </button>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-slate-100 shadow-sm">
                  <input
                    type="text"
                    value={habitQuery}
                    onChange={(e) => setHabitQuery(e.target.value)}
                    placeholder="Search habits..."
                    className="w-40 bg-transparent text-sm text-white placeholder:text-slate-400 focus:outline-none"
                  />
                  {habitQuery && (
                    <button
                      type="button"
                      onClick={() => setHabitQuery("")}
                      className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold hover:bg-white/30"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={toggleAllToday}
                  disabled={habits.length === 0}
                  className={`rounded-full px-3 py-1 text-xs font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    allCompletedToday
                      ? "bg-slate-600 hover:bg-slate-500"
                      : "bg-emerald-500 shadow-emerald-500/30 hover:bg-emerald-400"
                  }`}
                >
                  {allCompletedToday ? "Unmark all for today" : "Mark all done today"}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] uppercase tracking-wide text-slate-400">Categories</span>
                <button
                  type="button"
                  onClick={() => setCategoryFilter("all")}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    categoryFilter === "all"
                      ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                      : "border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
                  }`}
                >
                  All
                </button>
                {hasUncategorized && (
                  <button
                    type="button"
                    onClick={() => setCategoryFilter("uncategorized")}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      categoryFilter === "uncategorized"
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                        : "border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
                    }`}
                  >
                    Uncategorized
                  </button>
                )}
                {categoryOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setCategoryFilter(option)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      categoryFilter === option
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                        : "border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
                    }`}
                  >
                    {option}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setManageCategoriesOpen(true)}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:bg-white/10"
                >
                  Manage colors
                </button>
              </div>
            </div>
          </div>

          {/* Habit list */}
          {habits.length === 0 ? (
            <p className="text-center text-slate-300">
              No habits yet. Add one above!
            </p>
          ) : (
            <ul className="space-y-3">
              {filteredHabits.length === 0 && (
                <li className="text-center text-slate-300">
                  No habits match the current filters/search.
                </li>
              )}
              {filteredHabits.map((habit) => {
                const settings = getCompletionSetting(habit.id);
                const completedToday = isCompleted(habit.id);
                const isEditing = editingHabitId === habit.id;
                const editCategoryIsCustom =
                  isEditing &&
                  (editCategoryMode === "custom" ||
                    (editValues.category &&
                      !categoryOptions.includes(editValues.category)));
                const msPerDay = 24 * 60 * 60 * 1000;
                const createdDate = normalizeIso(habit.created_at);
                const todayDate = normalizeIso(today);
                const daysSinceCreation = Math.max(
                  1,
                  Math.floor((todayDate.getTime() - createdDate.getTime()) / msPerDay) + 1
                );
                const clampedWindowDays = Math.max(
                  1,
                  Math.min(settings.days, daysSinceCreation)
                );
                const windowDaysForStats =
                  settings.mode === "window" ? clampedWindowDays : daysSinceCreation;
                const stats = getHabitStats(habit, windowDaysForStats, settings.mode);
                const historyWindow = Math.min(7, daysSinceCreation);
                const history = last7Days.map((day) => ({
                  ...day,
                  done: logsByHabit[habit.id]?.has(day.iso),
                }));
                return (
                  <li
                    key={habit.id}
                    className="flex flex-col gap-4 rounded-xl border border-white/10 bg-linear-to-r from-white/5 via-white/10 to-white/5 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2 w-full">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              value={editValues.name}
                              onChange={(e) =>
                                setEditValues((prev) => ({ ...prev, name: e.target.value }))
                              }
                              className="w-full rounded-lg border border-white/10 bg-white/10 p-2 text-sm text-white placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                              placeholder="Habit name"
                            />
                            <input
                              value={editValues.description}
                              onChange={(e) =>
                                setEditValues((prev) => ({
                                  ...prev,
                                  description: e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-white/10 bg-white/10 p-2 text-sm text-white placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                              placeholder="Description"
                            />
                            <select
                              value={
                                editCategoryIsCustom
                                  ? ""
                                  : editValues.category
                              }
                              onChange={(e) => {
                                const value = e.target.value;
                                setEditCategoryMode("list");
                                setEditValues((prev) => ({ ...prev, category: value }));
                              }}
                              className="w-full rounded-lg border border-white/15 bg-white/10 p-2 text-sm text-white focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                              style={{ colorScheme: "dark" }}
                            >
                              <option value="" disabled hidden>
                                Select category
                              </option>
                              <option value="">Uncategorized</option>
                              {categoryOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditCategoryMode("custom");
                                  setEditValues((prev) => ({ ...prev, category: "" }));
                                }}
                                className="inline-flex items-center justify-center rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-100 bg-white/5 hover:bg-white/10 transition"
                              >
                                + New category
                              </button>
                              {editCategoryIsCustom && (
                                <button
                                  type="button"
                                  onClick={() => setEditCategoryMode("list")}
                                  className="inline-flex items-center justify-center rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-white/5 hover:bg-white/10 transition"
                                >
                                  Use existing
                                </button>
                              )}
                            </div>
                            {editCategoryIsCustom && (
                              <input
                                value={editValues.category}
                                onChange={(e) =>
                                  setEditValues((prev) => ({
                                    ...prev,
                                    category: e.target.value,
                                  }))
                                }
                                className="w-full rounded-lg border border-white/10 bg-white/10 p-2 text-sm text-white placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                                placeholder="Custom category"
                              />
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3
                                className={`font-semibold text-lg ${
                                  completedToday ? "text-emerald-300" : "text-white"
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
                    {habit.category && (
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-slate-900"
                        style={{
                          backgroundColor: getCategoryColor(habit.category),
                        }}
                      >
                        {habit.category}
                      </span>
                    )}
                  </div>
                            {habit.description && (
                              <p className="text-sm text-slate-200">{habit.description}</p>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-[11px] text-slate-200">
                          <span className="rounded-full bg-white/10 px-2 py-1 font-semibold">
                            Last {historyWindow} day{historyWindow === 1 ? "" : "s"}
                          </span>
                          <div className="flex items-center gap-1">
                            {history.map((day) => (
                              <span
                                key={day.iso}
                                className={`flex h-7 w-7 items-center justify-center rounded-lg border text-[11px] font-semibold ${
                                  day.done
                                    ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-50"
                                    : "border-white/10 bg-white/5 text-slate-200"
                                }`}
                                title={`${day.label} (${day.iso})`}
                              >
                                {day.label.slice(0, 2)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 text-xs font-semibold text-slate-200">
                        <span className="rounded-full bg-white/10 px-3 py-1">
                          Streak: {stats.streak} day{stats.streak === 1 ? "" : "s"}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSettingsOpen((prev) => ({
                              ...prev,
                              [habit.id]: !prev[habit.id],
                            }))
                          }
                          className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-left text-slate-100 transition hover:bg-white/15 whitespace-nowrap"
                        >
                          <span>
                            {settings.mode === "lifetime"
                              ? "Since start"
                              : `Last ${clampedWindowDays} day${clampedWindowDays > 1 ? "s" : ""}`}
                          </span>
                          <span className="h-1 w-1 rounded-full bg-emerald-300" />
                          <span>{stats.completion}%</span>
                          <span className="text-[11px] text-emerald-200">
                            {settingsOpen[habit.id] ? "Hide settings" : "Adjust"}
                          </span>
                        </button>
                        {settingsOpen[habit.id] && (
                          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto rounded-full bg-white/5 px-2 py-1 text-[11px]">
                            <label className="flex items-center gap-1">
                              <input
                                type="radio"
                                name={`completion-mode-${habit.id}`}
                                value="window"
                                checked={settings.mode === "window"}
                                onChange={() =>
                                  setCompletionSettings((prev) => ({
                                    ...prev,
                                    [habit.id]: {
                                      mode: "window",
                                      days: clampedWindowDays || 7,
                                    },
                                  }))
                                }
                                className="accent-emerald-400"
                              />
                              <span>Last</span>
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={daysSinceCreation}
                              value={clampedWindowDays}
                              onChange={(e) =>
                                setCompletionSettings((prev) => ({
                                  ...prev,
                                  [habit.id]: {
                                    mode: "window",
                                    days: Math.min(
                                      daysSinceCreation,
                                      Math.max(
                                        1,
                                        Number(e.target.value) || settings.days || 1
                                      )
                                    ),
                                  },
                                }))
                              }
                              className="h-7 w-16 rounded-md border border-white/10 bg-white/10 px-2 text-slate-100 focus:border-emerald-400 focus:outline-none disabled:opacity-50"
                              disabled={settings.mode !== "window"}
                            />
                            <span>days</span>
                            <label className="flex items-center gap-1 pl-2 border-l border-white/10 whitespace-nowrap">
                              <input
                                type="radio"
                                name={`completion-mode-${habit.id}`}
                                value="lifetime"
                                checked={settings.mode === "lifetime"}
                                onChange={() =>
                                  setCompletionSettings((prev) => ({
                                    ...prev,
                                    [habit.id]: {
                                      mode: "lifetime",
                                      days: settings.days || 7,
                                    },
                                  }))
                                }
                                className="accent-emerald-400"
                              />
                              <span>Since start</span>
                            </label>
                          </div>
                        )}
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
                          {isEditing ? (
                            <>
                              <button
                                onClick={saveHabitEdits}
                                className="rounded-md bg-emerald-500 px-3 py-1 text-sm font-medium text-white transition hover:bg-emerald-400"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEditingHabit}
                                className="rounded-md bg-white/10 px-3 py-1 text-sm font-medium text-slate-100 transition hover:bg-white/20"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
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
                                onClick={() => startEditingHabit(habit)}
                                className="rounded-md bg-white/10 px-3 py-1 text-sm font-medium text-slate-100 transition hover:bg-white/20"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteHabit(habit.id)}
                                className="text-sm font-medium text-red-300 hover:text-red-200"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-900/40 backdrop-blur">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Recent activity</p>
              <h2 className="text-lg font-semibold text-white">Your latest completions</h2>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
              Last {recentActivity.length || 0} entries
            </span>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-center text-slate-300">
              Complete a habit to see your history here.
            </p>
          ) : (
            <ul className="space-y-2">
              {recentActivity.map((item) => {
                const dateLabel = activityDateFormatter.format(new Date(`${item.date}T00:00:00Z`));
                return (
                  <li
                    key={`${item.id}-${item.date}`}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <span className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-slate-100">
                        {dateLabel}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-semibold text-white">{item.habitName}</span>
                        <span className="text-xs text-slate-300">
                          {item.completed ? "Completed" : "Cleared"}  -  {item.date}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        item.completed
                          ? "bg-emerald-500/15 text-emerald-200 border border-emerald-300/30"
                          : "bg-amber-500/15 text-amber-200 border border-amber-300/30"
                      }`}
                    >
                      {item.completed ? "Done" : "Undone"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {selectedDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Habits on</p>
                <h3 className="text-xl font-semibold text-white">{selectedDate}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100 hover:bg-white/20"
              >
                Close
              </button>
            </div>
            {selectedDayHabits.length === 0 ? (
              <p className="mt-4 text-sm text-slate-300">
                No habits to show for this day.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {selectedDayHabits.map(({ habit, done }) => (
                  <li
                    key={habit.id}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold">{habit.name}</span>
                      {habit.description && (
                        <span className="text-xs text-slate-300">{habit.description}</span>
                      )}
                      {habit.category && (
                        <span className="mt-1 inline-flex w-fit rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-slate-100">
                          {habit.category}
                        </span>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        done
                          ? "border border-emerald-300/40 bg-emerald-500/15 text-emerald-100"
                          : "border border-slate-400/40 bg-slate-500/15 text-slate-100"
                      }`}
                    >
                      {done ? "Completed" : "Not done"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {manageCategoriesOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4"
          onClick={() => setManageCategoriesOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Categories</p>
                <h3 className="text-xl font-semibold text-white">Edit colors</h3>
              </div>
              <button
                type="button"
                onClick={() => setManageCategoriesOpen(false)}
                className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100 hover:bg-white/20"
              >
                Close
              </button>
            </div>

            {categoryOptions.length === 0 ? (
              <p className="mt-4 text-sm text-slate-300">No categories yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {categoryOptions.map((cat) => {
                  const color = getCategoryColor(cat);
                  return (
                    <div
                      key={cat}
                      className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-900/60 px-4 py-4 shadow-lg shadow-slate-950/40"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-10 w-10 rounded-2xl border border-white/15 shadow-inner shadow-black/30"
                          style={{ backgroundColor: color }}
                          aria-hidden
                        />
                        <div className="flex flex-col leading-tight">
                          <span className="text-sm font-semibold text-slate-100">{cat}</span>
                          <span className="text-[11px] text-slate-400">Brand this category</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="relative inline-flex items-center">
                          <input
                            type="color"
                            aria-label={`Color for ${cat}`}
                            value={color}
                            onChange={(e) =>
                              setCategoryColors((prev) => {
                                const next = { ...prev, [cat]: e.target.value };
                                try {
                                  localStorage.setItem("habit-category-colors", JSON.stringify(next));
                                } catch {
                                  // ignore
                                }
                                return next;
                              })
                            }
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          />
                          <span className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-semibold text-white shadow-sm shadow-slate-900/40 transition hover:-translate-y-0.5 hover:bg-white/15">
                            Pick color
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setCategoryColors((prev) => {
                              const next = { ...prev };
                              delete next[cat];
                              try {
                                localStorage.setItem("habit-category-colors", JSON.stringify(next));
                              } catch {
                                // ignore
                              }
                              return next;
                            })
                          }
                          className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-slate-200 transition hover:-translate-y-0.5 hover:bg-white/10"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}



