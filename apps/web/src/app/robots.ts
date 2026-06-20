import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXTAUTH_URL || "https://stratiumetrics.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/register", "/login"],
        disallow: ["/dashboard/", "/api/", "/invite/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
