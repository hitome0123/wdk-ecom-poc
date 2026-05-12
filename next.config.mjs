/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3000"] },
    // WDK and its native deps (sodium-native, bare-*) use dynamic require
    // and native bindings that webpack can't statically bundle. Run them
    // straight from node_modules at runtime instead.
    serverComponentsExternalPackages: [
      "@tetherto/wdk",
      "@tetherto/wdk-wallet-evm",
      "@tetherto/wdk-wallet",
      "sodium-native",
      "sodium-universal",
      "bare-fs",
      "bare-os",
      "bare-crypto",
      "bare-tls",
      "bare-buffer",
      "bare-events",
      "bare-path",
      "bare-stream",
      "udx-native"
    ]
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false
    };
    return config;
  }
};

export default nextConfig;
