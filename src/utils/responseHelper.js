/**
 * Standard API Response Helper
 * Mengikuti best practice REST API response structure
 * 
 * Success Response Structure:
 * {
 *   success: true,
 *   status: "success",
 *   message: "Operation successful",
 *   data: {...}
 * }
 * 
 * Error Response Structure:
 * {
 *   success: false,
 *   status: "error",
 *   message: "Error description",
 *   data: null
 * }
 */

export function successResponse(res, data, message, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    status: "success",
    message,
    data,
  });
}

export function errorResponse(res, message, statusCode = 500) {
  return res.status(statusCode).json({
    success: false,
    status: "error",
    message,
    data: null,
  });
}
