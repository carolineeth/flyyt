/**
 * Aktivitets-poengberegning for IN2000 (Flyyt).
 *
 * Eneste kilde til sannhet for poengtelling. All UI som viser
 * aktivitetspoeng MÅ bruke calculateActivityPoints.
 *
 * Regler (R1–R12) er dokumentert i prosjektets prompt og oppsummert her:
 *   R1  Totalsum kappes på 30p
 *   R2  Hver catalog-aktivitet teller maks én gang (med mindre max_occurrences > 1)
 *   R3  Maks 3 aktiviteter per uke gir poeng (alle, inkl. obligatoriske)
 *   R4  Aktiviteter i uke 20 gir 0p
 *   R5  Veiledermøter: 1p/uke, maks 4 uker totalt = 4p tak
 *   R6  Smidige møter (daily/planning/review): 1p hver, maks 3p totalt
 *   R7  Smidige møter av ulike typer må være i forskjellige ISO-uker
 *   R8  first_half krever completed_week 10–14
 *   R9  second_half krever completed_week 15–19
 *   R10 Ved >3/uke: 3 høyeste poeng teller, likhet → tidligst completed_date
 *   R11 Registrering tillates uansett — diskvalifikasjon kun i beregning
 *   R12 Kun status=completed med gyldig completed_date+completed_week teller
 */

export type PointsRuleViolation =
  | "outside_period_first_half"
  | "outside_period_second_half"
  | "after_week_19"
  | "weekly_cap_exceeded"
  | "agile_meeting_same_week"
  | "agile_meeting_total_cap"
  | "supervisor_weekly_cap"
  | "supervisor_total_cap"
  | "total_cap_exceeded"
  | "invalid_week"
  | "not_completed";

export interface CatalogInput {
  id: string;
  name: string;
  points: number;
  is_mandatory: boolean;
  period: string; // "anytime" | "first_half" | "second_half"
  meeting_type: string | null;
  max_occurrences: number;
}

export interface RegistrationInput {
  id: string;
  catalog_id: string;
  status: string;
  completed_date: string | null;
  completed_week: number | null;
  created_at: string;
}

export interface RegistrationPointsResult {
  registrationId: string;
  catalogId: string;
  catalogName: string;
  completedWeek: number | null;
  pointsEarned: number;
  pointsPotential: number;
  countedTowardTotal: boolean;
  violations: PointsRuleViolation[];
}

export interface ActivityPointsResult {
  totalEarned: number;
  totalBeforeCap: number;
  mandatoryRemaining: number;
  perRegistration: RegistrationPointsResult[];
  perWeek: {
    week: number;
    countedCount: number;
    disqualifiedCount: number;
    earnedInWeek: number;
  }[];
}

const AGILE_TYPES = new Set(["daily_standup", "sprint_planning", "sprint_review"]);
const SUPERVISOR_TYPE = "veiledermøte";
const FIRST_HALF_WEEKS: [number, number] = [10, 14];
const SECOND_HALF_WEEKS: [number, number] = [15, 19];
const MAX_TOTAL = 30;
const SUPERVISOR_MAX_WEEKS = 4;
const AGILE_MAX_TOTAL = 3;
const PER_WEEK_CAP = 3;

interface InternalRow {
  reg: RegistrationInput;
  cat: CatalogInput;
  result: RegistrationPointsResult;
  // sort key for tie-breaks: completed_date primary, created_at secondary
  sortKey: number;
}

function dateKey(reg: RegistrationInput): number {
  // completed_date primary (date only), created_at secondary (timestamp)
  // We combine into a single number where completed_date dominates.
  const d = reg.completed_date ? new Date(reg.completed_date + "T00:00:00Z").getTime() : Number.MAX_SAFE_INTEGER;
  const c = reg.created_at ? new Date(reg.created_at).getTime() : 0;
  // completed_date in ms; add fractional ms from created_at (cap at 1 day worth)
  const frac = Math.min(c % 86_400_000, 86_399_999) / 86_400_000;
  return d + frac;
}

function compareSort(a: InternalRow, b: InternalRow): number {
  if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
  return a.reg.created_at.localeCompare(b.reg.created_at);
}

export function calculateActivityPoints(
  registrations: RegistrationInput[],
  catalog: CatalogInput[],
): ActivityPointsResult {
  const catalogById = new Map(catalog.map((c) => [c.id, c]));

  // Build initial rows
  const rows: InternalRow[] = [];
  for (const reg of registrations) {
    const cat = catalogById.get(reg.catalog_id);
    if (!cat) continue;
    const result: RegistrationPointsResult = {
      registrationId: reg.id,
      catalogId: cat.id,
      catalogName: cat.name,
      completedWeek: reg.completed_week,
      pointsEarned: 0,
      pointsPotential: cat.points,
      countedTowardTotal: false,
      violations: [],
    };
    rows.push({ reg, cat, result, sortKey: dateKey(reg) });
  }

  // ===== Step 1: filter to completed with valid week (R12, R4) =====
  for (const row of rows) {
    if (row.reg.status !== "completed") {
      row.result.violations.push("not_completed");
      continue;
    }
    if (!row.reg.completed_date || row.reg.completed_week == null) {
      row.result.violations.push("invalid_week");
      continue;
    }
    if (row.reg.completed_week >= 20) {
      row.result.violations.push("after_week_19");
      continue;
    }
    // ===== Step 2: period validation (R8, R9) =====
    const w = row.reg.completed_week;
    if (row.cat.period === "first_half") {
      if (w < FIRST_HALF_WEEKS[0] || w > FIRST_HALF_WEEKS[1]) {
        row.result.violations.push("outside_period_first_half");
        continue;
      }
    } else if (row.cat.period === "second_half") {
      if (w < SECOND_HALF_WEEKS[0] || w > SECOND_HALF_WEEKS[1]) {
        row.result.violations.push("outside_period_second_half");
        continue;
      }
    } else {
      // anytime: must still be within 10–19 (covered by R4 above for >19; check <10)
      if (w < 10) {
        row.result.violations.push("invalid_week");
        continue;
      }
    }
  }

  const isStillCandidate = (r: InternalRow) => r.result.violations.length === 0;

  // ===== Step 3: supervisor meetings (R5) =====
  // Group by week; first chronologically per week wins; max 4 weeks total.
  const supervisorRows = rows
    .filter((r) => isStillCandidate(r) && r.cat.meeting_type === SUPERVISOR_TYPE)
    .sort(compareSort);

  const supervisorWeeksUsed = new Set<number>();
  for (const row of supervisorRows) {
    const w = row.reg.completed_week!;
    if (supervisorWeeksUsed.has(w)) {
      row.result.violations.push("supervisor_weekly_cap");
      continue;
    }
    if (supervisorWeeksUsed.size >= SUPERVISOR_MAX_WEEKS) {
      row.result.violations.push("supervisor_total_cap");
      continue;
    }
    supervisorWeeksUsed.add(w);
  }

  // ===== Step 4: agile meetings (R6, R7) =====
  // R6: Hver type (daily/planning/review) kan telle maks én gang totalt = maks 3p.
  // R7: Innen samme uke teller kun den først registrerte typen; senere typer
  //     samme uke får agile_meeting_same_week.
  // Sortert kronologisk: completed_date asc → created_at asc.
  const agileRows = rows
    .filter((r) => isStillCandidate(r) && r.cat.meeting_type && AGILE_TYPES.has(r.cat.meeting_type))
    .sort(compareSort);

  const agileTakenWeeks = new Set<number>();
  const agileTakenTypes = new Set<string>();
  for (const row of agileRows) {
    const w = row.reg.completed_week!;
    const t = row.cat.meeting_type!;
    if (agileTakenWeeks.has(w)) {
      // En annen smidig-type er allerede registrert tidligere denne uka.
      row.result.violations.push("agile_meeting_same_week");
      continue;
    }
    if (agileTakenTypes.has(t)) {
      // Samme type er allerede telt en tidligere uke (1p per type).
      row.result.violations.push("agile_meeting_total_cap");
      continue;
    }
    agileTakenWeeks.add(w);
    agileTakenTypes.add(t);
  }

  // ===== Step 5: weekly cap (R3, R10) =====
  // Of remaining candidates, group by week. If >3, sort by points desc, completed_date asc; keep top 3.
  const byWeek = new Map<number, InternalRow[]>();
  for (const row of rows) {
    if (!isStillCandidate(row)) continue;
    const w = row.reg.completed_week!;
    if (!byWeek.has(w)) byWeek.set(w, []);
    byWeek.get(w)!.push(row);
  }

  for (const [, weekRows] of byWeek) {
    if (weekRows.length <= PER_WEEK_CAP) continue;
    const sorted = [...weekRows].sort((a, b) => {
      if (a.cat.points !== b.cat.points) return b.cat.points - a.cat.points;
      return compareSort(a, b);
    });
    const losers = sorted.slice(PER_WEEK_CAP);
    for (const row of losers) {
      row.result.violations.push("weekly_cap_exceeded");
    }
  }

  // ===== Step 6: assign earned points and apply 30p cap (R1) =====
  // First mark all surviving as earned at face value
  for (const row of rows) {
    if (isStillCandidate(row)) {
      row.result.pointsEarned = row.cat.points;
      row.result.countedTowardTotal = true;
    }
  }

  const earnedRows = rows.filter((r) => r.result.countedTowardTotal);
  const totalBeforeCap = earnedRows.reduce((s, r) => s + r.result.pointsEarned, 0);

  if (totalBeforeCap > MAX_TOTAL) {
    // Cap from the "least valuable" end:
    // sort earned rows by completed_week DESC, then points ASC — these get cut first.
    const cutOrder = [...earnedRows].sort((a, b) => {
      const wa = a.reg.completed_week!;
      const wb = b.reg.completed_week!;
      if (wa !== wb) return wb - wa;
      if (a.cat.points !== b.cat.points) return a.cat.points - b.cat.points;
      return compareSort(b, a);
    });
    let overflow = totalBeforeCap - MAX_TOTAL;
    for (const row of cutOrder) {
      if (overflow <= 0) break;
      const pts = row.result.pointsEarned;
      if (pts <= overflow) {
        // remove entirely
        overflow -= pts;
        row.result.pointsEarned = 0;
        row.result.countedTowardTotal = false;
        row.result.violations.push("total_cap_exceeded");
      } else {
        // Partial removal — keep the row but reduce points
        row.result.pointsEarned = pts - overflow;
        overflow = 0;
        row.result.violations.push("total_cap_exceeded");
      }
    }
  }

  const totalEarned = Math.min(totalBeforeCap, MAX_TOTAL);

  // ===== Step 7: mandatory remaining =====
  const completedCatalogIds = new Set(
    registrations.filter((r) => r.status === "completed").map((r) => r.catalog_id),
  );
  const mandatoryRemaining = catalog.filter(
    (c) => c.is_mandatory && !completedCatalogIds.has(c.id),
  ).length;

  // ===== Step 8: per-week breakdown =====
  const weekStats = new Map<number, { week: number; countedCount: number; disqualifiedCount: number; earnedInWeek: number }>();
  for (const row of rows) {
    const w = row.reg.completed_week;
    if (w == null) continue;
    if (row.reg.status !== "completed") continue;
    if (!weekStats.has(w)) weekStats.set(w, { week: w, countedCount: 0, disqualifiedCount: 0, earnedInWeek: 0 });
    const s = weekStats.get(w)!;
    if (row.result.countedTowardTotal) {
      s.countedCount += 1;
      s.earnedInWeek += row.result.pointsEarned;
    } else {
      s.disqualifiedCount += 1;
    }
  }
  const perWeek = [...weekStats.values()].sort((a, b) => a.week - b.week);

  return {
    totalEarned,
    totalBeforeCap,
    mandatoryRemaining,
    perRegistration: rows.map((r) => r.result),
    perWeek,
  };
}

export const VIOLATION_MESSAGES: Record<PointsRuleViolation, string> = {
  outside_period_first_half: "Registrert utenfor første halvdel (uke 10–14)",
  outside_period_second_half: "Registrert utenfor andre halvdel (uke 15–19)",
  after_week_19: "Uke 20 teller ikke for poeng",
  weekly_cap_exceeded: "Mer enn 3 aktiviteter denne uka — gir ikke poeng",
  agile_meeting_same_week: "Et annet smidig møte teller allerede for denne uka",
  agile_meeting_total_cap: "Denne smidig-typen er allerede telt en tidligere uke",
  supervisor_weekly_cap: "Veiledermøte teller allerede for denne uka",
  supervisor_total_cap: "Over taket på 4 veiledermøter",
  total_cap_exceeded: "Over 30p-taket",
  invalid_week: "Mangler gyldig dato/uke",
  not_completed: "Ikke markert som fullført",
};
