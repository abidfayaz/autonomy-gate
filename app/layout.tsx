import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/config/routes";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} — ${PRODUCT_TAGLINE}`,
  description:
    "A synthetic portfolio prototype demonstrating how AI autonomy is earned and governed at the task level, with evidence, policy versioning and human decisions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={`dark ${inter.variable} ${jetBrainsMono.variable}`} lang="en">
      <head>
        <link href="https://fonts.googleapis.com" rel="preconnect" />
        <link crossOrigin="" href="https://fonts.gstatic.com" rel="preconnect" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex min-h-screen flex-col bg-background font-body-md text-body-md text-on-surface antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
