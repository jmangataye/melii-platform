import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Melii — bots IA pour créatrices",
  description:
    "Donnez à votre communauté un chatbot IA à votre image, qui fait découvrir votre contenu exclusif étape par étape.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
