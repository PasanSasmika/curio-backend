import axios from "axios";

const YOUTUBE_API_URL =
  "https://www.googleapis.com/youtube/v3";

export const searchYouTube = async (query, options = {}) => {
  const {
    pageToken,
    maxResults = 10,
    order = "relevance"
  } = options;

  const response = await axios.get(`${YOUTUBE_API_URL}/search`, {
    params: {
      part: "snippet",
      q: query,
      type: "video",
      maxResults,
      order,
      pageToken,
      key: process.env.YOUTUBE_API_KEY
    }
  });

  return response.data;
};

export const getYouTubeVideoDetails = async (videoIds) => {
  if (!videoIds.length) {
    return [];
  }

  const response = await axios.get(`${YOUTUBE_API_URL}/videos`, {
    params: {
      part: "snippet,contentDetails,statistics",
      id: videoIds.join(","),
      key: process.env.YOUTUBE_API_KEY
    }
  });

  return response.data.items;
};