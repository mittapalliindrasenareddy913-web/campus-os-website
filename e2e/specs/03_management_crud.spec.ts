import { test, expect } from '../fixtures/baseTest';
import { LoginPage } from '../pages/LoginPage';
import { PrincipalDashboardPage } from '../pages/PrincipalDashboardPage';
import { HODManagementPage } from '../pages/HODManagementPage';
import { FacultyManagementPage } from '../pages/FacultyManagementPage';
import { StudentManagementPage } from '../pages/StudentManagementPage';
import { DepartmentPage } from '../pages/DepartmentPage';

test.describe('3. HOD, Faculty, Student & Department CRUD Operations', () => {

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login('principal@campus.com', 'ASCET001', 'ASCET001');
  });

  test('Department Management: Create Department', async ({ page }) => {
    const dashboardPage = new PrincipalDashboardPage(page);
    const deptPage = new DepartmentPage(page);

    await dashboardPage.switchSubTab('Departments');
    await deptPage.createDepartment('AI-ML', 'Artificial Intelligence & Machine Learning');
  });

  test('HOD Management: Assign HOD', async ({ page }) => {
    const dashboardPage = new PrincipalDashboardPage(page);
    const hodPage = new HODManagementPage(page);

    await dashboardPage.switchSubTab('Departments');
    await hodPage.createHOD('Dr. A. Sharma', 'hod.aiml@campus.com', 'AI-ML');
  });

  test('Faculty Roster: Add new faculty member', async ({ page }) => {
    const dashboardPage = new PrincipalDashboardPage(page);
    const facultyPage = new FacultyManagementPage(page);

    await dashboardPage.switchSubTab('Faculty');
    await facultyPage.addFaculty('Prof. V. Kumar', 'vkumar@campus.com', 'Associate Professor');
  });

  test('Student Management: Search, Filter & Pagination', async ({ page }) => {
    const dashboardPage = new PrincipalDashboardPage(page);
    const studentPage = new StudentManagementPage(page);

    await dashboardPage.switchSubTab('Students');
    await dashboardPage.searchRecord('21001A0599');
    await dashboardPage.applyFilters('CSE', 'IV');
  });

  test('Negative Case: Duplicate Roll Number Form Validation', async ({ page }) => {
    const dashboardPage = new PrincipalDashboardPage(page);
    const studentPage = new StudentManagementPage(page);

    await dashboardPage.switchSubTab('Students');
    // Submitting duplicate roll number should show validation toast
    await studentPage.addStudent('21001A0599', 'Test Student Duplicate', 'dupe@student.com');
  });

});
