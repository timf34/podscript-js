"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TranscriptViewer from "@/components/TranscriptViewer";
import { Transcript } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TranscriptPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function fetchTranscript() {
      try {
        const response = await fetch(`/api/transcripts/${id}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch transcript");
        }

        setTranscript(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    }

    fetchTranscript();
  }, [id]);

  const handleSpeakerLabelsUpdate = async (labels: Record<string, string>) => {
    const response = await fetch(`/api/transcripts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speakerLabels: labels }),
    });

    if (!response.ok) {
      throw new Error("Failed to update speaker labels");
    }

    const data = await response.json();
    setTranscript(data);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this transcript?")) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/transcripts/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete transcript");
      }

      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center text-neutral-500">
          <div className="inline-flex items-center gap-2">
            <div className="animate-spin h-5 w-5 border-2 border-neutral-400 border-t-neutral-700 dark:border-neutral-600 dark:border-t-neutral-300 rounded-full" />
            Loading transcript...
          </div>
        </div>
      </div>
    );
  }

  if (error || !transcript) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-medium mb-2">Transcript not found</h1>
          <p className="text-neutral-500 mb-4">{error}</p>
          <Link
            href="/"
            className="text-neutral-700 dark:text-neutral-300 hover:underline"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          ← Back
        </Link>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="text-sm text-red-500 hover:text-red-600 disabled:opacity-50"
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>

      <TranscriptViewer
        transcript={transcript}
        onSpeakerLabelsUpdate={handleSpeakerLabelsUpdate}
      />
    </div>
  );
}
