export const errorHandler = (err, req, res, next) => {
  console.error(err);

  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Content already exists"
    });
  }

  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
};