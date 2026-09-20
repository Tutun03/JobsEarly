import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Initialize Cloudflare bindings for local development
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {};

export default nextConfig;