import "./globals.css";
import type { Metadata } from "next";
import SupabaseProvider from "@/components/SupabaseProvider";

export const metadata: Metadata = {
  title: "Habit Tracker SaaS",
  description: "Build your habits, one day at a time.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SupabaseProvider>{children}</SupabaseProvider>
      </body>
    </html>
  );
}
