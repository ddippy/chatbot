import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // ให้ Next.js คง ONNX Runtime เป็น Node.js package และแนบไปกับ API ที่ใช้ RAG
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
  outputFileTracingIncludes: {
    "/api/chat": [
      "./node_modules/onnxruntime-node/**/*",
      "./node_modules/.pnpm/@huggingface+transformers@*/node_modules/onnxruntime-node/**/*",
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
