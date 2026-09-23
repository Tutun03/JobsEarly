import type { Metadata } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobsEarly — Early Job Discovery Platform",
  description:
    "Discover jobs, internships and career opportunities from companies across India.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>

      <GoogleAnalytics gaId="G-DC5DXBXGL2" />
    </html>
  );
}
