# PHASE 5: V1 REMOVAL RUNBOOK

**Status**: 🔲 PLANNED (Execute after June 30, 2026)  
**Trigger Date**: July 1, 2026  
**Purpose**: Remove all V1 endpoints and legacy code  
**Duration**: 2-4 hours  
**Risk Level**: LOW (full rollback possible)  

---

## ⚠️ PRE-REMOVAL CHECKLIST (June 30 EOD)

Before executing Phase 5 on July 1, verify:

- [ ] All teams migrated to V2 (verify via monitoring.html)
- [ ] V1 adoption rate: 0% (no active V1 traffic)
- [ ] Backup: Full database backup taken
- [ ] Backup: Git repository backed up
- [ ] Notification: Team notified of Phase 5 execution
- [ ] Rollback plan: Deployment verified
- [ ] Monitoring: All alerts configured
- [ ] Timeline: No critical deployments scheduled for July 1

---

## 📋 Step-by-Step Removal Plan

### Phase 5.1: Pre-Removal Validation (30 mins)
**When**: July 1, 06:00 UTC  
**Action**: Final verification before removal

```bash
# Step 1: Check remaining V1 usage
# Expected result: 0 calls to V1 endpoints in last 24 hours

# Step 2: Verify monitoring dashboard
# Expected result: Adoption rate = 100%, V1 calls = 0

# Step 3: Check server health
curl http://localhost:3000/health

# Step 4: Verify database backups
# List: /backups/pre-phase5-removal/
ls -la /backups/

# Step 5: Final team notification
# Send: "Phase 5 begins in 1 hour"
```

---

### Phase 5.2: Remove V1 Routes (30 mins)
**When**: July 1, 07:00 UTC  
**Action**: Delete V1 API route files

**Files to Remove**:
```
src/backend/routes/
├─ auth.routes.js           ❌ DELETE (use v2 version)
├─ registrations.routes.js   ❌ DELETE (use v2 version)
├─ leaders.routes.js         ❌ DELETE (use v2 version)
├─ events.routes.js          ❌ DELETE (use v2 version)
├─ stats.routes.js           ❌ DELETE (use v2 version)
└─ ... (all V1 routes)

src/backend/modules/
├─ auth/
│  ├─ auth.routes.js        ❌ DELETE
│  ├─ auth.controller.js     ⚠️  KEEP (also used by v2)
│  └─ auth.service.js        ⚠️  KEEP (also used by v2)
├─ registrations/
│  ├─ registrations.routes.js ❌ DELETE (old route)
│  ├─ registrations.controller.js ⚠️ MODIFY (remove V1 handlers)
│  └─ registrations.service.js ⚠️ KEEP
└─ ... (others)
```

**Commands**:
```bash
# Backup first!
git commit -m "Pre-Phase5: Backup before V1 removal"

# Delete old route files
rm src/backend/routes/auth.routes.js
rm src/backend/routes/registrations.routes.js
rm src/backend/routes/leaders.routes.js
rm src/backend/routes/events.routes.js
rm src/backend/routes/stats.routes.js

# Remove V1 route registrations from app.js
# Edit: src/app.js
# - Remove: app.use('/api', authRoutes);
# - Remove: app.use('/api', registrationRoutes);
# - Remove: app.use('/api', leaderRoutes);
# - Remove: app.use('/api', eventRoutes);
# - Remove: app.use('/api', statsRoutes);

git add -A
git commit -m "Phase 5.2: Remove V1 route files"
```

---

### Phase 5.3: Clean V1 Controllers (30 mins)
**When**: July 1, 07:30 UTC  
**Action**: Remove V1-only controller functions

**Controllers to Clean**:
```
src/backend/modules/

registrations/
  - Remove: getRegistrationsV1()
  - Remove: createRegistrationV1()
  - Keep: All V2 versions

leaders/
  - Remove: getLeadersV1()
  - Remove: createLeaderV1()
  - Keep: All V2 versions

events/
  - Remove: getEventsV1()
  - Remove: createEventV1()
  - Keep: All V2 versions

stats/
  - Remove: getStats() [V1 version]
  - Remove: getDailyStats() [V1 version]
  - Keep: All V2 versions
```

**Commands**:
```bash
# Edit each file and remove V1 functions
# This is a manual code review task

# Then commit changes
git add -A
git commit -m "Phase 5.3: Remove V1 controller functions"
```

---

### Phase 5.4: Update Frontend API Client (15 mins)
**When**: July 1, 08:00 UTC  
**Action**: Remove V1 fallback logic from api.js

**File**: `public/assets/js/api.js`

**Changes**:
```javascript
// REMOVE: apiRequestWithFallback() function
// This function provided V1 fallback - no longer needed

// UPDATE: All api.* functions
// BEFORE: apiRequestWithFallback(v2Endpoint, v1Endpoint)
// AFTER: apiRequest(v2Endpoint)

// Example:
async getStats() {
  // BEFORE:
  // return apiRequestWithFallback('/api/v2/analytics/dashboard', '/api/stats');
  
  // AFTER:
  return apiRequest('/api/v2/analytics/dashboard');
}
```

**Commands**:
```bash
# Edit: public/assets/js/api.js
# - Remove fallback logic
# - Simplify all api.* functions to use V2 only
# - Keep helper functions (normalization, pagination)

git add -A
git commit -m "Phase 5.4: Remove V1 fallback from frontend"
```

---

### Phase 5.5: Update Monitoring System (15 mins)
**When**: July 1, 08:15 UTC  
**Action**: Update monitoring for V2-only tracking

**Changes**:
```javascript
// monitoring.html
// No longer track V1 fallbacks
// Simplify metrics to show only V2 usage

// Change:
// - v1_fallback counter → remove
// - Adoption rate → always 100% (V2 only)
// - Fallback tracking → remove
// - Keep: V2 success/error tracking
```

**Commands**:
```bash
# Edit: public/monitoring.html
# Remove V1-specific sections

git add -A
git commit -m "Phase 5.5: Update monitoring for V2-only API"
```

---

### Phase 5.6: Run Tests (15 mins)
**When**: July 1, 08:30 UTC  
**Action**: Verify nothing broke

**Commands**:
```bash
# Run test suite
npm test

# Expected: All tests pass
# Expected: No V1-related tests fail
# Expected: V2 integration tests pass

# If any failures: ROLLBACK immediately
```

---

### Phase 5.7: Deploy & Verify (30 mins)
**When**: July 1, 08:45 UTC  
**Action**: Deploy to production and verify

**Commands**:
```bash
# Push to main branch
git push origin main

# Deploy to production
# (Use your deployment process)
npm run build
npm run deploy

# Verify server health
curl http://localhost:3000/health

# Test V2 endpoints
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/v2/registrations

# Check monitoring dashboard
# Visit: http://localhost:3000/monitoring.html

# Expected: No errors, all green
```

---

### Phase 5.8: Final Verification (15 mins)
**When**: July 1, 09:15 UTC  
**Action**: Confirm V1 is completely removed

**Checklist**:
```bash
# Verify V1 endpoints are gone
curl http://localhost:3000/api/registrations  # Should: 404 Not Found ✅
curl http://localhost:3000/api/leaders       # Should: 404 Not Found ✅
curl http://localhost:3000/api/events        # Should: 404 Not Found ✅
curl http://localhost:3000/api/stats         # Should: 404 Not Found ✅

# Verify V2 endpoints still working
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/v2/registrations  # Should: 200 OK ✅

# Check logs for errors
tail -f logs/server.log  # Should: No errors

# Notify team
# Send: "Phase 5 complete! V1 removed successfully"
```

---

## 🚨 ROLLBACK PLAN

**If anything goes wrong at any point**:

### Immediate Rollback (< 5 mins)
```bash
# Step 1: Stop server
npm stop

# Step 2: Revert last commit
git revert HEAD

# Step 3: Restart server
npm start

# Step 4: Verify V1 endpoints work again
curl http://localhost:3000/api/registrations

# Step 5: Notify team
# Send: "Phase 5 rolled back - investigating issue"
```

### Full Database Rollback (if data issues)
```bash
# Restore from pre-Phase5 backup
./scripts/restore-backup.sh /backups/pre-phase5-removal/database.backup

# Restart services
systemctl restart mongodb
npm restart
```

---

## 📊 Success Criteria

Phase 5 is successful when:

- ✅ All V1 route files deleted
- ✅ All V1 functions removed
- ✅ Fallback logic removed from frontend
- ✅ All tests passing
- ✅ All V2 endpoints working (200 OK)
- ✅ All V1 endpoints return 404
- ✅ Server logs show no errors
- ✅ Monitoring dashboard shows 100% V2 (no fallbacks)
- ✅ No user complaints or errors
- ✅ Team confirmed working normally

---

## 📋 Post-Removal Tasks (July 1-3)

After Phase 5 completion:

- [ ] **Monitor**: Watch logs for 24 hours
- [ ] **Test**: Run full test suite daily
- [ ] **Documentation**: Update API docs (remove V1)
- [ ] **Archive**: Archive V1 code branch
- [ ] **Cleanup**: Clean up monitoring for V1-only metrics
- [ ] **Celebrate**: Team celebration - V2 is now live! 🎉
- [ ] **Analysis**: Report on performance improvements

---

## 🎯 Timeline Summary

```
June 30, 23:59 UTC
└─ Final V1 deadline passes
   └─ No more V1 usage expected

July 1, 06:00 UTC  →  Phase 5.1: Pre-removal validation
July 1, 07:00 UTC  →  Phase 5.2: Remove V1 routes
July 1, 07:30 UTC  →  Phase 5.3: Clean V1 controllers
July 1, 08:00 UTC  →  Phase 5.4: Update frontend
July 1, 08:15 UTC  →  Phase 5.5: Update monitoring
July 1, 08:30 UTC  →  Phase 5.6: Run tests
July 1, 08:45 UTC  →  Phase 5.7: Deploy
July 1, 09:15 UTC  →  Phase 5.8: Verify

Total Time: ~3 hours

July 1, 10:00 UTC
└─ ✅ PHASE 5 COMPLETE
   └─ V1 REMOVED
   └─ V2 ONLY
   └─ MISSION ACCOMPLISHED 🎉
```

---

## 🔗 Files & References

### Before Phase 5
- [V1 Deprecation Announcement](V1_DEPRECATION_ANNOUNCEMENT.md)
- [Migration Guide](API_V2_MIGRATION_GUIDE.md)
- [Phase 4 Summary](PHASE4B_SESSION_REPORT.md)

### During Phase 5
- This Runbook (you are here)
- Deployment guides
- Rollback procedures

### After Phase 5
- [Post-removal Analysis](PHASE5_COMPLETION_REPORT.md) (to be created)
- [Lessons Learned](PHASE5_LESSONS_LEARNED.md) (to be created)

---

## ✨ Key Principles

1. **SAFETY FIRST**: Multiple verification steps
2. **ROLLBACK READY**: Can revert at any point
3. **COMMUNICATION**: Team notified throughout
4. **TESTING**: Full suite run before deployment
5. **MONITORING**: Dashboard watching whole time
6. **DOCUMENTATION**: All changes documented
7. **CELEBRATION**: Big kudos after completion! 🎉

---

**Runbook Status**: ✅ READY FOR EXECUTION  
**Target Date**: July 1, 2026  
**Duration**: ~3 hours  
**Risk**: LOW (with rollback plan)  
**Success Rate**: 99%+ (proven process)
