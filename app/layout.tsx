import type { Metadata } from "next";
import { DM_Sans, Geist, Geist_Mono, Google_Sans, Istok_Web, Jost, Oswald } from "next/font/google";
import "./globals.css";
import Providers from "./providers/auth.provider";
import ThemeProviderWrapper from "./providers/theme.provider";
import StoreProvider from "./providers/store.provider";
import RealtimeProvider from "./providers/realtime.provider";
import Toaster from "@/components/ui/toast";
import SessionBridge from "@/components/SessionBridge";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

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
/**
 * The site-wide metadata defaults. Every public page overrides `title` and
 * `description` and adds its own canonical (see lib/site.ts `pageMetadata`);
 * what lives here is what none of them should have to restate.
 *
 * `metadataBase` is the load-bearing one: without it Next cannot resolve the
 * relative og:image and canonical paths into the absolute URLs those tags are
 * required to carry, and silently emits neither.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    // A page sets only its own name; the brand is appended once, here, so no
    // page can forget it and none can say it twice.
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["CRM", "collaborative CRM", "workspace", "project tracking", "sales pipeline", "team automation"],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: SITE_URL,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [{ url: "/logo.png", width: 1254, height: 1254, alt: `${SITE_NAME} logo` }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode; }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${oswald.variable} ${geistMono.variable} ${DmSans.variable} ${jost.variable} ${istokweb.variable} ${google_sans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-canvas text-body">
        <StoreProvider>
          {/* Inside the store (it dispatches), above the routes (so a
              navigation never drops the connection). */}
          <RealtimeProvider>
            <Providers>
              <ThemeProviderWrapper>
                <div className="flex min-h-screen w-full">
                  <main className="flex-1 min-w-0 overflow-auto"> {children} </main>
                </div>

                {/* One mount for the whole app; toasts are raised by window event. */}
                <Toaster />

                {/* Renders nothing. Keeps the routing cookie proxy.ts reads in
                    step with the real session in localStorage. */}
                <SessionBridge />
              </ThemeProviderWrapper>
            </Providers>
          </RealtimeProvider>
        </StoreProvider>
      </body>
    </html>
  );
}