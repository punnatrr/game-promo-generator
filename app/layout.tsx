import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Game Promo Generator",
  description: "สร้างภาพโปรโมตไอเทมเกมจากภาพอ้างอิงด้วย AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
