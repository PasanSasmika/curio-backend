import mongoose from "mongoose";

const savedContentSchema = new mongoose.Schema(
  {
    videoId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    thumbnail: {
      type: String,
      default: null,
    },

    channelTitle: {
      type: String,
      default: null,
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    duration: {
      type: String,
      default: null,
    },

    interest: {
      type: String,
      default: null,
      index: true,
    },

    source: {
      type: String,
      enum: ["youtube"],
      default: "youtube",
    },

    savedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const SavedContent = mongoose.model(
  "SavedContent",
  savedContentSchema
);

export default SavedContent;