#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fetch_1 = __importDefault(require("node-fetch"));
const dotenv_1 = require("dotenv");
const path_1 = require("path");
const fast_xml_parser_1 = require("fast-xml-parser");
const cheerio = __importStar(require("cheerio"));
const fs_1 = require("fs");
const os_1 = require("os");
const child_process_1 = require("child_process");
const readline = __importStar(require("readline"));
// Load .env from project root
(0, dotenv_1.config)({ path: (0, path_1.resolve)(__dirname, "../.env") });
// XML Parser
const parser = new fast_xml_parser_1.XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
});
// Helpers
function cleanDescription(html, maxLength = 200) {
    if (!html)
        return "";
    const text = html.replace(/<[^>]*>/g, "").trim();
    if (text.length <= maxLength)
        return text;
    return text.slice(0, maxLength).trim() + "...";
}
function formatDuration(duration) {
    if (!duration)
        return "";
    if (typeof duration === "number") {
        const hours = Math.floor(duration / 3600);
        const minutes = Math.floor((duration % 3600) / 60);
        const seconds = Math.floor(duration % 60);
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }
    if (typeof duration === "string" && duration.includes(":")) {
        return duration;
    }
    const seconds = parseInt(duration, 10);
    if (!isNaN(seconds)) {
        return formatDuration(seconds);
    }
    return duration.toString();
}
function formatTimestamp(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
// YouTube Functions
function isYouTubeUrl(url) {
    return /(?:youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\/)/.test(url);
}
function getYtDlpCommand() {
    // Try direct yt-dlp first, fall back to python module
    try {
        (0, child_process_1.execSync)("yt-dlp --version", { stdio: "ignore" });
        return "yt-dlp";
    }
    catch {
        try {
            (0, child_process_1.execSync)("python -m yt_dlp --version", { stdio: "ignore" });
            return "python -m yt_dlp";
        }
        catch {
            throw new Error("yt-dlp is not installed. Install it with: pip install yt-dlp\n" +
                "You also need ffmpeg installed for audio extraction.");
        }
    }
}
function cleanYouTubeUrl(url) {
    // Strip timestamp parameters - yt-dlp doesn't need them and & causes shell issues
    try {
        const parsed = new URL(url);
        parsed.searchParams.delete("t");
        return parsed.toString();
    }
    catch {
        return url;
    }
}
function downloadYouTubeAudio(url) {
    const ytDlp = getYtDlpCommand();
    const cleanUrl = cleanYouTubeUrl(url);
    const tempDir = (0, os_1.tmpdir)();
    const tempBase = (0, path_1.join)(tempDir, `podscript-${Date.now()}`);
    const tempOutput = `${tempBase}.%(ext)s`;
    // Get video metadata
    console.log("Fetching video info...\n");
    const jsonRaw = (0, child_process_1.execSync)(`${ytDlp} --no-download --dump-json "${cleanUrl}"`, { encoding: "utf-8", timeout: 60000, maxBuffer: 10 * 1024 * 1024 });
    const videoInfo = JSON.parse(jsonRaw);
    const title = videoInfo.title || "Untitled";
    const channel = videoInfo.channel || videoInfo.uploader || "Unknown";
    const duration = videoInfo.duration || 0;
    console.log(`Title: ${title}`);
    console.log(`Channel: ${channel}`);
    console.log(`Duration: ${formatDuration(duration)}\n`);
    // Download audio only as mp3
    console.log("Downloading audio...");
    (0, child_process_1.execSync)(`${ytDlp} -x --audio-format mp3 --audio-quality 0 -o "${tempOutput}" "${cleanUrl}"`, { stdio: "inherit", timeout: 600000 });
    const audioPath = `${tempBase}.mp3`;
    if (!(0, fs_1.existsSync)(audioPath)) {
        throw new Error(`Audio download failed - expected file at ${audioPath}`);
    }
    const fileSizeMB = (0, fs_1.readFileSync)(audioPath).length / (1024 * 1024);
    console.log(`Downloaded: ${fileSizeMB.toFixed(1)} MB\n`);
    return { title, channel, audioPath, duration };
}
// RSS Functions
async function isXmlContent(url) {
    try {
        const response = await (0, node_fetch_1.default)(url, { method: "HEAD" });
        const contentType = response.headers.get("content-type") || "";
        return contentType.includes("xml") || contentType.includes("rss") || contentType.includes("atom");
    }
    catch {
        return false;
    }
}
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
async function extractPodcastAddictFeed(url) {
    try {
        const response = await (0, node_fetch_1.default)(url, {
            headers: { "User-Agent": USER_AGENT },
        });
        if (!response.ok) {
            console.error(`Podcast Addict returned ${response.status}`);
            return null;
        }
        const html = await response.text();
        const $ = cheerio.load(html);
        // Look for RSS feed URL in the page - check multiple sources
        let feedUrl;
        // Check link tags
        feedUrl = $('link[type="application/rss+xml"]').attr("href");
        // Check anchor tags
        if (!feedUrl) {
            feedUrl = $('a[href*="feed"], a[href*="rss"]').attr("href");
        }
        // Search page content for feed URLs
        if (!feedUrl) {
            const pageText = $.html();
            // Look for common podcast feed patterns
            const feedPatterns = [
                /https?:\/\/feeds\.[^\s"<>]+/i,
                /https?:\/\/[^\s"<>]*\.xml[^\s"<>]*/i,
                /https?:\/\/[^\s"<>]*\/feed[^\s"<>]*/i,
                /https?:\/\/[^\s"<>]*rss[^\s"<>]*/i,
            ];
            for (const pattern of feedPatterns) {
                const match = pageText.match(pattern);
                if (match) {
                    feedUrl = match[0];
                    break;
                }
            }
        }
        const podcastName = $("h1").first().text().trim() ||
            $('meta[property="og:title"]').attr("content") ||
            "Unknown Podcast";
        if (feedUrl && feedUrl.includes("http")) {
            return { feedUrl, podcastName };
        }
        return null;
    }
    catch (err) {
        console.error("Error fetching Podcast Addict page:", err);
        return null;
    }
}
async function resolveToRssFeed(url) {
    const trimmedUrl = url.trim();
    // Check if it's a direct RSS feed URL
    if (trimmedUrl.endsWith(".xml") || trimmedUrl.endsWith(".rss") || trimmedUrl.includes("/feed") || (await isXmlContent(trimmedUrl))) {
        try {
            const response = await (0, node_fetch_1.default)(trimmedUrl);
            const xml = await response.text();
            const parsed = parser.parse(xml);
            const channel = parsed.rss?.channel || parsed.feed;
            const podcastName = channel?.title || channel?.["itunes:author"] || "Unknown Podcast";
            return { feedUrl: trimmedUrl, podcastName };
        }
        catch {
            return { feedUrl: trimmedUrl, podcastName: "Unknown Podcast" };
        }
    }
    // Handle Podcast Addict URLs
    if (trimmedUrl.includes("podcastaddict.com")) {
        const result = await extractPodcastAddictFeed(trimmedUrl);
        if (result) {
            return result;
        }
        throw new Error("Could not extract RSS feed from Podcast Addict URL. Try getting the RSS feed URL directly from the Podcast Addict app.");
    }
    // Handle Apple Podcasts URLs
    if (trimmedUrl.includes("podcasts.apple.com")) {
        const idMatch = trimmedUrl.match(/id(\d+)/);
        if (idMatch) {
            const podcastId = idMatch[1];
            const lookupResponse = await (0, node_fetch_1.default)(`https://itunes.apple.com/lookup?id=${podcastId}&entity=podcast`);
            const lookupData = await lookupResponse.json();
            if (lookupData.results && lookupData.results.length > 0) {
                const result = lookupData.results[0];
                return {
                    feedUrl: result.feedUrl || "",
                    podcastName: result.collectionName || result.trackName || "Unknown Podcast",
                };
            }
        }
        throw new Error("Could not find podcast feed from Apple Podcasts URL.");
    }
    throw new Error("Could not find RSS feed. Try pasting the direct RSS feed URL instead.");
}
async function parseEpisodes(feedUrl) {
    const response = await (0, node_fetch_1.default)(feedUrl);
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
    const itemArray = Array.isArray(items) ? items : [items];
    const episodes = itemArray
        .map((item) => {
        const enclosure = item.enclosure;
        const audioUrl = enclosure?.["@_url"];
        if (!audioUrl)
            return null;
        return {
            title: item.title || "Untitled Episode",
            description: cleanDescription(item.description || item["itunes:summary"]),
            publishDate: item.pubDate || "",
            audioUrl,
            duration: formatDuration(item["itunes:duration"]),
            guid: item.guid || (item.guid?.["#text"]),
        };
    })
        .filter((ep) => ep !== null);
    return episodes;
}
function groupWordsIntoSegments(words) {
    if (words.length === 0)
        return [];
    const segments = [];
    let currentSegment = null;
    const PAUSE_THRESHOLD = 1.0;
    for (const word of words) {
        const speaker = word.speaker_id || "speaker_0";
        const shouldStartNewSegment = !currentSegment ||
            currentSegment.speaker !== speaker ||
            (word.start - currentSegment.end > PAUSE_THRESHOLD);
        if (shouldStartNewSegment) {
            if (currentSegment)
                segments.push(currentSegment);
            currentSegment = { speaker, text: word.text, start: word.start, end: word.end };
        }
        else {
            currentSegment.text += " " + word.text;
            currentSegment.end = word.end;
        }
    }
    if (currentSegment)
        segments.push(currentSegment);
    return segments.map((seg) => ({ ...seg, text: seg.text.trim().replace(/\s+/g, " ") }));
}
async function transcribeAudio(source) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
        throw new Error("ELEVENLABS_API_KEY environment variable is not set");
    }
    const FormData = (await Promise.resolve().then(() => __importStar(require("form-data")))).default;
    const formData = new FormData();
    if ("filePath" in source) {
        formData.append("file", (0, fs_1.readFileSync)(source.filePath), {
            filename: "audio.mp3",
            contentType: "audio/mpeg",
        });
    }
    else {
        formData.append("cloud_storage_url", source.url);
    }
    formData.append("model_id", "scribe_v1");
    formData.append("diarize", "true");
    formData.append("timestamps_granularity", "word");
    const response = await (0, node_fetch_1.default)("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: {
            "xi-api-key": apiKey,
            ...formData.getHeaders(),
        },
        body: formData,
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    const segments = groupWordsIntoSegments(data.words || []);
    const rawText = segments.map((seg) => seg.text).join(" ");
    const lastWord = data.words?.[data.words.length - 1];
    const durationSeconds = lastWord?.end || 0;
    return { segments, rawText, durationSeconds };
}
// Output generation
const SPEAKER_NAMES = {
    speaker_0: "Speaker 1",
    speaker_1: "Speaker 2",
    speaker_2: "Speaker 3",
    speaker_3: "Speaker 4",
    speaker_4: "Speaker 5",
    speaker_5: "Speaker 6",
};
function getSpeakerName(speaker) {
    return SPEAKER_NAMES[speaker] || speaker;
}
function generateMarkdown(podcastName, episodeTitle, segments, durationSeconds) {
    const lines = [];
    lines.push(`# ${episodeTitle}`);
    lines.push("");
    lines.push(`**Podcast:** ${podcastName}`);
    lines.push(`**Date:** ${new Date().toLocaleDateString()}`);
    lines.push(`**Duration:** ${formatTimestamp(durationSeconds)}`);
    lines.push("");
    lines.push("---");
    lines.push("");
    let currentSpeaker = "";
    for (const segment of segments) {
        const speakerName = getSpeakerName(segment.speaker);
        if (speakerName !== currentSpeaker) {
            lines.push(`## ${speakerName}`);
            currentSpeaker = speakerName;
        }
        lines.push(`[${formatTimestamp(segment.start)}] ${segment.text}`);
        lines.push("");
    }
    return lines.join("\n");
}
function sanitizeFilename(name) {
    return name.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 80);
}
async function promptUser(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}
// Main
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
        console.log(`
podscript CLI - Transcribe podcasts and YouTube videos

Usage:
  npm run transcribe -- <url> [options]

Supports:
  - Podcast RSS feed URLs
  - Apple Podcasts URLs
  - YouTube video URLs (requires yt-dlp + ffmpeg)

Options:
  --episode <n>      Transcribe episode number n (1 = most recent)
  --search <query>   Search episodes by title and list matches
  --latest           Transcribe the most recent episode (default)
  --list             List episodes without transcribing
  --output <file>    Output filename (default: auto-generated)
  --help, -h         Show this help message

Examples:
  npm run transcribe -- https://feeds.simplecast.com/JGE3yC0V --list
  npm run transcribe -- https://feeds.simplecast.com/JGE3yC0V --episode 3
  npm run transcribe -- https://www.youtube.com/watch?v=VIDEO_ID
  npm run transcribe -- https://youtu.be/VIDEO_ID --output transcript.md
`);
        process.exit(0);
    }
    const url = args[0];
    const listOnly = args.includes("--list");
    const latestFlag = args.includes("--latest");
    let episodeNum = null;
    const episodeIndex = args.indexOf("--episode");
    if (episodeIndex !== -1 && args[episodeIndex + 1]) {
        episodeNum = parseInt(args[episodeIndex + 1], 10);
    }
    let searchQuery = null;
    const searchIndex = args.indexOf("--search");
    if (searchIndex !== -1 && args[searchIndex + 1]) {
        searchQuery = args[searchIndex + 1].toLowerCase();
    }
    let outputFile = null;
    const outputIndex = args.indexOf("--output");
    if (outputIndex !== -1 && args[outputIndex + 1]) {
        outputFile = args[outputIndex + 1];
    }
    if (!process.env.ELEVENLABS_API_KEY) {
        console.error("Error: ELEVENLABS_API_KEY not found in environment variables.");
        console.error("Make sure you have a .env file with your API key.");
        process.exit(1);
    }
    try {
        // YouTube path
        if (isYouTubeUrl(url)) {
            console.log(`\nDetected YouTube URL\n`);
            const ytInfo = downloadYouTubeAudio(url);
            console.log("Starting transcription...");
            console.log("This may take several minutes depending on video length.\n");
            const startTime = Date.now();
            const result = await transcribeAudio({ filePath: ytInfo.audioPath });
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            // Clean up temp file
            try {
                (0, fs_1.unlinkSync)(ytInfo.audioPath);
            }
            catch { }
            console.log(`\nTranscription complete in ${elapsed} seconds.`);
            console.log(`Duration: ${formatTimestamp(result.durationSeconds)}`);
            console.log(`Segments: ${result.segments.length}`);
            const markdown = generateMarkdown(ytInfo.channel, ytInfo.title, result.segments, result.durationSeconds);
            const filename = outputFile || `${sanitizeFilename(ytInfo.title)}.md`;
            (0, fs_1.writeFileSync)(filename, markdown, "utf-8");
            console.log(`\nSaved to: ${filename}`);
            process.exit(0);
        }
        // Podcast RSS path
        console.log(`\nResolving podcast feed from: ${url}\n`);
        const { feedUrl, podcastName } = await resolveToRssFeed(url);
        console.log(`Podcast: ${podcastName}`);
        console.log(`Feed: ${feedUrl}\n`);
        let episodes = await parseEpisodes(feedUrl);
        if (episodes.length === 0) {
            console.error("No episodes found in feed.");
            process.exit(1);
        }
        // Filter by search query if provided
        if (searchQuery) {
            episodes = episodes.filter((ep) => ep.title.toLowerCase().includes(searchQuery) ||
                ep.description.toLowerCase().includes(searchQuery));
            console.log(`Found ${episodes.length} episodes matching "${searchQuery}":\n`);
        }
        else {
            console.log(`Found ${episodes.length} episodes:\n`);
        }
        if (episodes.length === 0) {
            console.error("No episodes match your search.");
            process.exit(1);
        }
        // Show episodes (limit to 30 for display, but all are available)
        const displayLimit = searchQuery ? episodes.length : 30;
        episodes.slice(0, displayLimit).forEach((ep, i) => {
            const date = ep.publishDate ? new Date(ep.publishDate).toLocaleDateString() : "Unknown date";
            console.log(`  ${(i + 1).toString().padStart(3)}. ${ep.title}`);
            console.log(`       ${date} | ${ep.duration || "Unknown duration"}`);
        });
        if (episodes.length > displayLimit) {
            console.log(`\n  ... and ${episodes.length - displayLimit} more episodes (use --search to filter)`);
        }
        if (listOnly || (searchQuery && episodeNum === null)) {
            process.exit(0);
        }
        let selectedEpisode;
        if (episodeNum !== null) {
            if (episodeNum < 1 || episodeNum > episodes.length) {
                console.error(`\nInvalid episode number. Choose between 1 and ${episodes.length}.`);
                process.exit(1);
            }
            selectedEpisode = episodes[episodeNum - 1];
        }
        else if (latestFlag || args.length === 1) {
            selectedEpisode = episodes[0];
            console.log(`\nUsing most recent episode.`);
        }
        else {
            const answer = await promptUser("\nEnter episode number to transcribe (or press Enter for latest): ");
            if (answer === "") {
                selectedEpisode = episodes[0];
            }
            else {
                const num = parseInt(answer, 10);
                if (isNaN(num) || num < 1 || num > episodes.length) {
                    console.error(`Invalid episode number.`);
                    process.exit(1);
                }
                selectedEpisode = episodes[num - 1];
            }
        }
        console.log(`\nSelected: ${selectedEpisode.title}`);
        console.log(`Audio URL: ${selectedEpisode.audioUrl}\n`);
        console.log("Starting transcription...");
        console.log("This may take several minutes depending on episode length.\n");
        const startTime = Date.now();
        const result = await transcribeAudio({ url: selectedEpisode.audioUrl });
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`\nTranscription complete in ${elapsed} seconds.`);
        console.log(`Duration: ${formatTimestamp(result.durationSeconds)}`);
        console.log(`Segments: ${result.segments.length}`);
        const markdown = generateMarkdown(podcastName, selectedEpisode.title, result.segments, result.durationSeconds);
        const filename = outputFile || `${sanitizeFilename(selectedEpisode.title)}.md`;
        (0, fs_1.writeFileSync)(filename, markdown, "utf-8");
        console.log(`\nSaved to: ${filename}`);
    }
    catch (error) {
        console.error("\nError:", error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
main();
