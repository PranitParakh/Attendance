"""
Attendance calculation logic.

Computes subject-wise and overall attendance statistics
from parsed attendance records.

Key rules:
    - Present (P) counts toward attendance
    - Absent (A) counts against attendance
    - Not Updated (NU) is excluded from the denominator
    - Overall attendance = totalPresent / (totalPresent + totalAbsent) * 100
    - NOT the average of subject percentages
"""

from app.models import AttendanceRecord, SubjectSummary, OverallSummary


# Configurable attendance thresholds
TARGET_ATTENDANCE = 80.0
WARNING_THRESHOLD = 60.0


def calculate_subject_summaries(records: list[AttendanceRecord]) -> list[SubjectSummary]:
    """
    Calculate attendance summary for each unique subject.

    Groups records by normalized course name and computes
    present/absent/NU counts and attendance percentage.

    Args:
        records: List of parsed attendance records

    Returns:
        List of SubjectSummary, sorted by course name
    """
    # Group records by normalized course name
    subjects: dict[str, dict] = {}

    for record in records:
        name = record.course_normalized
        if name not in subjects:
            subjects[name] = {
                "present": 0,
                "absent": 0,
                "not_updated": 0,
            }

        if record.status == "P":
            subjects[name]["present"] += 1
        elif record.status == "A":
            subjects[name]["absent"] += 1
        elif record.status == "NU":
            subjects[name]["not_updated"] += 1
        # E and L are tracked but not counted for now

    summaries = []
    for course_name, counts in sorted(subjects.items()):
        present = counts["present"]
        absent = counts["absent"]
        not_updated = counts["not_updated"]
        counted = present + absent  # NU excluded

        percentage = None
        if counted > 0:
            percentage = round((present / counted) * 100, 2)

        summaries.append(SubjectSummary(
            course_name=course_name,
            present=present,
            absent=absent,
            not_updated=not_updated,
            counted=counted,
            percentage=percentage,
        ))

    return summaries


def calculate_overall_summary(
    records: list[AttendanceRecord],
    subjects: list[SubjectSummary]
) -> OverallSummary:
    """
    Calculate overall attendance statistics.

    Overall attendance is computed as:
        totalPresent / (totalPresent + totalAbsent) * 100

    This is NOT the average of subject percentages.
    NU records are excluded from the denominator.

    Args:
        records: List of all attendance records
        subjects: List of computed subject summaries

    Returns:
        OverallSummary with aggregated statistics
    """
    total_present = sum(s.present for s in subjects)
    total_absent = sum(s.absent for s in subjects)
    total_not_updated = sum(s.not_updated for s in subjects)
    total_counted = total_present + total_absent

    overall_percentage = None
    if total_counted > 0:
        overall_percentage = round((total_present / total_counted) * 100, 2)

    return OverallSummary(
        total_present=total_present,
        total_absent=total_absent,
        total_not_updated=total_not_updated,
        total_counted=total_counted,
        overall_percentage=overall_percentage,
        subjects_tracked=len(subjects),
    )
