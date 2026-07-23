import { Geist, Geist_Mono } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ping250.abubakarshaikh.dev";
const DESCRIPTION =
  "Verify SMTP credentials and send a real test message with Nodemailer. Clear, human-readable diagnostics for auth failures, timeouts and DNS misconfiguration - no stack traces, no stored credentials.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Ping250 - Send a test. Get a 250.",
    template: "%s · Ping250",
  },
  description: DESCRIPTION,
  applicationName: "Ping250 by Abubakar Shaikh",
  authors: [{ name: "Abubakar Shaikh", url: "https://abubakarshaikh.dev" }],
  creator: "Abubakar Shaikh",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Ping250 by Abubakar Shaikh",
    title: "Ping250 - Send a test. Get a 250.",
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ping250 - Send a test. Get a 250.",
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e12" },
  ],
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Ping250",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  description: DESCRIPTION,
  url: APP_URL,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Verify SMTP connections with Nodemailer",
    "Send a real test email with plain or HTML body",
    "Human-readable SMTP error diagnostics",
    "SPF, DKIM and DMARC deliverability checks",
    "Client-side encrypted SMTP profiles",
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="bg-background text-foreground antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  var root = document.documentElement;
                  var resolved = theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  root.classList.remove('light', 'dark');
                  root.classList.add(resolved);
                  root.style.colorScheme = resolved;
                } catch(e) {}
              })();
            `,
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="system" disableTransitionOnChange>
          <a
            href="#console"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
          >
            Skip to the console
          </a>
          <SiteHeader />
          {children}
          <SiteFooter />
        </ThemeProvider>
        <script
          type="application/ld+json"
          // Safe: a static, build-time constant with no user input.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
