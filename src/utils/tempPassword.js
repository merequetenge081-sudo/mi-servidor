const DEFAULT_TTL_HOURS = 24;

export function getTempPasswordTtlHours() {
  const raw = parseInt(process.env.TEMP_PASSWORD_TTL_HOURS, 10);
  if (Number.isFinite(raw) && raw > 0) {
    return raw;
  }

  return DEFAULT_TTL_HOURS;
}

export function getTempPasswordTtlMs() {
  return getTempPasswordTtlHours() * 60 * 60 * 1000;
}

export function isTempPasswordExpired(user, nowMs = Date.now()) {
  if (!user?.isTemporaryPassword) {
    return false;
  }

  const createdAt = user.tempPasswordCreatedAt
    ? new Date(user.tempPasswordCreatedAt).getTime()
    : 0;

  if (!createdAt || Number.isNaN(createdAt)) {
    return true;
  }

  return nowMs - createdAt > getTempPasswordTtlMs();
}
