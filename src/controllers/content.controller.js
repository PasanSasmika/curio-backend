import {
  searchYouTube,
  getYouTubeVideoDetails,
} from "../services/youtube.service.js";

import {
  filterYouTubeContent,
  SHORT_DURATION_REGEX,
} from "../utils/contentFilter.js";

import Content from "../models/Content.js";
import UserPreferences from "../models/UserPreferences.js";

const ALLOWED_ORDERS = [
  "relevance",
  "date",
  "rating",
  "viewCount",
];

const SORT_OPTIONS = {
  new: {
    publishedAt: -1,
    createdAt: -1,
  },

  viewed: {
    viewCount: -1,
    publishedAt: -1,
  },

  recent: {
    createdAt: -1,
  },
};

const MAX_HOME_PAGES = 6;
const DEFAULT_LIMIT = 10;

// Prevent repeated YouTube requests for the same interest.
const REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

const refreshCache = new Map();


// ==================================================
// Build videos from YouTube search results
// ==================================================

const buildYouTubeVideos = async (
  searchResults,
  interest = null
) => {
  const videoIds =
    (searchResults.items || [])
      .map(
        (item) =>
          item.id?.videoId
      )
      .filter(Boolean);

  if (videoIds.length === 0) {
    return [];
  }

  const details =
    await getYouTubeVideoDetails(
      videoIds
    );

  const detailsMap = new Map(
    details.map((video) => [
      video.id,
      video,
    ])
  );

  return (
    searchResults.items || []
  )
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
          video.snippet
            ?.description || "",

        thumbnail:
          video.snippet
            ?.thumbnails
            ?.medium?.url ??
          video.snippet
            ?.thumbnails
            ?.high?.url ??
          null,

        channelId:
          video.snippet
            ?.channelId ?? null,

        channelTitle:
          video.snippet
            ?.channelTitle ?? null,

        publishedAt:
          video.snippet
            ?.publishedAt ?? null,

        duration:
          video.contentDetails
            ?.duration ?? null,

        viewCount: Number(
          video.statistics
            ?.viewCount ?? 0
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


// ==================================================
// Save / update videos in MongoDB
// ==================================================

const saveVideos = async (
  videos
) => {
  if (!videos.length) {
    return [];
  }

  const savedVideos = [];

  for (const video of videos) {
    const saved =
      await Content.findOneAndUpdate(
        {
          videoId:
            video.videoId,
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


// ==================================================
// Refresh cooldown
// ==================================================

const canRefreshInterest = (
  interest
) => {
  const key =
    interest
      .trim()
      .toLowerCase();

  const lastRefresh =
    refreshCache.get(key);

  if (!lastRefresh) {
    return true;
  }

  return (
    Date.now() -
      lastRefresh >=
    REFRESH_COOLDOWN_MS
  );
};


const markInterestRefreshed = (
  interest
) => {
  const key =
    interest
      .trim()
      .toLowerCase();

  refreshCache.set(
    key,
    Date.now()
  );
};


// ==================================================
// Refresh one specific interest
// ==================================================

const refreshInterestContent = async (
  interest
) => {
  if (
    !interest ||
    !interest.trim()
  ) {
    return {
      refreshed: false,
      reason: "missing-interest",
    };
  }

  if (
    !canRefreshInterest(
      interest
    )
  ) {
    return {
      refreshed: false,
      reason: "cooldown",
    };
  }

  try {
    /*
     * Mark before the API request.
     * This prevents multiple refresh
     * requests from hitting YouTube
     * at the same time.
     */
    markInterestRefreshed(
      interest
    );

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
      filterYouTubeContent(
        videos
      );

    if (videos.length > 0) {
      await saveVideos(
        videos
      );
    }

    return {
      refreshed: true,
      count: videos.length,
      interest:
        interest.trim(),
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
      interest:
        interest.trim(),
    };
  }
};


// ==================================================
// Refresh a random user interest
// ==================================================

const refreshRandomInterest =
  async () => {
    const preferences =
      await UserPreferences.findOne()
        .lean();

    const interests =
      preferences?.interests ||
      [];

    if (
      interests.length === 0
    ) {
      return {
        refreshed: false,
        reason: "no-interests",
      };
    }

    /*
     * Randomly choose one of the
     * user's interests.
     *
     * Example:
     * React Native
     * AI
     * Photography
     * Science
     *
     * One refresh may use AI,
     * another may use Photography.
     */
    const interest =
      interests[
        Math.floor(
          Math.random() *
            interests.length
        )
      ];

    console.log(
      `Refreshing random interest: "${interest}"`
    );

    return refreshInterestContent(
      interest
    );
  };


// ==================================================
// GET CONTENT
// ==================================================

export const getContent = async (
  req,
  res,
  next
) => {
  try {
    const {
      interest,
      page = "1",
      limit = String(
        DEFAULT_LIMIT
      ),
      refresh = "false",
      sort = "new",
    } = req.query;

    const parsedPage =
      Number(page);

    const parsedLimit =
      Number(limit);

    // ------------------------------------------------
    // Validate page
    // ------------------------------------------------

    if (
      !Number.isInteger(
        parsedPage
      ) ||
      parsedPage < 1
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Page must be a positive integer",
      });
    }

    if (
      parsedPage >
      MAX_HOME_PAGES
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Home supports up to ${MAX_HOME_PAGES} pages`,
      });
    }

    // ------------------------------------------------
    // Validate limit
    // ------------------------------------------------

    if (
      !Number.isInteger(
        parsedLimit
      ) ||
      parsedLimit < 1 ||
      parsedLimit > 50
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Limit must be between 1 and 50",
      });
    }

    // ------------------------------------------------
    // Validate sort
    // ------------------------------------------------

    if (
      !SORT_OPTIONS[sort]
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Invalid sort. Allowed values: ${Object.keys(
            SORT_OPTIONS
          ).join(", ")}`,
      });
    }

    // ------------------------------------------------
    // Base MongoDB filter
    // ------------------------------------------------

    const filter = {
      /*
       * Hide Shorts / reels that were
       * saved before the filter existed.
       */
      duration: {
        $not:
          SHORT_DURATION_REGEX,
      },

      title: {
        $not: /#shorts?\b/i,
      },
    };

    if (
      interest &&
      interest.trim()
    ) {
      filter.interest =
        interest.trim();
    }

    // ------------------------------------------------
    // Refresh
    // ------------------------------------------------

    let refreshResult = null;

    if (
      refresh === "true" ||
      refresh === "1"
    ) {
      if (
        interest &&
        interest.trim()
      ) {
        /*
         * A specific interest was selected.
         *
         * Example:
         * /content?interest=AI&refresh=true
         */
        refreshResult =
          await refreshInterestContent(
            interest
          );
      } else {
        /*
         * "All" / "For you" feed.
         *
         * Pick one of the user's
         * interests randomly and
         * search YouTube for fresh
         * content.
         */
        refreshResult =
          await refreshRandomInterest();
      }
    }

    // ------------------------------------------------
    // Get content
    // ------------------------------------------------

    const skip =
      (parsedPage - 1) *
      parsedLimit;

    let content;
    let total;

    const isRefresh =
      refresh === "true" ||
      refresh === "1";

    if (isRefresh) {
      /*
       * REFRESH MODE
       *
       * Randomly select videos from
       * MongoDB instead of using the
       * normal sort order.
       *
       * This makes every refresh
       * feel different.
       */
      const [
        randomContent,
        totalCount,
      ] = await Promise.all([
        Content.aggregate([
          {
            $match: filter,
          },

          {
            $sample: {
              size: parsedLimit,
            },
          },
        ]),

        Content.countDocuments(
          filter
        ),
      ]);

      content =
        randomContent;

      total =
        totalCount;
    } else {
      /*
       * NORMAL MODE
       *
       * Keep your existing sorting
       * and pagination.
       */
      [
        content,
        total,
      ] = await Promise.all([
        Content.find(filter)
          .sort(
            SORT_OPTIONS[sort]
          )
          .skip(skip)
          .limit(parsedLimit)
          .lean(),

        Content.countDocuments(
          filter
        ),
      ]);
    }

    // ------------------------------------------------
    // Pagination
    // ------------------------------------------------

    const totalPages =
      Math.min(
        Math.ceil(
          total /
            parsedLimit
        ),
        MAX_HOME_PAGES
      );

    // ------------------------------------------------
    // Response
    // ------------------------------------------------

    res.status(200).json({
      success: true,

      data: content,

      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages,
        maxPages:
          MAX_HOME_PAGES,

        hasNextPage:
          parsedPage <
          totalPages,

        hasPreviousPage:
          parsedPage > 1,
      },

      refresh:
        refreshResult,
    });
  } catch (error) {
    next(error);
  }
};


// ==================================================
// SEARCH CONTENT
// ==================================================

export const searchContent =
  async (
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

      // ------------------------------------------------
      // Validate query
      // ------------------------------------------------

      if (
        !q ||
        !q.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Search query is required",
        });
      }

      // ------------------------------------------------
      // Validate limit
      // ------------------------------------------------

      const parsedLimit =
        Number(limit);

      if (
        !Number.isInteger(
          parsedLimit
        ) ||
        parsedLimit < 1 ||
        parsedLimit > 50
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Limit must be between 1 and 50",
        });
      }

      // ------------------------------------------------
      // Validate YouTube order
      // ------------------------------------------------

      if (
        !ALLOWED_ORDERS.includes(
          order
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Invalid order. Allowed values: ${ALLOWED_ORDERS.join(
              ", "
            )}`,
        });
      }

      // ------------------------------------------------
      // Search YouTube
      // ------------------------------------------------

      const searchResults =
        await searchYouTube(
          q.trim(),
          {
            pageToken,
            maxResults:
              Math.min(
                parsedLimit,
                10
              ),
            order,
          }
        );

      // ------------------------------------------------
      // Build content
      // ------------------------------------------------

      const videos =
        await buildYouTubeVideos(
          searchResults
        );

      // ------------------------------------------------
      // Filter content
      // ------------------------------------------------

      const filteredVideos =
        filterYouTubeContent(
          videos
        );

      // ------------------------------------------------
      // Response
      // ------------------------------------------------

      res.status(200).json({
        success: true,

        data:
          filteredVideos,

        pagination: {
          nextPageToken:
            searchResults
              .nextPageToken ??
            null,

          previousPageToken:
            searchResults
              .prevPageToken ??
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


// ==================================================
// DISCOVER CONTENT
// ==================================================

export const discoverContent =
  async (
    req,
    res,
    next
  ) => {
    try {
      const {
        interest,
      } = req.body;

      // ------------------------------------------------
      // Validate interest
      // ------------------------------------------------

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

      // ------------------------------------------------
      // Check existing MongoDB content
      // ------------------------------------------------

      /*
       * If we already have content for
       * this interest, return it instead
       * of making another YouTube request.
       */
      const existingContent =
        await Content.find({
          interest:
            interest.trim(),

          duration: {
            $not:
              SHORT_DURATION_REGEX,
          },
        })
          .sort({
            publishedAt: -1,
            createdAt: -1,
          })
          .limit(10)
          .lean();

      if (
        existingContent.length > 0
      ) {
        return res.status(200).json({
          success: true,

          message:
            "Existing content returned",

          count:
            existingContent.length,

          data:
            existingContent,

          source: "database",
        });
      }

      // ------------------------------------------------
      // Search YouTube
      // ------------------------------------------------

      const searchResults =
        await searchYouTube(
          interest.trim(),
          {
            maxResults: 10,
            order: "relevance",
          }
        );

      // ------------------------------------------------
      // Build videos
      // ------------------------------------------------

      let videos =
        await buildYouTubeVideos(
          searchResults,
          interest
        );

      // ------------------------------------------------
      // Filter
      // ------------------------------------------------

      videos =
        filterYouTubeContent(
          videos
        );

      // ------------------------------------------------
      // Save
      // ------------------------------------------------

      const savedVideos =
        await saveVideos(
          videos
        );

      // ------------------------------------------------
      // Response
      // ------------------------------------------------

      res.status(200).json({
        success: true,

        message:
          "Content discovered successfully",

        count:
          savedVideos.length,

        data:
          savedVideos,

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


// ==================================================
// GET CONTENT BY ID
// ==================================================

export const getContentById =
  async (
    req,
    res,
    next
  ) => {
    try {
      const {
        id,
      } = req.params;

      // ------------------------------------------------
      // Find in MongoDB
      // ------------------------------------------------

      let video =
        await Content.findOne({
          videoId: id,
        }).lean();

      // ------------------------------------------------
      // If not found, get from YouTube
      // ------------------------------------------------

      /*
       * Search results are not stored,
       * so fall back to YouTube.
       */
      if (!video) {
        const [
          details,
        ] =
          await buildYouTubeVideos({
            items: [
              {
                id: {
                  videoId: id,
                },
              },
            ],
          });

        video =
          details || null;
      }

      // ------------------------------------------------
      // Not found
      // ------------------------------------------------

      if (!video) {
        return res.status(404).json({
          success: false,
          message:
            "Video not found",
        });
      }

      // ------------------------------------------------
      // Response
      // ------------------------------------------------

      res.status(200).json({
        success: true,
        data: video,
      });
    } catch (error) {
      if (
        error.status === 429 ||
        error.status === 403
      ) {
        return res.status(
          error.status
        ).json({
          success: false,
          message:
            error.message,
        });
      }

      next(error);
    }
  };