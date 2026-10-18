export function canControlAutomation(role: string | undefined, masterAdmin = false) {
  return masterAdmin || role === "admin" || role === "operator";
}

export function alertsForAppliance<T extends { sensors?: { zone_id: string | null } | null }>(alerts: T[], zoneId: string | null) {
  return zoneId ? alerts.filter(alert => alert.sensors?.zone_id === zoneId) : [];
}