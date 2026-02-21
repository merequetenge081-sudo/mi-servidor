import mongoose from "mongoose";

const auditConsentLogSchema = new mongoose.Schema({
  leaderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Leader',
    required: true,
    index: true
  },
  
  action: { 
    type: String, 
    required: true, 
    enum: ['terms_accepted', 'citizen_registered', 'citizen_updated'] 
  },
  
  citizenReferenceId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Registration',
    default: null
  },
  
  ipAddress: { 
    type: String, 
    default: null 
  },
  
  userAgent: {
    type: String,
    default: null
  },
  
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    index: true
  },
  
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true
  }
});

auditConsentLogSchema.index({ leaderId: 1, timestamp: -1 });
auditConsentLogSchema.index({ action: 1, timestamp: -1 });
auditConsentLogSchema.index({ organizationId: 1, timestamp: -1 });

export const AuditConsentLog = mongoose.model("AuditConsentLog", auditConsentLogSchema);
