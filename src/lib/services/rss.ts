import { XMLParser } from "fast-xml-parser";
import * as cheerio from "cheerio";
import { Episode, PodcastInfo } from "../types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

/**
 * Strip HTML tags and truncate text
 */
function cleanDescription(html: string | undefined, maxLength: number = 200): string {
  if (!html) return "";
  // Remove HTML tags
  const text = html.replace(/<[^>]*>/g, "").trim();
  // Truncate
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

/**
 * Format duration from various formats to human readable
 */
function formatDuration(duration: string | number | undefined): string {
  if (!duration) return "";

  // If it's a number (seconds), convert to HH:MM:SS
  if (typeof duration === "number") {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = Math.floor(duration % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  // If it's already in HH:MM:SS format, return as-is
  if (typeof duration === "string" && duration.includes(":")) {
    return duration;
  }

  // If it's seconds as a string
  const seconds = parseInt(duration, 10);
  if (!isNaN(seconds)) {
    return formatDuration(seconds);
  }

  return duration.toString();
}

/**
 * Check if URL returns XML content
 */
async function isXmlContent(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    const contentType = response.headers.get("content-type") || "";
    return (
      contentType.includes("xml") ||
      contentType.includes("rss") ||
      contentType.includes("atom")
    );
  } catch {
    return false;
  }
}

/**
 * Try to find RSS feed URL from HTML page
 */
async function findRssFeedInHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Look for RSS link in head
    const rssLink = $(
      'link[rel="alternate"][type="application/rss+xml"], link[rel="alternate"][type="application/atom+xml"]'
    ).attr("href");

    if (rssLink) {
      // Handle relative URLs
      return new URL(rssLink, url).toString();
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract RSS feed URL from Podcast Addict page
 */
async function extractPodcastAddictFeed(url: string): Promise<{ feedUrl: string; podcastName: string } | null> {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Try to find RSS feed URL in the page
    // Podcast Addict shows the feed URL in various places

    // Look for RSS link
    let feedUrl = $('a[href*="feed"], a[href*="rss"]').attr("href");

    // Look in meta tags
    if (!feedUrl) {
      feedUrl = $('meta[property="og:url"]').attr("content");
    }

    // Look for feed URL in page content (Podcast Addict often shows it)
    if (!feedUrl) {
      const pageText = $.html();
      const feedMatch = pageText.match(/https?:\/\/[^\s"<>]+(?:feed|rss|xml)[^\s"<>]*/i);
      if (feedMatch) {
        feedUrl = feedMatch[0];
      }
    }

    // Get podcast name
    const podcastName = $("h1").first().text().trim() ||
      $('meta[property="og:title"]').attr("content") ||
      "Unknown Podcast";

    if (feedUrl && feedUrl.includes("http")) {
      return { feedUrl, podcastName };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve a URL to an RSS feed URL
 */
export async function resolveToRssFeed(
  url: string
): Promise<{ feedUrl: string; podcastName: string }> {
  const trimmedUrl = url.trim();

  // Check if it's a direct RSS feed URL
  if (
    trimmedUrl.endsWith(".xml") ||
    trimmedUrl.endsWith(".rss") ||
    trimmedUrl.includes("/feed") ||
    (await isXmlContent(trimmedUrl))
  ) {
    // Parse it to get the podcast name
    try {
      const response = await fetch(trimmedUrl);
      const xml = await response.text();
      const parsed = parser.parse(xml);
      const channel = parsed.rss?.channel || parsed.feed;
      const podcastName =
        channel?.title || channel?.["itunes:author"] || "Unknown Podcast";

      return { feedUrl: trimmedUrl, podcastName };
    } catch {
      return { feedUrl: trimmedUrl, podcastName: "Unknown Podcast" };
    }
  }

  // Handle Podcast Addict URLs
  if (trimmedUrl.includes("podcastaddict.com")) {
    const result = await extractPodcastAddictFeed(trimmedUrl);
    if (result) {
      return result;
    }
    throw new Error(
      "Could not extract RSS feed from Podcast Addict URL. Try getting the RSS feed URL directly from the Podcast Addict app."
    );
  }

  // Handle Apple Podcasts URLs (deferred but basic support)
  if (trimmedUrl.includes("podcasts.apple.com")) {
    const idMatch = trimmedUrl.match(/id(\d+)/);
    if (idMatch) {
      const podcastId = idMatch[1];
      const lookupResponse = await fetch(
        `https://itunes.apple.com/lookup?id=${podcastId}&entity=podcast`
      );
      const lookupData = await lookupResponse.json();

      if (lookupData.results && lookupData.results.length > 0) {
        const result = lookupData.results[0];
        return {
          feedUrl: result.feedUrl,
          podcastName: result.collectionName || result.trackName || "Unknown Podcast",
        };
      }
    }
    throw new Error("Could not find podcast feed from Apple Podcasts URL.");
  }

  // Generic website - try to find RSS feed in HTML
  const rssFeed = await findRssFeedInHtml(trimmedUrl);
  if (rssFeed) {
    const response = await fetch(rssFeed);
    const xml = await response.text();
    const parsed = parser.parse(xml);
    const channel = parsed.rss?.channel || parsed.feed;
    const podcastName =
      channel?.title || channel?.["itunes:author"] || "Unknown Podcast";

    return { feedUrl: rssFeed, podcastName };
  }

  // Try common feed paths
  const baseUrl = new URL(trimmedUrl);
  const commonPaths = ["/feed", "/rss", "/feed.xml", "/rss.xml", "/podcast.xml"];

  for (const path of commonPaths) {
    const testUrl = new URL(path, baseUrl).toString();
    if (await isXmlContent(testUrl)) {
      const response = await fetch(testUrl);
      const xml = await response.text();
      const parsed = parser.parse(xml);
      const channel = parsed.rss?.channel || parsed.feed;
      const podcastName =
        channel?.title || channel?.["itunes:author"] || "Unknown Podcast";

      return { feedUrl: testUrl, podcastName };
    }
  }

  throw new Error(
    "Could not find RSS feed. Try pasting the direct RSS feed URL instead."
  );
}

/**
 * Parse episodes from an RSS feed
 */
export async function parseEpisodes(feedUrl: string): Promise<Episode[]> {
  const response = await fetch(feedUrl);
  const xml = await response.text();
  const parsed = parser.parse(xml);

  const channel = parsed.rss?.channel;
  if (!channel) {
    throw new Error("Invalid RSS feed: no channel found");
  }

  const items = channel.item;
  if (!items) {
    return [];
  }

  // Ensure items is an array
  const itemArray = Array.isArray(items) ? items : [items];

  const episodes: Episode[] = itemArray
    .map((item: Record<string, unknown>): Episode | null => {
      // Get audio URL from enclosure
      const enclosure = item.enclosure as Record<string, string> | undefined;
      const audioUrl = enclosure?.["@_url"];

      if (!audioUrl) {
        return null; // Skip episodes without audio
      }

      return {
        title: (item.title as string) || "Untitled Episode",
        description: cleanDescription(
          (item.description as string) || (item["itunes:summary"] as string)
        ),
        publishDate: (item.pubDate as string) || "",
        audioUrl,
        duration: formatDuration(item["itunes:duration"] as string | number),
        guid: (item.guid as string) || ((item.guid as Record<string, string>)?.["#text"]),
      };
    })
    .filter((ep): ep is Episode => ep !== null)
    .slice(0, 50); // Return most recent 50 episodes

  return episodes;
}

/**
 * Resolve URL and get podcast info with episodes
 */
export async function getPodcastInfo(url: string): Promise<PodcastInfo> {
  const { feedUrl, podcastName } = await resolveToRssFeed(url);
  const episodes = await parseEpisodes(feedUrl);

  return {
    feedUrl,
    podcastName,
    episodes,
  };
}
