"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";

const base = [
  { href: "/app/votaciones", label: "En curso" },
  { href: "/app/estadisticas", label: "Estadísticas" },
  { href: "/app/perfil", label: "Perfil" },
];

export default function Nav({ role }: { role: Role }) {
  const pathname = usePathname();
  const tabs = [...base];
  if (role === "organizer" || role === "admin")
    tabs.splice(1, 0, { href: "/app/crear", label: "Crear" });
  if (role === "admin") tabs.push({ href: "/app/admin", label: "Admin" });

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-black/10 bg-card px-2">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={
              "whitespace-nowrap px-3 py-3 text-sm font-medium border-b-2 -mb-px " +
              (active
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-ink")
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
