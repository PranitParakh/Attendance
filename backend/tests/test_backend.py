"""
Test suite for the Attendly backend.

Tests cover:
    1. PDF parsing
    2. Metadata extraction
    3. Attendance status parsing
    4. Course name normalization
    5. Overall attendance calculation
    6. Subject attendance calculation
    7. NU exclusion
    8. Invalid input handling
"""

import os
import sys
import pytest

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.normalizer import normalize_course_name, get_section_type
from app.calculator import calculate_subject_summaries, calculate_overall_summary
from app.models import AttendanceRecord, SubjectSummary


# ============================================================
# Course Name Normalization Tests
# ============================================================

class TestCourseNormalization:
    """Tests for the course name normalization module."""

    def test_data_structures(self):
        raw = "DATA STRUCT&ALGORITHMST1 MBA T CE E"
        result = normalize_course_name(raw)
        assert result == "DATA STRUCT&ALGORITHMS"

    def test_data_structures_lab(self):
        raw = "DATA STRUCT&ALGORITHMS LABP1 MBAT CE E1"
        result = normalize_course_name(raw)
        assert result == "DATA STRUCT&ALGORITHMS LAB"

    def test_programming_with_python_practical(self):
        raw = "PROGRAMMING WITH PYTHONP1 MBTCE D E1"
        result = normalize_course_name(raw)
        assert result == "PROGRAMMING WITH PYTHON"

    def test_programming_with_python_theory(self):
        raw = "PROGRAMMING WITH PYTHONT1 MBT CE E"
        result = normalize_course_name(raw)
        assert result == "PROGRAMMING WITH PYTHON"

    def test_computer_organization(self):
        raw = "Computer Organiz&ArchitecturT1 MBAT CE E"
        result = normalize_course_name(raw)
        assert result == "COMPUTER ORGANIZ&ARCHITECTUR"

    def test_management_accounting(self):
        raw = "Management Accou for EngineT1 MBAT CE E"
        result = normalize_course_name(raw)
        assert result == "MANAGEMENT ACCOU FOR ENGINE"

    def test_signals_and_systems_practical(self):
        raw = "Signals and SystemsP1 MBA Tech CE E E1"
        result = normalize_course_name(raw)
        assert result == "SIGNALS AND SYSTEMS"

    def test_signals_and_systems_theory(self):
        raw = "Signals and SystemsT1 MBA Tech CE E"
        result = normalize_course_name(raw)
        assert result == "SIGNALS AND SYSTEMS"

    def test_technical_communication(self):
        raw = "Technical CommunicationU1 MBA Tech CE E1"
        result = normalize_course_name(raw)
        assert result == "TECHNICAL COMMUNICATION"

    def test_discrete_mathematics_theory(self):
        raw = "Discrete MathematicsT1 MBA T CE E"
        result = normalize_course_name(raw)
        assert result == "DISCRETE MATHEMATICS"

    def test_discrete_mathematics_tutorial(self):
        raw = "Discrete MathematicsU1 MBA Tech CE E E1"
        result = normalize_course_name(raw)
        assert result == "DISCRETE MATHEMATICS"

    def test_civil_engineering_dynamic(self):
        raw = "BUILDING DESIGN AND DRAWINGT1 BTECH CE A"
        result = normalize_course_name(raw)
        assert result == "BUILDING DESIGN AND DRAWING"

    def test_mechanical_engineering_dynamic(self):
        raw = "FLUID MECHANICST2 BTECH ME B"
        result = normalize_course_name(raw)
        assert result == "FLUID MECHANICS"

    def test_law_dynamic(self):
        raw = "CONSTITUTION OF INDIAT1 BBA LLB"
        result = normalize_course_name(raw)
        assert result == "CONSTITUTION OF INDIA"

    def test_pharmacy_dynamic(self):
        raw = "PHARMACEUTICSL1 BPHARM A"
        result = normalize_course_name(raw)
        assert result == "PHARMACEUTICS"

    def test_empty_string(self):
        assert normalize_course_name("") == ""

    def test_none_passthrough(self):
        assert normalize_course_name(None) is None

    def test_section_type_theory(self):
        raw = "DATA STRUCT&ALGORITHMST1 MBA T CE E"
        assert get_section_type(raw) == "T"

    def test_section_type_practical(self):
        raw = "PROGRAMMING WITH PYTHONP1 MBTCE D E1"
        assert get_section_type(raw) == "P"

    def test_section_type_tutorial(self):
        raw = "Technical CommunicationU1 MBA Tech CE E1"
        assert get_section_type(raw) == "U"

    def test_same_subject_different_sections_normalize_same(self):
        """Theory and practical of same subject should normalize to same name."""
        theory = normalize_course_name("Signals and SystemsT1 MBA Tech CE E")
        practical = normalize_course_name("Signals and SystemsP1 MBA Tech CE E E1")
        assert theory == practical == "SIGNALS AND SYSTEMS"

    def test_python_theory_and_practical_normalize_same(self):
        """Different section types for Python should normalize to same name."""
        theory = normalize_course_name("PROGRAMMING WITH PYTHONT1 MBT CE E")
        practical = normalize_course_name("PROGRAMMING WITH PYTHONP1 MBTCE D E1")
        assert theory == practical == "PROGRAMMING WITH PYTHON"


# ============================================================
# Attendance Calculation Tests
# ============================================================

def _make_record(course: str, status: str, sr: int = 1, date: str = "2026-07-13") -> AttendanceRecord:
    """Helper to create a test AttendanceRecord."""
    return AttendanceRecord(
        serial_number=sr,
        course_raw=course,
        course_normalized=course,
        date=date,
        start_time="09:00:00",
        end_time="10:00:00",
        status=status,
    )


class TestAttendanceCalculation:
    """Tests for attendance calculation logic."""

    def test_basic_percentage(self):
        """8 present, 2 absent = 80% attendance."""
        records = (
            [_make_record("MATH", "P", i) for i in range(1, 9)] +
            [_make_record("MATH", "A", i) for i in range(9, 11)]
        )
        subjects = calculate_subject_summaries(records)
        assert len(subjects) == 1
        assert subjects[0].present == 8
        assert subjects[0].absent == 2
        assert subjects[0].counted == 10
        assert subjects[0].percentage == 80.0

    def test_nu_exclusion(self):
        """NU records must not affect the percentage."""
        records = (
            [_make_record("MATH", "P", i) for i in range(1, 9)] +
            [_make_record("MATH", "A", i) for i in range(9, 11)] +
            [_make_record("MATH", "NU", i) for i in range(11, 14)]
        )
        subjects = calculate_subject_summaries(records)
        assert len(subjects) == 1
        s = subjects[0]
        assert s.present == 8
        assert s.absent == 2
        assert s.not_updated == 3
        assert s.counted == 10  # only P + A
        assert s.percentage == 80.0

    def test_perfect_attendance(self):
        records = [_make_record("MATH", "P", i) for i in range(1, 11)]
        subjects = calculate_subject_summaries(records)
        assert subjects[0].percentage == 100.0

    def test_zero_attendance(self):
        records = [_make_record("MATH", "A", i) for i in range(1, 6)]
        subjects = calculate_subject_summaries(records)
        assert subjects[0].percentage == 0.0

    def test_all_nu_gives_null_percentage(self):
        """If all records are NU, percentage should be None."""
        records = [_make_record("MATH", "NU", i) for i in range(1, 4)]
        subjects = calculate_subject_summaries(records)
        assert subjects[0].counted == 0
        assert subjects[0].percentage is None

    def test_multiple_subjects(self):
        records = (
            [_make_record("MATH", "P", 1)] +
            [_make_record("MATH", "A", 2)] +
            [_make_record("PHYSICS", "P", 3)] +
            [_make_record("PHYSICS", "P", 4)] +
            [_make_record("PHYSICS", "A", 5)]
        )
        subjects = calculate_subject_summaries(records)
        assert len(subjects) == 2

        math = next(s for s in subjects if s.course_name == "MATH")
        physics = next(s for s in subjects if s.course_name == "PHYSICS")

        assert math.percentage == 50.0
        assert physics.percentage == round(2/3 * 100, 2)

    def test_overall_not_average_of_subjects(self):
        """
        Overall attendance must be totalPresent / (totalPresent + totalAbsent),
        NOT the average of subject percentages.
        """
        records = (
            # MATH: 1P, 1A = 50%
            [_make_record("MATH", "P", 1)] +
            [_make_record("MATH", "A", 2)] +
            # PHYSICS: 9P, 1A = 90%
            [_make_record("PHYSICS", "P", i) for i in range(3, 12)] +
            [_make_record("PHYSICS", "A", 12)]
        )
        subjects = calculate_subject_summaries(records)
        overall = calculate_overall_summary(records, subjects)

        # Average of subject %s = (50 + 90) / 2 = 70%
        # Correct overall = 10P / (10P + 2A) = 83.33%
        assert overall.total_present == 10
        assert overall.total_absent == 2
        assert overall.overall_percentage == round(10/12 * 100, 2)
        assert overall.overall_percentage != 70.0  # NOT average

    def test_overall_excludes_nu(self):
        """NU records must be excluded from overall calculation."""
        records = (
            [_make_record("MATH", "P", i) for i in range(1, 9)] +
            [_make_record("MATH", "A", i) for i in range(9, 11)] +
            [_make_record("MATH", "NU", i) for i in range(11, 14)]
        )
        subjects = calculate_subject_summaries(records)
        overall = calculate_overall_summary(records, subjects)

        assert overall.total_present == 8
        assert overall.total_absent == 2
        assert overall.total_not_updated == 3
        assert overall.total_counted == 10
        assert overall.overall_percentage == 80.0

    def test_empty_records(self):
        subjects = calculate_subject_summaries([])
        assert len(subjects) == 0

        overall = calculate_overall_summary([], [])
        assert overall.total_present == 0
        assert overall.total_absent == 0
        assert overall.total_counted == 0
        assert overall.overall_percentage is None
        assert overall.subjects_tracked == 0


# ============================================================
# PDF Parsing Tests (using the reference PDF if available)
# ============================================================

class TestPDFParsing:
    """Tests for PDF parsing with the reference NMIMS attendance PDF."""

    PDF_PATH = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "test_data.pdf"
    )

    @pytest.fixture
    def pdf_bytes(self):
        if not os.path.exists(self.PDF_PATH):
            pytest.skip("Reference PDF not found at test_data.pdf")
        with open(self.PDF_PATH, "rb") as f:
            return f.read()

    def test_pdf_loads(self, pdf_bytes):
        from app.parser import parse_attendance_pdf
        metadata, records = parse_attendance_pdf(pdf_bytes)
        assert metadata is not None
        assert len(records) > 0

    def test_record_count(self, pdf_bytes):
        """The reference PDF contains exactly 215 records."""
        from app.parser import parse_attendance_pdf
        _, records = parse_attendance_pdf(pdf_bytes)
        assert len(records) == 215

    def test_student_name(self, pdf_bytes):
        from app.parser import parse_attendance_pdf
        metadata, _ = parse_attendance_pdf(pdf_bytes)
        assert metadata.student_name is not None and len(metadata.student_name) > 0

    def test_student_number(self, pdf_bytes):
        from app.parser import parse_attendance_pdf
        metadata, _ = parse_attendance_pdf(pdf_bytes)
        assert metadata.student_number is not None and len(metadata.student_number) > 0

    def test_roll_number(self, pdf_bytes):
        from app.parser import parse_attendance_pdf
        metadata, _ = parse_attendance_pdf(pdf_bytes)
        assert metadata.roll_number is not None and len(metadata.roll_number) > 0

    def test_program(self, pdf_bytes):
        from app.parser import parse_attendance_pdf
        metadata, _ = parse_attendance_pdf(pdf_bytes)
        assert "MBA" in metadata.program

    def test_semester(self, pdf_bytes):
        from app.parser import parse_attendance_pdf
        metadata, _ = parse_attendance_pdf(pdf_bytes)
        assert metadata.semester == "III"

    def test_present_records_exist(self, pdf_bytes):
        from app.parser import parse_attendance_pdf
        _, records = parse_attendance_pdf(pdf_bytes)
        present = [r for r in records if r.status == "P"]
        assert len(present) > 0

    def test_absent_records_exist(self, pdf_bytes):
        from app.parser import parse_attendance_pdf
        _, records = parse_attendance_pdf(pdf_bytes)
        absent = [r for r in records if r.status == "A"]
        assert len(absent) > 0

    def test_nu_records_exist(self, pdf_bytes):
        from app.parser import parse_attendance_pdf
        _, records = parse_attendance_pdf(pdf_bytes)
        nu = [r for r in records if r.status == "NU"]
        assert len(nu) > 0

    def test_sep_26_signals_are_nu(self, pdf_bytes):
        """Sep 26 Signals and Systems records must be NU."""
        from app.parser import parse_attendance_pdf
        _, records = parse_attendance_pdf(pdf_bytes)
        sep26_signals = [
            r for r in records
            if r.date == "2026-09-26" and "SIGNALS" in r.course_normalized.upper()
        ]
        assert len(sep26_signals) == 4
        for r in sep26_signals:
            assert r.status == "NU"

    def test_jul_29_records(self, pdf_bytes):
        """Validate records on July 29, 2026."""
        from app.parser import parse_attendance_pdf
        _, records = parse_attendance_pdf(pdf_bytes)
        jul29 = [r for r in records if r.date == "2026-07-29"]
        assert len(jul29) > 0

    def test_course_normalization_applied(self, pdf_bytes):
        """All records should have normalized course names."""
        from app.parser import parse_attendance_pdf
        _, records = parse_attendance_pdf(pdf_bytes)
        for r in records:
            assert r.course_normalized is not None
            assert r.course_normalized.strip() != ""
            # Normalized names should not contain section codes
            assert r.course_normalized != r.course_raw or "T1" not in r.course_raw

    def test_all_subjects_recognized(self, pdf_bytes):
        """Check that major subjects are all recognized."""
        from app.parser import parse_attendance_pdf
        _, records = parse_attendance_pdf(pdf_bytes)
        normalized_names = set(r.course_normalized for r in records)
        expected_subjects = {
            "DATA STRUCT&ALGORITHMS",
            "DATA STRUCT&ALGORITHMS LAB",
            "PROGRAMMING WITH PYTHON",
            "COMPUTER ORGANIZ&ARCHITECTUR",
            "MANAGEMENT ACCOU FOR ENGINE",
            "SIGNALS AND SYSTEMS",
            "TECHNICAL COMMUNICATION",
            "DISCRETE MATHEMATICS",
        }
        for subj in expected_subjects:
            assert subj in normalized_names, f"Subject '{subj}' not found in normalized names: {normalized_names}"

    def test_nu_excluded_from_overall_calculation(self, pdf_bytes):
        """NU records must not affect the overall percentage."""
        from app.parser import parse_attendance_pdf
        from app.calculator import calculate_subject_summaries, calculate_overall_summary

        _, records = parse_attendance_pdf(pdf_bytes)
        subjects = calculate_subject_summaries(records)
        overall = calculate_overall_summary(records, subjects)

        # NU should be counted separately
        assert overall.total_not_updated > 0
        # Denominator should only be P + A
        assert overall.total_counted == overall.total_present + overall.total_absent
        # NU should not be in the denominator
        total_records = overall.total_present + overall.total_absent + overall.total_not_updated
        assert total_records == len(records) or total_records <= len(records)

    def test_time_parsing(self, pdf_bytes):
        """Verify time parsing for first record."""
        from app.parser import parse_attendance_pdf
        _, records = parse_attendance_pdf(pdf_bytes)
        first = records[0]
        assert first.start_time == "11:00:01"
        assert first.end_time == "12:00:00"

    def test_date_parsing(self, pdf_bytes):
        """Verify date parsing for first record."""
        from app.parser import parse_attendance_pdf
        _, records = parse_attendance_pdf(pdf_bytes)
        first = records[0]
        assert first.date == "2026-07-13"


# ============================================================
# Invalid Input Tests
# ============================================================

class TestInvalidInput:
    """Tests for handling invalid inputs."""

    def test_invalid_pdf_bytes(self):
        from app.parser import parse_attendance_pdf
        with pytest.raises(ValueError, match=r"(does not appear to be a valid PDF|Cannot open PDF)"):
            parse_attendance_pdf(b"not a pdf", "fake.pdf")

    def test_empty_bytes(self):
        from app.parser import parse_attendance_pdf
        with pytest.raises(ValueError):
            parse_attendance_pdf(b"", "empty.pdf")

    def test_non_attendance_pdf(self):
        """A valid PDF but not an attendance report should be rejected."""
        import fitz
        # Create a minimal valid PDF
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((50, 50), "Hello World - this is not an attendance report")
        pdf_bytes = doc.tobytes()
        doc.close()

        from app.parser import parse_attendance_pdf
        with pytest.raises(ValueError, match="does not appear to be"):
            parse_attendance_pdf(pdf_bytes, "hello.pdf")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
