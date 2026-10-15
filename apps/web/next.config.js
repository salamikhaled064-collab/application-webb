/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // "standalone" uniquement pour Docker (Dockerfile.web) ; `next start` sur Render n'en a pas besoin.
  ...(process.env.DOCKER_BUILD ? { output: "standalone" } : {}),
  images: { remotePatterns: [] },
};

module.exports = nextConfig;
