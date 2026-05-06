import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "T & A — Admin Panel",
  description: "Admin panel for managing wedding RSVPs.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
