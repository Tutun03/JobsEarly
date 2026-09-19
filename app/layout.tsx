import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobsEarly — India's Job Discovery Platform",
  description:
    "Discover jobs, internships and career opportunities from companies across India.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}