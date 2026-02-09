import { TranscriptionResult, TranscriptSegment } from "../types";

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/speech-to-text";

interface ElevenLabsWord {
  text: string;
  start: number;
  end: number;
  speaker_id?: string;
}

interface ElevenLabsResponse {
  text: string;
  words: ElevenLabsWord[];
  language_code?: string;
}

/**
 * Group words into segments by speaker changes and natural pauses
 */
function groupWordsIntoSegments(words: ElevenLabsWord[]): TranscriptSegment[] {
  if (words.length === 0) {
    return [];
  }

  const segments: TranscriptSegment[] = [];
  let currentSegment: TranscriptSegment | null = null;
  const PAUSE_THRESHOLD = 1.0; // seconds - gap that triggers new segment

  for (const word of words) {
    const speaker = word.speaker_id || "speaker_0";

    // Start a new segment if:
    // 1. This is the first word
    // 2. Speaker changed
    // 3. There's a significant pause (> 1 second)
    const shouldStartNewSegment =
      !currentSegment ||
      currentSegment.speaker !== speaker ||
      (word.start - currentSegment.end > PAUSE_THRESHOLD);

    if (shouldStartNewSegment) {
      if (currentSegment) {
        segments.push(currentSegment);
      }
      currentSegment = {
        speaker,
        text: word.text,
        start: word.start,
        end: word.end,
      };
    } else {
      // Continue current segment
      currentSegment.text += " " + word.text;
      currentSegment.end = word.end;
    }
  }

  // Don't forget the last segment
  if (currentSegment) {
    segments.push(currentSegment);
  }

  // Clean up segment text (remove extra spaces)
  return segments.map((seg) => ({
    ...seg,
    text: seg.text.trim().replace(/\s+/g, " "),
  }));
}

/**
 * Build raw text from segments
 */
function buildRawText(segments: TranscriptSegment[]): string {
  return segments.map((seg) => seg.text).join(" ");
}

/**
 * Transcribe audio using ElevenLabs Scribe API
 * Uses cloud_storage_url to avoid downloading the file
 */
export async function transcribeAudio(
  audioUrl: string
): Promise<TranscriptionResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY environment variable is not set");
  }

  // Create form data with cloud_storage_url instead of file upload
  const formData = new FormData();
  formData.append("cloud_storage_url", audioUrl);
  formData.append("model_id", "scribe_v1");
  formData.append("diarize", "true");
  formData.append("timestamps_granularity", "word");

  const response = await fetch(ELEVENLABS_API_URL, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `ElevenLabs API error (${response.status}): ${errorText}`
    );
  }

  const data: ElevenLabsResponse = await response.json();

  // Group words into segments
  const segments = groupWordsIntoSegments(data.words || []);

  // Build raw text
  const rawText = buildRawText(segments);

  // Calculate duration from last word
  const lastWord = data.words?.[data.words.length - 1];
  const durationSeconds = lastWord?.end || 0;

  return {
    segments,
    rawText,
    durationSeconds,
  };
}

/**
 * Interface for transcription services (for future extensibility)
 */
export interface TranscriptionService {
  transcribe(audioUrl: string): Promise<TranscriptionResult>;
}

/**
 * ElevenLabs transcription service implementation
 */
export const elevenLabsService: TranscriptionService = {
  transcribe: transcribeAudio,
};
