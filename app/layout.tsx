import "./globals.css";
import "./vision-total-theme.css";
import type { Metadata } from "next";
import { AccountMenu } from "@/components/account-menu";

export const metadata: Metadata = {
  title: "Visión Total OS",
  description: "Sistema operativo comercial y de gestión para Óptica Visión Total."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <AccountMenu />
        {children}
      </body>
    </html>
  );
}
