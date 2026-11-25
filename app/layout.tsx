import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Projeto 30 Dias | Evolução",
  description: "Acompanhe alimentação, peso, hidratação e evolução durante 30 dias.",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
