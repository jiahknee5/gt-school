import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TEMP STOPGAP (remove once the competing root /app scaffold is retired):
  // A second package-lock.json at the repo root makes Turbopack mis-infer the repo
  // root as the workspace and resolve the WRONG React (19.2.7) for this app (19.2.4),
  // crashing the RSC client manifest ("global-error.js not found"). Pinning the root
  // to this dir forces resolution from hub/node_modules.
  turbopack: { root: "/Users/johnny/projects/gt-school/hub" },
};

export default nextConfig;
