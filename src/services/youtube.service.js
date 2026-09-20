import axios from "axios";

const YOUTUBE_API_URL =
  "https://www.googleapis.com/youtube/v3";

const youtubeApi = axios.create({
  baseURL: YOUTUBE_API_URL,
  timeout: 10000,
});

export const searchYouTube = async (
  query,
  options = {}
) => {
  const {
    pageToken,
    maxResults = 10,
    order = "relevance",
  } = options;

  if (!query || !query.trim()) {
    throw new Error("YouTube search query is required");
  }

  try {
    const response = await youtubeApi.get("/search", {
      params: {
        part: "snippet",
        q: query.trim(),
        type: "video",
        maxResults: Math.min(maxResults, 10),
        order,
        ...(pageToken ? { pageToken } : {}),
        key: process.env.YOUTUBE_API_KEY,
      },
    });

    return response.data;
  } catch (error) {
    if (error.response?.status === 429) {
      const rateLimitError = new Error(
        "YouTube API rate limit reached"
      );

      rateLimitError.status = 429;
      rateLimitError.code = "YOUTUBE_RATE_LIMIT";

      throw rateLimitError;
    }

    if (error.response?.status === 403) {
      const reason =
        error.response?.data?.error?.errors?.[0]?.reason;

      const apiError = new Error(
        reason === "quotaExceeded"
          ? "YouTube API quota exceeded"
          : "YouTube API request was forbidden"
      );

      apiError.status = 403;
      apiError.code = reason || "YOUTUBE_FORBIDDEN";

      throw apiError;
    }

    throw error;
  }
};

export const getYouTubeVideoDetails = async (
  videoIds
) => {
  if (!Array.isArray(videoIds) || videoIds.length === 0) {
    return [];
  }

  try {
    const response = await youtubeApi.get("/videos", {
      params: {
        part: "snippet,contentDetails,statistics",
        id: videoIds.slice(0, 50).join(","),
        key: process.env.YOUTUBE_API_KEY,
      },
    });

    return response.data.items || [];
  } catch (error) {
    if (error.response?.status === 429) {
      const rateLimitError = new Error(
        "YouTube API rate limit reached"
      );

      rateLimitError.status = 429;
      rateLimitError.code = "YOUTUBE_RATE_LIMIT";

      throw rateLimitError;
    }

    throw error;
  }
};