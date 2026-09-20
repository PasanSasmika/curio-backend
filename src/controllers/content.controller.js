import {
  searchYouTube,
  getYouTubeVideoDetails,
} from "../services/youtube.service.js";

import {
  filterYouTubeContent,
  SHORT_DURATION_REGEX,
} from "../utils/contentFilter.js";
import Content from "../models/Content.js";

const ALLOWED_ORDERS = [
  "relevance",
  "date",
  "rating",
  "viewCount",
];

const SORT_OPTIONS = {
  new: { publishedAt: -1, createdAt: -1 },
  viewed: { viewCount: -1, publishedAt: -1 },
  recent: { createdAt: -1 },
};

const MAX_HOME_PAGES = 6;
const DEFAULT_LIMIT = 10;

const REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

const refreshCache = new Map();

const buildYouTubeVideos = async (
  searchResults,
  interest = null
) => {
  const videoIds = (searchResults.items || [])
    .map((item) => item.id?.videoId)
    .filter(Boolean);

  if (videoIds.length === 0) {
    return [];
  }

  const details =
    await getYouTubeVideoDetails(videoIds);

  const detailsMap = new Map(
    details.map((video) => [
      video.id,
      video,
    ])
  );

  return (searchResults.items || [])
    .map((item) => {
      const video =
        detailsMap.get(
          item.id?.videoId
        );

      if (!video) {
        return null;
      }

      return {
        videoId: video.id,

        title:
          video.snippet?.title || "",

        description:
          video.snippet?.description || "",

        thumbnail:
          video.snippet?.thumbnails?.medium?.url ??
          video.snippet?.thumbnails?.high?.url ??
          null,

        channelId:
          video.snippet?.channelId ?? null,

        channelTitle:
          video.snippet?.channelTitle ?? null,

        publishedAt:
          video.snippet?.publishedAt ?? null,

        duration:
          video.contentDetails?.duration ?? null,

        viewCount:
          Number(
            video.statistics?.viewCount ?? 0
          ),

        ...(interest
          ? {
              interest:
                interest.trim(),
            }
          : {}),

        source: "youtube",
      };
    })
    .filter(Boolean);
};

const saveVideos = async (videos) => {
  if (!videos.length) {
    return [];
  }

  const savedVideos = [];

  for (const video of videos) {
    const saved =
      await Content.findOneAndUpdate(
        {
          videoId: video.videoId,
        },
        video,
        {
          returnDocument: "after",
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );

    savedVideos.push(saved);
  }

  return savedVideos;
};

const canRefreshInterest = (interest) => {
  const key = interest
    .trim()
    .toLowerCase();

  const lastRefresh =
    refreshCache.get(key);

  if (!lastRefresh) {
    return true;
  }

  return (
    Date.now() - lastRefresh >=
    REFRESH_COOLDOWN_MS
  );
};

const markInterestRefreshed = (
  interest
) => {
  const key = interest
    .trim()
    .toLowerCase();

  refreshCache.set(
    key,
    Date.now()
  );
};

const refreshInterestContent = async (
  interest
) => {
  if (!interest || !interest.trim()) {
    return {
      refreshed: false,
      reason: "missing-interest",
    };
  }

  if (!canRefreshInterest(interest)) {
    return {
      refreshed: false,
      reason: "cooldown",
    };
  }

  try {
    markInterestRefreshed(interest);

    const searchResults =
      await searchYouTube(
        interest.trim(),
        {
          maxResults: 10,
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

    return {
      refreshed: true,
      count: videos.length,
    };
  } catch (error) {
    console.log(
      `YouTube refresh failed for "${interest}":`,
      error.message
    );

    return {
      refreshed: false,
      reason:
        error.code ||
        "youtube-request-failed",
    };
  }
};

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
      sort = "new",
    } = req.query;

    const parsedPage = Number(page);
    const parsedLimit = Number(limit);

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

    if (parsedPage > MAX_HOME_PAGES) {
      return res.status(400).json({
        success: false,
        message:
          `Home supports up to ${MAX_HOME_PAGES} pages`,
      });
    }

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

    if (!SORT_OPTIONS[sort]) {
      return res.status(400).json({
        success: false,
        message: `Invalid sort. Allowed values: ${Object.keys(
          SORT_OPTIONS
        ).join(", ")}`,
      });
    }

    // Hide Shorts/reels that were saved before the filter existed.
    const filter = {
      duration: { $not: SHORT_DURATION_REGEX },
      title: { $not: /#shorts?/i },
    };

    if (interest && interest.trim()) {
      filter.interest =
        interest.trim();
    }

    /*
     * Only refresh when explicitly requested.
     *
     * The cooldown prevents repeated
     * YouTube requests for the same interest.
     */
    let refreshResult = null;

    if (
      (refresh === "true" ||
        refresh === "1") &&
      interest &&
      interest.trim()
    ) {
      refreshResult =
        await refreshInterestContent(
          interest
        );
    }

    const skip =
      (parsedPage - 1) *
      parsedLimit;

    const [content, total] =
      await Promise.all([
        Content.find(filter)
          .sort(SORT_OPTIONS[sort])
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

      refresh: refreshResult,
    });
  } catch (error) {
    next(error);
  }
};

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

    const searchResults =
      await searchYouTube(
        q.trim(),
        {
          pageToken,
          maxResults: Math.min(
            parsedLimit,
            10
          ),
          order,
        }
      );

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
    if (
      error.status === 429 ||
      error.code ===
        "YOUTUBE_RATE_LIMIT"
    ) {
      return res.status(429).json({
        success: false,
        message:
          "YouTube is temporarily rate limited. Please try again later.",
      });
    }

    next(error);
  }
};

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
     * First check whether MongoDB already
     * contains content for this interest.
     *
     * This prevents unnecessary YouTube
     * API calls every time Discover is pressed.
     */
    const existingContent =
      await Content.find({
        interest: interest.trim(),
        duration: { $not: SHORT_DURATION_REGEX },
      })
        .sort({
          publishedAt: -1,
          createdAt: -1,
        })
        .limit(10)
        .lean();

    if (existingContent.length > 0) {
      return res.status(200).json({
        success: true,
        message:
          "Existing content returned",
        count: existingContent.length,
        data: existingContent,
        source: "database",
      });
    }

    const searchResults =
      await searchYouTube(
        interest.trim(),
        {
          maxResults: 10,
          order: "relevance",
        }
      );

    let videos =
      await buildYouTubeVideos(
        searchResults,
        interest
      );

    videos =
      filterYouTubeContent(
        videos
      );

    const savedVideos =
      await saveVideos(videos);

    res.status(200).json({
      success: true,

      message:
        "Content discovered successfully",

      count: savedVideos.length,

      data: savedVideos,

      source: "youtube",
    });
  } catch (error) {
    if (
      error.status === 429 ||
      error.code ===
        "YOUTUBE_RATE_LIMIT"
    ) {
      return res.status(429).json({
        success: false,
        message:
          "YouTube is temporarily rate limited. Please try again later.",
        data: [],
      });
    }

    next(error);
  }
};

export const getContentById = async (
  req,
  res,
  next
) => {
  try {
    const { id } = req.params;

    let video = await Content.findOne({
      videoId: id,
    }).lean();

    // Search results are not stored, so fall back to YouTube.
    if (!video) {
      const [details] = await buildYouTubeVideos({
        items: [{ id: { videoId: id } }],
      });

      video = details || null;
    }

    if (!video) {
      return res.status(404).json({
        success: false,
        message: "Video not found",
      });
    }

    res.status(200).json({
      success: true,
      data: video,
    });
  } catch (error) {
    if (error.status === 429 || error.status === 403) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
};
