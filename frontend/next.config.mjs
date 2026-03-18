/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: ['reactflow', 'recharts', 'lucide-react'],
  output: 'standalone',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
