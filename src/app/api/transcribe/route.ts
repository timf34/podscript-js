import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { transcribeAudio } from "@/lib/services/transcription";
import { saveTranscript } from "@/lib/services/storage";
import { Transcript } from "@/lib/types";

// Set max duration for this route (5 minutes for long podcasts)
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { audioUrl, episodeTitle, podcastName, episodeUrl } = body;

    if (!audioUrl || typeof audioUrl !== "string") {
      return NextResponse.json(
        { error: "audioUrl is required" },
        { status: 400 }
      );
    }

    if (!episodeTitle || typeof episodeTitle !== "string") {
      return NextResponse.json(
        { error: "episodeTitle is required" },
        { status: 400 }
      );
    }

    if (!podcastName || typeof podcastName !== "string") {
      return NextResponse.json(
        { error: "podcastName is required" },
        { status: 400 }
      );
    }

    // Transcribe the audio
    const { segments, rawText, durationSeconds } = await transcribeAudio(audioUrl);

    // Create transcript object
    const transcript: Transcript = {
      id: uuidv4(),
      podcastName,
      episodeTitle,
      episodeUrl: episodeUrl || audioUrl,
      audioUrl,
      segments,
      rawText,
      durationSeconds,
      createdAt: new Date().toISOString(),
    };

    // Save to S3
    await saveTranscript(transcript);

    return NextResponse.json(transcript);
  } catch (error) {
    console.error("Error transcribing audio:", error);
    const message = error instanceof Error ? error.message : "Failed to transcribe audio";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
