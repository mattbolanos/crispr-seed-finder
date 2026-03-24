import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/app/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Seed Finder Tool — CRISPR",
  description: "PAM-proximal seed matches in TSS regions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="m-auto max-w-3xl dark">
        <Providers>
          <main className="relative min-h-screen p-6 pt-20 md:p-16 md:pt-20">
            {/* Decorative DNA strand accent */}
            <div className="pointer-events-none absolute -left-32 top-1/5 h-96 w-64 rotate-12 opacity-[0.04]">
              <svg
                viewBox="0 0 200 600"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <title>DNA Strand</title>
                <path
                  d="M40 0C40 0 160 75 160 150C160 225 40 300 40 375C40 450 160 525 160 600"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M160 0C160 0 40 75 40 150C40 225 160 300 160 375C160 450 40 525 40 600"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                {[75, 150, 225, 300, 375, 450, 525].map((y) => (
                  <line
                    key={y}
                    x1="60"
                    y1={y}
                    x2="140"
                    y2={y}
                    stroke="currentColor"
                    strokeWidth="1"
                    opacity="0.5"
                  />
                ))}
              </svg>
            </div>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
