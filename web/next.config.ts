import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const originTrialToken = process.env.WEBMCP_ORIGIN_TRIAL_TOKEN;

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  async headers() {
    if (!originTrialToken) return [];
    return [
      {
        source: "/:path*",
        headers: [{ key: "Origin-Trial", value: originTrialToken }],
      },
    ];
  },
};

export default nextConfig;
