"use strict";

const ApiError = require("../utils/ApiError");
const env = require("../config/env");

function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`, "ROUTE_NOT_FOUND"));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  // Normalize common non-ApiError failures.
  if (!(error instanceof ApiError)) {
    if (error && error.name === "ValidationError") {
      error = ApiError.badRequest(error.message, "MONGOOSE_VALIDATION");
    } else if (error && error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0] || "field";
      error = ApiError.conflict(`Duplicate value for ${field}`, "DUPLICATE_KEY");
    } else if (error && error.name === "CastError") {
      error = ApiError.badRequest("Invalid identifier", "INVALID_ID");
    } else {
      error = new ApiError(500, "INTERNAL_ERROR", "Something went wrong");
    }
  }

  if (error.statusCode >= 500) {
    console.error("[error]", err);
  }

  res.status(error.statusCode).json({
    success: false,
    data: null,
    meta: null,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
      ...(env.isProd ? {} : { stack: err.stack }),
    },
  });
}

module.exports = { notFound, errorHandler };
