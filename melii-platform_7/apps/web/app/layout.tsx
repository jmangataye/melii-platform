import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://melii-foor.onrender.com";
const TITLE = "Melii — bots IA pour créatrices";
const DESCRIPTION =
  "Donnez à votre communauté un chatbot IA à votre image, qui fait découvrir votre contenu exclusif étape par étape.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s · melii." },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "melii.",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
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
