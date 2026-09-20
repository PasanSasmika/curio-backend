import {
  searchYouTube,
  getYouTubeVideoDetails,
} from "../services/youtube.service.js";

import { filterYouTubeContent } from "../utils/ContentFilter.js";
import Content from "../models/Content.js";

const ALLOWED_ORDERS = [
  "relevance",
  "date",
  "rating",
  "viewCount",
];

const MAX_HOME_PAGES = 6;
const DEFAULT_LIMIT = 10;

/*
 * --------------------------------------------------
 * Convert YouTube results into Curio content objects
 * --------------------------------------------------
 */

const buildYouTubeVideos = (
  searchResults,
  interest = null
) => {
  const videoIds = searchResults.items
    .map((item) => item.id?.videoId)
    .filter(Boolean);

  return getYouTubeVideoDetails(videoIds).then(
    (details) => {
      const detailsMap = new Map(
        details.map((video) => [video.id, video])
      );

      return searchResults.items
        .map((item) => {
          const video = detailsMap.get(
            item.id?.videoId
          );

          if (!video) {
            return null;
          }

          return {
            videoId: video.id,

            title: video.snippet.title,

            description:
              video.snippet.description,

            thumbnail:
              video.snippet.thumbnails?.medium?.url ??
              video.snippet.thumbnails?.high?.url ??
              null,

            channelId:
              video.snippet.channelId,

            channelTitle:
              video.snippet.channelTitle,

            publishedAt:
              video.snippet.publishedAt,

            duration:
              video.contentDetails?.duration ??
              null,

            viewCount:
              Number(
                video.statistics?.viewCount ?? 0
              ),

            ...(interest
              ? {
                  interest: interest.trim(),
                }
              : {}),

            source: "youtube",
          };
        })
        .filter(Boolean);
    }
  );
};

/*
 * --------------------------------------------------
 * Save YouTube videos to MongoDB
 * --------------------------------------------------
 */

const saveVideos = async (videos) => {
  const savedVideos = [];

  for (const video of videos) {
    const saved =
      await Content.findOneAndUpdate(
        {
          videoId: video.videoId,
        },
        video,
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );

    savedVideos.push(saved);
  }

  return savedVideos;
};

/*
 * --------------------------------------------------
 * Refresh content from YouTube
 *
 * This is used when the user pulls to refresh.
 * It searches recent uploads for the selected interest.
 * --------------------------------------------------
 */

const refreshInterestContent = async (
  interest
) => {
  if (!interest) {
    return;
  }

  try {
    const searchResults =
      await searchYouTube(
        interest.trim(),
        {
          maxResults: 20,
          order: "date",
        }
      );

    let videos =
      await buildYouTubeVideos(
        searchResults,
        interest
      );

    videos =
      filterYouTubeContent(videos);

    if (videos.length > 0) {
      await saveVideos(videos);
    }
  } catch (error) {
    console.log(
      `Failed to refresh "${interest}":`,
      error.message
    );
  }
};

/*
 * --------------------------------------------------
 * GET HOME CONTENT
 *
 * Supports:
 *
 * ?page=1
 * ?page=2
 * ?page=3
 * ...
 * ?page=6
 *
 * ?limit=10
 *
 * ?interest=React%20Native
 *
 * ?refresh=true
 * --------------------------------------------------
 */

export const getContent = async (
  req,
  res,
  next
) => {
  try {
    const {
      interest,
      page = "1",
      limit = String(DEFAULT_LIMIT),
      refresh = "false",
    } = req.query;

    const parsedPage = Number(page);
    const parsedLimit = Number(limit);

    /*
     * Validate page
     */

    if (
      !Number.isInteger(parsedPage) ||
      parsedPage < 1
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Page must be a positive integer",
      });
    }

    /*
     * We only expose pages 1-6 in the Home UI.
     */

    if (parsedPage > MAX_HOME_PAGES) {
      return res.status(400).json({
        success: false,
        message:
          `Home supports up to ${MAX_HOME_PAGES} pages`,
      });
    }

    /*
     * Validate limit
     */

    if (
      !Number.isInteger(parsedLimit) ||
      parsedLimit < 1 ||
      parsedLimit > 50
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Limit must be between 1 and 50",
      });
    }

    /*
     * --------------------------------------------------
     * Refresh from YouTube
     *
     * Only refresh when explicitly requested.
     * This prevents every normal page change from
     * consuming YouTube API quota.
     * --------------------------------------------------
     */

    const shouldRefresh =
      refresh === "true" ||
      refresh === "1";

    if (
      shouldRefresh &&
      interest &&
      interest.trim()
    ) {
      await refreshInterestContent(
        interest
      );
    }

    /*
     * --------------------------------------------------
     * MongoDB filter
     * --------------------------------------------------
     */

    const filter = {};

    if (interest && interest.trim()) {
      filter.interest =
        interest.trim();
    }

    const skip =
      (parsedPage - 1) *
      parsedLimit;

    /*
     * --------------------------------------------------
     * Feed ordering
     *
     * Newer videos appear first.
     *
     * createdAt is used as a secondary sort so
     * newly discovered videos are also considered.
     * --------------------------------------------------
     */

    const [content, total] =
      await Promise.all([
        Content.find(filter)
          .sort({
            publishedAt: -1,
            createdAt: -1,
          })
          .skip(skip)
          .limit(parsedLimit)
          .lean(),

        Content.countDocuments(filter),
      ]);

    const totalPages = Math.min(
      Math.ceil(
        total / parsedLimit
      ),
      MAX_HOME_PAGES
    );

    res.status(200).json({
      success: true,

      data: content,

      pagination: {
        page: parsedPage,

        limit: parsedLimit,

        total,

        totalPages,

        maxPages: MAX_HOME_PAGES,

        hasNextPage:
          parsedPage < totalPages,

        hasPreviousPage:
          parsedPage > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/*
 * --------------------------------------------------
 * SEARCH CONTENT
 *
 * This continues to search YouTube directly.
 * --------------------------------------------------
 */

export const searchContent = async (
  req,
  res,
  next
) => {
  try {
    const {
      q,
      pageToken,
      limit = "10",
      order = "relevance",
    } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "Search query is required",
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
        message:
          "Limit must be between 1 and 50",
      });
    }

    if (!ALLOWED_ORDERS.includes(order)) {
      return res.status(400).json({
        success: false,
        message:
          `Invalid order. Allowed values: ${ALLOWED_ORDERS.join(
            ", "
          )}`,
      });
    }

    /*
     * Search YouTube
     */

    const searchResults =
      await searchYouTube(
        q.trim(),
        {
          pageToken,
          maxResults: parsedLimit,
          order,
        }
      );

    /*
     * Get complete video details
     */

    const videos =
      await buildYouTubeVideos(
        searchResults
      );

    const filteredVideos =
      filterYouTubeContent(
        videos
      );

    res.status(200).json({
      success: true,

      data: filteredVideos,

      pagination: {
        nextPageToken:
          searchResults.nextPageToken ??
          null,

        previousPageToken:
          searchResults.prevPageToken ??
          null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/*
 * --------------------------------------------------
 * DISCOVER CONTENT
 *
 * Used by the Interests screen.
 *
 * Searches relevant content and saves it to MongoDB.
 * --------------------------------------------------
 */

export const discoverContent = async (
  req,
  res,
  next
) => {
  try {
    const { interest } = req.body;

    if (
      !interest ||
      !interest.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Interest is required",
      });
    }

    /*
     * First get relevant videos.
     */

    const relevanceResults =
      await searchYouTube(
        interest.trim(),
        {
          maxResults: 20,
          order: "relevance",
        }
      );

    let videos =
      await buildYouTubeVideos(
        relevanceResults,
        interest
      );

    /*
     * Filter Shorts / low-quality entries.
     */

    videos =
      filterYouTubeContent(
        videos
      );

    /*
     * Save to MongoDB.
     */

    const savedVideos =
      await saveVideos(
        videos
      );

    res.status(200).json({
      success: true,

      message:
        "Content discovered successfully",

      count: savedVideos.length,

      data: savedVideos,
    });
  } catch (error) {
    next(error);
  }
};