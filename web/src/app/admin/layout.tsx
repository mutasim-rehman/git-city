import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin · Git City",
  description: "Git City user analytics dashboard",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
