import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Silkscreen } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alethia",
  description: "Human-centred security practice.",
};

const tactical = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-tactical",
  display: "swap",
});

const pixel = Silkscreen({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-pixel",
  display: "swap",
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={`${tactical.variable} ${pixel.variable}`} lang="id">
      <body>{children}</body>
    </html>
  );
}

