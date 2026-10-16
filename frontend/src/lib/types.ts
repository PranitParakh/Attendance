/**
 * TypeScript types for the Attendly application.
 * Mirrors the backend Pydantic models.
 */

export type AttendanceStatus = 'P' | 'A' | 'NU' | 'E' | 'L';

export interface StudentMetadata {
  student_name: string;
  student_number: string | null;
  roll_number: string | null;
  academic_year: string | null;
  semester: string | null;
  program: string | null;
  report_start_date: string | null;
  report_end_date: string | null;
  institution: string | null;
  latest_record_date?: string | null;
  earliest_record_date?: string | null;
}

export interface AttendanceRecord {
  id: number | null;
  serial_number: number;
  course_raw: string;
  course_normalized: string;
  date: string; // ISO YYYY-MM-DD
  start_time: string; // HH:MM:SS
  end_time: string; // HH:MM:SS
  status: AttendanceStatus;
  is_lab_session?: boolean;
  linked_from_course?: string;
}

export interface SubjectSummary {
  course_name: string;
  present: number;
  absent: number;
  not_updated: number;
  counted: number;
  percentage: number | null;
}

export interface OverallSummary {
  total_present: number;
  total_absent: number;
  total_not_updated: number;
  total_counted: number;
  overall_percentage: number | null;
  subjects_tracked: number;
}

export interface AttendanceDataset {
  metadata: StudentMetadata;
  records: AttendanceRecord[];
  subjects: SubjectSummary[];
  overall: OverallSummary;
  imported_at: string;
  source_filename: string | null;
}

export interface UploadResponse {
  success: boolean;
  message: string;
  dataset: AttendanceDataset | null;
  error: string | null;
  records_count: number | null;
}

export interface SubjectDetailResponse {
  summary: SubjectSummary;
  records: AttendanceRecord[];
}

// Attendance thresholds
export const TARGET_ATTENDANCE = 80;
export const WARNING_THRESHOLD = 60;

export type AttendanceHealth = 'healthy' | 'warning' | 'critical';

export function getAttendanceHealth(percentage: number | null): AttendanceHealth {
  if (percentage === null) return 'healthy';
  if (percentage >= TARGET_ATTENDANCE) return 'healthy';
  if (percentage >= WARNING_THRESHOLD) return 'warning';
  return 'critical';
}
