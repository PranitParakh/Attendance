import { AttendanceRecord, SubjectSummary, OverallSummary, TARGET_ATTENDANCE, AttendanceStatus } from './types';

// Dynamic Course Abbreviation Dictionary (starts empty; custom abbreviations are configured by student in Curriculum Settings)
export const SUBJECT_ABBREVIATIONS: Record<string, string> = {};

/**
 * Known localStorage keys used by Attendly
 */
export const ATTENDLY_STORAGE_KEYS = [
  'attendly_saved_dataset',
  'attendly_curriculum_settings',
  'attendly_subject_merge_map',
  'attendly_deleted_subjects',
  'attendly_nu_policy',
  'attendly_nu_overrides',
  'attendly_sap_id',
  'attendly_sap_pw',
];

/**
 * Completely purges all stored Attendly data from localStorage.
 * Deletes all curriculum settings, merge mappings, deleted subjects lists,
 * NU policies, NU overrides, and any attendly prefixed keys.
 */
export function clearAllAttendlyStorage(): void {
  try {
    ATTENDLY_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.toLowerCase().startsWith('attendly')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (err) {
    console.error('Failed to clear Attendly local storage:', err);
  }
}

/**
 * Generates an automatic dynamic abbreviation for any course name across any engineering/degree branch.
 * Handles single-word subjects, Roman numerals (e.g. MATHEMATICS II -> M-2),
 * punctuation, and LAB/PR suffixes.
 */
export function getBaseDefaultAbbreviation(name: string): string {
  if (!name) return '';
  const trimmed = name.trim().toUpperCase();

  if (SUBJECT_ABBREVIATIONS[trimmed]) {
    return SUBJECT_ABBREVIATIONS[trimmed];
  }

  // Handle courses ending in LAB or PRACTICAL
  const isLab = trimmed.endsWith(' LAB') || trimmed.endsWith('LAB') || trimmed.endsWith(' PRACTICAL') || trimmed.endsWith(' PR');
  const baseName = isLab ? trimmed.replace(/\s*(?:LAB|PRACTICAL|PR)$/, '') : trimmed;

  // Words to ignore when creating acronym
  const stopWords = new Set(['AND', '&', 'FOR', 'WITH', 'OF', 'THE', 'IN', 'ON', 'TO', 'AN', 'A']);
  const words = baseName.split(/[\s_\-:&]+/).filter(w => w.length > 0 && !stopWords.has(w));

  if (words.length === 0) {
    return trimmed.substring(0, 8);
  }

  // If only 1 word and reasonably short, return it directly
  if (words.length === 1) {
    const single = words[0];
    if (single.length <= 10) {
      return isLab ? `${single} LAB` : single;
    }
    return isLab ? `${single.substring(0, 6)} LAB` : single.substring(0, 6);
  }

  const romanMap: Record<string, string> = { 'I': '1', 'II': '2', 'III': '3', 'IV': '4', 'V': '5', 'VI': '6' };
  const acronymParts: string[] = [];
  for (const w of words) {
    if (romanMap[w]) {
      acronymParts.push(`-${romanMap[w]}`);
    } else {
      acronymParts.push(w[0]);
    }
  }

  const acronym = acronymParts.join('');
  return isLab ? `${acronym} LAB` : (acronym || trimmed.substring(0, 8));
}

/**
 * Returns a concise normalized abbreviation for a course name.
 * Prioritizes student's saved custom abbreviation from localStorage.
 */
export function getSubjectAbbreviation(name: string): string {
  if (!name) return '';
  const trimmed = name.trim().toUpperCase();

  // 1. Check saved custom abbreviation from localStorage
  try {
    const raw = localStorage.getItem('attendly_curriculum_settings');
    if (raw) {
      const allConfigs = JSON.parse(raw);
      if (allConfigs[trimmed]?.abbreviation && allConfigs[trimmed].abbreviation.trim()) {
        return allConfigs[trimmed].abbreviation.trim().toUpperCase();
      }
      if (allConfigs[name]?.abbreviation && allConfigs[name].abbreviation.trim()) {
        return allConfigs[name].abbreviation.trim().toUpperCase();
      }
    }
  } catch {
    // ignore parse error
  }

  // 2. Fall back to standard dictionary or dynamic acronym
  return getBaseDefaultAbbreviation(trimmed);
}

export interface BunkCalculation {
  status: 'safe' | 'at_risk' | 'critical';
  diffPercentage: number;
  bunkCount: number; // How many classes can be safely missed
  attendCount: number; // How many classes must be attended
  message: string;
}

/**
 * Calculates how many lectures can be safely skipped or must be attended
 * to reach or stay above the target attendance percentage.
 *
 * Uses integer arithmetic to avoid floating-point precision errors.
 * When remainingLectures is provided, the message reflects whether the
 * student can realistically recover or must attend every remaining session.
 */
/**
 * Recompute the overall summary from a (possibly merged / filtered) list of
 * subject summaries. Used after applySubjectMergeMap to keep the top-level
 * card consistent with the per-subject cards below it.
 */
export function recalculateOverallSummary(subjects: SubjectSummary[]): OverallSummary {
  const total_present = subjects.reduce((sum, s) => sum + s.present, 0);
  const total_absent = subjects.reduce((sum, s) => sum + s.absent, 0);
  const total_not_updated = subjects.reduce((sum, s) => sum + s.not_updated, 0);
  const total_counted = total_present + total_absent;
  const overall_percentage = total_counted > 0
    ? Number(((total_present / total_counted) * 100).toFixed(2))
    : null;

  return {
    total_present,
    total_absent,
    total_not_updated,
    total_counted,
    overall_percentage,
    subjects_tracked: subjects.length,
  };
}

export function calculateBunkBuffer(
  present: number,
  total: number,
  target: number = TARGET_ATTENDANCE,
  remainingLectures?: number
): BunkCalculation {
  if (total === 0) {
    return {
      status: 'safe',
      diffPercentage: 0,
      bunkCount: 0,
      attendCount: 0,
      message: 'No sessions conducted yet',
    };
  }

  const currentPct = (present / total) * 100;

  if (currentPct >= target) {
    // How many can we miss?
    // present / (total + x) >= target / 100
    // 100 * present >= target * (total + x)
    // x <= (100 * present - target * total) / target
    const maxBunks = Math.floor((100 * present - target * total) / target);
    return {
      status: 'safe',
      diffPercentage: Number((currentPct - target).toFixed(1)),
      bunkCount: Math.max(0, maxBunks),
      attendCount: 0,
      message: maxBunks > 0
        ? `Can safely miss ${maxBunks} lecture${maxBunks > 1 ? 's' : ''}`
        : 'On the margin! Do not miss next lecture',
    };
  } else {
    // How many consecutive lectures must we attend?
    // (present + x) / (total + x) >= target / 100
    // 100 * (present + x) >= target * (total + x)
    // x * (100 - target) >= target * total - 100 * present
    // x >= (target * total - 100 * present) / (100 - target)
    //
    // Integer arithmetic avoids float drift (e.g. 6.000000000000015 → 7).
    const numerator = target * total - 100 * present;
    const denominator = 100 - target;
    const needed = denominator > 0
      ? Math.ceil(numerator / denominator)
      : Infinity;
    const isCritical = currentPct < 60;

    // Check against remaining lectures in the semester
    const remaining = remainingLectures ?? Infinity;
    const finalAttendIfAllPresent = (present + remaining) / (total + remaining) * 100;

    let message: string;
    if (needed > remaining) {
      // Even attending every remaining lecture won't reach target
      message = `Cannot reach ${target}%! Do not miss any more`;
    } else if (needed >= remaining) {
      // Must attend every single remaining lecture (no room to miss any)
      message = 'Cannot miss any more lectures!';
    } else {
      message = `Need to attend next ${needed} lecture${needed > 1 ? 's' : ''}`;
    }

    return {
      status: isCritical ? 'critical' : 'at_risk',
      diffPercentage: Number((target - currentPct).toFixed(1)),
      bunkCount: 0,
      attendCount: Math.max(1, needed === Infinity ? remaining : needed),
      message,
    };
  }
}

export type NuPolicy = 'ignored' | 'all_present' | 'all_absent' | 'individual';

/**
 * Load the active NU policy from localStorage (default: 'ignored').
 */
export function getStoredNuPolicy(): NuPolicy {
  try {
    const raw = localStorage.getItem('attendly_nu_policy');
    if (raw === 'all_present' || raw === 'all_absent' || raw === 'individual' || raw === 'ignored') {
      return raw as NuPolicy;
    }
  } catch {
    // ignore
  }
  return 'ignored';
}

/**
 * Load stored individual NU overrides from localStorage.
 */
export function getStoredIndividualOverrides(): Record<string, 'P' | 'A' | 'NU'> {
  try {
    const raw = localStorage.getItem('attendly_nu_overrides');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export interface SimulatedDataset {
  records: AttendanceRecord[];
  subjects: SubjectSummary[];
  overall: OverallSummary;
  nuCount: number;
  simulatedPresentCount: number;
  simulatedAbsentCount: number;
  simulatedIgnoredCount: number;
}

/**
 * Generates a unique key for an attendance record.
 */
export function getRecordKey(r: AttendanceRecord): string {
  if (r.id) return `id_${r.id}`;
  return `${r.date}_${r.start_time}_${r.course_raw}_${r.serial_number}`;
}

/**
 * Recalculates attendance records and summaries based on NU policy and overrides.
 */
export function simulateAttendanceWithNuPolicy(
  rawRecords: AttendanceRecord[],
  policy: NuPolicy,
  individualOverrides: Record<string, 'P' | 'A' | 'NU'> = {}
): SimulatedDataset {
  let nuCount = 0;
  let simulatedPresentCount = 0;
  let simulatedAbsentCount = 0;
  let simulatedIgnoredCount = 0;

  // Transform records according to policy
  const simulatedRecords: AttendanceRecord[] = rawRecords.map(record => {
    if (record.status !== 'NU') {
      return record;
    }

    nuCount++;
    const key = getRecordKey(record);

    let effectiveStatus: AttendanceStatus = record.status;

    if (policy === 'all_present') {
      effectiveStatus = 'P';
      simulatedPresentCount++;
    } else if (policy === 'all_absent') {
      effectiveStatus = 'A';
      simulatedAbsentCount++;
    } else if (policy === 'individual') {
      const override = individualOverrides[key];
      if (override === 'P') {
        effectiveStatus = 'P';
        simulatedPresentCount++;
      } else if (override === 'A') {
        effectiveStatus = 'A';
        simulatedAbsentCount++;
      } else {
        effectiveStatus = 'NU'; // Ignored
        simulatedIgnoredCount++;
      }
    } else {
      // Ignored
      effectiveStatus = 'NU';
      simulatedIgnoredCount++;
    }

    return {
      ...record,
      status: effectiveStatus,
    };
  });

  // Calculate subject summaries
  const subjectsMap: Record<string, { present: number; absent: number; not_updated: number }> = {};

  for (const record of simulatedRecords) {
    const name = record.course_normalized;
    if (!subjectsMap[name]) {
      subjectsMap[name] = { present: 0, absent: 0, not_updated: 0 };
    }

    if (record.status === 'P') {
      subjectsMap[name].present++;
    } else if (record.status === 'A') {
      subjectsMap[name].absent++;
    } else if (record.status === 'NU') {
      subjectsMap[name].not_updated++;
    }
  }

  const sortedCourseNames = Object.keys(subjectsMap).sort();
  const subjects: SubjectSummary[] = sortedCourseNames.map(course_name => {
    const c = subjectsMap[course_name];
    const counted = c.present + c.absent;
    const percentage = counted > 0 ? Number(((c.present / counted) * 100).toFixed(2)) : null;

    return {
      course_name,
      present: c.present,
      absent: c.absent,
      not_updated: c.not_updated,
      counted,
      percentage,
    };
  });

  // Calculate overall summary
  const total_present = subjects.reduce((sum, s) => sum + s.present, 0);
  const total_absent = subjects.reduce((sum, s) => sum + s.absent, 0);
  const total_not_updated = subjects.reduce((sum, s) => sum + s.not_updated, 0);
  const total_counted = total_present + total_absent;
  const overall_percentage = total_counted > 0 
    ? Number(((total_present / total_counted) * 100).toFixed(2)) 
    : null;

  const overall: OverallSummary = {
    total_present,
    total_absent,
    total_not_updated,
    total_counted,
    overall_percentage,
    subjects_tracked: subjects.length,
  };

  return {
    records: simulatedRecords,
    subjects,
    overall,
    nuCount,
    simulatedPresentCount,
    simulatedAbsentCount,
    simulatedIgnoredCount,
  };
}

// -------------------------------------------------------------
// CURRICULUM CONFIGURATION & LECTURES REMAINING CALCULATION
// Formula: No. of credits * Weeks (15 weeks Fixed) = Planned Lectures
// -------------------------------------------------------------

export interface SubjectCurriculumConfig {
  hasLabOrTutorial: boolean;
  format?: 'theory_or_lab' | 'theory_and_lab';
  abbreviation?: string;
  totalCredits: number;
  theoryWeekly: number;
  labTutorialWeekly: number;
  countTwoHoursAsOne: boolean;
  fixedWeeks?: number;
}

export interface SubjectLecturesStats {
  hasLabOrTutorial: boolean;
  totalCredits: number;
  fixedWeeks: number; // 15
  
  // Planned sessions
  totalPlanned: number; // credits * 15
  plannedTheory: number; // theoryWeekly * 15
  plannedLab: number; // labTutorialWeekly * 15

  // Conducted / Completed sessions
  completedTheory: number;
  completedLab: number;
  totalCompleted: number;

  // Remaining sessions
  remainingTheory: number;
  remainingLab: number;
  totalRemaining: number;

  // Remaining in raw-record units (matches present/counted units)
  // For countTwoHoursAsOne courses, each session = 2 records
  rawTotalRemaining: number;
}

/**
 * Identifies if a session is a lab or tutorial based on section code or explicit mapping.
 * Handles NMIMS standard conventions across all semesters:
 * 1. Explicitly mapped as lab (is_lab_session: true)
 * 2. E1 batch code (NMIMS standard lab batch marker)
 * 3. LAB in raw string
 * 4. Practical markers (PR, PR-CE, -PR-)
 * 5. Section codes: P1..P4 (Practical), U1..U4 (Tutorial), L1..L4 (Lab)
 */
export function isLabOrTutorialRecord(r: AttendanceRecord): boolean {
  if (r.is_lab_session) return true;
  if (!r.course_raw) return false;
  const raw = r.course_raw.toUpperCase();
  if (raw.includes('E1')) return true;
  if (raw.includes('LAB')) return true;
  if (/\bPR\b/i.test(raw) || /PR[-:\s]/i.test(raw) || raw.endsWith('PR')) return true;
  if (/[PUL]\d(?:[-:\s]|$)/i.test(raw)) return true;
  return false;
}

/**
 * Returns intelligent default curriculum settings based on course name and existing session logs.
 * Generic and semester-agnostic: infers pure lab vs integrated vs pure theory dynamically.
 */
export function getDefaultSubjectConfig(
  courseName: string,
  records: AttendanceRecord[] = []
): SubjectCurriculumConfig {
  const upper = courseName.toUpperCase();
  const subjectRecords = records.filter(r => r.course_normalized === courseName);
  const e1Records = subjectRecords.filter(isLabOrTutorialRecord);
  const theoryRecords = subjectRecords.filter(r => !isLabOrTutorialRecord(r));
  const hasLabOrTutorial = e1Records.length > 0;

  // Check if 2 hrs per session: if average records per date >= 1.5
  const distinctDates = new Set(e1Records.map(r => r.date)).size;
  const is2HrLab = distinctDates > 0 && (e1Records.length / distinctDates >= 1.5);
  const isPureLab = (upper.endsWith(' LAB') || upper.endsWith('LAB')) || (e1Records.length > 0 && theoryRecords.length === 0);

  const abbr = getBaseDefaultAbbreviation(courseName);

  if (isPureLab) {
    // Pure lab course: 1 session/week (2 hrs counted as 1 by default)
    return {
      hasLabOrTutorial: false,
      format: 'theory_or_lab',
      abbreviation: abbr,
      totalCredits: 1,
      theoryWeekly: 0,
      labTutorialWeekly: 1,
      countTwoHoursAsOne: true,
      fixedWeeks: 15,
    };
  }

  if (hasLabOrTutorial) {
    // Integrated course (theory + lab or tutorial)
    return {
      hasLabOrTutorial: true,
      format: 'theory_and_lab',
      abbreviation: abbr,
      totalCredits: 3,
      theoryWeekly: 2,
      labTutorialWeekly: 1,
      countTwoHoursAsOne: is2HrLab,
      fixedWeeks: 15,
    };
  }

  // Pure theory course
  return {
    hasLabOrTutorial: false,
    format: 'theory_or_lab',
    abbreviation: abbr,
    totalCredits: 3,
    theoryWeekly: 3,
    labTutorialWeekly: 0,
    countTwoHoursAsOne: false,
    fixedWeeks: 15,
  };
}

/**
 * Checks if every subject in the list has an existing stored curriculum configuration.
 */
export function areAllSubjectsConfigured(subjects: { course_name: string }[]): boolean {
  if (!subjects || subjects.length === 0) return true;
  try {
    const raw = localStorage.getItem('attendly_curriculum_settings');
    if (!raw) return false;
    const allConfigs = JSON.parse(raw);
    return subjects.every(s => allConfigs[s.course_name] !== undefined || allConfigs[s.course_name.toUpperCase()] !== undefined);
  } catch {
    return false;
  }
}

/**
 * Loads all stored curriculum settings from localStorage.
 */
export function getStoredCurriculumSettings(): Record<string, SubjectCurriculumConfig> {
  try {
    const raw = localStorage.getItem('attendly_curriculum_settings');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Saves all curriculum configurations into localStorage.
 */
export function saveAllStoredCurriculumSettings(settings: Record<string, SubjectCurriculumConfig>): void {
  try {
    localStorage.setItem('attendly_curriculum_settings', JSON.stringify(settings));
  } catch {
    // ignore
  }
}

/**
 * Loads stored curriculum config for a specific subject from localStorage, falling back to intelligent default.
 */
export function getStoredSubjectConfig(
  courseName: string,
  records: AttendanceRecord[] = []
): SubjectCurriculumConfig {
  try {
    const raw = localStorage.getItem('attendly_curriculum_settings');
    const mergeMap = getStoredMergeMap();
    const hasLinkedChildren = Object.values(mergeMap).includes(courseName);

    if (raw) {
      const allConfigs = JSON.parse(raw);
      let cfg = allConfigs[courseName] || allConfigs[courseName.toUpperCase()];
      if (cfg) {
        if (hasLinkedChildren) {
          // If a course has linked practical children, ensure it is treated as Theory+LAB
          // and count 2-hour lab slots as 1 session by default.
          const totalCredits = Math.max(1, cfg.totalCredits || 3);
          const labTutorialWeekly = Math.max(1, cfg.labTutorialWeekly || 1);
          let theoryWeekly = cfg.theoryWeekly !== undefined ? cfg.theoryWeekly : (totalCredits > labTutorialWeekly ? totalCredits - labTutorialWeekly : 1);
          if (theoryWeekly + labTutorialWeekly !== totalCredits) {
            theoryWeekly = Math.max(0, totalCredits - labTutorialWeekly);
          }
          cfg = {
            ...cfg,
            format: 'theory_and_lab',
            hasLabOrTutorial: true,
            countTwoHoursAsOne: true,
            totalCredits: theoryWeekly + labTutorialWeekly,
            theoryWeekly,
            labTutorialWeekly,
          };
        }
        return cfg;
      }
    }
  } catch {
    // ignore parse error
  }
  return getDefaultSubjectConfig(courseName, records);
}

/**
 * Saves curriculum config for a specific subject into localStorage.
 */
export function saveStoredSubjectConfig(
  courseName: string,
  config: SubjectCurriculumConfig
): void {
  try {
    const raw = localStorage.getItem('attendly_curriculum_settings');
    const allConfigs = raw ? JSON.parse(raw) : {};
    allConfigs[courseName] = config;
    localStorage.setItem('attendly_curriculum_settings', JSON.stringify(allConfigs));
  } catch {
    // ignore
  }
}

// -------------------------------------------------------------
// SUBJECT MERGE MAP — Manual grouping of separate-name courses
// Allows sem 1/2 style "COURSE" + "COURSE LAB" to be merged
// into a single Theory+LAB subject on the dashboard.
// -------------------------------------------------------------

/**
 * Merge map: maps child course names into a parent course name.
 * e.g. { "OBJECT ORIENTED PROGRAMMING LAB": "OBJECT ORIENTED PROGRAMMING" }
 */
export type SubjectMergeMap = Record<string, string>;

/**
 * Load the subject merge map from localStorage.
 */
export function getStoredMergeMap(): SubjectMergeMap {
  try {
    const raw = localStorage.getItem('attendly_subject_merge_map');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Save the subject merge map to localStorage.
 */
export function saveStoredMergeMap(mergeMap: SubjectMergeMap): void {
  try {
    localStorage.setItem('attendly_subject_merge_map', JSON.stringify(mergeMap));
  } catch {
    // ignore
  }
}

/**
 * Load list of explicitly deleted / excluded subjects from localStorage.
 */
export function getStoredDeletedSubjects(): string[] {
  try {
    const raw = localStorage.getItem('attendly_deleted_subjects');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save list of explicitly deleted / excluded subjects to localStorage.
 */
export function saveStoredDeletedSubjects(deleted: string[]): void {
  try {
    localStorage.setItem('attendly_deleted_subjects', JSON.stringify(deleted));
  } catch {
    // ignore
  }
}

/**
 * Apply the merge map and deleted list to records and subjects.
 *
 * For each child→parent mapping:
 * 1. Re-tags every child record's course_normalized to the parent's name
 *    and flags it as `is_lab_session: true`.
 *    Child records keep their original course_raw.
 * 2. Removes the child from the subjects list.
 * 3. Filters out explicitly deleted / excluded subjects.
 * 4. Recalculates the parent's subject summary with the merged records.
 *
 * Returns new arrays (does not mutate originals).
 */
export function applySubjectMergeMap(
  records: AttendanceRecord[],
  subjects: SubjectSummary[],
  mergeMap: SubjectMergeMap,
  deletedSubjects: string[] = getStoredDeletedSubjects()
): { mergedRecords: AttendanceRecord[]; mergedSubjects: SubjectSummary[] } {
  const activeEntries = Object.entries(mergeMap);
  const childNames = new Set(activeEntries.map(([child]) => child));
  const deletedSet = new Set(deletedSubjects);

  if (activeEntries.length === 0 && deletedSet.size === 0) {
    return { mergedRecords: records, mergedSubjects: subjects };
  }

  // 1. Re-tag child records under parent and mark as lab session; omit deleted
  const mergedRecords: AttendanceRecord[] = [];
  for (const r of records) {
    if (childNames.has(r.course_normalized)) {
      const parentName = mergeMap[r.course_normalized];
      mergedRecords.push({
        ...r,
        course_normalized: parentName,
        is_lab_session: true,
        linked_from_course: r.course_normalized,
      });
    } else if (!deletedSet.has(r.course_normalized)) {
      mergedRecords.push(r);
    }
  }

  // 2. Rebuild subject summaries from the merged records
  const subjectsMap: Record<string, { present: number; absent: number; not_updated: number }> = {};
  for (const record of mergedRecords) {
    const name = record.course_normalized;
    if (!subjectsMap[name]) {
      subjectsMap[name] = { present: 0, absent: 0, not_updated: 0 };
    }
    if (record.status === 'P') {
      subjectsMap[name].present++;
    } else if (record.status === 'A') {
      subjectsMap[name].absent++;
    } else if (record.status === 'NU') {
      subjectsMap[name].not_updated++;
    }
  }

  const mergedSubjects: SubjectSummary[] = Object.keys(subjectsMap)
    .sort()
    .map(course_name => {
      const c = subjectsMap[course_name];
      const counted = c.present + c.absent;
      const percentage = counted > 0 ? Number(((c.present / counted) * 100).toFixed(2)) : null;
      return {
        course_name,
        present: c.present,
        absent: c.absent,
        not_updated: c.not_updated,
        counted,
        percentage,
      };
    });

  return { mergedRecords, mergedSubjects };
}

/**
 * Calculates completed, planned, and remaining lectures based on:
 * Total planned = credits * 15 weeks
 * Theory planned = theoryWeekly * 15 weeks
 * Lab planned = labTutorialWeekly * 15 weeks
 * 2 hrs counted as 1 session when configured.
 */
export function calculateSubjectLecturesStats(
  courseName: string,
  records: AttendanceRecord[],
  config: SubjectCurriculumConfig
): SubjectLecturesStats {
  const subjectRecords = records.filter(r => r.course_normalized === courseName);
  const fixedWeeks = config.fixedWeeks || 15;

  const isPureLab = (config.theoryWeekly === 0 && config.labTutorialWeekly > 0) ||
    (!config.hasLabOrTutorial && (courseName.toUpperCase().endsWith(' LAB') || courseName.toUpperCase().endsWith('LAB')));
  const isIntegrated = (config.format === 'theory_and_lab') || (config.hasLabOrTutorial && !isPureLab);

  if (isPureLab) {
    let completedLab = 0;
    if (config.countTwoHoursAsOne) {
      completedLab = new Set(subjectRecords.map(r => r.date)).size;
    } else {
      completedLab = subjectRecords.length;
    }

    const credits = config.totalCredits || config.labTutorialWeekly || 1;
    let plannedLab = (config.labTutorialWeekly || credits) * fixedWeeks;

    if (plannedLab < completedLab) {
      plannedLab = completedLab;
    }

    const remainingLab = Math.max(0, plannedLab - completedLab);
    const totalPlanned = plannedLab;
    const totalCompleted = completedLab;
    const totalRemaining = remainingLab;
    const rawTotalRemaining = config.countTwoHoursAsOne ? remainingLab * 2 : remainingLab;

    return {
      hasLabOrTutorial: false,
      totalCredits: credits,
      fixedWeeks,
      totalPlanned,
      plannedTheory: 0,
      plannedLab,
      completedTheory: 0,
      completedLab,
      totalCompleted,
      remainingTheory: 0,
      remainingLab,
      totalRemaining,
      rawTotalRemaining,
    };
  }

  if (isIntegrated) {
    const theoryRecords = subjectRecords.filter(r => !isLabOrTutorialRecord(r));
    const labRecords = subjectRecords.filter(isLabOrTutorialRecord);

    const completedTheory = theoryRecords.length;
    let completedLab = 0;
    if (config.countTwoHoursAsOne) {
      completedLab = new Set(labRecords.map(r => r.date)).size;
    } else {
      completedLab = labRecords.length;
    }

    const theoryWeekly = config.theoryWeekly !== undefined
      ? config.theoryWeekly
      : Math.max(1, (config.totalCredits || 3) - (config.labTutorialWeekly || 1));
    const labWeekly = config.labTutorialWeekly !== undefined ? config.labTutorialWeekly : 1;

    let plannedTheory = theoryWeekly * fixedWeeks;
    let plannedLab = labWeekly * fixedWeeks;

    if (plannedTheory < completedTheory) plannedTheory = completedTheory;
    if (plannedLab < completedLab) plannedLab = completedLab;

    const remainingTheory = Math.max(0, plannedTheory - completedTheory);
    const remainingLab = Math.max(0, plannedLab - completedLab);
    const totalCompleted = completedTheory + completedLab;
    const totalPlanned = plannedTheory + plannedLab;
    const totalRemaining = remainingTheory + remainingLab;
    const rawTotalRemaining = remainingTheory + (config.countTwoHoursAsOne ? remainingLab * 2 : remainingLab);

    return {
      hasLabOrTutorial: true,
      totalCredits: config.totalCredits || (theoryWeekly + labWeekly),
      fixedWeeks,
      totalPlanned,
      plannedTheory,
      plannedLab,
      completedTheory,
      completedLab,
      totalCompleted,
      remainingTheory,
      remainingLab,
      totalRemaining,
      rawTotalRemaining,
    };
  }

  // Pure Theory (Single format)
  const completedTheory = subjectRecords.length;
  const credits = config.totalCredits || config.theoryWeekly || 3;
  let plannedTheory = (config.theoryWeekly || credits) * fixedWeeks;
  if (plannedTheory < completedTheory) {
    plannedTheory = completedTheory;
  }

  const remainingTheory = Math.max(0, plannedTheory - completedTheory);
  const totalCompleted = completedTheory;
  const totalPlanned = plannedTheory;
  const totalRemaining = remainingTheory;
  const rawTotalRemaining = remainingTheory;

  return {
    hasLabOrTutorial: false,
    totalCredits: credits,
    fixedWeeks,
    totalPlanned,
    plannedTheory,
    plannedLab: 0,
    completedTheory,
    completedLab: 0,
    totalCompleted,
    remainingTheory,
    remainingLab: 0,
    totalRemaining,
    rawTotalRemaining,
  };
}

