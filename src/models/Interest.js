import mongoose from "mongoose";

const interestSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      minlength: 2,
      maxlength: 50,
    },

    category: {
      type: String,
      required: true,
      trim: true,
      enum: [
        "Technology",
        "Business",
        "Creative",
        "Lifestyle",
        "Entertainment",
        "Other",
      ],
    },

    isSuggested: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Interest = mongoose.model("Interest", interestSchema);

export default Interest;