import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const fileName = req.nextUrl.searchParams.get("fileName") ?? "download";

  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  // Only allow https S3/CDN URLs to prevent SSRF
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }

  if (parsed.protocol !== "https:") {
    return new NextResponse("Only HTTPS URLs are allowed", { status: 400 });
  }

  const upstream = await fetch(url);

  if (!upstream.ok) {
    return new NextResponse("Failed to fetch file", { status: upstream.status });
  }

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
