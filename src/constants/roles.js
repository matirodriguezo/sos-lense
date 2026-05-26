export const ROLES = {
  CITIZEN: "CITIZEN",
  OFFICER: "OFFICER",
};

export const INCIDENT_STATUS = {
  NO_CLASIFICADO: "NO_CLASIFICADO",
  ACTIVO: "ACTIVO",
  EN_CURSO: "EN_CURSO",
  CERRADO: "CERRADO",
  ANULADO: "ANULADO",
};

export const INCIDENT_TYPES = [
  { id: "ROBO", label: "Robo", icon: "🔒" },
  { id: "VIOLENCIA", label: "Violencia", icon: "⚠️" },
  { id: "ACCIDENTE", label: "Accidente", icon: "🚗" },
  { id: "OTRO", label: "Otro", icon: "❓" },
];

export const QUICK_REQUESTS = [
  "Necesito una ambulancia",
  "Necesito intérprete de señas",
  "Estoy en peligro inmediato",
  "El sospechoso huyó",
  "Necesito ayuda",
  "Estoy bien",
];
