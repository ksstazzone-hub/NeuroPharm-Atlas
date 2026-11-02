import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeuroPharm Atlas | Integración biomédica",
  description: "Explorador trazable de farmacogenómica y neurociencias.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
