(function initAppCommon(global) {
  function getApiBaseUrl() {
    return global.location.origin;
  }

  function getStorageItem(key) {
    return global.sessionStorage.getItem(key) || global.localStorage.getItem(key);
  }

  function setStorageBoth(key, value) {
    if (value === undefined || value === null) return;
    const serialized = String(value);
    global.localStorage.setItem(key, serialized);
    global.sessionStorage.setItem(key, serialized);
  }

  function clearAuthSession() {
    [
      "token",
      "role",
      "username",
      "leaderId",
      "admin_token",
      "temp_token",
      "lastActivity"
    ].forEach((key) => {
      global.localStorage.removeItem(key);
      global.sessionStorage.removeItem(key);
    });
  }

  function setAuthSession(payload) {
    clearAuthSession();
    if (!payload || !payload.token || !payload.role) return;
    setStorageBoth("token", payload.token);
    setStorageBoth("role", payload.role);
    setStorageBoth("username", payload.username || "");
    if (payload.leaderId) setStorageBoth("leaderId", payload.leaderId);
    setStorageBoth("lastActivity", Date.now().toString());
  }

  function getAuthToken() {
    return getStorageItem("token");
  }

  function getAuthRole() {
    return getStorageItem("role");
  }

  function getSelectedEventId() {
    return getStorageItem("eventId") || "";
  }

  function setSelectedEvent(id, name) {
    setStorageBoth("eventId", id || "");
    setStorageBoth("eventName", name || "");
  }

  global.AppCommon = {
    getApiBaseUrl,
    getStorageItem,
    setStorageBoth,
    clearAuthSession,
    setAuthSession,
    getAuthToken,
    getAuthRole,
    getSelectedEventId,
    setSelectedEvent
  };
})(window);
