import { NextResponse } from "next/server";
import { getAllTranscriptsMeta } from "@/lib/services/storage";

export async function GET() {
  try {
    const transcripts = await getAllTranscriptsMeta();
    return NextResponse.json(transcripts);
  } catch (error) {
    console.error("Error fetching transcripts:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch transcripts";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
