export const filterYouTubeContent = (videos) => {
  return videos.filter((video) => {
    if (!video.videoId) return false;
    if (!video.title) return false;

    // Remove YouTube Shorts
    const title = video.title.toLowerCase();

    if (title.includes("#shorts")) {
      return false;
    }

    // Ignore videos with extremely low view count
    if (video.viewCount < 10) {
      return false;
    }

    return true;
  });
};