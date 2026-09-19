import "dotenv/config";
import mongoose from "mongoose";
import Interest from "../models/Interest.js";

const interests = [
  // Technology
  { name: "React Native", category: "Technology" },
  { name: "JavaScript", category: "Technology" },
  { name: "Node.js", category: "Technology" },
  { name: "Web Development", category: "Technology" },
  { name: "Mobile Development", category: "Technology" },
  { name: "AI", category: "Technology" },
  { name: "Machine Learning", category: "Technology" },
  { name: "Cybersecurity", category: "Technology" },
  { name: "Cloud Computing", category: "Technology" },
  { name: "Data Science", category: "Technology" },

  // Business
  { name: "Business", category: "Business" },
  { name: "Entrepreneurship", category: "Business" },
  { name: "Marketing", category: "Business" },
  { name: "Personal Finance", category: "Business" },
  { name: "Career Development", category: "Business" },
  { name: "Productivity", category: "Business" },

  // Creative
  { name: "Photography", category: "Creative" },
  { name: "Video Editing", category: "Creative" },
  { name: "Graphic Design", category: "Creative" },
  { name: "UI/UX Design", category: "Creative" },
  { name: "Music", category: "Creative" },
  { name: "Drawing", category: "Creative" },

  // Lifestyle
  { name: "Travel", category: "Lifestyle" },
  { name: "Fitness", category: "Lifestyle" },
  { name: "Cooking", category: "Lifestyle" },
  { name: "Food", category: "Lifestyle" },
  { name: "Personal Development", category: "Lifestyle" },
  { name: "Books", category: "Lifestyle" },
  { name: "Psychology", category: "Lifestyle" },
  { name: "Science", category: "Lifestyle" },

  // Entertainment
  { name: "Gaming", category: "Entertainment" },
  { name: "Movies", category: "Entertainment" },
  { name: "Sports", category: "Entertainment" },
  { name: "Cars", category: "Entertainment" },
  { name: "Technology News", category: "Entertainment" },
];

const seedInterests = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected");

    for (const interest of interests) {
      await Interest.updateOne(
        { name: interest.name },
        {
          $set: {
            category: interest.category,
            isSuggested: true,
          },
        },
        { upsert: true }
      );
    }

    console.log(
      `${interests.length} interests seeded successfully`
    );

    await mongoose.disconnect();
  } catch (error) {
    console.error("Interest seed failed:", error.message);
    process.exit(1);
  }
};

seedInterests();