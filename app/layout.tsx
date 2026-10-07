import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Visión Total OS",
  description: "Sistema operativo comercial y de gestión para Óptica Visión Total."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}