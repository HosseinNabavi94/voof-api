"use strict";

const ApiError = require("../utils/ApiError");

/**
 * Validate a request section against a zod schema.
 * Usage: validate(schema, "body") | validate(schema, "query") | validate(schema, "params")
 * On success, replaces req[section] with the parsed (typed/defaulted) value.
 */
function validate(schema, section = "body") {
  return (req, _res, next) => {
    const result = schema.safeParse(req[section]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      return next(
        ApiError.badRequest("Validation failed", "VALIDATION_ERROR", details)
      );
    }
    req[section] = result.data;
    next();
  };
}

module.exports = validate;
