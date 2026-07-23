import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Nodemailer is a CommonJS Node library that pulls in `net`/`tls`; keep it
  // out of the bundler so server routes import the real module at runtime.
  serverExternalPackages: ["nodemailer"],
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
