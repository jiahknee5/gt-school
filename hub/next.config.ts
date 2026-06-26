import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Baseline security headers (security finding S7-b). The CSP is shipped
// REPORT-ONLY so it never breaks Next's inline styles/RSC payloads in dev or at
// first deploy — tighten to enforcing (`Content-Security-Policy`) once the running
// app is validated against it. The remaining headers are safe to enforce now.
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // HSTS only in production — sending it over plaintext local dev is meaningless
  // and can pin localhost to https.
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // TEMP STOPGAP (remove once the competing root /app scaffold is retired):
  // A second package-lock.json at the repo root makes Turbopack mis-infer the repo
  // root as the workspace and resolve the WRONG React (19.2.7) for this app (19.2.4),
  // crashing the RSC client manifest ("global-error.js not found"). Pinning the root
  // to this dir forces resolution from hub/node_modules.
  turbopack: { root: "/Users/johnny/projects/gt-school/hub" },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
