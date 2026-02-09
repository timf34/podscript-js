import { NextRequest, NextResponse } from "next/server";
import { getTranscript, deleteTranscript, updateSpeakerLabels } from "@/lib/services/storage";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const transcript = await getTranscript(id);

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcript not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(transcript);
  } catch (error) {
    console.error("Error fetching transcript:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch transcript";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    await deleteTranscript(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting transcript:", error);
    const message = error instanceof Error ? error.message : "Failed to delete transcript";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { speakerLabels } = body;

    if (!speakerLabels || typeof speakerLabels !== "object") {
      return NextResponse.json(
        { error: "speakerLabels object is required" },
        { status: 400 }
      );
    }

    const transcript = await updateSpeakerLabels(id, speakerLabels);

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcript not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(transcript);
  } catch (error) {
    console.error("Error updating speaker labels:", error);
    const message = error instanceof Error ? error.message : "Failed to update speaker labels";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
