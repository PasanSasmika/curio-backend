import Interest from "../models/Interest.js";

export const getInterests = async (req, res, next) => {
  try {
    const interests = await Interest.find()
      .sort({ name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: interests
    });
  } catch (error) {
    next(error);
  }
};

export const createInterest = async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Interest name is required"
      });
    }

    const interest = await Interest.create({
      name: name.trim()
    });

    res.status(201).json({
      success: true,
      data: interest
    });
  } catch (error) {
    next(error);
  }
};