import {
  searchYouTube,
  getYouTubeVideoDetails
} from "../services/youtube.service.js";
import { filterYouTubeContent } from "../utils/ContentFilter.js";
import Content from "../models/Content.js";

const ALLOWED_ORDERS = [
  "relevance",
  "date",
  "rating",
  "viewCount"
];


export const getContent = async (req, res, next) => {
  try {
    const {
      interest,
      page = "1",
      limit = "10"
    } = req.query;

    const parsedPage = Number(page);
    const parsedLimit = Number(limit);

    if (
      !Number.isInteger(parsedPage) ||
      parsedPage < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Page must be a positive integer"
      });
    }

    if (
      !Number.isInteger(parsedLimit) ||
      parsedLimit < 1 ||
      parsedLimit > 50
    ) {
      return res.status(400).json({
        success: false,
        message: "Limit must be between 1 and 50"
      });
    }

    const filter = {};

    if (interest) {
      filter.interest = interest;
    }

    const skip = (parsedPage - 1) * parsedLimit;

    const [content, total] = await Promise.all([
      Content.find(filter)
        .sort({
          publishedAt: -1
        })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),

      Content.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: content,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit),
        hasNextPage:
          parsedPage < Math.ceil(total / parsedLimit)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const searchContent = async (req, res, next) => {
  try {
    const {
      q,
      pageToken,
      limit = "10",
      order = "relevance"
    } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        message: "Search query is required"
      });
    }

    const parsedLimit = Number(limit);

    if (
      !Number.isInteger(parsedLimit) ||
      parsedLimit < 1 ||
      parsedLimit > 50
    ) {
      return res.status(400).json({
        success: false,
        message: "Limit must be between 1 and 50"
      });
    }

    if (!ALLOWED_ORDERS.includes(order)) {
      return res.status(400).json({
        success: false,
        message: `Invalid order. Allowed values: ${ALLOWED_ORDERS.join(", ")}`
      });
    }

    // 1. Search YouTube
    const searchResults = await searchYouTube(q.trim(), {
      pageToken,
      maxResults: parsedLimit,
      order
    });

    // 2. Extract video IDs
    const videoIds = searchResults.items
      .map((item) => item.id.videoId)
      .filter(Boolean);

    // 3. Get video details
    const details = await getYouTubeVideoDetails(videoIds);

    // 4. Create lookup map
    const detailsMap = new Map(
      details.map((video) => [video.id, video])
    );

    // 5. Combine search + details
    const videos = searchResults.items
      .map((item) => {
        const video = detailsMap.get(item.id.videoId);

        if (!video) {
          return null;
        }

        return {
          videoId: video.id,
          title: video.snippet.title,
          description: video.snippet.description,

          thumbnail:
            video.snippet.thumbnails?.medium?.url ?? null,

          channelId: video.snippet.channelId,
          channelTitle: video.snippet.channelTitle,

          publishedAt: video.snippet.publishedAt,

          duration:
            video.contentDetails?.duration ?? null,

          viewCount:
            Number(video.statistics?.viewCount ?? 0)
        };
      })
      .filter(Boolean);

    res.status(200).json({
      success: true,
      data: videos,
      pagination: {
        nextPageToken:
          searchResults.nextPageToken ?? null,

        previousPageToken:
          searchResults.prevPageToken ?? null
      }
    });
  } catch (error) {
    next(error);
  }
};

export const discoverContent = async (req, res, next) => {
  try {
    const { interest } = req.body;

    if (!interest || !interest.trim()) {
      return res.status(400).json({
        success: false,
        message: "Interest is required"
      });
    }

    const searchResults = await searchYouTube(
      interest.trim(),
      {
        maxResults: 20,
        order: "relevance"
      }
    );

    const videoIds = searchResults.items
      .map((item) => item.id.videoId)
      .filter(Boolean);

    const details = await getYouTubeVideoDetails(videoIds);

    const detailsMap = new Map(
      details.map((video) => [video.id, video])
    );

    const videos = searchResults.items
      .map((item) => {
        const video = detailsMap.get(item.id.videoId);

        if (!video) return null;

        return {
          videoId: video.id,
          title: video.snippet.title,
          description: video.snippet.description,
          thumbnail:
            video.snippet.thumbnails?.medium?.url ?? null,
          channelId: video.snippet.channelId,
          channelTitle: video.snippet.channelTitle,
          publishedAt: video.snippet.publishedAt,
          duration:
            video.contentDetails?.duration ?? null,
          viewCount:
            Number(video.statistics?.viewCount ?? 0),
          interest: interest.trim(),
          source: "youtube"
        };
      })
      .filter(Boolean);

    const filteredVideos = filterYouTubeContent(videos);

    const savedVideos = [];

    for (const video of filteredVideos) {
      const saved = await Content.findOneAndUpdate(
        { videoId: video.videoId },
        video,
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }
      );

      savedVideos.push(saved);
    }

    res.status(200).json({
      success: true,
      message: "Content discovered successfully",
      count: savedVideos.length,
      data: savedVideos
    });
  } catch (error) {
    next(error);
  }
};