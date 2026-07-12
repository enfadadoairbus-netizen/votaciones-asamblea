"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";

const base = [
  { href: "/app/votaciones", label: "En curso", gated: true },
  { href: "/app/estadisticas", label: "Estadísticas", gated: true },
  { href: "/app/perfil", label: "Perfil", gated: false },
];

export default function Nav({
  role,
  verified,
  requireVerification,
}: {
  role: Role;
  verified: boolean;
  requireVerification: boolean;
}) {
  const pathname = usePathname();
  const tabs = [...base];
  if (role === "organizer" || role === "admin")
    tabs.splice(1, 0, { href: "/app/crear", label: "Crear", gated: false });
  if (role === "admin") tabs.push({ href: "/app/admin", label: "Admin", gated: false });

  // Empleado sin verificar: no puede votar ni ver estadísticas (solo si se exige verificación).
  const locked = role === "employee" && requireVerification && !verified;

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-black/10 bg-card px-2">
      {tabs.map((t) => {
        const isLocked = locked && t.gated;
        if (isLocked) {
          return (
            <Link
              key={t.href}
              href="/app/perfil"
              title="Verifica tu correo corporativo para acceder"
              className="whitespace-nowrap px-3 py-3 text-sm font-medium border-b-2 -mb-px border-transparent text-muted/60"
            >
              🔒 {t.label}
            </Link>
          );
        }
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
