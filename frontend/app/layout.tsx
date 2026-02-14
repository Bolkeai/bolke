import type { Metadata } from "next";
import { EB_Garamond, Inter, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
  weight: ["400", "600", "800"],
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  variable: "--font-noto-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "600", "800"],
});

export const metadata: Metadata = {
  title: "BolkeAI - Voice Grocery",
  description: "A voice-first grocery shopping assistant for India, featuring real-time price comparison and natural language ordering.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${ebGaramond.variable} ${notoSansDevanagari.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
