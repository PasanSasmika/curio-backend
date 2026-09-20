import Interest from "../models/Interest.js";

export const getInterests = async (req, res, next) => {
  try {
    const interests = await Interest.find()
      .sort({ category: 1, name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: interests,
    });
  } catch (error) {
    next(error);
  }
};

export const searchInterests = async (req, res, next) => {
  try {
    const query = req.query.q?.trim();

    if (!query) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    /*
     * --------------------------------------------------
     * 1. Find matching interests from MongoDB
     * --------------------------------------------------
     */

    const databaseInterests = await Interest.find({
      name: {
        $regex: query,
        $options: "i",
      },
    })
      .sort({ name: 1 })
      .limit(10)
      .lean();

    /*
     * --------------------------------------------------
     * 2. Generate broader suggestions
     *
     * These don't need to exist in MongoDB.
     * This allows searches such as:
     *
     * Hindi Songs
     * Sinhala Songs
     * Football Highlights
     * Laravel Tutorial
     * Travel Sri Lanka
     * Gaming News
     * etc.
     * --------------------------------------------------
     */

    const suggestions = generateSuggestions(query);

    /*
     * --------------------------------------------------
     * 3. Combine database interests + generated
     *    suggestions without duplicates
     * --------------------------------------------------
     */

    const existingNames = new Set(
      databaseInterests.map((interest) =>
        interest.name.toLowerCase()
      )
    );

    const generatedInterests = suggestions
      .filter(
        (name) =>
          !existingNames.has(name.toLowerCase())
      )
      .map((name, index) => ({
        _id: `suggestion-${index}-${name
          .toLowerCase()
          .replace(/\s+/g, "-")}`,

        name,

        category: getCategory(name),

        isSuggested: true,

        isDynamic: true,
      }));

    const results = [
      ...databaseInterests,
      ...generatedInterests,
    ].slice(0, 20);

    res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

/*
 * --------------------------------------------------
 * Dynamic suggestion generator
 * --------------------------------------------------
 */

const generateSuggestions = (query) => {
  const cleanQuery = query
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanQuery) {
    return [];
  }

  const lowerQuery = cleanQuery.toLowerCase();

  const suggestions = [
    cleanQuery,

    `${cleanQuery} Tutorial`,
    `${cleanQuery} Guide`,
    `${cleanQuery} Tips`,
    `${cleanQuery} News`,
    `${cleanQuery} Videos`,
  ];

  /*
   * Music
   */

  if (
    lowerQuery.includes("song") ||
    lowerQuery.includes("music") ||
    lowerQuery.includes("sinhala") ||
    lowerQuery.includes("hindi") ||
    lowerQuery.includes("tamil") ||
    lowerQuery.includes("bollywood")
  ) {
    suggestions.push(
      `${cleanQuery} Songs`,
      `${cleanQuery} Music`,
      `${cleanQuery} New Songs`,
      `${cleanQuery} Old Songs`,
      `${cleanQuery} Best Songs`,
      `${cleanQuery} Playlist`
    );
  }

  /*
   * Technology
   */

  if (
    lowerQuery.includes("react") ||
    lowerQuery.includes("javascript") ||
    lowerQuery.includes("node") ||
    lowerQuery.includes("python") ||
    lowerQuery.includes("java") ||
    lowerQuery.includes("flutter") ||
    lowerQuery.includes("laravel") ||
    lowerQuery.includes("programming") ||
    lowerQuery.includes("coding") ||
    lowerQuery.includes("software") ||
    lowerQuery.includes("developer")
  ) {
    suggestions.push(
      `${cleanQuery} Tutorial`,
      `${cleanQuery} Projects`,
      `${cleanQuery} Course`,
      `${cleanQuery} Tips`,
      `${cleanQuery} for Beginners`,
      `${cleanQuery} Advanced`
    );
  }

  /*
   * Sports
   */

  if (
    lowerQuery.includes("football") ||
    lowerQuery.includes("cricket") ||
    lowerQuery.includes("basketball") ||
    lowerQuery.includes("tennis") ||
    lowerQuery.includes("sports")
  ) {
    suggestions.push(
      `${cleanQuery} Highlights`,
      `${cleanQuery} News`,
      `${cleanQuery} Live`,
      `${cleanQuery} Skills`,
      `${cleanQuery} Analysis`
    );
  }

  /*
   * Travel
   */

  if (
    lowerQuery.includes("travel") ||
    lowerQuery.includes("tour") ||
    lowerQuery.includes("trip") ||
    lowerQuery.includes("sri lanka")
  ) {
    suggestions.push(
      `${cleanQuery} Travel Guide`,
      `${cleanQuery} Places`,
      `${cleanQuery} Things to Do`,
      `${cleanQuery} Travel Tips`,
      `${cleanQuery} Vlog`
    );
  }

  /*
   * Gaming
   */

  if (
    lowerQuery.includes("game") ||
    lowerQuery.includes("gaming") ||
    lowerQuery.includes("minecraft") ||
    lowerQuery.includes("valorant")
  ) {
    suggestions.push(
      `${cleanQuery} Gameplay`,
      `${cleanQuery} Tips`,
      `${cleanQuery} Guide`,
      `${cleanQuery} News`,
      `${cleanQuery} Highlights`
    );
  }

  /*
   * Remove duplicates
   */

  return [
    ...new Map(
      suggestions.map((item) => [
        item.toLowerCase(),
        item,
      ])
    ).values(),
  ].slice(0, 15);
};

/*
 * --------------------------------------------------
 * Basic category detection
 * --------------------------------------------------
 */

const getCategory = (name) => {
  const value = name.toLowerCase();

  if (
    value.includes("react") ||
    value.includes("javascript") ||
    value.includes("node") ||
    value.includes("python") ||
    value.includes("flutter") ||
    value.includes("laravel") ||
    value.includes("coding") ||
    value.includes("programming") ||
    value.includes("software") ||
    value.includes("developer") ||
    value.includes("technology")
  ) {
    return "Technology";
  }

  if (
    value.includes("song") ||
    value.includes("music") ||
    value.includes("bollywood") ||
    value.includes("hindi") ||
    value.includes("tamil") ||
    value.includes("sinhala")
  ) {
    return "Entertainment";
  }

  if (
    value.includes("football") ||
    value.includes("cricket") ||
    value.includes("basketball") ||
    value.includes("tennis") ||
    value.includes("sports")
  ) {
    return "Entertainment";
  }

  if (
    value.includes("travel") ||
    value.includes("tour") ||
    value.includes("trip")
  ) {
    return "Lifestyle";
  }

  if (
    value.includes("business") ||
    value.includes("marketing") ||
    value.includes("finance") ||
    value.includes("career")
  ) {
    return "Business";
  }

  return "Other";
};

export const createInterest = async (req, res, next) => {
  try {
    const { name, category = "Other" } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Interest name is required",
      });
    }

    const interest = await Interest.create({
      name: name.trim(),
      category,
      isSuggested: false,
    });

    res.status(201).json({
      success: true,
      data: interest,
    });
  } catch (error) {
    next(error);
  }
};