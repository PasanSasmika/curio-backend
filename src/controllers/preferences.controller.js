import UserPreferences from "../models/UserPreferences.js";

const getPreferencesDocument = async () => {
  let preferences = await UserPreferences.findOne();

  if (!preferences) {
    preferences = await UserPreferences.create({
      interests: [],
    });
  }

  return preferences;
};

export const getPreferences = async (req, res, next) => {
  try {
    const preferences = await getPreferencesDocument();

    res.status(200).json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePreferences = async (req, res, next) => {
  try {
    const { interests } = req.body;

    if (!Array.isArray(interests)) {
      return res.status(400).json({
        success: false,
        message: "Interests must be an array",
      });
    }

    const cleanedInterests = [
      ...new Set(
        interests
          .filter((interest) => typeof interest === "string")
          .map((interest) => interest.trim())
          .filter(Boolean)
      ),
    ];

    let preferences = await UserPreferences.findOne();

    if (!preferences) {
      preferences = await UserPreferences.create({
        interests: cleanedInterests,
      });
    } else {
      preferences.interests = cleanedInterests;
      await preferences.save();
    }

    res.status(200).json({
      success: true,
      message: "Preferences updated successfully",
      data: preferences,
    });
  } catch (error) {
    next(error);
  }
};