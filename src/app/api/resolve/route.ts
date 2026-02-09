import { NextRequest, NextResponse } from "next/server";
import { getPodcastInfo } from "@/lib/services/rss";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    const podcastInfo = await getPodcastInfo(url);

    return NextResponse.json(podcastInfo);
  } catch (error) {
    console.error("Error resolving URL:", error);
    const message = error instanceof Error ? error.message : "Failed to resolve URL";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
