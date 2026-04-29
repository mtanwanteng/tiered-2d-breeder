import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin the workspace root for build-time file tracing (serverless output).
  outputFileTracingRoot: projectRoot,
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "development",
  },
  async rewrites() {
    return [
      // Strip Discord's /.proxy/ prefix so our routes work normally inside the activity iframe
      { source: '/.proxy/:path*', destination: '/:path*' },
      // Proxy PostHog through our server so it passes Discord's CSP
      { source: '/ingest/:path*', destination: 'https://us.i.posthog.com/:path*' },
    ]
  },
  // Tell webpack's file watcher (Watchpack) to skip locked Windows system
  // files at the drive root. Without this, the dev server's initial scan
  // walks up to C:\ and emits noisy EINVAL lstat errors against
  // DumpStack.log.tmp / pagefile.sys / hiberfil.sys / swapfile.sys.
  //
  // We replace Next.js's default `ignored` (a RegExp matching node_modules)
  // with a glob array — webpack rejects mixed RegExp + string arrays, so we
  // re-add the node_modules + .next + .git globs ourselves.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.next/**",
          // Locked Windows system files at the drive root.
          "C:/DumpStack.log.tmp",
          "C:/pagefile.sys",
          "C:/hiberfil.sys",
          "C:/swapfile.sys",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
