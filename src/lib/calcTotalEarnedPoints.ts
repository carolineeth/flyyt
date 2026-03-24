import type { CatalogItem, Registration } from "@/hooks/useActivityCatalog";

/**
 * Calculates total earned activity points applying the 3-optional-per-week cap.
 *
 * Algorithm (mirrors PointsPlanner.calcWeekPoints):
 * - Group completed registrations by their effective week
 *   (completed_week if set, else planned_week)
 * - Per week: mandatory points are uncapped; optional points are capped at 3
 * - Completed registrations with no week assigned are added without any cap
 *
 * This is the single source of truth — import and use this everywhere a
 * "total earned" number is needed so all pages show the same value.
 */
export function calcTotalEarnedPoints(
  registrations: Registration[],
  catalog: CatalogItem[]
): number {
  const weekMap: Record<number, Registration[]> = {};

  registrations.forEach((r) => {
    if (r.status !== "completed") return;
    const week = r.completed_week ?? r.planned_week;
    if (week == null) return; // handled below
    if (!weekMap[week]) weekMap[week] = [];
    weekMap[week].push(r);
  });

  let earned = 0;

  // Per-week with optional cap
  Object.values(weekMap).forEach((weekRegs) => {
    let mandatoryEarned = 0;
    let optionalEarned = 0;
    weekRegs.forEach((r) => {
      const cat = catalog.find((c) => c.id === r.catalog_id);
      if (!cat) return;
      if (cat.is_mandatory) mandatoryEarned += cat.points;
      else optionalEarned += cat.points;
    });
    earned += mandatoryEarned + Math.min(optionalEarned, 3);
  });

  // Unplanned completed (no week) — no cap context, count at face value
  registrations.forEach((r) => {
    if (r.status !== "completed") return;
    if (r.completed_week != null || r.planned_week != null) return;
    const cat = catalog.find((c) => c.id === r.catalog_id);
    if (cat) earned += cat.points;
  });

  return earned;
}
