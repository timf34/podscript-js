export interface TranscriptSegment {
  speaker: string;        // e.g. "speaker_0", "speaker_1"
  text: string;
  start: number;          // seconds
  end: number;            // seconds
}

export interface Transcript {
  id: string;                  // uuid
  podcastName: string;
  episodeTitle: string;
  episodeUrl: string;          // original URL the user pasted or the episode link
  audioUrl: string;            // direct mp3 URL from RSS
  segments: TranscriptSegment[];
  rawText: string;             // plain text concatenation for search
  durationSeconds: number;
  createdAt: string;           // ISO datetime
  speakerLabels?: Record<string, string>;  // e.g., {"speaker_0": "Joe Rogan"}
}

export type TranscriptMeta = Omit<Transcript, "segments" | "rawText">;

export interface Episode {
  title: string;
  description: string;       // strip HTML tags, truncate to ~200 chars
  publishDate: string;       // ISO date
  audioUrl: string;          // from <enclosure> tag
  duration: string;          // from <itunes:duration>
  guid?: string;             // episode unique identifier
}

export interface PodcastInfo {
  feedUrl: string;
  podcastName: string;
  episodes: Episode[];
}

export interface TranscriptionResult {
  segments: TranscriptSegment[];
  rawText: string;
  durationSeconds: number;
}
