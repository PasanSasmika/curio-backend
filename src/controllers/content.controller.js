import { searchYouTube } from "../services/youtube.service.js";

export const searchContent = async (req, res, next) => {
  try {
    const { q, pageToken } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        message: "Search query is required"
      });
    }

    const results = await searchYouTube(q.trim(), {
      pageToken,
      maxResults: 10
    });

    const videos = results.items.map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails?.medium?.url,
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt
    }));

    res.status(200).json({
      success: true,
      data: videos,
      pagination: {
        nextPageToken: results.nextPageToken || null,
        previousPageToken: results.prevPageToken || null
      }
    });
  } catch (error) {
    next(error);
  }
};