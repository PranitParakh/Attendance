# Action Plan: Dynamic Multi-Semester Attendance Engine & Setup Flow

## 1. Executive Summary & Goals

### The Problem
Currently, Attendly contains several hardcoded parameters that assume specific courses and configurations:
1. **Hardcoded Course Dictionaries**: A static mapping of course abbreviations (`DATA STRUCTURES & ALGORITHMS` $\rightarrow$ `DSA`, `COA`, `TC`, etc.).
2. **Hardcoded Credit & Format Logic**: Course configurations in `subjectUtils.ts` hardcode specific courses (`DISCRETE MATHEMATICS`, `PYTHON`, `DATA STRUCTURES & ALGORITHMS LAB`, etc.) to predetermined credits and weekly lecture splits.
3. **Hardcoded Program Suffixes**: Backend course name normalization in `normalizer.py` relies on specific degree identifiers (`MBA`, `MBT`, etc.).
4. **Lack of Semester Agnosticism**: When a student uploads a report from Semester 1, 2, 3, 5, 6, 7, 8 or from a different engineering branch (IT, Computer Science, Data Science, Cyber Security, etc.), the application has to make unverified guesses rather than using the student's actual curriculum.

### The Solution
Transform Attendly into a **fully dynamic, semester-agnostic attendance analytics platform**:
- **Automatic Course Discovery**: When any attendance PDF is uploaded or fetched, Attendly detects all unique courses in that specific semester report.
- **Dedicated Setup Page (`/setup`)**: If courses from a new semester report are not yet configured, the student is seamlessly guided to a Setup Page to configure:
  1. **Course Abbreviations** (e.g., customize or accept auto-generated shortforms).
  2. **Total Credits** (e.g., 1, 2, 3, 4, 5).
  3. **Course Format**: `Theory/LAB` (Theory-only or Lab-only) vs `Theory+LAB` (Integrated theory + practical).
  4. **Weekly Lecture Distribution**: Number of theory sessions and lab/tutorial sessions per week.
  5. **2-Hour Lab Session Rule**: Toggle whether 2-hour lab sessions count as 1 session in both course formats.
- **Semester Persistence**: Configurations are stored per semester/course, allowing students to switch between past and present semester reports without losing settings.
- **Anytime Reconfiguration**: Accessible anytime from the Dashboard header (*"Curriculum Setup"*) and via subject cards.

---

## 2. Architecture & Data Schemas

### 2.1 Unified Curriculum Setup Interface

```typescript
export interface CourseCurriculumSetup {
  courseName: string;            // Exact normalized course name from PDF
  abbreviation: string;          // Student's chosen short code (e.g., "DSA", "MATH-1", "BEE")
  format: 'theory_or_lab' | 'theory_and_lab'; // Theory/LAB vs Theory+LAB
  totalCredits: number;          // Course credits (1 to 5)
  theoryWeekly: number;          // Number of weekly theory sessions
  labTutorialWeekly: number;     // Number of weekly lab/tutorial sessions
  countTwoHoursAsOne: boolean;   // Whether 2-hour blocks count as 1 conducted session
  fixedWeeks?: number;           // Semester duration in weeks (default: 15)
}
```

### 2.2 Storage Strategy
- **Browser LocalStorage**: Keyed under `attendly_curriculum_settings_v2` as a dictionary:
  ```json
  {
    "DATA STRUCTURES & ALGORITHMS": {
      "courseName": "DATA STRUCTURES & ALGORITHMS",
      "abbreviation": "DSA",
      "format": "theory_or_lab",
      "totalCredits": 3,
      "theoryWeekly": 3,
      "labTutorialWeekly": 0,
      "countTwoHoursAsOne": false,
      "fixedWeeks": 15
    }
  }
  ```
- **Semester Tagging**: If two semesters share identical subject names, configs are namespaced by `[Semester]_[courseName]` to guarantee independence.

---

## 3. End-to-End User Experience & Flow

```
                      [ Upload Attendance PDF / Sync Portal ]
                                         │
                                         ▼
                            [ Backend Parses & Persists ]
                                         │
                                         ▼
                        [ Check Course Configuration State ]
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼                                         ▼
         Are any subjects unconfigured?            All subjects configured?
                    │                                         │
                   YES                                       NO
                    │                                         │
                    ▼                                         ▼
          [ Redirect to /setup ]                     [ Navigate to /dashboard ]
  • Displays all detected courses             • Renders all metrics, gauges & cards
  • Pre-fills intelligent defaults            • All calculations use saved config
  • Student reviews/edits fields
  • Clicks "Save & Launch Dashboard"
                    │
                    └────────────────────┐
                                         ▼
                              [ Navigate to /dashboard ]
                                         │
                                         ▼
                       [ "Curriculum Setup" Button in Header ]
                         (Allows re-editing setup anytime)
```

---

## 4. Setup Page (`/setup`) UI/UX Design

### 4.1 Page Layout
- **Banner / Header**:
  - Student identity summary: *"[Student Name] • [Program Name] • Semester [X]"*.
  - Helper badge: *"Detected [N] unique courses in your attendance report"*.
- **Global Actions**:
  - **"Apply Intelligent Defaults"**: Analyzes attendance logs (e.g., detecting `E1` batches and 2-hour timestamps) to infer sensible credits, formats, and abbreviations with one click.
  - **"Reset All"**: Restores suggestions to baseline.
- **Subject Configuration Cards**:
  Each detected subject is displayed in a dedicated card containing:
  1. **Course Identity**:
     - Full course title (e.g. `DATA STRUCTURES & ALGORITHMS`).
     - Session badge (e.g. `24 sessions conducted so far`).
  2. **Abbreviation Input**:
     - Text field with auto-generated acronym suggestion (e.g. `DSA`).
     - Real-time preview badge in the top-left corner.
  3. **Course Format Selector**:
     - Segmented toggle:
       - `[ Theory / LAB ]` (For theory-only subjects or standalone lab courses).
       - `[ Theory + LAB ]` (For integrated courses with both classroom lectures and lab practicals).
  4. **Credits & Weekly Distribution**:
     - Credit pills: `[ 1 ]` `[ 2 ]` `[ 3 ]` `[ 4 ]` `[ 5 ]`.
     - Inputs for *Theory sessions/week* and *Lab sessions/week*.
     - Auto-adjustment: Changing credits automatically suggests a standard split (e.g., 3 credits $\rightarrow$ 3 theory or 2 theory + 1 lab).
  5. **Lab Counting Toggle**:
     - Toggle: *"Count 2-hour lab blocks as 1 session"*.
     - Explainer text: *"When enabled, two consecutive hours on the same day in SAP are counted as one 2-hour practical session."*
  6. **Projection Preview**:
     - Live pill showing calculated planned semester hours (e.g., *"Planned: 45 sessions across 15 weeks"*).
- **Footer**:
  - Sticky bottom action bar with *"Save & Launch Dashboard"* button.

---

## 5. Phase-by-Phase Implementation Roadmap

### Phase 1: Decoupling Hardcoded Elements
- [ ] **Backend Normalizer (`backend/app/normalizer.py`)**:
  - Make regex patterns agnostic to program codes (`MBA`, `BTECH`, `MCA`, etc.).
  - Replace static `ABBREVIATION_MAP` with generic title casing and cleanup rules.
- [ ] **Frontend Subject Utilities (`frontend/src/lib/subjectUtils.ts`)**:
  - Remove hardcoded course names (`DISCRETE MATHEMATICS`, `PYTHON`, `SIGNALS`, etc.).
  - Upgrade dynamic acronym generator to handle complex subject titles and Roman numerals (e.g., `ENGINEERING MATHEMATICS II` $\rightarrow$ `EM-2`).
  - Upgrade `getDefaultSubjectConfig` to use rule-based inference from session metadata.

### Phase 2: Setup Page & Components
- [ ] Create `frontend/src/pages/Setup.tsx`.
- [ ] Implement responsive course configuration card component.
- [ ] Implement validation (ensure credits $> 0$ and weekly sessions match credit total).
- [ ] Implement one-click intelligent default generator.

### Phase 3: Route Integration & Smart Navigation
- [ ] Add `/setup` route to `frontend/src/App.tsx`.
- [ ] Update `frontend/src/pages/Home.tsx` and `frontend/src/components/UploadZone.tsx`:
  - After PDF upload or portal sync, inspect whether all subjects have existing configurations.
  - If unconfigured $\rightarrow$ redirect to `/setup`.
  - If already configured $\rightarrow$ redirect to `/dashboard`.
- [ ] Add *"Curriculum Setup"* button to `frontend/src/pages/Dashboard.tsx` header for quick access.

### Phase 4: Math Engine & Component Synchronization
- [ ] Connect `CourseCurriculumSetup` into:
  - `IntegratedCoursePanel.tsx` (format tabs, session projections, bunk buffer).
  - `SubjectDetail.tsx` (lecture history, planned vs completed counts).
  - `OverallAttendanceCard.tsx` and `NuPolicySelector.tsx`.
- [ ] Verify that saving on `/setup` triggers immediate updates across all dashboard cards without requiring page reloads.

### Phase 5: Multi-Semester Verification & Testing
- [ ] Test with Semester 4 reference report.
- [ ] Test with alternative semester reports (Semester 1, 2, 3, etc.).
- [ ] Verify calculation edge cases:
  - 1-credit standalone lab (15 sessions of 2 hours).
  - 4-credit integrated course (3 theory + 1 lab).
  - 3-credit pure theory course (3 theory + 0 lab).
  - DSA LAB warning verification (ensuring margin checks remain exact).

---

## 6. Testing & Verification Matrix

| Test ID | Test Scenario | Expected Outcome |
| :--- | :--- | :--- |
| **TC-01** | Student uploads a report from a semester never seen before. | Automatically redirects to `/setup` listing all detected subjects. |
| **TC-02** | Student edits abbreviation for a subject to a custom shortcode. | Custom abbreviation displays immediately in Dashboard cards, history pages, and Recharts graphs. |
| **TC-03** | Student selects `Theory+LAB` format and sets 2 theory + 1 lab weekly. | Dashboard calculates planned theory as 30 ($2 \times 15$) and planned lab as 15 ($1 \times 15$). |
| **TC-04** | Student toggles "Count 2 Hours as 1 Session". | Lab count switches between unique calendar dates and individual SAP raw records. |
| **TC-05** | Student navigates from Dashboard to `/setup` via header button. | All previously saved settings load accurately into the form. |
| **TC-06** | Student uploads a different semester report. | New subjects are detected and configured independently without corrupting previous semester settings. |
| **TC-07** | Automated test suite execution. | `npm run build` compiles with 0 errors; `pytest` passes 100%. |
