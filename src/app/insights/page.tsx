"use client";

import Link from "next/link";

const insightCards = [
  {
    title: "Best streak saver",
    body: "Set a 3–7 day window on habits you often miss to protect momentum.",
    accent: "bg-emerald-500/50",
  },
  {
    title: "Batch your reviews",
    body: "Review tags weekly to trim clutter and keep focus on what matters now.",
    accent: "bg-sky-500/50",
  },
  {
    title: "Build accountability",
    body: "Share a weekly screenshot with a friend for lightweight external motivation.",
    accent: "bg-amber-500/50",
  },
];

const quickWins = [
  "Add a short description to every habit for future-you.",
  "Use tags to group by energy level: Low, Medium, Deep.",
  "Archive unused habits instead of deleting to keep history intact.",
  "Try a 7-day \"focus sprint\" on one tricky habit for a quick win.",
];

export default function Insights() {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
        <header className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-900/40 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Ideas</p>
              <h1 className="text-3xl font-bold tracking-tight text-white">Habit Insights</h1>
              <p className="text-sm text-slate-300">
                Quick wins and rituals to keep your streaks healthy without adding pressure.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:bg-emerald-400"
            >
              Back to dashboard
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {insightCards.map((card) => (
            <article
              key={card.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-md shadow-slate-950/30"
            >
              <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ${card.accent}`}>
                <span className="text-xs font-extrabold uppercase text-slate-900">★</span>
              </div>
              <h3 className="text-lg font-semibold text-white">{card.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{card.body}</p>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-md shadow-slate-950/30">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Playbook</p>
              <h2 className="text-xl font-semibold text-white">Quick wins</h2>
            </div>
            <Link
              href="/profile"
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/15"
            >
              Tweak profile
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {quickWins.map((tip) => (
              <li
                key={tip}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100"
              >
                <span className="mt-[6px] h-2 w-2 rounded-full bg-emerald-400" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
