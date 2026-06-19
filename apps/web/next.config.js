/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@nodecfdi/sat-ws-descarga-masiva"],
  },
};

module.exports = nextConfig;
