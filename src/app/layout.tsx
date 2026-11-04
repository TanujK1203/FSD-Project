import type { Metadata, Viewport } from "next";
import { Albert_Sans } from "next/font/google";
import { SITE } from "@/config";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { themeInitScript } from "@/components/ThemeSwitch";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/components.css";
import "@/styles/motion.css";

const albert = Albert_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-albert",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: SITE.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f6" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={albert.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Header />
        <main className="page" id="main">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
