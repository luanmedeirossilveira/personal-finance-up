import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contas Cotidiano",
  description: "Controle financeiro pessoal",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  themeColor: "#0f1a16",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
