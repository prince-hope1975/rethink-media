import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Rethink media",
  description: "Rethink Media is a full-stack AI-powered content generation platform that enables users to generate, edit, and manage media content—including text, images, audio, and video—using advanced AI models. Built with the T3 Stack (Next.js, tRPC, Drizzle ORM, Tailwind CSS), it features a modern UI, type-safe APIs, and seamless integration with Google GenAI and Gemini APIs for state-of-the-art media creation.",
  icons: [{ rel: "icon", url: "/icon.png" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en " className={`${geist.variable}`}>
      <body className="dark">
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
