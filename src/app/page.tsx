"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import URLInput from "@/components/URLInput";
import EpisodePicker from "@/components/EpisodePicker";
import TranscriptList from "@/components/TranscriptList";
import { Episode, TranscriptMeta, PodcastInfo } from "@/lib/types";

type ViewState = "input" | "episodes";

export default function Home() {
  const router = useRouter();
  const [viewState, setViewState] = useState<ViewState>("input");
  const [isResolving, setIsResolving] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribingEpisode, setTranscribingEpisode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [podcastInfo, setPodcastInfo] = useState<PodcastInfo | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptMeta[]>([]);
  const [isLoadingTranscripts, setIsLoadingTranscripts] = useState(true);

  // Fetch transcripts on mount
  useEffect(() => {
    async function fetchTranscripts() {
      try {
        const response = await fetch("/api/transcripts");
        if (response.ok) {
          const data = await response.json();
          setTranscripts(data);
        }
      } catch (err) {
        console.error("Failed to fetch transcripts:", err);
      } finally {
        setIsLoadingTranscripts(false);
      }
    }
    fetchTranscripts();
  }, []);

  const handleUrlSubmit = async (url: string) => {
    setIsResolving(true);
    setError(null);

    try {
      const response = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to resolve URL");
      }

      setPodcastInfo(data);
      setViewState("episodes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsResolving(false);
    }
  };

  const handleEpisodeSelect = async (episode: Episode) => {
    if (!podcastInfo) return;

    setIsTranscribing(true);
    setTranscribingEpisode(episode.audioUrl);
    setError(null);

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioUrl: episode.audioUrl,
          episodeTitle: episode.title,
          podcastName: podcastInfo.podcastName,
          episodeUrl: episode.guid || episode.audioUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to transcribe episode");
      }

      // Navigate to the transcript view
      router.push(`/transcript/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsTranscribing(false);
      setTranscribingEpisode(null);
    }
  };

  const handleBack = () => {
    setViewState("input");
    setPodcastInfo(null);
    setError(null);
  };

  return (
    <div className="min-h-[80vh] flex flex-col">
      {/* Header */}
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-light tracking-tight text-neutral-800 dark:text-neutral-200">
          podscript
        </h1>
      </header>

      {/* Main content */}
      <div className="flex-1">
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {viewState === "input" && (
          <div className="space-y-12">
            <URLInput onSubmit={handleUrlSubmit} isLoading={isResolving} />

            {isResolving && (
              <div className="text-center text-neutral-500">
                <div className="inline-flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-neutral-400 border-t-neutral-700 dark:border-neutral-600 dark:border-t-neutral-300 rounded-full" />
                  Resolving podcast feed...
                </div>
              </div>
            )}

            {/* Recent transcripts */}
            <div>
              <h2 className="text-lg font-medium mb-4 text-neutral-700 dark:text-neutral-300">
                Recent Transcripts
              </h2>
              <TranscriptList
                transcripts={transcripts}
                isLoading={isLoadingTranscripts}
              />
            </div>
          </div>
        )}

        {viewState === "episodes" && podcastInfo && (
          <EpisodePicker
            podcastName={podcastInfo.podcastName}
            episodes={podcastInfo.episodes}
            onSelect={handleEpisodeSelect}
            onBack={handleBack}
            isTranscribing={isTranscribing}
            transcribingEpisode={transcribingEpisode}
          />
        )}
      </div>
    </div>
  );
}
