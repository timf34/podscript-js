"use client";

import Link from "next/link";
import { TranscriptMeta } from "@/lib/types";

interface TranscriptListProps {
  transcripts: TranscriptMeta[];
  isLoading: boolean;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function TranscriptList({
  transcripts,
  isLoading,
}: TranscriptListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 animate-pulse"
          >
            <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4 mb-2" />
            <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (transcripts.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-500">
        <p>No transcripts yet.</p>
        <p className="text-sm mt-1">
          Paste a podcast link above to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transcripts.map((transcript) => (
        <Link
          key={transcript.id}
          href={`/transcript/${transcript.id}`}
          className="block p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
        >
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">{transcript.episodeTitle}</h3>
              <p className="text-sm text-neutral-500 truncate">
                {transcript.podcastName}
              </p>
            </div>
            <div className="text-right text-sm text-neutral-400 shrink-0">
              <div>{formatDate(transcript.createdAt)}</div>
              <div>{formatDuration(transcript.durationSeconds)}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
