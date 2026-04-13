import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CorridorKey Studio",
  description: "AI green screen keying — browser edition",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${mono.variable} h-full`}>
      <body className="h-full overflow-hidden bg-[#0a0a0a] text-[#e0e0e0] font-mono">
        {children}
      </body>
    </html>
  );
}
