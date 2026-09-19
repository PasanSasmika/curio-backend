import mongoose from "mongoose";

const userPreferencesSchema = new mongoose.Schema(
  {
    interests: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const UserPreferences = mongoose.model(
  "UserPreferences",
  userPreferencesSchema
);

export default UserPreferences;