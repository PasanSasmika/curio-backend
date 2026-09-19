import mongoose from "mongoose";

const contentSchema = new mongoose.Schema(
  {
    videoId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      default: ""
    },

    thumbnail: {
      type: String,
      default: null
    },

    channelId: {
      type: String,
      default: null
    },

    channelTitle: {
      type: String,
      default: null
    },

    publishedAt: {
      type: Date,
      default: null
    },

    duration: {
      type: String,
      default: null
    },

    viewCount: {
      type: Number,
      default: 0
    },

    interest: {
      type: String,
      required: true,
      index: true
    },

    source: {
      type: String,
      enum: ["youtube"],
      default: "youtube"
    }
  },
  {
    timestamps: true
  }
);

const Content = mongoose.model("Content", contentSchema);

export default Content;