import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  StudentMetadata,
  AttendanceRecord,
  SubjectSummary,
  OverallSummary,
  AttendanceStatus,
} from './types';

// Set up worker for PDF.js in browser environments
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

const VALID_STATUSES = new Set(['P', 'A', 'NU', 'E', 'L']);

const MONTH_MAP: Record<string, number> = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
};

const DATE_PATTERN = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s+(\d{4})$/;
const TIME_PATTERN = /^(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)$/;
const DURATION_PATTERN = /From\s+(\d{2}\.\d{2}\.\d{4})\s+to\s+(\d{2}\.\d{2}\.\d{4})/;
const SUFFIX_PATTERN = /(?:\s+)?([TPUL]\d+)(?:[-:\s]+[A-Za-z0-9.\-_ ]+)?$/i;
const FALLBACK_SUFFIX_PATTERN = /\s+([TPUL]\d+)\b.*$/i;

/**
 * Normalizes course name by removing section code and program suffix.
 * Dynamic and degree/branch agnostic.
 */
export function normalizeCourseName(rawCourseName: string): string {
  if (!rawCourseName || !rawCourseName.trim()) return rawCourseName;

  const raw = rawCourseName.trim();
  const match = SUFFIX_PATTERN.exec(raw);

  let coursePart: string;
  if (match) {
    coursePart = raw.substring(0, match.index).trim();
  } else {
    const fallbackMatch = FALLBACK_SUFFIX_PATTERN.exec(raw);
    if (fallbackMatch) {
      coursePart = raw.substring(0, fallbackMatch.index).trim();
    } else {
      coursePart = raw;
    }
  }

  return coursePart.replace(/\s+/g, ' ').trim().toUpperCase();
}

/**
 * Validates that file bytes start with '%PDF'.
 */
function validatePdfBytes(bytes: Uint8Array, filename: string): void {
  if (bytes.length < 4) {
    throw new Error(`The file '${filename}' appears to be empty or corrupt.`);
  }

  const header = String.fromCharCode(...bytes.slice(0, 5));
  if (!header.startsWith('%PDF')) {
    // Check if HTML
    const sample = String.fromCharCode(...bytes.slice(0, 100)).toLowerCase();
    if (sample.includes('<!doc') || sample.includes('<html')) {
      throw new Error(
        'The file appears to be an HTML document instead of a PDF report.'
      );
    }
    throw new Error(
      `The file '${filename}' is not a valid PDF report. Please upload a standard SAP PDF.`
    );
  }
}

/**
 * Converts a 12-hour time regex match to 24-hour string 'HH:MM:SS'.
 */
function convertTo24h(match: RegExpMatchArray): string {
  let hour = parseInt(match[1], 10);
  const minute = match[2];
  const second = match[3];
  const period = match[4];

  if (period === 'AM') {
    if (hour === 12) hour = 0;
  } else {
    if (hour !== 12) hour += 12;
  }

  return `${String(hour).padStart(2, '0')}:${minute}:${second}`;
}

/**
 * Extracts metadata from the first page header.
 */
function extractMetadata(firstPageText: string): StudentMetadata {
  const lines = firstPageText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const metadata: StudentMetadata = {
    student_name: 'Unknown',
    student_number: null,
    roll_number: null,
    academic_year: null,
    semester: null,
    program: null,
    report_start_date: null,
    report_end_date: null,
    institution: null,
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line === 'Student Name' && i > 0) {
      for (let j = i - 1; j >= 0; j--) {
        const candidate = lines[j];
        if (
          candidate &&
          candidate !== 'Student Name' &&
          candidate !== 'Student Number' &&
          !candidate.includes('Page') &&
          !candidate.includes('Mukesh') &&
          !candidate.includes('SVKM') &&
          !candidate.includes('NMIMS')
        ) {
          metadata.student_name = candidate;
          break;
        }
      }
    } else if (line === 'Student Number' && i > 0) {
      for (let j = i - 1; j >= 0; j--) {
        const candidate = lines[j];
        if (
          candidate &&
          candidate !== metadata.student_name &&
          candidate !== 'Student Name' &&
          candidate !== 'Student Number' &&
          /^\d+$/.test(candidate)
        ) {
          metadata.student_number = candidate;
          break;
        }
      }
    } else if (line.includes('Roll No') && i > 0) {
      for (let j = i - 1; j >= 0; j--) {
        const candidate = lines[j];
        if (candidate && /^[A-Z]\d+/i.test(candidate)) {
          metadata.roll_number = candidate;
          break;
        }
      }
    } else if (line.includes('Academic Year') && line.includes('Academic Session')) {
      for (let j = i - 1; j >= 0; j--) {
        const candidate = lines[j];
        if (candidate && /\d{4}/.test(candidate)) {
          metadata.academic_year = candidate;
          const semMatch = /Semester\s+([IVXLC]+)/i.exec(candidate);
          if (semMatch) {
            metadata.semester = semMatch[1];
          }
          break;
        }
      }
    } else if (line.includes('Program Name')) {
      for (let j = i - 1; j >= 0; j--) {
        const candidate = lines[j];
        if (
          candidate &&
          !['Program Name', 'Student Name', 'Student Number', 'Roll No', 'Roll No.'].includes(candidate) &&
          !/^\d+$/.test(candidate)
        ) {
          metadata.program = candidate;
          break;
        }
      }
    } else if (line.includes('Attendance Report Duration')) {
      const durMatch = DURATION_PATTERN.exec(firstPageText);
      if (durMatch) {
        metadata.report_start_date = durMatch[1];
        metadata.report_end_date = durMatch[2];
      }
    }
  }

  // Extract institution from first few lines
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const l = lines[i];
    if (l.includes('Mukesh Patel') || l.includes('NMIMS') || l.includes('SVKM')) {
      metadata.institution = l;
      break;
    }
  }

  if (!metadata.semester) {
    const semMatch = /Semester\s+([IVXLC]+)/i.exec(firstPageText);
    if (semMatch) metadata.semester = semMatch[1];
  }

  if (!metadata.academic_year) {
    const yearMatch = /(\d{4}-\d{4})/i.exec(firstPageText);
    if (yearMatch) metadata.academic_year = yearMatch[1];
  }

  return metadata;
}

/**
 * Parses attendance records from line tokens.
 */
function extractRecords(allLines: string[]): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  let i = 0;

  while (i < allLines.length) {
    const line = allLines[i];

    // Must be a positive integer serial number
    if (!line || !/^\d+$/.test(line)) {
      i++;
      continue;
    }

    const srNo = parseInt(line, 10);
    if (srNo === 0) {
      i++;
      continue;
    }

    // Check if we have at least 5 lines following
    if (i + 5 >= allLines.length) {
      i++;
      continue;
    }

    const courseRaw = allLines[i + 1].trim();
    const dateStr = allLines[i + 2].trim();
    const startTimeStr = allLines[i + 3].trim();
    const endTimeStr = allLines[i + 4].trim();
    const statusStr = allLines[i + 5].trim();

    const dateMatch = DATE_PATTERN.exec(dateStr);
    const startTimeMatch = TIME_PATTERN.exec(startTimeStr);
    const endTimeMatch = TIME_PATTERN.exec(endTimeStr);

    if (dateMatch && startTimeMatch && endTimeMatch && VALID_STATUSES.has(statusStr)) {
      const month = MONTH_MAP[dateMatch[1]];
      const day = parseInt(dateMatch[2], 10);
      const year = parseInt(dateMatch[3], 10);
      const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      const startTime24 = convertTo24h(startTimeMatch);
      const endTime24 = convertTo24h(endTimeMatch);
      const courseNormalized = normalizeCourseName(courseRaw);

      records.push({
        id: null,
        serial_number: srNo,
        course_raw: courseRaw,
        course_normalized: courseNormalized,
        date: isoDate,
        start_time: startTime24,
        end_time: endTime24,
        status: statusStr as AttendanceStatus,
      });

      i += 6;
    } else {
      i++;
    }
  }

  return records;
}

/**
 * Calculates per-subject statistics.
 */
export function calculateSubjectSummaries(records: AttendanceRecord[]): SubjectSummary[] {
  const map: Record<string, { present: number; absent: number; not_updated: number }> = {};

  for (const r of records) {
    const name = r.course_normalized;
    if (!map[name]) {
      map[name] = { present: 0, absent: 0, not_updated: 0 };
    }
    if (r.status === 'P') {
      map[name].present++;
    } else if (r.status === 'A') {
      map[name].absent++;
    } else if (r.status === 'NU') {
      map[name].not_updated++;
    }
  }

  return Object.keys(map)
    .sort()
    .map(course_name => {
      const c = map[course_name];
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
}

/**
 * Calculates overall pooled attendance and bunk buffer.
 */
export function calculateOverallSummary(
  records: AttendanceRecord[],
  subjects: SubjectSummary[]
): OverallSummary {
  let totalPresent = 0;
  let totalAbsent = 0;
  let totalNu = 0;

  for (const s of subjects) {
    totalPresent += s.present;
    totalAbsent += s.absent;
    totalNu += s.not_updated;
  }

  const totalCounted = totalPresent + totalAbsent;
  const overallPercentage =
    totalCounted > 0 ? Number(((totalPresent / totalCounted) * 100).toFixed(2)) : null;

  return {
    total_present: totalPresent,
    total_absent: totalAbsent,
    total_not_updated: totalNu,
    total_counted: totalCounted,
    overall_percentage: overallPercentage,
    subjects_tracked: subjects.length,
  };
}

/**
 * Client-side PDF parser using pdfjs-dist.
 * Runs 100% in the browser with zero backend server.
 */
export async function parseAttendancePdf(
  fileOrBuffer: File | ArrayBuffer | Uint8Array,
  filename: string = 'attendance.pdf'
): Promise<{ metadata: StudentMetadata; records: AttendanceRecord[] }> {
  let uint8: Uint8Array;
  if (fileOrBuffer instanceof Uint8Array) {
    uint8 = fileOrBuffer;
  } else if (fileOrBuffer instanceof ArrayBuffer) {
    uint8 = new Uint8Array(fileOrBuffer);
  } else {
    const buf = await fileOrBuffer.arrayBuffer();
    uint8 = new Uint8Array(buf);
    filename = fileOrBuffer.name || filename;
  }

  validatePdfBytes(uint8, filename);

  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  if (pdfDoc.numPages === 0) {
    throw new Error(`PDF file '${filename}' has no pages.`);
  }

  const allLines: string[] = [];
  let firstPageText = '';

  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const page = await pdfDoc.getPage(p);
    const content = await page.getTextContent();
    const pageStrings = content.items
      // @ts-ignore
      .map((it: any) => (it.str !== undefined ? it.str : ''))
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (p === 1) {
      firstPageText = pageStrings.join('\n');
    }

    allLines.push(...pageStrings);
  }

  const metadata = extractMetadata(firstPageText);
  const records = extractRecords(allLines);

  if (records.length === 0) {
    throw new Error(
      'No attendance records found in the PDF. Please ensure this is a valid SVKM/NMIMS Student Attendance Report.'
    );
  }

  const validDates = records.map(r => r.date).filter(Boolean);
  if (validDates.length > 0) {
    metadata.latest_record_date = validDates.reduce((a, b) => (a > b ? a : b));
    metadata.earliest_record_date = validDates.reduce((a, b) => (a < b ? a : b));
  }

  return { metadata, records };
}
