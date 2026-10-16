"""
Course name normalization for NMIMS SAP attendance PDFs.

The raw course names from the PDF contain section/program metadata appended
to the actual subject name. This module separates the subject name from
the metadata suffix.

Examples:
    "DATA STRUCT&ALGORITHMST1 MBA T CE E"       -> "DATA STRUCTURES & ALGORITHMS"
    "DATA STRUCT&ALGORITHMS LABP1 MBAT CE E1"   -> "DATA STRUCTURES & ALGORITHMS LAB"
    "PROGRAMMING WITH PYTHONP1 MBTCE D E1"      -> "PROGRAMMING WITH PYTHON"
    "PROGRAMMING WITH PYTHONT1 MBT CE E"        -> "PROGRAMMING WITH PYTHON"
    "Computer Organiz&ArchitecturT1 MBAT CE E"   -> "COMPUTER ORGANIZATION & ARCHITECTURE"
    "Management Accou for EngineT1 MBAT CE E"    -> "MANAGEMENT ACCOUNTING FOR ENGINEERS"
    "Signals and SystemsP1 MBA Tech CE E E1"     -> "SIGNALS AND SYSTEMS"
    "Signals and SystemsT1 MBA Tech CE E"        -> "SIGNALS AND SYSTEMS"
    "Technical CommunicationU1 MBA Tech CE E1"   -> "TECHNICAL COMMUNICATION"
    "Discrete MathematicsT1 MBA T CE E"          -> "DISCRETE MATHEMATICS"
    "Discrete MathematicsU1 MBA Tech CE E E1"    -> "DISCRETE MATHEMATICS"
"""

import re
from typing import Optional


# Pattern to find where the section code starts
# The pattern is: <course_name><section_code> <program_info>
# Section codes: T1, P1, U1, L1 (Theory, Practical, Tutorial, Lab) followed by program/batch info
# Matches MBA, BTECH, MCA, or any alphanumeric program code across all semesters
# Dynamic pattern to match section codes (T1, P1, U1, L1, etc.) followed by any program/batch metadata
# Generic and semester/branch/degree agnostic
SUFFIX_PATTERN = re.compile(
    r'(?:\s+)?([TPUL]\d+)(?:[-:\s]+[A-Za-z0-9\.\-\_\s]+)?$',
    re.IGNORECASE
)

FALLBACK_SUFFIX_PATTERN = re.compile(
    r'\s+([TPUL]\d+)\b.*$',
    re.IGNORECASE
)

# Optional course abbreviation dictionary (dynamic: defaults to empty, configured via user settings)
ABBREVIATION_MAP: dict[str, str] = {}


def normalize_course_name(raw_course_name: str) -> str:
    """
    Extract the canonical subject name from a raw NMIMS SAP course string.

    The raw string format is typically:
        <SubjectName><SectionCode> <ProgramMetadata>

    Where:
        SectionCode is T1/P1/U1/L1 (Theory/Practical/Tutorial/Lab batch)
        ProgramMetadata contains degree/section identifiers

    Args:
        raw_course_name: The raw course name from the PDF

    Returns:
        Normalized canonical course name in uppercase
    """
    if not raw_course_name or not raw_course_name.strip():
        return raw_course_name

    raw = raw_course_name.strip()

    # Find where the section marker (T1, P1, U1, L1) starts
    match = SUFFIX_PATTERN.search(raw)

    if match:
        course_part = raw[:match.start()].strip()
    else:
        # Fallback: check for section marker with space
        fallback_match = FALLBACK_SUFFIX_PATTERN.search(raw)
        if fallback_match:
            course_part = raw[:fallback_match.start()].strip()
        else:
            course_part = raw

    # Clean whitespace and uppercase for normalization
    course_part = re.sub(r'\s+', ' ', course_part.strip()).upper()

    # Check if this matches any configured abbreviation
    normalized = _expand_abbreviation(course_part)

    return normalized


def _expand_abbreviation(course_name: str) -> str:
    """
    Expand known abbreviated course names to their full forms.

    Args:
        course_name: Uppercase course name, possibly abbreviated

    Returns:
        Expanded course name if a match is found, otherwise the input
    """
    # Direct match
    if course_name in ABBREVIATION_MAP:
        return ABBREVIATION_MAP[course_name]

    # Try with common cleanup
    cleaned = course_name.strip()
    cleaned = re.sub(r'\s+', ' ', cleaned)  # collapse whitespace

    if cleaned in ABBREVIATION_MAP:
        return ABBREVIATION_MAP[cleaned]

    # Try fuzzy matching for common patterns
    # Handle "&" vs "AND"
    with_and = cleaned.replace('&', ' & ')
    with_and = re.sub(r'\s+', ' ', with_and).strip()
    if with_and in ABBREVIATION_MAP:
        return ABBREVIATION_MAP[with_and]

    return cleaned


def get_section_type(raw_course_name: str) -> Optional[str]:
    """
    Extract the section type from the raw course name.

    Returns:
        'T' for Theory, 'P' for Practical, 'U' for Tutorial, 'L' for Lab,
        or None if not found.
    """
    if not raw_course_name:
        return None
    match = SUFFIX_PATTERN.search(raw_course_name)
    if match:
        return match.group(1)[0].upper()
    fallback = FALLBACK_SUFFIX_PATTERN.search(raw_course_name)
    if fallback:
        return fallback.group(1)[0].upper()
    return None
