# Frontend Core & Libraries Deep Dive

This document details the frontend setup, application entry points, and utility libraries located inside `frontend/src/` and `frontend/src/lib/`.

---

## 1. Application Entry & Styling

### `frontend/src/main.tsx`
The bootstrap file that connects React 18 to the browser DOM:
- **Lines 1–6**: Imports React, `ReactDOM.createRoot`, `BrowserRouter` for client-side routing, the root `App` component, and `index.css`.
- **Lines 7–13**: Mounts the app into `<div id="root">` defined in `index.html`. Wraps the tree in `React.StrictMode` and `BrowserRouter`.

### `frontend/src/App.tsx`
The top-level client route definitions:
- **Lines 8–17**: Uses `react-router-dom`'s `<Routes>` and `<Route>`.
  - Parent route: `<Route path="/" element={<Layout />}>` (renders persistent header and container).
  - Child index: `<Route index element={<Home />} />` (Upload & Fetch view).
  - Child dashboard: `<Route path="dashboard" element={<Dashboard />} />` (Full attendance dashboard).
  - Child subject: `<Route path="subject/:subjectName" element={<SubjectDetail />} />` (Individual subject history).

### `frontend/src/index.css`
The global CSS and Tailwind design tokens:
- **Line 1**: `@import "tailwindcss";` (Tailwind CSS v4 engine).
- **Lines 3–14**: Custom CSS variables for attendance color coding:
  - `--color-status-healthy`: Emerald green (`#10b981`) for $\ge 80\%$.
  - `--color-status-warning`: Amber (`#f59e0b`) for $60\% - 79.9\%$.
  - `--color-status-critical`: Rose red (`#ef4444`) for $< 60\%$.
- **Lines 22–38**: Utility components (`.glass-card`, `.glass-panel`, `.btn-primary`, `.btn-secondary`) using backdrop filters and smooth borders.
- **Lines 41–54**: Keyframe animations (`fadeIn`, staggered delay utilities).

---

## 2. Type Definitions (`frontend/src/lib/types.ts`)

Mirrors backend data structures to provide strict TypeScript type checking:

```typescript
export type AttendanceStatus = 'P' | 'A' | 'NU' | 'E' | 'L';
```
- Defines union of attendance status characters.

```typescript
export interface StudentMetadata { ... }
export interface AttendanceRecord { ... }
export interface SubjectSummary { ... }
export interface OverallSummary { ... }
export interface AttendanceDataset { ... }
export interface UploadResponse { ... }
export interface SubjectDetailResponse { ... }
```
- TypeScript interfaces matching backend models for data consistency across network boundaries.

```typescript
export const TARGET_ATTENDANCE = 80;
export const WARNING_THRESHOLD = 60;
export type AttendanceHealth = 'healthy' | 'warning' | 'critical';

export function getAttendanceHealth(percentage: number | null): AttendanceHealth {
  if (percentage === null) return 'healthy';
  if (percentage >= TARGET_ATTENDANCE) return 'healthy';
  if (percentage >= WARNING_THRESHOLD) return 'warning';
  return 'critical';
}
```
- Sets the official target threshold (80%) and helper function to determine badge status.

---

## 3. API Client (`frontend/src/lib/api.ts`)

Provides typed asynchronous HTTP functions calling the FastAPI backend:
- `API_BASE = '/api'`: Points to the Vite dev proxy.
- `handleResponse<T>`: Checks `response.ok`, parses JSON, or throws descriptive `ApiError` with backend message.
- `uploadAttendancePDF(file: File)`: Sends `multipart/form-data` to `POST /api/attendance/upload`.
- `getCurrentAttendance()`: Sends `GET /api/attendance/current`.
- `getSubjectDetail(subjectName: string)`: Sends `GET /api/attendance/subjects/{encodedName}`.
- `deleteCurrentAttendance()`: Sends `DELETE /api/attendance/current`.
- `checkHealth()`: Sends `GET /api/health` to confirm backend availability.
- `fetchAttendancePortal(username, password, headless)`: Sends JSON to `POST /api/attendance/fetch` to launch Playwright automation.

---

## 4. Subject Utilities & Mathematical Engines (`frontend/src/lib/subjectUtils.ts`)

The primary logic engine of the frontend.

### 4.1 Abbreviation Engine (`getSubjectAbbreviation`)
Maps long, unwieldy course names into standardized university shortforms:
- `SUBJECT_ABBREVIATIONS`: Dictionary mapping courses like `DATA STRUCTURES & ALGORITHMS` $\rightarrow$ `DSA`, `DATA STRUCTURES & ALGORITHMS LAB` $\rightarrow$ `DSA LAB`, `MANAGEMENT ACCOUNTING FOR ENGINEERS` $\rightarrow$ `MAE`.
- Algorithmic Acronym Generator: For unmapped subjects, removes common stop words (`AND`, `FOR`, `WITH`, `OF`) and generates clean acronyms, preserving trailing `LAB` suffixes.

### 4.2 Bunk Buffer & Recovery Calculator (`calculateBunkBuffer`)
Determines how many upcoming sessions can be bunked or must be attended:
```typescript
export function calculateBunkBuffer(
  present: number,
  total: number,
  target: number = TARGET_ATTENDANCE,
  remainingLectures?: number
): BunkCalculation
```
- **When Attendance $\ge$ Target**:
  - Computes `maxBunks = Math.floor((100 * present - target * total) / target)`.
  - Message: `"Can safely miss X lectures"` or `"On the margin! Do not miss next lecture"`.
- **When Attendance $<$ Target**:
  - Uses exact integer arithmetic:
    `numerator = target * total - 100 * present`
    `needed = Math.ceil(numerator / (100 - target))`
  - Compares `needed` against `remainingLectures`:
    - If `needed > remaining`: `"Cannot reach 80%! Do not miss any more"`.
    - If `needed >= remaining`: `"Cannot miss any more lectures!"` (the exact fix for DSA LAB 24/30).
    - If `needed < remaining`: `"Need to attend next X lectures"`.

### 4.3 "Not Updated" (NU) Simulation Engine (`simulateAttendanceWithNuPolicy`)
Allows students to test hypothetical scenarios for unfinalized sessions:
- **Policies**:
  1. `'ignored'`: Official university calculation (NU excluded from denominator).
  2. `'all_present'`: Simulates that all NU sessions become Present (`P`).
  3. `'all_absent'`: Simulates that all NU sessions become Absent (`A`).
  4. `'individual'`: Student can toggle each class individually in a modal.
- Dynamically recalculates individual subject summaries and overall university attendance in-memory without mutating the original database.

### 4.4 Curriculum Configuration & Lecture Projections
Models the NMIMS 15-week fixed curriculum:
- **`SubjectCurriculumConfig`**:
  - `hasLabOrTutorial`: boolean
  - `totalCredits`: number (usually 3 or 1)
  - `theoryWeekly`: number
  - `labTutorialWeekly`: number
  - `countTwoHoursAsOne`: boolean (for 2-hour lab blocks)
- **`getDefaultSubjectConfig`**: Automatically detects course structure based on subject name and section codes (e.g., detecting `E1` markers for lab/tutorial sessions).
- **`calculateSubjectLecturesStats`**:
  - `totalPlanned = credits * 15`
  - `completedTheory = theoryRecords.length`
  - `completedLab = unique dates for 2-hour labs, or count of lab records`
  - `remainingTheory = max(0, plannedTheory - completedTheory)`
  - `remainingLab = max(0, plannedLab - completedLab)`
  - `rawTotalRemaining = remainingTheory + (countTwoHoursAsOne ? remainingLab * 2 : remainingLab)`

---

## 5. Visual Analytics Library (`frontend/src/lib/analytics.ts`)

Computes chart data for Recharts visual graphs:
1. **`calculateDayOfWeekAnalytics(records)`**:
   - Parses ISO dates into day indexes (0=Sunday to 6=Saturday).
   - Aggregates Present, Absent, and NU sessions for each day of the week.
   - Computes day-wise attendance percentage to reveal attendance patterns.
2. **`calculateMonthlyAnalytics(records)`**:
   - Groups records by `YYYY-MM`.
   - Generates monthly trends over the semester.
3. **`calculateAttendanceInsights(records, subjects)`**:
   - Finds student's "Best Day" (highest attendance percentage).
   - Finds "Toughest Day" (most missed classes).
   - Identifies highest and lowest performing subjects and count of perfect (100%) subjects.

---

## 6. Build Configurations

### `frontend/package.json`
Dependencies:
- `react`, `react-dom`: v18 UI library.
- `react-router-dom`: v7 client routing.
- `lucide-react`: Clean SVG icon set.
- `recharts`: SVG charting engine for React.
- `tailwindcss`, `@tailwindcss/vite`: Tailwind v4 engine.
- `vite`: Build tool and dev server.

### `frontend/vite.config.ts`
Configures Vite with the Tailwind CSS plugin and sets up the local development proxy:
```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:8000',
      changeOrigin: true,
    },
  },
}
```
All calls to `/api/*` from React on `localhost:5173` are forwarded to FastAPI on `127.0.0.1:8000`.
