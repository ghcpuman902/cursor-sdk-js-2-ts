import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Multi-Repo Agent Manager | AI-Powered Repository Maintenance",
  description: "Manage and maintain multiple code repositories in parallel using AI agents. Automated TypeScript migration, framework upgrades, documentation, and dependency updates powered by Cursor SDK.",
  keywords: [
    "AI code assistant",
    "repository management",
    "parallel execution",
    "Cursor SDK",
    "TypeScript migration",
    "framework upgrade",
    "dependency updates",
    "code automation",
    "Next.js",
    "React",
    "developer tools",
    "multi-repo manager",
  ],
  authors: [{ name: "Cursor SDK Community" }],
  creator: "Cursor SDK",
  publisher: "Cursor SDK",
  applicationName: "Multi-Repo Agent Manager",
  category: "Developer Tools",
  classification: "Development Tool",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://github.com/cursor-ai/multi-repo-agent-manager",
    siteName: "Multi-Repo Agent Manager",
    title: "Multi-Repo Agent Manager | AI-Powered Repository Maintenance",
    description: "Manage multiple repositories simultaneously with AI agents. Automate TypeScript migration, framework upgrades, and maintenance tasks across your entire codebase portfolio.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Multi-Repo Agent Manager - AI-powered repository maintenance",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Multi-Repo Agent Manager | AI-Powered Repository Maintenance",
    description: "Manage multiple repositories simultaneously with AI agents. Automate maintenance tasks across your entire codebase portfolio.",
    images: ["/og-image.png"],
    creator: "@cursor_ai",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
