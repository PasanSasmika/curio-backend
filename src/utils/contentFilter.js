export const SHORTS_MAX_SECONDS = 180;

/* Mongo regex matching ISO durations of 2:59 or less (PT45S, PT2M10S). */
export const SHORT_DURATION_REGEX = /^PT(?:[0-2]M(?:\d+S)?|\d+S)$/;

export const filterYouTubeContent = (
  videos
) => {
  return videos.filter((video) => {
    if (!video?.videoId) {
      return false;
    }

    if (!video?.title) {
      return false;
    }

    /*
     * Remove videos explicitly marked
     * as Shorts in their title.
     */
    const title =
      video.title.toLowerCase();

    if (
      title.includes("#shorts") ||
      title.includes("#short")
    ) {
      return false;
    }

    /*
     * Remove Shorts / reels (up to 3 minutes).
     */
    if (
      video.duration &&
      isShortVideo(video.duration)
    ) {
      return false;
    }

    /*
     * Ignore videos with almost no views.
     */
    if (
      Number(video.viewCount || 0) < 10
    ) {
      return false;
    }

    return true;
  });
};

const isShortVideo = (
  duration
) => {
  if (!duration) {
    return false;
  }

  const match =
    duration.match(
      /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/
    );

  if (!match) {
    return false;
  }

  const hours =
    Number(match[1] || 0);

  const minutes =
    Number(match[2] || 0);

  const seconds =
    Number(match[3] || 0);

  const totalSeconds =
    hours * 60 * 60 +
    minutes * 60 +
    seconds;

  return totalSeconds <= SHORTS_MAX_SECONDS;
};