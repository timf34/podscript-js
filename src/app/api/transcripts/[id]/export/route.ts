import { NextRequest, NextResponse } from "next/server";
import { getTranscript } from "@/lib/services/storage";
import { Transcript, TranscriptSegment } from "@/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function getSpeakerName(
  speaker: string,
  speakerLabels?: Record<string, string>
): string {
  if (speakerLabels && speakerLabels[speaker]) {
    return speakerLabels[speaker];
  }
  // Convert "speaker_0" to "Speaker 1"
  const match = speaker.match(/speaker_(\d+)/);
  if (match) {
    return `Speaker ${parseInt(match[1], 10) + 1}`;
  }
  return speaker;
}

function generateMarkdown(transcript: Transcript): string {
  const lines: string[] = [];

  lines.push(`# ${transcript.episodeTitle}`);
  lines.push("");
  lines.push(`**Podcast:** ${transcript.podcastName}`);
  lines.push(`**Date:** ${new Date(transcript.createdAt).toLocaleDateString()}`);
  lines.push(`**Duration:** ${formatTimestamp(transcript.durationSeconds)}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  let currentSpeaker = "";

  for (const segment of transcript.segments) {
    const speakerName = getSpeakerName(segment.speaker, transcript.speakerLabels);

    if (speakerName !== currentSpeaker) {
      lines.push(`## ${speakerName}`);
      currentSpeaker = speakerName;
    }

    lines.push(`[${formatTimestamp(segment.start)}] ${segment.text}`);
    lines.push("");
  }

  return lines.join("\n");
}

function generateHtml(transcript: Transcript): string {
  const speakerColors: Record<string, string> = {
    speaker_0: "#6B7BA8",
    speaker_1: "#C27B5C",
    speaker_2: "#7A9E7A",
    speaker_3: "#9B7BA8",
    speaker_4: "#A89B6B",
    speaker_5: "#5C9EC2",
  };

  const getSpeakerColor = (speaker: string): string => {
    return speakerColors[speaker] || "#666666";
  };

  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const segmentsHtml = transcript.segments
    .map((segment: TranscriptSegment) => {
      const speakerName = getSpeakerName(segment.speaker, transcript.speakerLabels);
      const color = getSpeakerColor(segment.speaker);

      return `
        <div class="segment">
          <div class="segment-header">
            <span class="speaker" style="color: ${color}">${escapeHtml(speakerName)}</span>
            <span class="timestamp">${formatTimestamp(segment.start)}</span>
          </div>
          <p class="text">${escapeHtml(segment.text)}</p>
        </div>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(transcript.episodeTitle)} - Transcript</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: Georgia, 'Times New Roman', Times, serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.7;
      color: #1a1a1a;
      background: #fafafa;
    }
    header {
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #e0e0e0;
    }
    h1 {
      font-size: 1.75rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .meta {
      color: #666;
      font-size: 0.9rem;
    }
    .meta span {
      margin-right: 1.5rem;
    }
    .segment {
      margin-bottom: 1.5rem;
    }
    .segment-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 0.25rem;
    }
    .speaker {
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 0.9rem;
    }
    .timestamp {
      color: #999;
      font-family: monospace;
      font-size: 0.8rem;
    }
    .text {
      font-size: 1.1rem;
    }
    @media (prefers-color-scheme: dark) {
      body {
        background: #1a1a1a;
        color: #e0e0e0;
      }
      header {
        border-bottom-color: #333;
      }
      .meta {
        color: #999;
      }
      .timestamp {
        color: #666;
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(transcript.episodeTitle)}</h1>
    <div class="meta">
      <span><strong>Podcast:</strong> ${escapeHtml(transcript.podcastName)}</span>
      <span><strong>Date:</strong> ${new Date(transcript.createdAt).toLocaleDateString()}</span>
      <span><strong>Duration:</strong> ${formatTimestamp(transcript.durationSeconds)}</span>
    </div>
  </header>
  <main>
    ${segmentsHtml}
  </main>
</body>
</html>`;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "md";

    const transcript = await getTranscript(id);

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcript not found" },
        { status: 404 }
      );
    }

    const safeFilename = transcript.episodeTitle
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 50);

    if (format === "html") {
      const html = generateHtml(transcript);
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeFilename}.html"`,
        },
      });
    }

    // Default to markdown
    const markdown = generateMarkdown(transcript);
    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFilename}.md"`,
      },
    });
  } catch (error) {
    console.error("Error exporting transcript:", error);
    const message = error instanceof Error ? error.message : "Failed to export transcript";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
