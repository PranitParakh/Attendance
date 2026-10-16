"""
CLI runner for the SVKM/NMIMS SAP Portal Attendance Web Automation.

Usage:
    python run_scraper.py <output_pdf_file> [username] [password] [--parse]

Options:
    output_pdf_file    Path to save the downloaded attendance PDF report.
    username           SAP Student ID (or set via SAP_USER environment variable).
    password           SAP Portal Password (or set via SAP_PASS environment variable).
    --parse            Optional flag: parses the PDF and displays an attendance summary.

Example:
    python run_scraper.py attendance_report.pdf 70000000000 MyPassword --parse
    # or using environment variables:
    set SAP_USER=70000000000
    set SAP_PASS=MyPassword
    python run_scraper.py attendance_report.pdf --parse
"""

import os
import sys
import getpass
import argparse
import asyncio
from app.scraper import fetch_attendance_report


def parse_args():
    parser = argparse.ArgumentParser(
        description="Fetch official SVKM/NMIMS Attendance Report via automated portal login."
    )
    parser.add_argument(
        "output_file",
        help="Path where the attendance PDF will be saved (e.g. attendance_report.pdf)"
    )
    parser.add_argument(
        "username",
        nargs="?",
        default=os.environ.get("SAP_USER"),
        help="Student SAP ID (or set via SAP_USER env var)"
    )
    parser.add_argument(
        "password",
        nargs="?",
        default=os.environ.get("SAP_PASS"),
        help="Student Portal Password (or set via SAP_PASS env var)"
    )
    parser.add_argument(
        "--parse",
        action="store_true",
        help="Parse the downloaded PDF and display attendance statistics"
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Run browser in background without visible desktop window (default is visible)"
    )
    return parser.parse_args()


async def main():
    args = parse_args()

    username = args.username
    password = args.password

    # Interactive prompt if credentials are not provided via CLI or ENV
    if not username:
        username = input("Enter SAP Student ID: ").strip()
    if not password:
        password = getpass.getpass("Enter SAP Portal Password: ").strip()

    if not username or not password:
        print("Error: Both username and password are required.", file=sys.stderr)
        sys.exit(1)

    mode_label = "headless background" if args.headless else "visible live browser"
    print(f"[*] Connecting to SAP Portal for Student ID: {username} ({mode_label})...")
    try:
        pdf_bytes = await fetch_attendance_report(username, password, headless=args.headless)
    except Exception as e:
        print(f"[!] Error fetching report: {e}", file=sys.stderr)
        sys.exit(1)

    output_path = os.path.abspath(args.output_file)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(pdf_bytes)

    print(f"[+] Successfully saved attendance report ({len(pdf_bytes)} bytes) to: {output_path}")

    if args.parse:
        print("\n[*] Parsing attendance records from report...")
        try:
            from app.parser import parse_attendance_pdf
            from app.calculator import calculate_subject_summaries, calculate_overall_summary

            metadata, records = parse_attendance_pdf(pdf_bytes, os.path.basename(output_path))
            subjects = calculate_subject_summaries(records)
            overall = calculate_overall_summary(records, subjects)

            print("\n" + "=" * 65)
            print(f" STUDENT: {metadata.student_name} ({metadata.student_number})")
            print(f" PROGRAM: {metadata.program or 'N/A'}")
            print(f" PERIOD : {metadata.report_from_date or 'N/A'} to {metadata.report_to_date or 'N/A'}")
            print("=" * 65)
            print(f"{'Subject':<40} {'Attended':<10} {'Total':<8} {'%'}")
            print("-" * 65)
            for sub in subjects:
                print(f"{sub.name[:38]:<40} {sub.attended:<10} {sub.total:<8} {sub.percentage:.1f}%")
            print("-" * 65)
            print(f"{'OVERALL ATTENDANCE':<40} {overall.total_attended:<10} {overall.total_conducted:<8} {overall.percentage:.1f}%")
            print("=" * 65 + "\n")
        except Exception as e:
            print(f"[!] Warning: Could not parse report preview: {e}", file=sys.stderr)


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nOperation cancelled by user.")
        sys.exit(130)
