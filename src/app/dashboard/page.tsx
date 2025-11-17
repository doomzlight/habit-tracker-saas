"use client";


import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Habit = {
  id: string;
  name: string;
  description: string | null;
  category: string | null; // legacy single category field stored in DB
  categories: string[]; // normalized list of categories
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
  const [newHabit, setNewHabit] = useState({ name: "", description: "", categories: [] as string[] });
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [completionSettings, setCompletionSettings] = useState<
    Record<string, { mode: "window" | "lifetime"; days: number }>
  >({});
  const [settingsOpen, setSettingsOpen] = useState<Record<string, boolean>>({});
  const [habitFilter, setHabitFilter] = useState<"all" | "pending" | "completed">("all");
  const [habitQuery, setHabitQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({
    name: "",
    description: "",
    categories: [] as string[],
  });
  const [editCategoryInput, setEditCategoryInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>({});
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [tagCatalog, setTagCatalog] = useState<string[]>([]);
  const [tagManagerSearch, setTagManagerSearch] = useState("");
  const [tagManagerNew, setTagManagerNew] = useState("");
  const [tagManagerEditing, setTagManagerEditing] = useState<string | null>(null);
  const [tagManagerEditingValue, setTagManagerEditingValue] = useState("");
  const [tagManagerError, setTagManagerError] = useState<string | null>(null);
  const [colorMenuOpen, setColorMenuOpen] = useState<string | null>(null);
  const [colorMenuTarget, setColorMenuTarget] = useState<string | null>(null);
  const [habitOrder, setHabitOrder] = useState<string[]>([]);
  const [draggingHabitId, setDraggingHabitId] = useState<string | null>(null);
  const [draggingOverHabitId, setDraggingOverHabitId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"before" | "after">("before");
  const habitsSectionRef = useRef<HTMLDivElement | null>(null);
  const [shouldScrollToHabits, setShouldScrollToHabits] = useState(false);
  const palette = useMemo(
    () => [
      "#22c55e",
      "#0ea5e9",
      "#06b6d4",
      "#10b981",
      "#14b8a6",
      "#38bdf8",
      "#3b82f6",
      "#6366f1",
      "#7c3aed",
      "#8b5cf6",
      "#a855f7",
      "#c084fc",
      "#d946ef",
      "#eab308",
      "#f59e0b",
      "#f97316",
      "#f43f5e",
      "#ef4444",
      "#84cc16",
      "#1e293b",
    ],
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

  const normalizeCategories = useCallback((raw: string | null) => {
    if (!raw) return [];
    // Try JSON (new format)
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return Array.from(
          new Set(
            parsed
              .map((item) => (typeof item === "string" ? item : String(item)))
              .map((item) => item.trim())
              .filter(Boolean)
          )
        );
      }
    } catch {
      // fall through to legacy parsing
    }
    // Legacy single category or comma-separated string
    return Array.from(
      new Set(
        raw
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
  }, []);

  const serializeCategories = useCallback((categories: string[]) => {
    const unique = Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean)));
    return unique.length > 0 ? JSON.stringify(unique) : null;
  }, []);

  const toggleCategorySelection = useCallback((list: string[], category: string) => {
    const trimmed = category.trim();
    if (!trimmed) return list;
    return list.includes(trimmed) ? list.filter((c) => c !== trimmed) : [...list, trimmed];
  }, []);

  const addCustomCategoryToNewHabit = useCallback(() => {
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    setNewHabit((prev) => {
      if (prev.categories.includes(trimmed)) return prev;
      return { ...prev, categories: [...prev.categories, trimmed] };
    });
    setNewCategoryInput("");
  }, [newCategoryInput]);

  const addCustomCategoryToEditHabit = useCallback(() => {
    const trimmed = editCategoryInput.trim();
    if (!trimmed) return;
    setEditValues((prev) => {
      if (prev.categories.includes(trimmed)) return prev;
      return { ...prev, categories: [...prev.categories, trimmed] };
    });
    setEditCategoryInput("");
  }, [editCategoryInput]);

  const normalizeTag = (tag: string) => tag.trim();
  const tagsMatch = (a: string, b: string) =>
    a.trim().toLowerCase() === b.trim().toLowerCase();
  const syncHabitOrder = useCallback(
    (next: string[]) => {
      setHabitOrder(next);
      try {
        localStorage.setItem("habit-order", JSON.stringify(next));
      } catch {
        // ignore storage issues
      }
    },
    [setHabitOrder]
  );

  const moveHabit = useCallback(
    (habitId: string, direction: "up" | "down") => {
      setHabitOrder((prev) => {
        const base = (prev.length ? prev : habits.map((h) => h.id)).filter(Boolean);
        const index = base.indexOf(habitId);
        if (index === -1) return base;
        const target =
          direction === "up"
            ? Math.max(0, index - 1)
            : Math.min(base.length - 1, index + 1);
        if (target === index) return base;
        const next = [...base];
        [next[index], next[target]] = [next[target], next[index]];
        syncHabitOrder(next);
        return next;
      });
    },
    [habits, syncHabitOrder]
  );

  const reorderHabit = useCallback(
    (sourceId: string, targetId: string, position: "before" | "after" = "before") => {
      if (!sourceId || !targetId || sourceId === targetId) return;
      setHabitOrder((prev) => {
        const base = (prev.length ? prev : habits.map((h) => h.id)).filter(Boolean);
        const srcIndex = base.indexOf(sourceId);
        const targetIndex = base.indexOf(targetId);
        if (srcIndex === -1 || targetIndex === -1) return base;
        const next = [...base];
        next.splice(srcIndex, 1);
        const insertAt = Math.min(
          next.length,
          position === "after" ? targetIndex + (srcIndex < targetIndex ? 0 : 1) : targetIndex
        );
        next.splice(insertAt, 0, sourceId);
        syncHabitOrder(next);
        return next;
      });
    },
    [habits, syncHabitOrder]
  );

  const loadTagCatalog = useCallback(() => {
    try {
      const stored = localStorage.getItem("habit-tag-catalog");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setTagCatalog(
            Array.from(
              new Set(
                parsed
                  .map((t) => (typeof t === "string" ? t : String(t)))
                  .map((t) => t.trim())
                  .filter(Boolean)
              )
            )
          );
        }
      }
    } catch {
      // ignore
    }
  }, []);

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

  // Hydrate tag colors from localStorage
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

  useEffect(() => {
    loadTagCatalog();
  }, [loadTagCatalog]);

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

      setHabits(
        (habitsData || []).map((habit) => ({
          ...habit,
          categories: normalizeCategories(habit.category),
        }))
      );
      setLogs(logsData || []);
      setLoading(false);
    };

    loadData();
  }, [normalizeCategories, router, supabase]);

  // Scroll toward the habits section after adding a new habit so filters stay in view
  useEffect(() => {
    if (!shouldScrollToHabits || !habitsSectionRef.current) return;
    const offset = 80; // leave a bit of space above so filters stay visible
    const target =
      habitsSectionRef.current.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(target, 0), behavior: "smooth" });
    const timeout = window.setTimeout(() => setShouldScrollToHabits(false), 400);
    return () => window.clearTimeout(timeout);
  }, [shouldScrollToHabits]);

  // Hydrate habit order from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("habit-order");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const normalized = parsed.map((id) => String(id)).filter(Boolean);
          setHabitOrder(normalized);
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  // Keep habit order in sync with current habits list
  useEffect(() => {
    if (habits.length === 0) return;
    setHabitOrder((prev) => {
      const ids = habits.map((h) => h.id);
      const existing = prev.filter((id) => ids.includes(id));
      const missing = ids.filter((id) => !existing.includes(id));
      const next = [...existing, ...missing];
      const unchanged =
        next.length === prev.length && next.every((id, idx) => id === prev[idx]);
      if (unchanged) return prev;
      try {
        localStorage.setItem("habit-order", JSON.stringify(next));
      } catch {
        // ignore storage issues
      }
      return next;
    });
  }, [habits]);

  const addHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!newHabit.name.trim() || !user) return;
    const payload = {
      user_id: user.id,
      name: newHabit.name,
      description: newHabit.description,
      category: serializeCategories(newHabit.categories),
    };

    const { error: insertError } = await supabase
      .from("habits")
      .insert([payload])
      .select()
      .single();

    if (insertError) {
      const message = insertError.message || "Unable to add habit.";
      setFormError(message);
      console.error("Error adding habit", insertError?.message, insertError);
      return;
    }

    setNewHabit({ name: "", description: "", categories: [] });
    setNewCategoryInput("");
    const { data: updated } = await supabase
      .from("habits")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setHabits(
      (updated || []).map((habit) => ({
        ...habit,
        categories: normalizeCategories(habit.category),
      }))
    );
    setShouldScrollToHabits(true);
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

  const toggleHabitOnDate = async (habitId: string, date: string) => {
    if (!user) return;
    if (date > today) return; // prevent logging future dates

    const existing = logs.find((l) => l.habit_id === habitId && l.date === date);
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
            date,
            completed: true,
          },
        ])
        .select();
      if (!error && data) {
        setLogs((prev) => [...prev, data[0]]);
      }
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
    const set = new Set<string>(tagCatalog.map((t) => t.trim()).filter(Boolean));
    let uncategorized = false;
    habits.forEach((habit) => {
      if (!habit.categories || habit.categories.length === 0) {
        uncategorized = true;
        return;
      }
      habit.categories.forEach((category) => {
        const value = category.trim();
        if (value) set.add(value);
      });
    });
    return {
      categoryOptions: Array.from(set).sort((a, b) => a.localeCompare(b)),
      hasUncategorized: uncategorized,
    };
  }, [habits, tagCatalog]);

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

  useEffect(() => {
    try {
      localStorage.setItem("habit-tag-catalog", JSON.stringify(tagCatalog));
    } catch {
      // ignore
    }
  }, [tagCatalog]);

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
      if (categoryFilter === "uncategorized") return !habit.categories?.length;
      return habit.categories?.includes(categoryFilter);
    };

    const categoryFiltered = base.filter(applyCategory);

    if (!habitQuery.trim()) return categoryFiltered;
    const query = habitQuery.toLowerCase();

    return categoryFiltered.filter((habit) => {
      const nameMatch = habit.name.toLowerCase().includes(query);
      const descMatch = (habit.description || "").toLowerCase().includes(query);
      const categoryMatch = (habit.categories || [])
        .join(" ")
        .toLowerCase()
        .includes(query);
      return nameMatch || descMatch || categoryMatch;
    });
  }, [categoryFilter, habitFilter, habitQuery, habits, isCompleted]);

  const orderedFilteredHabits = useMemo(() => {
    if (filteredHabits.length === 0) return [];
    return filteredHabits.slice().sort((a, b) => {
      const aIndex = habitOrder.indexOf(a.id);
      const bIndex = habitOrder.indexOf(b.id);
      const aOrder = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
      const bOrder = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
      return aOrder - bOrder;
    });
  }, [filteredHabits, habitOrder]);

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
      categories: habit.categories || [],
    });
    setEditCategoryInput("");
  };

  const cancelEditingHabit = () => {
    setEditingHabitId(null);
    setEditValues({ name: "", description: "", categories: [] });
    setEditCategoryInput("");
  };

  const saveHabitEdits = async () => {
    if (!editingHabitId || !editValues.name.trim()) return;

    const payload = {
      name: editValues.name.trim(),
      description: editValues.description.trim() || null,
      category: serializeCategories(editValues.categories),
    };

    const { error: updateError } = await supabase
      .from("habits")
      .update(payload)
      .eq("id", editingHabitId);

    if (updateError) {
      console.error("Error updating habit", updateError?.message, updateError);
      return;
    }

    const updatedCategories = normalizeCategories(payload.category);
    setHabits((prev) =>
      prev.map((habit) =>
        habit.id === editingHabitId
          ? { ...habit, ...payload, categories: updatedCategories }
          : habit
      )
    );
    cancelEditingHabit();
  };

  const getNextPaletteColor = useCallback(() => {
    const used = new Set(
      Object.values(categoryColors).map((c) => c.toLowerCase())
    );
    const firstUnused = palette.find(
      (c) => !used.has(c.toLowerCase())
    );
    if (firstUnused) return firstUnused;
    return palette[used.size % palette.length];
  }, [categoryColors, palette]);

  const upsertTagColor = (tag: string) => {
    setCategoryColors((prev) => {
      if (prev[tag]) return prev;
      const color = getNextPaletteColor();
      const next = { ...prev, [tag]: color };
      try {
        localStorage.setItem("habit-category-colors", JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const createTag = (tag: string) => {
    const trimmed = normalizeTag(tag);
    if (!trimmed) {
      setTagManagerError("Enter a tag name to create.");
      return;
    }
    if (categoryOptions.some((tag) => tagsMatch(tag, trimmed))) {
      setTagManagerError("That tag already exists.");
      return;
    }
    setTagCatalog((prev) => {
      if (prev.some((tag) => tagsMatch(tag, trimmed))) return prev;
      return [...prev, trimmed];
    });
    upsertTagColor(trimmed);
    setTagManagerError(null);
  };

  const removeTag = async (tag: string) => {
    const trimmed = normalizeTag(tag);
    if (!trimmed) return;
    const matchesTag = (value: string) => tagsMatch(value, trimmed);
    const affectedHabits = habits.filter((h) => h.categories?.some(matchesTag));
    const updatedHabits = habits.map((habit) => {
      if (!habit.categories?.some(matchesTag)) return habit;
      const nextCats = habit.categories.filter((c) => !matchesTag(c));
      return { ...habit, categories: nextCats };
    });
    setHabits(updatedHabits);
    setTagCatalog((prev) => prev.filter((t) => !tagsMatch(t, trimmed)));
    setCategoryColors((prev) => {
      const next = { ...prev };
      const key = Object.keys(next).find((k) => tagsMatch(k, trimmed));
      if (key) delete next[key];
      return next;
    });

    // Persist removals to DB for affected habits
    if (affectedHabits.length > 0 && user) {
      const updates = affectedHabits.map((habit) => {
        const nextCats = habit.categories.filter((c) => !matchesTag(c));
        return supabase
          .from("habits")
          .update({ category: serializeCategories(nextCats) })
          .eq("id", habit.id);
      });
      const results = await Promise.all(updates);
      const hasError = results.some((r) => r.error);
      if (hasError) {
        setTagManagerError("Some habits could not be updated when removing this tag.");
        console.error("Error removing tag from habits", results.map((r) => r.error).filter(Boolean));
      }
    }
  };

  const renameTag = async (oldTag: string, newTag: string) => {
    const oldTrimmed = normalizeTag(oldTag);
    const newTrimmed = normalizeTag(newTag);
    if (!oldTrimmed || !newTrimmed) {
      setTagManagerEditing(null);
      setTagManagerEditingValue("");
      return;
    }
    if (
      categoryOptions.some(
        (tag) => tagsMatch(tag, newTrimmed) && !tagsMatch(tag, oldTrimmed)
      )
    ) {
      setTagManagerError("That tag name already exists.");
      return;
    }

    const updatedColorMap = { ...categoryColors };
    const existingColorKey = Object.keys(updatedColorMap).find((key) =>
      tagsMatch(key, oldTrimmed)
    );
    if (existingColorKey) {
      updatedColorMap[newTrimmed] = updatedColorMap[existingColorKey];
      delete updatedColorMap[existingColorKey];
    }

    const updatedTagCatalog = tagCatalog.map((t) =>
      tagsMatch(t, oldTrimmed) ? newTrimmed : t
    );
    const updatedHabits = habits.map((habit) => {
      if (!habit.categories?.some((cat) => tagsMatch(cat, oldTrimmed))) return habit;
      const nextCats = habit.categories.map((c) =>
        tagsMatch(c, oldTrimmed) ? newTrimmed : c
      );
      return { ...habit, categories: nextCats };
    });

    setTagCatalog(updatedTagCatalog);
    setCategoryColors(updatedColorMap);
    setHabits(updatedHabits);
    setTagManagerEditing(null);
    setTagManagerEditingValue("");
    setTagManagerError(null);

    // Persist changes to DB
    if (user) {
      const affected = habits.filter((h) =>
        h.categories?.some((cat) => tagsMatch(cat, oldTrimmed))
      );
      if (affected.length > 0) {
        const updates = affected.map((habit) => {
          const nextCats = habit.categories.map((c) =>
            tagsMatch(c, oldTrimmed) ? newTrimmed : c
          );
          return supabase
            .from("habits")
            .update({ category: serializeCategories(nextCats) })
            .eq("id", habit.id);
        });
        const results = await Promise.all(updates);
        const hasError = results.some((r) => r.error);
        if (hasError) {
          setTagManagerError("Some habits could not be updated when renaming this tag.");
          console.error("Error renaming tag", results.map((r) => r.error).filter(Boolean));
        }
      }
    }
  };

  const filteredManagerTags = useMemo(() => {
    if (!tagManagerSearch.trim()) return categoryOptions;
    const query = tagManagerSearch.toLowerCase();
    return categoryOptions.filter((tag) => tag.toLowerCase().includes(query));
  }, [categoryOptions, tagManagerSearch]);

  const tagUsageCount = useMemo(() => {
    const counts: Record<string, number> = {};
    habits.forEach((habit) => {
      (habit.categories || []).forEach((category) => {
        const key = category.trim();
        if (!key) return;
        counts[key] = (counts[key] || 0) + 1;
      });
    });
    return counts;
  }, [habits]);

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
                      setNewHabit((prev) => ({ ...prev, categories: [] }));
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      newHabit.categories.length === 0
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                        : "border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
                    }`}
                  >
                    Untagged
                  </button>
                  {categoryOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setNewHabit((prev) => ({
                          ...prev,
                          categories: toggleCategorySelection(prev.categories, option),
                        }));
                      }}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        newHabit.categories.includes(option)
                          ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                          : "border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Create new tag (press Enter)"
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomCategoryToNewHabit();
                      }
                    }}
                    className="flex-1 rounded-lg border border-white/10 bg-white/10 p-3 text-sm text-white placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                  <button
                    type="button"
                    onClick={addCustomCategoryToNewHabit}
                    className="inline-flex min-w-[110px] h-[45px] items-center justify-center rounded-lg border border-white/15 bg-white/10 px-4 text-xs font-semibold text-white transition hover:bg-white/15"
                  >
                    + Create tag
                  </button>
                </div>
                {newHabit.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {newHabit.categories.map((cat) => (
                      <span
                        key={cat}
                        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100"
                      >
                        <span>{cat}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setNewHabit((prev) => ({
                              ...prev,
                              categories: prev.categories.filter((c) => c !== cat),
                            }))
                          }
                          className="text-[11px] text-slate-300 hover:text-rose-300"
                          aria-label={`Remove ${cat}`}
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/30"
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

        <section
          ref={habitsSectionRef}
          className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-900/40 backdrop-blur"
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Your habits</p>
              <h2 className="text-xl font-semibold text-white whitespace-nowrap">
                Stay on top of your routines
              </h2>
            </div>
            <div className="flex w-full flex-col items-start gap-2 sm:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-6 items-center rounded-full bg-amber-500/15 px-3 text-xs font-semibold text-amber-200">
                  {overview.completedToday}/{overview.total || 0} today
                </span>
                <div className="flex h-6 items-center gap-1 rounded-full bg-white/10 p-1 text-xs font-semibold text-slate-100">
                  <button
                    type="button"
                    onClick={() => setHabitFilter("all")}
                    className={`h-full rounded-full px-3 transition ${
                      habitFilter === "all" ? "bg-white/30 text-slate-900" : "hover:bg-white/15"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setHabitFilter("pending")}
                    className={`h-full rounded-full px-3 transition ${
                      habitFilter === "pending" ? "bg-white/30 text-slate-900" : "hover:bg-white/15"
                    }`}
                  >
                    Pending
                  </button>
                  <button
                    type="button"
                    onClick={() => setHabitFilter("completed")}
                    className={`h-full rounded-full px-3 transition ${
                      habitFilter === "completed" ? "bg-white/30 text-slate-900" : "hover:bg-white/15"
                    }`}
                  >
                    Done
                  </button>
                </div>
                <div className="flex h-6 items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 text-xs text-white transition focus-within:border-emerald-400/70 focus-within:ring-2 focus-within:ring-emerald-400/40">
                  <input
                    type="text"
                    value={habitQuery}
                    onChange={(e) => setHabitQuery(e.target.value)}
                    placeholder="Search habits..."
                    className="h-full w-56 bg-transparent text-sm text-white placeholder:text-slate-400 focus:outline-none"
                  />
                  {habitQuery && (
                    <button
                      type="button"
                      onClick={() => setHabitQuery("")}
                      className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-white/15"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={toggleAllToday}
                  disabled={habits.length === 0}
                  className={`flex h-6 items-center rounded-full px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    allCompletedToday
                      ? "bg-slate-600 text-white hover:bg-slate-500"
                      : "bg-emerald-500 text-slate-900 shadow-emerald-500/30 hover:bg-emerald-400"
                  }`}
                >
                  {allCompletedToday ? "Unmark all for today" : "Mark all done today"}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] uppercase tracking-wide text-slate-400">Tags</span>
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
                    Untagged
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
                  Manage tags
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
              {orderedFilteredHabits.length === 0 && (
                <li className="text-center text-slate-300">
                  No habits match the current filters/search.
                </li>
              )}
              {orderedFilteredHabits.map((habit) => {
                const settings = getCompletionSetting(habit.id);
                const completedToday = isCompleted(habit.id);
                const isEditing = editingHabitId === habit.id;
                const orderIndex = habitOrder.indexOf(habit.id);
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
                    draggable={false}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      if (draggingHabitId && draggingHabitId !== habit.id) {
                        setDraggingOverHabitId(habit.id);
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggingHabitId && draggingHabitId !== habit.id) {
                        const rect = (e.currentTarget as HTMLLIElement).getBoundingClientRect();
                        const position =
                          e.clientY > rect.top + rect.height / 2 ? "after" : "before";
                        setDragOverPosition(position);
                        setDraggingOverHabitId(habit.id);
                      }
                    }}
                    onDrop={() => {
                      if (draggingHabitId && draggingOverHabitId) {
                        reorderHabit(draggingHabitId, draggingOverHabitId, dragOverPosition);
                      }
                      setDraggingHabitId(null);
                      setDraggingOverHabitId(null);
                      setDragOverPosition("before");
                    }}
                    onDragEnd={() => {
                      setDraggingHabitId(null);
                      setDraggingOverHabitId(null);
                      setDragOverPosition("before");
                    }}
                    onDragLeave={(e) => {
                      const currentTarget = e.currentTarget;
                      const related = e.relatedTarget as Node | null;
                      if (related && currentTarget.contains(related)) return;
                      if (draggingOverHabitId === habit.id) {
                        setDraggingOverHabitId(null);
                        setDragOverPosition("before");
                      }
                    }}
                    className={`relative flex flex-col gap-4 rounded-xl border bg-linear-to-r from-white/5 via-white/10 to-white/5 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/10 ${
                      draggingOverHabitId === habit.id && draggingHabitId !== habit.id
                        ? "border-emerald-400/70"
                        : "border-white/10"
                    } ${draggingHabitId === habit.id ? "opacity-70" : ""}`}
                  >
                    {draggingHabitId &&
                      draggingOverHabitId === habit.id &&
                      draggingHabitId !== habit.id && (
                        <div
                          className={`pointer-events-none absolute left-0 right-0 ${
                            dragOverPosition === "after" ? "bottom-0" : "top-0"
                          } flex justify-center`}
                        >
                          <div className="h-1 w-[96%] max-w-full rounded-full bg-emerald-400/70 shadow shadow-emerald-500/40" />
                        </div>
                      )}
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
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditValues((prev) => ({ ...prev, categories: [] }))
                                  }
                                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                    editValues.categories.length === 0
                                      ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                                      : "border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
                                  }`}
                                >
                                  Untagged
                                </button>
                                {categoryOptions.map((option) => (
                                  <button
                                    key={option}
                                    type="button"
                                    onClick={() =>
                                      setEditValues((prev) => ({
                                        ...prev,
                                        categories: toggleCategorySelection(
                                          prev.categories,
                                          option
                                        ),
                                      }))
                                    }
                                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                      editValues.categories.includes(option)
                                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                                        : "border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
                                    }`}
                                  >
                                    {option}
                                  </button>
                                ))}
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="Create new tag (press Enter)"
                                  value={editCategoryInput}
                                  onChange={(e) => setEditCategoryInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      addCustomCategoryToEditHabit();
                                    }
                                  }}
                                  className="flex-1 rounded-lg border border-white/10 bg-white/10 p-2 text-sm text-white placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                                />
                                <button
                                  type="button"
                                  onClick={addCustomCategoryToEditHabit}
                                  className="inline-flex min-w-[110px] h-[52px] items-center justify-center rounded-lg border border-white/15 bg-white/10 px-4 text-xs font-semibold text-white transition hover:bg-white/15"
                                >
                                  + Create tag
                                </button>
                              </div>
                              {editValues.categories.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {editValues.categories.map((cat) => (
                                    <span
                                      key={cat}
                                      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100"
                                    >
                                      <span>{cat}</span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setEditValues((prev) => ({
                                            ...prev,
                                            categories: prev.categories.filter((c) => c !== cat),
                                          }))
                                        }
                                        className="text-[11px] text-slate-300 hover:text-rose-300"
                                        aria-label={`Remove ${cat}`}
                                      >
                                        x
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
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
                              {habit.categories?.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {habit.categories.map((cat) => (
                                    <span
                                      key={cat}
                                      className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-slate-900"
                                      style={{
                                        backgroundColor: getCategoryColor(cat),
                                      }}
                                    >
                                      {cat}
                                    </span>
                                  ))}
                                </div>
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
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={`Move ${habit.name} up`}
                            onClick={() => moveHabit(habit.id, "up")}
                            disabled={orderIndex <= 0}
                            className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-slate-100 shadow-sm transition hover:-translate-y-0.5 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${habit.name} down`}
                            onClick={() => moveHabit(habit.id, "down")}
                            disabled={
                              orderIndex === -1 || orderIndex >= orderedFilteredHabits.length - 1
                            }
                            className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-slate-100 shadow-sm transition hover:-translate-y-0.5 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            draggable
                            onDragStart={(e) => {
                              setDraggingHabitId(habit.id);
                              setDraggingOverHabitId(habit.id);
                              setDragOverPosition("before");
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", habit.id);
                            }}
                            onDragEnd={() => {
                              setDraggingHabitId(null);
                              setDraggingOverHabitId(null);
                              setDragOverPosition("before");
                            }}
                            className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-slate-100 shadow-sm transition hover:-translate-y-0.5 hover:bg-white/10"
                          >
                            ⇅
                          </button>
                        </div>
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
                                className="rounded-md bg-emerald-500 px-3 py-1 text-sm font-medium text-slate-900 transition hover:bg-emerald-400"
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
                                className={`px-3 py-1 rounded-md text-sm font-semibold transition ${
                                  completedToday
                                    ? "border border-emerald-400/60 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                                    : "border border-emerald-500/70 bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
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
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-white">{habit.name}</span>
                      {habit.description && (
                        <span className="text-xs text-slate-300">{habit.description}</span>
                      )}
                      {habit.categories?.length > 0 && (
                        <span className="mt-1 inline-flex w-fit flex-wrap gap-2">
                          {habit.categories.map((cat) => (
                            <span
                              key={cat}
                              className="inline-flex rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-slate-100"
                            >
                              {cat}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          done
                            ? "border border-emerald-300/40 bg-emerald-500/15 text-emerald-100"
                            : "border border-slate-400/40 bg-slate-500/15 text-slate-100"
                        }`}
                      >
                        {done ? "Completed" : "Not done"}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleHabitOnDate(habit.id, selectedDate)}
                        className={`min-w-[87px] rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                          done
                            ? "border border-slate-300/30 bg-white/10 text-slate-100 hover:bg-white/15"
                            : "bg-emerald-500 text-slate-900 hover:bg-emerald-400"
                        }`}
                      >
                        {done ? "Unmark" : "Mark done"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {manageCategoriesOpen && (
        <>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 py-6 overscroll-contain overflow-y-auto [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none" }}
            onClick={() => setManageCategoriesOpen(false)}
          >
            <div
              className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: "none" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Tags</p>
                    <h3 className="text-xl font-semibold text-white">Manage tags</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setManageCategoriesOpen(false)}
                    className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100 hover:bg-white/20"
                  >
                    Close
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/20">
                    <form
                      className="flex flex-col gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        createTag(tagManagerNew);
                        setTagManagerNew("");
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 pl-1">
                          Create
                        </p>
                        {tagManagerNew && (
                          <button
                            type="button"
                            onClick={() => {
                              setTagManagerNew("");
                              setTagManagerError(null);
                            }}
                            className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-100 transition hover:bg-white/10"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          type="text"
                          value={tagManagerNew}
                          onChange={(e) => {
                            setTagManagerNew(e.target.value);
                            setTagManagerError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              createTag(tagManagerNew);
                              setTagManagerNew("");
                            }
                          }}
                          placeholder="Create new tag"
                          className="flex-1 rounded-lg border border-white/12 bg-white/5 p-3 text-sm text-white placeholder:text-slate-400 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                        />
                        <button
                          type="submit"
                          disabled={!tagManagerNew.trim()}
                          className="inline-flex h-10 min-w-24 items-center justify-center rounded-lg bg-emerald-500 px-3 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Create tag
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/20">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 pl-1">
                        Search
                      </p>
                      {tagManagerSearch && (
                        <button
                          type="button"
                          onClick={() => setTagManagerSearch("")}
                          className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-100 transition hover:bg-white/10"
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                    <div className="mt-2">
                      <input
                        type="text"
                        value={tagManagerSearch}
                        onChange={(e) => {
                          setTagManagerSearch(e.target.value);
                          setTagManagerError(null);
                        }}
                        placeholder="Search tags"
                        className="w-full rounded-lg border border-white/12 bg-white/5 p-3 text-sm text-white placeholder:text-slate-400 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                      />
                    </div>
                  </div>

                  {tagManagerError && (
                    <p className="text-sm text-red-300">{tagManagerError}</p>
                  )}
                </div>

                {filteredManagerTags.length === 0 ? (
                  <p className="text-sm text-slate-300">No tags found.</p>
                ) : (
                  <div className="space-y-3">
                    {filteredManagerTags.map((cat) => {
                      const color = getCategoryColor(cat);
                      const isEditing = tagManagerEditing === cat;
                      const usageCount = tagUsageCount[cat] || 0;
                      return (
                        <div
                          key={cat}
                          className="flex flex-col gap-3 rounded-2xl border border-white/12 bg-white/5 p-4 shadow-lg shadow-slate-950/30 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="h-12 w-12 rounded-2xl border border-white/15 shadow-inner shadow-black/30"
                              style={{ backgroundColor: color }}
                              aria-hidden
                            />
                            <div className="flex flex-col leading-tight">
                              {isEditing ? (
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                  <input
                                    value={tagManagerEditingValue}
                                    onChange={(e) => setTagManagerEditingValue(e.target.value)}
                                    className="rounded-lg border border-white/10 bg-white/10 p-2 text-sm text-white placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                                    placeholder="New tag name"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => renameTag(cat, tagManagerEditingValue)}
                                      className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-emerald-400"
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTagManagerEditing(null);
                                        setTagManagerEditingValue("");
                                        setTagManagerError(null);
                                      }}
                                      className="rounded-md bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:bg-white/15"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <span className="text-sm font-semibold text-slate-100">{cat}</span>
                                  <span className="text-[11px] text-slate-400 whitespace-nowrap">
                                    {usageCount > 0
                                      ? `${usageCount} habit${usageCount === 1 ? "" : "s"} using this tag`
                                      : "Not used yet"}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setColorMenuOpen(cat);
                                setColorMenuTarget(cat);
                              }}
                              className="rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-sm shadow-slate-900/40 transition hover:-translate-y-0.5 hover:bg-white/15"
                            >
                              Pick color
                            </button>
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
                              className="rounded-full border border-white/12 bg-white/5 px-3.5 py-1.5 text-[11px] font-semibold text-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:bg-white/10"
                            >
                              Reset
                            </button>
                            {!isEditing && (
                              <button
                                type="button"
                                onClick={() => {
                                  setTagManagerEditing(cat);
                                  setTagManagerEditingValue(cat);
                                }}
                                className="rounded-full border border-white/12 bg-white/5 px-3.5 py-1.5 text-[11px] font-semibold text-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:bg-white/10"
                              >
                                Rename
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeTag(cat)}
                              className="rounded-full border border-red-400/30 bg-red-500/10 px-3.5 py-1.5 text-[11px] font-semibold text-red-200 shadow-sm transition hover:-translate-y-0.5 hover:bg-red-500/20"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          {colorMenuOpen && colorMenuTarget && (
            <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/70 px-4 py-6 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl shadow-slate-950/50">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Color</p>
                    <h4 className="text-lg font-semibold text-white">Choose a color</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setColorMenuOpen(null)}
                    className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100 hover:bg-white/20"
                  >
                    Close
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-5 gap-3">
                  {palette.map((choice) => {
                    const current = categoryColors[colorMenuTarget] || "";
                    const isActive = choice.toLowerCase() === current.toLowerCase();
                    return (
                      <button
                        key={choice}
                        type="button"
                        aria-label={`Choose ${choice}`}
                        onClick={() => {
                          setCategoryColors((prev) => {
                            const next = { ...prev, [colorMenuTarget]: choice };
                            try {
                              localStorage.setItem("habit-category-colors", JSON.stringify(next));
                            } catch {
                              // ignore
                            }
                            return next;
                          });
                          setColorMenuOpen(null);
                        }}
                        className={`h-12 w-12 rounded-xl border ${
                          isActive ? "border-white" : "border-white/20"
                        } shadow-inner shadow-black/30 transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/40`}
                        style={{ backgroundColor: choice }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
