import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Asamblea Empleados 1J",
  description: "Votación secreta de las propuestas de la asamblea, desde tu móvil.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
