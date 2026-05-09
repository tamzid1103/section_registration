import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PortalNavigation } from "@/components/portal-navigation";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DIU Section Pre-Registration System",
  description: "Smart semester pre-registration and section management for Daffodil International University.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <PortalNavigation />
        <main className="flex-1">
          {children}
        </main>
        <footer className="py-8 text-center text-sm text-slate-500 bg-white border-t mt-auto w-full space-y-1">
          <p className="font-medium text-slate-600">Developed & Maintained by</p>
          <p className="font-bold text-slate-800 text-base">Tamzidul Haque</p>
          <p className="text-slate-500">CSE, Daffodil International University</p>
          <p className="pt-2">
            Need help? Contact me at: <a href="mailto:tamzid.social@gmail.com" className="text-blue-600 font-medium hover:underline">tamzid.social@gmail.com</a>
          </p>
        </footer>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
