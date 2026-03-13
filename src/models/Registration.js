import mongoose from "mongoose";

const registrationSchema = new mongoose.Schema({
  leaderId: { type: String, required: true },
  leaderName: String,
  eventId: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  cedula: { type: String, required: true },
  email: String,
  phone: String,
  localidad: String,
  localidadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Localidad",
    default: null
  },
  departamento: String,
  capital: String,
  registeredToVote: { type: Boolean, default: false },

  // Campos libres para puesto/mesa cuando no se usa catálogo de Bogotá
  votingPlace: String,
  legacyVotingPlace: {
    type: String,
    default: ""
  },
  votingTable: String,
  
  // Referencia a puesto de votación (antes era texto libre: votingPlace)
  puestoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Puestos',
    default: null
  },
  
  // Mesa de votación (número, antes era texto libre: votingTable)
  mesa: {
    type: Number,
    default: null
  },
  mesaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Mesa",
    default: null
  },
  puestoMatchStatus: {
    type: String,
    enum: ["matched", "pending_review", "cross_localidad", "unmatched", "not_applicable"],
    default: "not_applicable",
    index: true
  },
  puestoMatchType: {
    type: String,
    default: ""
  },
  puestoMatchConfidence: {
    type: Number,
    default: null
  },
  puestoMatchReviewRequired: {
    type: Boolean,
    default: false,
    index: true
  },
  puestoMatchRawName: {
    type: String,
    default: ""
  },
  puestoMatchSuggestedPuestoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Puestos",
    default: null
  },
  puestoMatchSuggestedLocalidadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Localidad",
    default: null
  },
  puestoMatchResolvedAt: {
    type: Date,
    default: null
  },
  
  date: String,
  notifications: {
    emailSent: { type: Boolean, default: false },
    smsSent: { type: Boolean, default: false },
    whatsappSent: { type: Boolean, default: false }
  },
  confirmed: { type: Boolean, default: false },
  confirmedBy: String,
  confirmedAt: Date,
  
  // Consent field (Ley 1581 de 2012)
  hasConsentToRegister: { type: Boolean, default: false },
  
  // Revisión de puesto de votación
  requiereRevisionPuesto: { type: Boolean, default: false },
  revisionPuestoResuelta: { type: Boolean, default: false },
  
  // Nuevos campos para validación inteligente
  verificadoAuto: { type: Boolean, default: false },
  necesitaRevision: { type: Boolean, default: false },
  requiresReview: { type: Boolean, default: false },
  missingPollingPlace: { type: Boolean, default: false, index: true },
  inconsistenciaGrave: { type: Boolean, default: false },
  importado: { type: Boolean, default: false },

  // Estado de integridad de datos para métricas
  dataIntegrityStatus: {
    type: String,
    enum: ["valid", "needs_review", "invalid"],
    default: "valid",
    index: true
  },

  workflowStatus: {
    type: String,
    enum: [
      "new",
      "validated",
      "flagged",
      "duplicate",
      "invalid",
      "pending_call",
      "called",
      "confirmed",
      "rejected",
      "archived"
    ],
    default: "new",
    index: true
  },

  validationErrors: {
    type: [String],
    default: []
  },

  deduplicationFlags: {
    type: [String],
    default: []
  },

  mesaValidationStatus: {
    type: String,
    enum: ["valido", "mesa_invalida", "puesto_invalido", "datos_incompletos", "sin_validar"],
    default: "sin_validar",
    index: true
  },

  mesaValidationDetail: {
    type: String,
    default: ""
  },

  officialValidationStatus: {
    type: String,
    enum: [
      "official_valid",
      "invalid_puesto",
      "invalid_mesa",
      "mismatched_localidad",
      "incomplete",
      "unresolved_legacy",
      "placeholder_or_noise",
      "pending_official_validation",
      "outside_official_scope"
    ],
    default: "pending_official_validation",
    index: true
  },
  officialValidationReason: {
    type: String,
    default: ""
  },
  officialValidationReviewed: {
    type: Boolean,
    default: false,
    index: true
  },
  officialCatalogVersion: {
    type: String,
    default: ""
  },
  officialLocalidadNombre: {
    type: String,
    default: ""
  },
  officialPuestoNombre: {
    type: String,
    default: ""
  },
  officialPuestoCodigo: {
    type: String,
    default: ""
  },
  officialMesaNumero: {
    type: Number,
    default: null
  },
  officialMesaValid: {
    type: Boolean,
    default: false
  },
  officialPuestoValid: {
    type: Boolean,
    default: false
  },
  movedToErrorBucket: {
    type: Boolean,
    default: false,
    index: true
  },
  errorBucketReason: {
    type: String,
    default: ""
  },
  officialSuggestedPuesto: {
    type: String,
    default: ""
  },
  officialSuggestedLocalidad: {
    type: String,
    default: ""
  },
  correctionHistory: {
    type: [
      {
        previous: {
          localidad: { type: String, default: "" },
          localidadId: { type: mongoose.Schema.Types.ObjectId, ref: "Localidad", default: null },
          puesto: { type: String, default: "" },
          puestoId: { type: mongoose.Schema.Types.ObjectId, ref: "Puestos", default: null },
          mesa: { type: Number, default: null },
          mesaId: { type: mongoose.Schema.Types.ObjectId, ref: "Mesa", default: null },
          officialValidationStatus: { type: String, default: "" },
          officialValidationReason: { type: String, default: "" }
        },
        next: {
          localidad: { type: String, default: "" },
          localidadId: { type: mongoose.Schema.Types.ObjectId, ref: "Localidad", default: null },
          puesto: { type: String, default: "" },
          puestoId: { type: mongoose.Schema.Types.ObjectId, ref: "Puestos", default: null },
          mesa: { type: Number, default: null },
          mesaId: { type: mongoose.Schema.Types.ObjectId, ref: "Mesa", default: null },
          officialValidationStatus: { type: String, default: "" },
          officialValidationReason: { type: String, default: "" }
        },
        correctionNote: { type: String, default: "" },
        correctedBy: { type: String, default: "" },
        correctedAt: { type: Date, default: Date.now },
        source: { type: String, default: "manual_admin_correction" }
      }
    ],
    default: []
  },
  
  // Confirmacion E14 por mesa (CAMARA - Bogota - candidata 105)
  e14VotesCandidate105: {
    type: Number,
    default: null
  },
  e14ZoneCode: {
    type: String,
    default: null
  },
  e14ListVotes: {
    type: Number,
    default: null
  },
  e14ConfirmationPercentage: {
    type: Number,
    default: null
  },
  e14Difference: {
    type: Number,
    default: null
  },
  e14ValidationStatus: {
    type: String,
    enum: [
      "confirmado",
      "confirmacion_alta",
      "confirmacion_parcial",
      "confirmacion_baja",
      "sin_confirmacion",
      "pendiente_e14",
      "datos_incompletos",
      "sin_votos_reportados"
    ],
    default: "pendiente_e14",
    index: true
  },
  e14ValidationNotes: {
    type: String,
    default: ""
  },
  e14ValidatedAt: {
    type: Date,
    default: null
  },
  e14ValidatedBy: {
    type: String,
    default: null
  },
  e14ValidationSource: {
    type: String,
    enum: ["manual", "system"],
    default: null
  },
  
  organizationId: { 
    type: String,
    required: true,
    index: true
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Middleware pre-save: sanitizar strings
registrationSchema.pre('save', function(next) {
  // Trim all string fields
  if (this.firstName) this.firstName = this.firstName.trim();
  if (this.lastName) this.lastName = this.lastName.trim();
  if (this.cedula) this.cedula = this.cedula.trim();
  if (this.email) this.email = this.email.trim();
  if (this.phone) this.phone = this.phone.trim();
  if (this.localidad) this.localidad = this.localidad.trim();
  if (this.departamento) this.departamento = this.departamento.trim();
  if (this.capital) this.capital = this.capital.trim();
  if (this.votingPlace) this.votingPlace = this.votingPlace.trim();
  if (this.legacyVotingPlace) this.legacyVotingPlace = this.legacyVotingPlace.trim();
  if (this.votingTable) this.votingTable = this.votingTable.trim();
  if (this.leaderName) this.leaderName = this.leaderName.trim();
  next();
});

// Índices para optimización
registrationSchema.index({ cedula: 1, eventId: 1 }, { unique: true });
registrationSchema.index({ leaderId: 1 });
registrationSchema.index({ eventId: 1 });
registrationSchema.index({ cedula: 1 });
registrationSchema.index({ email: 1 });
registrationSchema.index({ createdAt: -1 });
registrationSchema.index({ confirmed: 1, eventId: 1 });
registrationSchema.index({ organizationId: 1, eventId: 1 });
registrationSchema.index({ organizationId: 1, leaderId: 1 });
registrationSchema.index({ requiereRevisionPuesto: 1, organizationId: 1 });
registrationSchema.index({ requiereRevisionPuesto: 1, leaderId: 1 });
registrationSchema.index({ dataIntegrityStatus: 1, organizationId: 1 });
registrationSchema.index({ workflowStatus: 1, organizationId: 1 });
registrationSchema.index({ e14ValidationStatus: 1, organizationId: 1, eventId: 1 });
registrationSchema.index({ e14ZoneCode: 1, organizationId: 1, eventId: 1 });
registrationSchema.index({ organizationId: 1, localidadId: 1, puestoId: 1, mesaId: 1 });
registrationSchema.index({ organizationId: 1, puestoMatchStatus: 1, puestoMatchReviewRequired: 1 });
registrationSchema.index({ organizationId: 1, puestoMatchSuggestedPuestoId: 1, puestoMatchSuggestedLocalidadId: 1 });
registrationSchema.index({ organizationId: 1, officialValidationStatus: 1, eventId: 1 });
registrationSchema.index({ organizationId: 1, movedToErrorBucket: 1, officialValidationStatus: 1 });
registrationSchema.index({ organizationId: 1, officialValidationReviewed: 1, updatedAt: -1 });
registrationSchema.index({ organizationId: 1, officialValidationReason: 1, createdAt: -1 });
registrationSchema.index({ organizationId: 1, eventId: 1, officialPuestoCodigo: 1, officialMesaNumero: 1 });
registrationSchema.index({ organizationId: 1, "correctionHistory.correctedAt": -1 });

export const Registration = mongoose.model("Registration", registrationSchema);

