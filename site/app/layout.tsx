import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { serializeJsonLd, VIDEO_GAME_JSON_LD } from "@/lib/structuredData";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const orbitron = localFont({
  src: "../public/fonts/Orbitron-Variable.ttf",
  variable: "--font-orbitron",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sector Zero — Answer the signal",
  description:
    "Pilot a strike fighter through 8 sectors of hostile space. 6 gameplay modes, RPG progression, and the Hollow awaits.",
  authors: [{ name: "Nic Barnes", url: "https://nichalasbarnes.com/" }],
  creator: "Nic Barnes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(VIDEO_GAME_JSON_LD),
          }}
        />
      </head>
      <body className={`${inter.variable} ${orbitron.variable} antialiased`}>
        <div className="min-h-screen flex flex-col">
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <Nav />
          <main id="main-content" tabIndex={-1} className="flex-1">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
