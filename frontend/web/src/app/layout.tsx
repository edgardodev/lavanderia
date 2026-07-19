import type { Metadata } from "next";
import "./globals.css";
import NavigationProgress from "@/components/NavigationProgress";

export const metadata: Metadata = {
  title: "La Lavandería & Bakery",
  description: "Reserva lavado, agenda domicilio y recibe notificaciones del estado de tu ropa.",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <NavigationProgress />
        {children}
      </body>
    </html>
  );
}
