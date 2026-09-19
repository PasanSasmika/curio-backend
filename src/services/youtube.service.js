import axios from "axios";

const YOUTUBE_API_URL =
  "https://www.googleapis.com/youtube/v3/search";

export const searchYouTube = async (query, options = {}) => {
  const {
    pageToken,
    maxResults = 10
  } = options;

  const response = await axios.get(YOUTUBE_API_URL, {
    params: {
      part: "snippet",
      q: query,
      type: "video",
      maxResults,
      pageToken,
      key: process.env.YOUTUBE_API_KEY
    }
  });

  return response.data;
};