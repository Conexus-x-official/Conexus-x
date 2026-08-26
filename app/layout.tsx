import type { Metadata } from "next";
import { DM_Sans, Geist, Geist_Mono, Google_Sans, Istok_Web, Jost, Oswald } from "next/font/google";
import "./globals.css";
import Providers from "./providers/auth.provider";
import ThemeProviderWrapper from "./providers/theme.provider";
import StoreProvider from "./providers/store.provider";
import Toaster from "@/components/ui/toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const google_sans = Google_Sans({
  variable: "--font-google-sans",
  subsets: ["latin"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
});

const DmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const istokweb = Istok_Web({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-istokweb",
})
export const metadata: Metadata = {
  title: "Conexus X",
  description: "CRM Application",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode; }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${oswald.variable} ${geistMono.variable} ${DmSans.variable} ${jost.variable} ${istokweb.variable} ${google_sans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-canvas text-body">
        <StoreProvider>
          <Providers>
            <ThemeProviderWrapper>
              <div className="flex min-h-screen w-full">
                <main className="flex-1 min-w-0 overflow-auto"> {children} </main>
              </div>

              {/* One mount for the whole app; toasts are raised by window event. */}
              <Toaster />
            </ThemeProviderWrapper>
          </Providers>
        </StoreProvider>
      </body>
    </html>
  );
}