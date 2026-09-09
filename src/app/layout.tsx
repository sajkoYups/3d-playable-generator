import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AppToaster } from "@/components/app-toaster";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
});

const sans = Figtree({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ForgePlay",
  description: "Build, customize, and export HTML5 playable ads",
  icons: {
    icon: [
      { url: "/forgeplay-logo/forgeplay-orange.svg", type: "image/svg+xml" },
      { url: "/forgeplay-logo/forgeplay-32.png", sizes: "32x32", type: "image/png" },
      { url: "/forgeplay-logo/forgeplay-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/forgeplay-logo/forgeplay-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          {children}
          <AppToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
