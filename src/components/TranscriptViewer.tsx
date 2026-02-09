"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Transcript } from "@/lib/types";
import TranscriptSearch from "./TranscriptSearch";
import ExportButtons from "./ExportButtons";
import SpeakerEditor from "./SpeakerEditor";

interface TranscriptViewerProps {
  transcript: Transcript;
  onSpeakerLabelsUpdate: (labels: Record<string, string>) => Promise<void>;
}

const SPEAKER_COLORS: Record<string, string> = {
  speaker_0: "text-speaker-1",
  speaker_1: "text-speaker-2",
  speaker_2: "text-speaker-3",
  speaker_3: "text-speaker-4",
  speaker_4: "text-speaker-5",
  speaker_5: "text-speaker-6",
};

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getSpeakerName(
  speaker: string,
  speakerLabels?: Record<string, string>
): string {
  if (speakerLabels && speakerLabels[speaker]) {
    return speakerLabels[speaker];
  }
  const match = speaker.match(/speaker_(\d+)/);
  if (match) {
    return `Speaker ${parseInt(match[1], 10) + 1}`;
  }
  return speaker;
}

function getSpeakerColor(speaker: string): string {
  return SPEAKER_COLORS[speaker] || "text-neutral-600";
}

interface Match {
  segmentIndex: number;
  startOffset: number;
  endOffset: number;
}

export default function TranscriptViewer({
  transcript,
  onSpeakerLabelsUpdate,
}: TranscriptViewerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Get unique speakers
  const speakers = useMemo(() => {
    const speakerSet = new Set<string>();
    transcript.segments.forEach((seg) => speakerSet.add(seg.speaker));
    return Array.from(speakerSet).sort();
  }, [transcript.segments]);

  // Find all matches
  const matches = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    const results: Match[] = [];

    transcript.segments.forEach((segment, segmentIndex) => {
      const text = segment.text.toLowerCase();
      let startIndex = 0;

      while (true) {
        const index = text.indexOf(query, startIndex);
        if (index === -1) break;

        results.push({
          segmentIndex,
          startOffset: index,
          endOffset: index + query.length,
        });

        startIndex = index + 1;
      }
    });

    return results;
  }, [searchQuery, transcript.segments]);

  // Scroll to current match
  useEffect(() => {
    if (matches.length > 0 && currentMatchIndex < matches.length) {
      const match = matches[currentMatchIndex];
      const element = segmentRefs.current[match.segmentIndex];
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentMatchIndex, matches]);

  // Reset match index when query changes
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchQuery]);

  const handleNext = useCallback(() => {
    if (matches.length > 0) {
      setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
    }
  }, [matches.length]);

  const handlePrevious = useCallback(() => {
    if (matches.length > 0) {
      setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
    }
  }, [matches.length]);

  // Highlight text with search matches
  const highlightText = (text: string, segmentIndex: number) => {
    if (!searchQuery.trim()) return text;

    const segmentMatches = matches.filter((m) => m.segmentIndex === segmentIndex);
    if (segmentMatches.length === 0) return text;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    segmentMatches.forEach((match, idx) => {
      // Text before match
      if (match.startOffset > lastIndex) {
        parts.push(text.slice(lastIndex, match.startOffset));
      }

      // Check if this is the current match
      const globalMatchIndex = matches.findIndex(
        (m) =>
          m.segmentIndex === segmentIndex &&
          m.startOffset === match.startOffset
      );
      const isCurrentMatch = globalMatchIndex === currentMatchIndex;

      // Highlighted match
      parts.push(
        <mark
          key={idx}
          className={
            isCurrentMatch
              ? "search-highlight-current"
              : "search-highlight"
          }
        >
          {text.slice(match.startOffset, match.endOffset)}
        </mark>
      );

      lastIndex = match.endOffset;
    });

    // Text after last match
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  return (
    <div className="w-full">
      {/* Header */}
      <header className="mb-8 pb-6 border-b border-neutral-200 dark:border-neutral-700">
        <h1 className="text-2xl font-semibold mb-2">{transcript.episodeTitle}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-neutral-500 text-sm mb-4">
          <span>{transcript.podcastName}</span>
          <span>•</span>
          <span>
            {new Date(transcript.createdAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <span>•</span>
          <span>{formatDuration(transcript.durationSeconds)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ExportButtons transcriptId={transcript.id} />
          <SpeakerEditor
            speakers={speakers}
            speakerLabels={transcript.speakerLabels || {}}
            onSave={onSpeakerLabelsUpdate}
          />
        </div>
      </header>

      {/* Search */}
      <div className="mb-6">
        <TranscriptSearch
          onSearch={setSearchQuery}
          matchCount={matches.length}
          currentMatch={matches.length > 0 ? currentMatchIndex + 1 : 0}
          onNext={handleNext}
          onPrevious={handlePrevious}
        />
      </div>

      {/* Transcript content */}
      <div className="transcript-container space-y-6">
        {transcript.segments.map((segment, index) => {
          const speakerName = getSpeakerName(
            segment.speaker,
            transcript.speakerLabels
          );
          const speakerColor = getSpeakerColor(segment.speaker);

          return (
            <div
              key={index}
              ref={(el) => {
                segmentRefs.current[index] = el;
              }}
              className="group"
            >
              <div className="flex items-center gap-3 mb-1">
                <span className={`font-medium text-sm ${speakerColor}`}>
                  {speakerName}
                </span>
                <span className="text-xs text-neutral-400 font-mono">
                  {formatTimestamp(segment.start)}
                </span>
              </div>
              <p className="transcript-text text-neutral-800 dark:text-neutral-200">
                {highlightText(segment.text, index)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
