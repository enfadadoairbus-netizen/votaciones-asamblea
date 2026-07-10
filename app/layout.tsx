import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Votaciones de Asamblea",
  description: "Votación en tiempo real para asambleas.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
