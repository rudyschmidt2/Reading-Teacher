import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { HouseProvider } from "@/lib/store";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Reading Teacher",
  description: "Phonics adventure for Riley, Hudson, Myles, and Cassidy.",
  applicationName: "Reading Teacher",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Reading Teacher" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0f0b2e",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable} h-full`}>
      <body className="min-h-full">
        <HouseProvider>{children}</HouseProvider>
      </body>
    </html>
  );
}
