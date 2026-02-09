import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { Transcript, TranscriptMeta } from "../types";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "eu-west-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || "podscript-data";
const TRANSCRIPTS_KEY = "transcripts.json";

async function streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return new TextDecoder().decode(result);
}

/**
 * Fetch all transcripts from S3
 */
export async function fetchTranscripts(): Promise<Transcript[]> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: TRANSCRIPTS_KEY,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      return [];
    }

    const bodyString = await streamToString(
      response.Body as ReadableStream<Uint8Array>
    );
    return JSON.parse(bodyString) as Transcript[];
  } catch (error: unknown) {
    // If the file doesn't exist yet, return empty array
    if (
      error instanceof Error &&
      "name" in error &&
      error.name === "NoSuchKey"
    ) {
      return [];
    }
    throw error;
  }
}

/**
 * Save transcripts array to S3
 */
async function saveTranscripts(transcripts: Transcript[]): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: TRANSCRIPTS_KEY,
    Body: JSON.stringify(transcripts, null, 2),
    ContentType: "application/json",
  });

  await s3Client.send(command);
}

/**
 * Save a new transcript
 */
export async function saveTranscript(transcript: Transcript): Promise<void> {
  const transcripts = await fetchTranscripts();
  transcripts.unshift(transcript); // Add to beginning (most recent first)
  await saveTranscripts(transcripts);
}

/**
 * Get a single transcript by ID
 */
export async function getTranscript(id: string): Promise<Transcript | null> {
  const transcripts = await fetchTranscripts();
  return transcripts.find((t) => t.id === id) || null;
}

/**
 * Get all transcripts metadata (without segments and rawText for lighter payloads)
 */
export async function getAllTranscriptsMeta(): Promise<TranscriptMeta[]> {
  const transcripts = await fetchTranscripts();
  return transcripts.map(({ segments, rawText, ...meta }) => meta);
}

/**
 * Delete a transcript by ID
 */
export async function deleteTranscript(id: string): Promise<void> {
  const transcripts = await fetchTranscripts();
  const filtered = transcripts.filter((t) => t.id !== id);
  await saveTranscripts(filtered);
}

/**
 * Update speaker labels for a transcript
 */
export async function updateSpeakerLabels(
  id: string,
  labels: Record<string, string>
): Promise<Transcript | null> {
  const transcripts = await fetchTranscripts();
  const index = transcripts.findIndex((t) => t.id === id);

  if (index === -1) {
    return null;
  }

  transcripts[index].speakerLabels = labels;
  await saveTranscripts(transcripts);

  return transcripts[index];
}
