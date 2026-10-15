export type MetricKey =
  | "temperature_c"
  | "moisture_pct"
  | "conductivity"
  | "ph"
  | "nitrogen"
  | "phosphorus"
  | "potassium"
  | "salinity";

export const SOIL_METRICS: { key: MetricKey; label: string; unit: string }[] = [
  { key: "temperature_c", label: "Temperature", unit: "°C" },
  { key: "moisture_pct", label: "Soil moisture", unit: "%" },
  { key: "conductivity", label: "Conductivity", unit: "µS/cm" },
  { key: "ph", label: "pH", unit: "pH" },
  { key: "nitrogen", label: "Nitrogen", unit: "mg/kg" },
  { key: "phosphorus", label: "Phosphorus", unit: "mg/kg" },
  { key: "potassium", label: "Potassium", unit: "mg/kg" },
  { key: "salinity", label: "Salinity", unit: "ppm" },
];

export const metricLabel = (key: string) =>
  SOIL_METRICS.find(m => m.key === key)?.label || key;

export const metricUnit = (key: string) =>
  SOIL_METRICS.find(m => m.key === key)?.unit || "";
