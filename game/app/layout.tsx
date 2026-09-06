import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const orbitron = localFont({
  src: "../public/fonts/Orbitron-Variable.ttf",
  variable: "--font-orbitron",
  display: "swap",
  weight: "400 900",
});

export const metadata: Metadata = {
  title: "Sector Zero",
  description: "Space shooter — fight through 8 sectors to destroy The Hollow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
      </head>
      <body className={`${spaceMono.variable} ${orbitron.variable} antialiased font-mono`}>
        {children}
      </body>
    </html>
  );
}
