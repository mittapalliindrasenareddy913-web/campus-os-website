# 🎭 Campus OS — Principal Portal Playwright E2E Test Suite

Enterprise-grade End-to-End Playwright test suite for validating the **Campus OS Principal Portal**.

---

## 📁 Architecture Overview

```
campus/web/
├── playwright.config.ts              # Playwright configuration (Browsers, HTML Report, Traces, Videos, Screenshots)
└── e2e/
    ├── fixtures/
    │   └── baseTest.ts              # Custom fixture capturing console errors & network failures
    ├── pages/                       # Page Object Model (POM) Classes
    │   ├── LoginPage.ts             # Auth & Login page object
    │   ├── PrincipalDashboardPage.ts # Sidebar, subtab switching & KPI cards
    │   ├── HODManagementPage.ts     # HOD assignments
    │   ├── FacultyManagementPage.ts # Faculty roster & designations
    │   ├── StudentManagementPage.ts # Student master, filters, search & CSV import
    │   ├── DepartmentPage.ts        # Department creation
    │   ├── TimetableAttendancePage.ts # Timetable slot rendering & attendance
    │   ├── NoticesEventsPage.ts     # Notice publishing & calendar events
    │   └── ReportsSettingsPage.ts   # Analytics & CSV exports
    └── specs/                       # E2E Spec Files
        ├── 01_auth_rbac.spec.ts     # Login & RBAC verification
        ├── 02_dashboard_nav.spec.ts  # Subtab navigation & KPI cards
        ├── 03_management_crud.spec.ts # HOD, Faculty, Student & Department CRUD
        ├── 04_timetable_attendance.spec.ts # Timetable slot & attendance breakdown
        ├── 05_notices_events.spec.ts # Notices & calendar event tests
        ├── 06_reports_exports.spec.ts # Analytics rendering & CSV export
        └── 07_network_console_resilience.spec.ts # Console error & network failure assertion
```

---

## 🚀 Getting Started & Execution Instructions

### 1. Install Dependencies & Playwright Browsers

Navigate to the `campus/web` directory:
```bash
cd "c:\Users\mitta\OneDrive\my projects\STUDENT OS\campus\web"
npm install
npx playwright install
```

---

### 2. Run the E2E Test Suite

Run tests in headless mode:
```bash
npm run test:e2e
```

Run tests with Playwright Interactive UI Mode:
```bash
npm run test:e2e:ui
```

Run tests on a specific browser (e.g. Chrome or Edge):
```bash
npx playwright test --project=google-chrome
npx playwright test --project=msedge
```

---

### 3. View Interactive HTML Bug & Test Report

After execution, generate and open the interactive HTML Playwright report (includes failure screenshots, video recordings, and trace viewer):
```bash
npm run test:e2e:report
```

---

## 📊 Features & Reporting Capabilities

- **Automatic Failure Artifacts**: Captures full-page screenshots, video recordings, and trace zip files on test failures.
- **Browser Console Error Tracking**: Automatically fails tests if uncaught JavaScript exceptions occur.
- **Network Failure Monitoring**: Asserts API HTTP status codes (`status < 500`).
- **Multi-Browser Support**: Configured out of the box for Chromium, Chrome, and Microsoft Edge.
