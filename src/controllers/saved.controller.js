import SavedContent from "../models/SavedContent.js";

export const saveContent = async (req, res, next) => {
  try {
    const {
      videoId,
      title,
      description,
      thumbnail,
      channelTitle,
      publishedAt,
      duration,
      interest,
    } = req.body;

    if (!videoId || !title) {
      return res.status(400).json({
        success: false,
        message: "videoId and title are required",
      });
    }

    const saved = await SavedContent.findOneAndUpdate(
      { videoId },
      {
        videoId,
        title,
        description,
        thumbnail,
        channelTitle,
        publishedAt,
        duration,
        interest,
        source: "youtube",
        savedAt: new Date(),
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    res.status(201).json({
      success: true,
      message: "Content saved successfully",
      data: saved,
    });
  } catch (error) {
    next(error);
  }
};

export const getSavedContent = async (req, res, next) => {
  try {
    const saved = await SavedContent.find()
      .sort({ savedAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: saved,
    });
  } catch (error) {
    next(error);
  }
};

export const removeSavedContent = async (
  req,
  res,
  next
) => {
  try {
    const { videoId } = req.params;

    const deleted = await SavedContent.findOneAndDelete({
      videoId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Saved content not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Content removed from saved",
    });
  } catch (error) {
    next(error);
  }
};

export const checkSavedContent = async (
  req,
  res,
  next
) => {
  try {
    const { videoId } = req.params;

    const saved = await SavedContent.exists({
      videoId,
    });

    res.status(200).json({
      success: true,
      saved: Boolean(saved),
    });
  } catch (error) {
    next(error);
  }
};