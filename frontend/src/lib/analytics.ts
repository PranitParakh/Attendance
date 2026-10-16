import { AttendanceRecord, SubjectSummary } from './types';

export interface DayOfWeekStat {
  day: string;
  dayShort: string;
  present: number;
  absent: number;
  notUpdated: number;
  totalCounted: number;
  percentage: number;
}

export interface MonthStat {
  monthKey: string;
  monthLabel: string;
  present: number;
  absent: number;
  notUpdated: number;
  totalCounted: number;
  percentage: number;
}

export interface AttendanceInsights {
  bestDay: { day: string; percentage: number } | null;
  toughestDay: { day: string; missed: number } | null;
  highestSubject: { name: string; percentage: number } | null;
  lowestSubject: { name: string; percentage: number } | null;
  perfectSubjectsCount: number;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORTS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function calculateDayOfWeekAnalytics(records: AttendanceRecord[]): DayOfWeekStat[] {
  const dayStatsMap: Record<number, { present: number; absent: number; nu: number }> = {};
  for (let i = 0; i < 7; i++) {
    dayStatsMap[i] = { present: 0, absent: 0, nu: 0 };
  }

  for (const record of records) {
    if (!record.date) continue;
    // parse YYYY-MM-DD
    const [year, month, day] = record.date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayIndex = dateObj.getDay();

    if (record.status === 'P') {
      dayStatsMap[dayIndex].present++;
    } else if (record.status === 'A') {
      dayStatsMap[dayIndex].absent++;
    } else if (record.status === 'NU') {
      dayStatsMap[dayIndex].nu++;
    }
  }

  // Usually university runs Mon to Sat (index 1 to 6)
  const orderedDays = [1, 2, 3, 4, 5, 6];
  // Include Sunday only if there are records
  if (dayStatsMap[0].present + dayStatsMap[0].absent + dayStatsMap[0].nu > 0) {
    orderedDays.push(0);
  }

  return orderedDays.map(dayIdx => {
    const stat = dayStatsMap[dayIdx];
    const totalCounted = stat.present + stat.absent;
    const percentage = totalCounted > 0 ? Number(((stat.present / totalCounted) * 100).toFixed(1)) : 0;
    return {
      day: DAY_NAMES[dayIdx],
      dayShort: DAY_SHORTS[dayIdx],
      present: stat.present,
      absent: stat.absent,
      notUpdated: stat.nu,
      totalCounted,
      percentage: totalCounted > 0 ? percentage : 100,
    };
  });
}

export function calculateMonthlyAnalytics(records: AttendanceRecord[]): MonthStat[] {
  const monthMap: Record<string, { present: number; absent: number; nu: number; dateSample: Date }> = {};

  for (const record of records) {
    if (!record.date) continue;
    const [year, month, day] = record.date.split('-').map(Number);
    const key = `${year}-${String(month).padStart(2, '0')}`;

    if (!monthMap[key]) {
      monthMap[key] = {
        present: 0,
        absent: 0,
        nu: 0,
        dateSample: new Date(year, month - 1, day),
      };
    }

    if (record.status === 'P') {
      monthMap[key].present++;
    } else if (record.status === 'A') {
      monthMap[key].absent++;
    } else if (record.status === 'NU') {
      monthMap[key].nu++;
    }
  }

  const sortedKeys = Object.keys(monthMap).sort();

  return sortedKeys.map(key => {
    const data = monthMap[key];
    const totalCounted = data.present + data.absent;
    const percentage = totalCounted > 0 ? Number(((data.present / totalCounted) * 100).toFixed(1)) : 0;
    const monthLabel = data.dateSample.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    return {
      monthKey: key,
      monthLabel,
      present: data.present,
      absent: data.absent,
      notUpdated: data.nu,
      totalCounted,
      percentage,
    };
  });
}

export function calculateAttendanceInsights(
  records: AttendanceRecord[],
  subjects: SubjectSummary[]
): AttendanceInsights {
  const dayStats = calculateDayOfWeekAnalytics(records).filter(d => d.totalCounted > 0);

  let bestDay: { day: string; percentage: number } | null = null;
  let toughestDay: { day: string; missed: number } | null = null;

  for (const d of dayStats) {
    if (!bestDay || d.percentage > bestDay.percentage) {
      bestDay = { day: d.day, percentage: d.percentage };
    }
    if (!toughestDay || d.absent > toughestDay.missed) {
      toughestDay = { day: d.day, missed: d.absent };
    }
  }

  const validSubjects = subjects.filter(s => s.percentage !== null);
  let highestSubject: { name: string; percentage: number } | null = null;
  let lowestSubject: { name: string; percentage: number } | null = null;
  let perfectSubjectsCount = 0;

  for (const s of validSubjects) {
    const pct = s.percentage!;
    if (pct === 100) perfectSubjectsCount++;
    if (!highestSubject || pct > highestSubject.percentage) {
      highestSubject = { name: s.course_name, percentage: pct };
    }
    if (!lowestSubject || pct < lowestSubject.percentage) {
      lowestSubject = { name: s.course_name, percentage: pct };
    }
  }

  return {
    bestDay,
    toughestDay,
    highestSubject,
    lowestSubject,
    perfectSubjectsCount,
  };
}
