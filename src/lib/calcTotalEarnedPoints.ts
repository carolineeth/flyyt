import type { CatalogItem, Registration } from "@/hooks/useActivityCatalog";
import { calculateActivityPoints } from "./activityPoints";

/**
 * @deprecated Bruk calculateActivityPoints fra "@/lib/activityPoints" direkte
 * for å få tilgang til detaljert breakdown (perRegistration, perWeek,
 * mandatoryRemaining, totalBeforeCap).
 *
 * Denne funksjonen finnes for bakoverkompatibilitet og returnerer kun
 * det kappede totaltallet (maks 30p) i tråd med IN2000-reglene R1–R12.
 */
export function calcTotalEarnedPoints(
  registrations: Registration[],
  catalog: CatalogItem[],
): number {
  return calculateActivityPoints(registrations, catalog).totalEarned;
}
