import type { NextConfig } from "next";
import { wrapNextjsConfigWithBraintrust } from "braintrust/next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["braintrust", "pdfjs-dist"],
};

export default wrapNextjsConfigWithBraintrust(nextConfig);
