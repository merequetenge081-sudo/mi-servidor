# FASE 4: MONITORING & DEPRECATION PLANNING

**Status**: 🔵 EN PROGRESO
**Timeline**: Esta sesión + próximas 2 semanas
**Objective**: Track v1→v2 migration, plan deprecation

---

## 🎯 Objetivos Fase 4

1. **Monitor Fallback Usage**: Trackear cuándo/cómo se usa fallback
2. **Analytics v1 vs v2**: Medir adopción de v2
3. **Deprecation Warnings**: Notificar developers
4. **Sunset Planning**: Definir fecha de retiro v1

---

## 📊 Parte 1: Fallback Usage Monitoring

### Implementación: Tracking en api.js

**Features**:
- Log cada vez que se usa fallback
- Log de errores que causan fallback
- Aggregate en localStorage
- Enviar a analytics/logs

**Changes a api.js**:

```javascript
// Agregar global metrics object
window._apiMetrics = {
  v2_success: 0,
  v2_failed: 0,
  v1_fallback: 0,
  endpoints_used: {},
  last_fallback: null,
  errors: []
};

// En apiRequestWithFallback():
if (response.status === 404) {
  const msg = `Fallback from ${primaryUrl} to ${fallbackUrl}`;
  window._apiMetrics.v1_fallback++;
  window._apiMetrics.last_fallback = new Date().toISOString();
  if (!window._apiMetrics.endpoints_used[primaryUrl]) {
    window._apiMetrics.endpoints_used[primaryUrl] = 0;
  }
  window._apiMetrics.endpoints_used[primaryUrl]++;
  
  console.warn(`[API Fallback] ${msg}`);
  // Log to backend if available
}
```

---

## 🚨 Parte 2: Deprecation Warnings

### En Console
```javascript
// Agregar warning cuando se usa fallback
if (response.status === 404) {
  console.warn(`
    ⚠️ [DEPRECATED API] Endpoint ${primaryUrl} not found
    Using fallback: ${fallbackUrl}
    
    This endpoint will be removed in Q2 2026.
    Please migrate to v2 API.
    See: https://docs.example.com/api-v2-migration
  `);
}
```

### En Network Headers
```javascript
// Agregar header deprecation en fallback responses
headers['Deprecation'] = 'true';
headers['Sunset'] = 'Sun, 30 Jun 2026 23:59:59 GMT';
```

---

## 📈 Parte 3: Analytics Dashboard Proposal

### Metrics to Track
1. **Adoption Rate**: % requests using v2 vs v1
2. **Fallback Frequency**: How often fallback triggered
3. **Error Distribution**: Which endpoints need v2 fixes
4. **Performance**: v2 vs v1 latency comparison
5. **User Impact**: 0 = perfect, 100 = issues

### Implementation Options

**Option A: Browser Storage** (Simple, local only)
```javascript
// Store metrics in localStorage
localStorage.setItem('_apiMetrics', JSON.stringify(window._apiMetrics));
```

**Option B: Backend logging** (Production-ready)
```javascript
// POST metrics to backend
fetch('/api/v2/metrics/api-usage', {
  method: 'POST',
  body: JSON.stringify(window._apiMetrics)
});
```

**Option C: Third-party service** (Analytics)
```javascript
// Send to Segment, Mixpanel, etc.
analytics.track('API_Fallback', {
  endpoint: primaryUrl,
  fallback: fallbackUrl,
  timestamp: new Date()
});
```

---

## 📋 Parte 4: Deprecation Timeline

### Fase 4A (This week)
- [ ] Add fallback monitoring to api.js
- [ ] Add console warnings
- [ ] Document metrics
- [ ] Setup backend logging

### Fase 4B (Next 2 weeks)
- [ ] Monitor fallback frequency
- [ ] Identify problematic endpoints
- [ ] Fix v2 analytics backend
- [ ] Verify v2 adoption

### Fase 4C (Following 2 weeks)
- [ ] Announce v1 sunset date (e.g., June 30, 2026)
- [ ] Create migration guide
- [ ] Schedule deprecation warnings
- [ ] Plan Phase 5 (v1 removal)

---

## 🔧 Implementation Tasks

### Task 1: Add Metrics Object to api.js
**File**: `public/assets/js/api.js`

```javascript
// Add near top of file after base URLs defined
window._apiMetrics = {
  session_start: new Date().toISOString(),
  v2_success: 0,
  v2_failed: 0,
  v1_fallback: 0,
  endpoints_used: {},
  last_fallback: null,
  last_error: null
};

// Helper function to log metrics
function logMetric(type, data) {
  if (type === 'fallback') {
    window._apiMetrics.v1_fallback++;
    window._apiMetrics.last_fallback = new Date().toISOString();
    if (!window._apiMetrics.endpoints_used[data.endpoint]) {
      window._apiMetrics.endpoints_used[data.endpoint] = { count: 0, timestamps: [] };
    }
    window._apiMetrics.endpoints_used[data.endpoint].count++;
    window._apiMetrics.endpoints_used[data.endpoint].timestamps.push(new Date().toISOString());
  }
}

// Console helper for debugging
window._getApiMetrics = () => window._apiMetrics;
window._clearApiMetrics = () => {
  window._apiMetrics = {...window._apiMetrics, v1_fallback: 0, endpoints_used: {}};
};
```

### Task 2: Integrate Metrics into apiRequestWithFallback()
```javascript
async function apiRequestWithFallback(primaryUrl, fallbackUrl, options = {}) {
  try {
    const response = await fetch(primaryUrl, options);
    if (response.ok) {
      window._apiMetrics.v2_success++;
      return await response.json();
    }
    if (response.status === 404 && fallbackUrl) {
      logMetric('fallback', { endpoint: primaryUrl, fallback: fallbackUrl });
      console.warn(`⚠️ [API Fallback] ${primaryUrl} → ${fallbackUrl}`);
      
      const fallbackResponse = await fetch(fallbackUrl, options);
      if (fallbackResponse.ok) {
        return await fallbackResponse.json();
      }
      window._apiMetrics.v2_failed++;
      throw new Error('Both endpoints failed');
    }
    window._apiMetrics.v2_failed++;
    throw new Error('Request failed');
  } catch (error) {
    window._apiMetrics.last_error = error.message;
    throw error;
  }
}
```

### Task 3: Add Deprecation Warning to Console
```javascript
function logDeprecationWarning(endpoint, fallback) {
  const sunsetDate = new Date('2026-06-30');
  const daysUntilSunset = Math.ceil((sunsetDate - new Date()) / (1000 * 60 * 60 * 24));
  
  console.warn(`%c⚠️ DEPRECATED ENDPOINT`, 'color: orange; font-weight: bold; font-size: 12px;');
  console.warn(`Endpoint: ${endpoint}`);
  console.warn(`Using fallback: ${fallback}`);
  console.warn(`Days until sunset: ${daysUntilSunset}`);
  console.warn(`Documentation: /docs/api-v2-migration`);
}
```

### Task 4: Add Metrics Export Function
```javascript
window._exportApiMetrics = function() {
  const metricsJson = JSON.stringify(window._apiMetrics, null, 2);
  console.log('========== API METRICS ==========');
  console.log(metricsJson);
  console.log('=================================');
  
  // Also return for programmatic use
  return window._apiMetrics;
};
```

---

## 📊 Expected Outcomes

### Without Monitoring (Current)
```
[Unknown]
- Don't know if v2 is being used
- Can't track fallback frequency
- No data on adoption rate
- Blind deprecation planning
```

### With Monitoring (Phase 4)
```
Session Metrics:
- v2_success: 45 requests
- v2_failed: 0 requests  
- v1_fallback: 5 requests (from v2 analytics endpoint)
- Adoption: 90% using v2

Last Fallback:
- Endpoint: /api/v2/analytics/dashboard
- Reason: 500 error (backend bug)
- Fallback: /api/stats
- Time: 2026-02-24T02:04:37Z

Problematic Endpoints:
- /api/v2/analytics/dashboard (needs backend fix)
```

---

## 🚀 Quick Start for Phase 4

### Step 1: Add Metrics to api.js
[Wait for implementation]

### Step 2: Test Monitoring
```javascript
// In browser console:
_getApiMetrics()  // See current metrics
_exportApiMetrics()  // Export as JSON
_clearApiMetrics()  // Reset counters
```

### Step 3: Monitor Session
- Load dashboard
- Interact with app
- Watch fallback tracking
- Check console warnings

### Step 4: Plan Deprecation
- Based on metrics, decide roadmap
- Set sunset date
- Announce to team

---

## 📝 Phase 4 Schedule

```
Week 1 (This week):
  - Implement metrics tracking
  - Add console warnings
  - Deploy to dev/staging
  
Week 2:
  - Monitor fallback frequency
  - Collect baseline data
  - Fix v2 analytics backend
  
Week 3-4:
  - Analyze metrics
  - Plan v1 sunset
  - Create migration guide
  - Schedule Phase 5
```

---

## 🎯 Success Criteria Phase 4

✅ Fallback tracking implemented
✅ Console warnings active
✅ Metrics accessible via window._apiMetrics
✅ Data collection verified
✅ Deprecation timeline planned
✅ v1 sunset date set
✅ Team notified of changes
✅ Migration guide ready

---

**Next Action**: Implement Task 1 (Add Metrics Object)
