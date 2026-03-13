export function sendError(res, status, message, code = null, details = undefined) {
  const payload = { error: message };
  if (code) payload.code = code;
  if (details !== undefined) payload.details = details;
  return res.status(status).json(payload);
}

