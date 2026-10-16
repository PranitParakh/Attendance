# Frontend Pages & Components Deep Dive

This document details every page view and React component in `frontend/src/pages/` and `frontend/src/components/`.

---

## 1. Page Views (`frontend/src/pages/`)

### 1.1 `Home.tsx`
**Role**: The landing and onboarding page.
- **Automatic Session Detection**: On mount, runs `getCurrentAttendance()`. If an attendance dataset is already in SQLite, automatically redirects to `/dashboard` (or `/setup` if unconfigured).
- **Loading State**: Displays a spinner while checking for existing data.
- **Upload View**: If no data is present, renders the title, description, and the interactive `UploadZone` component.

### 1.2 `Setup.tsx`
**Role**: Dynamic Curriculum Setup page for configuring any semester report.
- **Auto-Detection**: Scans the uploaded dataset and presents every detected course.
- **Editable Fields**:
  - Custom abbreviation input with live badge preview.
  - Course format toggle: `Theory/LAB` vs `Theory+LAB`.
  - Credits selector: `1`, `2`, `3`, `4`, `5` with auto-calculated weekly distributions.
  - Weekly distribution: Theory and Lab lectures per week.
  - 2-Hour Lab Block counting toggle: Count two 1-hr rows as 1 conducted practical session.
- **Intelligent Defaults**: One-click *"Smart Defaults"* button infers optimal settings from attendance timestamps and session codes.
- **Persistence**: Saves all configurations to `localStorage` and routes to `/dashboard`.

### 1.3 `Dashboard.tsx`
**Role**: The primary view containing the full suite of attendance metrics.
- **State Management**:
  - `data`: Stores the original `AttendanceDataset` retrieved from `/api/attendance/current`.
  - `nuPolicy`: Stores selected NU simulation mode (`ignored`, `all_present`, `all_absent`, `individual`). Saved to `localStorage`.
  - `individualOverrides`: Key-value map of individual decisions for specific sessions. Saved to `localStorage`.
  - `simulatedData`: Memoized result from `simulateAttendanceWithNuPolicy(data.records, nuPolicy, individualOverrides)`. All dashboard cards consume this reactive dataset.
- **Page Layout**:
  - **Header**: Displays student name, roll number, academic year, semester, and action buttons (`Sync Portal`, `Reset`).
  - **Overall Attendance Card**: Large percentage gauge and summary metrics.
  - **NU Policy Selector**: Visible only if the dataset has NU sessions. Allows instant scenario testing.
  - **Integrated Course Panel**: The comprehensive course list with search, status filters, format badges, and bunk buffers.
  - **Visual Analytics**: Interactive Recharts graphs.

### 1.3 `SubjectDetail.tsx`
**Role**: Drill-down view for an individual subject showing its full chronological lecture log.
- **Route**: Accessible at `/subject/:subjectName`.
- **Top Summary**: Displays canonical subject name, abbreviation, format badge, overall percentage, and present/absent stats.
- **Lecture Projection**: Displays conducted vs planned theory and lab sessions, plus the bunk buffer.
- **Status Filter**: Buttons to filter lecture rows by `ALL`, `PRESENT`, `ABSENT`, or `NOT UPDATED`.
- **Lecture Table**: Shows every session with Date, Time, Section, and Attendance Status Badge.
- **Curriculum Settings**: Modal trigger (`Subject Settings`) to adjust credits or theory/lab weekly split.

---

## 2. Core UI Components (`frontend/src/components/`)

### 2.1 `Layout.tsx`
- **Role**: Common shell wrapping all pages.
- **Sticky Header**: Shows Attendly branding, logo icon, and navigation links. Blurs smoothly on scroll (`backdrop-blur-xl`).
- **Outlet**: React Router placeholder rendering the active page.
- **Footer**: Subtle branding footer.

### 2.2 `OverallAttendanceCard.tsx`
- **Role**: Prominent hero card displaying university-wide attendance.
- **Left Column**:
  - Attendance health pill (`Target Met (≥80%)`, `Warning Zone`, `Critical`).
  - Giant percentage display (e.g. `84.2%`).
  - Progress bar with target indicator marker at 80%.
- **Right Column**: Clean grid of 4 stat boxes:
  - Present Sessions (Emerald)
  - Absent Sessions (Rose)
  - Counted Total (Slate)
  - Not Updated Sessions (Amber)

### 2.3 `IntegratedCoursePanel.tsx`
- **Role**: The central courses component. Consolidates course status tracking, format filtering, session projections, and bunk calculations.
- **Header & Controls**:
  - Search input: Real-time search by full course name or short abbreviation.
  - Status Filter tabs: `All`, `Safe (≥80%)`, `At Risk (<80%)`.
  - Format Filter tabs: `All Types`, `Theory/LAB` (theory-only or lab-only), `Theory+LAB` (integrated courses).
- **Course Cards**:
  - Abbreviation badge (e.g. `DSA`, `COA`, `TC`).
  - Format badge (`Theory/LAB` or `Theory+LAB`), clickable to open settings.
  - Settings gear icon to customize curriculum parameters.
  - Attendance percentage and Present/Absent badges.
  - Progress bar.
  - Session Projection box: Shows completed vs planned theory and lab sessions, plus sessions remaining in semester.
  - Bunk / Attendance Recovery pill (e.g. `Can safely miss 3 lectures` or `Cannot miss any more lectures!`).
  - Link to detailed history table.

### 2.4 `NuPolicySelector.tsx`
- **Role**: Clean segmented control allowing instant simulation of unfinalized ("Not Updated") sessions.
- **Options**:
  - `Official (Excluded)`: Ignores NU sessions in denominator.
  - `All Present`: Simulates 100% attendance on unfinalized classes.
  - `All Absent`: Simulates worst-case scenario.
  - `Individual`: Opens the `NuIndividualModal` for granular per-lecture decisions.
- Shows simulated percentage and delta against official university percentage (e.g. `Simulated: 83.1% (+1.8%)`).

### 2.5 `NuIndividualModal.tsx`
- **Role**: A full modal for reviewing every single NU session individually.
- **Features**:
  - Lists all NU sessions with subject name, date, and time.
  - Radio/button controls to mark each as `Present`, `Absent`, or `Ignored`.
  - Subject filter dropdown and Decision filter (`All`, `Decided`, `Undecided`).
  - Bulk actions: Mark all filtered sessions as Present or Absent at once.
  - Saves overrides to localStorage and immediately recomputes the entire dashboard.

### 2.6 `SubjectSettingsModal.tsx`
- **Role**: Allows the student to adjust the curriculum settings for any course.
- **Settings**:
  - Format Toggle: `Theory / LAB Only` vs `Theory + LAB Integrated`.
  - Total Course Credits (1, 2, 3, 4, 5).
  - Theory Sessions Per Week.
  - Lab / Tutorial Sessions Per Week.
  - "Count 2 Hours as 1 Session" toggle (crucial for NMIMS 2-hour lab blocks).
- **Live Preview**: Dynamically previews planned vs completed sessions and calculated bunk buffer as the student adjusts numbers.
- **Persistence**: Saves choices to `localStorage` key `attendly_curriculum_settings`.

### 2.7 `SyncModal.tsx`
- **Role**: Modal triggered from the Dashboard to re-fetch latest attendance directly from the SAP portal.
- **Features**:
  - Input for SAP Student ID and Password.
  - Checkbox to securely remember credentials in browser `localStorage`.
  - "Show visible browser window" toggle (Pixel 7 window appears on screen during sync).
  - 5-stage progress indicator with elapsed timer.
  - Calls `POST /api/attendance/fetch` and triggers dashboard reload upon completion.

### 2.8 `UploadZone.tsx`
- **Role**: The onboarding drag-and-drop file upload and portal login interface.
- **Tab 1 ("Upload PDF")**: Drag-and-drop target for official SVKM/NMIMS SAP attendance PDFs with file validation.
- **Tab 2 ("Live Portal Sync")**: Direct login interface that invokes the Playwright automation bot to fetch and parse the report automatically.

### 2.9 `AttendanceAnalytics.tsx`
- **Role**: Visual charts and trends powered by Recharts.
- **Tabs**:
  1. `Subjects`: Horizontal/vertical bar chart ranking all subjects by percentage. Colors change dynamically based on target thresholds.
  2. `Day of Week`: Analyzes attendance by weekday (Mon–Sat) to reveal which days the student misses most classes.
  3. `Monthly`: Area chart showing attendance trajectory over the months of the semester.
- **Summary Insights**: Highlights "Best Day", "Toughest Day", "Highest Subject", and "Lowest Subject".

### 2.10 `AttendanceProgressBar.tsx`
- **Role**: Clean progress bar component.
- **Visual Features**: Smooth transitions, color-coded fill based on health, and a target indicator line at exactly 80%.

### 2.11 `AttendanceStatusBadge.tsx`
- **Role**: Pill badge displaying session attendance status (`Present`, `Absent`, `Not Updated`, `Exempt`, `Late`).
