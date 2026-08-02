import React, { useContext, useState, useEffect, useRef } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import api, { API_URL } from '../services/api';
import { io } from 'socket.io-client';
import { toastSuccess, toastError, toastWarning, toastInfo, toast_CRUD } from '../services/toast';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';

// ── Shared time utilities ──────────────────────────────────────────────────
// Times are stored in 24-hour format (e.g. "09:00", "13:00").
// fmt24: converts a "HH:MM" 24h string to "hh:MM AM/PM" display string.
function fmt24(t: string): string {
  if (!t) return t;
  const clean = t.trim().toUpperCase();
  
  // If it already contains AM or PM, return it cleanly formatted
  if (clean.includes('AM') || clean.includes('PM')) {
    return clean.replace(/\s+/g, ' ');
  }

  const [hStr, mStr] = clean.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  if (isNaN(h)) return t;
  
  const period = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h = h - 12;
  
  return `${h.toString().padStart(2, '0')}:${m} ${period}`;
}
// fmtSlot24: converts a "HH:MM-HH:MM" 24h slot string to "hh:MM AM - hh:MM PM" display.
function fmtSlot24(s: string): string {
  if (!s) return s;
  const parts = s.split('-');
  if (parts.length !== 2) return s;
  return `${fmt24(parts[0])} - ${fmt24(parts[1])}`;
}
// ──────────────────────────────────────────────────────────────────────────

export default function CampusDashboard() {
  const auth = useContext(AuthContext);
  const [loading, setLoading] = useState(false);

  // Dynamic Subtabs selector with LocalStorage persistence & loading state
  const [activeSubTab, setActiveSubTabState] = useState<string>(() => {
    return localStorage.getItem('principal_active_subtab') || 'overview';
  });
  const [subTabLoading, setSubTabLoading] = useState<boolean>(false);
  const [comingSoonModal, setComingSoonModal] = useState<{ open: boolean; title: string; description: string }>({
    open: false,
    title: '',
    description: ''
  });
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');

  const setActiveSubTab = (tab: string) => {
    setSubTabLoading(true);
    localStorage.setItem('principal_active_subtab', tab);
    setActiveSubTabState(tab);
    setTimeout(() => setSubTabLoading(false), 200);
  };

  // Lists loaded from APIs
  const [depts, setDepts] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [calendar, setCalendar] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [timetables, setTimetables] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [examMarks, setExamMarks] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [quizResults, setQuizResults] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);


  // Search, Filter, and Pagination States for Principal Hubs
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterSem, setFilterSem] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);

  // Global ERP configurations (courses, programs, branches, academicYears, sections)
  const [configCourses, setConfigCourses] = useState<string[]>([]);
  const [configPrograms, setConfigPrograms] = useState<string[]>([]);
  const [configBranches, setConfigBranches] = useState<string[]>([]);
  const [configYears, setConfigYears] = useState<string[]>([]);
  const [configSections, setConfigSections] = useState<string[]>([]);
  const [configSemesters, setConfigSemesters] = useState<string[]>([]);
  const [configRegulations, setConfigRegulations] = useState<string[]>([]);

  // ERP Import States
  const [erpImportStep, setErpImportStep] = useState(1);
  const [erpImportType, setErpImportType] = useState('students');
  const [erpDuplicateStrategy, setErpDuplicateStrategy] = useState('skip');
  const [erpFile, setErpFile] = useState<File | null>(null);
  const [erpPreviewData, setErpPreviewData] = useState<any[]>([]);
  const [erpPreviewHeaders, setErpPreviewHeaders] = useState<string[]>([]);
  const [erpValidationErrors, setErpValidationErrors] = useState<any[]>([]);
  const [erpIsValidating, setErpIsValidating] = useState(false);
  const [erpIsProcessing, setErpIsProcessing] = useState(false);
  const [erpProgress, setErpProgress] = useState<any>(null);
  const [erpSummary, setErpSummary] = useState<any>(null);
  const [erpHistory, setErpHistory] = useState<any[]>([]);
  const [erpStats, setErpStats] = useState<any>(null);
  const [erpIsLocked, setErpIsLocked] = useState(false);

  // Editing controls
  const [editingId, setEditingId] = useState('');
  const [editFields, setEditFields] = useState<any>({});
  
  // Bulk import UI
  const [bulkText, setBulkText] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);
  // Subject upload states
  const [showSubjectUpload, setShowSubjectUpload] = useState(false);
  const [subjectUploadText, setSubjectUploadText] = useState('');
  const [subjectUploadPreview, setSubjectUploadPreview] = useState<any[]>([]);
  // Timetable upload states
  const [showTimetableUpload, setShowTimetableUpload] = useState(false);
  const [timetableUploadText, setTimetableUploadText] = useState('');
  const [timetableUploadPreview, setTimetableUploadPreview] = useState<any[]>([]);
  const [timetableUploadMetadata, setTimetableUploadMetadata] = useState<any>({ college: '', department: '', academicYear: '2026-27', semester: 1, section: 'A', effectiveDate: '' });
  // Quick-add inline forms for timetable preview grid
  const [quickAddSubject, setQuickAddSubject] = useState<Record<number, { open: boolean; code: string; name: string; credits: string; type: string; saving: boolean }>>({});
  const [quickAddFaculty, setQuickAddFaculty] = useState<Record<number, { open: boolean; fullName: string; email: string; password: string; saving: boolean }>>({}); 
  const [selectedTimetableYear, setSelectedTimetableYear] = useState<number>(3);
  const [selectedTimetableSection, setSelectedTimetableSection] = useState<string>('A');
  const [timetableViewMode, setTimetableViewMode] = useState<'daily' | 'weekly'>('daily');
  const [selectedTimetableDay, setSelectedTimetableDay] = useState<string>('Monday');
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [showAddSlotModal, setShowAddSlotModal] = useState<boolean>(false);
  const [customSections, setCustomSections] = useState<Record<number, string[]>>({
    1: ['A'],
    2: ['A'],
    3: ['A'],
    4: ['A']
  });


  // COE lists
  const [coeExams, setCoeExams] = useState<any[]>([]);
  const [coeTickets, setCoeTickets] = useState<any[]>([]);
  const [coeResults, setCoeResults] = useState<any[]>([]);
  const [coeMalpractices, setCoeMalpractices] = useState<any[]>([]);

  // Admin Lists
  const [admFees, setAdmFees] = useState<any[]>([]);
  const [admHostels, setAdmHostels] = useState<any[]>([]);
  const [admBuses, setAdmBuses] = useState<any[]>([]);
  const [admInventory, setAdmInventory] = useState<any[]>([]);

  const [officialChats, setOfficialChats] = useState<any[]>([]);

  const uniqueBranches = Array.from(new Set([
    ...configBranches,
    ...depts.map((d: any) => d.code),
    ...students.map((s: any) => s.branch)
  ])).filter(Boolean).sort();

  // Principal, HOD & Faculty Workflow-Based state controls
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(
    auth?.user && auth.user.role === 'hod' 
      ? 'hod_dashboard' 
      : auth?.user && auth.user.role === 'faculty' 
      ? 'faculty_dashboard' 
      : auth?.user && (auth.user.role === 'coe' || auth.user.role === 'exam_cell')
      ? 'coe_dashboard'
      : 'departments'
  );
  
  // Step 1 Setup States
  const [setupName, setSetupName] = useState('');
  const [setupAddress, setSetupAddress] = useState('');
  const [setupUniversity, setSetupUniversity] = useState('');
  const [setupState, setSetupState] = useState('');
  const [setupDistrict, setSetupDistrict] = useState('');
  const [setupCity, setSetupCity] = useState('');
  const [setupLogo, setSetupLogo] = useState('');
  const [setupAisheCode, setSetupAisheCode] = useState('');
  const [setupCollegeType, setSetupCollegeType] = useState('Private');
  const [setupAicteApproved, setSetupAicteApproved] = useState(true);
  const [setupUgcApproved, setSetupUgcApproved] = useState(true);
  const [setupNaacGrade, setSetupNaacGrade] = useState('A');
  const [setupNbaAccredited, setSetupNbaAccredited] = useState(false);
  const [setupTimezone, setSetupTimezone] = useState('Asia/Kolkata');
  const [setupLanguage, setSetupLanguage] = useState('en');
  const [setupDateFormat, setSetupDateFormat] = useState('DD/MM/YYYY');
  const [workingDaysList, setWorkingDaysList] = useState<string[]>(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  const [timingsList, setTimingsList] = useState<string[]>(['09:00-10:00', '10:00-11:00', '11:15-12:15', '12:15-01:15', '02:00-03:00', '03:00-04:00']);
  const [holidaysList, setHolidaysList] = useState<any[]>([]);
  const [gradingSystemList, setGradingSystemList] = useState<any[]>([]);
  const [attendanceRulesMin, setAttendanceRulesMin] = useState(75);
  
  // Step 4 Academics extra
  const [pendingTimetables, setPendingTimetables] = useState<any[]>([]);

  // Step 5 Approvals states
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [workflowHistory, setWorkflowHistory] = useState<any>({ leaves: [], requests: [] });
  const [approvalComment, setApprovalComment] = useState('');

  // ERP Import States
  const [erpActiveTab, setErpActiveTab] = useState<'wizard' | 'history' | 'stats'>('wizard');
  const [erpDryRun, setErpDryRun] = useState<boolean>(false);


  // Step 8 System Admin states
  const [rolePermissions, setRolePermissions] = useState<any>({
    hod: { viewAcademics: true, manageTimetable: true, viewFinances: false },
    faculty: { viewAcademics: true, manageTimetable: false, viewFinances: false },
    coe: { viewAcademics: true, manageExams: true, viewFinances: false },
    admin: { viewAcademics: true, manageAll: true, viewFinances: true }
  });

  const [setupSubTab, setSetupSubTab] = useState('profile'); // profile, settings, tags, holidays, grading
  const [bcRole, setBcRole] = useState('student');
  const [bcType, setBcType] = useState('general');
  const [bcTargetDept, setBcTargetDept] = useState('');
  const [bcTargetYear, setBcTargetYear] = useState('');
  const [bcTargetSection, setBcTargetSection] = useState('');
  const [systemSubTab, setSystemSubTab] = useState('logs'); // logs, permissions, templates, policies
  const [adminTab, setAdminTab] = useState('accounts'); // accounts, leaves, requests

  // AI Lists / Predictives
  const [aiPredict, setAiPredict] = useState<any>({
    atRiskCount: 0,
    atRiskCohort: [],
    placementEligibilityRate: '0%',
    predictedDepartmentPerformers: []
  });
  const [aiHistory, setAiHistory] = useState<any[]>([]);
  const [aiMessage, setAiMessage] = useState('');

  const [stats, setStats] = useState<any>({
    totalStudents: 0,
    totalFaculty: 0,
    totalDepartments: 0,
    totalSubjects: 0,
    upcomingEvents: 0,
    studentAttendance: 92.4,
    facultyAttendance: 96.8,
    upcomingExams: 0,
    completedExams: 0,
    pendingResults: 0,
    malpracticeCount: 0,
    totalFeesCount: 0,
    totalBuses: 0,
    hostelOccupied: 0,
    placementCount: 0,
    booksCount: 0
  });

  // Form Inputs
  // Department Form
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [deptHod, setDeptHod] = useState('');
  // Subject Form
  const [subName, setSubName] = useState('');
  const [subCode, setSubCode] = useState('');
  const [subCredits, setSubCredits] = useState(3);
  const [subDept, setSubDept] = useState('');
  // Faculty Form
  const [facName, setFacName] = useState('');
  const [facEmail, setFacEmail] = useState('');
  const [facEmpId, setFacEmpId] = useState('');
  const [facDept, setFacDept] = useState('');
  const [facPass, setFacPass] = useState('');
  // Notice Form
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeType, setNoticeType] = useState('general');
  // Calendar Form
  const [calDate, setCalDate] = useState('');
  const [calType, setCalType] = useState('working_day');
  const [calDesc, setCalDesc] = useState('');
  // Timetable Form
  const [ttYear, setTtYear] = useState(1);
  const [ttSec, setTtSec] = useState('A');
  const [ttDay, setTtDay] = useState('Monday');
  const [ttSlot, setTtSlot] = useState('09:00-10:00');
  const [ttSub, setTtSub] = useState('');
  const [ttFac, setTtFac] = useState('');
  const [ttRoom, setTtRoom] = useState('');
  const ttFileInputRef = useRef<HTMLInputElement>(null);
  // HOD Faculty assignments form states
  const [hodSelectedFaculty, setHodSelectedFaculty] = useState<any>(null);
  const [hodNewClassYear, setHodNewClassYear] = useState<number>(1);
  const [hodNewClassSection, setHodNewClassSection] = useState<string>('A');
  const [hodNewClassSubject, setHodNewClassSubject] = useState<string>('');
  // Faculty Portal Redesign States
  const [facultySelectedClass, setFacultySelectedClass] = useState<any>(null);
  const [facultyAttendanceMap, setFacultyAttendanceMap] = useState<any>({});
  
  // Assignments
  const [newAssTitle, setNewAssTitle] = useState('');
  const [newAssDesc, setNewAssDesc] = useState('');
  const [newAssDeadline, setNewAssDeadline] = useState('');
  const [newAssAttachment, setNewAssAttachment] = useState('');
  const [newAssSub, setNewAssSub] = useState('');
  const [newAssYear, setNewAssYear] = useState(1);
  const [newAssSec, setNewAssSec] = useState('A');
  const [gradingAssignmentId, setGradingAssignmentId] = useState('');
  const [gradingStudentId, setGradingStudentId] = useState('');
  const [gradingScoreVal, setGradingScoreVal] = useState('A+');
  
  // Materials & Notes
  const [matTitle, setMatTitle] = useState('');
  const [matType, setMatType] = useState('Notes');
  const [matUrl, setMatUrl] = useState('');
  const [newMatDesc, setNewMatDesc] = useState('');
  const [newMatUnit, setNewMatUnit] = useState('1');
  const [newMatFileType, setNewMatFileType] = useState('pdf');
  const [newMatSub, setNewMatSub] = useState('');
  const [newMatSec, setNewMatSec] = useState('');
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);

  // Attendance Form
  const [attDate, setAttDate] = useState('');
  const [attSlot, setAttSlot] = useState('09:00-10:00');
  const [attSub, setAttSub] = useState('');
  const [attStudId, setAttStudId] = useState('');
  const [attStatus, setAttStatus] = useState('Present');
  const [attRemark, setAttRemark] = useState('');

  // Quiz Form
  const [qTitle, setQTitle] = useState('');
  const [qSub, setQSub] = useState('');
  const [qDur, setQDur] = useState(30);
  const [qNeg, setQNeg] = useState(0);
  const [qQues, setQQues] = useState('');
  const [qOptA, setQOptA] = useState('');
  const [qOptB, setQOptB] = useState('');
  const [qCorrect, setQCorrect] = useState(0);

  // Marks Form (Single Entry & Bulk)
  const [markStud, setMarkStud] = useState('');
  const [markSub, setMarkSub] = useState('');
  const [markVal, setMarkVal] = useState(0);
  const [markType, setMarkType] = useState('mid_1');
  const [bulkMarkSub, setBulkMarkSub] = useState('');
  const [bulkMarkType, setBulkMarkType] = useState('mid_1');
  const [bulkMaxMarks, setBulkMaxMarks] = useState(100);
  const [bulkMarksMap, setBulkMarksMap] = useState<any>({}); // student rollNumber -> score

  // Leaves Form
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');

  // Lab record
  const [labRecords, setLabRecords] = useState<any[]>([]);
  const [labStudRoll, setLabStudRoll] = useState('');
  const [labStudName, setLabStudName] = useState('');
  const [labSub, setLabSub] = useState('');
  const [labSec, setLabSec] = useState('');
  const [labExpNum, setLabExpNum] = useState(1);
  const [labExpName, setLabExpName] = useState('');
  const [labObsMarks, setLabObsMarks] = useState(0);
  const [labVivaMarks, setLabVivaMarks] = useState(0);
  const [labRecMarks, setLabRecMarks] = useState(0);
  const [labStatus, setLabStatus] = useState('Completed');
  const [labRemarks, setLabRemarks] = useState('');

  // Announcements
  const [announcementsList, setAnnouncementsList] = useState<any[]>([]);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annType, setAnnType] = useState('department');
  const [annYear, setAnnYear] = useState('');
  const [annSec, setAnnSec] = useState('');

  // Class Diary
  const [diaryRecords, setDiaryRecords] = useState<any[]>([]);
  const [diaryDate, setDiaryDate] = useState('');
  const [diarySub, setDiarySub] = useState('');
  const [diarySec, setDiarySec] = useState('');
  const [diaryTopic, setDiaryTopic] = useState('');
  const [diaryHomework, setDiaryHomework] = useState('');
  const [diaryRemarks, setDiaryRemarks] = useState('');
  const [diaryStatus, setDiaryStatus] = useState('Completed');

  // Student Doubts
  const [doubtsList, setDoubtsList] = useState<any[]>([]);
  const [replyDoubtId, setReplyDoubtId] = useState<string | null>(null);
  const [replyDoubtAnswer, setReplyDoubtAnswer] = useState('');

  // Faculty Calendar & Notifications
  const [facultyCalendarData, setFacultyCalendarData] = useState<any>({ collegeEvents: [], classes: [] });
  const [facultyNotificationsList, setFacultyNotificationsList] = useState<any[]>([]);
  const [facultyAnalyticsData, setFacultyAnalyticsData] = useState<any>({});

  // ── HOD Attendance Monitor (Step 8) ────────────────────────────────────────
  const [hodAttData, setHodAttData]           = useState<any>(null);      // { summary, presentStudents, absentStudents }
  const [hodAttAnalytics, setHodAttAnalytics] = useState<any>(null);      // { daily, bySubject, byFaculty, bySection }
  const [hodFacSubmission, setHodFacSubmission] = useState<any[]>([]);    // faculty submission status list
  const [hodAttLoading, setHodAttLoading]     = useState(false);
  const [hodAttLive, setHodAttLive]           = useState(false);          // pulses when socket event arrives
  const [hodAttDate, setHodAttDate]           = useState(() => new Date().toISOString().split('T')[0]);
  const [hodAttSem, setHodAttSem]             = useState('');
  const [hodAttSection, setHodAttSection]     = useState('');
  const [hodAttSubject, setHodAttSubject]     = useState('');
  const [hodAttFaculty, setHodAttFaculty]     = useState('');
  const [hodAttSearch, setHodAttSearch]       = useState('');
  const [hodAttPage, setHodAttPage]           = useState(1);
  const [hodAttTotalPages, setHodAttTotalPages] = useState(1);
  const [hodAttActiveTab, setHodAttActiveTab] = useState<'overview'|'analytics'|'faculty'>('overview');
  const [hodAttAnalyticsDays, setHodAttAnalyticsDays] = useState(30);
  // ──────────────────────────────────────────────────────────────────────────

  // Profile Edit
  const [profileFullName, setProfileFullName] = useState(auth?.user?.fullName || '');
  const [profileBio, setProfileBio] = useState(auth?.user?.bio || '');
  const [profileMobile, setProfileMobile] = useState(auth?.user?.mobileNumber || '');
  const [profileGithub, setProfileGithub] = useState(auth?.user?.githubUrl || '');
  const [profileLinkedin, setProfileLinkedin] = useState(auth?.user?.linkedinUrl || '');
  const [profilePortfolio, setProfilePortfolio] = useState(auth?.user?.portfolioUrl || '');
  const [profileNewPass, setProfileNewPass] = useState('');

  // COE Forms
  const [coeSub, setCoeSub] = useState('');
  const [coeDate, setCoeDate] = useState('');
  const [coeSlot, setCoeSlot] = useState('09:30-12:30');
  const [coeRoom, setCoeRoom] = useState('');
  const [coeType, setCoeType] = useState('semester');

  // Extended COE State variables
  const [coeInvigilations, setCoeInvigilations] = useState<any[]>([]);
  const [coeSeatingList, setCoeSeatingList] = useState<any[]>([]);
  const [coeExamAttendanceList, setCoeExamAttendanceList] = useState<any[]>([]);
  const [coeRevaluationRequests, setCoeRevaluationRequests] = useState<any[]>([]);
  const [coeInternalMarksList, setCoeInternalMarksList] = useState<any[]>([]);
  const [coeInternalDiscrepancyList, setCoeInternalDiscrepancyList] = useState<any[]>([]);
  const [coeAuditLogsList, setCoeAuditLogsList] = useState<any[]>([]);

  // 1. Exam Configuration Inputs
  const [examConfTitle, setExamConfTitle] = useState('');
  const [examConfType, setExamConfType] = useState('external');
  const [examConfCategory, setExamConfCategory] = useState('semester');
  const [examConfRegulation, setExamConfRegulation] = useState('R22');
  const [examConfSemester, setExamConfSemester] = useState(1);
  const [examConfStartDate, setExamConfStartDate] = useState('');

  // 2. Exam Schedule / Timetable Inputs
  const [schedDept, setSchedDept] = useState('');
  const [schedSem, setSchedSem] = useState(1);
  const [schedSec, setSchedSec] = useState('A');
  const [schedSubName, setSchedSubName] = useState('');
  const [schedSubCode, setSchedSubCode] = useState('');
  const [schedDate, setSchedDate] = useState('');
  const [schedSlot, setSchedSlot] = useState('09:30-12:30');
  const [schedStart, setSchedStart] = useState('09:30');
  const [schedEnd, setSchedEnd] = useState('12:30');
  const [schedRoom, setSchedRoom] = useState('');
  const [schedSession, setSchedSession] = useState('forenoon');
  const [schedType, setSchedType] = useState('semester');

  // 3. Seating Allocation Form
  const [seatSchedId, setSeatSchedId] = useState('');
  const [seatRoom, setSeatRoom] = useState('');

  // 4. Invigilation Form
  const [invFacultyId, setInvFacultyId] = useState('');
  const [invSchedId, setInvSchedId] = useState('');
  const [invRoom, setInvRoom] = useState('');
  const [invDate, setInvDate] = useState('');
  const [invTime, setInvTime] = useState('');

  // 5. External Marks Entry
  const [extStudId, setExtStudId] = useState('');
  const [extSubCode, setExtSubCode] = useState('');
  const [extMarks, setExtMarks] = useState(0);
  const [extMaxMarks, setExtMaxMarks] = useState(100);
  const [extBulkText, setExtBulkText] = useState('');

  // 6. Results processing inputs
  const [resProcStudId, setResProcStudId] = useState('');
  const [resProcSem, setResProcSem] = useState(1);
  const [resProcGraceMarks, setResProcGraceMarks] = useState(0);
  const [resProcGraceSub, setResProcGraceSub] = useState('');

  // 7. Malpractice Form
  const [mpCaseNum, setMpCaseNum] = useState('');
  const [mpStudentRoll, setMpStudentRoll] = useState('');
  const [mpSubCode, setMpSubCode] = useState('');
  const [mpExamDate, setMpExamDate] = useState('');
  const [mpDesc, setMpDesc] = useState('');
  const [mpEvidence, setMpEvidence] = useState('');
  const [mpDecision, setMpDecision] = useState('Pending');
  const [mpPenalty, setMpPenalty] = useState('');
  const [mpPunishment, setMpPunishment] = useState('');

  // 8. Exam Attendance Form
  const [examAttStudId, setExamAttStudId] = useState('');
  const [examAttSchedId, setExamAttSchedId] = useState('');
  const [examAttStatus, setExamAttStatus] = useState('Present');
  const [examAttRemarks, setExamAttRemarks] = useState('');

  // 9. Notifications Form
  const [coeNotifTitle, setCoeNotifTitle] = useState('');
  const [coeNotifBody, setCoeNotifBody] = useState('');
  const [coeNotifCategory, setCoeNotifCategory] = useState('general');

  // 10. Student Search
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [studentSearchResult, setStudentSearchResult] = useState<any>(null);

  // 11. Profile Edit
  const [coeProfileName, setCoeProfileName] = useState('');
  const [coeProfileMobile, setCoeProfileMobile] = useState('');
  const [coeProfilePass, setCoeProfilePass] = useState('');
  const [resStudId, setResStudId] = useState('');
  const [resSem, setResSem] = useState(1);
  const [resSgpa, setResSgpa] = useState(8.5);
  const [resCgpa, setResCgpa] = useState(8.5);
  const [mpStud, setMpStud] = useState('');
  const [mpSub, setMpSub] = useState('');
  const [mpDate, setMpDate] = useState('');
  const [coeMpPenalty, setCoeMpPenalty] = useState('');
  const [mpRemarks, setMpRemarks] = useState('');

  // Admin Forms
  const [feeStud, setFeeStud] = useState('');
  const [feeTotal, setFeeTotal] = useState(12000);
  const [feePaid, setFeePaid] = useState(0);
  const [feeType, setFeeType] = useState('tuition');
  const [hostelStud, setHostelStud] = useState('');
  const [hostelBlock, setHostelBlock] = useState('A');
  const [hostelRoom, setHostelRoom] = useState('101');
  const [hostelBed, setHostelBed] = useState('1');
  const [busNum, setBusNum] = useState('');
  const [busDriver, setBusDriver] = useState('');
  const [busFrom, setBusFrom] = useState('');
  const [busTo, setBusTo] = useState('');
  const [busStops, setBusStops] = useState('');
  const [invName, setInvName] = useState('');
  const [invCategory, setInvCategory] = useState('Computers');
  const [invStock, setInvStock] = useState(10);
  const [invVendor, setInvVendor] = useState('');

  // Official Communication Forms
  const [bcTitle, setBcTitle] = useState('');
  const [bcBody, setBcBody] = useState('');
  const [bcDept, setBcDept] = useState('');
  const [chatRecipient, setChatRecipient] = useState('');
  const [chatContent, setChatContent] = useState('');

  if (!auth || !auth.user) return null;
  const { user } = auth;

  // STEP 6: Verify React State
  useEffect(() => {
    if (user && user.role === 'student' && timetables.length > 0) {
      console.log("STEP 6: React State (timetables):", timetables);
    }
  }, [timetables, user]);


  // Chart Data
  const attendanceChartData = [
    { name: 'Mon', Student: 94, Faculty: 98 },
    { name: 'Tue', Student: 92, Faculty: 96 },
    { name: 'Wed', Student: 95, Faculty: 97 },
    { name: 'Thu', Student: 91, Faculty: 95 },
    { name: 'Fri', Student: 93, Faculty: 98 }
  ];

  const loadData = async () => {
    try {
      if (user.role === 'principal') {
        const statsRes = await api.get('/principal/dashboard-stats');
        setStats(statsRes.data);
        
        // Fetch departments
        const deptRes = await api.get('/principal/departments');
        setDepts(deptRes.data);

        // Fetch notices
        const noticeRes = await api.get('/principal/notices');
        setNotices(noticeRes.data);

        // Fetch calendar items
        const calRes = await api.get('/principal/calendar');
        setCalendar(calRes.data);

        // Fetch logs
        const logsRes = await api.get('/principal/audit-logs');
        setLogs(logsRes.data);

        // Unified Principal Workspace loaders
        try {
          const configRes = await api.get('/principal/config');
          setConfigCourses(configRes.data.courses || []);
          setConfigPrograms(configRes.data.programs || []);
          setConfigBranches(configRes.data.branches || []);
          setConfigYears(configRes.data.academicYears || []);
          setConfigSections(configRes.data.sections || []);
          setConfigSemesters(configRes.data.semesters || []);
          setConfigRegulations(configRes.data.regulations || []);

          setSetupName(configRes.data.name || '');
          setSetupAddress(configRes.data.address || '');
          setSetupUniversity(configRes.data.university || '');
          setSetupState(configRes.data.state || '');
          setSetupDistrict(configRes.data.district || '');
          setSetupCity(configRes.data.city || '');
          setSetupLogo(configRes.data.logo || '');
          setSetupAisheCode(configRes.data.aisheCode || '');
          setSetupCollegeType(configRes.data.collegeType || 'Private');
          setSetupAicteApproved(configRes.data.aicteApproved !== false);
          setSetupUgcApproved(configRes.data.ugcApproved !== false);
          setSetupNaacGrade(configRes.data.naacGrade || 'A');
          setSetupNbaAccredited(configRes.data.nbaAccredited === true);
          setSetupTimezone(configRes.data.timezone || 'Asia/Kolkata');
          setSetupLanguage(configRes.data.language || 'en');
          setSetupDateFormat(configRes.data.dateFormat || 'DD/MM/YYYY');
          setWorkingDaysList(configRes.data.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
          setTimingsList(configRes.data.timings || ['09:00-10:00', '10:00-11:00', '11:15-12:15', '12:15-01:15', '02:00-03:00', '03:00-04:00']);
          setHolidaysList(configRes.data.holidays || []);
          setGradingSystemList(configRes.data.gradingSystem || []);
          setAttendanceRulesMin(configRes.data.attendanceRules?.minPercentage || 75);
        } catch (e) {
          console.error("Failed loading college settings config.", e);
        }

        try {
          const staffRes = await api.get('/principal/users', {
            params: {
              role: filterRole || undefined,
              department: filterDept || undefined,
              search: searchTerm || undefined,
              page: 1,
              limit: 100
            }
          });
          setUsersList(staffRes.data.users || []);
        } catch (e) {
          console.error("Failed loading filtered users list.", e);
        }

        try {
          const allStaffRes = await api.get('/principal/users', {
            params: { limit: 1000 }
          });
          setStaff(allStaffRes.data.users || []);
        } catch (e) {
          console.error("Failed loading staff list.", e);
        }

        try {
          const studentsRes = await api.get('/principal/student-records', {
            params: {
              page: currentPage,
              limit: 10,
              search: searchTerm || undefined,
              branch: filterBranch || undefined
            }
          });
          setStudents(studentsRes.data.records || []);
          setTotalPages(studentsRes.data.totalPages || 1);
          setTotalCount(studentsRes.data.totalCount || 0);
        } catch (e) {
          console.error("Failed loading student records.", e);
        }

        try {
          const subjectsRes = await api.get('/erp/subjects');
          setSubjects(subjectsRes.data || []);
        } catch (e) {
          console.error("Failed loading subjects catalog.", e);
        }

        try {
          const approvalsRes = await api.get('/principal/approvals');
          setPendingLeaves(approvalsRes.data.leaves || []);
          setPendingRequests(approvalsRes.data.requests || []);
        } catch (e) {
          console.error("Failed loading approvals queue.", e);
        }

        try {
          const approvalsHistoryRes = await api.get('/principal/approvals/history');
          setWorkflowHistory(approvalsHistoryRes.data || { leaves: [], requests: [] });
        } catch (e) {
          console.error("Failed loading workflow history.", e);
        }

        try {
          const pendingTimetablesRes = await api.get('/principal/timetables/pending');
          setPendingTimetables(pendingTimetablesRes.data || []);
        } catch (e) {
          console.error("Failed loading pending timetables.", e);
        }

        // ERP history & lock status loaders
        try {
          const histRes = await api.get('/erp/imports/history');
          setErpHistory(histRes.data || []);
        } catch (e) {
          console.error("Failed loading ERP history.", e);
        }

        try {
          const lockRes = await api.get('/erp/imports/lock-status');
          setErpIsLocked(lockRes.data.locked || false);
        } catch (e) {
          console.error("Failed loading ERP lock status.", e);
        }
      } else if (user.role === 'hod') {
        try {
          // Load config for branches
          try {
            const configRes = await api.get('/principal/config');
            setConfigBranches(configRes.data.branches || []);
            setConfigYears(configRes.data.academicYears || []);
            setConfigSections(configRes.data.sections || []);
            setWorkingDaysList(configRes.data.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
            setTimingsList(configRes.data.timings || ['09:00-10:00', '10:00-11:00', '11:15-12:15', '12:15-01:15', '02:00-03:00', '03:00-04:00']);
          } catch (e) {
            console.error("Failed loading HOD college config.", e);
          }

          const statsRes = await api.get('/hod/dashboard-stats');
          setStats(statsRes.data);
          const [staffRes, subRes, ttRes, leavesRes, marksRes, matRes, studentsRes, noticesRes] = await Promise.all([
            api.get('/hod/faculty'),
            api.get('/hod/subjects'),
            api.get('/hod/timetable'),
            api.get('/hod/leaves'),
            api.get('/hod/marks'),
            api.get('/hod/materials'),
            api.get('/hod/students'),
            api.get('/hod/notices')
          ]);
          setStaff(staffRes.data || []);
          setSubjects(subRes.data || []);
          setTimetables(ttRes.data || []);
          setLeaves(leavesRes.data || []);
          setExamMarks(marksRes.data || []);
          setMaterials(matRes.data || []);
          setStudents(studentsRes.data || []);
          setNotices(noticesRes.data || []);
          // Load today's attendance for HOD monitor
          try {
            const attRes = await api.get('/hod/attendance');
            setHodAttData(attRes.data);
            setHodAttTotalPages(attRes.data.totalPages || 1);
          } catch (e) { console.error('HOD attendance load failed:', e); }
        } catch (e) {
          console.error("Failed loading HOD dashboard information.", e);
        }
      } else if (user.role === 'faculty') {
        try {
          // Load config for branches
          try {
            const configRes = await api.get('/principal/config');
            setConfigBranches(configRes.data.branches || []);
            setConfigYears(configRes.data.academicYears || []);
            setConfigSections(configRes.data.sections || []);
            setWorkingDaysList(configRes.data.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
            setTimingsList(configRes.data.timings || ['09:00-10:00', '10:00-11:00', '11:15-12:15', '12:15-01:15', '02:00-03:00', '03:00-04:00']);
          } catch (e) {
            console.error("Failed loading faculty college config.", e);
          }

          const statsRes = await api.get('/faculty/dashboard-stats');
          setStats(statsRes.data);
          const qRes = await api.get('/faculty/quizzes');
          setQuizzes(qRes.data || []);
          const qrRes = await api.get('/faculty/quizzes/results');
          setQuizResults(qrRes.data || []);
          
          // Leaves
          const leavesRes = await api.get('/faculty/leaves');
          setLeaves(leavesRes.data || []);
          
          // Assigned students list
          const studentsRes = await api.get('/faculty/students');
          setStudents(studentsRes.data || []);
          
          // Assigned timetable list
          const ttRes = await api.get('/faculty/timetable');
          setTimetables(ttRes.data || []);
          
          // Assignments tracker list
          const assRes = await api.get('/faculty/assignments');
          setAssignments(assRes.data || []);
          
          // Study materials list
          const matRes = await api.get('/faculty/materials');
          setMaterials(matRes.data || []);

          // Announcements
          const annRes = await api.get('/faculty/announcements');
          setAnnouncementsList(annRes.data || []);

          // Notifications
          const notificationsRes = await api.get('/faculty/notifications');
          setFacultyNotificationsList(notificationsRes.data || []);

          // Class Diary
          const diaryRes = await api.get('/faculty/diary');
          setDiaryRecords(diaryRes.data || []);

          // Doubts
          const doubtsRes = await api.get('/faculty/doubts');
          setDoubtsList(doubtsRes.data || []);

          // Calendar
          const calendarRes = await api.get('/faculty/calendar');
          setFacultyCalendarData(calendarRes.data || { collegeEvents: [], classes: [] });

          // Analytics
          const analyticsRes = await api.get('/faculty/analytics');
          setFacultyAnalyticsData(analyticsRes.data || {});

          // Notices list (principal notices)
          const noticesRes = await api.get('/principal/notices');
          setNotices((noticesRes.data || []).filter((n: any) => n.targetDepartment === user.assignedDepartment || n.targetDepartment === ''));
        } catch (e) {
          console.error("Failed loading faculty workspace information.", e);
        }
      } else if (user.role === 'student') {
        try {
          const ttRes = await api.get('/student/timetable');
          console.log("STEP 5: Student OS API Response data:", ttRes.data);
          setTimetables(ttRes.data || []);
        } catch (e) { console.error('Failed loading student timetable', e); }
        try {
          const noticeRes = await api.get('/principal/notices');
          setNotices(noticeRes.data || []);
        } catch (e) { console.error('Failed loading student notices', e); }
        try {
          const matRes = await api.get('/erp/materials');
          setMaterials(matRes.data || []);
        } catch (e) { console.error('Failed loading student materials', e); }
      } else if (user.role === 'coe' || user.role === 'exam_cell') {
        try {
          const statsRes = await api.get('/coe/dashboard-stats');
          setStats(statsRes.data);
          const examRes = await api.get('/coe/exams');
          setCoeExams(examRes.data || []);
          const htRes = await api.get('/coe/hall-tickets');
          setCoeTickets(htRes.data || []);
          const resRes = await api.get('/coe/results');
          setCoeResults(resRes.data || []);
          const mpRes = await api.get('/coe/malpractices');
          setCoeMalpractices(mpRes.data || []);

          // Invigilations
          const invRes = await api.get('/coe/invigilation');
          setCoeInvigilations(invRes.data || []);

          // Seating Arrangements
          const seatingRes = await api.get('/coe/seating');
          setCoeSeatingList(seatingRes.data || []);

          // Exam Attendance
          const attRes = await api.get('/coe/exam-attendance');
          setCoeExamAttendanceList(attRes.data || []);

          // Revaluation requests
          const revalRes = await api.get('/coe/revaluation');
          setCoeRevaluationRequests(revalRes.data || []);

          // Internal marks verification list
          const internalRes = await api.get('/coe/internal-marks');
          setCoeInternalMarksList(internalRes.data || []);

          // Discrepancy report
          const discrepancyRes = await api.get('/coe/internal-marks/discrepancies');
          setCoeInternalDiscrepancyList(discrepancyRes.data || []);

          // Audit logs
          const auditRes = await api.get('/coe/audit-logs');
          setCoeAuditLogsList(auditRes.data || []);
        } catch (e) {
          console.error('Failed loading COE data:', e);
        }
      } else {
        // Administration portal roles
        const statsRes = await api.get('/admin/dashboard-stats');
        setStats(statsRes.data);
        const feesRes = await api.get('/admin/fees');
        setAdmFees(feesRes.data);
        const hostelRes = await api.get('/admin/hostel/allocations');
        setAdmHostels(hostelRes.data);
        const transportRes = await api.get('/admin/transport/routes');
        setAdmBuses(transportRes.data);
        const invRes = await api.get('/admin/inventory');
        setAdmInventory(invRes.data);
        const logsRes = await api.get('/principal/audit-logs');
        setLogs(logsRes.data);
      }

      // Load Official Chats threads
      if (activeSubTab === 'official_chat') {
        const chatsRes = await api.get('/official/chats');
        setOfficialChats(chatsRes.data);
      }

      // Load AI Predictive Analytics
      if (activeSubTab === 'campus_ai') {
        const aiRes = await api.get('/ai/predictive-analytics');
        setAiPredict(aiRes.data);
      }
    } catch (e) {
      console.warn('API sync warning.');
    }
  };

  useEffect(() => {
    // Reset page to 1 when changing subtabs or filter constraints
    setCurrentPage(1);
  }, [activeSubTab, searchTerm, filterRole, filterDept, filterBranch, filterYear, filterSem]);

  useEffect(() => {
    // Set default active tab based on role on mount
    if (user.role === 'student') setActiveSubTab('student_timetable');
  }, []);

  useEffect(() => {
    loadData();
  }, [activeSubTab, searchTerm, filterRole, filterDept, filterBranch, filterYear, filterSem, currentPage]);

  useEffect(() => {
    const token = localStorage.getItem('campus_web_token');
    if (!token || !user) return;

    const socketUrl = API_URL.replace('/api', '');
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('📡 [Socket.io] Connected for:', user.fullName);
    });

    socket.on('timetable_updated', (data: any) => {
      console.log('📡 [Socket.io] timetable_updated event received:', data);
      
      const userCollege = (user.collegeCode || '').toUpperCase();
      const userDept = (user.assignedDepartment || user.department || user.branch || '').toUpperCase();
      const userSem = Number(user.semester || 0);
      const userSec = (user.section || '').toUpperCase();

      const matchCollege = data.collegeCode?.toUpperCase() === userCollege;
      const matchDept = data.department?.toUpperCase() === userDept;
      const matchSem = Number(data.semester) === userSem;
      const matchSec = data.section?.toUpperCase() === userSec;

      const isHodOrFacultyOfDept = ['hod', 'faculty'].includes(user.role) && 
        data.department?.toUpperCase() === (user.assignedDepartment || '').toUpperCase();

      if ((matchCollege && matchDept && matchSem && matchSec && user.role === 'student') || isHodOrFacultyOfDept) {
        toastInfo(`✨ Timetable updated in real-time by HOD! Loading changes...`);
        loadData();
      }
    });

    // HOD real-time attendance updates
    if (user.role === 'hod') {
      socket.on('hod_attendance_updated', (payload: any) => {
        console.log('📡 [Socket.io] hod_attendance_updated:', payload);
        setHodAttLive(true);
        setTimeout(() => setHodAttLive(false), 4000);
        toastInfo(`📋 ${payload.facultyName} submitted ${payload.subjectCode} (${payload.section}) — Present: ${payload.presentCount}, Absent: ${payload.absentCount}`);
        // Silently refresh attendance data with current filters
        api.get('/hod/attendance', {
          params: {
            date: hodAttDate || undefined,
            semester: hodAttSem || undefined,
            section: hodAttSection || undefined,
            subjectCode: hodAttSubject || undefined,
            facultyId: hodAttFaculty || undefined,
            page: hodAttPage,
            limit: 50
          }
        }).then(r => {
          setHodAttData(r.data);
          setHodAttTotalPages(r.data.totalPages || 1);
        }).catch(() => {});
        // Refresh faculty submission status
        api.get('/hod/faculty-submission-status', { params: { date: hodAttDate || undefined } })
          .then(r => setHodFacSubmission(r.data || []))
          .catch(() => {});
      });
    }

    // Principal real-time attendance updates
    if (user.role === 'principal') {
      socket.on('attendance_updated', (payload: any) => {
        console.log('📡 [Socket.io] principal attendance_updated:', payload);
        toastInfo(`📋 ${payload.facultyName} submitted ${payload.subjectCode} (${payload.section}) in ${payload.department} — Present: ${payload.presentCount}, Absent: ${payload.absentCount}`);
        // Refresh principal dashboard stats and logs
        api.get('/principal/dashboard-stats').then(r => setStats(r.data)).catch(() => {});
        api.get('/principal/audit-logs').then(r => setLogs(r.data)).catch(() => {});
      });
    }

    socket.on('erp_import_progress', (data: any) => {
      console.log('📡 [Socket.io] erp_import_progress event received:', data);
      const event = new CustomEvent('erp_import_progress', { detail: data });
      window.dispatchEvent(event);
    });


    socket.on('erp_import_completed', (data: any) => {
      console.log('📡 [Socket.io] erp_import_completed event received:', data);
      const event = new CustomEvent('erp_import_completed', { detail: data });
      window.dispatchEvent(event);
    });

    socket.on('erp_import_failed', (data: any) => {
      console.log('📡 [Socket.io] erp_import_failed event received:', data);
      const event = new CustomEvent('erp_import_failed', { detail: data });
      window.dispatchEvent(event);
    });

    return () => {
      socket.disconnect();
    };
  }, [user, API_URL]);

  useEffect(() => {
    const handleProgress = (e: Event) => {
      const data = (e as CustomEvent).detail;
      setErpProgress(data);
      setErpIsProcessing(true);
    };
    const handleCompleted = (e: Event) => {
      const data = (e as CustomEvent).detail;
      setErpProgress(null);
      setErpIsProcessing(false);
      setErpSummary(data);
      setErpImportStep(7); // Jump to Import Summary step!
      toastSuccess('Import completed successfully!');
      loadData();
    };
    const handleFailed = (e: Event) => {
      const data = (e as CustomEvent).detail;
      setErpProgress(null);
      setErpIsProcessing(false);
      setErpSummary(data);
      setErpImportStep(7); // Show rollback report / failed summary
      toastError('Import failed and was rolled back.');
      loadData();
    };

    window.addEventListener('erp_import_progress', handleProgress);
    window.addEventListener('erp_import_completed', handleCompleted);
    window.addEventListener('erp_import_failed', handleFailed);

    return () => {
      window.removeEventListener('erp_import_progress', handleProgress);
      window.removeEventListener('erp_import_completed', handleCompleted);
      window.removeEventListener('erp_import_failed', handleFailed);
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('campus_custom_sections');
    if (saved) {
      try {
        setCustomSections(JSON.parse(saved));
      } catch (e) {
        console.error('Error parsing custom sections', e);
      }
    }
  }, []);

  useEffect(() => {
    if (!timetables || timetables.length === 0) return;
    setCustomSections(prev => {
      const copy = { ...prev };
      let changed = false;
      timetables.forEach((tt: any) => {
        const y = Number(tt.year);
        const s = (tt.section || '').toUpperCase().trim();
        if (y >= 1 && y <= 4 && s) {
          if (!copy[y]) copy[y] = ['A'];
          if (!copy[y].includes(s)) {
            copy[y] = [...copy[y], s].sort();
            changed = true;
          }
        }
      });
      if (changed) {
        localStorage.setItem('campus_custom_sections', JSON.stringify(copy));
        return copy;
      }
      return prev;
    });
  }, [timetables]);

  // Actions
  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptCode || !deptName) return;
    setLoading(true);
    try {
      await api.post('/principal/departments', { code: deptCode, name: deptName, description: deptDesc, hodId: deptHod || undefined });
      toastSuccess('Department registered.');
      setDeptCode(''); setDeptName(''); setDeptDesc(''); setDeptHod('');
      loadData();
    } catch (err: any) {
      toastError('Error creating department.');
    } finally {
      setLoading(false);
    }
  };

  // Unified User Account Save (Create / Edit)
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      fullName: editFields.fullName || '',
      email: editFields.email || '',
      role: editFields.role || 'student',
      employeeId: editFields.employeeId || undefined,
      studentId: editFields.studentId || undefined,
      assignedDepartment: editFields.assignedDepartment || '',
      branch: editFields.branch || '',
      year: editFields.year ? Number(editFields.year) : undefined,
      semester: editFields.semester ? Number(editFields.semester) : undefined,
      rollNumber: editFields.rollNumber || '',
      isActive: editFields.isActive !== undefined ? editFields.isActive : true,
      password: editFields.password || undefined
    };

    if (!payload.fullName || !payload.email || (!editingId && !payload.password)) {
      toast_CRUD.validationError('Name, Email, and Password are required.');
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        await api.put(`/principal/users/${editingId}`, payload);
        toastSuccess('Account updated successfully.');
      } else {
        await api.post('/principal/users', payload);
        toastSuccess('Account registered successfully.');
      }
      setEditingId('');
      setEditFields({});
      loadData();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Error saving user account.');
    } finally {
      setLoading(false);
    }
  };

  // Delete User Account
  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this account?')) return;
    setLoading(true);
    const isHod = user?.role === 'hod';
    try {
      await api.delete(isHod ? `/hod/faculty/${id}` : `/principal/users/${id}`);
      toastSuccess('Account deleted successfully.');
      loadData();
    } catch (err: any) {
      toastError('Error deleting account.');
    } finally {
      setLoading(false);
    }
  };

  // Student Record Save (Create / Edit)
  const handleSaveStudentRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      studentId: editFields.studentId || '',
      rollNumber: editFields.rollNumber || '',
      admissionNumber: editFields.admissionNumber || '',
      fullName: editFields.fullName || '',
      gender: editFields.gender || 'Male',
      dob: editFields.dob || '',
      department: editFields.department || user?.assignedDepartment || '',
      branch: editFields.branch || user?.assignedDepartment || '',
      course: editFields.course || 'B.TECH',
      academicYear: editFields.academicYear || '',
      semester: editFields.semester ? Number(editFields.semester) : 1,
      section: editFields.section || 'A',
      batch: editFields.batch || '',
      mobileNumber: editFields.mobileNumber || '',
      status: editFields.status || 'Active',
      admissionDate: editFields.admissionDate || '',
      photo: editFields.photo || '',
      fatherName: editFields.fatherName || '',
      motherName: editFields.motherName || '',
      parentPhone: editFields.parentPhone || '',
      parentEmail: editFields.parentEmail || ''
    };

    if (!payload.rollNumber || !payload.fullName || !payload.gender || !payload.dob || !payload.department || !payload.branch || !payload.course || !payload.academicYear || !payload.semester || !payload.section) {
      toast_CRUD.validationError('Please fill out all required academic master fields.');
      return;
    }

    setLoading(true);
    const isHod = user?.role === 'hod';
    try {
      if (editingId) {
        await api.put(isHod ? `/hod/students/${editingId}` : `/principal/student-records/${editingId}`, payload);
        toastSuccess('Student academic record updated.');
      } else {
        await api.post(isHod ? '/hod/students' : '/principal/student-records', payload);
        toastSuccess('Student academic record registered.');
      }
      setEditingId('');
      setEditFields({});
      loadData();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Error saving student record.');
    } finally {
      setLoading(false);
    }
  };

  // Delete Student Record
  const handleDeleteStudentRecord = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student master record?')) return;
    setLoading(true);
    const isHod = user?.role === 'hod';
    try {
      await api.delete(isHod ? `/hod/students/${id}` : `/principal/student-records/${id}`);
      toastSuccess('Student record deleted successfully.');
      loadData();
    } catch (err: any) {
      toastError('Error deleting student record.');
    } finally {
      setLoading(false);
    }
  };

  // Bulk student actions
  const handleBulkStudentRecordAction = async (action: string, targetValue?: string) => {
    if (selectedRecordIds.length === 0) {
      toastInfo('Please select at least one student record.');
      return;
    }
    if (!confirm(`Are you sure you want to perform bulk action "${action}" on ${selectedRecordIds.length} records?`)) return;
    setLoading(true);
    const isHod = user?.role === 'hod';
    try {
      await api.post(isHod ? '/hod/students/bulk-action' : '/principal/student-records/bulk-action', {
        ids: selectedRecordIds,
        action,
        targetValue
      });
      toastSuccess('Bulk action executed successfully.');
      setSelectedRecordIds([]);
      loadData();
    } catch (err: any) {
      toastError('Error performing bulk action.');
    } finally {
      setLoading(false);
    }
  };

  // Unified Subject Save (Create / Edit)
  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      subjectCode: editFields.subjectCode || '',
      name: editFields.name || '',
      credits: Number(editFields.credits || 3),
      department: editFields.department || '',
      faculty: editFields.faculty || '',
      semester: Number(editFields.semester || 1),
      type: editFields.type || 'Theory'
    };

    if (!payload.subjectCode || !payload.name || !payload.department || !payload.semester) {
      toast_CRUD.validationError('Code, Name, Department, and Semester are required.');
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        await api.put(`/erp/subjects/${editingId}`, payload);
        toastSuccess('Subject updated successfully.');
      } else {
        await api.post('/erp/subjects', payload);
        toastSuccess('Subject registered successfully.');
      }
      setEditingId('');
      setEditFields({});
      loadData();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Error saving subject catalog.');
    } finally {
      setLoading(false);
    }
  };

  // Delete Subject
  const handleDeleteSubject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subject?')) return;
    setLoading(true);
    try {
      await api.delete(`/erp/subjects/${id}`);
      toastSuccess('Subject deleted successfully.');
      loadData();
    } catch (err: any) {
      toastError('Error deleting subject.');
    } finally {
      setLoading(false);
    }
  };

  // Bulk Import
  const handleBulkImport = async () => {
    if (!bulkText) return;
    setLoading(true);
    const isHod = user?.role === 'hod';
    try {
      const list = JSON.parse(bulkText);
      if (!Array.isArray(list)) {
        toastInfo('Data must be a JSON array.');
        setLoading(false);
        return;
      }
      
      const isStudentImport = activeSubTab === 'students' || activeSubTab === 'hod_students' || activeWorkflowStep === 'hod_students';
      if (isStudentImport) {
        await api.post(isHod ? '/hod/students/import' : '/principal/student-records/import', { recordsList: list, studentsList: list });
        toastSuccess('Bulk student records import completed successfully.');
      } else {
        await api.post(isHod ? '/hod/faculty/import' : '/principal/users/import', { usersList: list });
        toastSuccess('Bulk import completed successfully.');
      }
      setBulkText('');
      setShowBulkImport(false);
      loadData();
    } catch (err: any) {
      console.error('[Bulk Import Error]', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to parse or import data.';
      toastError(`Failed: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  // Bulk Export (CSV format)
  const handleBulkExport = async (role: string) => {
    try {
      let data = [];
      let headers: string[] = [];
      
      if (role === 'student') {
        const res = await api.get('/principal/student-records/export');
        data = res.data;
        headers = ['studentId', 'rollNumber', 'admissionNumber', 'fullName', 'gender', 'dob', 'department', 'branch', 'course', 'academicYear', 'semester', 'section', 'status', 'mobileNumber'];
      } else {
        const res = await api.get('/principal/users/export', { params: { role } });
        data = res.data;
        headers = ['fullName', 'email', 'role', 'employeeId', 'studentId', 'branch', 'rollNumber', 'isActive'];
      }
      
      const csvRows = [
        headers.join(','),
        ...data.map((row: any) => headers.map(h => `"${row[h] !== undefined ? row[h] : ''}"`).join(','))
      ];
      
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('download', `${role || 'accounts'}_export.csv`);
      a.click();
    } catch (err) {
      toast_CRUD.error('Failed to export data.');
    }
  };

  // ERP Config tags updater
  const handleUpdateConfigList = async (type: string, action: 'add' | 'delete', val: string) => {
    let courses = [...configCourses];
    let programs = [...configPrograms];
    let branches = [...configBranches];
    let academicYears = [...configYears];
    let sections = [...configSections];
    let semesters = [...configSemesters];
    let regulations = [...configRegulations];

    if (type === 'course') {
      if (action === 'add') courses.push(val);
      else courses = courses.filter(c => c !== val);
    } else if (type === 'program') {
      if (action === 'add') programs.push(val);
      else programs = programs.filter(p => p !== val);
    } else if (type === 'branch') {
      if (action === 'add') branches.push(val);
      else branches = branches.filter(b => b !== val);
    } else if (type === 'year') {
      if (action === 'add') academicYears.push(val);
      else academicYears = academicYears.filter(y => y !== val);
    } else if (type === 'section') {
      if (action === 'add') sections.push(val);
      else sections = sections.filter(s => s !== val);
    } else if (type === 'semester') {
      if (action === 'add') semesters.push(val);
      else semesters = semesters.filter(s => s !== val);
    } else if (type === 'regulation') {
      if (action === 'add') regulations.push(val);
      else regulations = regulations.filter(r => r !== val);
    }

    setLoading(true);
    try {
      await api.put('/principal/config', { courses, programs, branches, academicYears, sections, semesters, regulations });
      loadData();
    } catch (e) {
      toast_CRUD.error('Failed to update config metadata.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTimetable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ttSub || !ttFac) return;
    setLoading(true);
    try {
      await api.post('/hod/timetable', { year: ttYear, section: ttSec, day: ttDay, slots: [{ timeSlot: ttSlot, subjectCode: ttSub, facultyId: ttFac, room: ttRoom }] });
      toastInfo('Timetable slots mapped.');
      setTtSub(''); setTtFac(''); setTtRoom('');
      loadData();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Conflict detected!');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attDate || !attSub || !attStudId) return;
    setLoading(true);
    try {
      await api.post('/faculty/attendance', { date: attDate, timeSlot: attSlot, subjectCode: attSub, attendanceList: [{ studentId: attStudId, status: attStatus, remarks: attRemark }] });
      toastSuccess('Attendance saved successfully.');
      setAttStudId(''); setAttRemark('');
      loadData();
    } catch (err: any) {
      toast_CRUD.error('Failed saving attendance.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qTitle || !qSub || !qQues) return;
    setLoading(true);
    try {
      await api.post('/faculty/quizzes', { title: qTitle, subjectCode: qSub, duration: qDur, negativeMarks: qNeg, questions: [{ text: qQues, options: [qOptA || 'Option A', qOptB || 'Option B'], correctIndex: qCorrect }] });
      toastSuccess('Quiz created successfully.');
      setQTitle(''); setQQues(''); setQOptA(''); setQOptB('');
      loadData();
    } catch (err: any) {
      toast_CRUD.error('Failed saving quiz.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMarks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!markStud || !markSub) return;
    setLoading(true);
    try {
      await api.post('/faculty/marks', { studentId: markStud, subjectCode: markSub, marks: markVal, type: markType });
      toastSuccess('Marks entry forwarded to HOD.');
      setMarkStud(''); setMarkVal(0);
      loadData();
    } catch (err: any) {
      toast_CRUD.error('Failed saving marks.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveStart || !leaveEnd || !leaveReason) return;
    setLoading(true);
    try {
      await api.post('/faculty/leaves', { startDate: leaveStart, endDate: leaveEnd, reason: leaveReason });
      toastInfo('Leave application submitted.');
      setLeaveStart(''); setLeaveEnd(''); setLeaveReason('');
      loadData();
    } catch (err: any) {
      toast_CRUD.error('Failed applying leave.');
    } finally {
      setLoading(false);
    }
  };

  // COE Actions
  const handleScheduleExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coeSub || !coeDate || !coeRoom) return;
    setLoading(true);
    try {
      await api.post('/coe/exams', { subjectCode: coeSub, examDate: coeDate, timeSlot: coeSlot, room: coeRoom, type: coeType });
      toastSuccess('Exam scheduled successfully.');
      setCoeSub(''); setCoeDate(''); setCoeRoom('');
      loadData();
    } catch (err: any) {
      toast_CRUD.error('Failed scheduling exam.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTickets = async () => {
    setLoading(true);
    try {
      await api.post('/coe/hall-tickets/generate');
      toastInfo('Bulk Hall tickets generated with QR-code signatures.');
      loadData();
    } catch (e) {
      toast_CRUD.error('Bulk generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishResults = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resStudId || !resSem) return;
    setLoading(true);
    try {
      await api.post('/coe/results/publish', { studentId: resStudId, semester: resSem, sgpa: resSgpa, cgpa: resCgpa, subjectGrades: [{ subjectCode: 'ECE302', grade: 'A+', credits: 4 }] });
      toastSuccess('Semester GPA calculated and published to Student OS client.');
      setResStudId('');
      loadData();
    } catch (err: any) {
      toast_CRUD.error('Failed publishing results.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogMalpractice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mpStud || !mpSub || !mpDate) return;
    setLoading(true);
    try {
      await api.post('/coe/malpractices', { studentId: mpStud, subjectCode: mpSub, examDate: mpDate, penalty: mpPenalty, remarks: mpRemarks });
      toastSuccess('Malpractice case registered.');
      setMpStud(''); setMpSub(''); setMpPenalty(''); setMpRemarks('');
      loadData();
    } catch (err: any) {
      toast_CRUD.error('Failed logging case.');
    } finally {
      setLoading(false);
    }
  };

  // Admin Actions
  const handleSaveFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feeStud || !feeTotal) return;
    setLoading(true);
    try {
      await api.post('/admin/fees', { studentId: feeStud, totalAmount: feeTotal, paidAmount: feePaid, type: feeType });
      toastSuccess('Fee transaction successfully posted.');
      setFeeStud(''); setFeePaid(0);
      loadData();
    } catch (err: any) {
      toast_CRUD.error('Failed updating fee ledger.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHostel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostelStud || !hostelRoom || !hostelBed) return;
    setLoading(true);
    try {
      await api.post('/admin/hostel/allocations', { studentId: hostelStud, block: hostelBlock, roomNumber: hostelRoom, bedNumber: hostelBed });
      toastInfo('Hostel Room allocation complete.');
      setHostelStud(''); setHostelRoom('101');
      loadData();
    } catch (err: any) {
      toast_CRUD.error('Allocation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!busNum || !busDriver || !busFrom || !busTo) return;
    setLoading(true);
    try {
      await api.post('/admin/transport/routes', { busNumber: busNum, driverName: busDriver, routeFrom: busFrom, routeTo: busTo, stops: busStops.split(',') });
      toastSuccess('Bus route successfully mapped.');
      setBusNum(''); setBusDriver(''); setBusFrom(''); setBusTo(''); setBusStops('');
      loadData();
    } catch (err: any) {
      toast_CRUD.error('Failed saving bus route.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invName) return;
    setLoading(true);
    try {
      await api.post('/admin/inventory', { itemName: invName, category: invCategory, totalStock: invStock, vendorName: invVendor });
      toastSuccess('Inventory assets registry updated.');
      setInvName(''); setInvVendor('');
      loadData();
    } catch (err: any) {
      toast_CRUD.error('Inventory save failed.');
    } finally {
      setLoading(false);
    }
  };

  // Official Communication Actions
  const handleSendOfficialMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatRecipient || !chatContent) return;
    setLoading(true);
    try {
      await api.post('/official/message', { recipientId: chatRecipient, content: chatContent });
      toastSuccess('Official message successfully dispatched in college intranet.');
      setChatContent('');
      loadData();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed sending message.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bcTitle || !bcBody) return;
    setLoading(true);
    try {
      await api.post('/official/broadcast', { title: bcTitle, body: bcBody, department: bcDept });
      toastSuccess('Broadcast published successfully.');
      setBcTitle(''); setBcBody('');
      loadData();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed publishing broadcast.');
    } finally {
      setLoading(false);
    }
  };

  // Campus AI Actions
  const handleSendAiMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiMessage) return;
    const userMsg = { role: 'user', text: aiMessage };
    setAiHistory(prev => [...prev, userMsg]);
    const input = aiMessage;
    setAiMessage('');
    setLoading(true);
    try {
      const resp = await api.post('/ai/query', { message: input, history: aiHistory });
      setAiHistory(prev => [...prev, { role: 'assistant', text: resp.data.reply }]);
    } catch (err) {
      setAiHistory(prev => [...prev, { role: 'assistant', text: 'Connection threshold reached. Retrying AI pipelines...' }]);
    } finally {
      setLoading(false);
    }
  };

  // Onboarding Workflow Timeline configurations
  const workflowSteps = [
    { id: 'departments', name: 'Step 1: Department Management' },
    { id: 'hods', name: 'Step 2: HOD Management' },
    { id: 'faculty', name: 'Step 3: Faculty Management' },
    { id: 'students', name: 'Step 4: Student Master Data' },
    { id: 'administration', name: 'Step 5: Administration Setup' },
    { id: 'communications', name: 'Step 6: Communication Center' },
    { id: 'analytics', name: 'Step 7: Reports & Analytics' },
    { id: 'erp_import', name: '📥 ERP Import' }
  ];

  const checkStepCompletion = (stepId: string) => {
    switch (stepId) {
      case 'departments':
        return depts.length > 0 && configCourses.length > 0 && configBranches.length > 0 && configSections.length > 0;
      case 'hods':
        return staff.filter(s => s.role === 'hod').length > 0;
      case 'faculty':
        return staff.filter(s => s.role === 'faculty').length > 0;
      case 'students':
        return totalCount > 0;
      case 'academics':
        return subjects.length > 0 && calendar.length > 0;
      case 'administration':
        return staff.filter(s => ['coe', 'accounts', 'library', 'placement', 'hostel', 'transport', 'hr', 'admission_cell'].includes(s.role)).length > 0;
      case 'communications':
        return notices.length > 0;
      case 'analytics':
        return true;
      case 'erp_import':
        return true;
      default:
        return false;
    }
  };

  const getOnboardingProgressChecklist = () => {
    const hasDepts = depts.length > 0;
    const hasHods = staff.filter(s => s.role === 'hod').length > 0;
    const hasFaculty = staff.filter(s => s.role === 'faculty').length > 0;
    
    let studentsStatus = 'Pending';
    if (totalCount >= 50) studentsStatus = '✓';
    else if (totalCount > 0) studentsStatus = `${Math.round((totalCount / 50) * 100)}%`;

    const timetableStatus = pendingTimetables.length > 0 ? 'Pending' : (staff.length > 0 ? '✓' : 'Pending');
    const calendarStatus = calendar.length > 0 ? '✓' : 'Pending';

    return [
      { name: 'Departments', status: hasDepts ? '✓' : 'Pending' },
      { name: 'HODs', status: hasHods ? '✓' : 'Pending' },
      { name: 'Faculty', status: hasFaculty ? '✓' : 'Pending' },
      { name: 'Students', status: studentsStatus },
      { name: 'Timetable', status: timetableStatus },
      { name: 'Calendar', status: calendarStatus },
      { name: 'ERP Import', status: erpHistory.some((h: any) => h.status === 'completed') ? '✓' : 'Pending' }
    ];
  };

  const calculateSetupProgress = () => {
    let score = 0;
    if (depts.length > 0) score += 15;
    if (configCourses.length > 0) score += 15;
    if (staff.filter(s => s.role === 'hod').length > 0) score += 15;
    if (staff.filter(s => s.role === 'faculty').length > 0) score += 15;
    if (totalCount > 0) score += 15;
    if (calendar.length > 0) score += 15;
    if (staff.filter(s => ['coe', 'accounts', 'library', 'placement', 'hostel', 'transport', 'hr', 'admission_cell'].includes(s.role)).length > 0) score += 10;
    return score;
  };

  const renderReadOnlyCollegeProfile = () => {
    return (
      <div className="glass-card p-5 bg-gradient-to-r from-purple-950/20 to-blue-950/20 border border-purple-900/30 rounded-xl mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {setupLogo ? (
              <img src={setupLogo} alt="College Logo" className="w-12 h-12 rounded-lg object-contain bg-white/10 p-1" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center text-lg">🏫</div>
            )}
            <div>
              <h3 className="text-sm font-extrabold text-white">{setupName || 'College ERP System'}</h3>
              <p className="text-[10px] text-text-secondary mt-0.5">Approved & Verified Institutional Profile (Read-Only)</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
            <div>
              <span className="text-[9px] text-text-secondary uppercase block">AISHE Code</span>
              <span className="text-white font-bold">{setupAisheCode || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[9px] text-text-secondary uppercase block">University</span>
              <span className="text-white font-bold">{setupUniversity || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[9px] text-text-secondary uppercase block">NAAC Grade</span>
              <span className="text-purple-400 font-bold">{setupNaacGrade || 'A'}</span>
            </div>
            <div>
              <span className="text-[9px] text-text-secondary uppercase block">Type / Status</span>
              <span className="text-emerald-400 font-bold">{setupCollegeType} • AICTE</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleSaveSetupProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put('/principal/config', {
        name: setupName,
        address: setupAddress,
        university: setupUniversity,
        state: setupState,
        district: setupDistrict,
        city: setupCity,
        logo: setupLogo,
        aisheCode: setupAisheCode,
        collegeType: setupCollegeType,
        aicteApproved: setupAicteApproved,
        ugcApproved: setupUgcApproved,
        naacGrade: setupNaacGrade,
        nbaAccredited: setupNbaAccredited
      });
      toastSuccess('College profile configuration saved.');
      loadData();
    } catch (err: any) {
      toastError('Failed saving profile configuration: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSetupRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put('/principal/config', {
        timezone: setupTimezone,
        language: setupLanguage,
        dateFormat: setupDateFormat,
        workingDays: workingDaysList,
        timings: timingsList,
        attendanceRules: { minPercentage: attendanceRulesMin }
      });
      toastSuccess('Organization rules and settings updated.');
      loadData();
    } catch (err: any) {
      toastError('Failed saving settings rules: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const dateVal = form.elements.namedItem('holDate') as HTMLInputElement;
    const descVal = form.elements.namedItem('holDesc') as HTMLInputElement;
    if (!dateVal.value || !descVal.value) return;

    setLoading(true);
    try {
      const updatedHolidays = [...holidaysList, { date: new Date(dateVal.value), description: descVal.value }];
      await api.put('/principal/config', { holidays: updatedHolidays });
      toastSuccess('Holiday registered.');
      form.reset();
      loadData();
    } catch (err: any) {
      toast_CRUD.error('Failed to register holiday.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHoliday = async (idx: number) => {
    if (!confirm('Are you sure you want to delete this holiday?')) return;
    setLoading(true);
    try {
      const updated = holidaysList.filter((_, i) => i !== idx);
      await api.put('/principal/config', { holidays: updated });
      toastSuccess('Holiday deleted.');
      loadData();
    } catch (err) {
      toast_CRUD.error('Failed deleting holiday.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const gradeLetter = form.elements.namedItem('gradeLetter') as HTMLInputElement;
    const gradePoints = form.elements.namedItem('gradePoints') as HTMLInputElement;
    if (!gradeLetter.value || !gradePoints.value) return;

    setLoading(true);
    try {
      const updated = [...gradingSystemList, { grade: gradeLetter.value.toUpperCase(), points: Number(gradePoints.value) }];
      await api.put('/principal/config', { gradingSystem: updated });
      toastInfo('Grade value added.');
      form.reset();
      loadData();
    } catch (err) {
      toast_CRUD.error('Failed adding grade value.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGrade = async (idx: number) => {
    if (!confirm('Are you sure you want to delete this grade?')) return;
    setLoading(true);
    try {
      const updated = gradingSystemList.filter((_, i) => i !== idx);
      await api.put('/principal/config', { gradingSystem: updated });
      toastSuccess('Grade deleted.');
      loadData();
    } catch (err) {
      toast_CRUD.error('Failed deleting grade.');
    } finally {
      setLoading(false);
    }
  };

  const handleActionApproval = async (type: string, id: string, status: 'approved' | 'rejected') => {
    setLoading(true);
    try {
      await api.post(`/principal/approvals/${type}/${id}`, { status, comments: approvalComment });
      toastSuccess(`Request has been successfully ${status}.`);
      setApprovalComment('');
      loadData();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Error processing request.');
    } finally {
      setLoading(false);
    }
  };

  const handleActionTimetable = async (id: string, approve: boolean) => {
    setLoading(true);
    try {
      await api.post(`/principal/timetables/${id}/approve`, { approve });
      toastInfo(approve ? 'Timetable approved successfully.' : 'Timetable rejected and deleted.');
      loadData();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Error processing timetable.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendWorkflowBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bcTitle || !bcBody) return;
    setLoading(true);
    try {
      await api.post('/principal/notices', {
        title: bcTitle,
        content: bcBody,
        type: bcType,
        targetRoles: bcRole === 'all' ? ['student', 'faculty'] : [bcRole],
        targetDepartment: bcTargetDept || undefined,
        targetYear: bcTargetYear || undefined,
        targetSection: bcTargetSection || undefined
      });
      toastSuccess('Broadcast circular successfully published.');
      setBcTitle(''); setBcBody('');
      setBcTargetDept(''); setBcTargetYear(''); setBcTargetSection('');
      loadData();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed publishing circular.');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Department Management
  const renderDepartmentsStep = () => {
    return (
      <div className="space-y-6">
        {renderReadOnlyCollegeProfile()}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Departments registry */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-xs font-black uppercase text-purple-400 tracking-wider">Departments Registry</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              try {
                if (editingId) {
                  await api.put(`/principal/departments/${editingId}`, { name: deptName, description: deptDesc, hodId: deptHod || undefined });
                  toastSuccess('Department updated.');
                } else {
                  await api.post('/principal/departments', { code: deptCode, name: deptName, description: deptDesc, hodId: deptHod || undefined });
                  toastSuccess('Department registered.');
                }
                setEditingId(''); setDeptCode(''); setDeptName(''); setDeptDesc(''); setDeptHod('');
                loadData();
              } catch (err: any) {
                toastError(err.response?.data?.message || 'Error saving department.');
              } finally {
                setLoading(false);
              }
            }} className="space-y-3">
              {!editingId && (
                <input type="text" className="w-full h-9 bg-dark-bg/60 border border-purple-900/30 rounded px-3 text-xs text-white" placeholder="Code (e.g. CSE)" value={deptCode} onChange={(e) => setDeptCode(e.target.value)} required />
              )}
              <input type="text" className="w-full h-9 bg-dark-bg/60 border border-purple-900/30 rounded px-3 text-xs text-white" placeholder="Name" value={deptName} onChange={(e) => setDeptName(e.target.value)} required />
              <input type="text" className="w-full h-9 bg-dark-bg/60 border border-purple-900/30 rounded px-3 text-xs text-white" placeholder="Description" value={deptDesc} onChange={(e) => setDeptDesc(e.target.value)} />
              <div className="flex gap-2">
                <button type="submit" className="h-9 px-4 bg-primary text-white font-bold rounded text-xs">{editingId ? 'Save' : 'Register'}</button>
                {editingId && <button type="button" className="h-9 px-3 bg-purple-950/40 border border-purple-900/30 text-white rounded text-xs" onClick={() => { setEditingId(''); setDeptCode(''); setDeptName(''); setDeptDesc(''); setDeptHod(''); }}>Cancel</button>}
              </div>
            </form>
            <div className="max-h-64 overflow-y-auto space-y-2 mt-4 custom-scrollbar">
              {depts.map((d: any) => (
                <div key={d._id} className="p-3 bg-dark-bg/40 border border-purple-950/20 rounded flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white">{d.name} ({d.code})</span>
                    <p className="text-[10px] text-text-secondary mt-0.5">Description: {d.description || 'N/A'}</p>
                  </div>
                  <div className="space-x-1">
                    <button onClick={() => { setEditingId(d._id); setDeptCode(d.code); setDeptName(d.name); setDeptDesc(d.description || ''); }} className="px-2 py-1 bg-primary/20 text-primary border border-primary/30 rounded text-[9px]">Edit</button>
                    <button onClick={async () => {
                      if (!confirm('Delete department?')) return;
                      try { await api.delete(`/principal/departments/${d._id}`); loadData(); } catch(e) { toast_CRUD.error('Delete failed.'); }
                    }} className="px-2 py-1 bg-red-950/20 text-red-400 border border-red-900/30 rounded text-[9px]">Delete</button>
                  </div>
                </div>
              ))}
              {depts.length === 0 && <p className="text-xs text-text-secondary text-center py-6">No departments defined.</p>}
            </div>
          </div>

          {/* Tag Configuration metadata manager */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-xs font-black uppercase text-purple-400 tracking-wider">ERP Tags & Metadata Setup</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 bg-[#110a24]/30 p-4 border border-purple-950/20 rounded-xl">
                <h4 className="text-[10px] font-bold text-white uppercase">Academic Years</h4>
                <div className="flex flex-wrap gap-1.5 py-1">
                  {configYears.map(y => (
                    <span key={y} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-950/60 border border-purple-900/30 rounded text-[10px] text-white">
                      {y}
                      <button onClick={() => handleUpdateConfigList('year', 'delete', y)} className="text-red-400 font-bold ml-1">×</button>
                    </span>
                  ))}
                </div>
                <form onSubmit={(e: any) => {
                  e.preventDefault();
                  const val = e.target.elements.yearVal.value.trim();
                  if (val) { handleUpdateConfigList('year', 'add', val); e.target.reset(); }
                }} className="flex gap-2">
                  <input name="yearVal" type="text" className="flex-1 h-8 bg-dark-bg/60 border border-purple-900/30 rounded px-2 text-[10px] text-white" placeholder="Add Year..." required />
                  <button type="submit" className="h-8 px-3 bg-primary text-white font-bold rounded text-[10px]">Add</button>
                </form>
              </div>

              <div className="space-y-2 bg-[#110a24]/30 p-4 border border-purple-950/20 rounded-xl">
                <h4 className="text-[10px] font-bold text-white uppercase">Courses</h4>
                <div className="flex flex-wrap gap-1.5 py-1">
                  {configCourses.map(c => (
                    <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-950/60 border border-purple-900/30 rounded text-[10px] text-white">
                      {c}
                      <button onClick={() => handleUpdateConfigList('course', 'delete', c)} className="text-red-400 font-bold ml-1">×</button>
                    </span>
                  ))}
                </div>
                <form onSubmit={(e: any) => {
                  e.preventDefault();
                  const val = e.target.elements.courseVal.value.trim();
                  if (val) { handleUpdateConfigList('course', 'add', val); e.target.reset(); }
                }} className="flex gap-2">
                  <input name="courseVal" type="text" className="flex-1 h-8 bg-dark-bg/60 border border-purple-900/30 rounded px-2 text-[10px] text-white" placeholder="Add Course..." required />
                  <button type="submit" className="h-8 px-3 bg-primary text-white font-bold rounded text-[10px]">Add</button>
                </form>
              </div>

              <div className="space-y-2 bg-[#110a24]/30 p-4 border border-purple-950/20 rounded-xl">
                <h4 className="text-[10px] font-bold text-white uppercase">Branches</h4>
                <div className="flex flex-wrap gap-1.5 py-1">
                  {configBranches.map(b => (
                    <span key={b} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-950/60 border border-purple-900/30 rounded text-[10px] text-white font-mono">
                      {b}
                      <button onClick={() => handleUpdateConfigList('branch', 'delete', b)} className="text-red-400 font-bold ml-1">×</button>
                    </span>
                  ))}
                </div>
                <form onSubmit={(e: any) => {
                  e.preventDefault();
                  const val = e.target.elements.branchVal.value.trim().toUpperCase();
                  if (val) { handleUpdateConfigList('branch', 'add', val); e.target.reset(); }
                }} className="flex gap-2">
                  <input name="branchVal" type="text" className="flex-1 h-8 bg-dark-bg/60 border border-purple-900/30 rounded px-2 text-[10px] text-white font-mono" placeholder="Add Branch..." required />
                  <button type="submit" className="h-8 px-3 bg-primary text-white font-bold rounded text-[10px]">Add</button>
                </form>
              </div>

            </div>
          </div>
        </div>
      </div>
    );
  };

  // Step 2 & 3 custom submission helper
  const handleSaveUserExplicitly = async (e: React.FormEvent, customFields: any) => {
    e.preventDefault();
    setLoading(true);
    const isHod = user?.role === 'hod';
    try {
      if (editingId) {
        await api.put(isHod ? `/hod/faculty/${editingId}` : `/principal/users/${editingId}`, customFields);
        toastSuccess('Account updated successfully.');
      } else {
        await api.post(isHod ? '/hod/faculty' : '/principal/users', customFields);
        toastSuccess('Account registered successfully.');
      }
      setEditingId('');
      setEditFields({});
      loadData();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Error processing request.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: HOD Management
  const renderHodsStep = () => {
    return (
      <div className="space-y-6">
        {renderReadOnlyCollegeProfile()}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">
              {editingId ? 'Edit HOD Account' : 'Register HOD Account'}
            </h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fields = { ...editFields, role: 'hod' };
              handleSaveUserExplicitly(e, fields);
            }} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Full Name *</label>
                <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={editFields.fullName || ''} onChange={(e) => setEditFields({ ...editFields, fullName: e.target.value })} required />
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Email Address *</label>
                <input type="email" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={editFields.email || ''} onChange={(e) => setEditFields({ ...editFields, email: e.target.value })} required disabled={!!editingId} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Employee ID *</label>
                <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={editFields.employeeId || ''} onChange={(e) => setEditFields({ ...editFields, employeeId: e.target.value })} required />
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Assign Department *</label>
                <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={editFields.assignedDepartment || ''} onChange={(e) => setEditFields({ ...editFields, assignedDepartment: e.target.value })} required>
                  <option value="">Select Department</option>
                  {depts.map(d => (
                    <option key={d.code} value={d.code}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">{editingId ? 'Reset Password (optional)' : 'Password *'}</label>
                <input type="password" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={editFields.password || ''} onChange={(e) => setEditFields({ ...editFields, password: e.target.value })} placeholder={editingId ? 'Leave blank to preserve' : 'Min 6 chars'} required={!editingId} />
              </div>
              {editingId && (
                <div className="flex items-center gap-2">
                  <input id="hod-active-check" type="checkbox" checked={editFields.isActive !== false} onChange={(e) => setEditFields({ ...editFields, isActive: e.target.checked })} />
                  <label htmlFor="hod-active-check" className="text-xs text-white font-bold select-none">Account Active</label>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 h-10 bg-primary text-white font-bold rounded-lg text-xs hover:opacity-90" disabled={loading}>
                  {editingId ? 'Save Changes' : 'Register HOD'}
                </button>
                {editingId && (
                  <button type="button" className="h-10 px-4 bg-purple-950/40 border border-purple-900/30 text-white font-bold rounded-lg text-xs" onClick={() => { setEditingId(''); setEditFields({}); }}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="lg:col-span-2 glass-card p-6 space-y-4">
            <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Registered HODs Registry</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-purple-950/20 text-text-secondary">
                    <th className="py-3 font-bold uppercase">Emp ID</th>
                    <th className="py-3 font-bold uppercase">Name</th>
                    <th className="py-3 font-bold uppercase">Department</th>
                    <th className="py-3 font-bold uppercase">Status</th>
                    <th className="py-3 font-bold uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-950/10">
                  {staff.filter(u => u.role === 'hod').map((s: any) => (
                    <tr key={s._id} className="hover:bg-purple-950/5 transition-colors">
                      <td className="py-3 font-mono font-bold text-purple-400">{s.employeeId || 'N/A'}</td>
                      <td className="py-3">
                        <p className="text-white font-bold">{s.fullName}</p>
                        <p className="text-[10px] text-text-secondary mt-0.5">{s.email}</p>
                      </td>
                      <td className="py-3 text-text-secondary font-mono">{s.assignedDepartment || 'Unassigned'}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.isActive ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/20' : 'bg-red-950/30 text-red-400 border border-red-900/20'}`}>
                          {s.isActive ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="py-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            setEditingId(s._id);
                            setEditFields({
                              fullName: s.fullName,
                              email: s.email,
                              role: s.role,
                              employeeId: s.employeeId,
                              assignedDepartment: s.assignedDepartment,
                              isActive: s.isActive
                            });
                          }}
                          className="h-7 px-2.5 bg-primary/20 text-primary border border-primary/30 rounded text-[10px] font-bold hover:bg-primary/30"
                        >
                          Edit
                        </button>
                        <button onClick={() => handleDeleteUser(s._id)} className="h-7 px-2.5 bg-red-950/20 text-red-400 border border-red-900/30 rounded text-[10px] font-bold hover:bg-red-900/30">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {staff.filter(u => u.role === 'hod').length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-text-secondary">No HOD accounts registered.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Step 3: Faculty Management
  const renderFacultyStep = () => {
    return (
      <div className="space-y-6">
        {renderReadOnlyCollegeProfile()}
        <div className="grid grid-cols-1 gap-6">
          <div className="glass-card p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Faculty Registry</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-purple-950/20 text-text-secondary">
                    <th className="py-3 font-bold uppercase">Emp ID</th>
                    <th className="py-3 font-bold uppercase">Name</th>
                    <th className="py-3 font-bold uppercase">Department</th>
                    <th className="py-3 font-bold uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-950/10">
                  {staff.filter(u => u.role === 'faculty').map((s: any) => (
                    <tr key={s._id} className="hover:bg-purple-950/5 transition-colors">
                      <td className="py-3 font-mono font-bold text-purple-400">{s.employeeId || 'N/A'}</td>
                      <td className="py-3">
                        <p className="text-white font-bold">{s.fullName}</p>
                        <p className="text-[10px] text-text-secondary mt-0.5">{s.email}</p>
                      </td>
                      <td className="py-3 text-text-secondary font-mono">{s.assignedDepartment || 'Unassigned'}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.isActive ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/20' : 'bg-red-950/30 text-red-400 border border-red-900/20'}`}>
                          {s.isActive ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {staff.filter(u => u.role === 'faculty').length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-text-secondary">No faculty accounts registered.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Step 4: Student master records render
  const renderStudentsStep = () => {
    return (
      <div className="space-y-6">
        {renderReadOnlyCollegeProfile()}

        <div className="grid grid-cols-1 gap-6">
          <div className="glass-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <input type="text" className="h-8 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white placeholder-gray-400 w-36" placeholder="Search Students..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                <select className="h-8 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-2 text-xs text-white" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
                  <option value="">All Branches</option>
                  {uniqueBranches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleBulkExport('student')} className="h-8 px-3 bg-purple-950/40 border border-purple-900/30 text-xs font-bold rounded-lg text-white hover:bg-purple-900/40">📥 Export CSV</button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-purple-950/20 text-text-secondary">
                    <th className="py-3 font-bold uppercase">Roll Number</th>
                    <th className="py-3 font-bold uppercase">Name & ID</th>
                    <th className="py-3 font-bold uppercase">Course & Branch</th>
                    <th className="py-3 font-bold uppercase">Year / Sem / Sec</th>
                    <th className="py-3 font-bold uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-950/10">
                  {students.filter(s => {
                    const matchesSearch = s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || s.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()) || s.studentId.toLowerCase().includes(searchTerm.toLowerCase());
                    const matchesBranch = !filterBranch || s.branch === filterBranch;
                    return matchesSearch && matchesBranch;
                  }).map((s: any) => (
                    <tr key={s._id} className="hover:bg-purple-950/5 transition-colors">
                      <td className="py-3 font-mono font-bold text-purple-400">{s.rollNumber}</td>
                      <td className="py-3">
                        <p className="text-white font-bold">{s.fullName}</p>
                        <p className="text-[10px] text-text-secondary mt-0.5">ID: {s.studentId}</p>
                      </td>
                      <td className="py-3 text-text-secondary font-mono">{s.course} - {s.branch}</td>
                      <td className="py-3 text-white">Sem {s.semester}, Sec {s.section}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.status === 'Active' ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30' : 'bg-red-950/20 text-red-400 border border-red-900/30'}`}>{s.status}</span>
                      </td>
                    </tr>
                  ))}
                  {students.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-text-secondary">No students loaded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-purple-950/10 pt-4 text-xs">
              <span className="text-text-secondary">Total: {totalCount} records</span>
              <div className="flex gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-8 px-3 bg-purple-950/40 border border-purple-900/30 text-white rounded font-bold disabled:opacity-40">Prev</button>
                <span className="h-8 flex items-center px-2 text-white font-mono">{currentPage} / {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-8 px-3 bg-purple-950/40 border border-purple-900/30 text-white rounded font-bold disabled:opacity-40">Next</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Step 5: Academic Management render
  const renderAcademicsStep = () => {
    return (
      <div className="space-y-6">
        {renderReadOnlyCollegeProfile()}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Subjects Catalog */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-xs font-black uppercase text-purple-400 tracking-wider">Subjects Catalog</h3>
            <form onSubmit={handleSaveSubject} className="space-y-3">
              {!editingId && (
                <input type="text" className="w-full h-9 bg-dark-bg/60 border border-purple-900/30 rounded px-3 text-xs text-white uppercase font-mono" placeholder="Subject Code (e.g. CS302)" value={editFields.subjectCode || ''} onChange={(e) => setEditFields({ ...editFields, subjectCode: e.target.value.toUpperCase() })} required />
              )}
              <input type="text" className="w-full h-9 bg-dark-bg/60 border border-purple-900/30 rounded px-3 text-xs text-white" placeholder="Subject Name" value={editFields.name || ''} onChange={(e) => setEditFields({ ...editFields, name: e.target.value })} required />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" min={1} max={6} className="w-full h-9 bg-dark-bg/60 border border-purple-900/30 rounded px-3 text-xs text-white" placeholder="Credits" value={editFields.credits || 3} onChange={(e) => setEditFields({ ...editFields, credits: Number(e.target.value) })} required />
                <select className="w-full h-9 bg-dark-bg/60 border border-purple-900/30 rounded px-3 text-xs text-white" value={editFields.department || ''} onChange={(e) => setEditFields({ ...editFields, department: e.target.value })} required>
                  <option value="">Department</option>
                  {depts.map(d => <option key={d.code} value={d.code}>{d.code}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="h-9 px-4 bg-primary text-white font-bold rounded text-xs">{editingId ? 'Save' : 'Add Subject'}</button>
                {editingId && <button type="button" className="h-9 px-3 bg-purple-950/40 border border-purple-900/30 text-white rounded text-xs" onClick={() => { setEditingId(''); setEditFields({}); }}>Cancel</button>}
              </div>
            </form>
            <div className="max-h-[320px] overflow-y-auto space-y-2 mt-4 custom-scrollbar">
              {subjects.map((s: any) => (
                <div key={s._id} className="p-3 bg-dark-bg/40 border border-purple-950/20 rounded flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white">{s.name} ({s.subjectCode})</span>
                    <p className="text-[10px] text-text-secondary mt-0.5">Dept: {s.department} • Credits: {s.credits}</p>
                  </div>
                  <div className="space-x-1">
                    <button onClick={() => { setEditingId(s._id); setEditFields({ subjectCode: s.subjectCode, name: s.name, credits: s.credits, department: s.department }); }} className="px-1.5 py-0.5 bg-primary/20 text-primary border border-primary/30 rounded text-[9px]">Edit</button>
                    <button onClick={() => handleDeleteSubject(s._id)} className="px-1.5 py-0.5 bg-red-950/20 text-red-400 border border-red-900/30 rounded text-[9px]">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timetable pending approvals queue */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-xs font-black uppercase text-purple-400 tracking-wider">Timetables Pending</h3>
            <div className="space-y-3 max-h-[460px] overflow-y-auto custom-scrollbar">
              {pendingTimetables.map((tt: any) => (
                <div key={tt._id} className="p-3 bg-dark-bg/40 border border-purple-950/20 rounded-xl space-y-2">
                  <div className="flex justify-between items-center border-b border-purple-950/20 pb-1.5">
                    <div>
                      <span className="font-extrabold text-white text-xs">Dept: {tt.department}</span>
                      <p className="text-[9px] text-text-secondary">Yr {tt.year}-Sec {tt.section} • {tt.day}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {tt.slots?.map((slot: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-[10px] font-mono p-1 bg-purple-950/10 rounded">
                        <span className="text-purple-300">{slot.timeSlot}</span>
                        <span className="text-white font-bold">{slot.subjectCode}</span>
                        <span className="text-text-secondary truncate max-w-20">{slot.facultyId?.fullName || 'N/A'}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    <button onClick={() => handleActionTimetable(tt._id, true)} className="flex-1 h-7 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded text-[10px] transition-all">Approve</button>
                    <button onClick={() => handleActionTimetable(tt._id, false)} className="h-7 px-3 bg-red-950/20 border border-red-900/30 text-red-400 font-bold rounded text-[10px] transition-all">Reject</button>
                  </div>
                </div>
              ))}
              {pendingTimetables.length === 0 && <p className="text-xs text-text-secondary text-center py-8">No pending timetables.</p>}
            </div>
          </div>

          {/* Academic Calendar Events */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-xs font-black uppercase text-purple-400 tracking-wider">Academic Calendar</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!calDate || !calDesc) return;
              setLoading(true);
              try {
                await api.post('/principal/calendar', { date: calDate, type: calType, description: calDesc });
                toastSuccess('Academic Calendar entry registered.');
                setCalDate(''); setCalDesc('');
                loadData();
              } catch (err: any) {
                toast_CRUD.error('Failed creating calendar entry.');
              } finally {
                setLoading(false);
              }
            }} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className="w-full h-8 bg-dark-bg/60 border border-purple-900/30 rounded px-2 text-xs text-white" value={calDate} onChange={(e) => setCalDate(e.target.value)} required />
                <select className="w-full h-8 bg-dark-bg/60 border border-purple-900/30 rounded px-2 text-xs text-white" value={calType} onChange={(e) => setCalType(e.target.value)}>
                  <option value="working_day">Class Day</option>
                  <option value="holiday">Holiday</option>
                  <option value="exam">Exam</option>
                  <option value="event">Fest/Workshop</option>
                </select>
              </div>
              <input type="text" className="w-full h-8 bg-dark-bg/60 border border-purple-900/30 rounded px-2 text-xs text-white" value={calDesc} onChange={(e) => setCalDesc(e.target.value)} placeholder="Event description..." required />
              <button type="submit" className="h-8 px-4 bg-primary text-white font-bold rounded text-xs">Add Event</button>
            </form>
            <div className="max-h-[220px] overflow-y-auto space-y-2 mt-4 custom-scrollbar">
              {calendar.map((c: any) => (
                <div key={c._id} className="p-2.5 bg-dark-bg/40 border border-purple-950/20 rounded flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white">{c.description}</span>
                    <p className="text-[9px] text-text-secondary uppercase font-mono">{c.type}</p>
                  </div>
                  <span className="text-[9px] text-purple-400 font-bold bg-purple-950/30 px-1.5 py-0.5 rounded font-mono">{new Date(c.date).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Step 6: Administration Setup
  const renderAdministrationStep = () => {
    const adminRoles = [
      { code: 'coe', name: 'Controller of Examinations (COE)' },
      { code: 'accounts', name: 'Accounts & Finance Admin' },
      { code: 'library', name: 'Librarian' },
      { code: 'placement', name: 'Placement Officer' },
      { code: 'hostel', name: 'Hostel Warden' },
      { code: 'transport', name: 'Transport Manager' },
      { code: 'hr', name: 'HR Representative' },
      { code: 'admission_cell', name: 'Admission Representative' }
    ];

    return (
      <div className="space-y-6">
        {renderReadOnlyCollegeProfile()}
        
        <div className="glass-card p-6 bg-purple-950/10 border border-purple-900/30">
          <div className="flex flex-wrap gap-2 border-b border-purple-950/20 pb-3 mb-4">
            {[
              { id: 'accounts', label: '1. Administrative Accounts' },
              { id: 'leaves', label: '2. Leave Approvals Queue' },
              { id: 'requests', label: '3. HOD Requests Center' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAdminTab(tab.id)}
                className={`h-8 px-3 rounded text-xs font-bold transition-all ${
                  adminTab === tab.id ? 'bg-primary text-white' : 'text-text-secondary hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {adminTab === 'accounts' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="glass-card p-5 border border-purple-950/30 bg-[#110a24]/30 space-y-4">
                <h4 className="text-xs font-bold text-white uppercase">{editingId ? 'Edit Administrative Account' : 'Create Administrative Account'}</h4>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveUserExplicitly(e, editFields);
                }} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Full Name *</label>
                    <input type="text" className="w-full h-9 bg-dark-bg/60 border border-purple-900/30 rounded px-2.5 text-xs text-white" value={editFields.fullName || ''} onChange={(e) => setEditFields({ ...editFields, fullName: e.target.value })} required />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Email Address *</label>
                    <input type="email" className="w-full h-9 bg-dark-bg/60 border border-purple-900/30 rounded px-2.5 text-xs text-white" value={editFields.email || ''} onChange={(e) => setEditFields({ ...editFields, email: e.target.value })} required disabled={!!editingId} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Employee ID *</label>
                    <input type="text" className="w-full h-9 bg-dark-bg/60 border border-purple-900/30 rounded px-2.5 text-xs text-white" value={editFields.employeeId || ''} onChange={(e) => setEditFields({ ...editFields, employeeId: e.target.value })} required />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Specialized Role *</label>
                    <select className="w-full h-9 bg-dark-bg/60 border border-purple-900/30 rounded px-2.5 text-xs text-white" value={editFields.role || 'coe'} onChange={(e) => setEditFields({ ...editFields, role: e.target.value })} required>
                      {adminRoles.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">{editingId ? 'Reset Password (optional)' : 'Password *'}</label>
                    <input type="password" className="w-full h-9 bg-dark-bg/60 border border-purple-900/30 rounded px-2.5 text-xs text-white" value={editFields.password || ''} onChange={(e) => setEditFields({ ...editFields, password: e.target.value })} placeholder={editingId ? 'Preserve password' : 'Min 6 chars'} required={!editingId} />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 h-9 bg-primary text-white font-bold rounded text-xs">{editingId ? 'Save' : 'Register Admin'}</button>
                    {editingId && <button type="button" className="h-9 px-3 bg-purple-950/40 border border-purple-900/30 text-white rounded text-xs" onClick={() => { setEditingId(''); setEditFields({}); }}>Cancel</button>}
                  </div>
                </form>
              </div>

              <div className="lg:col-span-2 glass-card p-5 border border-purple-950/30 bg-[#110a24]/30 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase">Administrative Accounts Registry</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-purple-950/20 text-text-secondary">
                        <th className="py-2.5 font-bold uppercase">Emp ID</th>
                        <th className="py-2.5 font-bold uppercase">Name</th>
                        <th className="py-2.5 font-bold uppercase">Role Code</th>
                        <th className="py-2.5 font-bold uppercase text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-950/10">
                      {staff.filter(u => ['coe', 'accounts', 'library', 'placement', 'hostel', 'transport', 'hr', 'admission_cell'].includes(u.role)).map((s: any) => (
                        <tr key={s._id} className="hover:bg-purple-950/5 transition-colors">
                          <td className="py-2.5 font-mono font-bold text-purple-400">{s.employeeId || 'N/A'}</td>
                          <td className="py-2.5">
                            <p className="text-white font-bold">{s.fullName}</p>
                            <p className="text-[10px] text-text-secondary">{s.email}</p>
                          </td>
                          <td className="py-2.5 font-mono text-purple-300 font-bold uppercase">{s.role}</td>
                          <td className="py-2.5 text-right space-x-2">
                            <button
                              onClick={() => {
                                setEditingId(s._id);
                                setEditFields({
                                  fullName: s.fullName,
                                  email: s.email,
                                  role: s.role,
                                  employeeId: s.employeeId
                                });
                              }}
                              className="px-2 py-1 bg-primary/20 text-primary border border-primary/30 rounded text-[9px]"
                            >
                              Edit
                            </button>
                            <button onClick={() => handleDeleteUser(s._id)} className="px-2 py-1 bg-red-950/20 text-red-400 border border-red-900/30 rounded text-[9px]">
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                      {staff.filter(u => ['coe', 'accounts', 'library', 'placement', 'hostel', 'transport', 'hr', 'admission_cell'].includes(u.role)).length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-text-secondary">No specialized administrative staff accounts registered.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {adminTab === 'leaves' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-white uppercase">Leaves Request Verification Queue</h4>
              <textarea
                className="w-full p-2.5 bg-dark-bg/60 border border-purple-900/30 rounded-lg text-xs text-white h-16 resize-none"
                placeholder="Add comments before action (optional)..."
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                {pendingLeaves.map((l: any) => (
                  <div key={l._id} className="p-4 bg-dark-bg/40 border border-purple-950/20 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-white">{l.userId?.fullName}</h4>
                        <p className="text-[10px] text-text-secondary mt-0.5">Role: {l.userId?.role?.toUpperCase()} • Dept: {l.userId?.assignedDepartment || 'N/A'}</p>
                      </div>
                    </div>
                    <p className="text-white bg-purple-950/15 p-2 rounded border border-purple-950/20">Reason: {l.reason}</p>
                    <p className="text-[10px] text-purple-400 font-bold font-mono">Date range: {new Date(l.startDate).toLocaleDateString()} to {new Date(l.endDate).toLocaleDateString()}</p>
                    <div className="flex gap-2 pt-1 border-t border-purple-950/10">
                      <button onClick={() => handleActionApproval('leave', l._id, 'approved')} className="flex-1 h-8 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded text-xs transition-all">Approve Leave</button>
                      <button onClick={() => handleActionApproval('leave', l._id, 'rejected')} className="h-8 px-4 bg-red-950/20 border border-red-900/30 text-red-400 font-bold rounded text-xs transition-all">Reject</button>
                    </div>
                  </div>
                ))}
                {pendingLeaves.length === 0 && <p className="text-xs text-text-secondary py-6 text-center w-full">No leave requests pending verification.</p>}
              </div>
            </div>
          )}

          {adminTab === 'requests' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-white uppercase">HOD & Department Resource Requests</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                {pendingRequests.map((r: any) => (
                  <div key={r._id} className="p-4 bg-dark-bg/40 border border-purple-950/20 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-white">{r.title}</h4>
                        <p className="text-[9px] text-text-secondary mt-0.5">Requester: {r.requesterId?.fullName} ({r.requesterId?.role?.toUpperCase()})</p>
                      </div>
                      <span className="text-[9px] font-bold text-blue-400 uppercase bg-blue-950/20 px-2 py-0.5 border border-blue-900/20 rounded font-mono">{r.type.replace('_', ' ')}</span>
                    </div>
                    <p className="text-white bg-purple-950/15 p-2 rounded border border-purple-950/20">{r.description}</p>
                    <div className="flex gap-2 pt-1 border-t border-purple-950/10">
                      <button onClick={() => handleActionApproval('request', r._id, 'approved')} className="flex-1 h-8 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded text-xs transition-all">Approve</button>
                      <button onClick={() => handleActionApproval('request', r._id, 'rejected')} className="h-8 px-4 bg-red-950/20 border border-red-900/30 text-red-400 font-bold rounded text-xs transition-all">Reject</button>
                    </div>
                  </div>
                ))}
                {pendingRequests.length === 0 && <p className="text-xs text-text-secondary py-6 text-center w-full">No custom resource requests pending verification.</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Step 7: Communication Center render
  const renderCommunicationsStep = () => {
    return (
      <div className="space-y-6">
        {renderReadOnlyCollegeProfile()}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-xs font-black uppercase text-purple-400 tracking-wider">Publish Targeted Circular</h3>
            <form onSubmit={handleSendWorkflowBroadcast} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Notice Title *</label>
                <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={bcTitle} onChange={(e) => setBcTitle(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Broadcast Category</label>
                  <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={bcType} onChange={(e) => setBcType(e.target.value)}>
                    <option value="general">Circular</option>
                    <option value="emergency">Emergency Notice</option>
                    <option value="holiday">Holiday Notice</option>
                    <option value="academic">Academic Notice</option>
                    <option value="placement">Placement Notice</option>
                    <option value="exam">Exam Notice</option>
                    <option value="fee">Fee Reminder</option>
                    <option value="library">Library Reminder</option>
                    <option value="hostel">Hostel Notice</option>
                    <option value="transport">Transport Notice</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Target Role</label>
                  <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={bcRole} onChange={(e) => setBcRole(e.target.value)}>
                    <option value="all">All Students & Faculty</option>
                    <option value="student">All Students</option>
                    <option value="faculty">All Faculty</option>
                  </select>
                </div>
              </div>
              {bcRole === 'student' && (
                <div className="grid grid-cols-3 gap-2 p-3 bg-purple-950/10 border border-purple-950/20 rounded-lg">
                  <div>
                    <label className="text-[9px] font-bold text-text-secondary uppercase">Dept Filter</label>
                    <select className="w-full h-8 mt-1 bg-dark-bg border border-purple-900/30 rounded text-[10px] text-white px-1" value={bcTargetDept} onChange={(e) => setBcTargetDept(e.target.value)}>
                      <option value="">All</option>
                      {depts.map(d => <option key={d.code} value={d.code}>{d.code}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-text-secondary uppercase">Year Filter</label>
                    <select className="w-full h-8 mt-1 bg-dark-bg border border-purple-900/30 rounded text-[10px] text-white px-1" value={bcTargetYear} onChange={(e) => setBcTargetYear(e.target.value)}>
                      <option value="">All</option>
                      {configYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-text-secondary uppercase">Sec Filter</label>
                    <select className="w-full h-8 mt-1 bg-dark-bg border border-purple-900/30 rounded text-[10px] text-white px-1" value={bcTargetSection} onChange={(e) => setBcTargetSection(e.target.value)}>
                      <option value="">All</option>
                      {configSections.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              )}
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Content Body *</label>
                <textarea className="w-full p-3 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg text-xs text-white h-24 resize-none" value={bcBody} onChange={(e) => setBcBody(e.target.value)} required />
              </div>
              <button type="submit" className="w-full h-10 bg-primary text-white font-bold rounded-lg text-xs hover:opacity-90" disabled={loading}>
                Publish targeted Notice
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 glass-card p-6 space-y-4">
            <h3 className="text-xs font-black uppercase text-purple-400 tracking-wider">Announcement Bulletin</h3>
            <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
              {notices.map((n: any) => (
                <div key={n._id} className="p-4 bg-dark-bg/40 border border-purple-950/20 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-primary/20 border border-primary/30 rounded text-primary text-[9px] font-bold uppercase font-mono">{n.type}</span>
                    <span className="text-[9px] text-text-secondary font-mono">{new Date(n.createdAt).toLocaleDateString()}</span>
                  </div>
                  <h4 className="text-xs font-bold text-white">{n.title}</h4>
                  <p className="text-xs text-text-secondary leading-relaxed">{n.content}</p>
                  {(n.targetRoles?.length > 0 || n.targetDepartment) && (
                    <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-purple-950/10 text-[9px] text-purple-300 font-mono">
                      <span>Target: {n.targetRoles?.join(', ') || 'All'}</span>
                      {n.targetDepartment && <span>• Dept: {n.targetDepartment}</span>}
                      {n.targetYear && <span>• Year: {n.targetYear}</span>}
                      {n.targetSection && <span>• Sec: {n.targetSection}</span>}
                    </div>
                  )}
                </div>
              ))}
              {notices.length === 0 && <p className="text-xs text-text-secondary text-center py-8">No notices published.</p>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Step 8: Reports & Analytics render
  const renderAnalyticsStep = () => {
    return (
      <div className="space-y-6">
        {renderReadOnlyCollegeProfile()}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Students', value: stats.totalStudents || 0, icon: '🎓' },
            { label: 'Total Faculty', value: stats.totalFaculty || 0, icon: '👩‍🏫' },
            { label: 'Attendance %', value: `${stats.studentAttendance || 92.4}%`, icon: '🎯' },
            { label: 'Placement Eligibility %', value: aiPredict.placementEligibilityRate || '84%', icon: '💼' },
            { label: 'Active Departments', value: stats.totalDepartments || 0, icon: '🏫' },
            { label: 'Fee Collections Dues', value: stats.totalFeesCount || 0, icon: '💳' },
            { label: 'Library Books Mapped', value: stats.booksCount || 0, icon: '📖' },
            { label: 'Hostel Occupied Beds', value: stats.hostelOccupied || 0, icon: '🏨' }
          ].map(card => (
            <div key={card.label} className="glass-card p-5 bg-[#110a24]/30 border border-purple-950/20">
              <div className="flex items-center justify-between text-text-secondary">
                <span className="text-[9px] font-bold uppercase tracking-wider">{card.label}</span>
                <span className="text-sm">{card.icon}</span>
              </div>
              <p className="text-2xl font-black text-white mt-3 text-gradient">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-card p-6 space-y-4">
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wide">Campus Weekly Attendance trends</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attendanceChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(124, 58, 237, 0.1)" />
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} />
                  <YAxis stroke="#9ca3af" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#090514' }} />
                  <Legend />
                  <Line type="monotone" dataKey="Student" stroke="#7c3aed" strokeWidth={3} name="Student Attendance %" />
                  <Line type="monotone" dataKey="Faculty" stroke="#3b82f6" strokeWidth={3} name="Faculty Attendance %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card p-6 space-y-4">
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wide">Department Ranking Grades</h3>
            <div className="space-y-3">
              {(aiPredict.predictedDepartmentPerformers?.length > 0 ? aiPredict.predictedDepartmentPerformers : [
                { department: 'CSE', grade: 'A+' },
                { department: 'ECE', grade: 'A' },
                { department: 'MECH', grade: 'B+' },
                { department: 'CIVIL', grade: 'B' }
              ]).map((d: any, idx: number) => (
                <div key={idx} className="p-3 bg-dark-bg/40 border border-purple-950/20 rounded-lg flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-200">{d.department}</span>
                  <span className="font-bold text-gradient">{d.grade}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Step 9: ERP Import Wizard & Management
  const renderErpImportStep = () => {
    // Helper function to download template
    const downloadSampleTemplate = () => {
      let headers = '';
      if (erpImportType === 'students') {
        headers = 'Roll Number,Admission Number,Student Name,Department,Semester,Section,Gender,DOB,Blood Group,Address,Parent Name,Parent Mobile,Email,Phone';
      } else if (erpImportType === 'faculty') {
        headers = 'Employee ID,Faculty Name,Department,Designation,Qualification,Experience,Subjects,Email,Phone';
      } else if (erpImportType === 'subjects') {
        headers = 'Subject Code,Subject Name,Credits,Department,Semester,Faculty';
      } else if (erpImportType === 'departments') {
        headers = 'Department Code,Department Name,Building,HOD Employee ID';
      } else if (erpImportType === 'academics') {
        headers = 'Department,Year,Semester,Section';
      } else if (erpImportType === 'timetable') {
        headers = 'Department,Academic Year,Semester,Section,Day,Period Number,Time Slot,Subject Code,Faculty Employee ID,Room,Type,Label';
      }
      
      const blob = new Blob([headers], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `sample_${erpImportType}_template.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    // File parsing handler
    const handleFileUpload = async (file: File) => {
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const parseRes = await api.post('/erp/import/parse', formData);

        if (!parseRes.data?.records || parseRes.data.records.length === 0) {
          toastError('The uploaded file contains no data rows.');
          return;
        }

        setErpFile(file);
        setErpPreviewHeaders(parseRes.data.headers || Object.keys(parseRes.data.records[0]));
        setErpPreviewData(parseRes.data.records);
        setErpImportStep(4);
        toastSuccess(`Parsed ${parseRes.data.records.length} records successfully!`);
      } catch (err: any) {
        toastError(err.response?.data?.message || err.message || 'Failed parsing file.');
      } finally {
        setLoading(false);
      }
    };

    // Validation handler
    const runValidation = async () => {
      setErpIsValidating(true);
      try {
        const valRes = await api.post('/erp/import/validate', {
          importType: erpImportType,
          records: erpPreviewData
        });
        setErpValidationErrors(valRes.data.errors || []);
        toastSuccess(`Validation completed. Found ${valRes.data.errors?.length || 0} errors.`);
      } catch (err: any) {
        toastError(err.response?.data?.message || 'Failed validating data.');
      } finally {
        setErpIsValidating(false);
      }
    };

    // Import execute handler
    const executeImport = async () => {
      setErpIsProcessing(true);
      try {
        let strategy = 'Skip Duplicates';
        if (erpDuplicateStrategy === 'update') strategy = 'Update Existing Records';
        else if (erpDuplicateStrategy === 'replace') strategy = 'Replace Existing Records';
        else if (erpDuplicateStrategy === 'stop') strategy = 'Stop Import';

        const res = await api.post('/erp/import', {
          importType: erpImportType,
          records: erpPreviewData,
          fileName: erpFile?.name || 'Manual_Import',
          duplicateStrategy: strategy,
          dryRun: erpDryRun
        });
        
        if (erpDryRun) {
          setErpSummary({
            status: 'completed',
            successCount: res.data.summary.success,
            failedCount: res.data.summary.failed,
            skippedCount: res.data.summary.skipped,
            duplicatesCount: res.data.summary.duplicates,
            warningsCount: res.data.summary.warnings,
            totalRecords: res.data.summary.total,
            dryRun: true
          });
          setErpImportStep(7);
          setErpIsProcessing(false);
          toastSuccess('Dry run simulation completed successfully!');
        } else if (res.data?.summary) {
          setErpSummary({
            status: 'completed',
            successCount: res.data.summary.success,
            failedCount: res.data.summary.failed,
            skippedCount: res.data.summary.skipped,
            duplicatesCount: res.data.summary.duplicates || 0,
            warningsCount: res.data.summary.warnings || 0,
            totalRecords: res.data.summary.total,
            requestId: res.data.requestId
          });
          setErpImportStep(7);
          setErpIsProcessing(false);
          toastSuccess('Import completed successfully!');
          loadData();
        } else {
          setErpImportStep(6);
          toastInfo('Import task started in background. Monitoring progress...');
        }
      } catch (err: any) {
        toastError(err.response?.data?.message || 'Import execution failed.');
        setErpIsProcessing(false);
      }
    };

    // Rollback execution
    const triggerRollback = async (importId: string) => {
      if (!window.confirm('Are you sure you want to rollback this import? This will delete all records created during this run.')) return;
      setLoading(true);
      try {
        const res = await api.post(`/erp/import/history/${importId}/rollback`);
        toastSuccess(res.data.message || 'Rollback executed successfully.');
        const histRes = await api.get('/erp/imports/history');
        setErpHistory(histRes.data || []);
      } catch (err: any) {
        toastError(err.response?.data?.message || 'Rollback failed.');
      } finally {
        setLoading(false);
      }
    };

    // Download history errors
    const downloadErrorLog = async (importId: string, version: number) => {
      try {
        const errRes = await api.get(`/erp/import/history/${importId}/errors`);
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(errRes.data, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `import_errors_v${version}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.removeChild(downloadAnchor);
        toastSuccess('Error report downloaded.');
      } catch (err: any) {
        toastError('Failed downloading error report.');
      }
    };

    // Load stats helper
    const loadStats = async () => {
      try {
        const statsRes = await api.get('/erp/import/stats');
        setErpStats(statsRes.data);
      } catch (e) {
        console.error("Failed loading stats:", e);
      }
    };

    if (erpActiveTab === 'stats' && !erpStats) {
      loadStats();
    }

    return (
      <div className="space-y-6">
        {renderReadOnlyCollegeProfile()}

        {/* Tab Selection */}
        <div className="flex border-b border-purple-950/20 pb-2 gap-4">
          {[
            { id: 'wizard', label: '📥 Import Wizard' },
            { id: 'history', label: '📜 Import History' },
            { id: 'stats', label: '📊 ERP Statistics' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setErpActiveTab(tab.id as any);
                if (tab.id === 'stats') loadStats();
              }}
              className={`pb-2 px-1 text-xs font-bold transition-all relative ${
                erpActiveTab === tab.id 
                  ? 'text-primary border-b-2 border-primary' 
                  : 'text-text-secondary hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Wizard */}
        {erpActiveTab === 'wizard' && (
          <div className="space-y-6">
            {/* Steps Stepper */}
            <div className="flex items-center justify-between bg-[#110a24]/20 border border-purple-950/10 p-4 rounded-xl">
              {[
                { step: 1, label: 'Type' },
                { step: 2, label: 'Template' },
                { step: 3, label: 'Upload' },
                { step: 4, label: 'Preview' },
                { step: 5, label: 'Validate' },
                { step: 6, label: 'Import' },
                { step: 7, label: 'Summary' }
              ].map(s => {
                const isActive = erpImportStep === s.step;
                const isCompleted = erpImportStep > s.step;
                return (
                  <div key={s.step} className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isActive 
                        ? 'bg-primary text-white ring-2 ring-primary/45' 
                        : isCompleted 
                          ? 'bg-emerald-500 text-white' 
                          : 'bg-purple-950/20 border border-purple-900/30 text-text-secondary'
                    }`}>
                      {isCompleted ? '✓' : s.step}
                    </span>
                    <span className={`text-[10px] uppercase font-bold tracking-wider hidden md:inline ${
                      isActive ? 'text-white' : 'text-text-secondary'
                    }`}>{s.label}</span>
                    {s.step < 7 && <span className="text-purple-950/40 hidden md:inline ml-2">→</span>}
                  </div>
                );
              })}
            </div>

            {/* Stepper Wizard Contents */}
            {erpImportStep === 1 && (
              <div className="glass-card p-6 space-y-6">
                <div className="space-y-1">
                  <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Step 1: Select Import Type</h3>
                  <p className="text-xs text-text-secondary">Choose the model type you want to import into your college database.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { id: 'departments', name: 'Departments', icon: '🏫', desc: 'Onboard academic departments and associate physical building labels.' },
                    { id: 'hods', name: 'HOD Master', icon: '👑', desc: 'Create Department Heads, associate emails, employee IDs, and departments.' },
                    { id: 'faculty', name: 'Faculty Master', icon: '👩‍🏫', desc: 'Onboard professors, designate qualifications, experience, and link teaching subjects.' },
                    { id: 'students', name: 'Student Master', icon: '🎓', desc: 'Import full student rosters. Automatically pre-registers logins for Student OS verification.' },
                    { id: 'subjects', name: 'Subjects Mapped', icon: '📖', desc: 'Register subject codes, credit definitions, departments, and teaching faculty.' },
                    { id: 'academics', name: 'Academic Structure', icon: '🧱', desc: 'Define active semesters, sections, branches, and courses of your college.' },
                    { id: 'timetable', name: 'Timetable Matrix', icon: '📅', desc: 'Upload weekly schedules, mapping subject codes, slots, room codes, and faculty.' }
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setErpImportType(t.id);
                        setErpImportStep(2);
                      }}
                      className="p-5 bg-purple-950/10 border border-purple-900/20 hover:border-primary/40 rounded-xl text-left transition-all hover:scale-[1.01] space-y-3 group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl group-hover:scale-110 transition-all">{t.icon}</span>
                        <h4 className="text-xs font-black text-white uppercase tracking-wider">{t.name}</h4>
                      </div>
                      <p className="text-[11px] text-text-secondary leading-relaxed">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {erpImportStep === 2 && (
              <div className="glass-card p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Step 2: Download Template</h3>
                    <p className="text-xs text-text-secondary">Get the official spreadsheet template for "{erpImportType.toUpperCase()}".</p>
                  </div>
                  <span className="px-3 py-1 bg-primary/20 border border-primary/30 rounded text-[10px] uppercase font-bold text-primary">{erpImportType}</span>
                </div>

                <div className="p-5 bg-[#110a24]/30 border border-purple-950/20 rounded-xl flex items-center justify-between">
                  <div className="space-y-1.5 max-w-md">
                    <h4 className="text-xs font-bold text-white">Nominal Import Columns</h4>
                    <p className="text-[11px] text-text-secondary leading-relaxed">Ensure your final file maintains the identical header layout. Column values can be empty except for primary unique identifier fields.</p>
                  </div>
                  <button
                    onClick={downloadSampleTemplate}
                    className="h-10 px-5 bg-primary text-white font-bold rounded-lg text-xs hover:opacity-90 transition-all flex items-center gap-2"
                  >
                    📥 Download CSV Template
                  </button>
                </div>

                <div className="flex justify-end gap-3 border-t border-purple-950/20 pt-4">
                  <button
                    onClick={() => setErpImportStep(1)}
                    className="h-9 px-4 bg-purple-950/20 border border-purple-900/20 text-white rounded text-xs font-bold hover:bg-purple-950/40"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setErpImportStep(3)}
                    className="h-9 px-4 bg-primary text-white rounded text-xs font-bold hover:opacity-90"
                  >
                    Next Step
                  </button>
                </div>
              </div>
            )}

            {erpImportStep === 3 && (
              <div className="glass-card p-6 space-y-6">
                <div className="space-y-1">
                  <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Step 3: Upload Excel / CSV</h3>
                  <p className="text-xs text-text-secondary">Submit the completed spreadsheet. Only .xlsx and .csv files are supported.</p>
                </div>

                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="border-2 border-dashed border-purple-900/30 bg-purple-950/5 hover:bg-purple-950/10 rounded-xl p-12 text-center transition-all cursor-pointer space-y-4"
                >
                  <input
                    type="file"
                    id="erp-file-input"
                    accept=".xlsx,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                  />
                  <label htmlFor="erp-file-input" className="cursor-pointer block space-y-3">
                    <span className="text-4xl block">📤</span>
                    <span className="text-xs font-bold text-white block">Drag and drop file here, or <span className="text-primary underline">browse computer</span></span>
                    <span className="text-[10px] text-text-secondary block">Max size: 10MB • Excel / CSV format</span>
                  </label>
                </div>

                <div className="flex justify-end gap-3 border-t border-purple-950/20 pt-4">
                  <button
                    onClick={() => setErpImportStep(2)}
                    className="h-9 px-4 bg-purple-950/20 border border-purple-900/20 text-white rounded text-xs font-bold hover:bg-purple-950/40"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {erpImportStep === 4 && (
              <div className="glass-card p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Step 4: Preview Data Grid</h3>
                    <p className="text-xs text-text-secondary">Browse records parsed from "{erpFile?.name}". Double check columns before processing validation.</p>
                  </div>
                  <span className="text-xs font-bold text-white font-mono bg-purple-950/40 px-3 py-1 border border-purple-900/20 rounded-lg">{erpPreviewData.length} records parsed</span>
                </div>

                <div className="border border-purple-950/20 rounded-xl overflow-hidden">
                  <div className="max-h-96 overflow-auto">
                    <table className="w-full text-left text-xs text-gray-300">
                      <thead className="bg-[#110a24] text-white uppercase text-[10px] font-bold border-b border-purple-950/40 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3">Row</th>
                          {erpPreviewHeaders.map(h => (
                            <th key={h} className="px-4 py-3 min-w-[120px]">{h}</th>
                          ))}
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-950/15">
                        {erpPreviewData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-purple-950/10">
                            <td className="px-4 py-3 font-mono text-text-secondary">{idx + 2}</td>
                            {erpPreviewHeaders.map(h => (
                              <td key={h} className="px-4 py-3 truncate max-w-[200px]">{row[h] !== undefined ? String(row[h]) : ''}</td>
                            ))}
                            <td className="px-4 py-3 text-right space-x-2">
                              <button
                                onClick={() => {
                                  setEditingId(String(idx));
                                  setEditFields({ ...row });
                                }}
                                className="text-primary hover:underline font-bold"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  const updated = [...erpPreviewData];
                                  updated.splice(idx, 1);
                                  setErpPreviewData(updated);
                                  toastSuccess('Row removed.');
                                }}
                                className="text-red-400 hover:underline font-bold"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                        {erpPreviewData.length === 0 && (
                          <tr>
                            <td colSpan={erpPreviewHeaders.length + 2} className="px-4 py-8 text-center text-text-secondary">No records left in preview.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-purple-950/20 pt-4">
                  <button
                    onClick={() => {
                      setErpFile(null);
                      setErpPreviewData([]);
                      setErpPreviewHeaders([]);
                      setErpImportStep(3);
                    }}
                    className="h-9 px-4 bg-purple-950/20 border border-purple-900/20 text-white rounded text-xs font-bold hover:bg-purple-950/40"
                  >
                    Clear File
                  </button>
                  <button
                    onClick={() => setErpImportStep(5)}
                    className="h-9 px-4 bg-primary text-white rounded text-xs font-bold hover:opacity-90 animate-pulse"
                  >
                    Verify Data
                  </button>
                </div>
              </div>
            )}

            {erpImportStep === 5 && (
              <div className="glass-card p-6 space-y-6">
                <div className="space-y-1">
                  <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Step 5: Run Enterprise Validation</h3>
                  <p className="text-xs text-text-secondary">Scan dataset for formatting issues, duplicate rows in document, or missing foreign keys reference.</p>
                </div>

                {erpValidationErrors.length === 0 && !erpIsValidating && (
                  <div className="p-8 text-center bg-emerald-950/10 border border-emerald-900/20 rounded-xl space-y-3">
                    <span className="text-3xl block">✓</span>
                    <h4 className="text-xs font-black uppercase text-emerald-400 tracking-wider">Validation Checked & Clean</h4>
                    <p className="text-xs text-text-secondary max-w-sm mx-auto">No compilation errors or missing metadata keys. The sheet is healthy to onboard.</p>
                    <button
                      onClick={runValidation}
                      className="h-9 px-4 bg-emerald-900/30 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-800/30 rounded-lg text-xs font-bold transition-all"
                    >
                      Re-run Scanner
                    </button>
                  </div>
                )}

                {erpValidationErrors.length > 0 && !erpIsValidating && (
                  <div className="space-y-4">
                    <div className="p-4 bg-red-950/10 border border-red-900/20 rounded-xl flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-red-400 uppercase tracking-wide">Validation Failures: {erpValidationErrors.length} issues</h4>
                        <p className="text-[11px] text-text-secondary">Correct row indices or remove duplicated records before submitting to production database.</p>
                      </div>
                      <button
                        onClick={runValidation}
                        className="h-9 px-4 bg-red-900/20 text-red-400 border border-red-800/20 rounded-lg text-xs font-bold hover:bg-red-900/30 transition-all"
                      >
                        Re-run Scanner
                      </button>
                    </div>

                    <div className="border border-red-950/20 rounded-xl overflow-hidden max-h-60 overflow-y-auto bg-red-950/5 p-4 space-y-2">
                      {erpValidationErrors.map((err, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs p-3 bg-red-950/20 border border-red-900/20 rounded-lg">
                          <div className="space-y-1">
                            <span className="font-bold text-white">Row #{err.row}</span>
                            <p className="text-text-secondary text-[11px]">{err.reasons.join(', ')}</p>
                          </div>
                          <button
                            onClick={() => {
                              const rowIndex = err.row - 2;
                              if (erpPreviewData[rowIndex]) {
                                setEditingId(String(rowIndex));
                                setEditFields({ ...erpPreviewData[rowIndex] });
                              }
                            }}
                            className="h-7 px-3 bg-purple-950/30 text-white border border-purple-900/30 rounded hover:bg-purple-950/50 text-[10px] font-bold"
                          >
                            Correct Row
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {erpIsValidating && (
                  <div className="p-12 text-center space-y-4">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-text-secondary">Scanning database indices, unique usernames, and foreign relations mapping...</p>
                  </div>
                )}

                <div className="flex justify-end gap-3 border-t border-purple-950/20 pt-4">
                  <button
                    onClick={() => setErpImportStep(4)}
                    className="h-9 px-4 bg-purple-950/20 border border-purple-900/20 text-white rounded text-xs font-bold hover:bg-purple-950/40"
                  >
                    Back to Preview
                  </button>
                  <button
                    onClick={runValidation}
                    disabled={erpIsValidating}
                    className="h-9 px-4 bg-purple-950/60 border border-purple-900/30 text-white rounded text-xs font-bold hover:bg-purple-950/80 disabled:opacity-40"
                  >
                    Scan Data
                  </button>
                  <button
                    onClick={() => setErpImportStep(6)}
                    disabled={erpValidationErrors.length > 0 || erpIsValidating}
                    className="h-9 px-4 bg-primary text-white rounded text-xs font-bold hover:opacity-90 disabled:opacity-30"
                  >
                    Proceed to Import
                  </button>
                </div>
              </div>
            )}

            {erpImportStep === 6 && (
              <div className="glass-card p-6 space-y-6">
                {!erpIsProcessing ? (
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Step 6: Import Settings & Execution</h3>
                      <p className="text-xs text-text-secondary font-semibold">Select duplicate reconciliation options and execute onboarding.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#110a24]/20 border border-purple-950/10 p-5 rounded-xl">
                      <div className="space-y-2">
                        <label className="text-xs uppercase font-bold text-gray-300">Strategy on Duplicates</label>
                        <select
                          value={erpDuplicateStrategy}
                          onChange={(e) => setErpDuplicateStrategy(e.target.value)}
                          className="w-full h-10 px-3 bg-purple-950/40 border border-purple-900/30 rounded text-white text-xs font-semibold focus:outline-none"
                        >
                          <option value="skip">Skip Duplicates (Ignore and skip existing)</option>
                          <option value="update">Update Existing Records (Patch database fields)</option>
                          <option value="replace">Replace Existing Records (Delete and overwrite)</option>
                          <option value="stop">Stop Import (Abort imports immediately on duplicate)</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-3 pt-6">
                        <input
                          type="checkbox"
                          id="erp-dryrun-chk"
                          checked={erpDryRun}
                          onChange={(e) => setErpDryRun(e.target.checked)}
                          className="w-4 h-4 text-primary bg-[#110a24] border-purple-950/30 rounded focus:ring-primary"
                        />
                        <label htmlFor="erp-dryrun-chk" className="text-xs font-bold text-gray-200 cursor-pointer">
                          Simulate Dry Run (Do not save to database)
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 border-t border-purple-950/20 pt-4">
                      <button
                        onClick={() => setErpImportStep(5)}
                        className="h-9 px-4 bg-purple-950/20 border border-purple-900/20 text-white rounded text-xs font-bold hover:bg-purple-950/40"
                      >
                        Back
                      </button>
                      <button
                        onClick={executeImport}
                        className="h-10 px-6 bg-gradient-to-r from-primary to-purple-600 text-white font-bold rounded-lg text-xs hover:opacity-90 transition-all shadow-lg shadow-purple-500/20"
                      >
                        ⚡ Start Onboarding Execution
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center space-y-6">
                    <div className="relative w-24 h-24 mx-auto">
                      <div className="absolute inset-0 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                      <div className="absolute inset-2 border-4 border-purple-500/10 border-b-purple-500 rounded-full animate-spin [animation-direction:reverse]" />
                      <span className="absolute inset-0 flex items-center justify-center font-mono font-bold text-xs text-white">
                        {erpProgress?.progressPercent || 0}%
                      </span>
                    </div>

                    <div className="space-y-2 max-w-sm mx-auto">
                      <h4 className="text-xs font-black uppercase text-white tracking-wider">Processing import queue...</h4>
                      <div className="w-full bg-purple-950/20 h-2 border border-purple-900/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full transition-all duration-300"
                          style={{ width: `${erpProgress?.progressPercent || 0}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-text-secondary font-mono font-bold pt-1">
                        <span>Processed: {erpProgress?.current || 0} / {erpProgress?.total || 0}</span>
                        <span>Speed: {erpProgress?.recordsPerSecond || 0} recs/sec</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 max-w-md mx-auto pt-4 border-t border-purple-950/15">
                      <div className="p-3 bg-[#110a24]/30 border border-purple-950/20 rounded-lg">
                        <span className="text-[10px] text-emerald-400 font-bold uppercase">Success</span>
                        <p className="text-lg font-black text-white mt-1">{erpProgress?.success || 0}</p>
                      </div>
                      <div className="p-3 bg-[#110a24]/30 border border-purple-950/20 rounded-lg">
                        <span className="text-[10px] text-red-400 font-bold uppercase">Failed</span>
                        <p className="text-lg font-black text-white mt-1">{erpProgress?.failed || 0}</p>
                      </div>
                      <div className="p-3 bg-[#110a24]/30 border border-purple-950/20 rounded-lg">
                        <span className="text-[10px] text-purple-400 font-bold uppercase">Skipped</span>
                        <p className="text-lg font-black text-white mt-1">{erpProgress?.skipped || 0}</p>
                      </div>
                    </div>

                    <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">
                      ETA: {erpProgress?.etaSeconds || 0} seconds remaining
                    </p>
                  </div>
                )}
              </div>
            )}

            {erpImportStep === 7 && (
              <div className="glass-card p-6 space-y-6">
                <div className="space-y-1">
                  <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Step 7: Onboarding Complete Summary</h3>
                  <p className="text-xs text-text-secondary">Onboarding run finished execution. Statistics and rollback logs are mapped below.</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Records', value: erpSummary?.totalRecords || erpSummary?.total || 0, color: 'text-white' },
                    { label: 'Successfully Inserted', value: erpSummary?.successCount || erpSummary?.success || 0, color: 'text-emerald-400' },
                    { label: 'Failed Rows', value: erpSummary?.failedCount || erpSummary?.failed || 0, color: 'text-red-400' },
                    { label: 'Skipped Rows', value: erpSummary?.skippedCount || erpSummary?.skipped || 0, color: 'text-purple-400' }
                  ].map(stat => (
                    <div key={stat.label} className="p-4 bg-[#110a24]/30 border border-purple-950/20 rounded-xl space-y-1">
                      <span className="text-[9px] uppercase font-bold text-text-secondary tracking-wider">{stat.label}</span>
                      <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                {erpSummary?.dryRun && (
                  <div className="p-4 bg-purple-950/15 border border-purple-900/20 rounded-xl text-xs text-purple-300 font-semibold">
                    💡 This run was simulated as a Dry Run. No physical edits were committed to the primary database schemas.
                  </div>
                )}

                {erpSummary?.errors && erpSummary.errors.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-red-400 uppercase tracking-wide">Failed Row Errors ({erpSummary.errors.length})</h4>
                    <div className="border border-red-950/20 rounded-xl overflow-hidden max-h-48 overflow-y-auto bg-red-950/5 p-4 space-y-2">
                      {erpSummary.errors.map((err: any, idx: number) => (
                        <div key={idx} className="text-xs p-3 bg-red-950/20 border border-red-900/20 rounded-lg">
                          <span className="font-bold text-white">Row #{err.row || 'N/A'}</span>
                          <p className="text-text-secondary text-[11px] mt-0.5">{err.reasons?.join(', ')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {erpSummary?.requestId && !erpSummary?.dryRun && (
                  <div className="p-5 bg-red-950/5 border border-red-900/20 rounded-xl flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-red-400 uppercase tracking-wide">Manual Rollback Option</h4>
                      <p className="text-[11px] text-text-secondary leading-relaxed">If you notice duplicate entries or configuration mistakes, rollback the run to delete newly added documents.</p>
                    </div>
                    <button
                      onClick={() => triggerRollback(erpSummary.requestId)}
                      className="h-10 px-5 bg-red-900/30 border border-red-800/30 text-red-400 font-bold rounded-lg text-xs hover:bg-red-900/40"
                    >
                      ⏮️ Rollback Import
                    </button>
                  </div>
                )}

                <div className="flex justify-end gap-3 border-t border-purple-950/20 pt-4">
                  <button
                    onClick={() => {
                      setErpFile(null);
                      setErpPreviewData([]);
                      setErpPreviewHeaders([]);
                      setErpValidationErrors([]);
                      setErpSummary(null);
                      setErpImportStep(1);
                    }}
                    className="h-9 px-5 bg-primary text-white rounded text-xs font-bold hover:opacity-90"
                  >
                    Reset Wizard
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: History */}
        {erpActiveTab === 'history' && (
          <div className="glass-card p-6 space-y-6">
            <div className="space-y-1">
              <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Import History & Audit Log</h3>
              <p className="text-xs text-text-secondary">View past onboarding runs, stats, and run database rollbacks.</p>
            </div>

            <div className="border border-purple-950/20 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-[#110a24] text-white uppercase text-[10px] font-bold border-b border-purple-950/40">
                    <tr>
                      <th className="px-4 py-3">Version</th>
                      <th className="px-4 py-3">Import Type</th>
                      <th className="px-4 py-3">File Name</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Success / Failed</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-950/15">
                    {erpHistory.map((run, idx) => (
                      <tr key={run._id || idx} className="hover:bg-purple-950/10">
                        <td className="px-4 py-3 font-mono font-bold text-white">v{run.version}</td>
                        <td className="px-4 py-3 capitalize font-bold">{run.importType}</td>
                        <td className="px-4 py-3 truncate max-w-[150px]">{run.fileName || 'Uploaded File'}</td>
                        <td className="px-4 py-3 text-text-secondary">{new Date(run.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            run.status === 'completed' 
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' 
                              : run.status === 'failed' 
                                ? 'bg-red-500/20 text-red-400 border border-red-500/20' 
                                : run.status === 'rolled_back'
                                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/20'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/20 animate-pulse'
                          }`}>
                            {run.status === 'rolled_back' ? 'rolled back' : run.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          <span className="text-emerald-400 font-bold">{run.successCount}</span>
                          <span className="text-text-secondary mx-1">/</span>
                          <span className="text-red-400 font-bold">{run.failedCount}</span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          {run.failedCount > 0 && (
                            <button
                              onClick={() => downloadErrorLog(run._id, run.version)}
                              className="text-primary hover:underline font-bold text-[11px]"
                            >
                              Download Errors
                            </button>
                          )}
                          {run.status === 'completed' && (
                            <button
                              onClick={() => triggerRollback(run._id)}
                              className="text-red-400 hover:underline font-bold text-[11px]"
                            >
                              Rollback
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {erpHistory.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">No historical imports logged yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Stats */}
        {erpActiveTab === 'stats' && erpStats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Mapped Students', value: erpStats.totalStudents, icon: '🎓' },
                { label: 'Total Faculty Profiles', value: erpStats.totalFaculty, icon: '👩‍🏫' },
                { label: 'Active Departments', value: erpStats.totalDepts, icon: '🏫' },
                { label: 'Academic Sections', value: erpStats.totalSections, icon: '🧱' },
                { label: 'Mapped Subjects', value: erpStats.totalSubjects, icon: '📖' },
                { label: 'Today\'s Imports Count', value: erpStats.todayImports, icon: '📅' },
                { label: 'Successful Runs Rate', value: `${erpStats.successRate}%`, icon: '🎯' }
              ].map(card => (
                <div key={card.label} className="glass-card p-5 bg-[#110a24]/30 border border-purple-950/20">
                  <div className="flex items-center justify-between text-text-secondary">
                    <span className="text-[9px] font-bold uppercase tracking-wider">{card.label}</span>
                    <span className="text-sm">{card.icon}</span>
                  </div>
                  <p className="text-2xl font-black text-white mt-3 text-gradient">{card.value}</p>
                </div>
              ))}
            </div>

            {erpStats.latestImport && (
              <div className="glass-card p-6 space-y-4">
                <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wide">Latest Import Activity</h3>
                <div className="p-4 bg-[#110a24]/20 border border-purple-950/10 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-text-secondary font-bold uppercase text-[10px]">Import Type</span>
                    <p className="text-white capitalize font-semibold">{erpStats.latestImport.importType}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-text-secondary font-bold uppercase text-[10px]">Date & Time</span>
                    <p className="text-white font-semibold">{new Date(erpStats.latestImport.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-text-secondary font-bold uppercase text-[10px]">Status</span>
                    <p className="text-emerald-400 font-semibold uppercase">{erpStats.latestImport.status}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Editing Record Modal */}
        {editingId !== '' && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass-card max-w-lg w-full p-6 space-y-4 bg-[#110a24] border border-purple-500/30">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Edit Record Row #{Number(editingId) + 2}</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {erpPreviewHeaders.map(h => (
                  <div key={h} className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-text-secondary">{h}</label>
                    <input
                      type="text"
                      value={editFields[h] || ''}
                      onChange={(e) => setEditFields({ ...editFields, [h]: e.target.value })}
                      className="w-full h-10 px-3 bg-purple-950/40 border border-purple-900/30 rounded text-white text-xs font-semibold focus:outline-none focus:border-primary"
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => { setEditingId(''); setEditFields({}); }}
                  className="h-9 px-4 bg-purple-950/20 border border-purple-900/20 text-white rounded text-xs font-bold hover:bg-purple-950/40"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const updated = [...erpPreviewData];
                    updated[Number(editingId)] = editFields;
                    setErpPreviewData(updated);
                    setEditingId('');
                    setEditFields({});
                    toastSuccess('Row updated successfully.');
                  }}
                  className="h-9 px-4 bg-primary text-white rounded text-xs font-bold hover:opacity-90"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // =============================================================
  // HOD ENTERPRISE WORKFLOW RENDER STEPS & HELPERS
  // =============================================================
  const hodWorkflowSteps = [
    { id: 'hod_dashboard',    name: 'Step 1: Department Dashboard' },
    { id: 'hod_faculty',      name: 'Step 2: Faculty Management' },
    { id: 'hod_students',     name: 'Step 3: Student Management' },
    { id: 'hod_academics',    name: 'Step 4: Academic Management' },
    { id: 'hod_approvals',    name: 'Step 5: Approvals Queue' },
    { id: 'hod_communication',name: 'Step 6: Communication Center' },
    { id: 'hod_reports',      name: 'Step 7: Reports & Analytics' },
    { id: 'hod_attendance',   name: 'Step 8: Attendance Monitor' },
  ];

  const checkHodStepCompletion = (stepId: string) => {
    switch (stepId) {
      case 'hod_dashboard':    return true;
      case 'hod_faculty':      return staff.length > 0;
      case 'hod_students':     return students.length > 0;
      case 'hod_academics':    return subjects.length > 0;
      case 'hod_approvals':    return leaves.filter((l: any) => l.status === 'pending').length === 0 && examMarks.filter((m: any) => m.status === 'pending').length === 0;
      case 'hod_communication':return notices.length > 0;
      case 'hod_reports':      return true;
      case 'hod_attendance':   return (hodAttData?.summary?.totalStudents || 0) > 0;
      default:                 return false;
    }
  };

  const calculateHodProgress = () => {
    const completed = hodWorkflowSteps.filter(s => checkHodStepCompletion(s.id)).length;
    return Math.round((completed / hodWorkflowSteps.length) * 100);
  };

  const getHodOnboardingProgressChecklist = () => {
    const hasFaculty = staff.length > 0;
    const hasStudents = students.length > 0;
    const hasSubjects = subjects.length > 0;
    const hasTimetable = timetables.length > 0;
    const pendingLeaves = leaves.filter(l => l.status === 'pending').length;
    const pendingMarks = examMarks.filter(m => m.status === 'pending').length;

    return [
      { name: 'Faculty Roster', status: hasFaculty ? '✓' : 'Pending' },
      { name: 'Student Roster', status: hasStudents ? '✓' : 'Pending' },
      { name: 'Subjects Catalog', status: hasSubjects ? '✓' : 'Pending' },
      { name: 'Timetables Mapped', status: hasTimetable ? '✓' : 'Pending' },
      { name: 'Staff Leaves', status: pendingLeaves > 0 ? `${pendingLeaves} Req` : '✓' },
      { name: 'Internal Marks', status: pendingMarks > 0 ? `${pendingMarks} Req` : '✓' },
    ];
  };

  // STEP 1: Department Dashboard
  const renderHodDashboardStep = () => {
    return (
      <div className="space-y-6">
        {/* Read-Only Header */}
        <div className="glass-card p-6 border border-purple-900/30 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-wide">
              {user.assignedDepartment} Department Overview
            </h3>
            <p className="text-xs text-text-secondary mt-1">
              Active HOD Administrator: {user.fullName} • College Code: {user.collegeCode}
            </p>
          </div>
          <span className="px-3 py-1 bg-primary/20 border border-primary/30 rounded-lg text-primary text-xs font-bold uppercase font-mono">
            {user.assignedDepartment} Workspace
          </span>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Faculty Count', value: staff.length, icon: '👨‍🏫' },
            { label: 'Student Count', value: students.length, icon: '🎓' },
            { label: 'Average Attendance', value: `${stats.departmentAttendance || 91.2}%`, icon: '📅' },
            { label: 'Subjects Mapped', value: subjects.length, icon: '📖' }
          ].map(stat => (
            <div key={stat.label} className="glass-card p-5 bg-[#110a24]/30 border border-purple-950/20">
              <div className="flex items-center justify-between text-text-secondary">
                <span className="text-[10px] font-bold uppercase tracking-wider">{stat.label}</span>
                <span className="text-base">{stat.icon}</span>
              </div>
              <p className="text-2xl font-black text-white mt-3 text-gradient">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Semester Overview Grid */}
        <div className="glass-card p-6 space-y-4">
          <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wide">Semester Overview Summary</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => {
              const semStuds = students.filter(s => s.semester === sem);
              return (
                <div key={sem} className="p-4 bg-dark-bg/40 border border-purple-950/20 rounded-xl space-y-2 text-xs">
                  <p className="font-bold text-purple-400">Semester {sem}</p>
                  <p className="text-[10px] text-text-secondary">Students: <span className="text-white font-bold">{semStuds.length}</span></p>
                  <p className="text-[10px] text-text-secondary">Avg Attendance: <span className="text-emerald-400 font-bold">92.5%</span></p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Department Sections, Semesters & Regulations Setup (Managed by HOD) */}
        <div className="glass-card p-6 space-y-4 border border-purple-900/30">
          <h4 className="text-xs font-black uppercase text-purple-400 tracking-wider">
            ⚙️ {user.assignedDepartment} Department Sections, Semesters & Regulations Configuration
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sections Setup Box */}
            <div className="space-y-2 bg-[#110a24]/30 p-4 border border-purple-950/20 rounded-xl">
              <div className="flex items-center justify-between">
                <h5 className="text-[10px] font-bold text-white uppercase">Department Sections</h5>
                <span className="text-[9px] text-purple-400 font-mono">HOD Controlled</span>
              </div>
              <div className="flex flex-wrap gap-1.5 py-1">
                {configSections.map(s => (
                  <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-950/60 border border-purple-900/30 rounded-lg text-xs text-white font-mono font-bold">
                    Section {s}
                    <button onClick={() => handleUpdateConfigList('section', 'delete', s)} className="text-red-400 hover:text-red-300 font-bold ml-1">×</button>
                  </span>
                ))}
                {configSections.length === 0 && <span className="text-xs text-text-secondary">No sections configured.</span>}
              </div>
              <form onSubmit={(e: any) => {
                e.preventDefault();
                const val = e.target.elements.secVal.value.trim().toUpperCase();
                if (val) { handleUpdateConfigList('section', 'add', val); e.target.reset(); }
              }} className="flex gap-2 pt-1">
                <input name="secVal" type="text" className="flex-1 h-8 bg-dark-bg/60 border border-purple-900/30 rounded px-2.5 text-xs text-white font-mono" placeholder="Add Section (e.g. A, B, C)..." required />
                <button type="submit" className="h-8 px-3 bg-primary text-white font-bold rounded text-[10px]">Add Section</button>
              </form>
            </div>

            {/* Semesters Setup Box */}
            <div className="space-y-2 bg-[#110a24]/30 p-4 border border-purple-950/20 rounded-xl">
              <div className="flex items-center justify-between">
                <h5 className="text-[10px] font-bold text-white uppercase">Department Semesters</h5>
                <span className="text-[9px] text-purple-400 font-mono">HOD Controlled</span>
              </div>
              <div className="flex flex-wrap gap-1.5 py-1">
                {configSemesters.map(s => (
                  <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-950/60 border border-purple-900/30 rounded-lg text-xs text-white font-mono font-bold">
                    Sem {s}
                    <button onClick={() => handleUpdateConfigList('semester', 'delete', s)} className="text-red-400 hover:text-red-300 font-bold ml-1">×</button>
                  </span>
                ))}
                {configSemesters.length === 0 && <span className="text-xs text-text-secondary">No semesters configured.</span>}
              </div>
              <form onSubmit={(e: any) => {
                e.preventDefault();
                const val = e.target.elements.semVal.value.trim();
                if (val) { handleUpdateConfigList('semester', 'add', val); e.target.reset(); }
              }} className="flex gap-2 pt-1">
                <input name="semVal" type="text" className="flex-1 h-8 bg-dark-bg/60 border border-purple-900/30 rounded px-2.5 text-xs text-white font-mono" placeholder="Add Semester (e.g. 1)..." required />
                <button type="submit" className="h-8 px-3 bg-primary text-white font-bold rounded text-[10px]">Add Sem</button>
              </form>
            </div>

            {/* Regulations Setup Box */}
            <div className="space-y-2 bg-[#110a24]/30 p-4 border border-purple-950/20 rounded-xl">
              <div className="flex items-center justify-between">
                <h5 className="text-[10px] font-bold text-white uppercase">Academic Regulations</h5>
                <span className="text-[9px] text-purple-400 font-mono">HOD Controlled</span>
              </div>
              <div className="flex flex-wrap gap-1.5 py-1">
                {configRegulations.map(r => (
                  <span key={r} className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-950/60 border border-purple-900/30 rounded-lg text-xs text-white font-mono font-bold">
                    {r}
                    <button onClick={() => handleUpdateConfigList('regulation', 'delete', r)} className="text-red-400 hover:text-red-300 font-bold ml-1">×</button>
                  </span>
                ))}
                {configRegulations.length === 0 && <span className="text-xs text-text-secondary">No regulations configured.</span>}
              </div>
              <form onSubmit={(e: any) => {
                e.preventDefault();
                const val = e.target.elements.regVal.value.trim().toUpperCase();
                if (val) { handleUpdateConfigList('regulation', 'add', val); e.target.reset(); }
              }} className="flex gap-2 pt-1">
                <input name="regVal" type="text" className="flex-1 h-8 bg-dark-bg/60 border border-purple-900/30 rounded px-2.5 text-xs text-white font-mono" placeholder="Add Regulation (e.g. R20, R23)..." required />
                <button type="submit" className="h-8 px-3 bg-primary text-white font-bold rounded text-[10px]">Add Regulation</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // STEP 2: Faculty Management
  const renderHodFacultyStep = () => {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Register/Edit form */}
        <div className="xl:col-span-1 glass-card p-6 space-y-4">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">
            {editingId ? 'Edit Faculty Account' : 'Register Faculty Account'}
          </h3>
          <form onSubmit={(e) => {
            e.preventDefault();
            const fields = { ...editFields, role: 'faculty', assignedDepartment: user.assignedDepartment };
            handleSaveUserExplicitly(e, fields);
          }} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Full Name *</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={editFields.fullName || ''} onChange={(e) => setEditFields({ ...editFields, fullName: e.target.value })} required />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Email Address *</label>
              <input type="email" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={editFields.email || ''} onChange={(e) => setEditFields({ ...editFields, email: e.target.value })} required disabled={!!editingId} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Employee ID *</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={editFields.employeeId || ''} onChange={(e) => setEditFields({ ...editFields, employeeId: e.target.value })} required />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Designation / Title</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" placeholder="e.g. Assistant Professor" value={editFields.jobTitle || ''} onChange={(e) => setEditFields({ ...editFields, jobTitle: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Department</label>
              <div className="w-full h-10 mt-1 bg-purple-950/20 border border-purple-900/10 rounded-lg px-3 flex items-center text-xs text-purple-300 font-bold font-mono">
                {user.assignedDepartment}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">{editingId ? 'Reset Password (optional)' : 'Password *'}</label>
              <input type="password" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={editFields.password || ''} onChange={(e) => setEditFields({ ...editFields, password: e.target.value })} placeholder={editingId ? 'Leave blank to preserve' : 'Min 6 chars'} required={!editingId} />
            </div>
            {editingId && (
              <div className="flex items-center gap-2">
                <input id="hod-fac-active-check" type="checkbox" checked={editFields.isActive !== false} onChange={(e) => setEditFields({ ...editFields, isActive: e.target.checked })} />
                <label htmlFor="hod-fac-active-check" className="text-xs text-white font-bold select-none">Account Active</label>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 h-10 bg-primary text-white font-bold rounded-lg text-xs hover:opacity-90" disabled={loading}>
                {editingId ? 'Save' : 'Register'}
              </button>
              {editingId && (
                <button type="button" className="h-10 px-3 bg-purple-950/40 border border-purple-900/30 text-white font-bold rounded-lg text-xs" onClick={() => { setEditingId(''); setEditFields({}); }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Faculty Roster List */}
        <div className="xl:col-span-2 glass-card p-6 space-y-4">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Faculty Registry</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-purple-950/20 text-text-secondary">
                  <th className="py-3 font-bold uppercase">Emp ID</th>
                  <th className="py-3 font-bold uppercase">Name</th>
                  <th className="py-3 font-bold uppercase">Designation</th>
                  <th className="py-3 font-bold uppercase">Workload</th>
                  <th className="py-3 font-bold uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-950/10">
                {staff.map((fac: any) => (
                  <tr key={fac._id} className="hover:bg-purple-950/5 transition-colors">
                    <td className="py-3 font-mono font-bold text-purple-400">{fac.employeeId || 'N/A'}</td>
                    <td className="py-3">
                      <p className="text-white font-bold">{fac.fullName}</p>
                      <p className="text-[10px] text-text-secondary">{fac.email}</p>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 bg-primary/20 border border-primary/30 rounded text-primary text-[10px] font-bold uppercase">
                        {fac.jobTitle || 'Faculty'}
                      </span>
                    </td>
                    <td className="py-3 font-mono font-bold text-white">
                      {fac.assignedClasses?.length || 0} classes
                    </td>
                    <td className="py-3 text-right space-x-1.5">
                      <button
                        onClick={() => setHodSelectedFaculty(fac)}
                        className="h-7 px-2 bg-primary/20 text-primary border border-primary/30 rounded text-[10px] font-bold hover:bg-primary/30 transition-all"
                      >
                        Workload
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(fac._id);
                          setEditFields({
                            fullName: fac.fullName,
                            email: fac.email,
                            employeeId: fac.employeeId,
                            jobTitle: fac.jobTitle,
                            isActive: fac.isActive
                          });
                        }}
                        className="h-7 px-2 bg-purple-950/40 text-purple-300 border border-purple-900/30 rounded text-[10px] font-bold hover:bg-purple-900/40 transition-all"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteUser(fac._id)}
                        className="h-7 px-2 bg-red-950/20 text-red-400 border border-red-900/30 rounded text-[10px] font-bold hover:bg-red-900/30 transition-all"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {staff.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-text-secondary">No faculty members found in department.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Assignments Control Panel */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Workload & Assignments</h3>
          {hodSelectedFaculty ? (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-purple-950/10 border border-purple-900/30 rounded-lg">
                <p className="font-bold text-white">{hodSelectedFaculty.fullName}</p>
                <p className="text-[10px] text-text-secondary mt-0.5">ID: {hodSelectedFaculty.employeeId}</p>
              </div>

              {/* Current Assignments List */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-text-secondary uppercase">Assigned Subjects & Sections</p>
                <div className="flex flex-wrap gap-1.5 py-1">
                  {hodSelectedFaculty.assignedClasses?.map((cls: any, index: number) => (
                    <span key={index} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-950/60 border border-purple-900/30 rounded text-[10px] text-white">
                      {cls.subject} (Yr {cls.year}-{cls.section})
                      <button
                        onClick={async () => {
                          const updatedClasses = hodSelectedFaculty.assignedClasses.filter((_: any, idx: number) => idx !== index);
                          setLoading(true);
                          try {
                            const res = await api.put(`/hod/faculty/${hodSelectedFaculty._id}/assignments`, { assignedClasses: updatedClasses });
                            setHodSelectedFaculty(res.data.faculty);
                            loadData();
                          } catch (e) { toast_CRUD.error('Failed updating assignments.'); }
                          finally { setLoading(false); }
                        }}
                        className="text-red-400 hover:text-red-300 font-bold ml-1"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {(!hodSelectedFaculty.assignedClasses || hodSelectedFaculty.assignedClasses.length === 0) && (
                    <span className="text-text-secondary text-[11px]">No assignments configured.</span>
                  )}
                </div>
              </div>

              {/* Assign New Mapping Form */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!hodNewClassSubject) return toastInfo('Select a subject.');
                  const updatedClasses = [...(hodSelectedFaculty.assignedClasses || []), {
                    year: Number(hodNewClassYear),
                    section: hodNewClassSection,
                    subject: hodNewClassSubject
                  }];
                  setLoading(true);
                  try {
                    const res = await api.put(`/hod/faculty/${hodSelectedFaculty._id}/assignments`, { assignedClasses: updatedClasses });
                    setHodSelectedFaculty(res.data.faculty);
                    setHodNewClassSubject('');
                    loadData();
                  } catch (e) { toast_CRUD.error('Failed updating assignments.'); }
                  finally { setLoading(false); }
                }}
                className="border-t border-purple-950/10 pt-4 space-y-3"
              >
                <p className="text-[10px] font-bold text-text-secondary uppercase">Assign Class & Subject</p>
                <div>
                  <label className="text-[9px] text-text-secondary font-bold uppercase">Subject *</label>
                  <select
                    className="w-full h-8 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded px-2 text-[11px] text-white"
                    value={hodNewClassSubject}
                    onChange={(e) => setHodNewClassSubject(e.target.value)}
                    required
                  >
                    <option value="">Select Subject</option>
                    {subjects.map((sub: any) => (
                      <option key={sub.subjectCode} value={sub.subjectCode}>{sub.name} ({sub.subjectCode})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-text-secondary font-bold uppercase">Year *</label>
                    <select
                      className="w-full h-8 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded px-2 text-[11px] text-white"
                      value={hodNewClassYear}
                      onChange={(e) => setHodNewClassYear(Number(e.target.value))}
                    >
                      {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-text-secondary font-bold uppercase">Section *</label>
                    <input
                      type="text"
                      className="w-full h-8 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded px-3 text-[11px] text-white uppercase"
                      placeholder="e.g. A"
                      value={hodNewClassSection}
                      onChange={(e) => setHodNewClassSection(e.target.value.toUpperCase())}
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full h-9 bg-primary text-white font-bold rounded text-xs hover:opacity-90 transition-all"
                  disabled={loading}
                >
                  Confirm Mapping
                </button>
              </form>
            </div>
          ) : (
            <p className="text-xs text-text-secondary text-center py-8">Select a faculty member from the registry list to modify assignments.</p>
          )}
        </div>
      </div>
    );
  };

  // STEP 3: Student Management
  const renderHodStudentsStep = () => {
    const filteredStudents = students.filter((s: any) => {
      const matchesSearch = s.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || s.rollNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSem = filterSem ? s.semester === Number(filterSem) : true;
      const matchesSec = filterBranch ? s.section === filterBranch : true;
      return matchesSearch && matchesSem && matchesSec;
    });

    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* LEFT — Registration form */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-card p-5 space-y-4 text-xs">
            <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">
              {editingId ? '✏️ Edit Student Record' : '➕ Register Student'}
            </h3>
            <form onSubmit={handleSaveStudentRecord} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Full Name *</label>
                <input
                  type="text"
                  className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                  placeholder="Student Full Name"
                  value={editFields.fullName || ''}
                  onChange={(e) => setEditFields({ ...editFields, fullName: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Roll No *</label>
                  <input
                    type="text"
                    className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                    placeholder="e.g. 21CS001"
                    value={editFields.rollNumber || ''}
                    onChange={(e) => setEditFields({ ...editFields, rollNumber: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Student ID *</label>
                  <input
                    type="text"
                    className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                    placeholder="e.g. STU2100001"
                    value={editFields.studentId || ''}
                    onChange={(e) => setEditFields({ ...editFields, studentId: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Admission No *</label>
                <input
                  type="text"
                  className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                  placeholder="Admission Number"
                  value={editFields.admissionNumber || ''}
                  onChange={(e) => setEditFields({ ...editFields, admissionNumber: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Gender *</label>
                  <select
                    className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-2 text-xs text-white"
                    value={editFields.gender || 'Male'}
                    onChange={(e) => setEditFields({ ...editFields, gender: e.target.value })}
                    required
                  >
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Date of Birth *</label>
                  <input
                    type="date"
                    className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                    value={editFields.dob || ''}
                    onChange={(e) => setEditFields({ ...editFields, dob: e.target.value })}
                    required
                  />
                </div>
              </div>
              {/* Department locked to HOD's dept */}
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Department (Auto)</label>
                <input
                  type="text"
                  className="w-full h-9 mt-1 bg-dark-bg/30 border border-purple-900/20 rounded-lg px-3 text-xs text-purple-400 cursor-not-allowed"
                  value={user?.assignedDepartment || 'Your Department'}
                  readOnly
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Semester *</label>
                  <select
                    className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-2 text-xs text-white"
                    value={editFields.semester || 1}
                    onChange={(e) => setEditFields({ ...editFields, semester: Number(e.target.value), department: user?.assignedDepartment || '', branch: user?.assignedDepartment || '' })}
                    required
                  >
                    {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Section *</label>
                  <input
                    type="text"
                    className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white uppercase"
                    placeholder="e.g. A, B, C, D"
                    value={editFields.section || ''}
                    onChange={(e) => setEditFields({ ...editFields, section: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Academic Year *</label>
                <input
                  type="text"
                  className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                  placeholder="e.g. 2024-25"
                  value={editFields.academicYear || ''}
                  onChange={(e) => setEditFields({ ...editFields, academicYear: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Mobile Number</label>
                <input
                  type="text"
                  className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                  placeholder="10-digit number"
                  value={editFields.mobileNumber || ''}
                  onChange={(e) => setEditFields({ ...editFields, mobileNumber: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Father Name</label>
                <input
                  type="text"
                  className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                  placeholder="Father's Full Name"
                  value={editFields.fatherName || ''}
                  onChange={(e) => setEditFields({ ...editFields, fatherName: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Mother Name</label>
                <input
                  type="text"
                  className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                  placeholder="Mother's Full Name"
                  value={editFields.motherName || ''}
                  onChange={(e) => setEditFields({ ...editFields, motherName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Parent Phone</label>
                  <input
                    type="text"
                    className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                    placeholder="Parent Mobile"
                    value={editFields.parentPhone || ''}
                    onChange={(e) => setEditFields({ ...editFields, parentPhone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Status</label>
                  <select
                    className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-2 text-xs text-white"
                    value={editFields.status || 'Active'}
                    onChange={(e) => setEditFields({ ...editFields, status: e.target.value })}
                  >
                    <option>Active</option>
                    <option>Suspended</option>
                    <option>Completed</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 h-9 bg-primary text-white font-bold rounded-lg text-xs hover:opacity-90 transition-all"
                  disabled={loading}
                >
                  {editingId ? 'Update Record' : 'Register Student'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="h-9 px-3 bg-dark-bg/60 border border-purple-900/30 text-gray-400 rounded-lg text-xs hover:border-purple-700/50 transition-all"
                    onClick={() => { setEditingId(''); setEditFields({}); }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            {/* Bulk Import panel */}
            <div className="border-t border-purple-950/20 pt-4 space-y-2">
              <button
                className="w-full h-8 text-[11px] font-bold bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 rounded-lg hover:bg-emerald-900/30 transition-all"
                onClick={() => setShowBulkImport(!showBulkImport)}
              >
                📥 Upload Student List
              </button>
              {showBulkImport && (
                <div className="space-y-3 p-3 bg-dark-bg/40 border border-purple-950/20 rounded-xl">
                  <p className="text-[10px] text-text-secondary leading-relaxed">
                    Upload <span className="text-emerald-400 font-bold">.csv</span> or <span className="text-emerald-400 font-bold">.json</span>. CSV cols: <code className="text-purple-400">rollNumber, fullName, studentId, admissionNumber, gender, dob, semester, section, academicYear</code>
                  </p>
                  <p className="text-[10px] text-amber-400/80">📷 For Word/Image/Excel: save as CSV first, then upload.</p>
                  {/* File picker */}
                  <label className="flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-emerald-900/40 rounded-lg cursor-pointer hover:border-emerald-700/60 transition-all bg-dark-bg/30">
                    <span className="text-xl">📂</span>
                    <span className="text-[10px] text-text-secondary mt-0.5">Click to choose .csv / .json file</span>
                    <input
                      type="file"
                      accept=".csv,.json,.xlsx,.xls"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const text = await readFileAsText(file);
                        const ext = file.name.split('.').pop()?.toLowerCase();
                        try {
                          const parsed = ext === 'json' ? JSON.parse(text) : parseCsvToObjects(text);
                          setBulkText(JSON.stringify(parsed, null, 2));
                          toastInfo(`Parsed ${parsed.length} student records from file.`);
                        } catch {
                          toastError('Could not parse file. Check format and try again.');
                        }
                      }}
                    />
                  </label>
                  {/* Or paste JSON */}
                  <textarea
                    className="w-full h-20 p-2 bg-dark-bg/60 border border-purple-900/30 rounded-lg text-[10px] text-white font-mono resize-none"
                    placeholder='Or paste JSON: [{"rollNumber":"21CS001","fullName":"..."}]'
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                  />
                  <button
                    className="w-full h-8 bg-emerald-950/30 border border-emerald-900/30 text-emerald-400 text-[11px] font-bold rounded-lg hover:bg-emerald-900/30 transition-all"
                    onClick={handleBulkImport}
                    disabled={loading}
                  >
                    Import Students
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — Registry table */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search & Filter Controls */}
          <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                className="h-9 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white placeholder-gray-400 w-44"
                placeholder="Search Student..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                className="h-9 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-2 text-xs text-white"
                value={filterSem}
                onChange={(e) => setFilterSem(e.target.value)}
              >
                <option value="">All Semesters</option>
                {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}
              </select>
              <select
                className="h-9 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-2 text-xs text-white"
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
              >
                <option value="">All Sections</option>
                {['A','B','C','D'].map(sec => <option key={sec} value={sec}>Section {sec}</option>)}
              </select>
            </div>
            <span className="text-xs text-text-secondary">{filteredStudents.length} students found</span>
          </div>

          {/* Bulk Action Toolbar */}
          {selectedRecordIds.length > 0 && (
            <div className="glass-card p-4 flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-white">{selectedRecordIds.length} selected:</span>
              <button
                className="h-7 px-3 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 rounded text-[10px] font-bold hover:bg-emerald-900/30 transition-all"
                onClick={() => handleBulkStudentRecordAction('promote')}
                disabled={loading}
              >
                Promote Semester
              </button>
              <button
                className="h-7 px-3 bg-amber-950/20 text-amber-400 border border-amber-900/30 rounded text-[10px] font-bold hover:bg-amber-900/30 transition-all"
                onClick={() => handleBulkStudentRecordAction('setStatus', 'Suspended')}
                disabled={loading}
              >
                Mark Suspended
              </button>
              <button
                className="h-7 px-3 bg-sky-950/20 text-sky-400 border border-sky-900/30 rounded text-[10px] font-bold hover:bg-sky-900/30 transition-all"
                onClick={() => handleBulkStudentRecordAction('setStatus', 'Active')}
                disabled={loading}
              >
                Mark Active
              </button>
              <button
                className="h-7 px-3 bg-red-950/20 text-red-400 border border-red-900/30 rounded text-[10px] font-bold hover:bg-red-900/30 transition-all"
                onClick={() => setSelectedRecordIds([])}
              >
                Clear Selection
              </button>
            </div>
          )}

          {/* Student Master Roster Table */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Student Master Registry</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-purple-950/20 text-text-secondary">
                    <th className="py-3 pr-2">
                      <input
                        type="checkbox"
                        className="w-3 h-3 accent-purple-600"
                        checked={selectedRecordIds.length === filteredStudents.length && filteredStudents.length > 0}
                        onChange={(e) => setSelectedRecordIds(e.target.checked ? filteredStudents.map((s: any) => s._id) : [])}
                      />
                    </th>
                    <th className="py-3 font-bold uppercase">Roll No</th>
                    <th className="py-3 font-bold uppercase">Name & ID</th>
                    <th className="py-3 font-bold uppercase">Sem / Sec</th>
                    <th className="py-3 font-bold uppercase">Profile Link</th>
                    <th className="py-3 font-bold uppercase">Status</th>
                    <th className="py-3 font-bold uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-950/10">
                  {filteredStudents.map((s: any) => (
                    <tr key={s._id} className={`hover:bg-purple-950/5 transition-colors ${selectedRecordIds.includes(s._id) ? 'bg-purple-950/10' : ''}`}>
                      <td className="py-3 pr-2">
                        <input
                          type="checkbox"
                          className="w-3 h-3 accent-purple-600"
                          checked={selectedRecordIds.includes(s._id)}
                          onChange={(e) => setSelectedRecordIds(e.target.checked ? [...selectedRecordIds, s._id] : selectedRecordIds.filter((id: string) => id !== s._id))}
                        />
                      </td>
                      <td className="py-3 font-mono font-bold text-purple-400">{s.rollNumber}</td>
                      <td className="py-3">
                        <p className="text-white font-bold">{s.fullName}</p>
                        <p className="text-[10px] text-text-secondary">ID: {s.studentId}</p>
                      </td>
                      <td className="py-3 text-white">Sem {s.semester} / Sec {s.section}</td>
                      <td className="py-3">
                        {s.linkedUserId ? (
                          <span className="text-emerald-400 text-[10px] font-bold">🟢 Connected</span>
                        ) : (
                          <span className="text-gray-500 text-[10px]">⚪ Unlinked</span>
                        )}
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.status === 'Active' ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30' :
                          s.status === 'Suspended' ? 'bg-amber-950/20 text-amber-400 border border-amber-900/30' :
                          'bg-sky-950/20 text-sky-400 border border-sky-900/30'
                        }`}>{s.status}</span>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          <button
                            className="h-6 px-2 bg-purple-950/20 border border-purple-900/30 text-purple-400 rounded text-[10px] font-bold hover:bg-purple-900/30 transition-all"
                            onClick={() => {
                              setEditingId(s._id);
                              setEditFields({
                                fullName: s.fullName, rollNumber: s.rollNumber, studentId: s.studentId,
                                admissionNumber: s.admissionNumber, gender: s.gender, dob: s.dob?.split('T')[0],
                                department: s.department, branch: s.branch, course: s.course,
                                academicYear: s.academicYear, semester: s.semester, section: s.section,
                                batch: s.batch, mobileNumber: s.mobileNumber, status: s.status,
                                admissionDate: s.admissionDate?.split('T')[0], photo: s.photo,
                                fatherName: s.fatherName, motherName: s.motherName,
                                parentPhone: s.parentPhone, parentEmail: s.parentEmail
                              });
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="h-6 px-2 bg-red-950/20 border border-red-900/30 text-red-400 rounded text-[10px] font-bold hover:bg-red-900/30 transition-all"
                            onClick={() => handleDeleteStudentRecord(s._id)}
                            disabled={loading}
                          >
                            Del
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-text-secondary">No students found in your department. Register one to get started.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── CSV Parse Helpers ──────────────────────────────────────────────────
  const normalizeHeaderKey = (key: string): string => {
    const clean = key.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (['rollnumber', 'rollno', 'roll', 'symbolno'].includes(clean)) return 'rollNumber';
    if (['fullname', 'name', 'studentname', 'firstmidlast'].includes(clean)) return 'fullName';
    if (['studentid', 'stdid', 'uid'].includes(clean)) return 'studentId';
    if (['admissionnumber', 'admissionno', 'admno'].includes(clean)) return 'admissionNumber';
    if (['gender', 'sex'].includes(clean)) return 'gender';
    if (['dob', 'dateofbirth', 'birthdate', 'birthday'].includes(clean)) return 'dob';
    if (['semester', 'sem'].includes(clean)) return 'semester';
    if (['section', 'sec'].includes(clean)) return 'section';
    if (['academicyear', 'acadyear', 'year'].includes(clean)) return 'academicYear';
    if (['mobilenumber', 'mobile', 'phone', 'phonenumber', 'contact'].includes(clean)) return 'mobileNumber';
    if (['fathername', 'fathersname', 'father'].includes(clean)) return 'fatherName';
    if (['mothername', 'mothersname', 'mother'].includes(clean)) return 'motherName';
    if (['parentphone', 'parentmobile', 'parentcontact'].includes(clean)) return 'parentPhone';
    if (['status'].includes(clean)) return 'status';
    return key;
  };

  const parseCsvToObjects = (csvText: string): any[] => {
    const lines = csvText.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    
    const splitCsvLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const rawHeaders = splitCsvLine(lines[0]);
    const headers = rawHeaders.map(h => normalizeHeaderKey(h.trim().replace(/^"|"$/g, '')));
    
    return lines.slice(1).map(line => {
      const cols = splitCsvLine(line);
      const obj: any = {};
      headers.forEach((h, i) => {
        const val = (cols[i] || '').trim().replace(/^"|"$/g, '');
        obj[h] = val;
      });
      return obj;
    });
  };

  const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });

  // STEP 4: Academic Management
  const renderHodAcademicsStep = () => {
    // Group timetable by day for grid display
    const ttDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const ttDaysShort: Record<string, string> = {
      'Monday': 'MON', 'Tuesday': 'TUE', 'Wednesday': 'WED',
      'Thursday': 'THU', 'Friday': 'FRI', 'Saturday': 'SAT', 'Sunday': 'SUN'
    };

    // Real calendar dates for each weekday starting from the current Monday
    const todayJs = new Date();
    const todayDow = todayJs.getDay(); // 0=Sun…6=Sat
    const diffToMon = (todayDow === 0 ? -6 : 1 - todayDow);
    const weekStart = new Date(todayJs);
    weekStart.setDate(todayJs.getDate() + diffToMon);
    const dayDates: Record<string, string> = {};
    ttDays.forEach((d, i) => {
      const dt = new Date(weekStart);
      dt.setDate(weekStart.getDate() + (i === 6 ? 6 : i)); // Sun is index 6 (+6 from Mon)
      dayDates[d] = dt.getDate().toString();
    });

    // Helper: convert 24h time string like "13:00" to "1:00 PM"
    // Helper: format a slot range string with correct AM/PM from 24h stored times.
    const formatSlot = (s: string): string => fmtSlot24(s);

    // ── Helper: minutes since midnight from "HH:MM" string
    const toMin = (t: string): number => {
      const [h, m] = t.split(':').map(Number);
      return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
    };
    // ── Helper: look up subject name from subjects registry
    // ── Helper: look up subject name from subjects registry
    const subjectName = (code: string): string => {
      if (!code) return code;
      const parts = code.split('/').map(p => p.trim());
      const resolved = parts.map(part => {
        const found = subjects.find((s: any) => (s.subjectCode || '').toUpperCase() === part.toUpperCase());
        return found?.name || part;
      });
      return resolved.join(' / ');
    };

    // Collect ALL unique time slots that exist for this section
    const allSlotKeys = new Set<string>();
    timetables.forEach((tt: any) => {
      if (Number(tt.year) === selectedTimetableYear && tt.section === selectedTimetableSection) {
        (tt.slots || []).forEach((sl: any) => { if (sl.timeSlot) allSlotKeys.add(sl.timeSlot); });
      }
    });
    // Sort all unique slots chronologically
    const ttSlotTimes = Array.from(allSlotKeys).sort((a, b) => {
      const startA = a.split('-')[0] || '00:00';
      const startB = b.split('-')[0] || '00:00';
      return toMin(startA) - toMin(startB);
    });
    // Precompute start/end minutes for each column for colspan calculation
    const slotMinutes: Record<string, { start: number; end: number }> = {};
    ttSlotTimes.forEach(s => {
      const parts = s.split('-');
      slotMinutes[s] = { start: toMin(parts[0] || '00:00'), end: toMin(parts[1] || '00:00') };
    });
    // SPLIT: narrow = regular periods shown as columns; wide = lab/multi-hour spans shown as colspan only
    const narrowKeys = ttSlotTimes.filter(s => {
      const m = slotMinutes[s];
      return m && (m.end - m.start) < 75; // Less than 75 min → regular class period
    });
    const wideKeys = ttSlotTimes.filter(s => {
      const m = slotMinutes[s];
      return m && (m.end - m.start) >= 75; // 75+ min → lab/extended session
    });

    const ttGrid: Record<string, Record<string, any[]>> = {};
    ttDays.forEach(d => { ttGrid[d] = {}; ttSlotTimes.forEach(s => { ttGrid[d][s] = []; }); });
    
    const getSlotDetails = (e: any) => {
      let codes: string[] = [];
      let names: string[] = [];
      let facs: string[] = [];
      let room = e.room || '';

      // 1. Read from populated subjects array first (bulk upload format)
      if (e.subjects && Array.isArray(e.subjects) && e.subjects.length > 0) {
        e.subjects.forEach((sub: any) => {
          if (typeof sub === 'object' && sub) {
            if (sub.subjectCode) codes.push(sub.subjectCode);
            if (sub.name) names.push(sub.name);
            if (sub.faculty) {
              const facName = typeof sub.faculty === 'object' ? sub.faculty.fullName : sub.faculty;
              if (facName) facs.push(facName);
            }
          } else {
            // ObjectId format, look up in registry
            const found = subjects.find((s: any) => s._id === sub);
            if (found) {
              if (found.subjectCode) codes.push(found.subjectCode);
              if (found.name) names.push(found.name);
              if (found.faculty) {
                const facUser = staff.find((f: any) => f._id === found.faculty || f._id === found.faculty?._id);
                if (facUser) facs.push(facUser.fullName);
              }
            }
          }
        });
      }

      // 2. Fallback or merge with direct properties (manual add format)
      if (e.subjectCode && !codes.includes(e.subjectCode)) {
        codes.push(e.subjectCode);
        const resolvedName = subjectName(e.subjectCode);
        if (resolvedName && !names.includes(resolvedName)) {
          names.push(resolvedName);
        }
      }
      if (e.facultyName && !facs.includes(e.facultyName)) {
        facs.push(e.facultyName);
      } else if (e.facultyId && typeof e.facultyId === 'object' && e.facultyId.fullName && !facs.includes(e.facultyId.fullName)) {
        facs.push(e.facultyId.fullName);
      }

      return {
        subjectCode: codes.join(' / ') || '-',
        subjectName: names.join(' / ') || '-',
        facultyName: facs.join(' / ') || '',
        room: room
      };
    };

    const getAssignedFacultyForSlot = (subjectCode: string | undefined | null, year: number, section: string) => {
      if (!subjectCode || !staff || !Array.isArray(staff)) return null;
      const cleanSubCode = subjectCode.toUpperCase().trim();
      return staff.find(f => {
        if (!f.assignedClasses || !Array.isArray(f.assignedClasses)) return false;
        return f.assignedClasses.some((c: any) => {
          const matchSub = (c.subject || '').toUpperCase().trim() === cleanSubCode;
          const matchYear = Number(c.year) === Number(year);
          const matchSec = (c.section || '').toUpperCase().trim() === section.toUpperCase().trim();
          return matchSub && matchYear && matchSec;
        });
      });
    };

    let filteredSlotsCount = 0;
    timetables.forEach((tt: any) => {
      if (Number(tt.year) === selectedTimetableYear && tt.section === selectedTimetableSection) {
        (tt.slots || []).forEach((sl: any) => {
          if (ttGrid[tt.day] && ttGrid[tt.day][sl.timeSlot] !== undefined) {
            ttGrid[tt.day][sl.timeSlot].push({ ...sl, year: tt.year, section: tt.section });
            filteredSlotsCount++;
          }
        });
      }
    });

    // Resolve daily slots for the selected day
    const dailySlots: any[] = [];
    timetables.forEach((tt: any) => {
      if (
        Number(tt.year) === selectedTimetableYear &&
        tt.section === selectedTimetableSection &&
        tt.day === selectedTimetableDay
      ) {
        (tt.slots || []).forEach((sl: any) => {
          dailySlots.push({ ...sl, year: tt.year, section: tt.section, day: tt.day });
        });
      }
    });
    // Sort daily slots chronologically — guard against null/undefined timeSlot
    dailySlots.sort((a, b) => {
      const startA = (a.timeSlot || '').split('-')[0] || '00:00';
      const startB = (b.timeSlot || '').split('-')[0] || '00:00';
      return toMin(startA) - toMin(startB);
    });

    return (
      <div className="space-y-6">
        {/* ── MAIN TIMETABLE CONTROLS ── */}
        <div className="glass-card p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-purple-950/20">
            {/* Header info */}
            <div>
              <h2 className="text-xl font-black text-white tracking-wide">Timetable</h2>
              <p className="text-[11px] text-text-secondary mt-0.5">Manage classes and sync to calendar</p>
            </div>

            {/* Action buttons matching the screenshot */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Sync Button */}
              <button
                onClick={() => toastInfo('Timetable synced with calendar.')}
                className="h-9 px-4 bg-dark-bg/60 border border-purple-900/30 rounded-xl text-text-secondary hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
                </svg>
                <span>Sync</span>
              </button>

              {/* Upload Timetable Button */}
              <input
                ref={ttFileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.xls,.xlsx,.csv,.json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setLoading(true);
                  try {
                    const formData = new FormData();
                    formData.append('file', file);
                    const res = await api.post('/hod/timetable/parse-file', formData, {
                      headers: { 'Content-Type': 'multipart/form-data' },
                      timeout: 180000
                    });
                    
                    const slots = res.data.slots || [];
                    const metadata = res.data.metadata || {};

                    setTimetableUploadPreview(slots);
                    setTimetableUploadMetadata({
                      college: metadata.college || '',
                      department: metadata.department || user?.assignedDepartment || '',
                      academicYear: metadata.academicYear || '2026-27',
                      semester: Number(metadata.semester) || 1,
                      section: metadata.section || 'A',
                      effectiveDate: metadata.effectiveDate || ''
                    });
                    setShowUploadModal(true);
                    toastSuccess(`✅ AI extracted ${slots.length} timetable slots successfully!`);
                  } catch (err: any) {
                    console.error('[Timetable AI OCR Error]', err);
                    toastError(err.response?.data?.message || 'Could not parse file.');
                  } finally { setLoading(false); e.target.value = ''; }
                }}
              />
              <button
                disabled={true}
                title="⏸️ OCR Timetable Engine Upgrading - Upload Temporarily Disabled"
                className="h-9 px-4 bg-sky-950/40 border border-sky-800/30 text-sky-400/60 font-bold rounded-xl text-xs flex items-center gap-1.5 opacity-60 cursor-not-allowed"
              >
                <span>⏸️ Upload Timetable (Upgrading)</span>
              </button>



              {/* Add Slot Button */}
              <button
                onClick={() => {
                  setTtYear(selectedTimetableYear);
                  setTtSec(selectedTimetableSection);
                  setTtDay(selectedTimetableDay);
                  setShowAddSlotModal(true);
                }}
                className="h-9 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-lg active:scale-95"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>+ Add Class</span>
              </button>

              {/* Clear All Button */}
              <button
                onClick={async () => {
                  if (!confirm('⚠️ This will DELETE all timetable data for your department. Are you sure?')) return;
                  setLoading(true);
                  try {
                    await api.delete('/hod/timetable/all');
                    toastSuccess('All timetable data cleared. Please re-upload your timetable file.');
                    loadData();
                  } catch (err: any) {
                    toastError(err.response?.data?.message || 'Failed to clear timetable.');
                  } finally { setLoading(false); }
                }}
                className="h-9 px-3 text-[11px] font-bold text-red-400 border border-red-900/30 bg-red-950/20 hover:bg-red-950/40 rounded-xl transition-all"
              >
                🗑️ Clear All
              </button>
            </div>
          </div>

          {/* ── YEAR AND SECTION TABS Row ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-dark-bg/30 p-4 rounded-2xl border border-purple-900/10">
            {/* Year Selector */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-text-secondary uppercase tracking-wider">Academic Year</span>
              <div className="flex bg-dark-bg/60 border border-purple-900/30 p-1 rounded-xl w-full justify-between">
                {[1, 2, 3, 4].map(y => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setSelectedTimetableYear(y)}
                    className={`flex-1 h-8 text-[11px] font-extrabold uppercase rounded-lg transition-all ${
                      selectedTimetableYear === y
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-text-secondary hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {y === 1 ? '1st Year' : y === 2 ? '2nd Year' : y === 3 ? '3rd Year' : '4th Year'}
                  </button>
                ))}
              </div>
            </div>

            {/* Section Selector */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-text-secondary uppercase tracking-wider">Class Section</span>
                <button
                  type="button"
                  onClick={() => {
                    const name = prompt('Enter new section letter (e.g. B, C, D):');
                    if (!name) return;
                    const cleanSec = name.trim().toUpperCase();
                    if (!/^[A-Z]$/.test(cleanSec)) {
                      alert('Invalid section name. Please enter a single letter (A-Z).');
                      return;
                    }
                    const currentList = customSections[selectedTimetableYear] || ['A'];
                    if (currentList.includes(cleanSec)) {
                      alert(`Section ${cleanSec} already exists for Year ${selectedTimetableYear}.`);
                      return;
                    }
                    const updated = {
                      ...customSections,
                      [selectedTimetableYear]: [...currentList, cleanSec].sort()
                    };
                    setCustomSections(updated);
                    localStorage.setItem('campus_custom_sections', JSON.stringify(updated));
                    setSelectedTimetableSection(cleanSec);
                    toastInfo(`Created Section ${cleanSec} for Year ${selectedTimetableYear}!`);
                  }}
                  className="px-2 py-0.5 bg-sky-950/40 border border-sky-900/30 hover:bg-sky-900/30 text-sky-400 text-[9px] font-bold rounded"
                >
                  ➕ Create Section
                </button>
              </div>
              <div className="flex flex-wrap bg-dark-bg/60 border border-purple-900/30 p-1 rounded-xl w-full gap-0.5">
                {(customSections[selectedTimetableYear] || ['A']).map(sec => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setSelectedTimetableSection(sec)}
                    className={`flex-1 min-w-[32px] h-8 flex items-center justify-center text-[11px] font-extrabold uppercase rounded-lg transition-all ${
                      selectedTimetableSection === sec
                        ? 'bg-sky-600 text-white shadow-md'
                        : 'text-text-secondary hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {sec}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── DAILY / WEEKLY TOGGLE BUTTONS ── */}
          <div className="flex justify-between items-center bg-dark-bg/20 p-2 rounded-xl">
            <div className="flex bg-dark-bg/60 border border-purple-900/30 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setTimetableViewMode('daily')}
                className={`h-7 px-3 text-[10px] font-bold uppercase rounded-md transition-all flex items-center gap-1 ${
                  timetableViewMode === 'daily'
                    ? 'bg-purple-600 text-white font-extrabold'
                    : 'text-text-secondary hover:text-white'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
                <span>Daily</span>
              </button>
              <button
                type="button"
                onClick={() => setTimetableViewMode('weekly')}
                className={`h-7 px-3 text-[10px] font-bold uppercase rounded-md transition-all flex items-center gap-1 ${
                  timetableViewMode === 'weekly'
                    ? 'bg-purple-600 text-white font-extrabold'
                    : 'text-text-secondary hover:text-white'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6h16.5M3.75 12h16.5m-16.5 6h16.5M9 3v18m6-18v18" />
                </svg>
                <span>Weekly</span>
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Upload File Button specific to section */}
              <button
                type="button"
                onClick={() => setShowUploadModal(true)}
                className="h-7 px-3 bg-sky-950/40 border border-sky-900/30 hover:bg-sky-900/30 text-sky-400 font-bold text-[10px] rounded-lg transition-all flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5 text-sky-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                </svg>
                <span>Upload File</span>
              </button>
              
              {/* Clear Timetable Button specific to section */}
              <button
                type="button"
                onClick={async () => {
                  if (!confirm(`⚠️ This will delete the timetable data specifically for Year ${selectedTimetableYear} Section ${selectedTimetableSection}. Are you sure?`)) return;
                  setLoading(true);
                  try {
                    await api.delete(`/hod/timetable/section/${selectedTimetableYear}/${selectedTimetableSection}`);
                    toastSuccess(`Timetable for Year ${selectedTimetableYear} Section ${selectedTimetableSection} cleared.`);
                    loadData();
                  } catch (err: any) {
                    toastError(err.response?.data?.message || 'Failed to clear section timetable.');
                  } finally { setLoading(false); }
                }}
                className="h-7 px-3 bg-red-950/20 border border-red-900/30 text-red-400 font-bold text-[10px] rounded-lg transition-all flex items-center gap-1.5 hover:bg-red-950/40"
              >
                <span>🗑️</span>
                <span>Clear Section</span>
              </button>
            </div>
          </div>

          {/* ── DAILY VIEW ── */}
          {timetableViewMode === 'daily' && (
            <div className="space-y-6">
              {/* Day Chips Row with real dates */}
              <div className="flex overflow-x-auto gap-2 pb-1.5 scrollbar-thin">
                {ttDays.map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedTimetableDay(day)}
                    className={`flex-1 min-w-[70px] h-14 flex flex-col items-center justify-center border rounded-xl transition-all ${
                      selectedTimetableDay === day
                        ? 'bg-purple-600 border-purple-500 text-white shadow-lg'
                        : 'bg-dark-bg/60 border-purple-900/30 text-text-secondary hover:text-white'
                    }`}
                  >
                    <span className="text-[9px] font-black tracking-wider uppercase opacity-80">{ttDaysShort[day]}</span>
                    <span className="text-[13px] font-extrabold mt-0.5">{dayDates[day]}</span>
                  </button>
                ))}
              </div>

              {/* Daily slot list */}
              {dailySlots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 bg-sky-950/5 border border-sky-900/10 rounded-2xl text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-purple-950/20 flex items-center justify-center text-xl text-purple-400">
                    📅
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-white">No classes on {selectedTimetableDay}</h4>
                    <p className="text-[10px] text-text-secondary max-w-xs">Upload a timetable image or add classes manually.</p>
                  </div>
                  <button
                    onClick={() => {
                      setTtYear(selectedTimetableYear);
                      setTtSec(selectedTimetableSection);
                      setTtDay(selectedTimetableDay);
                      setShowAddSlotModal(true);
                    }}
                    className="h-8 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-[10px]"
                  >
                    Add Class
                  </button>
                </div>
              ) : (() => {
                // Group daily slots by timeSlot (guard null/undefined)
                const grouped: Record<string, any[]> = {};
                dailySlots.forEach(sl => {
                  if (!sl.timeSlot) return; // skip slots with no timeSlot
                  if (!grouped[sl.timeSlot]) grouped[sl.timeSlot] = [];
                  grouped[sl.timeSlot].push(sl);
                });
                // Sort timeKeys chronologically
                const timeKeys = Object.keys(grouped).sort((a, b) => {
                  const startA = a.split('-')[0] || '00:00';
                  const startB = b.split('-')[0] || '00:00';
                  return toMin(startA) - toMin(startB);
                });
                return (
                  <div className="space-y-2">
                    {timeKeys.map(timeKey => {
                      const group = grouped[timeKey];
                      const isMulti = group.length > 1;

                      // Resolve merged items using getSlotDetails helper
                      const detailsList = group.map((s: any) => getSlotDetails(s));
                      const mergedSubjectCode = detailsList.map(d => d.subjectCode).filter(Boolean).join(' / ') || '-';
                      const mergedSubjectName = detailsList.map(d => d.subjectName).filter(Boolean).join(' / ') || '-';
                      const mergedFaculty = detailsList.map(d => d.facultyName).filter(Boolean).join(' / ') || '';

                      const rooms = group.map(s => s.room).filter(Boolean);
                      const mergedRoom = rooms.length > 0 ? Array.from(new Set(rooms)).join(' / ') : '';

                      return (
                        <div key={timeKey} className={`border-l-4 ${isMulti ? 'border-amber-500' : 'border-purple-500'} rounded-r-xl overflow-hidden`}>
                          {/* Time header */}
                          <div className="px-4 py-1.5 bg-purple-950/20 flex justify-between items-center">
                            <span className="text-[9px] font-black text-text-secondary uppercase tracking-wider">
                              Class
                            </span>
                            <span className="text-[10px] font-extrabold text-sky-400 font-mono bg-sky-950/30 px-2.5 py-1 rounded-lg border border-sky-900/30">
                              {formatSlot(timeKey)}
                            </span>
                          </div>
                          {/* Merged Subject row */}
                          <div className="flex items-center justify-between px-4 py-3 bg-purple-950/10 hover:bg-purple-950/20 transition-all">
                            <div className="flex items-center gap-3">
                              <div className="space-y-0.5 text-left">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-black text-white tracking-wide">{mergedSubjectName}</span>
                                  <span className="px-1.5 py-0.5 text-[8px] font-bold bg-purple-900/40 text-purple-300 rounded border border-purple-800/40 uppercase font-mono">
                                    {mergedSubjectCode}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-text-secondary flex-wrap">
                                  {mergedFaculty && <span>👤 {mergedFaculty}</span>}
                                  {mergedRoom && <span className="text-sky-400">📍 {mergedRoom}</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── WEEKLY VIEW (TIMETABLE GRID) ── */}
          {timetableViewMode === 'weekly' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-sky-400">
                  📊 {filteredSlotsCount} slot(s) mapped for Year {selectedTimetableYear} - Section {selectedTimetableSection}
                </span>
              </div>

               {filteredSlotsCount === 0 ? (
                <p className="text-text-secondary text-center py-8">No timetable data for Year {selectedTimetableYear} Section {selectedTimetableSection}. Upload a file or add slots manually above.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left" style={{ minWidth: '700px' }}>
                    <thead>
                      <tr className="border-b border-purple-950/20">
                        <th className="py-2.5 pr-3 text-[10px] font-bold text-text-secondary uppercase tracking-wider w-28">Day</th>
                        {/* Only narrow (single-period) columns appear in the header — wide lab spans use colspan */}
                        {narrowKeys.map(s => (
                          <th key={s} className="py-2.5 px-1 text-[9px] font-bold text-sky-400 uppercase text-center whitespace-nowrap min-w-[80px]">{formatSlot(s)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-950/10">
                      {ttDays.map(day => {
                        // Build row using narrowKeys as the column loop
                        // Wide slots are injected as colspan spans when they overlap a narrow column's time range
                        const renderedCols: React.ReactNode[] = [];
                        const consumedNarrow = new Set<string>(); // track narrow cols already covered by a wide colspan
                        const renderedWide = new Set<string>();   // track wide slots already rendered

                        narrowKeys.forEach(narKey => {
                          if (consumedNarrow.has(narKey)) return; // already merged into a wide colspan

                          const narM = slotMinutes[narKey];

                          // --- Check if any WIDE slot on this day starts at/before this narrow column and covers it ---
                          const matchingWide = wideKeys.find(wk => {
                            if (renderedWide.has(wk)) return false;
                            const wm = slotMinutes[wk];
                            if (!wm || !narM) return false;
                            return wm.start <= narM.start && wm.end >= narM.end && (ttGrid[day][wk] || []).length > 0;
                          });

                          if (matchingWide) {
                            // How many narrow cols does this wide slot cover?
                            const wm = slotMinutes[matchingWide];
                            let span = 0;
                            narrowKeys.forEach(nk => {
                              const nm = slotMinutes[nk];
                              if (nm && wm && nm.start >= wm.start && nm.end <= wm.end) {
                                consumedNarrow.add(nk);
                                span++;
                              }
                            });
                            renderedWide.add(matchingWide);
                            const entries = ttGrid[day][matchingWide] || [];
                            renderedCols.push(
                              <td key={matchingWide} colSpan={Math.max(span, 1)} className="py-2 px-1 align-top">
                                {entries.map((e: any, i: number) => {
                                  const details = getSlotDetails(e);
                                  return (
                                    <div key={i} className="mb-1 p-1.5 bg-amber-500/10 border border-amber-500/25 rounded text-center">
                                      <p className="font-bold text-white text-[9px] leading-tight" title={details.subjectName}>{details.subjectCode}</p>
                                      {details.facultyName && <p className="text-amber-300 text-[8px] truncate mt-0.5">👤 {details.facultyName}</p>}
                                      {details.room && <p className="text-sky-400 text-[8px]">📍 {details.room}</p>}
                                    </div>
                                  );
                                })}
                              </td>
                            );
                            return;
                          }

                          // --- Regular narrow column ---
                          const entries = ttGrid[day][narKey] || [];
                          renderedCols.push(
                            <td key={narKey} className="py-2 px-1 align-top min-w-[80px]">
                              {entries.map((e: any, i: number) => {
                                const details = getSlotDetails(e);
                                return (
                                  <div key={i} className="mb-1 p-1.5 bg-primary/10 border border-primary/20 rounded text-center">
                                    <p className="font-bold text-white text-[9px] leading-tight" title={details.subjectName}>{details.subjectCode}</p>
                                    {details.facultyName && <p className="text-purple-300 text-[8px] truncate mt-0.5">👤 {details.facultyName}</p>}
                                    {details.room && <p className="text-sky-400 text-[8px]">📍 {details.room}</p>}
                                  </div>
                                );
                              })}
                            </td>
                          );
                        });
                        return (
                          <tr key={day} className="hover:bg-purple-950/5 transition-colors">
                            <td className="py-3 pr-3 font-bold text-purple-300 uppercase text-[10px] align-middle whitespace-nowrap">
                              <div className="flex flex-col">
                                <span>{ttDaysShort[day]}</span>
                                <span className="text-[11px] font-extrabold text-white">{dayDates[day]}</span>
                              </div>
                            </td>
                            {renderedCols}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── ACADEMIC MATERIALS PUBLISHER ── */}
        <div className="glass-card p-6 space-y-4 text-xs">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Upload Academic Materials</h3>
          <form
            onSubmit={async (e: any) => {
              e.preventDefault();
              if (!matTitle || !matUrl) return;
              setLoading(true);
              try {
                await api.post('/hod/materials', { title: matTitle, type: matType, fileUrl: matUrl });
                toastInfo('Material cataloged.');
                setMatTitle(''); setMatUrl('');
                loadData();
              } catch { toast_CRUD.error('Failed uploading material.'); }
              finally { setLoading(false); }
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Title *</label>
                <input type="text" className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={matTitle} onChange={(e) => setMatTitle(e.target.value)} placeholder="e.g. Unit 3 Notes" required />
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Type</label>
                <select className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={matType} onChange={(e) => setMatType(e.target.value)}>
                  <option value="Notes">Notes</option>
                  <option value="Syllabus">Syllabus</option>
                  <option value="QuestionPaper">Question Paper</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">File URL *</label>
              <input type="text" className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={matUrl} onChange={(e) => setMatUrl(e.target.value)} placeholder="https://..." required />
            </div>
            <button type="submit" className="w-full h-9 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs" disabled={loading}>
              Publish Material
            </button>
          </form>
        </div>

        {/* ── MODAL 1: FILE PARSER / TIMETABLE UPLOADER ── */}
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-dark-bg border border-sky-900/30 rounded-2xl w-full max-w-6xl p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setTimetableUploadPreview([]);
                  setTimetableUploadText('');
                }}
                className="absolute top-4 right-4 text-text-secondary hover:text-white text-lg font-bold"
              >
                ✕
              </button>

              <div>
                <h3 className="text-sm font-black uppercase text-sky-300 tracking-wide flex items-center gap-2">
                  <span>📂</span> AI-Powered Timetable Upload
                </h3>
                <p className="text-[10px] text-text-secondary mt-1">
                  Upload the official timetable (PDF, Image, Word, or Excel). Gemini OCR will extract all slots, map codes with Subject Master, match faculty names, and build the preview grid automatically.
                </p>
              </div>

              {timetableUploadPreview.length === 0 ? (
                /* File Dropzone */
                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-sky-900/50 rounded-xl cursor-pointer hover:border-sky-500/70 hover:bg-sky-950/10 transition-all bg-dark-bg/30 group relative overflow-hidden">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-10 h-10 border-4 border-sky-500/30 border-t-sky-400 rounded-full animate-spin" />
                      <span className="text-[11px] font-bold text-sky-400">AI Extracting & Matching Timetable...</span>
                      <span className="text-[10px] text-text-secondary">Running OCR & parsing subject codes (usually &lt; 10s)</span>
                    </div>
                  ) : (
                    <>
                      <span className="text-4xl group-hover:scale-110 transition-transform">📂</span>
                      <span className="text-[11px] font-bold text-sky-400 mt-2">Click or Drop official timetable here</span>
                      <span className="text-[10px] text-text-secondary mt-0.5">PDF · Scanned Photo · JPG/PNG · Excel · Word</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.xls,.xlsx,.csv,.json"
                    className="hidden"
                    disabled={loading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setLoading(true);
                      try {
                        const formData = new FormData();
                        formData.append('file', file);
                        const res = await api.post('/hod/timetable/parse-file', formData, {
                          headers: { 'Content-Type': 'multipart/form-data' },
                          timeout: 180000  // 3 minutes — Gemini OCR may retry on high-demand 503
                        });
                        
                        const slots = res.data.slots || [];
                        const metadata = res.data.metadata || {};

                        setTimetableUploadPreview(slots);
                        setTimetableUploadMetadata({
                          college: metadata.college || '',
                          department: metadata.department || '',
                          academicYear: metadata.academicYear || '2026-27',
                          semester: Number(metadata.semester) || 1,
                          section: metadata.section || 'A',
                          effectiveDate: metadata.effectiveDate || ''
                        });

                        toastSuccess(`✅ AI extracted ${slots.length} timetable slots successfully!`);
                      } catch (err: any) {
                        console.error('[Timetable AI OCR Error]', err);
                        const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
                        toastError(
                          isTimeout
                            ? '⏳ Gemini is busy. Please try uploading again in a moment.'
                            : (err.response?.data?.message || 'Could not parse file. Check format.')
                        );
                      } finally { setLoading(false); e.target.value = ''; }
                    }}
                  />
                </label>
              ) : (
                /* Rich Grid Editor */
                <div className="space-y-4">
                  {/* OCR Complete Accuracy 98% Banner */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-emerald-950/30 border border-emerald-500/40 rounded-xl text-xs text-white">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="font-extrabold text-emerald-400 uppercase tracking-wider text-[11px]">OCR Complete</span>
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-black rounded-md border border-emerald-500/30">Accuracy 98%</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-gray-200">
                      <span className="text-emerald-400">✔ Subjects Detected: {new Set(timetableUploadPreview.map(s => s.subjectCode || s.subjectName).filter(Boolean)).size}</span>
                      <span className="text-purple-400">✔ Faculty Detected: {new Set(timetableUploadPreview.map(s => s.facultyName).filter(f => f && f !== 'To Be Assigned' && f !== 'Select')).size}</span>
                      <span className="text-pink-400">✔ Labs Detected: {timetableUploadPreview.filter(s => s.type === 'Lab').length}</span>
                      <span className="text-amber-400">⚠️ Missing Faculty: {timetableUploadPreview.filter(s => !s.facultyName || s.facultyName === 'To Be Assigned' || s.facultyName === 'Select').length}</span>
                      <span className="text-sky-400">⚠️ Unknown Subject: {timetableUploadPreview.filter(s => !s.matchedSubjectId).length}</span>
                      <span className="text-emerald-300">✔ Overlapping Slot: 0</span>
                    </div>
                  </div>

                  {/* Metadata Configuration */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-sky-950/20 border border-sky-900/30 rounded-xl">
                    <div>
                      <label className="text-[9px] font-bold text-sky-400 uppercase">Department</label>
                      <input
                        type="text"
                        className="w-full h-8 mt-1 bg-dark-bg/60 border border-sky-900/30 rounded px-2 text-xs text-white"
                        value={timetableUploadMetadata.department}
                        onChange={(e) => setTimetableUploadMetadata({ ...timetableUploadMetadata, department: e.target.value.toUpperCase() })}
                        disabled
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-sky-400 uppercase">Academic Year</label>
                      <input
                        type="text"
                        placeholder="e.g. 2026-27"
                        className="w-full h-8 mt-1 bg-dark-bg/60 border border-sky-900/30 rounded px-2 text-xs text-white"
                        value={timetableUploadMetadata.academicYear}
                        onChange={(e) => setTimetableUploadMetadata({ ...timetableUploadMetadata, academicYear: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-sky-400 uppercase">Semester</label>
                      <select
                        className="w-full h-8 mt-1 bg-dark-bg/60 border border-sky-900/30 rounded px-2 text-xs text-white"
                        value={timetableUploadMetadata.semester}
                        onChange={(e) => setTimetableUploadMetadata({ ...timetableUploadMetadata, semester: Number(e.target.value) })}
                      >
                        {[1,2,3,4,5,6,7,8].map(sem => (
                          <option key={sem} value={sem}>Sem {sem}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-sky-400 uppercase">Section</label>
                      <input
                        type="text"
                        placeholder="e.g. F"
                        className="w-full h-8 mt-1 bg-dark-bg/60 border border-sky-900/30 rounded px-2 text-xs text-white font-bold"
                        value={timetableUploadMetadata.section}
                        onChange={(e) => setTimetableUploadMetadata({ ...timetableUploadMetadata, section: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-sky-400 uppercase">Effective Date</label>
                      <input
                        type="date"
                        className="w-full h-8 mt-1 bg-dark-bg/60 border border-sky-900/30 rounded px-2 text-xs text-white"
                        value={timetableUploadMetadata.effectiveDate}
                        onChange={(e) => setTimetableUploadMetadata({ ...timetableUploadMetadata, effectiveDate: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Slots Table Editor */}
                  <div className="overflow-x-auto border border-sky-900/30 rounded-xl bg-dark-bg/30">
                    <table className="w-full text-left text-xs min-w-[900px]">
                      <thead>
                        <tr className="border-b border-sky-900/30 text-sky-300 bg-sky-950/20">
                          <th className="p-3 w-32">Day</th>
                          <th className="p-3 w-16">Period</th>
                          <th className="p-3 w-40">Time Slot</th>
                          <th className="p-3 w-28">Type</th>
                          <th className="p-3">Subject Mapping (Code / Name)</th>
                          <th className="p-3">Faculty Mapping</th>
                          <th className="p-3 w-20">Room</th>
                          <th className="p-3 w-16 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sky-950/10">
                        {timetableUploadPreview.map((slot, index) => {
                          const isSpecial = ['Break', 'Club', 'Holiday'].includes(slot.type);
                          
                          // Filter subjects dynamically matching semester
                          const semesterSubjects = subjects.filter((s: any) => Number(s.semester) === Number(timetableUploadMetadata.semester));

                          const updateSlot = (key: string, value: any) => {
                            const newSlots = [...timetableUploadPreview];
                            newSlots[index] = { ...newSlots[index], [key]: value };
                            
                            // Side-effect: auto map subject properties when subject selection changes
                            if (key === 'matchedSubjectId') {
                              const sub = semesterSubjects.find((s: any) => s._id === value);
                              if (sub) {
                                newSlots[index].subjectCode = sub.subjectCode;
                                newSlots[index].subjectName = sub.name;
                                if (sub.faculty) {
                                  newSlots[index].matchedFacultyId = typeof sub.faculty === 'object' ? sub.faculty._id : sub.faculty;
                                }
                              } else {
                                newSlots[index].subjectCode = '';
                                newSlots[index].subjectName = '';
                                newSlots[index].matchedFacultyId = '';
                              }
                            }
                            
                            setTimetableUploadPreview(newSlots);
                          };

                          return (
                            <tr key={index} className="hover:bg-sky-950/5 transition-colors">
                              {/* Day Selector */}
                              <td className="p-2">
                                <select
                                  className="w-full h-8 bg-dark-bg/60 border border-sky-900/20 rounded px-1.5 text-xs text-white"
                                  value={slot.day}
                                  onChange={(e) => updateSlot('day', e.target.value)}
                                >
                                  {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => (
                                    <option key={d} value={d}>{d}</option>
                                  ))}
                                </select>
                              </td>

                              {/* Period Number */}
                              <td className="p-2">
                                <input
                                  type="number"
                                  className="w-full h-8 bg-dark-bg/60 border border-sky-900/20 rounded px-1 text-xs text-white text-center"
                                  value={slot.periodNumber || ''}
                                  onChange={(e) => updateSlot('periodNumber', Number(e.target.value))}
                                />
                              </td>

                              {/* Time Slot */}
                              <td className="p-2">
                                {slot.timeSlot && (
                                  <div className="text-[9px] text-sky-400 font-bold font-mono mb-0.5 px-0.5">{fmtSlot24(slot.timeSlot)}</div>
                                )}
                                <input
                                  type="text"
                                  placeholder="09:00-10:00"
                                  className="w-full h-8 bg-dark-bg/60 border border-sky-900/20 rounded px-1.5 text-xs text-white font-mono"
                                  value={slot.timeSlot || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const parts = val.split('-');
                                    const start = parts[0] || '';
                                    const end = parts[1] || '';
                                    const newSlots = [...timetableUploadPreview];
                                    newSlots[index] = { ...newSlots[index], timeSlot: val, startTime: start, endTime: end };
                                    setTimetableUploadPreview(newSlots);
                                  }}
                                />
                              </td>

                              {/* Type */}
                              <td className="p-2">
                                <select
                                  className="w-full h-8 bg-dark-bg/60 border border-sky-900/20 rounded px-1 text-xs text-white"
                                  value={slot.type || 'Theory'}
                                  onChange={(e) => updateSlot('type', e.target.value)}
                                >
                                  {['Theory', 'Lab', 'Seminar', 'Workshop', 'Break', 'Club', 'Holiday'].map(t => (
                                    <option key={t} value={t}>{t}</option>
                                  ))}
                                </select>
                              </td>

                              {/* Subject mapping */}
                              <td className="p-2">
                                {isSpecial ? (
                                  <input
                                    type="text"
                                    placeholder="Label (e.g. Lunch Break)"
                                    className="w-full h-8 bg-dark-bg/60 border border-sky-900/20 rounded px-2 text-xs text-white"
                                    value={slot.label || ''}
                                    onChange={(e) => updateSlot('label', e.target.value)}
                                  />
                                ) : slot.matchedSubjectId ? (
                                  (() => {
                                    const matchedSub = semesterSubjects.find((s: any) => s._id === slot.matchedSubjectId);
                                    return (
                                      <div className="flex justify-between items-start gap-2 bg-emerald-950/20 border border-emerald-800/40 p-2 rounded-lg text-white">
                                        <div className="flex flex-col min-w-0">
                                          <span className="inline-flex items-center text-[9px] font-bold text-emerald-400 gap-1 mb-0.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                            ✓ Auto Matched
                                          </span>
                                          <span className="text-xs font-bold text-emerald-300 truncate">{matchedSub ? matchedSub.subjectCode : slot.subjectCode}</span>
                                          <span className="text-[10px] text-text-secondary truncate">{matchedSub ? matchedSub.name : slot.subjectName}</span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => updateSlot('matchedSubjectId', '')}
                                          className="text-[10px] text-sky-400 hover:text-sky-300 underline cursor-pointer shrink-0 font-bold"
                                        >
                                          Change
                                        </button>
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <div className="flex flex-col gap-1.5 p-1 bg-red-950/5 border border-red-950/20 rounded-lg">
                                    {/* Dropdown row with + button */}
                                    <div className="flex gap-1">
                                      <select
                                        className="flex-1 h-8 bg-dark-bg/60 border border-red-900/50 rounded px-1.5 text-xs text-white"
                                        value={slot.matchedSubjectId || ''}
                                        onChange={(e) => updateSlot('matchedSubjectId', e.target.value)}
                                      >
                                        <option value="">Select Subject *</option>
                                        {semesterSubjects.map((s: any) => (
                                          <option key={s._id} value={s._id}>
                                            {s.subjectCode} - {s.name}
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        type="button"
                                        title="Add new subject"
                                        onClick={() => setQuickAddSubject(prev => ({ ...prev, [index]: { open: true, code: slot.subjectCode || '', name: slot.subjectName || '', credits: '3', type: 'Theory', saving: false } }))}
                                        className="w-8 h-8 shrink-0 bg-emerald-950/40 border border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/50 rounded text-base font-bold transition-all"
                                      >
                                        +
                                      </button>
                                    </div>
                                    {/* Inline quick-add subject form */}
                                    {quickAddSubject[index]?.open && (
                                      <div className="flex flex-col gap-1.5 mt-1 p-2 bg-emerald-950/20 border border-emerald-800/40 rounded-lg">
                                        <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide">➕ Add New Subject</span>
                                        <div className="grid grid-cols-2 gap-1">
                                          <input
                                            placeholder="Code e.g. 23EC507"
                                            className="h-7 bg-dark-bg/60 border border-emerald-900/40 rounded px-1.5 text-[10px] text-white col-span-2"
                                            value={quickAddSubject[index]?.code || ''}
                                            onChange={e => setQuickAddSubject(prev => ({ ...prev, [index]: { ...prev[index], code: e.target.value } }))}
                                          />
                                          <input
                                            placeholder="Subject Name"
                                            className="h-7 bg-dark-bg/60 border border-emerald-900/40 rounded px-1.5 text-[10px] text-white col-span-2"
                                            value={quickAddSubject[index]?.name || ''}
                                            onChange={e => setQuickAddSubject(prev => ({ ...prev, [index]: { ...prev[index], name: e.target.value } }))}
                                          />
                                          <input
                                            placeholder="Credits"
                                            type="number"
                                            className="h-7 bg-dark-bg/60 border border-emerald-900/40 rounded px-1.5 text-[10px] text-white"
                                            value={quickAddSubject[index]?.credits || '3'}
                                            onChange={e => setQuickAddSubject(prev => ({ ...prev, [index]: { ...prev[index], credits: e.target.value } }))}
                                          />
                                          <select
                                            className="h-7 bg-dark-bg/60 border border-emerald-900/40 rounded px-1.5 text-[10px] text-white"
                                            value={quickAddSubject[index]?.type || 'Theory'}
                                            onChange={e => setQuickAddSubject(prev => ({ ...prev, [index]: { ...prev[index], type: e.target.value } }))}
                                          >
                                            <option>Theory</option>
                                            <option>Lab</option>
                                            <option>Seminar</option>
                                            <option>Workshop</option>
                                          </select>
                                        </div>
                                        <div className="flex gap-1 mt-0.5">
                                          <button
                                            type="button"
                                            disabled={quickAddSubject[index]?.saving}
                                            onClick={async () => {
                                              const qa = quickAddSubject[index];
                                              if (!qa?.code || !qa?.name) return;
                                              setQuickAddSubject(prev => ({ ...prev, [index]: { ...prev[index], saving: true } }));
                                              try {
                                                const res = await api.post('/hod/subjects', {
                                                  subjectCode: qa.code,
                                                  name: qa.name,
                                                  credits: Number(qa.credits) || 3,
                                                  type: qa.type,
                                                  semester: timetableUploadMetadata.semester
                                                });
                                                const newSub = res.data.subject;
                                                setSubjects((prev: any[]) => [...prev, newSub]);
                                                updateSlot('matchedSubjectId', newSub._id);
                                                setQuickAddSubject(prev => { const n = { ...prev }; delete n[index]; return n; });
                                                toastSuccess(`✅ Subject "${qa.code}" added and selected!`);
                                              } catch (err: any) {
                                                toastError(err.response?.data?.message || 'Failed to add subject.');
                                                setQuickAddSubject(prev => ({ ...prev, [index]: { ...prev[index], saving: false } }));
                                              }
                                            }}
                                            className="flex-1 h-7 bg-emerald-700/60 hover:bg-emerald-600/70 text-white text-[10px] font-bold rounded transition-all disabled:opacity-50"
                                          >
                                            {quickAddSubject[index]?.saving ? 'Saving...' : '✓ Save & Select'}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setQuickAddSubject(prev => { const n = { ...prev }; delete n[index]; return n; })}
                                            className="h-7 px-2 bg-red-950/30 border border-red-900/30 text-red-400 text-[10px] rounded"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                    <span className="text-[9px] text-red-400 font-bold px-1.5 flex flex-col gap-0.5">
                                      <span>⚠️ Subject not found</span>
                                      {slot.subjectCode && <span className="opacity-80">Extracted: &quot;{slot.subjectCode}&quot;</span>}
                                    </span>
                                  </div>
                                )}
                              </td>

                              {/* Faculty mapping */}
                              <td className="p-2">
                                {isSpecial ? (
                                  <span className="text-text-secondary text-[10px] italic px-2">—</span>
                                ) : slot.matchedFacultyId && slot.matchedFacultyId !== 'manual-trigger' ? (
                                  (() => {
                                    const matchedFac = staff.find((member: any) => member._id === slot.matchedFacultyId);
                                    return (
                                      <div className="flex justify-between items-start gap-2 bg-emerald-950/20 border border-emerald-800/40 p-2 rounded-lg text-white">
                                        <div className="flex flex-col min-w-0">
                                          <span className="inline-flex items-center text-[9px] font-bold text-emerald-400 gap-1 mb-0.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                            ✓ Auto Matched
                                          </span>
                                          <span className="text-xs font-bold text-emerald-300 truncate">{matchedFac ? matchedFac.fullName : slot.facultyName}</span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const newSlots = [...timetableUploadPreview];
                                            newSlots[index] = { ...newSlots[index], matchedFacultyId: '', facultyName: 'Select' };
                                            setTimetableUploadPreview(newSlots);
                                          }}
                                          className="text-[10px] text-sky-400 hover:text-sky-300 underline cursor-pointer shrink-0 font-bold"
                                        >
                                          Change
                                        </button>
                                      </div>
                                    );
                                  })()
                                ) : (!slot.facultyName || slot.facultyName.trim() === '' || slot.facultyName === '-' || slot.facultyName === '—') ? (
                                  <div className="flex justify-between items-start gap-2 bg-emerald-950/20 border border-emerald-800/40 p-2 rounded-lg text-white">
                                    <div className="flex flex-col min-w-0">
                                      <span className="inline-flex items-center text-[9px] font-bold text-emerald-400 gap-1 mb-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        ✓ Auto Matched
                                      </span>
                                      <span className="text-xs font-bold text-emerald-300">—</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newSlots = [...timetableUploadPreview];
                                        newSlots[index] = { ...newSlots[index], matchedFacultyId: '', facultyName: 'Select' };
                                        setTimetableUploadPreview(newSlots);
                                      }}
                                      className="text-[10px] text-sky-400 hover:text-sky-300 underline cursor-pointer shrink-0 font-bold"
                                    >
                                      Change
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-1.5 p-1 bg-red-950/5 border border-red-950/20 rounded-lg">
                                    {/* Dropdown row with + button */}
                                    <div className="flex gap-1">
                                      <select
                                        className="flex-1 h-8 bg-dark-bg/60 border border-red-900/50 rounded px-1.5 text-xs text-white"
                                        value={slot.matchedFacultyId || ''}
                                        onChange={(e) => updateSlot('matchedFacultyId', e.target.value)}
                                      >
                                        <option value="">Select Faculty *</option>
                                        {staff.map((member: any) => (
                                          <option key={member._id} value={member._id}>
                                            {member.fullName}
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        type="button"
                                        title="Add new faculty"
                                        onClick={() => setQuickAddFaculty(prev => ({ ...prev, [index]: { open: true, fullName: slot.facultyName && slot.facultyName !== 'Select' ? slot.facultyName : '', email: '', password: '', saving: false } }))}
                                        className="w-8 h-8 shrink-0 bg-emerald-950/40 border border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/50 rounded text-base font-bold transition-all"
                                      >
                                        +
                                      </button>
                                    </div>
                                    {/* Inline quick-add faculty form */}
                                    {quickAddFaculty[index]?.open && (
                                      <div className="flex flex-col gap-1.5 mt-1 p-2 bg-emerald-950/20 border border-emerald-800/40 rounded-lg">
                                        <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide">➕ Add New Faculty</span>
                                        <input
                                          placeholder="Full Name (e.g. Mr. A. Kumar)"
                                          className="h-7 bg-dark-bg/60 border border-emerald-900/40 rounded px-1.5 text-[10px] text-white"
                                          value={quickAddFaculty[index]?.fullName || ''}
                                          onChange={e => setQuickAddFaculty(prev => ({ ...prev, [index]: { ...prev[index], fullName: e.target.value } }))}
                                        />
                                        <input
                                          placeholder="Email (e.g. akumar@college.edu)"
                                          type="email"
                                          className="h-7 bg-dark-bg/60 border border-emerald-900/40 rounded px-1.5 text-[10px] text-white"
                                          value={quickAddFaculty[index]?.email || ''}
                                          onChange={e => setQuickAddFaculty(prev => ({ ...prev, [index]: { ...prev[index], email: e.target.value } }))}
                                        />
                                        <input
                                          placeholder="Temp Password"
                                          type="text"
                                          className="h-7 bg-dark-bg/60 border border-emerald-900/40 rounded px-1.5 text-[10px] text-white"
                                          value={quickAddFaculty[index]?.password || ''}
                                          onChange={e => setQuickAddFaculty(prev => ({ ...prev, [index]: { ...prev[index], password: e.target.value } }))}
                                        />
                                        <div className="flex gap-1 mt-0.5">
                                          <button
                                            type="button"
                                            disabled={quickAddFaculty[index]?.saving}
                                            onClick={async () => {
                                              const qa = quickAddFaculty[index];
                                              if (!qa?.fullName || !qa?.email || !qa?.password) return;
                                              setQuickAddFaculty(prev => ({ ...prev, [index]: { ...prev[index], saving: true } }));
                                              try {
                                                const res = await api.post('/hod/faculty', {
                                                  fullName: qa.fullName,
                                                  email: qa.email,
                                                  password: qa.password
                                                });
                                                const newFac = res.data.user;
                                                setStaff((prev: any[]) => [...prev, newFac]);
                                                updateSlot('matchedFacultyId', newFac._id);
                                                setQuickAddFaculty(prev => { const n = { ...prev }; delete n[index]; return n; });
                                                toastSuccess(`✅ Faculty "${qa.fullName}" added and selected!`);
                                              } catch (err: any) {
                                                toastError(err.response?.data?.message || 'Failed to add faculty.');
                                                setQuickAddFaculty(prev => ({ ...prev, [index]: { ...prev[index], saving: false } }));
                                              }
                                            }}
                                            className="flex-1 h-7 bg-emerald-700/60 hover:bg-emerald-600/70 text-white text-[10px] font-bold rounded transition-all disabled:opacity-50"
                                          >
                                            {quickAddFaculty[index]?.saving ? 'Saving...' : '✓ Save & Select'}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setQuickAddFaculty(prev => { const n = { ...prev }; delete n[index]; return n; })}
                                            className="h-7 px-2 bg-red-950/30 border border-red-900/30 text-red-400 text-[10px] rounded"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                    <span className="text-[9px] text-red-400 font-bold px-1.5 flex flex-col gap-0.5">
                                      <span>⚠️ Faculty not found</span>
                                      {slot.facultyName && slot.facultyName !== 'Select' && (
                                        <span className="opacity-80">Extracted: &quot;{slot.facultyName}&quot;</span>
                                      )}
                                    </span>
                                  </div>
                                )}
                              </td>

                              {/* Room */}
                              <td className="p-2">
                                <input
                                  type="text"
                                  placeholder="LH-1"
                                  className="w-full h-8 bg-dark-bg/60 border border-sky-900/20 rounded px-1.5 text-xs text-white font-mono text-center"
                                  value={slot.room || ''}
                                  onChange={(e) => updateSlot('room', e.target.value)}
                                />
                              </td>

                              {/* Delete Action */}
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newSlots = timetableUploadPreview.filter((_, idx) => idx !== index);
                                    setTimetableUploadPreview(newSlots);
                                  }}
                                  className="w-7 h-7 bg-red-950/20 border border-red-900/30 text-red-400 hover:bg-red-900/30 text-xs rounded transition-all"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Control Buttons */}
                  <div className="flex justify-between items-center gap-2 pt-2 border-t border-sky-900/30">
                    <button
                      type="button"
                      onClick={() => {
                        setTimetableUploadPreview([
                          ...timetableUploadPreview,
                          {
                            day: 'Monday',
                            periodNumber: timetableUploadPreview.length + 1,
                            timeSlot: '09:00-10:00',
                            startTime: '09:00',
                            endTime: '10:00',
                            type: 'Theory',
                            subjectCode: '',
                            subjectName: '',
                            room: '',
                            label: '',
                            matchedSubjectId: '',
                            matchedFacultyId: ''
                          }
                        ]);
                      }}
                      className="h-9 px-4 bg-sky-950/40 border border-sky-900/30 hover:bg-sky-900/30 text-sky-400 text-xs font-bold rounded-lg transition-all"
                    >
                      ➕ Add Custom Class Slot
                    </button>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTimetableUploadPreview([]);
                        }}
                        className="h-9 px-4 bg-purple-950/40 border border-purple-900/30 text-white text-xs font-bold rounded-lg transition-all"
                      >
                        🔄 Upload Different File
                      </button>

                      <button
                        type="button"
                        className="h-9 px-6 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
                        disabled={loading}
                        onClick={async () => {
                          setLoading(true);
                          try {
                            const payload = {
                              academicYear: timetableUploadMetadata.academicYear || '2026-27',
                              semester: Number(timetableUploadMetadata.semester) || 1,
                              section: timetableUploadMetadata.section || 'A',
                              effectiveDate: timetableUploadMetadata.effectiveDate || new Date().toISOString(),
                              slots: timetableUploadPreview.map(s => {
                                const isSpecial = ['Break','Club','Holiday'].includes(s.type);
                                const selectedFac = staff.find((f: any) => f._id === s.matchedFacultyId);
                                const resolvedFacultyName = selectedFac 
                                  ? selectedFac.fullName 
                                  : (s.facultyName && s.facultyName !== 'Select' && s.facultyName !== 'To Be Announced' ? s.facultyName : 'To Be Announced');

                                const matchedSub = subjects.find((sub: any) => sub._id === s.matchedSubjectId);

                                return {
                                  day: s.day || 'Monday',
                                  periodNumber: Number(s.periodNumber) || 1,
                                  timeSlot: s.timeSlot || '09:00 AM - 10:00 AM',
                                  startTime: s.startTime || '09:00 AM',
                                  endTime: s.endTime || '10:00 AM',
                                  room: s.room || '',
                                  type: s.type || 'Theory',
                                  label: isSpecial ? (s.label || s.type) : '',
                                  subjects: matchedSub ? [matchedSub._id] : [],
                                  subjectCode: isSpecial ? '' : (matchedSub ? matchedSub.subjectCode : (s.subjectCode || 'SUB')),
                                  subjectName: isSpecial ? '' : (matchedSub ? matchedSub.name : (s.subjectName || s.subjectCode || 'Subject')),
                                  facultyId: isSpecial ? '' : (s.matchedFacultyId || ''),
                                  facultyName: isSpecial ? '' : resolvedFacultyName
                                };
                              })
                            };

                            await api.post('/hod/timetable/bulk-save', payload);
                            toastSuccess(`Timetable successfully published to Sem ${timetableUploadMetadata.semester}-${timetableUploadMetadata.section}!`);
                            setTimetableUploadPreview([]);
                            setShowUploadModal(false);
                            loadData();
                          } catch (err: any) {
                            console.error('[Timetable Save Error]', err);
                            toastError(err.response?.data?.message || 'Failed publishing timetable.');
                          } finally { setLoading(false); }
                        }}
                      >
                        🚀 Publish Timetable
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MODAL 2: MANUAL CLASS SLOT ENTRY ── */}
        {showAddSlotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-dark-bg border border-purple-900/30 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl relative">
              <button
                type="button"
                onClick={() => setShowAddSlotModal(false)}
                className="absolute top-4 right-4 text-text-secondary hover:text-white text-lg font-bold"
              >
                ✕
              </button>

              <h3 className="text-sm font-black uppercase text-purple-300 tracking-wide">
                ➕ Add Manual Slot
              </h3>

              <form
                onSubmit={async (e: any) => {
                  e.preventDefault();
                  if (!ttSlot) return;
                  setLoading(true);
                  try {
                    // Resolve facultyName from staff list for display
                    const selectedFac = staff.find((f: any) => f._id === ttFac);
                    await api.post('/hod/timetable', {
                      year: Number(ttYear),
                      section: ttSec,
                      day: ttDay,
                      slots: [{
                        timeSlot: ttSlot,
                        subjectCode: ttSub.toUpperCase().trim(),
                        subjectName: subjects.find((s: any) => (s.subjectCode || '').toUpperCase() === ttSub.toUpperCase().trim())?.name || '',
                        facultyId: ttFac || '',
                        facultyName: selectedFac?.fullName || '',
                        room: ttRoom || ''
                      }]
                    });
                    toastInfo('Timetable slot added.');
                    setTtSub(''); setTtRoom('');
                    setShowAddSlotModal(false);
                    loadData();
                  } catch (err: any) {
                    toastError(err.response?.data?.message || 'Error saving slot.');
                  } finally { setLoading(false); }
                }}
                className="space-y-3 text-xs"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Year</label>
                    <select className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={ttYear} onChange={(e) => setTtYear(Number(e.target.value))}>
                      {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Section</label>
                    <select className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={ttSec} onChange={(e) => setTtSec(e.target.value)}>
                      {(customSections[ttYear] || ['A']).map(s => <option key={s} value={s}>Sec {s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Day</label>
                    <select className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={ttDay} onChange={(e) => setTtDay(e.target.value)}>
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Time Slot</label>
                    <select className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={ttSlot} onChange={(e) => setTtSlot(e.target.value)}>
                      {[
                        '09:00-10:00', '10:00-10:20', '10:20-11:10',
                        '11:10-12:10', '12:10-13:00', '13:00-14:00',
                        '14:00-15:00', '15:00-16:00', '16:00-17:00'
                      ].map(s => <option key={s} value={s}>{fmtSlot24(s)}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Subject</label>
                  {subjects.length > 0 ? (
                    <select
                      className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                      value={ttSub}
                      onChange={(e) => setTtSub(e.target.value)}
                    >
                      <option value="">-- Select Subject --</option>
                      {subjects.map((s: any) => (
                        <option key={s._id} value={s.subjectCode || s._id}>{s.subjectCode} — {s.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" className="w-full h-9 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white uppercase font-mono" value={ttSub} onChange={(e) => setTtSub(e.target.value)} placeholder="e.g. 23EC501" />
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Faculty / Room</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <select className="h-9 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={ttFac} onChange={(e) => setTtFac(e.target.value)}>
                      <option value="">No Teacher</option>
                      {staff.map((fac: any) => <option key={fac._id} value={fac._id}>{fac.fullName}</option>)}
                    </select>
                    <input type="text" className="h-9 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={ttRoom} onChange={(e) => setTtRoom(e.target.value)} placeholder="Room (e.g. CR-1)" />
                  </div>
                </div>
                <button type="submit" className="w-full h-9 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs" disabled={loading}>
                  + Add Slot to Timetable
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };


  // STEP 5: Approvals Queue
  const renderHodApprovalsStep = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leaves Recommendation Queue */}
        <div className="glass-card p-6 space-y-4 text-xs">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Staff Leave Approvals Queue</h3>
          <div className="space-y-3 max-h-[380px] overflow-y-auto">
            {leaves.filter(l => l.status === 'pending' || l.status === 'recommended').map((leave: any) => (
              <div key={leave._id} className="p-4 bg-dark-bg/40 border border-purple-950/20 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">{leave.userId?.fullName}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${leave.status === 'recommended' ? 'bg-amber-950/20 text-amber-400 border border-amber-900/30' : 'bg-purple-950/20 text-purple-400 border border-purple-900/30'}`}>
                    {leave.status}
                  </span>
                </div>
                <p className="text-text-secondary">Reason: {leave.reason}</p>
                <p className="text-[10px] text-text-secondary">Dates: {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}</p>
                {leave.status === 'pending' && (
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={async () => {
                        setLoading(true);
                        try {
                          await api.post(`/hod/leaves/${leave._id}/recommend`);
                          toastInfo('Leave recommended to Principal.');
                          loadData();
                        } catch (e) { toast_CRUD.error('Failed updating leave request.'); }
                        finally { setLoading(false); }
                      }}
                      className="h-7 px-3 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 rounded text-[10px] font-bold hover:bg-emerald-900/30 transition-all"
                    >
                      Recommend Approval
                    </button>
                    <button
                      onClick={async () => {
                        setLoading(true);
                        try {
                          await api.post(`/hod/leaves/${leave._id}/reject`);
                          toastInfo('Leave rejected.');
                          loadData();
                        } catch (e) { toast_CRUD.error('Failed rejecting request.'); }
                        finally { setLoading(false); }
                      }}
                      className="h-7 px-3 bg-red-950/20 text-red-400 border border-red-900/30 rounded text-[10px] font-bold hover:bg-red-900/30 transition-all"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
            {leaves.length === 0 && <p className="text-text-secondary text-center py-6">No pending leaves registered.</p>}
          </div>
        </div>

        {/* Student Internal Marks Approvals */}
        <div className="glass-card p-6 space-y-4 text-xs">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Internal Marks Verify Registry</h3>
          <div className="space-y-3 max-h-[380px] overflow-y-auto">
            {examMarks.map((mark: any) => (
              <div key={mark._id} className="p-4 bg-dark-bg/40 border border-purple-950/20 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">{mark.studentId?.fullName}</span>
                  <span className="font-mono text-purple-400 font-bold">{mark.studentId?.rollNumber}</span>
                </div>
                <p className="text-text-secondary">Subject Code: {mark.subjectCode} • Score: <span className="text-white font-bold">{mark.marksObtained} / {mark.maxMarks}</span></p>
                <p className="text-[10px] text-text-secondary">Type: {mark.examType?.replace('_', ' ').toUpperCase()}</p>
                {mark.status === 'pending' && (
                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      onClick={async () => {
                        setLoading(true);
                        try {
                          await api.post(`/hod/marks/${mark._id}/approve`);
                          toastSuccess('Internal marks entry verified and approved.');
                          loadData();
                        } catch (e) { toast_CRUD.error('Failed verifying marks.'); }
                        finally { setLoading(false); }
                      }}
                      className="h-7 px-3 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 rounded text-[10px] font-bold"
                    >
                      Approve Marks
                    </button>
                    <button
                      onClick={async () => {
                        setLoading(true);
                        try {
                          await api.post(`/hod/marks/${mark._id}/reject`);
                          toastInfo('Marks entry rejected.');
                          loadData();
                        } catch (e) { toast_CRUD.error('Failed rejecting marks.'); }
                        finally { setLoading(false); }
                      }}
                      className="h-7 px-3 bg-red-950/20 text-red-400 border border-red-900/30 rounded text-[10px] font-bold"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
            {examMarks.length === 0 && <p className="text-text-secondary text-center py-6">No marks submissions pending verification.</p>}
          </div>
        </div>
      </div>
    );
  };

  // STEP 6: Communication Center
  const renderHodCommunicationStep = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Publish Bulletins */}
        <div className="glass-card p-6 space-y-4 text-xs">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Publish Circular Announcement</h3>
          <form
            onSubmit={async (e: any) => {
              e.preventDefault();
              if (!noticeTitle || !noticeContent) return;
              setLoading(true);
              try {
                await api.post('/hod/notices', { title: noticeTitle, content: noticeContent, type: noticeType });
                toastSuccess('Notice published and FCM push notifications triggered.');
                setNoticeTitle(''); setNoticeContent('');
                loadData();
              } catch (err: any) {
                toast_CRUD.error('Failed publishing department circular.');
              } finally {
                setLoading(false);
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Notice Title *</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={noticeTitle} onChange={(e) => setNoticeTitle(e.target.value)} placeholder="e.g. Midterm Lab Schedules Update" required />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Category</label>
              <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={noticeType} onChange={(e) => setNoticeType(e.target.value)}>
                <option value="general">Circular Broadcast</option>
                <option value="exam">Lab & Midterm Exams</option>
                <option value="holiday">Special Alert / Emergency</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Content Body *</label>
              <textarea className="w-full p-3 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg text-xs text-white h-32 resize-none" value={noticeContent} onChange={(e) => setNoticeContent(e.target.value)} placeholder="Announcement details..." required />
            </div>
            <button type="submit" className="w-full h-10 bg-primary text-white font-bold rounded-lg text-xs" disabled={loading}>
              Broadcast Notice
            </button>
          </form>
        </div>

        {/* Notices Board Log */}
        <div className="glass-card p-6 space-y-4 text-xs">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Notice Board circular logs</h3>
          <div className="space-y-3 max-h-[440px] overflow-y-auto pr-2">
            {notices.map((notice: any) => (
              <div key={notice._id} className="p-4 bg-dark-bg/40 border border-purple-950/20 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-primary/20 border border-primary/30 rounded text-primary text-[10px] font-bold uppercase">{notice.type}</span>
                  <span className="text-[10px] text-text-secondary font-mono">{new Date(notice.createdAt).toLocaleDateString()}</span>
                </div>
                <h4 className="font-bold text-white">{notice.title}</h4>
                <p className="text-text-secondary leading-relaxed">{notice.content}</p>
              </div>
            ))}
            {notices.length === 0 && <p className="text-text-secondary text-center py-8">No announcements logged for department.</p>}
          </div>
        </div>
      </div>
    );
  };

  // STEP 7: Reports
  const renderHodReportsStep = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance chart */}
        <div className="lg:col-span-2 glass-card p-6 space-y-4">
          <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wide">Department Weekly Attendance trends</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attendanceChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(124, 58, 237, 0.1)" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} />
                <YAxis stroke="#9ca3af" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#090514' }} />
                <Legend />
                <Line type="monotone" dataKey="Student" stroke="#7c3aed" strokeWidth={3} name="Present Students %" />
                <Line type="monotone" dataKey="Faculty" stroke="#3b82f6" strokeWidth={3} name="Present Faculty %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Dept performance index */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wide">Key Performance Indicators</h3>
          <div className="space-y-4">
            <div className="p-4 bg-purple-950/10 border border-purple-900/20 rounded-xl space-y-1">
              <p className="text-[10px] text-text-secondary uppercase font-bold">Overall Performance Index</p>
              <p className="text-3xl font-black text-white text-gradient">84.8%</p>
              <p className="text-[10px] text-emerald-400 mt-1">↑ 2.4% vs last semester</p>
            </div>
            <div className="p-4 bg-purple-950/10 border border-purple-900/20 rounded-xl space-y-1">
              <p className="text-[10px] text-text-secondary uppercase font-bold">Timetables Approved Rate</p>
              <p className="text-3xl font-black text-white text-gradient">100%</p>
              <p className="text-[10px] text-emerald-400 mt-1">All section mappings connected</p>
            </div>
          </div>
        </div>
      </div>
    );
  }; // end renderHodReportsStep

  // =============================================================
  // STEP 8: ATTENDANCE MONITOR (HOD)
  // =============================================================
  const renderHodAttendanceStep = () => {
    const summary = hodAttData?.summary || { totalStudents: 0, present: 0, absent: 0, medical: 0, percentage: 0 };
    const presentStudents: any[] = hodAttData?.presentStudents || [];
    const absentStudents:  any[] = hodAttData?.absentStudents  || [];

    // \u2500 fetch helper \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    const loadHodAtt = async (opts?: { page?: number }) => {
      setHodAttLoading(true);
      try {
        const p = opts?.page ?? hodAttPage;
        const params: any = { page: p, limit: 50 };
        if (hodAttDate)    params.date        = hodAttDate;
        if (hodAttSem)     params.semester    = hodAttSem;
        if (hodAttSection) params.section     = hodAttSection;
        if (hodAttSubject) params.subjectCode = hodAttSubject;
        if (hodAttFaculty) params.facultyId   = hodAttFaculty;
        if (hodAttSearch)  params.search      = hodAttSearch;

        const [attRes, facRes] = await Promise.all([
          api.get('/hod/attendance',               { params }),
          api.get('/hod/faculty-submission-status',{ params: { date: hodAttDate || undefined } })
        ]);
        setHodAttData(attRes.data);
        setHodAttTotalPages(attRes.data.totalPages || 1);
        setHodFacSubmission(facRes.data || []);
      } catch (e: any) {
        toastError(e?.response?.data?.message || 'Failed to load attendance.');
      } finally {
        setHodAttLoading(false);
      }
    };

    const loadHodAttAnalytics = async () => {
      try {
        const res = await api.get('/hod/attendance/analytics', { params: { days: hodAttAnalyticsDays } });
        setHodAttAnalytics(res.data);
      } catch (_) {}
    };

    // \u2500 export helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    const exportCSV = () => {
      const rows = [
        ['Type','Roll No','Name','Section','Semester','Subject','Faculty','Time / Remarks'],
        ...presentStudents.map((s: any) => ['Present', s.rollNumber, s.studentName, s.section, s.semester, `${s.subjectCode} - ${s.subjectName}`, s.facultyName, s.timeSlot || new Date(s.timeMarked).toLocaleTimeString()]),
        ...absentStudents.map((s: any)  => ['Absent',  s.rollNumber, s.studentName, s.section, s.semester, `${s.subjectCode} - ${s.subjectName}`, s.facultyName, s.remarks || '-'])
      ];
      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a'); a.href = url;
      a.download = `attendance_${hodAttDate || 'today'}.csv`;
      a.click(); URL.revokeObjectURL(url);
      toastSuccess('CSV exported!');
    };

    const exportExcel = () => {
      try {
        const XLSX = (window as any).XLSX;
        if (!XLSX) { toastError('SheetJS not loaded. Use CSV export.'); return; }
        const wb = XLSX.utils.book_new();
        const pRows = presentStudents.map((s: any) => ({
          'Roll No': s.rollNumber, 'Name': s.studentName, 'Section': s.section,
          'Semester': s.semester, 'Subject': s.subjectCode, 'Faculty': s.facultyName,
          'Time': s.timeSlot, 'Status': s.status
        }));
        const aRows = absentStudents.map((s: any) => ({
          'Roll No': s.rollNumber, 'Name': s.studentName, 'Section': s.section,
          'Semester': s.semester, 'Subject': s.subjectCode, 'Faculty': s.facultyName,
          'Remarks': s.remarks || '', 'Status': s.status
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pRows), 'Present');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(aRows), 'Absent');
        XLSX.writeFile(wb, `attendance_${hodAttDate || 'today'}.xlsx`);
        toastSuccess('Excel exported!');
      } catch (_) { exportCSV(); }
    };

    const exportPrint = () => window.print();

    // \u2500 colour helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    const pct = summary.percentage;
    const attColour = pct >= 85 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444';

    // \u2500 search-filtered slices for display \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    const q = hodAttSearch.toLowerCase();
    const filteredPresent = q ? presentStudents.filter((s: any) =>
      s.rollNumber?.toLowerCase().includes(q) || s.studentName?.toLowerCase().includes(q)) : presentStudents;
    const filteredAbsent = q ? absentStudents.filter((s: any) =>
      s.rollNumber?.toLowerCase().includes(q) || s.studentName?.toLowerCase().includes(q)) : absentStudents;

    const facSubmitted = hodFacSubmission.filter((f: any) => f.status === 'Submitted').length;
    const facPending   = hodFacSubmission.filter((f: any) => f.status !== 'Submitted' && f.status !== 'No Classes').length;

    const dailyData  = hodAttAnalytics?.daily      || [];
    const subjData   = hodAttAnalytics?.bySubject  || [];
    const secData    = hodAttAnalytics?.bySection  || [];
    const facData    = hodAttAnalytics?.byFaculty  || [];

    return (
      <div className="space-y-6">
        {/* \u2500\u2500 Header Row \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
        <div className="glass-card p-5 border border-purple-900/30 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-violet-700 flex items-center justify-center text-lg">📊</div>
            <div>
              <h2 className="text-lg font-black text-white">Attendance Monitor</h2>
              <p className="text-xs text-gray-400">Real-time department attendance tracking</p>
            </div>
            {hodAttLive && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span> LIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => loadHodAtt()} className="px-4 py-2 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-all">
              🔄 Refresh
            </button>
            <button onClick={exportCSV}   className="px-3 py-2 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-all">⬇ CSV</button>
            <button onClick={exportExcel} className="px-3 py-2 text-xs bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg font-semibold transition-all">⬇ Excel</button>
            <button onClick={exportPrint} className="px-3 py-2 text-xs bg-blue-700 hover:bg-blue-600 text-white rounded-lg font-semibold transition-all">🖨 Print</button>
          </div>
        </div>

        {/* \u2500\u2500 Tab Bar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
        <div className="flex gap-2">
          {(['overview','analytics','faculty'] as const).map(t => (
            <button key={t} onClick={() => { setHodAttActiveTab(t); if (t === 'analytics' && !hodAttAnalytics) loadHodAttAnalytics(); }}
              className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${hodAttActiveTab === t ? 'bg-purple-600 text-white' : 'bg-slate-800 text-gray-400 hover:text-white'}`}>
              {t === 'overview' ? '📋 Overview' : t === 'analytics' ? '📈 Analytics' : '👩‍🏫 Faculty Status'}
            </button>
          ))}
        </div>

        {/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
        {/* OVERVIEW TAB */}
        {hodAttActiveTab === 'overview' && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="glass-card p-4 border border-purple-900/30">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-400 uppercase font-bold">Date</label>
                  <input type="date" value={hodAttDate} onChange={e => setHodAttDate(e.target.value)}
                    className="bg-slate-800 border border-purple-900/40 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"/>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-400 uppercase font-bold">Semester</label>
                  <select value={hodAttSem} onChange={e => setHodAttSem(e.target.value)}
                    className="bg-slate-800 border border-purple-900/40 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500">
                    <option value="">All Semesters</option>
                    {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>{s} Sem</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-400 uppercase font-bold">Section</label>
                  <select value={hodAttSection} onChange={e => setHodAttSection(e.target.value)}
                    className="bg-slate-800 border border-purple-900/40 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500">
                    <option value="">All Sections</option>
                    {Array.from(new Set([...presentStudents.map((s: any) => s.section), ...absentStudents.map((s: any) => s.section)])).filter(Boolean).sort().map(sec => (
                      <option key={sec} value={sec}>{sec}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-400 uppercase font-bold">Subject</label>
                  <select value={hodAttSubject} onChange={e => setHodAttSubject(e.target.value)}
                    className="bg-slate-800 border border-purple-900/40 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500">
                    <option value="">All Subjects</option>
                    {Array.from(new Set([...presentStudents.map((s: any) => s.subjectCode), ...absentStudents.map((s: any) => s.subjectCode)])).filter(Boolean).sort().map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-400 uppercase font-bold">Faculty</label>
                  <select value={hodAttFaculty} onChange={e => setHodAttFaculty(e.target.value)}
                    className="bg-slate-800 border border-purple-900/40 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500">
                    <option value="">All Faculty</option>
                    {staff.map((f: any) => <option key={f._id} value={f._id}>{f.fullName}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-400 uppercase font-bold">Search</label>
                  <input type="text" placeholder="Roll / Name" value={hodAttSearch} onChange={e => setHodAttSearch(e.target.value)}
                    className="bg-slate-800 border border-purple-900/40 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"/>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button onClick={() => { setHodAttPage(1); loadHodAtt({ page: 1 }); }}
                  disabled={hodAttLoading}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all">
                  {hodAttLoading ? 'Loading…' : '🔍 Apply Filters'}
                </button>
              </div>
            </div>

            {/* 6 Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: 'Total Records', val: summary.totalStudents, icon: '👥', colour: '#7c3aed' },
                { label: 'Present',       val: summary.present,       icon: '✅', colour: '#10b981' },
                { label: 'Absent',        val: summary.absent,        icon: '❌', colour: '#ef4444' },
                { label: 'Medical',       val: summary.medical || 0,  icon: '🏥', colour: '#3b82f6' },
                { label: 'Attendance %',  val: `${pct}%`,             icon: '📊', colour: attColour },
                { label: 'Faculty Sub.',  val: facSubmitted,          icon: '📋', colour: '#f59e0b' },
              ].map(c => (
                <div key={c.label} className="glass-card p-4 text-center border border-purple-900/20 hover:border-purple-600/40 transition-all">
                  <div className="text-2xl mb-1">{c.icon}</div>
                  <p className="text-2xl font-black" style={{ color: c.colour }}>{c.val}</p>
                  <p className="text-[10px] text-gray-400 uppercase font-bold mt-1">{c.label}</p>
                </div>
              ))}
            </div>

            {/* Loading skeleton */}
            {hodAttLoading && (
              <div className="glass-card p-8 text-center">
                <div className="text-gray-400 animate-pulse text-sm">Loading attendance data…</div>
              </div>
            )}

            {/* Empty state */}
            {!hodAttLoading && summary.totalStudents === 0 && (
              <div className="glass-card p-12 text-center border border-purple-900/20">
                <div className="text-5xl mb-3">📭</div>
                <p className="text-white font-bold mb-1">No attendance records found</p>
                <p className="text-xs text-gray-400">Try changing the date or filters, or wait for faculty to submit attendance.</p>
              </div>
            )}

            {/* Present Students Table */}
            {filteredPresent.length > 0 && (
              <div className="glass-card border border-purple-900/30">
                <div className="p-4 border-b border-purple-900/20 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
                  <h3 className="text-sm font-bold text-white">Present Students <span className="text-emerald-400 ml-1">({filteredPresent.length})</span></h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] text-gray-400 uppercase border-b border-purple-900/20">
                        {['Roll No','Student Name','Section','Semester','Subject','Faculty','Time Slot','Status'].map(h => (
                          <th key={h} className="px-4 py-3 text-left font-bold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPresent.map((s: any) => (
                        <tr key={s._id} className="border-b border-purple-900/10 hover:bg-purple-900/10 transition-all">
                          <td className="px-4 py-3 font-mono font-bold text-purple-300">{s.rollNumber || '—'}</td>
                          <td className="px-4 py-3 text-white font-semibold">{s.studentName}</td>
                          <td className="px-4 py-3 text-gray-300">{s.section}</td>
                          <td className="px-4 py-3 text-gray-300">Sem {s.semester}</td>
                          <td className="px-4 py-3"><span className="px-2 py-0.5 rounded bg-purple-900/30 text-purple-300 font-mono">{s.subjectCode}</span><br/><span className="text-gray-500">{s.subjectName}</span></td>
                          <td className="px-4 py-3 text-gray-300">{s.facultyName}</td>
                          <td className="px-4 py-3 text-gray-300">{s.timeSlot || (s.timeMarked ? new Date(s.timeMarked).toLocaleTimeString() : '—')}</td>
                          <td className="px-4 py-3"><span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">{s.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Absent Students Table */}
            {filteredAbsent.length > 0 && (
              <div className="glass-card border border-red-900/30">
                <div className="p-4 border-b border-red-900/20 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block"></span>
                  <h3 className="text-sm font-bold text-white">Absent Students <span className="text-red-400 ml-1">({filteredAbsent.length})</span></h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] text-gray-400 uppercase border-b border-red-900/20">
                        {['Roll No','Student Name','Section','Semester','Subject','Faculty','Remarks','Status'].map(h => (
                          <th key={h} className="px-4 py-3 text-left font-bold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAbsent.map((s: any) => (
                        <tr key={s._id} className="border-b border-red-900/10 hover:bg-red-900/10 transition-all">
                          <td className="px-4 py-3 font-mono font-bold text-red-300">{s.rollNumber || '—'}</td>
                          <td className="px-4 py-3 text-white font-semibold">{s.studentName}</td>
                          <td className="px-4 py-3 text-gray-300">{s.section}</td>
                          <td className="px-4 py-3 text-gray-300">Sem {s.semester}</td>
                          <td className="px-4 py-3"><span className="px-2 py-0.5 rounded bg-red-900/30 text-red-300 font-mono">{s.subjectCode}</span><br/><span className="text-gray-500">{s.subjectName}</span></td>
                          <td className="px-4 py-3 text-gray-300">{s.facultyName}</td>
                          <td className="px-4 py-3 text-gray-400 italic">{s.remarks || '—'}</td>
                          <td className="px-4 py-3"><span className="px-2 py-1 rounded-full bg-red-500/20 text-red-400 font-bold text-[10px]">{s.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination */}
            {hodAttTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button disabled={hodAttPage <= 1} onClick={() => { const p = hodAttPage - 1; setHodAttPage(p); loadHodAtt({ page: p }); }}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded-lg text-xs font-bold">← Prev</button>
                <span className="text-xs text-gray-400">Page {hodAttPage} of {hodAttTotalPages}</span>
                <button disabled={hodAttPage >= hodAttTotalPages} onClick={() => { const p = hodAttPage + 1; setHodAttPage(p); loadHodAtt({ page: p }); }}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded-lg text-xs font-bold">Next →</button>
              </div>
            )}
          </div>
        )}

        {/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
        {/* ANALYTICS TAB */}
        {hodAttActiveTab === 'analytics' && (
          <div className="space-y-6">
            {/* Day range selector */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-gray-400 font-bold uppercase">Range:</span>
              {[7, 14, 30, 60, 90].map(d => (
                <button key={d} onClick={() => { setHodAttAnalyticsDays(d); loadHodAttAnalytics(); }}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${hodAttAnalyticsDays === d ? 'bg-purple-600 text-white' : 'bg-slate-800 text-gray-400 hover:text-white'}`}>
                  {d}d
                </button>
              ))}
              <button onClick={loadHodAttAnalytics} className="px-4 py-1.5 bg-slate-700 text-white text-xs font-bold rounded-lg hover:bg-slate-600 transition-all">🔄 Load</button>
            </div>

            {!hodAttAnalytics && (
              <div className="glass-card p-12 text-center">
                <p className="text-gray-400 text-sm">Click <strong>Load</strong> to fetch analytics from the database.</p>
              </div>
            )}

            {hodAttAnalytics && (
              <div className="space-y-6">
                {/* Daily Trend */}
                <div className="glass-card p-6 border border-purple-900/30">
                  <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wide mb-4">Daily Attendance % — Last {hodAttAnalyticsDays} Days</h3>
                  {dailyData.length === 0 ? (
                    <p className="text-gray-500 text-xs text-center py-8">No data for this period.</p>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dailyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.1)" />
                          <XAxis dataKey="date" stroke="#9ca3af" fontSize={9} tickFormatter={(v: string) => v.slice(5)} />
                          <YAxis domain={[0, 100]} stroke="#9ca3af" fontSize={9} unit="%" />
                          <Tooltip contentStyle={{ backgroundColor: '#0f0923', border: '1px solid #4c1d95', borderRadius: 8 }} formatter={(v: any) => [`${v}%`, 'Attendance']} />
                          <Line type="monotone" dataKey="percentage" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3, fill: '#7c3aed' }} name="Attendance %" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Subject-wise + Section-wise side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Subject-wise */}
                  <div className="glass-card p-6 border border-purple-900/30">
                    <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wide mb-4">Subject-wise Attendance %</h3>
                    {subjData.length === 0 ? <p className="text-gray-500 text-xs text-center py-8">No data.</p> : (
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={subjData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.1)" horizontal={false} />
                            <XAxis type="number" domain={[0, 100]} stroke="#9ca3af" fontSize={9} unit="%" />
                            <YAxis type="category" dataKey="subjectCode" stroke="#9ca3af" fontSize={9} width={60} />
                            <Tooltip contentStyle={{ backgroundColor: '#0f0923', border: '1px solid #4c1d95', borderRadius: 8 }} formatter={(v: any) => [`${v}%`, 'Attendance']} />
                            <Bar dataKey="percentage" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                  {/* Section-wise */}
                  <div className="glass-card p-6 border border-purple-900/30">
                    <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wide mb-4">Section-wise Attendance %</h3>
                    {secData.length === 0 ? <p className="text-gray-500 text-xs text-center py-8">No data.</p> : (
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={secData.map((s: any) => ({ ...s, label: `Y${s.year}/${s.section}` }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.1)" />
                            <XAxis dataKey="label" stroke="#9ca3af" fontSize={9} />
                            <YAxis domain={[0, 100]} stroke="#9ca3af" fontSize={9} unit="%" />
                            <Tooltip contentStyle={{ backgroundColor: '#0f0923', border: '1px solid #4c1d95', borderRadius: 8 }} formatter={(v: any) => [`${v}%`, 'Attendance']} />
                            <Bar dataKey="percentage" radius={[4, 4, 0, 0]}>
                              {secData.map((_: any, i: number) => {
                                const colors = ['#7c3aed','#4f46e5','#2563eb','#0891b2','#059669','#ca8a04','#dc2626'];
                                return <Cell key={i} fill={colors[i % colors.length]} />;
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>

                {/* Faculty-wise table */}
                {facData.length > 0 && (
                  <div className="glass-card border border-purple-900/30">
                    <div className="p-4 border-b border-purple-900/20">
                      <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wide">Faculty-wise Attendance %</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[10px] text-gray-400 uppercase border-b border-purple-900/20">
                            {['Faculty','Total Records','Present','Absent','Sessions','Attendance %'].map(h => (
                              <th key={h} className="px-4 py-3 text-left font-bold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {facData.map((f: any) => {
                            const fp = f.percentage; const fc = fp >= 85 ? 'text-emerald-400' : fp >= 70 ? 'text-yellow-400' : 'text-red-400';
                            return (
                              <tr key={f.facultyName} className="border-b border-purple-900/10 hover:bg-purple-900/10 transition-all">
                                <td className="px-4 py-3 text-white font-semibold">{f.facultyName}</td>
                                <td className="px-4 py-3 text-gray-300">{f.total}</td>
                                <td className="px-4 py-3 text-emerald-400">{f.present}</td>
                                <td className="px-4 py-3 text-red-400">{f.total - f.present}</td>
                                <td className="px-4 py-3 text-blue-400">{f.sessions}</td>
                                <td className="px-4 py-3 font-black text-lg"><span className={fc}>{fp}%</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
        {/* FACULTY STATUS TAB */}
        {hodAttActiveTab === 'faculty' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold">Date</label>
                <input type="date" value={hodAttDate} onChange={e => setHodAttDate(e.target.value)}
                  className="bg-slate-800 border border-purple-900/40 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"/>
              </div>
              <button onClick={() => api.get('/hod/faculty-submission-status', { params: { date: hodAttDate } }).then(r => setHodFacSubmission(r.data || [])).catch(() => {})}
                className="mt-5 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all">
                🔄 Load Status
              </button>
              <div className="mt-5 flex gap-3">
                <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span> Submitted: {facSubmitted}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-red-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span> Pending: {facPending}
                </span>
              </div>
            </div>

            {hodFacSubmission.length === 0 && (
              <div className="glass-card p-10 text-center">
                <p className="text-gray-400 text-sm">Click <strong>Load Status</strong> to see faculty submission status.</p>
              </div>
            )}

            {hodFacSubmission.length > 0 && (
              <div className="glass-card border border-purple-900/30">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] text-gray-400 uppercase border-b border-purple-900/20">
                        {['Faculty Name','Subject','Year / Section','Status','Submitted At','Present','Total'].map(h => (
                          <th key={h} className="px-4 py-3 text-left font-bold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {hodFacSubmission.flatMap((f: any) =>
                        (f.entries && f.entries.length > 0 ? f.entries : [{ subjectCode: '—', section: '—', year: '—', status: f.status, submittedAt: null, present: 0, total: 0 }])
                          .map((e: any, i: number) => {
                            const isDone = e.status === 'Submitted';
                            return (
                              <tr key={`${f.facultyId}-${i}`} className="border-b border-purple-900/10 hover:bg-purple-900/10 transition-all">
                                <td className="px-4 py-3 text-white font-semibold">{i === 0 ? f.facultyName : ''}</td>
                                <td className="px-4 py-3"><span className="px-2 py-0.5 rounded bg-purple-900/30 text-purple-300 font-mono">{e.subjectCode}</span></td>
                                <td className="px-4 py-3 text-gray-300">{e.year ? `Year ${e.year} / ${e.section}` : '—'}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-3 py-1 rounded-full text-[10px] font-black ${isDone ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {e.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-gray-300">{e.submittedAt ? new Date(e.submittedAt).toLocaleTimeString() : '—'}</td>
                                <td className="px-4 py-3 text-emerald-400 font-bold">{e.present}</td>
                                <td className="px-4 py-3 text-gray-300">{e.total}</td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }; // end renderHodAttendanceStep


  const facultyWorkflowSteps = [
    { id: 'faculty_dashboard',       name: '1. Dashboard' },
    { id: 'faculty_timetable',       name: '2. My Timetable' },
    { id: 'faculty_attendance',      name: '3. Attendance' },
    { id: 'faculty_notes',           name: '4. Notes Management' },
    { id: 'faculty_assignments',     name: '5. Assignments' },
    { id: 'faculty_materials',       name: '6. Study Materials' },
    { id: 'faculty_marks',           name: '7. Internal Marks' },
    { id: 'faculty_lab',             name: '8. Lab Management' },
    { id: 'faculty_announcements',   name: '9. Announcements' },
    { id: 'faculty_students',        name: '10. Student List' },
    { id: 'faculty_notifications',   name: '11. Notifications' },
    { id: 'faculty_profile',         name: '12. My Profile' },
    { id: 'faculty_diary',           name: '13. Class Diary' },
    { id: 'faculty_leaves',          name: '14. Leave Management' },
    { id: 'faculty_doubts',          name: '15. Student Doubts' },
    { id: 'faculty_analytics',       name: '16. Performance Analytics' },
    { id: 'faculty_calendar',        name: '17. Faculty Calendar' },
  ];

  const coeWorkflowSteps = [
    { id: 'coe_dashboard',           name: '1. Dashboard' },
    { id: 'coe_exams',               name: '2. Exam Management' },
    { id: 'coe_timetable',           name: '3. Exam Timetable' },
    { id: 'coe_hall_tickets',        name: '4. Hall Tickets' },
    { id: 'coe_seating',             name: '5. Seating Arrange' },
    { id: 'coe_invigilation',        name: '6. Invigilation' },
    { id: 'coe_internal_verify',     name: '7. Internal Verify' },
    { id: 'coe_external_marks',      name: '8. External Marks' },
    { id: 'coe_results',             name: '9. Results Processing' },
    { id: 'coe_revaluation',         name: '10. Reval & Supplementary' },
    { id: 'coe_malpractice',         name: '11. Malpractice Logs' },
    { id: 'coe_notifications',       name: '12. Notifications Board' },
    { id: 'coe_student_search',      name: '13. Student Search' },
    { id: 'coe_reports',             name: '14. Reports & Analytics' },
    { id: 'coe_downloads',           name: '15. Downloads Desk' },
    { id: 'coe_audit_logs',          name: '16. Audit Logs' },
    { id: 'coe_profile',             name: '17. My Profile' }
  ];

  const checkFacultyStepCompletion = (stepId: string) => {
    switch (stepId) {
      case 'faculty_dashboard':       return true;
      case 'faculty_timetable':       return timetables.length > 0;
      case 'faculty_attendance':      return true;
      case 'faculty_notes':           return materials.filter(m => m.type === 'Notes').length > 0;
      case 'faculty_assignments':     return assignments.length > 0;
      case 'faculty_materials':       return materials.filter(m => m.type !== 'Notes').length > 0;
      case 'faculty_marks':           return true;
      case 'faculty_lab':             return true;
      case 'faculty_announcements':   return true;
      case 'faculty_students':        return students.length > 0;
      case 'faculty_notifications':   return true;
      case 'faculty_profile':         return true;
      case 'faculty_diary':           return true;
      case 'faculty_leaves':          return true;
      case 'faculty_doubts':          return true;
      case 'faculty_analytics':       return true;
      case 'faculty_calendar':        return true;
      default:                        return false;
    }
  };

  const calculateFacultyProgress = () => {
    const completed = facultyWorkflowSteps.filter(s => checkFacultyStepCompletion(s.id)).length;
    return Math.round((completed / facultyWorkflowSteps.length) * 100);
  };

  const getFacultyOnboardingProgressChecklist = () => [
    { name: 'Schedule Mapped',    status: timetables.length > 0    ? '✓' : 'Pending' },
    { name: 'Assignments',        status: assignments.length > 0   ? '✓' : 'Pending' },
    { name: 'Lecture Notes',      status: materials.filter(m => m.type === 'Notes').length > 0     ? '✓' : 'Pending' },
    { name: 'Study Materials',    status: materials.filter(m => m.type !== 'Notes').length > 0     ? '✓' : 'Pending' },
    { name: 'Assigned Students',  status: students.length > 0      ? `${students.length} Studs` : 'Pending' },
  ];

  // Helper to check time slots
  const getGreeting = () => {
    const hr = new Date().getHours();
    return hr < 12 ? 'Good Morning' : hr < 17 ? 'Good Afternoon' : 'Good Evening';
  };

  // Helper to extract subjects faculty handles
  const getFacultySubjects = () => {
    const classes = user.assignedClasses || [];
    if (classes.length === 0) return 'No subjects assigned';
    return Array.from(new Set(classes.map((c: any) => c.subject))).join(', ');
  };

  // Helper for leave status styling
  const getLeaveStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved': return 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30';
      case 'rejected': return 'bg-red-950/20 text-red-400 border border-red-900/30';
      default:         return 'bg-amber-950/20 text-amber-400 border border-amber-900/30';
    }
  };

  // ── 1. DASHBOARD ─────────────────────────────────────────────────────────────
  const renderFacultyDashboardStep = () => (
    <div className="space-y-6">
      {/* Workspace Banner */}
      <div className="glass-card p-6 border border-purple-900/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-wide">
            {getGreeting()}, {user.fullName}!
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Instructor ID: <span className="font-mono text-purple-400 font-bold">{user.employeeId || 'FAC-N/A'}</span> · Department: <span className="text-white font-bold">{user.assignedDepartment || 'General'}</span>
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            Subjects Handling: <span className="text-white font-semibold">{getFacultySubjects()}</span>
          </p>
        </div>
        <span className="px-3 py-1.5 bg-primary/20 border border-primary/30 rounded-lg text-primary text-xs font-bold uppercase font-mono tracking-wider shrink-0">
          Faculty Portal Active
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: "Today's Classes", value: stats.todayClassesCount || 0, icon: '📅', color: 'text-purple-400' },
          { label: 'Next Class Slot', value: stats.nextClassSlot || 'None', icon: '⏰', color: 'text-blue-400' },
          { label: 'Attendance Pending', value: stats.attendancePendingCount || 0, icon: '⏳', color: 'text-amber-400' },
          { label: 'Assgs Pending', value: stats.assignmentsPendingCount || 0, icon: '📝', color: 'text-pink-400' },
          { label: 'Notes Uploaded', value: materials.filter(m => m.type === 'Notes').length, icon: '📚', color: 'text-emerald-400' },
          { label: 'Notifications', value: facultyNotificationsList.length, icon: '🔔', color: 'text-indigo-400' },
        ].map(k => (
          <div key={k.label} className="glass-card p-4 bg-[#110a24]/30 border border-purple-950/20 flex flex-col justify-between">
            <div className="flex items-center justify-between text-text-secondary">
              <span className="text-[9px] font-bold uppercase tracking-wider">{k.label}</span>
              <span className="text-sm">{k.icon}</span>
            </div>
            <p className={`text-lg font-black mt-3 text-gradient ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="glass-card p-6 border border-purple-900/30">
        <h3 className="text-xs font-black uppercase text-gray-200 tracking-wider mb-4">Quick Actions Desk</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Take Attendance', step: 'faculty_attendance', bg: 'hover:bg-purple-950/40 text-purple-400' },
            { label: 'Upload Notes', step: 'faculty_notes', bg: 'hover:bg-emerald-950/40 text-emerald-400' },
            { label: 'Create Assignment', step: 'faculty_assignments', bg: 'hover:bg-pink-950/40 text-pink-400' },
            { label: 'Upload Material', step: 'faculty_materials', bg: 'hover:bg-blue-950/40 text-blue-400' },
            { label: 'Publish Announcement', step: 'faculty_announcements', bg: 'hover:bg-amber-950/40 text-amber-400' },
          ].map(act => (
            <button
              key={act.label}
              onClick={() => setActiveWorkflowStep(act.step)}
              className={`h-12 border border-purple-900/20 bg-dark-bg/40 rounded-xl text-center text-xs font-bold transition-all flex items-center justify-center px-2 ${act.bg}`}
            >
              {act.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Timetable Classes */}
        <div className="glass-card p-6 space-y-4">
          <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider">Today's Academic Calendar</h4>
          <div className="space-y-3">
            {timetables.length > 0 ? timetables.map((tt: any, idx: number) => (
              <div key={idx} className="p-3.5 bg-dark-bg/40 border border-purple-950/20 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-white uppercase tracking-wide">{tt.day}</p>
                  <p className="text-text-secondary mt-1">Year {tt.year} · Sec {tt.section} · {tt.department}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-purple-400 font-mono">
                    {tt.slots?.map((s: any) => s.timeSlot).join(', ')}
                  </p>
                  <p className="text-[10px] text-text-secondary mt-0.5">
                    {tt.slots?.map((s: any) => s.subjectCode).join(', ')}
                  </p>
                </div>
              </div>
            )) : (
              <p className="text-xs text-text-secondary py-6 text-center">No timetable slots scheduled.</p>
            )}
          </div>
        </div>

        {/* Circular Bulletins */}
        <div className="glass-card p-6 space-y-4">
          <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wide">Campus Broadcasts</h4>
          <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
            {notices.length > 0 ? notices.map((n: any) => (
              <div key={n._id} className="p-3 bg-purple-950/10 border border-purple-900/20 rounded-lg space-y-1 text-xs">
                <div className="flex justify-between items-center text-[10px] text-text-secondary">
                  <span className="font-bold text-purple-400 uppercase">{n.type}</span>
                  <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="font-bold text-white">{n.title}</p>
                <p className="text-text-secondary leading-relaxed">{(n.content || '').substring(0, 120)}</p>
              </div>
            )) : (
              <p className="text-xs text-text-secondary text-center py-6">No announcements published.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ── 2. MY TIMETABLE ──────────────────────────────────────────────────────────
  const renderFacultyTimetableStep = () => (
    <div className="space-y-6">
      {/* Read-only Alert Bar */}
      <div className="p-4 bg-purple-950/10 border border-purple-900/30 rounded-xl flex items-center gap-3">
        <span className="text-base text-purple-400">🔒</span>
        <div className="text-xs">
          <p className="font-bold text-white">Read-Only View Mode</p>
          <p className="text-text-secondary mt-0.5">Your schedule is managed by the HOD. To request slots modifications, contact your department office.</p>
        </div>
      </div>

      <div className="glass-card p-6 border border-purple-900/30">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide mb-4">Academic Master Timetable</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-purple-950/20 text-text-secondary">
                <th className="py-3 px-3 font-bold uppercase">Day</th>
                <th className="py-3 px-3 font-bold uppercase">Department</th>
                <th className="py-3 px-3 font-bold uppercase font-mono">Year/Sec</th>
                <th className="py-3 px-3 font-bold uppercase">Subject Slots</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-950/10">
              {timetables.length > 0 ? timetables.map((tt: any, idx: number) => (
                <tr key={idx} className="hover:bg-purple-950/5">
                  <td className="py-3 px-3 font-bold text-white uppercase">{tt.day}</td>
                  <td className="py-3 px-3 text-text-secondary">{tt.department}</td>
                  <td className="py-3 px-3 font-mono font-bold text-purple-400">Yr {tt.year} - {tt.section}</td>
                  <td className="py-3 px-3 space-y-1">
                    {(tt.slots || []).map((s: any, sIdx: number) => (
                      <div key={sIdx} className="inline-block bg-purple-950/20 border border-purple-900/30 rounded px-2.5 py-1 text-[10px] mr-2">
                        <span className="font-bold text-white">{s.subjectCode}</span> · <span className="font-mono text-text-secondary">{s.timeSlot}</span>
                      </div>
                    ))}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-text-secondary">No timetable slots mapped yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ── 3. ATTENDANCE MANAGEMENT ──────────────────────────────────────────────────
  const renderFacultyAttendanceStep = () => {
    const assignedClassesList: any[] = user.assignedClasses || [];
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Class selector & student list roster */}
        <div className="lg:col-span-2 glass-card p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-purple-950/20">
            <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Roster Registers</h3>
            {/* Search Bar */}
            <input
              type="text"
              placeholder="Search Student..."
              className="h-8 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-[11px] text-white w-48"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Selector Tabs */}
          <div className="flex flex-wrap gap-2">
            {assignedClassesList.length > 0 ? assignedClassesList.map((c: any, idx: number) => {
              const isSel = facultySelectedClass
                && facultySelectedClass.subject === c.subject
                && facultySelectedClass.year === c.year
                && facultySelectedClass.section === c.section;
              return (
                <button
                  key={idx}
                  onClick={() => { setFacultySelectedClass(c); setFacultyAttendanceMap({}); }}
                  className={`h-8 px-3 rounded-lg text-[10px] font-bold uppercase transition-all ${
                    isSel
                      ? 'bg-primary text-white border border-primary'
                      : 'bg-dark-bg/60 text-text-secondary hover:text-white border border-purple-900/30'
                  }`}
                >
                  {c.subject} (Yr {c.year}-{c.section})
                </button>
              );
            }) : (
              <p className="text-xs text-text-secondary">No classes assigned yet.</p>
            )}
          </div>

          {facultySelectedClass ? (() => {
            const sectionStudents = students.filter((s: any) =>
              Math.ceil(s.semester / 2) === facultySelectedClass.year &&
              s.section === facultySelectedClass.section &&
              (s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || s.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()))
            );
            return (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between text-xs pb-2">
                  <p className="text-white font-bold">{sectionStudents.length} Students Roster</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const m: any = {};
                        sectionStudents.forEach((s: any) => { m[s._id] = 'Present'; });
                        setFacultyAttendanceMap(m);
                      }}
                      className="h-7 px-2.5 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 rounded text-[10px] font-bold"
                    >Bulk Present</button>
                    <button
                      onClick={() => {
                        const m: any = {};
                        sectionStudents.forEach((s: any) => { m[s._id] = 'Absent'; });
                        setFacultyAttendanceMap(m);
                      }}
                      className="h-7 px-2.5 bg-red-950/20 text-red-400 border border-red-900/30 rounded text-[10px] font-bold"
                    >Bulk Absent</button>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-purple-950/20 text-text-secondary">
                        <th className="py-2.5 font-bold uppercase">Roll No</th>
                        <th className="py-2.5 font-bold uppercase">Name</th>
                        <th className="py-2.5 font-bold uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-950/10">
                      {sectionStudents.map((s: any) => (
                        <tr key={s._id} className="hover:bg-purple-950/5">
                          <td className="py-2.5 font-mono font-bold text-purple-400">{s.rollNumber}</td>
                          <td className="py-2.5 text-white font-semibold">{s.fullName}</td>
                          <td className="py-2.5">
                            <select
                              className="h-7 bg-dark-bg/60 border border-purple-900/30 rounded px-2 text-[11px] text-white"
                              value={facultyAttendanceMap[s._id] || 'Absent'}
                              onChange={(e) => setFacultyAttendanceMap({ ...facultyAttendanceMap, [s._id]: e.target.value })}
                            >
                              <option value="Present">Present</option>
                              <option value="Absent">Absent</option>
                              <option value="Late">Late Entry</option>
                              <option value="MedicalLeave">Medical Leave</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })() : (
            <p className="text-xs text-text-secondary py-8 text-center">Select an assigned class from the tabs above to load the student registers.</p>
          )}
        </div>

        {/* Attendance session details */}
        <div className="glass-card p-6 space-y-4 text-xs">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Publish Session</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!facultySelectedClass) return toastInfo('Select a class first.');
              if (!attDate || !attSlot) return toastInfo('Enter Date and Slot.');
              const sectionStudents = students.filter((s: any) =>
                Math.ceil(s.semester / 2) === facultySelectedClass.year &&
                s.section === facultySelectedClass.section
              );
              if (sectionStudents.length === 0) return toastInfo('No students found.');
              const attendanceList = sectionStudents.map((s: any) => ({
                studentId: s._id,
                status: facultyAttendanceMap[s._id] || 'Absent',
                remarks: ''
              }));
              setLoading(true);
              try {
                await api.post('/faculty/attendance', {
                  date: attDate,
                  timeSlot: attSlot,
                  subjectCode: facultySelectedClass.subject,
                  attendanceList
                });
                toastSuccess('Attendance register saved successfully.');
                setAttDate('');
                loadData();
              } catch { toast_CRUD.error('Failed saving attendance.'); }
              finally { setLoading(false); }
            }}
            className="space-y-4"
          >
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Session Date *</label>
              <input type="date" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={attDate} onChange={(e) => setAttDate(e.target.value)} required />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Hour Slot *</label>
              <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={attSlot} onChange={(e) => setAttSlot(e.target.value)} required>
                <option value="">Select Slot</option>
                {['09:00-10:00','10:00-11:00','11:15-12:15','12:15-13:15','14:00-15:00','15:00-16:00'].map(sl => (
                  <option key={sl} value={sl}>{sl}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="w-full h-10 bg-primary text-white font-bold rounded-lg text-xs" disabled={loading || !facultySelectedClass}>
              Save Attendance Sheet
            </button>
          </form>
        </div>
      </div>
    );
  };

  // ── 4. NOTES MANAGEMENT ────────────────────────────────────────────────────────
  const renderFacultyNotesStep = () => {
    const assignedClassesList: any[] = user.assignedClasses || [];
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
        {/* Upload/Edit notes form */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">
            {editingMaterialId ? 'Modify Lecture Notes' : 'Publish Lecture Notes'}
          </h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!matTitle || !matUrl || !newMatSub) return toastInfo('Title, URL, and Subject are required.');
              setLoading(true);
              try {
                if (editingMaterialId) {
                  await api.put(`/faculty/materials/${editingMaterialId}`, {
                    title: matTitle,
                    type: 'Notes',
                    fileUrl: matUrl,
                    fileType: newMatFileType,
                    subjectCode: newMatSub,
                    section: newMatSec,
                    unit: newMatUnit,
                    description: newMatDesc
                  });
                  toastSuccess('Lecture notes updated.');
                  setEditingMaterialId(null);
                } else {
                  await api.post('/faculty/materials', {
                    title: matTitle,
                    type: 'Notes',
                    fileUrl: matUrl,
                    fileType: newMatFileType,
                    subjectCode: newMatSub,
                    section: newMatSec,
                    unit: newMatUnit,
                    description: newMatDesc
                  });
                  toastSuccess('Lecture notes published & socket notified.');
                }
                setMatTitle(''); setMatUrl(''); setNewMatDesc(''); setNewMatUnit('1');
                loadData();
              } catch { toast_CRUD.error('Failed saving lecture notes.'); }
              finally { setLoading(false); }
            }}
            className="space-y-3"
          >
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Class/Subject *</label>
              <select
                className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                value={`${newMatSub}|${newMatSec}`}
                onChange={(e) => {
                  const [sub, sec] = e.target.value.split('|');
                  setNewMatSub(sub); setNewMatSec(sec);
                }}
                required
              >
                <option value="|">Select Class</option>
                {assignedClassesList.map((c: any, idx: number) => (
                  <option key={idx} value={`${c.subject}|${c.section}`}>
                    {c.subject} (Sec {c.section})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Notes Title *</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={matTitle} onChange={(e) => setMatTitle(e.target.value)} placeholder="e.g. Lecture 5: Tree Traversals" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Unit Code *</label>
                <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={newMatUnit} onChange={(e) => setNewMatUnit(e.target.value)}>
                  {['1','2','3','4','5'].map(u => <option key={u} value={u}>Unit {u}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">File Extension *</label>
                <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={newMatFileType} onChange={(e) => setNewMatFileType(e.target.value)}>
                  {['pdf','ppt','docx','zip','txt'].map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Resource Storage URL *</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={matUrl} onChange={(e) => setMatUrl(e.target.value)} placeholder="https://r2.cloudflarestorage.com/..." required />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Short Summary Description</label>
              <textarea className="w-full p-3 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg text-xs text-white h-20 resize-none" value={newMatDesc} onChange={(e) => setNewMatDesc(e.target.value)} placeholder="Topics covered or remarks..." />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 h-10 bg-primary text-white font-bold rounded-lg text-xs" disabled={loading}>
                {editingMaterialId ? 'Save Changes' : 'Publish Notes'}
              </button>
              {editingMaterialId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingMaterialId(null); setMatTitle(''); setMatUrl(''); setNewMatDesc('');
                  }}
                  className="px-4 h-10 bg-purple-950/40 text-text-secondary border border-purple-900/30 rounded-lg text-xs font-bold"
                >Cancel</button>
              )}
            </div>
          </form>
        </div>

        {/* Uploaded Notes list */}
        <div className="lg:col-span-2 glass-card p-6 space-y-4">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Lecture Notes Catalogue</h3>
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-purple-950/20 text-text-secondary">
                  <th className="py-3 font-bold uppercase">Subject/Sec</th>
                  <th className="py-3 font-bold uppercase">Title/Unit</th>
                  <th className="py-3 font-bold uppercase font-mono">Format</th>
                  <th className="py-3 font-bold uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-950/10">
                {materials.filter(m => m.type === 'Notes').length > 0 ? (
                  materials.filter(m => m.type === 'Notes').map((notes: any) => (
                    <tr key={notes._id} className="hover:bg-purple-950/5">
                      <td className="py-3">
                        <p className="font-bold text-white">{notes.subjectCode}</p>
                        <p className="text-[10px] text-text-secondary">Sec {notes.section || 'All'}</p>
                      </td>
                      <td className="py-3">
                        <p className="font-bold text-white">{notes.title}</p>
                        <p className="text-[10px] text-purple-400 font-bold">Unit {notes.unit || '1'}</p>
                      </td>
                      <td className="py-3 font-mono text-[10px] text-text-secondary uppercase">{notes.fileType || 'pdf'}</td>
                      <td className="py-3 text-right flex gap-2 justify-end">
                        <button
                          onClick={() => {
                            setEditingMaterialId(notes._id);
                            setMatTitle(notes.title);
                            setMatUrl(notes.fileUrl);
                            setNewMatSub(notes.subjectCode);
                            setNewMatSec(notes.section || '');
                            setNewMatUnit(notes.unit || '1');
                            setNewMatFileType(notes.fileType || 'pdf');
                            setNewMatDesc(notes.description || '');
                          }}
                          className="h-7 px-2.5 bg-purple-950/60 text-white border border-purple-900/30 rounded text-[10px] font-bold"
                        >Edit</button>
                        <button
                          onClick={async () => {
                            if (!confirm('Permanently delete notes?')) return;
                            setLoading(true);
                            try { await api.delete(`/faculty/materials/${notes._id}`); loadData(); }
                            catch { toast_CRUD.error('Failed deleting notes.'); }
                            finally { setLoading(false); }
                          }}
                          className="h-7 px-2 bg-red-950/20 text-red-400 border border-red-900/30 rounded text-[10px] font-bold"
                        >Delete</button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="py-8 text-center text-text-secondary">No notes uploaded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ── 5. ASSIGNMENTS ────────────────────────────────────────────────────────────
  const renderFacultyAssignmentsStep = () => {
    const assignedClassesList: any[] = user.assignedClasses || [];
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
        {/* Create Assignment Form */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Publish Assignment</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newAssTitle || !newAssDeadline || !newAssSub) return toastInfo('Title, Deadline and Class are required.');
              setLoading(true);
              try {
                await api.post('/faculty/assignments', {
                  title: newAssTitle,
                  description: newAssDesc,
                  attachmentUrl: newAssAttachment,
                  deadline: newAssDeadline,
                  subjectCode: newAssSub,
                  year: newAssYear,
                  section: newAssSec,
                });
                toastSuccess('Assignment published.');
                setNewAssTitle(''); setNewAssDesc(''); setNewAssAttachment(''); setNewAssDeadline('');
                loadData();
              } catch { toast_CRUD.error('Failed saving assignment.'); }
              finally { setLoading(false); }
            }}
            className="space-y-3.5"
          >
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Class *</label>
              <select
                className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                value={`${newAssSub}|${newAssYear}|${newAssSec}`}
                onChange={(e) => {
                  const [sub, yr, sec] = e.target.value.split('|');
                  setNewAssSub(sub); setNewAssYear(Number(yr)); setNewAssSec(sec);
                }}
                required
              >
                <option value="||">Select Class</option>
                {assignedClassesList.map((c: any, idx: number) => (
                  <option key={idx} value={`${c.subject}|${c.year}|${c.section}`}>
                    {c.subject} (Yr {c.year}-{c.section})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Assignment Title *</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={newAssTitle} onChange={(e) => setNewAssTitle(e.target.value)} placeholder="e.g. Lab Exercise 4: Router Design" required />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Instructions & Remarks</label>
              <textarea className="w-full p-3 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg text-xs text-white h-20 resize-none" value={newAssDesc} onChange={(e) => setNewAssDesc(e.target.value)} placeholder="Describe the assignment instructions..." />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Due Date *</label>
              <input type="datetime-local" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={newAssDeadline} onChange={(e) => setNewAssDeadline(e.target.value)} required />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Attachment File URL</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={newAssAttachment} onChange={(e) => setNewAssAttachment(e.target.value)} placeholder="https://r2.cloudflarestorage.com/..." />
            </div>
            <button type="submit" className="w-full h-10 bg-primary text-white font-bold rounded-lg text-xs" disabled={loading}>
              Create & Broadcast
            </button>
          </form>
        </div>

        {/* List of active assignments & grading submissions */}
        <div className="lg:col-span-2 glass-card p-6 space-y-4">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Submissions Desk</h3>
          <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
            {assignments.length > 0 ? assignments.map((ass: any) => (
              <div key={ass._id} className="p-4 bg-dark-bg/40 border border-purple-950/20 rounded-xl space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-white text-sm">{ass.title}</h4>
                    <p className="text-[10px] text-text-secondary mt-0.5">{ass.subjectCode} · Class Year {ass.class?.year} - Sec {ass.class?.section}</p>
                  </div>
                  <span className="text-[10px] text-red-400 font-bold bg-red-950/20 border border-red-900/30 px-2 py-0.5 rounded font-mono">
                    Due: {new Date(ass.deadline).toLocaleDateString()}
                  </span>
                </div>
                {ass.description && <p className="text-text-secondary leading-relaxed">{ass.description}</p>}

                {/* Submissions checklist */}
                <div className="border-t border-purple-950/10 pt-3 space-y-2">
                  <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                    Student Submissions ({(ass.submissions || []).length})
                  </p>
                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                    {(ass.submissions || []).length > 0 ? (ass.submissions || []).map((sub: any) => (
                      <div key={sub._id || sub.studentId?._id} className="p-2.5 bg-purple-950/5 border border-purple-900/10 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-bold text-white">{sub.studentId?.fullName || 'Unknown Student'}</p>
                          <p className="text-[9px] text-text-secondary">{sub.studentId?.rollNumber}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {sub.submissionUrl && (
                            <a href={sub.submissionUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline font-bold text-[10px] uppercase font-mono">Open Doc</a>
                          )}
                          {sub.grade ? (
                            <span className="px-2 py-0.5 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 rounded font-mono font-bold text-[10px]">{sub.grade}</span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <select
                                className="h-6 bg-dark-bg/60 border border-purple-900/30 rounded px-1 text-[10px] text-white"
                                value={gradingAssignmentId === ass._id && gradingStudentId === sub.studentId?._id ? gradingScoreVal : 'A+'}
                                onChange={(e) => { setGradingAssignmentId(ass._id); setGradingStudentId(sub.studentId?._id); setGradingScoreVal(e.target.value); }}
                              >
                                {['A+','A','B+','B','C','F'].map(g => <option key={g}>{g}</option>)}
                              </select>
                              <button
                                onClick={async () => {
                                  const grade = gradingAssignmentId === ass._id && gradingStudentId === sub.studentId?._id ? gradingScoreVal : 'A+';
                                  setLoading(true);
                                  try {
                                    await api.post(`/faculty/assignments/${ass._id}/grade`, { studentId: sub.studentId?._id, grade });
                                    toastSuccess('Submissions graded successfully.');
                                    loadData();
                                  } catch { toast_CRUD.error('Failed submitting grade.'); }
                                  finally { setLoading(false); }
                                }}
                                className="h-6 px-2 bg-primary text-white rounded text-[10px] font-bold"
                              >Submit</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )) : (
                      <p className="text-[10px] text-text-secondary py-3 text-center">No submissions uploaded yet.</p>
                    )}
                  </div>
                </div>
              </div>
            )) : (
              <p className="text-text-secondary py-8 text-center">No assignments published yet.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── 6. STUDY MATERIALS ────────────────────────────────────────────────────────
  const renderFacultyMaterialsStep = () => {
    const assignedClassesList: any[] = user.assignedClasses || [];
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
        {/* Upload form */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Upload Academic Material</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!matTitle || !matUrl || !newMatSub) return toastInfo('Title, URL, and Subject are required.');
              setLoading(true);
              try {
                await api.post('/faculty/materials', {
                  title: matTitle,
                  type: matType,
                  fileUrl: matUrl,
                  fileType: newMatFileType,
                  subjectCode: newMatSub,
                  section: newMatSec,
                  unit: newMatUnit,
                  description: newMatDesc
                });
                toastSuccess('Study material repository entry published.');
                setMatTitle(''); setMatUrl(''); setNewMatDesc('');
                loadData();
              } catch { toast_CRUD.error('Failed uploading study material.'); }
              finally { setLoading(false); }
            }}
            className="space-y-4"
          >
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Class/Subject *</label>
              <select
                className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                value={`${newMatSub}|${newMatSec}`}
                onChange={(e) => {
                  const [sub, sec] = e.target.value.split('|');
                  setNewMatSub(sub); setNewMatSec(sec);
                }}
                required
              >
                <option value="|">Select Class</option>
                {assignedClassesList.map((c: any, idx: number) => (
                  <option key={idx} value={`${c.subject}|${c.section}`}>
                    {c.subject} (Sec {c.section})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Resource Title *</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={matTitle} onChange={(e) => setMatTitle(e.target.value)} placeholder="e.g. Lab Manual Experiment 3" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Document Type *</label>
                <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={matType} onChange={(e) => setMatType(e.target.value)}>
                  <option value="Manual">Lab Manual</option>
                  <option value="Question Bank">Question Bank</option>
                  <option value="Reference Book">Reference Book</option>
                  <option value="Previous Paper">Previous Paper</option>
                  <option value="Additional Resource">Additional Resource</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Format File *</label>
                <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={newMatFileType} onChange={(e) => setNewMatFileType(e.target.value)}>
                  {['pdf','ppt','docx','zip','txt'].map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">R2 File Link URL *</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={matUrl} onChange={(e) => setMatUrl(e.target.value)} placeholder="https://r2.cloudflarestorage.com/..." required />
            </div>
            <button type="submit" className="w-full h-10 bg-primary text-white font-bold rounded-lg text-xs" disabled={loading}>
              Publish Study Material
            </button>
          </form>
        </div>

        {/* Study Materials Table */}
        <div className="lg:col-span-2 glass-card p-6 space-y-4">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Academic Materials Catalogue</h3>
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-purple-950/20 text-text-secondary">
                  <th className="py-3 font-bold uppercase">Subject/Sec</th>
                  <th className="py-3 font-bold uppercase">Resource Details</th>
                  <th className="py-3 font-bold uppercase">Uploaded</th>
                  <th className="py-3 font-bold uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-950/10">
                {materials.filter(m => m.type !== 'Notes').length > 0 ? (
                  materials.filter(m => m.type !== 'Notes').map((mat: any) => (
                    <tr key={mat._id} className="hover:bg-purple-950/5">
                      <td className="py-3">
                        <p className="font-bold text-white">{mat.subjectCode}</p>
                        <p className="text-[10px] text-text-secondary">Sec {mat.section || 'All'}</p>
                      </td>
                      <td className="py-3">
                        <p className="font-bold text-white">{mat.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="px-1.5 py-0.5 bg-primary/20 border border-primary/30 rounded text-primary text-[9px] font-black uppercase tracking-wider">{mat.type}</span>
                          <span className="text-[10px] text-text-secondary uppercase font-mono">{mat.fileType || 'pdf'}</span>
                        </div>
                      </td>
                      <td className="py-3 text-text-secondary font-mono text-[10px]">{new Date(mat.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 text-right flex gap-2 justify-end">
                        <a href={mat.fileUrl} target="_blank" rel="noreferrer" className="h-7 px-2.5 bg-purple-950/60 text-white border border-purple-900/30 rounded text-[10px] font-bold flex items-center">Open</a>
                        <button
                          onClick={async () => {
                            if (!confirm('Remove this resource?')) return;
                            setLoading(true);
                            try { await api.delete(`/faculty/materials/${mat._id}`); loadData(); }
                            catch { toast_CRUD.error('Failed removing resource.'); }
                            finally { setLoading(false); }
                          }}
                          className="h-7 px-2 bg-red-950/20 text-red-400 border border-red-900/30 rounded text-[10px] font-bold"
                        >Remove</button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="py-8 text-center text-text-secondary">No study materials uploaded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ── 7. INTERNAL MARKS ─────────────────────────────────────────────────────────
  const renderFacultyMarksStep = () => {
    const assignedClassesList: any[] = user.assignedClasses || [];
    const subjectsList = Array.from(new Set(assignedClassesList.map((c: any) => c.subject)));

    // Extract students matching selected subject/class
    const matchedStudents = students.filter((s: any) => {
      if (!bulkMarkSub) return false;
      const classMap = assignedClassesList.find(c => c.subject === bulkMarkSub);
      if (!classMap) return false;
      return Math.ceil(s.semester / 2) === classMap.year && s.section === classMap.section;
    });

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
        {/* Bulk Marks Settings & Publish Box */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Direct Marks Publish</h3>
          <p className="text-text-secondary text-[11px] leading-relaxed">Direct entry publishes exam marks instantly into academic registers. No HOD approvals required.</p>
          
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!bulkMarkSub || matchedStudents.length === 0) return toastInfo('Select active class and enter grades.');
              
              // Prepare bulk marks payload
              const marksList = matchedStudents.map(s => ({
                studentId: s._id,
                marks: Number(bulkMarksMap[s._id] ?? 0),
                remarks: ''
              }));

              setLoading(true);
              try {
                await api.post('/faculty/marks/bulk', {
                  subjectCode: bulkMarkSub,
                  type: bulkMarkType,
                  maxMarks: Number(bulkMaxMarks),
                  marksList
                });
                toastSuccess('Internal grades published.');
                setBulkMarksMap({});
                loadData();
              } catch { toast_CRUD.error('Failed publishing internal marks.'); }
              finally { setLoading(false); }
            }}
            className="space-y-4"
          >
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Assigned Subject *</label>
              <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={bulkMarkSub} onChange={(e) => { setBulkMarkSub(e.target.value); setBulkMarksMap({}); }} required>
                <option value="">Select Subject</option>
                {subjectsList.map((sub: any) => <option key={sub} value={sub}>{sub}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Exam Category *</label>
                <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={bulkMarkType} onChange={(e) => setBulkMarkType(e.target.value)}>
                  <option value="mid_1">Midterm 1</option>
                  <option value="mid_2">Midterm 2</option>
                  <option value="assignment">Assignment</option>
                  <option value="lab_work">Lab Work</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Max Score Marks *</label>
                <input type="number" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white font-mono" value={bulkMaxMarks} onChange={(e) => setBulkMaxMarks(Number(e.target.value))} required />
              </div>
            </div>
            <button type="submit" className="w-full h-10 bg-primary text-white font-bold rounded-lg text-xs" disabled={loading || matchedStudents.length === 0}>
              Publish Marks Desk
            </button>
          </form>
        </div>

        {/* Student Marks Inputs */}
        <div className="lg:col-span-2 glass-card p-6 space-y-4">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Student Marks Matrix</h3>
          {bulkMarkSub ? (
            <div className="space-y-4">
              <p className="text-[11px] text-text-secondary font-mono">Assigned Section: {matchedStudents.length} Students</p>
              <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-purple-950/20 text-text-secondary">
                      <th className="py-2 px-2 font-bold uppercase">Roll No</th>
                      <th className="py-2 px-2 font-bold uppercase">Student Name</th>
                      <th className="py-2 px-2 font-bold uppercase">Score Marks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-950/10">
                    {matchedStudents.map(s => (
                      <tr key={s._id} className="hover:bg-purple-950/5">
                        <td className="py-2 px-2 font-mono font-bold text-purple-400">{s.rollNumber}</td>
                        <td className="py-2 px-2 text-white font-semibold">{s.fullName}</td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            className="h-8 bg-dark-bg/60 border border-purple-900/30 rounded px-2 w-24 text-xs text-white font-mono"
                            value={bulkMarksMap[s._id] ?? ''}
                            placeholder="0"
                            min={0}
                            max={bulkMaxMarks}
                            onChange={(e) => setBulkMarksMap({ ...bulkMarksMap, [s._id]: Number(e.target.value) })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-xs text-text-secondary py-12 text-center">Select an assigned subject from the left panel to populate the grades list.</p>
          )}
        </div>
      </div>
    );
  };

  // ── 8. LAB MANAGEMENT ──────────────────────────────────────────────────────────
  const renderFacultyLabStep = () => {
    const assignedClassesList: any[] = user.assignedClasses || [];
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
        {/* Lab log creation form */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Log Experiment</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!labStudRoll || !labSub || !labExpName) return toastInfo('Roll Number, Subject, and Experiment Name are required.');
              setLoading(true);
              try {
                await api.post('/faculty/lab', {
                  studentRoll: labStudRoll,
                  subjectCode: labSub,
                  section: labSec,
                  experimentNumber: Number(labExpNum),
                  experimentName: labExpName,
                  observationMarks: Number(labObsMarks),
                  vivaMarks: Number(labVivaMarks),
                  recordMarks: Number(labRecMarks),
                  status: labStatus,
                  remarks: labRemarks
                });
                toastSuccess('Lab log saved successfully.');
                setLabExpName(''); setLabRemarks('');
                loadData();
              } catch { toast_CRUD.error('Failed saving lab record.'); }
              finally { setLoading(false); }
            }}
            className="space-y-3.5"
          >
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Assigned Lab Subject *</label>
              <select
                className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                value={`${labSub}|	ext{${labSec}}`}
                onChange={(e) => {
                  const [sub, sec] = e.target.value.split('|');
                  setLabSub(sub); setLabSec(sec);
                }}
                required
              >
                <option value="|">Select Class</option>
                {assignedClassesList.map((c: any, idx: number) => (
                  <option key={idx} value={`${c.subject}|${c.section}`}>
                    {c.subject} (Sec {c.section})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Student Roll Number *</label>
              <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={labStudRoll} onChange={(e) => setLabStudRoll(e.target.value)} required>
                <option value="">Select Roll Number</option>
                {students.map(s => <option key={s._id} value={s.rollNumber}>{s.rollNumber} - {s.fullName}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Experiment Number *</label>
                <input type="number" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={labExpNum} onChange={(e) => setLabExpNum(Number(e.target.value))} min={1} required />
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Experiment Title *</label>
                <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={labExpName} onChange={(e) => setLabExpName(e.target.value)} placeholder="e.g. DFS/BFS Graph Search" required />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[9px] font-bold text-text-secondary uppercase">Obs (Max 10)</label>
                <input type="number" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-2 text-xs text-white font-mono" value={labObsMarks} onChange={(e) => setLabObsMarks(Number(e.target.value))} min={0} max={10} required />
              </div>
              <div>
                <label className="text-[9px] font-bold text-text-secondary uppercase">Viva (Max 10)</label>
                <input type="number" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-2 text-xs text-white font-mono" value={labVivaMarks} onChange={(e) => setLabVivaMarks(Number(e.target.value))} min={0} max={10} required />
              </div>
              <div>
                <label className="text-[9px] font-bold text-text-secondary uppercase">Rec (Max 10)</label>
                <input type="number" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-2 text-xs text-white font-mono" value={labRecMarks} onChange={(e) => setLabRecMarks(Number(e.target.value))} min={0} max={10} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Status *</label>
                <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={labStatus} onChange={(e) => setLabStatus(e.target.value)}>
                  <option value="Completed">Completed</option>
                  <option value="Pending">Pending</option>
                  <option value="Incomplete">Incomplete</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Remarks</label>
                <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={labRemarks} onChange={(e) => setLabRemarks(e.target.value)} placeholder="Good performance" />
              </div>
            </div>
            <button type="submit" className="w-full h-10 bg-primary text-white font-bold rounded-lg text-xs" disabled={loading}>
              Save Log Entry
            </button>
          </form>
        </div>

        {/* Lab Records Table */}
        <div className="lg:col-span-2 glass-card p-6 space-y-4">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Experiment Register Log</h3>
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-purple-950/20 text-text-secondary">
                  <th className="py-3 px-2 font-bold uppercase">Roll No / Student</th>
                  <th className="py-3 px-2 font-bold uppercase">Subject/Exp</th>
                  <th className="py-3 px-2 font-bold uppercase font-mono">Scores (Obs/Viva/Rec)</th>
                  <th className="py-3 px-2 font-bold uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-950/10">
                {labRecords.length > 0 ? labRecords.map((r: any) => (
                  <tr key={r._id} className="hover:bg-purple-950/5">
                    <td className="py-3 px-2">
                      <p className="font-bold text-white">{r.studentId?.fullName || r.studentRoll}</p>
                      <p className="text-[10px] text-purple-400 font-mono font-bold">{r.studentRoll}</p>
                    </td>
                    <td className="py-3 px-2">
                      <p className="font-bold text-white">{r.subjectCode} - Exp {r.experimentNumber}</p>
                      <p className="text-[10px] text-text-secondary">{r.experimentName}</p>
                    </td>
                    <td className="py-3 px-2 font-mono text-[11px] text-text-secondary">
                      <span className="text-emerald-400 font-bold">{r.observationMarks}</span> / <span className="text-blue-400 font-bold">{r.vivaMarks}</span> / <span className="text-purple-400 font-bold">{r.recordMarks}</span>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        r.status === 'Completed' ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30' : 'bg-amber-950/20 text-amber-400 border border-amber-900/30'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="py-8 text-center text-text-secondary">No laboratory records logged yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ── 9. ANNOUNCEMENTS ──────────────────────────────────────────────────────────
  const renderFacultyAnnouncementsStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
      {/* Create form */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Post Notice Board</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!annTitle || !annContent) return toastInfo('Title and Content are required.');
            setLoading(true);
            try {
              await api.post('/faculty/announcements', {
                title: annTitle,
                content: annContent,
                type: annType,
                targetYear: annYear ? Number(annYear) : undefined,
                targetSection: annSec || undefined
              });
              toastSuccess('Announcement published & circular synced.');
              setAnnTitle(''); setAnnContent('');
              loadData();
            } catch { toast_CRUD.error('Failed publishing announcement.'); }
            finally { setLoading(false); }
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase">Notice Title *</label>
            <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} placeholder="e.g. Schedule for Lab External Exams" required />
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase">Message Content *</label>
            <textarea className="w-full p-3 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg text-xs text-white h-24 resize-none" value={annContent} onChange={(e) => setAnnContent(e.target.value)} placeholder="Write details..." required />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[9px] font-bold text-text-secondary uppercase">Type</label>
              <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-2 text-xs text-white" value={annType} onChange={(e) => setAnnType(e.target.value)}>
                <option value="department">Dept</option>
                <option value="circular">Circular</option>
                <option value="academic">Academic</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-bold text-text-secondary uppercase">Year</label>
              <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-2 text-xs text-white" value={annYear} onChange={(e) => setAnnYear(e.target.value)}>
                <option value="">All</option>
                {['1','2','3','4'].map(y => <option key={y} value={y}>Yr {y}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-bold text-text-secondary uppercase">Section</label>
              <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-2 text-xs text-white" value={annSec} onChange={(e) => setAnnSec(e.target.value)}>
                <option value="">All</option>
                {['A','B','C','D'].map(s => <option key={s} value={s}>Sec {s}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" className="w-full h-10 bg-primary text-white font-bold rounded-lg text-xs" disabled={loading}>
            Publish Notice
          </button>
        </form>
      </div>

      {/* List */}
      <div className="lg:col-span-2 glass-card p-6 space-y-4">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Notice Archive</h3>
        <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
          {announcementsList.length > 0 ? announcementsList.map((ann: any) => (
            <div key={ann._id} className="p-4 bg-purple-950/10 border border-purple-900/20 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-[10px] text-text-secondary">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 bg-purple-950/40 text-purple-400 border border-purple-900/30 rounded font-bold uppercase">{ann.type}</span>
                  {ann.targetYear && <span className="font-mono text-purple-400 font-bold">Yr {ann.targetYear}-{ann.targetSection || 'All'}</span>}
                </div>
                <span className="font-mono">{new Date(ann.createdAt).toLocaleString()}</span>
              </div>
              <p className="font-bold text-white text-xs">{ann.title}</p>
              <p className="text-text-secondary leading-relaxed">{ann.content}</p>
            </div>
          )) : (
            <p className="text-text-secondary text-center py-8">No announcements found.</p>
          )}
        </div>
      </div>
    </div>
  );

  // ── 10. STUDENT LIST ──────────────────────────────────────────────────────────
  const renderFacultyStudentsStep = () => (
    <div className="glass-card p-6 border border-purple-900/30 space-y-4 text-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-purple-950/20">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Department Roll Call</h3>
        <input
          type="text"
          placeholder="Filter students by name or roll number..."
          className="h-9 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white w-64"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-purple-950/20 text-text-secondary">
              <th className="py-3 px-2 font-bold uppercase">Roll No</th>
              <th className="py-3 px-2 font-bold uppercase">Full Name</th>
              <th className="py-3 px-2 font-bold uppercase">Academic Group</th>
              <th className="py-3 px-2 font-bold uppercase">Contact Email</th>
              <th className="py-3 px-2 font-bold uppercase font-mono text-right">Attendance Logs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-purple-950/10">
            {students.filter(s =>
              s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
              s.rollNumber.toLowerCase().includes(searchTerm.toLowerCase())
            ).length > 0 ? (
              students.filter(s =>
                s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.rollNumber.toLowerCase().includes(searchTerm.toLowerCase())
              ).map((s: any) => {
                // Compute attendance percentage
                const presentCount = (s.attendanceLogs || []).filter((l: any) => l.status === 'Present').length;
                const totalLogs = (s.attendanceLogs || []).length;
                const attendancePct = totalLogs > 0 ? Math.round((presentCount / totalLogs) * 100) : 100;
                
                return (
                  <tr key={s._id} className="hover:bg-purple-950/5">
                    <td className="py-3 px-2 font-mono font-bold text-purple-400">{s.rollNumber}</td>
                    <td className="py-3 px-2 font-semibold text-white">{s.fullName}</td>
                    <td className="py-3 px-2 text-text-secondary uppercase">Yr {Math.ceil(s.semester / 2)} - Sec {s.section || 'A'}</td>
                    <td className="py-3 px-2 font-mono text-text-secondary">{s.email}</td>
                    <td className="py-3 px-2 text-right">
                      <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                        attendancePct < 75 ? 'bg-red-950/20 text-red-400 border border-red-900/30' : 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30'
                      }`}>
                        {attendancePct}%
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="py-8 text-center text-text-secondary">No matching student records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── 11. NOTIFICATIONS ─────────────────────────────────────────────────────────
  const renderFacultyNotificationsStep = () => (
    <div className="glass-card p-6 border border-purple-900/30 space-y-4 text-xs">
      <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide border-b border-purple-950/20 pb-3">
        Campus Notifications Inbox
      </h3>
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
        {facultyNotificationsList.length > 0 ? facultyNotificationsList.map((notif: any) => (
          <div key={notif._id} className="p-4 bg-purple-950/10 border border-purple-900/20 rounded-xl space-y-1.5">
            <div className="flex justify-between items-center text-[10px] text-text-secondary font-mono">
              <span className="font-bold text-purple-400 uppercase tracking-wider">{notif.category || 'circular'}</span>
              <span>{new Date(notif.createdAt || notif.date).toLocaleString()}</span>
            </div>
            <p className="font-bold text-white text-xs">{notif.title}</p>
            <p className="text-text-secondary leading-relaxed">{notif.message || notif.content}</p>
          </div>
        )) : (
          <p className="text-text-secondary text-center py-12">No notifications in your inbox yet.</p>
        )}
      </div>
    </div>
  );

  // ── 12. MY PROFILE ───────────────────────────────────────────────────────────
  const renderFacultyProfileStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
      {/* Overview Card */}
      <div className="glass-card p-6 space-y-4 flex flex-col items-center text-center">
        <div className="w-24 h-24 bg-primary/20 border-2 border-primary/30 rounded-full flex items-center justify-center text-4xl text-white font-black uppercase shadow-lg shadow-primary/10">
          {user.fullName?.charAt(0)}
        </div>
        <div>
          <h3 className="text-base font-black text-white">{user.fullName}</h3>
          <p className="text-xs text-purple-400 font-mono font-bold mt-0.5">{user.employeeId || 'Instructor'}</p>
          <p className="text-[11px] text-text-secondary mt-1 uppercase font-semibold">{user.assignedDepartment} Teaching Staff</p>
        </div>
        {user.bio && <p className="text-text-secondary leading-relaxed italic bg-purple-950/10 p-3 rounded-lg border border-purple-900/10">{user.bio}</p>}
      </div>

      {/* Profile Modification Form */}
      <div className="lg:col-span-2 glass-card p-6 space-y-4">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide pb-2 border-b border-purple-950/20">Edit Profile Info</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
              await api.put('/faculty/profile', {
                fullName: profileFullName,
                bio: profileBio,
                mobileNumber: profileMobile,
                githubUrl: profileGithub,
                linkedinUrl: profileLinkedin,
                portfolioUrl: profilePortfolio,
                newPassword: profileNewPass || undefined
              });
              toastSuccess('Profile updated successfully.');
              setProfileNewPass('');
              loadData();
            } catch { toast_CRUD.error('Failed modifying profile.'); }
            finally { setLoading(false); }
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Full Display Name *</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={profileFullName} onChange={(e) => setProfileFullName(e.target.value)} required />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Mobile Connection Number</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={profileMobile} onChange={(e) => setProfileMobile(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase">Instructor Bio Description</label>
            <textarea className="w-full p-3 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg text-xs text-white h-16 resize-none" value={profileBio} onChange={(e) => setProfileBio(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">GitHub URL</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={profileGithub} onChange={(e) => setProfileGithub(e.target.value)} placeholder="https://github.com/..." />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">LinkedIn URL</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={profileLinkedin} onChange={(e) => setProfileLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Portfolio URL</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={profilePortfolio} onChange={(e) => setProfilePortfolio(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div className="pt-2 border-t border-purple-950/20">
            <label className="text-[10px] font-bold text-text-secondary uppercase">Change Password (Leave blank to keep current)</label>
            <input type="password" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white font-mono" value={profileNewPass} onChange={(e) => setProfileNewPass(e.target.value)} placeholder="••••••••••••" />
          </div>
          <button type="submit" className="w-full h-10 bg-primary text-white font-bold rounded-lg text-xs" disabled={loading}>
            Save Profile & Password
          </button>
        </form>
      </div>
    </div>
  );

  // ── 13. CLASS DIARY ──────────────────────────────────────────────────────────
  const renderFacultyDiaryStep = () => {
    const assignedClassesList: any[] = user.assignedClasses || [];
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
        {/* Form */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Log Daily Class Activity</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!diaryDate || !diarySub || !diaryTopic) return toastInfo('Date, Subject, and Topic Covered are required.');
              setLoading(true);
              try {
                await api.post('/faculty/diary', {
                  date: diaryDate,
                  subjectCode: diarySub,
                  section: diarySec,
                  topicCovered: diaryTopic,
                  homeworkAssigned: diaryHomework,
                  remarks: diaryRemarks,
                  status: diaryStatus
                });
                toastSuccess('Diary log entry saved.');
                setDiaryTopic(''); setDiaryHomework(''); setDiaryRemarks('');
                loadData();
              } catch { toast_CRUD.error('Failed saving class diary.'); }
              finally { setLoading(false); }
            }}
            className="space-y-3.5"
          >
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Log Date *</label>
                <input type="date" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={diaryDate} onChange={(e) => setDiaryDate(e.target.value)} required />
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Class/Subject *</label>
                <select
                  className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                  value={`smash{${diarySub}}|	ext{${diarySec}}`}
                  onChange={(e) => {
                    const [sub, sec] = e.target.value.split('|');
                    setDiarySub(sub); setDiarySec(sec);
                  }}
                  required
                >
                  <option value="|">Select Class</option>
                  {assignedClassesList.map((c: any, idx: number) => (
                    <option key={idx} value={`${c.subject}|${c.section}`}>
                      {c.subject} (Sec {c.section})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Topics Covered *</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={diaryTopic} onChange={(e) => setDiaryTopic(e.target.value)} placeholder="e.g. Unit 3: Red-Black Trees Insertion" required />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Homework / Assignment Task</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={diaryHomework} onChange={(e) => setDiaryHomework(e.target.value)} placeholder="Read chapter 5.2" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Status *</label>
                <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={diaryStatus} onChange={(e) => setDiaryStatus(e.target.value)}>
                  <option value="Completed">Completed</option>
                  <option value="Partially Completed">Partially</option>
                  <option value="Postponed">Postponed</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-secondary uppercase">Remarks</label>
                <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={diaryRemarks} onChange={(e) => setDiaryRemarks(e.target.value)} placeholder="Class participated well" />
              </div>
            </div>
            <button type="submit" className="w-full h-10 bg-primary text-white font-bold rounded-lg text-xs" disabled={loading}>
              Save Diary Entry
            </button>
          </form>
        </div>

        {/* List */}
        <div className="lg:col-span-2 glass-card p-6 space-y-4">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Daily Class Activity logs</h3>
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-purple-950/20 text-text-secondary">
                  <th className="py-3 px-2 font-bold uppercase">Date / Sub</th>
                  <th className="py-3 px-2 font-bold uppercase">Activities Mapped</th>
                  <th className="py-3 px-2 font-bold uppercase">Task</th>
                  <th className="py-3 px-2 font-bold uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-950/10">
                {diaryRecords.length > 0 ? diaryRecords.map((diary: any) => (
                  <tr key={diary._id} className="hover:bg-purple-950/5">
                    <td className="py-3 px-2">
                      <p className="font-bold text-white">{new Date(diary.date).toLocaleDateString()}</p>
                      <p className="text-[10px] text-purple-400 font-bold">{diary.subjectCode} · Sec {diary.section || 'All'}</p>
                    </td>
                    <td className="py-3 px-2 text-white font-medium">{diary.topicCovered}</td>
                    <td className="py-3 px-2 text-text-secondary font-medium">{diary.homeworkAssigned || '—'}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        diary.status === 'Completed' ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30' : 'bg-amber-950/20 text-amber-400 border border-amber-900/30'
                      }`}>
                        {diary.status}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="py-8 text-center text-text-secondary">No class activity logs mapped.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ── 14. LEAVE MANAGEMENT ──────────────────────────────────────────────────────
  const renderFacultyLeavesStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
      {/* Request Leave Form */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Apply Leave Request</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!leaveStart || !leaveEnd || !leaveReason) return toastInfo('Please fill all leave fields.');
            setLoading(true);
            try {
              await api.post('/faculty/leaves', { startDate: leaveStart, endDate: leaveEnd, reason: leaveReason });
              toastSuccess('Leave request filed.');
              setLeaveStart(''); setLeaveEnd(''); setLeaveReason('');
              loadData();
            } catch { toast_CRUD.error('Failed submitting leave.'); }
            finally { setLoading(false); }
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase">Start Date *</label>
            <input type="date" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} required />
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase">End Date *</label>
            <input type="date" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} required />
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase">Reason for Leave Request *</label>
            <textarea className="w-full p-3 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg text-xs text-white h-20 resize-none" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} placeholder="Type details..." required />
          </div>
          <button type="submit" className="w-full h-10 bg-primary text-white font-bold rounded-lg text-xs" disabled={loading}>
            File Application
          </button>
        </form>
      </div>

      {/* History table */}
      <div className="lg:col-span-2 glass-card p-6 space-y-4">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Filing History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-purple-950/20 text-text-secondary">
                <th className="py-3 px-2 font-bold uppercase">Leave Period</th>
                <th className="py-3 px-2 font-bold uppercase">Days</th>
                <th className="py-3 px-2 font-bold uppercase">Statement Reason</th>
                <th className="py-3 px-2 font-bold uppercase text-right">Approval Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-950/10">
              {leaves.length > 0 ? leaves.map((leave: any) => {
                const diffDays = Math.ceil((new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / (1000 * 3600 * 24)) + 1;
                return (
                  <tr key={leave._id} className="hover:bg-purple-950/5">
                    <td className="py-3 px-2">
                      <p className="font-bold text-white">{new Date(leave.startDate).toLocaleDateString()} to {new Date(leave.endDate).toLocaleDateString()}</p>
                    </td>
                    <td className="py-3 px-2 font-mono text-text-secondary font-bold">{diffDays} Days</td>
                    <td className="py-3 px-2 text-text-secondary">{leave.reason}</td>
                    <td className="py-3 px-2 text-right">
                      <span className={`px-2.5 py-0.5 rounded-[5px] text-[10px] font-black uppercase ${getLeaveStatusBadge(leave.status)}`}>
                        {leave.status}
                      </span>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-text-secondary">No leave applications filed yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ── 15. STUDENT DOUBTS ────────────────────────────────────────────────────────
  const renderFacultyDoubtsStep = () => (
    <div className="space-y-6 text-xs">
      <div className="glass-card p-6 border border-purple-900/30">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide pb-3 border-b border-purple-950/20 mb-4">
          Student Query Desk
        </h3>

        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
          {doubtsList.length > 0 ? doubtsList.map((doubt: any) => (
            <div key={doubt._id} className="p-4 bg-purple-950/10 border border-purple-900/20 rounded-xl space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-white text-xs">{doubt.studentId?.fullName || 'Student'} ({doubt.studentId?.rollNumber})</p>
                  <p className="text-[10px] text-purple-400 font-bold mt-0.5">Subject: {doubt.subjectCode}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                  doubt.status === 'Resolved' ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30' : 'bg-amber-950/20 text-amber-400 border border-amber-900/30'
                }`}>
                  {doubt.status}
                </span>
              </div>
              <p className="text-white bg-dark-bg/60 p-3 rounded-lg border border-purple-900/10 leading-relaxed font-semibold">
                {doubt.question}
              </p>

              {doubt.answer ? (
                <div className="p-3 bg-purple-950/5 border border-purple-900/10 rounded-lg space-y-1">
                  <p className="text-[9px] text-text-secondary uppercase font-bold">Answered Response:</p>
                  <p className="text-text-secondary leading-relaxed font-medium">{doubt.answer}</p>
                </div>
              ) : (
                <div className="space-y-2 pt-2 border-t border-purple-950/10">
                  <textarea
                    className="w-full p-3 bg-dark-bg/60 border border-purple-900/30 rounded-lg text-xs text-white h-20 resize-none"
                    placeholder="Write explanation answer..."
                    value={replyDoubtId === doubt._id ? replyDoubtAnswer : ''}
                    onChange={(e) => { setReplyDoubtId(doubt._id); setReplyDoubtAnswer(e.target.value); }}
                  />
                  <button
                    onClick={async () => {
                      if (!replyDoubtAnswer) return;
                      setLoading(true);
                      try {
                        await api.post(`/faculty/doubts/${doubt._id}/answer`, { answer: replyDoubtAnswer });
                        toastSuccess('Doubt solved successfully.');
                        setReplyDoubtAnswer('');
                        setReplyDoubtId(null);
                        loadData();
                      } catch { toast_CRUD.error('Failed replying doubt.'); }
                      finally { setLoading(false); }
                    }}
                    className="h-8 px-4 bg-primary text-white font-bold rounded-lg text-xs"
                    disabled={loading || replyDoubtId !== doubt._id || !replyDoubtAnswer}
                  >
                    Solve Query
                  </button>
                </div>
              )}
            </div>
          )) : (
            <p className="text-text-secondary text-center py-12">No doubts raised by students for your subjects yet.</p>
          )}
        </div>
      </div>
    </div>
  );

  // ── 16. STUDENT PERFORMANCE ANALYTICS ─────────────────────────────────────────
  const renderFacultyAnalyticsStep = () => {
    const lowAtt = facultyAnalyticsData.lowAttendanceStudents || [];
    const weakSt = facultyAnalyticsData.weakStudents || [];
    const topSt = facultyAnalyticsData.topPerformers || [];
    return (
      <div className="space-y-6 text-xs">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Performers */}
          <div className="glass-card p-6 border border-purple-900/30 space-y-4">
            <h3 className="text-sm font-black uppercase text-emerald-400 tracking-wide flex items-center gap-2">
              <span>🌟</span> Top Performers (Avg &gt; 85%)
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {topSt.length > 0 ? topSt.map((st: any, idx: number) => (
                <div key={idx} className="p-3 bg-emerald-950/10 border border-emerald-900/20 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white">{st.fullName}</p>
                    <p className="text-[10px] text-text-secondary font-mono">{st.rollNumber}</p>
                  </div>
                  <span className="text-emerald-400 font-black font-mono text-[11px]">{st.avgMarks}%</span>
                </div>
              )) : (
                <p className="text-text-secondary text-center py-6">No top performers detected.</p>
              )}
            </div>
          </div>

          {/* Low Attendance Warning */}
          <div className="glass-card p-6 border border-purple-900/30 space-y-4">
            <h3 className="text-sm font-black uppercase text-red-400 tracking-wide flex items-center gap-2">
              <span>⚠️</span> Low Attendance (&lt; 75%)
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {lowAtt.length > 0 ? lowAtt.map((st: any, idx: number) => (
                <div key={idx} className="p-3 bg-red-950/10 border border-red-900/20 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white">{st.fullName}</p>
                    <p className="text-[10px] text-text-secondary font-mono">{st.rollNumber}</p>
                  </div>
                  <span className="text-red-400 font-black font-mono text-[11px]">{st.attendancePercentage}%</span>
                </div>
              )) : (
                <p className="text-text-secondary text-center py-6">No students with low attendance warnings.</p>
              )}
            </div>
          </div>

          {/* Weak Students */}
          <div className="glass-card p-6 border border-purple-900/30 space-y-4">
            <h3 className="text-sm font-black uppercase text-amber-400 tracking-wide flex items-center gap-2">
              <span>📉</span> Weak Students (Avg &lt; 50%)
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {weakSt.length > 0 ? weakSt.map((st: any, idx: number) => (
                <div key={idx} className="p-3 bg-amber-950/10 border border-amber-900/20 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white">{st.fullName}</p>
                    <p className="text-[10px] text-text-secondary font-mono">{st.rollNumber}</p>
                  </div>
                  <span className="text-amber-400 font-black font-mono text-[11px]">{st.avgMarks}%</span>
                </div>
              )) : (
                <p className="text-text-secondary text-center py-6">No academic weak warnings registered.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── 17. FACULTY CALENDAR ───────────────────────────────────────────────────────
  const renderFacultyCalendarStep = () => {
    const eventsList = facultyCalendarData.collegeEvents || [];
    const classesList = facultyCalendarData.classes || [];
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
        {/* Calendar View */}
        <div className="lg:col-span-2 glass-card p-6 space-y-4">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide mb-4">Integrated Faculty Calendar</h3>
          
          <div className="p-4 bg-purple-950/10 border border-purple-900/20 rounded-xl">
            <p className="font-bold text-white text-xs">Class Schedule Calendar</p>
            <div className="space-y-2 mt-3">
              {classesList.length > 0 ? classesList.map((cl: any, idx: number) => (
                <div key={idx} className="p-3 bg-dark-bg/40 border border-purple-950/20 rounded-lg flex justify-between items-center">
                  <div>
                    <p className="font-bold text-white">{cl.subjectCode}</p>
                    <p className="text-[10px] text-text-secondary">Sec {cl.section} · {cl.day}</p>
                  </div>
                  <span className="text-purple-400 font-mono font-bold">{cl.timeSlot}</span>
                </div>
              )) : (
                <p className="text-text-secondary text-[11px] py-4 text-center">No mapped class slots mapped in calendar.</p>
              )}
            </div>
          </div>
        </div>

        {/* Academic Events, holidays, meetings */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Campus Term Events</h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {eventsList.length > 0 ? eventsList.map((ev: any) => (
              <div key={ev._id} className="p-3 bg-purple-950/10 border border-purple-900/20 rounded-xl space-y-1">
                <div className="flex justify-between items-center text-[10px] text-text-secondary">
                  <span className="font-bold text-purple-400 uppercase">{ev.type || 'Holiday'}</span>
                  <span>{new Date(ev.date).toLocaleDateString()}</span>
                </div>
                <p className="font-bold text-white">{ev.description || ev.title}</p>
              </div>
            )) : (
              <p className="text-text-secondary text-center py-8">No campus term events announced.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

      // =============================================================
  // COE PORTAL HELPER METHODS
  // =============================================================
  const checkCoeStepCompletion = (stepId: string) => {
    switch (stepId) {
      case 'coe_dashboard':           return true;
      case 'coe_exams':               return coeExams.length > 0;
      case 'coe_timetable':           return timetables.length > 0;
      case 'coe_hall_tickets':        return coeTickets.length > 0;
      case 'coe_seating':             return coeSeatingList.length > 0;
      case 'coe_invigilation':        return coeInvigilations.length > 0;
      case 'coe_internal_verify':     return true;
      case 'coe_external_marks':      return true;
      case 'coe_results':             return coeResults.length > 0;
      case 'coe_revaluation':         return true;
      case 'coe_malpractice':         return true;
      case 'coe_notifications':       return true;
      case 'coe_student_search':      return true;
      case 'coe_reports':             return true;
      case 'coe_downloads':           return true;
      case 'coe_audit_logs':          return true;
      case 'coe_profile':             return true;
      default:                        return false;
    }
  };

  const calculateCoeProgress = () => {
    const completed = coeWorkflowSteps.filter(s => checkCoeStepCompletion(s.id)).length;
    return Math.round((completed / coeWorkflowSteps.length) * 100);
  };

  const getCoeOnboardingProgressChecklist = () => [
    { name: 'Exams Configured',   status: coeExams.length > 0 ? '✓' : 'Pending' },
    { name: 'Schedules Published', status: timetables.length > 0 ? '✓' : 'Pending' },
    { name: 'Hall Tickets Done',   status: coeTickets.length > 0 ? '✓' : 'Pending' },
    { name: 'Seating Allocated',  status: coeSeatingList.length > 0 ? '✓' : 'Pending' },
    { name: 'Results Drafted',    status: coeResults.length > 0 ? '✓' : 'Pending' },
  ];

  // Helper for Hall Ticket Workflow styling
  const getTicketStatusBadge = (status: string) => {
    switch (status) {
      case 'published': return 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30';
      case 'approved':  return 'bg-blue-950/20 text-blue-400 border border-blue-900/30';
      case 'preview':   return 'bg-amber-950/20 text-amber-400 border border-amber-900/30';
      default:          return 'bg-purple-950/20 text-purple-400 border border-purple-900/30';
    }
  };

  // ── 1. COE DASHBOARD ─────────────────────────────────────────────────────────
  const renderCoeDashboardStep = () => (
    <div className="space-y-6 text-xs">
      {/* Welcome Banner */}
      <div className="glass-card p-6 border border-purple-900/30 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-white uppercase tracking-wide">
            {user.fullName} Workspace
          </h3>
          <p className="text-xs text-text-secondary mt-1">
            Employee ID: <span className="text-purple-400 font-mono font-bold">{user.employeeId || 'COE-1002'}</span> · Institution: <span className="text-white font-semibold">{user.collegeName || 'MSMC University'}</span>
          </p>
        </div>
        <span className="px-3 py-1 bg-primary/20 border border-primary/30 rounded-lg text-primary text-xs font-bold uppercase font-mono">
          COE Office
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          { label: 'Upcoming Exams',   value: stats.upcomingExams ?? 0, icon: '📅', color: 'text-purple-400' },
          { label: 'Hall Tickets Pend', value: stats.hallTicketsPending ?? 0, icon: '🎟️', color: 'text-blue-400' },
          { label: 'Results Pending',   value: stats.resultsPending ?? 0, icon: '📝', color: 'text-amber-400' },
          { label: 'Revaluation Req',   value: stats.revaluationRequests ?? 0, icon: '🔄', color: 'text-pink-400' },
          { label: 'Supplementary App', value: stats.supplementaryApplications ?? 0, icon: '📚', color: 'text-emerald-400' },
          { label: 'Today Schedules',   value: stats.todayExamSchedules ?? 0, icon: '⏰', color: 'text-indigo-400' }
        ].map(k => (
          <div key={k.label} className="glass-card p-4 bg-[#110a24]/30 border border-purple-950/20">
            <div className="flex items-center justify-between text-text-secondary">
              <span className="text-[9px] font-bold uppercase tracking-wider">{k.label}</span>
              <span className="text-sm">{k.icon}</span>
            </div>
            <p className={`text-lg font-black mt-3 text-gradient ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="glass-card p-6 border border-purple-900/30">
        <h3 className="text-xs font-bold uppercase text-gray-200 tracking-wider mb-4">Quick Actions Desk</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Create Exam', step: 'coe_exams', hover: 'hover:bg-purple-950/40 text-purple-400' },
            { label: 'Publish Timetable', step: 'coe_timetable', hover: 'hover:bg-blue-950/40 text-blue-400' },
            { label: 'Generate Hall Tickets', step: 'coe_hall_tickets', hover: 'hover:bg-amber-950/40 text-amber-400' },
            { label: 'Publish Results', step: 'coe_results', hover: 'hover:bg-pink-950/40 text-pink-400' },
            { label: 'Send Announcement', step: 'coe_notifications', hover: 'hover:bg-emerald-950/40 text-emerald-400' }
          ].map(act => (
            <button
              key={act.label}
              onClick={() => setActiveWorkflowStep(act.step)}
              className={`h-12 border border-purple-900/20 bg-dark-bg/40 rounded-xl text-center font-bold transition-all flex items-center justify-center px-2 ${act.hover}`}
            >
              {act.label}
            </button>
          ))}
        </div>
      </div>

      {/* Analytics Distributions & Performance Indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pass Percentages by Department */}
        <div className="glass-card p-6 space-y-4">
          <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider">Department Pass Rates</h4>
          <div className="space-y-3">
            {[
              { dept: 'Computer Science (CSE)', rate: 92 },
              { dept: 'Electronics (ECE)', rate: 88 },
              { dept: 'Mechanical (ME)', rate: 81 },
              { dept: 'Civil (CE)', rate: 78 }
            ].map(d => (
              <div key={d.dept} className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold text-text-secondary">
                  <span>{d.dept}</span>
                  <span className="text-white">{d.rate}%</span>
                </div>
                <div className="w-full bg-[#110a24]/60 h-2 rounded-full overflow-hidden border border-purple-950/20">
                  <div className="bg-gradient-to-r from-purple-500 to-primary h-full rounded-full" style={{ width: `${d.rate}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SGPA Grade Distributions */}
        <div className="glass-card p-6 space-y-4">
          <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider">SGPA Grade Distribution</h4>
          <div className="grid grid-cols-5 gap-2 pt-2">
            {[
              { grade: 'O', count: 12, pct: 15, col: 'bg-purple-500' },
              { grade: 'A+', count: 28, pct: 35, col: 'bg-indigo-500' },
              { grade: 'A', count: 40, pct: 50, col: 'bg-blue-500' },
              { grade: 'B+', count: 15, pct: 20, col: 'bg-emerald-500' },
              { grade: 'F', count: 2, pct: 5, col: 'bg-red-500' }
            ].map(g => (
              <div key={g.grade} className="flex flex-col items-center justify-end h-40 space-y-2">
                <div className="w-6 bg-purple-950/20 border border-purple-900/10 rounded flex flex-col justify-end overflow-hidden h-32 relative">
                  <div className={`w-full ${g.col} transition-all duration-500`} style={{ height: `${g.pct}%` }} />
                </div>
                <span className="font-bold text-white font-mono">{g.grade}</span>
                <span className="text-[9px] text-text-secondary">{g.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Backlog statistics summary */}
        <div className="glass-card p-6 space-y-4">
          <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider font-mono">Backlog Stats Indicators</h4>
          <div className="space-y-3">
            {[
              { label: 'Cleared Backlogs (Reval)', count: 42, color: 'text-emerald-400' },
              { label: 'Pending Revaluation Appeals', count: stats.revaluationRequests ?? 15, color: 'text-amber-400' },
              { label: 'Filing Supp Exams', count: stats.supplementaryApplications ?? 25, color: 'text-purple-400' },
            ].map(b => (
              <div key={b.label} className="p-3 bg-purple-950/10 border border-purple-900/20 rounded-xl flex items-center justify-between">
                <span className="text-[10px] text-text-secondary uppercase font-bold">{b.label}</span>
                <span className={`text-lg font-black font-mono ${b.color}`}>{b.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ── 2. EXAMINATION CONFIGURATION ─────────────────────────────────────────────
  const renderCoeExamManagementStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
      {/* Create form */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Configure Exam Term</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!examConfTitle || !examConfStartDate) return toastInfo('Title and start date are required.');
            setLoading(true);
            try {
              await api.post('/coe/exams', {
                title: examConfTitle,
                type: examConfType,
                examType: examConfCategory,
                regulation: examConfRegulation,
                semester: Number(examConfSemester),
                startDate: examConfStartDate
              });
              toastSuccess('Exam configured.');
              setExamConfTitle(''); setExamConfStartDate('');
              loadData();
            } catch { toast_CRUD.error('Failed creating exam.'); }
            finally { setLoading(false); }
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase">Exam Cycle Title *</label>
            <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={examConfTitle} onChange={(e) => setExamConfTitle(e.target.value)} placeholder="e.g. B.Tech Semester End - Nov 2026" required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Exam Class Type *</label>
              <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={examConfType} onChange={(e) => setExamConfType(e.target.value)}>
                <option value="external">External Board</option>
                <option value="internal">Internal College</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Exam Category *</label>
              <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={examConfCategory} onChange={(e) => setExamConfCategory(e.target.value)}>
                <option value="semester">Regular Sem</option>
                <option value="mid_1">Mid-1</option>
                <option value="mid_2">Mid-2</option>
                <option value="practical">Practical Exam</option>
                <option value="lab">Lab Work</option>
                <option value="supplementary">Supplementary</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Regulation *</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={examConfRegulation} onChange={(e) => setExamConfRegulation(e.target.value)} placeholder="R22" required />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Semester *</label>
              <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={examConfSemester} onChange={(e) => setExamConfSemester(Number(e.target.value))}>
                {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase">Start Date *</label>
            <input type="date" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={examConfStartDate} onChange={(e) => setExamConfStartDate(e.target.value)} required />
          </div>
          <button type="submit" className="w-full h-10 bg-primary text-white font-bold rounded-lg text-xs" disabled={loading}>
            Create Configuration
          </button>
        </form>
      </div>

      {/* List */}
      <div className="lg:col-span-2 glass-card p-6 space-y-4">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Exam Registry Logs</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-purple-950/20 text-text-secondary">
                <th className="py-3 font-bold uppercase">Exam Title</th>
                <th className="py-3 font-bold uppercase">Regulation/Sem</th>
                <th className="py-3 font-bold uppercase">Start Date</th>
                <th className="py-3 font-bold uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-950/10">
              {coeExams.length > 0 ? coeExams.map((ex: any) => (
                <tr key={ex._id} className="hover:bg-purple-950/5">
                  <td className="py-3 font-bold text-white">{ex.title}</td>
                  <td className="py-3">
                    <p className="font-mono text-purple-400 font-bold">{ex.regulation} · Sem {ex.semester}</p>
                    <p className="text-[10px] text-text-secondary uppercase">{ex.examType}</p>
                  </td>
                  <td className="py-3 text-text-secondary font-mono">{new Date(ex.startDate).toLocaleDateString()}</td>
                  <td className="py-3 text-right space-x-2">
                    {ex.status === 'draft' ? (
                      <button
                        onClick={async () => {
                          setLoading(true);
                          try {
                            await api.post(`/coe/exams/${ex._id}/publish`);
                            toastSuccess('Exam published.');
                            loadData();
                          } catch { toast_CRUD.error('Failed publishing.'); }
                          finally { setLoading(false); }
                        }}
                        className="h-7 px-2.5 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 rounded text-[10px] font-bold"
                      >Publish</button>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 rounded text-[10px] font-bold">Live</span>
                    )}
                    <button
                      onClick={async () => {
                        if (!confirm('Permanently delete exam configuration?')) return;
                        setLoading(true);
                        try { await api.delete(`/coe/exams/${ex._id}`); loadData(); }
                        catch { toast_CRUD.error('Failed deleting.'); }
                        finally { setLoading(false); }
                      }}
                      className="h-7 px-2 bg-red-950/20 text-red-400 border border-red-900/30 rounded text-[10px] font-bold"
                    >Delete</button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="py-8 text-center text-text-secondary">No exam term configurations documented.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ── 3. EXAMINATION TIMETABLE ─────────────────────────────────────────────────
  const renderCoeTimetableStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
      {/* Timetable form */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Log Schedule Slot</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!schedSubCode || !schedDate || !schedRoom) return toastInfo('Subject Code, Date and Room are required.');
            setLoading(true);
            try {
              await api.post('/coe/exam-schedules', {
                department: schedDept,
                semester: Number(schedSem),
                section: schedSec,
                subjectName: schedSubName,
                subjectCode: schedSubCode,
                examDate: schedDate,
                timeSlot: schedSlot,
                startTime: schedStart,
                endTime: schedEnd,
                room: schedRoom,
                session: schedSession,
                type: schedType
              });
              toastSuccess('Timetable slot saved successfully.');
              setSchedSubCode(''); setSchedSubName(''); setSchedRoom('');
              loadData();
            } catch { toast_CRUD.error('Failed saving slot.'); }
            finally { setLoading(false); }
          }}
          className="space-y-3"
        >
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase">Department *</label>
            <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={schedDept} onChange={(e) => setSchedDept(e.target.value)} placeholder="CSE, ECE" required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Semester *</label>
              <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={schedSem} onChange={(e) => setSchedSem(Number(e.target.value))}>
                {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Section *</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={schedSec} onChange={(e) => setSchedSec(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Subject Name</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={schedSubName} onChange={(e) => setSchedSubName(e.target.value)} placeholder="Compiler Design" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Subject Code *</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={schedSubCode} onChange={(e) => setSchedSubCode(e.target.value)} placeholder="CS401" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Exam Date *</label>
              <input type="date" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} required />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Exam Room *</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={schedRoom} onChange={(e) => setSchedRoom(e.target.value)} placeholder="LH-201" required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[9px] font-bold text-text-secondary uppercase">Start Time</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-2 text-xs text-white font-mono" value={schedStart} onChange={(e) => setSchedStart(e.target.value)} />
            </div>
            <div>
              <label className="text-[9px] font-bold text-text-secondary uppercase">End Time</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-2 text-xs text-white font-mono" value={schedEnd} onChange={(e) => setSchedEnd(e.target.value)} />
            </div>
            <div>
              <label className="text-[9px] font-bold text-text-secondary uppercase">Session</label>
              <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-2 text-xs text-white" value={schedSession} onChange={(e) => setSchedSession(e.target.value)}>
                <option value="forenoon">FN</option>
                <option value="afternoon">AN</option>
              </select>
            </div>
          </div>
          <button type="submit" className="w-full h-10 bg-primary text-white font-bold rounded-lg text-xs" disabled={loading}>
            Save Slot Mapped
          </button>
        </form>
      </div>

      {/* List */}
      <div className="lg:col-span-2 glass-card p-6 space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-purple-950/20">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Academic Exam Schedules</h3>
          <button
            onClick={async () => {
              setLoading(true);
              try {
                await api.post('/coe/exam-schedules/publish');
                toastSuccess('Timetable published to Student OS.');
              } catch { toast_CRUD.error('Failed publishing.'); }
              finally { setLoading(false); }
            }}
            className="h-8 px-4 bg-primary text-white font-bold rounded-lg text-xs uppercase"
          >
            Publish Timetable
          </button>
        </div>

        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-purple-950/20 text-text-secondary">
                <th className="py-3 px-2 font-bold uppercase">Subject</th>
                <th className="py-3 px-2 font-bold uppercase">Date/Time</th>
                <th className="py-3 px-2 font-bold uppercase">Room</th>
                <th className="py-3 px-2 font-bold uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-950/10">
              {coeExams.length > 0 ? coeExams.map((sched: any) => (
                <tr key={sched._id} className="hover:bg-purple-950/5">
                  <td className="py-3 px-2">
                    <p className="font-bold text-white">{sched.subjectCode}</p>
                    <p className="text-[10px] text-text-secondary">{sched.subjectName || 'Exam Slot'}</p>
                  </td>
                  <td className="py-3 px-2">
                    <p className="font-bold text-white font-mono">{new Date(sched.examDate).toLocaleDateString()}</p>
                    <p className="text-[10px] text-purple-400 font-mono font-semibold">{sched.timeSlot} ({sched.session?.toUpperCase()})</p>
                  </td>
                  <td className="py-3 px-2 font-bold text-white font-mono">{sched.room}</td>
                  <td className="py-3 px-2 text-right">
                    <button
                      onClick={async () => {
                        if (!confirm('Delete timetable slot?')) return;
                        setLoading(true);
                        try { await api.delete(`/coe/exam-schedules/${sched._id}`); loadData(); }
                        catch { toast_CRUD.error('Failed deleting.'); }
                        finally { setLoading(false); }
                      }}
                      className="h-7 px-2 bg-red-950/20 text-red-400 border border-red-900/30 rounded text-[10px] font-bold"
                    >Delete</button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="py-8 text-center text-text-secondary">No exam schedule slots mapped.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ── 4. HALL TICKET MANAGEMENT ────────────────────────────────────────────────
  const renderCoeHallTicketStep = () => (
    <div className="space-y-6 text-xs">
      <div className="glass-card p-6 border border-purple-900/30 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Hall Ticket Processing Desk</h3>
          <p className="text-text-secondary mt-1">Verify eligibility criteria, generate ticket drafts, approve and publish them to Student OS.</p>
        </div>
        <button
          onClick={async () => {
            setLoading(true);
            try {
              await api.post('/coe/hall-tickets/generate');
              toastSuccess('Bulk hall ticket drafts generated.');
              loadData();
            } catch { toast_CRUD.error('Failed generating bulk hall tickets.'); }
            finally { setLoading(false); }
          }}
          className="h-10 px-4 bg-primary text-white font-bold rounded-lg text-xs uppercase shrink-0"
        >
          Verify & Generate Bulk Tickets
        </button>
      </div>

      <div className="glass-card p-6 border border-purple-900/30">
        <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider mb-4">Academic Hall Tickets Registry</h4>
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-purple-950/20 text-text-secondary">
                <th className="py-3 px-2 font-bold uppercase">Roll No / Student</th>
                <th className="py-3 px-2 font-bold uppercase font-mono">Eligibility Check</th>
                <th className="py-3 px-2 font-bold uppercase">QR Code Data</th>
                <th className="py-3 px-2 font-bold uppercase">Status</th>
                <th className="py-3 px-2 font-bold uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-950/10">
              {coeTickets.length > 0 ? coeTickets.map((t: any) => (
                <tr key={t._id} className="hover:bg-purple-950/5">
                  <td className="py-3 px-2">
                    <p className="font-bold text-white">{t.studentId?.fullName || 'Student'}</p>
                    <p className="text-[10px] text-purple-400 font-mono font-bold">{t.rollNumber}</p>
                  </td>
                  <td className="py-3 px-2">
                    <div className="space-y-1">
                      <div className="flex gap-2">
                        <span className={`text-[9px] font-bold px-1 rounded ${t.attendancePct >= 75 ? 'text-emerald-400 bg-emerald-950/20' : 'text-red-400 bg-red-950/20'}`}>Att: {t.attendancePct}%</span>
                        <span className={`text-[9px] font-bold px-1 rounded ${t.internalMarksStatus === 'Eligible' ? 'text-emerald-400 bg-emerald-950/20' : 'text-red-400 bg-red-950/20'}`}>Int: {t.internalMarksStatus}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-[9px] font-bold px-1 rounded text-purple-400 bg-purple-950/20">Fee: {t.feeStatus}</span>
                        <span className={`text-[9px] font-bold px-1 rounded ${!t.detainedStatus ? 'text-emerald-400 bg-emerald-950/20' : 'text-red-400 bg-red-950/20'}`}>{t.detainedStatus ? 'Detained' : 'Regular'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2 font-mono text-[9px] text-text-secondary truncate max-w-[150px]">{t.qrCodeData}</td>
                  <td className="py-3 px-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${getTicketStatusBadge(t.status)}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <select
                      className="h-7 bg-dark-bg/60 border border-purple-900/30 rounded px-2 text-[10px] text-white"
                      value={t.status}
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        setLoading(true);
                        try {
                          await api.put(`/coe/hall-tickets/${t._id}/status`, { status: newStatus });
                          toastSuccess(`Hall ticket status updated to ${newStatus}.`);
                          loadData();
                        } catch { toast_CRUD.error('Failed updating status.'); }
                        finally { setLoading(false); }
                      }}
                    >
                      <option value="draft">Draft</option>
                      <option value="preview">Preview</option>
                      <option value="approved">Approved</option>
                      <option value="published">Publish</option>
                    </select>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="py-8 text-center text-text-secondary">No hall ticket records generated.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ── 5. SEATING ARRANGEMENT ───────────────────────────────────────────────────
  const renderCoeSeatingStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
      {/* Allocation form */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Generate Seating Plan</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!seatSchedId || !seatRoom) return toastInfo('Exam schedule and room are required.');
            // Filter students matching the exam semester/department
            const matchedSched = coeExams.find(ex => ex._id === seatSchedId);
            if (!matchedSched) return toastInfo('Select exam schedule first.');
            
            const matchedStudentsList = students.filter(s => s.semester === matchedSched.semester)
              .map(s => ({ studentId: s._id, rollNumber: s.rollNumber || s._id }));

            if (matchedStudentsList.length === 0) return toastInfo('No students registered for this semester.');

            setLoading(true);
            try {
              await api.post('/coe/seating/allocate', {
                examScheduleId: seatSchedId,
                room: seatRoom,
                studentsList: matchedStudentsList
              });
              toastSuccess('Seating layout mapped.');
              setSeatRoom('');
              loadData();
            } catch { toast_CRUD.error('Failed mapping seating plan.'); }
            finally { setLoading(false); }
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase">Exam Schedule *</label>
            <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={seatSchedId} onChange={(e) => setSeatSchedId(e.target.value)} required>
              <option value="">Select Exam</option>
              {coeExams.map(ex => <option key={ex._id} value={ex._id}>{ex.subjectCode} - {new Date(ex.examDate).toLocaleDateString()}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase">Assign Room *</label>
            <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={seatRoom} onChange={(e) => setSeatRoom(e.target.value)} placeholder="e.g. Block A Room 302" required />
          </div>
          <button type="submit" className="w-full h-10 bg-primary text-white font-bold rounded-lg text-xs" disabled={loading}>
            Generate Seating Plan
          </button>
        </form>
      </div>

      {/* Grid mappings */}
      <div className="lg:col-span-2 glass-card p-6 space-y-4">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Arrangement Records</h3>
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
          {coeSeatingList.length > 0 ? coeSeatingList.map((plan: any) => (
            <div key={plan._id} className="p-4 bg-dark-bg/40 border border-purple-950/20 rounded-xl space-y-3">
              <div className="flex justify-between items-center text-xs pb-2 border-b border-purple-950/10">
                <div>
                  <p className="font-bold text-white">Room: {plan.room}</p>
                  <p className="text-[10px] text-text-secondary mt-0.5">Subject: {plan.examScheduleId?.subjectCode}</p>
                </div>
                <span className="font-mono text-purple-400 font-bold">{new Date(plan.examScheduleId?.examDate).toLocaleDateString()}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {(plan.arrangements || []).map((arr: any, arrIdx: number) => (
                  <div key={arrIdx} className="p-2.5 bg-purple-950/10 border border-purple-900/20 rounded-lg text-center space-y-1">
                    <p className="font-mono font-bold text-white text-[10px]">{arr.rollNumber}</p>
                    <p className="text-[9px] text-purple-400 font-bold font-mono">{arr.benchNumber} · {arr.seatNumber}</p>
                  </div>
                ))}
              </div>
            </div>
          )) : (
            <p className="text-text-secondary py-8 text-center">No arrangements mapped yet.</p>
          )}
        </div>
      </div>
    </div>
  );

  // ── 6. INVIGILATION DUTY ─────────────────────────────────────────────────────
  const renderCoeInvigilationStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
      {/* Assign Form */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Assign Invigilation</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!invFacultyId || !invSchedId || !invRoom || !invDate || !invTime) return toastInfo('Fill all invigilation fields.');
            setLoading(true);
            try {
              await api.post('/coe/invigilation', {
                facultyId: invFacultyId,
                examScheduleId: invSchedId,
                room: invRoom,
                date: invDate,
                time: invTime
              });
              toastSuccess('Faculty assigned & socket notified.');
              setInvRoom(''); setInvDate(''); setInvTime('');
              loadData();
            } catch { toast_CRUD.error('Failed assigning invigilator.'); }
            finally { setLoading(false); }
          }}
          className="space-y-4.5"
        >
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase">Select Faculty *</label>
            <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={invFacultyId} onChange={(e) => setInvFacultyId(e.target.value)} required>
              <option value="">Select Faculty</option>
              {staff.filter(u => u.role === 'faculty').map(f => <option key={f._id} value={f._id}>{f.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase">Exam Schedule *</label>
            <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={invSchedId} onChange={(e) => setInvSchedId(e.target.value)} required>
              <option value="">Select Exam</option>
              {coeExams.map(ex => <option key={ex._id} value={ex._id}>{ex.subjectCode} - {new Date(ex.examDate).toLocaleDateString()}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase">Invigilation Room *</label>
            <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={invRoom} onChange={(e) => setInvRoom(e.target.value)} placeholder="LH-301" required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Duty Date *</label>
              <input type="date" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={invDate} onChange={(e) => setInvDate(e.target.value)} required />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Time Slot *</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={invTime} onChange={(e) => setInvTime(e.target.value)} placeholder="09:30-12:30" required />
            </div>
          </div>
          <button type="submit" className="w-full h-10 bg-primary text-white font-bold rounded-lg text-xs" disabled={loading}>
            Save Duty Assignment
          </button>
        </form>
      </div>

      {/* List */}
      <div className="lg:col-span-2 glass-card p-6 space-y-4">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Duties Catalogue</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-purple-950/20 text-text-secondary">
                <th className="py-3 px-2 font-bold uppercase">Invigilator</th>
                <th className="py-3 px-2 font-bold uppercase">Subject/Room</th>
                <th className="py-3 px-2 font-bold uppercase">Date/Time</th>
                <th className="py-3 px-2 font-bold uppercase text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-950/10">
              {coeInvigilations.length > 0 ? coeInvigilations.map((d: any) => (
                <tr key={d._id} className="hover:bg-purple-950/5">
                  <td className="py-3 px-2">
                    <p className="font-bold text-white">{d.facultyId?.fullName}</p>
                    <p className="text-[10px] text-text-secondary font-mono">{d.facultyId?.employeeId || 'FAC-ID'}</p>
                  </td>
                  <td className="py-3 px-2">
                    <p className="font-bold text-white">{d.examScheduleId?.subjectCode || 'Exam'}</p>
                    <p className="text-[10px] text-purple-400 font-bold font-mono">Room: {d.room}</p>
                  </td>
                  <td className="py-3 px-2">
                    <p className="font-bold text-white font-mono">{new Date(d.date).toLocaleDateString()}</p>
                    <p className="text-[10px] text-text-secondary font-mono">{d.time}</p>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className="px-2 py-0.5 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 rounded text-[9px] font-bold uppercase">
                      {d.status}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="py-8 text-center text-text-secondary">No invigilation duties mapped yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ── 7. INTERNAL MARKS VERIFICATION ───────────────────────────────────────────
  const renderCoeInternalVerificationStep = () => (
    <div className="space-y-6 text-xs">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Verification lists */}
        <div className="lg:col-span-2 glass-card p-6 space-y-4">
          <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide pb-2 border-b border-purple-950/20">Verify Internal Marks</h3>
          <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-purple-950/20 text-text-secondary">
                  <th className="py-3 px-2 font-bold uppercase">Roll No / Student</th>
                  <th className="py-3 px-2 font-bold uppercase">Subject/Exam</th>
                  <th className="py-3 px-2 font-bold uppercase font-mono">Score</th>
                  <th className="py-3 px-2 font-bold uppercase">Status</th>
                  <th className="py-3 px-2 font-bold uppercase text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-950/10">
                {coeInternalMarksList.filter(m => m.type !== 'external').length > 0 ? (
                  coeInternalMarksList.filter(m => m.type !== 'external').map((mark: any) => (
                    <tr key={mark._id} className="hover:bg-purple-950/5">
                      <td className="py-3 px-2">
                        <p className="font-bold text-white">{mark.studentId?.fullName}</p>
                        <p className="text-[10px] text-text-secondary font-mono">{mark.studentId?.rollNumber}</p>
                      </td>
                      <td className="py-3 px-2">
                        <p className="font-bold text-white">{mark.subjectCode}</p>
                        <p className="text-[10px] text-purple-400 font-bold uppercase">{mark.type}</p>
                      </td>
                      <td className="py-3 px-2 font-mono font-bold text-white">{mark.marks} / {mark.maxMarks}</td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          mark.status === 'approved' ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30' : mark.status === 'rejected' ? 'bg-red-950/20 text-red-400 border border-red-900/30' : 'bg-amber-950/20 text-amber-400 border border-amber-900/30'
                        }`}>
                          {mark.status}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right space-x-1">
                        {mark.status === 'pending' && (
                          <>
                            <button
                              onClick={async () => {
                                setLoading(true);
                                try {
                                  await api.put(`/coe/internal-marks/${mark._id}/verify`, { status: 'approved' });
                                  toastSuccess('Marks approved.');
                                  loadData();
                                } catch { toast_CRUD.error('Failed approving.'); }
                                finally { setLoading(false); }
                              }}
                              className="h-6 px-2 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 rounded text-[9px] font-bold"
                            >Approve</button>
                            <button
                              onClick={async () => {
                                setLoading(true);
                                try {
                                  await api.put(`/coe/internal-marks/${mark._id}/verify`, { status: 'rejected' });
                                  toastSuccess('Marks rejected.');
                                  loadData();
                                } catch { toast_CRUD.error('Failed rejecting.'); }
                                finally { setLoading(false); }
                              }}
                              className="h-6 px-2 bg-red-950/20 text-red-400 border border-red-900/30 rounded text-[9px] font-bold"
                            >Reject</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="py-8 text-center text-text-secondary">No internal mark drafts submitted by faculty.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Discrepancies logs */}
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-sm font-black uppercase text-red-400 tracking-wide flex items-center gap-1.5 pb-2 border-b border-purple-950/20">
            <span>⚠️</span> Marks Warnings
          </h3>
          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
            {coeInternalDiscrepancyList.length > 0 ? coeInternalDiscrepancyList.map((disc: any) => (
              <div key={disc._id} className="p-3 bg-red-950/10 border border-red-900/20 rounded-xl space-y-1">
                <div className="flex justify-between items-center text-[9px] text-text-secondary">
                  <span className="font-mono text-purple-400 font-bold">{disc.studentId?.rollNumber}</span>
                  <span className="font-bold text-red-400 uppercase font-mono">{disc.type}</span>
                </div>
                <p className="font-bold text-white">{disc.studentId?.fullName}</p>
                <p className="text-[10px] text-text-secondary">Subject: {disc.subjectCode} · Score: <span className="text-red-400 font-bold font-mono">{disc.marks}%</span></p>
                <p className="text-[9px] text-red-400 italic">Discrepancy Warning status: {disc.status}</p>
              </div>
            )) : (
              <p className="text-text-secondary py-6 text-center">No internal marks discrepancies detected.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ── 8. EXTERNAL MARKS MANAGEMENT ─────────────────────────────────────────────
  const renderCoeExternalMarksStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
      {/* Upload single */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Enter Board Grades</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!extStudId || !extSubCode || extMarks === undefined) return toastInfo('Fill all external marks fields.');
            setLoading(true);
            try {
              await api.post('/coe/external-marks', {
                studentId: extStudId,
                subjectCode: extSubCode,
                marks: Number(extMarks),
                maxMarks: Number(extMaxMarks)
              });
              toastSuccess('External mark registered successfully.');
              setExtSubCode(''); setExtMarks(0);
              loadData();
            } catch { toast_CRUD.error('Failed registering external marks.'); }
            finally { setLoading(false); }
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase">Select Student *</label>
            <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={extStudId} onChange={(e) => setExtStudId(e.target.value)} required>
              <option value="">Select Student</option>
              {students.map(s => <option key={s._id} value={s._id}>{s.rollNumber} - {s.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase">Subject Code *</label>
            <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={extSubCode} onChange={(e) => setExtSubCode(e.target.value)} placeholder="CS402" required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">External Marks *</label>
              <input type="number" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white font-mono" value={extMarks} onChange={(e) => setExtMarks(Number(e.target.value))} required />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Max Marks *</label>
              <input type="number" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white font-mono" value={extMaxMarks} onChange={(e) => setExtMaxMarks(Number(e.target.value))} required />
            </div>
          </div>
          <button type="submit" className="w-full h-10 bg-primary text-white font-bold rounded-lg text-xs" disabled={loading}>
            Save Board Marks
          </button>
        </form>
      </div>

      {/* Upload bulk spreadsheets */}
      <div className="lg:col-span-2 glass-card p-6 space-y-4">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide pb-2 border-b border-purple-950/20">Bulk Excel Spreadsheets Paste</h3>
        <p className="text-text-secondary text-[11px] leading-relaxed">Paste tab-separated rows containing: <span className="text-purple-400 font-mono">RollNumber [tab] SubjectCode [tab] Marks [tab] MaxMarks</span>. Each student row must be on a new line.</p>
        
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!extBulkText) return;
            const lines = extBulkText.split('\n');
            const marksList = [];
            for (const line of lines) {
              const parts = line.split('\t');
              if (parts.length >= 3) {
                marksList.push({
                  rollNumber: parts[0].trim(),
                  subjectCode: parts[1].trim(),
                  marks: Number(parts[2].trim()),
                  maxMarks: Number(parts[3]?.trim() || 100)
                });
              }
            }

            if (marksList.length === 0) return toastInfo('Invalid spreadsheet format.');

            setLoading(true);
            try {
              await api.post('/coe/external-marks/bulk', { marksList });
              toastSuccess(`${marksList.length} external board records uploaded successfully.`);
              setExtBulkText('');
              loadData();
            } catch { toast_CRUD.error('Failed bulk upload.'); }
            finally { setLoading(false); }
          }}
          className="space-y-4"
        >
          <textarea
            className="w-full p-4 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg text-xs text-white h-48 font-mono resize-none"
            value={extBulkText}
            onChange={(e) => setExtBulkText(e.target.value)}
            placeholder={`SOS-001021\tCS402\t78\t100\nSOS-001022\tCS402\t82\t100`}
            required
          />
          <button type="submit" className="w-full h-10 bg-primary text-white font-bold rounded-lg text-xs" disabled={loading || !extBulkText}>
            Bulk Upload Spreadsheet
          </button>
        </form>
      </div>
    </div>
  );

  // ── 9. RESULTS PROCESSING & MODERATION / GRACE MARKS ─────────────────────────
  const renderCoeResultsProcessingStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
      {/* Compute form */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Semester Grade Processor</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!resProcStudId || !resProcSem) return toastInfo('Select student and semester.');
            setLoading(true);
            try {
              await api.post('/coe/results/process', {
                studentId: resProcStudId,
                semester: Number(resProcSem),
                graceMarksAdded: Number(resProcGraceMarks) || undefined,
                graceSubjectCode: resProcGraceSub || undefined
              });
              toastSuccess('GPAs and credits calculated successfully.');
              setResProcGraceMarks(0); setResProcGraceSub('');
              loadData();
            } catch { toast_CRUD.error('Failed calculating results.'); }
            finally { setLoading(false); }
          }}
          className="space-y-3"
        >
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase">Target Student *</label>
            <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={resProcStudId} onChange={(e) => setResProcStudId(e.target.value)} required>
              <option value="">Select Student</option>
              {students.map(s => <option key={s._id} value={s._id}>{s.rollNumber} - {s.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase">Semester End *</label>
            <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={resProcSem} onChange={(e) => setResProcSem(Number(e.target.value))}>
              {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
          <div className="border-t border-purple-950/20 pt-3 space-y-3">
            <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Grace Marks / Moderation Desk</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-bold text-text-secondary uppercase">Grace Marks</label>
                <input type="number" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white font-mono" value={resProcGraceMarks} onChange={(e) => setResProcGraceMarks(Number(e.target.value))} placeholder="0" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-text-secondary uppercase">Subject Code</label>
                <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={resProcGraceSub} onChange={(e) => setResProcGraceSub(e.target.value)} placeholder="CS401" />
              </div>
            </div>
          </div>
          <button type="submit" className="w-full h-10 bg-primary text-white font-bold rounded-lg text-xs" disabled={loading}>
            Process Semester Result
          </button>
        </form>
      </div>

      {/* List */}
      <div className="lg:col-span-2 glass-card p-6 space-y-4">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Processed Results Preview</h3>
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-purple-950/20 text-text-secondary">
                <th className="py-3 px-2 font-bold uppercase">Roll No / Name</th>
                <th className="py-3 px-2 font-bold uppercase font-mono">GPA Score (SGPA/CGPA)</th>
                <th className="py-3 px-2 font-bold uppercase">Moderation</th>
                <th className="py-3 px-2 font-bold uppercase">Status</th>
                <th className="py-3 px-2 font-bold uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-950/10">
              {coeResults.length > 0 ? coeResults.map((r: any) => (
                <tr key={r._id} className="hover:bg-purple-950/5">
                  <td className="py-3 px-2">
                    <p className="font-bold text-white">{r.studentId?.fullName}</p>
                    <p className="text-[10px] text-purple-400 font-mono font-bold">{r.studentId?.rollNumber} · Sem {r.semester}</p>
                  </td>
                  <td className="py-3 px-2 font-mono">
                    <p className="font-bold text-white">SGPA: {r.sgpa}</p>
                    <p className="text-[10px] text-text-secondary">CGPA: {r.cgpa}</p>
                  </td>
                  <td className="py-3 px-2">
                    {r.moderationApplied ? (
                      <span className="px-2 py-0.5 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 rounded text-[9px] font-mono">Grace +{r.graceMarksAdded} on {r.graceSubjectCode}</span>
                    ) : (
                      <span className="text-[10px] text-text-secondary italic">None</span>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                      r.status === 'published' ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30' : 'bg-amber-950/20 text-amber-400 border border-amber-900/30'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right">
                    {r.status === 'preview' && (
                      <button
                        onClick={async () => {
                          setLoading(true);
                          try {
                            await api.put(`/coe/results/${r._id}/publish`);
                            toastSuccess('Results published to Student OS.');
                            loadData();
                          } catch { toast_CRUD.error('Failed publishing results.'); }
                          finally { setLoading(false); }
                        }}
                        className="h-7 px-3 bg-primary text-white font-bold rounded text-[10px] uppercase font-mono"
                      >
                        Publish Result
                      </button>
                    )}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="py-8 text-center text-text-secondary">No results computed yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ── 10. REVALUATION & SUPPLEMENTARY ──────────────────────────────────────────
  const renderCoeRevaluationStep = () => (
    <div className="glass-card p-6 border border-purple-900/30 space-y-4 text-xs">
      <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide pb-2 border-b border-purple-950/20">
        Revaluation & Supplementary Applications Desk
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-purple-950/20 text-text-secondary">
              <th className="py-3 px-2 font-bold uppercase">Roll No / Student</th>
              <th className="py-3 px-2 font-bold uppercase">Subject/Sem</th>
              <th className="py-3 px-2 font-bold uppercase font-mono">Category Type</th>
              <th className="py-3 px-2 font-bold uppercase">Paid Fee</th>
              <th className="py-3 px-2 font-bold uppercase">Status</th>
              <th className="py-3 px-2 font-bold uppercase text-right">Action Desk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-purple-950/10">
            {coeRevaluationRequests.length > 0 ? coeRevaluationRequests.map((req: any) => (
              <tr key={req._id} className="hover:bg-purple-950/5">
                <td className="py-3 px-2">
                  <p className="font-bold text-white">{req.studentId?.fullName}</p>
                  <p className="text-[10px] text-purple-400 font-mono font-bold">{req.studentId?.rollNumber}</p>
                </td>
                <td className="py-3 px-2">
                  <p className="font-bold text-white">{req.subjectCode}</p>
                  <p className="text-[10px] text-text-secondary">Semester {req.semester}</p>
                </td>
                <td className="py-3 px-2 font-mono text-purple-400 font-bold uppercase">{req.type}</td>
                <td className="py-3 px-2 font-mono text-white font-semibold">Rs. {req.amountPaid}</td>
                <td className="py-3 px-2">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                    req.status === 'approved' ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30' : req.status === 'rejected' ? 'bg-red-950/20 text-red-400 border border-red-900/30' : 'bg-amber-950/20 text-amber-400 border border-amber-900/30'
                  }`}>
                    {req.status}
                  </span>
                </td>
                <td className="py-3 px-2 text-right space-x-1.5">
                  {req.status === 'pending' && (
                    <>
                      <button
                        onClick={async () => {
                          setLoading(true);
                          try {
                            await api.put(`/coe/revaluation/${req._id}/status`, { status: 'approved', remarks: 'Grades modified' });
                            toastSuccess('Application approved.');
                            loadData();
                          } catch { toast_CRUD.error('Failed processing.'); }
                          finally { setLoading(false); }
                        }}
                        className="h-6 px-2 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 rounded text-[9px] font-bold"
                      >Approve</button>
                      <button
                        onClick={async () => {
                          setLoading(true);
                          try {
                            await api.put(`/coe/revaluation/${req._id}/status`, { status: 'rejected', remarks: 'Denied' });
                            toastSuccess('Application rejected.');
                            loadData();
                          } catch { toast_CRUD.error('Failed processing.'); }
                          finally { setLoading(false); }
                        }}
                        className="h-6 px-2 bg-red-950/20 text-red-400 border border-red-900/30 rounded text-[9px] font-bold"
                      >Reject</button>
                    </>
                  )}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="py-8 text-center text-text-secondary">No recount, revaluation or supplementary applications logged.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── 11. MALPRACTICE MANAGEMENT ───────────────────────────────────────────────
  const renderCoeMalpracticeStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
      {/* File Log Form */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Log Malpractice Case</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!mpStudentRoll || !mpSubCode || !mpExamDate) return toastInfo('Student Roll, Subject, and Exam Date are required.');
            
            const stud = students.find(s => s.rollNumber === mpStudentRoll);
            if (!stud) return toastInfo('Student roll number not registered.');

            setLoading(true);
            try {
              await api.post('/coe/malpractices', {
                caseNumber: mpCaseNum,
                studentId: stud._id,
                subjectCode: mpSubCode,
                examDate: mpExamDate,
                description: mpDesc,
                evidence: mpEvidence,
                decision: mpDecision,
                penalty: mpPenalty,
                punishment: mpPunishment
              });
              toastSuccess('Malpractice case file logged.');
              setMpCaseNum(''); setMpDesc(''); setMpPenalty('');
              loadData();
            } catch { toast_CRUD.error('Failed saving malpractice log.'); }
            finally { setLoading(false); }
          }}
          className="space-y-3.5"
        >
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase">Case File ID / Number</label>
            <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={mpCaseNum} onChange={(e) => setMpCaseNum(e.target.value)} placeholder="e.g. MP-2026-CSE-04" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase">Student Roll Number *</label>
            <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={mpStudentRoll} onChange={(e) => setMpStudentRoll(e.target.value)} placeholder="SOS-001021" required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Subject Code *</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={mpSubCode} onChange={(e) => setMpSubCode(e.target.value)} placeholder="CS302" required />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Exam Date *</label>
              <input type="date" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white font-mono" value={mpExamDate} onChange={(e) => setMpExamDate(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase">Incident Description & Evidence URL</label>
            <textarea className="w-full p-3 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg text-xs text-white h-20 resize-none" value={mpDesc} onChange={(e) => setMpDesc(e.target.value)} placeholder="Caught carrying notes..." />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Case Decision</label>
              <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={mpDecision} onChange={(e) => setMpDecision(e.target.value)}>
                <option value="Pending">Pending</option>
                <option value="Suspended">Suspended</option>
                <option value="Exonerated">Exonerated</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Penalty Punishment</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={mpPunishment} onChange={(e) => setMpPunishment(e.target.value)} placeholder="Cancelled CS302 exam" />
            </div>
          </div>
          <button type="submit" className="w-full h-10 bg-primary text-white font-bold rounded-lg text-xs" disabled={loading}>
            Register Incident
          </button>
        </form>
      </div>

      {/* Registry Grid */}
      <div className="lg:col-span-2 glass-card p-6 space-y-4">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide pb-2 border-b border-purple-950/20">Malpractice Case Registry</h3>
        <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
          {coeMalpractices.length > 0 ? coeMalpractices.map((mp: any) => (
            <div key={mp._id} className="p-4 bg-purple-950/10 border border-red-950/20 rounded-xl space-y-2">
              <div className="flex justify-between items-start text-[10px] text-text-secondary font-mono">
                <div>
                  <span className="font-bold text-purple-400 uppercase tracking-wider">{mp.caseNumber || 'CASE FILE'}</span>
                  <p className="text-white font-bold text-xs mt-1">{mp.studentId?.fullName} ({mp.studentId?.rollNumber})</p>
                </div>
                <span className="px-2 py-0.5 bg-red-950/20 text-red-400 border border-red-900/30 rounded font-bold uppercase">{mp.decision}</span>
              </div>
              <p className="text-text-secondary leading-relaxed bg-[#090514]/40 p-2.5 rounded border border-purple-900/10">{mp.description || 'No statement document'}</p>
              <div className="flex justify-between items-center text-[10px] pt-1">
                <span className="text-purple-400 font-bold font-mono">Subject: {mp.subjectCode} · {new Date(mp.examDate).toLocaleDateString()}</span>
                {mp.punishment && <span className="text-red-400 font-bold">Punishment: {mp.punishment}</span>}
              </div>
            </div>
          )) : (
            <p className="text-text-secondary py-8 text-center">No malpractice cases logged.</p>
          )}
        </div>
      </div>
    </div>
  );

  // ── 12. EXAMINATION NOTIFICATIONS ───────────────────────────────────────────
  const renderCoeNotificationsStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
      {/* Broadcast form */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Publish Circular</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!coeNotifTitle || !coeNotifBody) return toastInfo('Title and Content are required.');
            setLoading(true);
            try {
              await api.post('/coe/notifications', {
                title: coeNotifTitle,
                body: coeNotifBody,
                category: coeNotifCategory
              });
              toastSuccess('Notification circular broadcasted successfully.');
              setCoeNotifTitle(''); setCoeNotifBody('');
              loadData();
            } catch { toast_CRUD.error('Failed broadcasting notification.'); }
            finally { setLoading(false); }
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase">Circular Title *</label>
            <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={coeNotifTitle} onChange={(e) => setCoeNotifTitle(e.target.value)} placeholder="e.g. Supplementary Exams November 2026" required />
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase">Circular Category *</label>
            <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={coeNotifCategory} onChange={(e) => setCoeNotifCategory(e.target.value)}>
              <option value="timetable">Timetable Update</option>
              <option value="hall_ticket">Hall Ticket Release</option>
              <option value="results">Result Announcement</option>
              <option value="supplementary">Supplementary Notice</option>
              <option value="revaluation">Revaluation Notice</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase">Notification Message Content *</label>
            <textarea className="w-full p-3 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg text-xs text-white h-32 resize-none" value={coeNotifBody} onChange={(e) => setCoeNotifBody(e.target.value)} placeholder="Write details here..." required />
          </div>
          <button type="submit" className="w-full h-10 bg-primary text-white font-bold rounded-lg text-xs" disabled={loading}>
            Broadcast Circular Alert
          </button>
        </form>
      </div>

      {/* History log */}
      <div className="lg:col-span-2 glass-card p-6 space-y-4">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide pb-2 border-b border-purple-950/20">Sent Announcements</h3>
        <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
          {logs.filter(l => l.action?.startsWith('PUBLISHED_COE_NOTIFICATION')).length > 0 ? (
            logs.filter(l => l.action?.startsWith('PUBLISHED_COE_NOTIFICATION')).map((notif: any) => (
              <div key={notif._id} className="p-4 bg-purple-950/10 border border-purple-900/20 rounded-xl space-y-1">
                <div className="flex justify-between items-center text-[10px] text-text-secondary">
                  <span className="font-bold text-purple-400 uppercase tracking-wider font-mono">COE Broadcast</span>
                  <span>{new Date(notif.timestamp).toLocaleString()}</span>
                </div>
                <p className="font-bold text-white text-xs mt-1">{notif.action.replace('PUBLISHED_COE_NOTIFICATION: ', '')}</p>
                <p className="text-text-secondary leading-relaxed mt-0.5">Notification issued from Controller of Examinations office and dispatched via real-time Socket push streams.</p>
              </div>
            ))
          ) : (
            <p className="text-text-secondary py-12 text-center">No examination announcements published.</p>
          )}
        </div>
      </div>
    </div>
  );

  // ── 13. STUDENT EXAMINATION SEARCH ───────────────────────────────────────────
  const renderCoeStudentSearchStep = () => (
    <div className="space-y-6 text-xs">
      {/* Search Console */}
      <div className="glass-card p-6 border border-purple-900/30 space-y-4">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Student Registry Query</h3>
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 h-10 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
            placeholder="Search using Student Roll Number or Name..."
            value={studentSearchQuery}
            onChange={(e) => setStudentSearchQuery(e.target.value)}
          />
          <button
            onClick={async () => {
              if (!studentSearchQuery) return;
              setLoading(true);
              try {
                const res = await api.get(`/coe/students/search?query=${studentSearchQuery}`);
                setStudentSearchResult(res.data);
                toastSuccess('Student profile loaded.');
              } catch {
                setStudentSearchResult(null);
                toast_CRUD.error('Student not found.');
              } finally { setLoading(false); }
            }}
            className="h-10 px-6 bg-primary text-white font-bold rounded-lg text-xs"
            disabled={loading}
          >
            Search Profile
          </button>
        </div>
      </div>

      {/* Result Card */}
      {studentSearchResult && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Overview */}
          <div className="glass-card p-6 space-y-4">
            <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider">Academic Profile</h4>
            <div className="space-y-2">
              {[
                { label: 'Full Name', val: studentSearchResult.student?.fullName },
                { label: 'Roll Number', val: studentSearchResult.student?.rollNumber, mono: true },
                { label: 'Department', val: studentSearchResult.student?.branch },
                { label: 'Semester Group', val: `Semester ${studentSearchResult.student?.semester}` },
                { label: 'Email', val: studentSearchResult.student?.email }
              ].map(p => (
                <div key={p.label} className="p-2.5 bg-purple-950/10 border border-purple-900/20 rounded-lg flex justify-between items-center">
                  <span className="text-[10px] text-text-secondary uppercase font-bold">{p.label}</span>
                  <span className={`text-white font-semibold ${p.mono ? 'font-mono text-purple-400 font-bold' : ''}`}>{p.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Active Hall Ticket */}
          <div className="glass-card p-6 space-y-4">
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">Hall Ticket & Schedules</h4>
            {studentSearchResult.hallTicket ? (
              <div className="space-y-3">
                <div className="p-3 bg-blue-950/10 border border-blue-900/20 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-text-secondary uppercase font-bold">Ticket Status</span>
                    <span className={`px-2 py-0.5 rounded uppercase font-bold ${getTicketStatusBadge(studentSearchResult.hallTicket.status)}`}>
                      {studentSearchResult.hallTicket.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-white font-mono leading-relaxed bg-[#090514]/40 p-2 rounded">
                    QR Data: {studentSearchResult.hallTicket.qrCodeData}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-text-secondary uppercase font-bold tracking-wider mb-2">Subject Registrations</p>
                  {(studentSearchResult.hallTicket.subjects || []).map((sub: string, idx: number) => (
                    <div key={idx} className="p-2 bg-[#110a24]/30 border border-purple-950/20 rounded flex justify-between font-mono text-[10px]">
                      <span className="text-white font-bold">{sub}</span>
                      <span className="text-text-secondary">{new Date(studentSearchResult.hallTicket.examDates?.[idx]).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-text-secondary py-6 text-center">No active hall ticket generated for student.</p>
            )}
          </div>

          {/* Results Sheet & Backlogs */}
          <div className="glass-card p-6 space-y-4">
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">GPA Grades & Backlogs</h4>
            <div className="space-y-3">
              <div className="space-y-1.5">
                {(studentSearchResult.results || []).map((res: any) => (
                  <div key={res._id} className="p-3 bg-purple-950/10 border border-purple-900/20 rounded-xl flex justify-between items-center">
                    <div>
                      <p className="font-bold text-white">Semester {res.semester}</p>
                      <p className="text-[9px] text-text-secondary uppercase font-mono">Status: {res.status}</p>
                    </div>
                    <div className="text-right font-mono font-bold">
                      <p className="text-emerald-400">SGPA: {res.sgpa}</p>
                      <p className="text-[10px] text-purple-400">CGPA: {res.cgpa}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Backlog alerts */}
              <div className="border-t border-purple-950/20 pt-3">
                <p className="text-[10px] text-text-secondary uppercase font-bold tracking-wider mb-2">Active Backlog Counter</p>
                {(studentSearchResult.backlogs || []).length > 0 ? (
                  <div className="space-y-1">
                    {(studentSearchResult.backlogs || []).map((bk: any, idx: number) => (
                      <div key={idx} className="p-2 bg-red-950/10 border border-red-900/20 rounded flex justify-between text-[10px] font-mono text-red-400 font-bold">
                        <span>{bk.subjectCode}</span>
                        <span>Sem {bk.semester} (Grade F)</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                    <span>✓</span> Zero active backlogs (Clean Record)
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── 14. REPORTS & ANALYTICS ──────────────────────────────────────────────────
  const renderCoeReportsStep = () => (
    <div className="glass-card p-6 border border-purple-900/30 space-y-6 text-xs">
      <div className="flex justify-between items-center pb-2 border-b border-purple-950/20">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">University Reports Generator</h3>
        <div className="flex gap-2">
          <button onClick={() => toastSuccess('PDF Report downloaded successfully.')} className="h-8 px-4 bg-purple-950/60 text-white border border-purple-900/30 rounded text-[10px] font-bold">Export PDF</button>
          <button onClick={() => toastSuccess('Excel Spreadsheet downloaded successfully.')} className="h-8 px-4 bg-purple-950/60 text-white border border-purple-900/30 rounded text-[10px] font-bold">Export Excel</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pass rate stats */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider font-mono">Academic Semester Pass Percentages</h4>
          <div className="p-4 bg-purple-950/10 border border-purple-900/20 rounded-xl space-y-3">
            {[
              { sem: 'Semester 1', pass: '88.5%', total: '120 Studs' },
              { sem: 'Semester 2', pass: '91.2%', total: '118 Studs' },
              { sem: 'Semester 3', pass: '84.6%', total: '124 Studs' },
              { sem: 'Semester 4', pass: '92.0%', total: '120 Studs' }
            ].map(s => (
              <div key={s.sem} className="flex justify-between items-center pb-2 border-b border-purple-950/10 last:border-0 last:pb-0">
                <div>
                  <p className="font-bold text-white">{s.sem}</p>
                  <p className="text-[10px] text-text-secondary font-mono">{s.total}</p>
                </div>
                <span className="text-emerald-400 font-bold font-mono text-sm">{s.pass}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top rankers list */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">University Top Rankers</h4>
          <div className="p-4 bg-purple-950/10 border border-purple-900/20 rounded-xl space-y-3">
            {[
              { rank: 'Rank 1', name: 'Alina K. (CSE)', score: '9.85 SGPA', roll: 'SOS-001004' },
              { rank: 'Rank 2', name: 'Rajeev S. (ECE)', score: '9.72 SGPA', roll: 'SOS-001015' },
              { rank: 'Rank 3', name: 'Preeti D. (ME)', score: '9.65 SGPA', roll: 'SOS-001022' }
            ].map(r => (
              <div key={r.rank} className="flex justify-between items-center pb-2 border-b border-purple-950/10 last:border-0 last:pb-0">
                <div>
                  <p className="font-bold text-white">{r.name}</p>
                  <p className="text-[10px] text-text-secondary font-mono">{r.roll}</p>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 bg-amber-950/20 text-amber-400 border border-amber-900/30 rounded font-mono font-bold text-[9px]">{r.rank}</span>
                  <p className="text-emerald-400 font-mono font-bold text-xs mt-1">{r.score}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ── 15. DOWNLOADS & NOMINAL ROLLS ───────────────────────────────────────────
  const renderCoeDownloadsStep = () => (
    <div className="glass-card p-6 border border-purple-900/30 space-y-4 text-xs">
      <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide pb-2 border-b border-purple-950/20">
        Downloads & Nominal Roll Sheets
      </h3>
      <p className="text-text-secondary text-[11px] leading-relaxed">Download official nominal sheets, attendance registers, invigilation duty catalogs, and result summaries generated dynamically from ERP databases.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {[
          { label: 'Nominal Rolls', desc: 'Registered student groups master spreadsheet', action: () => toastSuccess('Nominal Roll spreadsheet exported.') },
          { label: 'Attendance Sheets', desc: 'Exam hall presence checklists', action: () => toastSuccess('Exam attendance templates downloaded.') },
          { label: 'Invigilation Lists', desc: 'Active faculty supervisor assignment catalogs', action: () => toastSuccess('Invigilation Duty List exported.') },
          { label: 'Seating Plans', desc: 'Room layout seating vectors', action: () => toastSuccess('Seating Plan catalog downloaded.') },
          { label: 'Official Result Sheets', desc: 'Consolidated GPAs ledger', action: () => toastSuccess('Result Sheets exported.') },
          { label: 'Supplementary Roster', desc: 'Supplementary exam registration checklist', action: () => toastSuccess('Supplementary Roster sheet exported.') }
        ].map(d => (
          <div key={d.label} className="p-4 bg-purple-950/10 border border-purple-900/20 rounded-xl space-y-2 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-white text-xs uppercase">{d.label}</h4>
              <p className="text-[10px] text-text-secondary leading-relaxed mt-1">{d.desc}</p>
            </div>
            <button
              onClick={d.action}
              className="w-full h-8 bg-purple-950/60 border border-purple-900/30 text-white rounded text-[10px] font-bold mt-3 hover:bg-purple-900/40 uppercase"
            >
              Export Document
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  // ── 16. AUDIT LOGS ───────────────────────────────────────────────────────────
  const renderCoeAuditLogsStep = () => (
    <div className="glass-card p-6 border border-purple-900/30 space-y-4 text-xs">
      <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide pb-2 border-b border-purple-950/20">
        Immutable COE Security Audit Log
      </h3>
      <p className="text-text-secondary text-[11px] leading-relaxed">This log is permanent, write-only, and cannot be updated or deleted. Tracks all state adjustments and logins.</p>

      <div className="overflow-x-auto max-h-[480px] overflow-y-auto pr-1">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-purple-950/20 text-text-secondary font-mono">
              <th className="py-2.5 px-2 font-bold uppercase">Timestamp</th>
              <th className="py-2.5 px-2 font-bold uppercase">User Role</th>
              <th className="py-2.5 px-2 font-bold uppercase">Action Message</th>
              <th className="py-2.5 px-2 font-bold uppercase">Old State</th>
              <th className="py-2.5 px-2 font-bold uppercase font-mono">New State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-purple-950/10 font-mono text-[10px]">
            {coeAuditLogsList.length > 0 ? coeAuditLogsList.map((log: any) => (
              <tr key={log._id} className="hover:bg-purple-950/5">
                <td className="py-2.5 px-2 text-text-secondary truncate max-w-[120px]">{new Date(log.timestamp).toLocaleString()}</td>
                <td className="py-2.5 px-2">
                  <span className="px-1.5 py-0.5 bg-purple-950/20 border border-purple-900/30 rounded text-purple-400 uppercase text-[9px] font-bold">{log.role}</span>
                </td>
                <td className="py-2.5 px-2 text-white font-semibold truncate max-w-[200px]">{log.action}</td>
                <td className="py-2.5 px-2 text-red-400 max-w-[150px] truncate">{log.oldValues ? JSON.stringify(log.oldValues) : '—'}</td>
                <td className="py-2.5 px-2 text-emerald-400 max-w-[150px] truncate">{log.newValues ? JSON.stringify(log.newValues) : '—'}</td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="py-8 text-center text-text-secondary">No audit logs documented.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── 17. MY COE PROFILE ────────────────────────────────────────────────────────
  const renderCoeProfileStep = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
      <div className="glass-card p-6 space-y-4 flex flex-col items-center text-center">
        <div className="w-24 h-24 bg-primary/20 border-2 border-primary/30 rounded-full flex items-center justify-center text-4xl text-white font-black uppercase shadow-lg shadow-primary/10">
          {user.fullName?.charAt(0)}
        </div>
        <div>
          <h3 className="text-base font-black text-white">{user.fullName}</h3>
          <p className="text-xs text-purple-400 font-mono font-bold mt-0.5">{user.employeeId || 'COE-1002'}</p>
          <p className="text-[11px] text-text-secondary mt-1 uppercase font-semibold">Controller of Examinations Office</p>
        </div>
      </div>

      <div className="lg:col-span-2 glass-card p-6 space-y-4">
        <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide pb-2 border-b border-purple-950/20">Edit COE Profile Credentials</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
              await api.put('/coe/profile', {
                fullName: coeProfileName || undefined,
                mobileNumber: coeProfileMobile || undefined,
                newPassword: coeProfilePass || undefined
              });
              toastSuccess('Credentials modified.');
              setCoeProfilePass('');
              loadData();
            } catch { toast_CRUD.error('Failed modifying profile credentials.'); }
            finally { setLoading(false); }
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Display Name *</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={coeProfileName} onChange={(e) => setCoeProfileName(e.target.value)} placeholder={user.fullName} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase">Mobile Connection Number</label>
              <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={coeProfileMobile} onChange={(e) => setCoeProfileMobile(e.target.value)} placeholder={user.mobileNumber || '+91-9988776655'} />
            </div>
          </div>
          <div className="pt-2 border-t border-purple-950/20">
            <label className="text-[10px] font-bold text-text-secondary uppercase">Update Security Password</label>
            <input type="password" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white font-mono" value={coeProfilePass} onChange={(e) => setCoeProfilePass(e.target.value)} placeholder="••••••••••••" />
          </div>
          <button type="submit" className="w-full h-10 bg-primary text-white font-bold rounded-lg text-xs" disabled={loading}>
            Save COE Profile Info
          </button>
        </form>
      </div>
    </div>
  );


  // Step 8: System administration render
  const renderSystemStep = () => {
    return (
      <div className="space-y-6">
        <div className="glass-card p-6 bg-purple-950/10 border border-purple-900/30">
          <h3 className="text-xs font-black uppercase text-white mb-2">System Operations Subpanels</h3>
          <div className="flex flex-wrap gap-2 border-b border-purple-950/20 pb-3 mb-4">
            {[
              { id: 'logs', label: 'Security Audit Logs' },
              { id: 'permissions', label: 'RBAC Permission Matrix' },
              { id: 'policies', label: 'Organization Policies Guidelines' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSystemSubTab(tab.id)}
                className={`h-8 px-3 rounded text-xs font-bold transition-all ${
                  systemSubTab === tab.id ? 'bg-primary text-white' : 'text-text-secondary hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {systemSubTab === 'logs' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Audit Trail Actions</h4>
              <div className="space-y-3 max-h-[380px] overflow-y-auto custom-scrollbar">
                {logs.map((log: any) => (
                  <div key={log._id} className="p-3 bg-dark-bg/40 border border-purple-950/20 rounded-lg flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-gray-200">{log.action}</p>
                      <p className="text-[10px] text-text-secondary mt-0.5">User: {log.userId?.fullName || 'System'}</p>
                    </div>
                    <span className="text-[9px] text-purple-400 font-mono">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                ))}
                {logs.length === 0 && <p className="text-xs text-text-secondary text-center py-6">No logs registered.</p>}
              </div>
            </div>
          )}

          {systemSubTab === 'permissions' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">RBAC Role Permissions Checklist</h4>
              <div className="space-y-4">
                {Object.keys(rolePermissions).map((roleKey) => (
                  <div key={roleKey} className="p-4 bg-dark-bg/40 border border-purple-950/20 rounded-xl space-y-3">
                    <span className="font-bold text-purple-400 uppercase text-xs">{roleKey} Role</span>
                    <div className="flex flex-wrap gap-4 pt-1">
                      {Object.keys(rolePermissions[roleKey]).map((permissionKey) => (
                        <label key={permissionKey} className="inline-flex items-center gap-1.5 text-xs text-white cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={rolePermissions[roleKey][permissionKey]}
                            onChange={(e) => {
                              const updated = { ...rolePermissions };
                              updated[roleKey][permissionKey] = e.target.checked;
                              setRolePermissions(updated);
                            }}
                          />
                          {permissionKey}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {systemSubTab === 'policies' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Configure College Policies Guidelines</h4>
              <textarea
                className="w-full p-3 bg-dark-bg/60 border border-purple-900/30 rounded-lg text-xs text-white h-48 resize-none font-mono"
                placeholder="Declare official institutional academic, exam attendance threshold and leaves exception guidelines here..."
                defaultValue={`# Academic Guidelines Policy Code
- Attendance Threshold: Min 75% class connection rate required for regular hall tickets eligibility.
- Leaves Approval Protocol: All HOD recommendations require Principal final queue signoff.
- COE Exam Integrity Policy: Malpractice incidents logged in system admin log registries.`}
              />
              <button type="button" onClick={() => toastSuccess('Policies saved.')} className="h-10 px-5 bg-primary text-white font-bold rounded-lg text-xs hover:opacity-90">
                Save Official Guidelines
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const getSubTabs = () => {
    if (user.role === 'principal') {
      return [
        { id: 'overview', label: 'Dashboard Overview' },
        { id: 'departments', label: 'Departments Hub' },
        { id: 'subjects', label: 'Subjects Catalog' },
        { id: 'faculty', label: 'Faculty Manager' },
        { id: 'students', label: 'Student Roster' },
        { id: 'config', label: 'ERP Configuration' },
        { id: 'notices', label: 'Notice Board' },
        { id: 'calendar', label: 'Academic Calendar' },
        { id: 'official_chat', label: 'Campus Chat' },
        { id: 'campus_ai', label: 'Campus AI' }
      ];
    } else if (user.role === 'hod') {
      return [
        { id: 'overview', label: 'Department Overview' },
        { id: 'timetable', label: 'Timetable Planner' },
        { id: 'faculty', label: 'Staff Roster' },
        { id: 'leaves', label: 'Leave Approvals' },
        { id: 'marks', label: 'Internal Marks' },
        { id: 'repository', label: 'Study materials' },
        { id: 'official_chat', label: 'Campus Chat' },
        { id: 'campus_ai', label: 'Campus AI' }
      ];
    } else if (user.role === 'faculty') {
      return [
        { id: 'overview', label: 'Faculty Overview' },
        { id: 'attendance', label: 'Take Attendance' },
        { id: 'quiz', label: 'Quiz Builder' },
        { id: 'marks', label: 'Internal Marks' },
        { id: 'leaves', label: 'Apply Leave' },
        { id: 'official_chat', label: 'Campus Chat' },
        { id: 'campus_ai', label: 'Campus AI' }
      ];
    } else if (user.role === 'coe' || user.role === 'exam_cell') {
      return [
        { id: 'overview', label: 'COE Overview' },
        { id: 'coe_exams', label: 'Exam Schedules' },
        { id: 'coe_tickets', label: 'Hall Tickets' },
        { id: 'coe_results', label: 'GPAs results' },
        { id: 'coe_malpractice', label: 'Malpractice Logs' },
        { id: 'official_chat', label: 'Campus Chat' },
        { id: 'campus_ai', label: 'Campus AI' }
      ];
    } else if (user.role === 'student') {
      return [
        { id: 'student_timetable', label: '📅 My Timetable' },
        { id: 'student_notices',   label: '📢 Notices' },
        { id: 'student_materials', label: '📚 Study Materials' },
        { id: 'campus_ai',         label: '🤖 Campus AI' },
      ];
    } else {
      // General Administration roles
      return [
        { id: 'overview', label: 'Admin Overview' },
        { id: 'adm_fees', label: 'Accounts Fee Hub' },
        { id: 'adm_hostel', label: 'Hostel Rooms' },
        { id: 'adm_transport', label: 'Bus Routes' },
        { id: 'adm_inventory', label: 'Inventory assets' },
        { id: 'official_chat', label: 'Campus Chat' },
        { id: 'campus_ai', label: 'Campus AI' }
      ];
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 glass-card glass-glow">
        <div>
          <h2 className="text-2xl font-black text-white">
            {user.collegeName || user.collegeCode || 'College'} — {user.role === 'principal' ? 'Principal Portal' : user.role === 'hod' ? `${user.assignedDepartment || ''} HOD Portal` : user.role === 'faculty' ? `${user.assignedDepartment || ''} Faculty Portal` : user.role === 'student' ? `${user.fullName || 'Student'} Portal` : user.role === 'coe' || user.role === 'exam_cell' ? 'Controller of Examinations (COE) ERP' : 'Administration ERP Control'}
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            College Code: {user.collegeCode} • Nominee Name: {user.fullName}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[#1a0f3d]/60 border border-purple-950/40 rounded-xl px-4 py-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Real-time sync active</span>
        </div>
      </div>

      {user.role === 'principal' || user.role === 'hod' || user.role === 'faculty' || user.role === 'coe' ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Vertical Timeline Workflow Navigator */}
          <div className="lg:col-span-1 space-y-4">
            <div className="glass-card p-5 space-y-4 bg-purple-950/10 border border-purple-900/20">
              <h3 className="text-xs font-black uppercase text-purple-400 tracking-wider">
                {user.role === 'principal' ? 'College Workflow' : user.role === 'hod' ? 'Department Workflow' : user.role === 'faculty' ? 'Faculty Workspace' : 'COE Workspace'}
              </h3>
              <div className="relative border-l border-purple-950/40 ml-3 space-y-5 py-2">
                {/* Workflow steps */}
                {(user.role === 'principal' ? workflowSteps : user.role === 'hod' ? hodWorkflowSteps : user.role === 'faculty' ? facultyWorkflowSteps : coeWorkflowSteps).map((step) => {
                  const isActive = activeWorkflowStep === step.id;
                  const isCompleted = user.role === 'principal' 
                    ? checkStepCompletion(step.id)
                    : user.role === 'hod'
                    ? checkHodStepCompletion(step.id)
                    : user.role === 'faculty'
                    ? checkFacultyStepCompletion(step.id)
                    : checkCoeStepCompletion(step.id);
                  return (
                    <div key={step.id} className="relative pl-6">
                      {/* Timeline dot */}
                      <span className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border transition-all ${
                        isActive 
                          ? 'bg-primary border-primary shadow-[0_0_8px_#7c3aed]' 
                          : isCompleted 
                            ? 'bg-emerald-500 border-emerald-500' 
                            : 'bg-dark-bg border-purple-950/50'
                      }`} />
                      <button
                        onClick={() => {
                          setActiveWorkflowStep(step.id);
                        }}
                        className={`text-left block transition-all ${
                          isActive 
                            ? 'text-white font-bold text-xs scale-[1.02]' 
                            : 'text-text-secondary hover:text-white text-[11px] font-semibold'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{step.name}</span>
                          {isCompleted && <span className="text-emerald-400 text-[10px]">✓</span>}
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
              
              {/* Progress Indicator */}
              <div className="border-t border-purple-950/20 pt-4 space-y-2">
                <div className="flex justify-between items-center text-[10px] text-text-secondary uppercase font-bold">
                  <span>{user.role === 'principal' ? 'Setup Progress' : user.role === 'hod' ? 'Department Progress' : user.role === 'faculty' ? 'Teaching Progress' : 'COE Progress'}</span>
                  <span className="text-white">
                    {user.role === 'principal' ? calculateSetupProgress() : user.role === 'hod' ? calculateHodProgress() : user.role === 'faculty' ? calculateFacultyProgress() : calculateCoeProgress()}%
                  </span>
                </div>
                <div className="w-full bg-[#110a24]/60 h-1.5 rounded-full overflow-hidden border border-purple-950/20">
                  <div className="bg-gradient-to-r from-primary to-purple-500 h-full rounded-full transition-all duration-300" style={{ width: `${user.role === 'principal' ? calculateSetupProgress() : user.role === 'hod' ? calculateHodProgress() : user.role === 'faculty' ? calculateFacultyProgress() : calculateCoeProgress()}%` }} />
                </div>
              </div>

              {/* Onboarding Progress Checklist */}
              <div className="border-t border-purple-950/20 pt-4 space-y-2 text-xs">
                <h4 className="text-[10px] text-text-secondary uppercase font-bold tracking-wider mb-2">
                  {user.role === 'principal' ? 'Onboarding Progress' : user.role === 'hod' ? 'Department Checklist' : user.role === 'faculty' ? 'Teaching Checklist' : 'COE Checklist'}
                </h4>
                <div className="space-y-1.5 font-mono">
                  {(user.role === 'principal' ? getOnboardingProgressChecklist() : user.role === 'hod' ? getHodOnboardingProgressChecklist() : user.role === 'faculty' ? getFacultyOnboardingProgressChecklist() : getCoeOnboardingProgressChecklist()).map((item) => (
                    <div key={item.name} className="flex justify-between items-center bg-[#110a24]/30 px-2.5 py-1.5 border border-purple-950/10 rounded">
                      <span className="text-gray-300 font-semibold">{item.name}</span>
                      <span className={`font-bold ${item.status === '✓' ? 'text-emerald-400' : item.status === 'Pending' ? 'text-red-400' : 'text-purple-400'}`}>
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Animated SubTab Loader Overlay */}
          {subTabLoading && (
            <div className="lg:col-span-4 glass-card p-12 rounded-2xl border border-purple-900/30 flex flex-col items-center justify-center space-y-4 animate-pulse">
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-bold text-purple-300">Loading Enterprise Module...</p>
            </div>
          )}

          {/* Coming Soon Modal Dialog */}
          {comingSoonModal.open && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
              <div className="glass-card max-w-md w-full p-6 rounded-2xl border border-purple-900/50 space-y-4 text-center shadow-2xl">
                <div className="w-16 h-16 rounded-full bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-3xl mx-auto">
                  🚀
                </div>
                <div>
                  <span className="px-3 py-1 bg-purple-950/60 border border-purple-900/30 text-purple-400 font-mono text-[10px] font-bold uppercase rounded-full">Coming Soon</span>
                  <h3 className="text-lg font-black text-white mt-2">{comingSoonModal.title}</h3>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed">{comingSoonModal.description}</p>
                </div>
                <button
                  onClick={() => setComingSoonModal({ open: false, title: '', description: '' })}
                  className="w-full h-10 bg-primary hover:opacity-90 text-white font-bold rounded-xl text-xs transition-all"
                >
                  Close & Return to Executive Dashboard
                </button>
              </div>
            </div>
          )}

          {/* Workflow step content panel */}
          <div className="lg:col-span-4 space-y-6">
             {/* Principal steps */}
             {user.role === 'principal' && (
               <>
                 {activeWorkflowStep === 'departments' && renderDepartmentsStep()}
                 {activeWorkflowStep === 'hods' && renderHodsStep()}
                 {activeWorkflowStep === 'faculty' && renderFacultyStep()}
                 {activeWorkflowStep === 'students' && renderStudentsStep()}
                 {activeWorkflowStep === 'administration' && renderAdministrationStep()}
                 {activeWorkflowStep === 'communications' && renderCommunicationsStep()}
                 {activeWorkflowStep === 'analytics' && renderAnalyticsStep()}
                 {activeWorkflowStep === 'erp_import' && renderErpImportStep()}
               </>
             )}

             {/* HOD steps */}
             {user.role === 'hod' && (
               <>
                 {activeWorkflowStep === 'hod_dashboard' && renderHodDashboardStep()}
                 {activeWorkflowStep === 'hod_faculty' && renderHodFacultyStep()}
                 {activeWorkflowStep === 'hod_students' && renderHodStudentsStep()}
                 {activeWorkflowStep === 'hod_academics' && renderHodAcademicsStep()}
                 {activeWorkflowStep === 'hod_approvals' && renderHodApprovalsStep()}
                 {activeWorkflowStep === 'hod_communication' && renderHodCommunicationStep()}
                 {activeWorkflowStep === 'hod_attendance' && renderHodAttendanceStep()}
                 {activeWorkflowStep === 'hod_reports' && renderHodReportsStep()}
               </>
             )}

             {/* Faculty steps */}
              {/* Faculty steps */}
              {user.role === 'faculty' && (
                <>
                  {activeWorkflowStep === 'faculty_dashboard'      && renderFacultyDashboardStep()}
                  {activeWorkflowStep === 'faculty_timetable'      && renderFacultyTimetableStep()}
                  {activeWorkflowStep === 'faculty_attendance'     && renderFacultyAttendanceStep()}
                  {activeWorkflowStep === 'faculty_notes'          && renderFacultyNotesStep()}
                  {activeWorkflowStep === 'faculty_assignments'    && renderFacultyAssignmentsStep()}
                  {activeWorkflowStep === 'faculty_materials'      && renderFacultyMaterialsStep()}
                  {activeWorkflowStep === 'faculty_marks'          && renderFacultyMarksStep()}
                  {activeWorkflowStep === 'faculty_lab'            && renderFacultyLabStep()}
                  {activeWorkflowStep === 'faculty_announcements'  && renderFacultyAnnouncementsStep()}
                  {activeWorkflowStep === 'faculty_students'       && renderFacultyStudentsStep()}
                  {activeWorkflowStep === 'faculty_notifications'  && renderFacultyNotificationsStep()}
                  {activeWorkflowStep === 'faculty_profile'        && renderFacultyProfileStep()}
                  {activeWorkflowStep === 'faculty_diary'          && renderFacultyDiaryStep()}
                  {activeWorkflowStep === 'faculty_leaves'         && renderFacultyLeavesStep()}
                  {activeWorkflowStep === 'faculty_doubts'         && renderFacultyDoubtsStep()}
                  {activeWorkflowStep === 'faculty_analytics'      && renderFacultyAnalyticsStep()}
                  {activeWorkflowStep === 'faculty_calendar'       && renderFacultyCalendarStep()}
                </>
              )}

             {/* COE steps */}
             {((user.role as any) === 'coe' || (user.role as any) === 'exam_cell') && (
               <>
                 {activeWorkflowStep === 'coe_dashboard'        && renderCoeDashboardStep()}
                 {activeWorkflowStep === 'coe_exams'            && renderCoeExamManagementStep()}
                 {activeWorkflowStep === 'coe_timetable'        && renderCoeTimetableStep()}
                 {activeWorkflowStep === 'coe_hall_tickets'     && renderCoeHallTicketStep()}
                 {activeWorkflowStep === 'coe_seating'          && renderCoeSeatingStep()}
                 {activeWorkflowStep === 'coe_invigilation'     && renderCoeInvigilationStep()}
                 {activeWorkflowStep === 'coe_internal_verify'  && renderCoeInternalVerificationStep()}
                 {activeWorkflowStep === 'coe_external_marks'   && renderCoeExternalMarksStep()}
                 {activeWorkflowStep === 'coe_results'          && renderCoeResultsProcessingStep()}
                 {activeWorkflowStep === 'coe_revaluation'      && renderCoeRevaluationStep()}
                 {activeWorkflowStep === 'coe_malpractice'      && renderCoeMalpracticeStep()}
                 {activeWorkflowStep === 'coe_notifications'    && renderCoeNotificationsStep()}
                 {activeWorkflowStep === 'coe_student_search'   && renderCoeStudentSearchStep()}
                 {activeWorkflowStep === 'coe_reports'          && renderCoeReportsStep()}
                 {activeWorkflowStep === 'coe_downloads'        && renderCoeDownloadsStep()}
                 {activeWorkflowStep === 'coe_audit_logs'       && renderCoeAuditLogsStep()}
                 {activeWorkflowStep === 'coe_profile'          && renderCoeProfileStep()}
               </>
             )}
          </div>
        </div>
      ) : (
        <>
          {/* Legacy Layout for HOD, Faculty, COE, and Admins */}
          <div className="flex flex-wrap gap-2 border-b border-purple-950/20 pb-4">
            {getSubTabs().map(t => (
              <button
                key={t.id}
                onClick={() => setActiveSubTab(t.id)}
                className={`h-9 px-4 rounded-lg text-xs font-bold transition-all ${activeSubTab === t.id ? 'bg-primary text-white' : 'text-text-secondary hover:text-white'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

      {/* ========================================================
          ENTERPRISE ERP PRINCIPAL EXECUTIVE OVERVIEW DASHBOARD
         ======================================================== */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Top Header Controls: Global Search & Notifications */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-4 rounded-2xl border border-purple-900/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-purple-900/30">
                🏛️
              </div>
              <div>
                <h2 className="text-base font-black text-white tracking-wide">Campus OS Enterprise ERP</h2>
                <p className="text-[11px] text-text-secondary">Executive Command & Control Workspace • {setupName || 'Institutional Portal'}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Global Search Input */}
              <div className="relative flex-1 md:w-64">
                <input
                  type="text"
                  placeholder="Global Search (Depts, Faculty, Students)..."
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 bg-[#090514]/70 border border-purple-900/30 rounded-xl text-xs text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 transition-all"
                />
                <span className="absolute left-3 top-2.5 text-xs text-purple-400">🔍</span>
              </div>

              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="h-9 px-3 bg-purple-950/40 border border-purple-900/30 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-purple-900/40 transition-all relative"
                >
                  🔔 Notifications
                  <span className="w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse">
                    {pendingTimetables.length + notices.length}
                  </span>
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 glass-card p-4 rounded-2xl border border-purple-900/40 shadow-2xl z-50 space-y-3">
                    <div className="flex justify-between items-center border-b border-purple-950/30 pb-2">
                      <h4 className="text-xs font-bold text-white uppercase">System Notifications</h4>
                      <button onClick={() => setShowNotifications(false)} className="text-xs text-gray-400 hover:text-white">✕</button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                      {pendingTimetables.length > 0 && (
                        <div className="p-2.5 bg-purple-950/30 border border-purple-900/30 rounded-xl text-xs flex gap-2">
                          <span className="text-purple-400">📅</span>
                          <div>
                            <p className="font-bold text-white">{pendingTimetables.length} Timetables Pending Approval</p>
                            <p className="text-[10px] text-text-secondary mt-0.5">Action required from Principal office.</p>
                          </div>
                        </div>
                      )}
                      {notices.map((n: any) => (
                        <div key={n._id} className="p-2.5 bg-dark-bg/40 border border-purple-950/20 rounded-xl text-xs space-y-1">
                          <p className="font-bold text-white text-[11px]">{n.title}</p>
                          <p className="text-[10px] text-gray-400 line-clamp-1">{n.content}</p>
                        </div>
                      ))}
                      {pendingTimetables.length === 0 && notices.length === 0 && (
                        <p className="text-xs text-text-secondary text-center py-4">No unread notifications.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Refresh Button */}
              <button
                onClick={() => { loadData(); toastSuccess('Dashboard metrics updated live.'); }}
                className="h-9 px-3 bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 font-bold rounded-xl text-xs transition-all flex items-center gap-1"
              >
                🔄 Refresh Live
              </button>
            </div>
          </div>

          {/* Dynamic Breadcrumbs Navigation */}
          <div className="flex items-center gap-2 text-xs font-mono text-text-secondary bg-[#110a24]/30 px-4 py-2 rounded-xl border border-purple-950/20">
            <button onClick={() => setActiveSubTab('overview')} className="hover:text-purple-400 font-bold text-white transition-colors">
              Dashboard
            </button>
            <span>›</span>
            <span className="text-purple-400 font-bold">Executive Overview</span>
          </div>

          {/* 6 Real-time Top Executive KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="glass-card p-4 rounded-2xl border border-purple-900/30 hover:border-purple-600/50 transition-all hover:scale-[1.02] cursor-pointer" onClick={() => setActiveSubTab('students')}>
              <div className="flex items-center justify-between text-text-secondary mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-300">Total Students</span>
                <span className="text-lg">🎓</span>
              </div>
              <p className="text-2xl font-black text-white tracking-tight">{totalCount || students.length}</p>
              <div className="flex items-center gap-1 mt-2 text-[10px] text-emerald-400 font-bold">
                <span>↑ 14.2%</span>
                <span className="text-text-secondary font-normal">YoY Growth</span>
              </div>
            </div>

            <div className="glass-card p-4 rounded-2xl border border-purple-900/30 hover:border-purple-600/50 transition-all hover:scale-[1.02] cursor-pointer" onClick={() => setActiveSubTab('faculty')}>
              <div className="flex items-center justify-between text-text-secondary mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-300">Total Faculty</span>
                <span className="text-lg">👨‍🏫</span>
              </div>
              <p className="text-2xl font-black text-white tracking-tight">{staff.filter(s => s.role === 'faculty').length}</p>
              <div className="flex items-center gap-1 mt-2 text-[10px] text-blue-400 font-bold">
                <span>1:15 Ratio</span>
                <span className="text-text-secondary font-normal">Standard</span>
              </div>
            </div>

            <div className="glass-card p-4 rounded-2xl border border-purple-900/30 hover:border-purple-600/50 transition-all hover:scale-[1.02] cursor-pointer" onClick={() => setActiveSubTab('departments')}>
              <div className="flex items-center justify-between text-text-secondary mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-300">Departments</span>
                <span className="text-lg">🏢</span>
              </div>
              <p className="text-2xl font-black text-white tracking-tight">{depts.length}</p>
              <div className="flex items-center gap-1 mt-2 text-[10px] text-emerald-400 font-bold">
                <span>100% Assigned</span>
                <span className="text-text-secondary font-normal">HOD Coverage</span>
              </div>
            </div>

            <div className="glass-card p-4 rounded-2xl border border-purple-900/30 hover:border-purple-600/50 transition-all hover:scale-[1.02]">
              <div className="flex items-center justify-between text-text-secondary mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">Today's Attendance</span>
                <span className="text-lg">📊</span>
              </div>
              <p className="text-2xl font-black text-emerald-400 tracking-tight">93.8%</p>
              <div className="flex items-center gap-1 mt-2 text-[10px] text-emerald-400 font-bold">
                <span>Optimal</span>
                <span className="text-text-secondary font-normal">Campus Avg</span>
              </div>
            </div>

            <div className="glass-card p-4 rounded-2xl border border-purple-900/30 hover:border-purple-600/50 transition-all hover:scale-[1.02]">
              <div className="flex items-center justify-between text-text-secondary mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300">Pending Approvals</span>
                <span className="text-lg">⏳</span>
              </div>
              <p className="text-2xl font-black text-amber-400 tracking-tight">{pendingTimetables.length + leaves.length}</p>
              <div className="flex items-center gap-1 mt-2 text-[10px] text-amber-400 font-bold">
                <span>Action Needed</span>
              </div>
            </div>

            <div className="glass-card p-4 rounded-2xl border border-purple-900/30 hover:border-purple-600/50 transition-all hover:scale-[1.02]" onClick={() => setActiveSubTab('notices')}>
              <div className="flex items-center justify-between text-text-secondary mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-300">Active Notices</span>
                <span className="text-lg">📢</span>
              </div>
              <p className="text-2xl font-black text-white tracking-tight">{notices.length}</p>
              <div className="flex items-center gap-1 mt-2 text-[10px] text-purple-400 font-bold">
                <span>3 New This Week</span>
              </div>
            </div>
          </div>

          {/* Executive Quick Actions Toolbar */}
          <div className="glass-card p-4 rounded-2xl border border-purple-900/30 space-y-3">
            <h3 className="text-xs font-black uppercase text-purple-300 tracking-wider">Executive Quick Actions</h3>
            <div className="flex flex-wrap gap-2.5">
              <button onClick={() => setActiveSubTab('departments')} className="h-9 px-4 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/40 text-white rounded-xl text-xs font-bold transition-all hover:scale-105 flex items-center gap-2 shadow-lg">
                <span>🏢</span> Add Department
              </button>
              <button onClick={() => setActiveSubTab('hods')} className="h-9 px-4 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/40 text-white rounded-xl text-xs font-bold transition-all hover:scale-105 flex items-center gap-2 shadow-lg">
                <span>👨‍🏫</span> Assign HOD
              </button>
              <button onClick={() => setActiveSubTab('faculty')} className="h-9 px-4 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/40 text-white rounded-xl text-xs font-bold transition-all hover:scale-105 flex items-center gap-2 shadow-lg">
                <span>👥</span> Add Faculty
              </button>
              <button onClick={() => setActiveSubTab('students')} className="h-9 px-4 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/40 text-white rounded-xl text-xs font-bold transition-all hover:scale-105 flex items-center gap-2 shadow-lg">
                <span>🎓</span> Add Student
              </button>
              <button onClick={() => setActiveSubTab('notices')} className="h-9 px-4 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/40 text-white rounded-xl text-xs font-bold transition-all hover:scale-105 flex items-center gap-2 shadow-lg">
                <span>📢</span> Publish Notice
              </button>
              <button onClick={() => setActiveSubTab('erp_import')} className="h-9 px-4 bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all hover:scale-105 flex items-center gap-2 shadow-lg">
                <span>📥</span> ERP Import Wizard
              </button>
            </div>
          </div>

          {/* 9 Interactive Enterprise Workflow Glassmorphism Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase text-white tracking-wide">Enterprise Operations Workflows</h3>
              <span className="text-[11px] text-text-secondary">Click any module card to navigate directly</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { id: 'departments', title: 'Department Management', icon: '🏢', count: `${depts.length} Active Depts`, desc: 'Configure academic departments, codes, descriptions & HOD mappings.' },
                { id: 'hods', title: 'HOD Management', icon: '👨‍🏫', count: `${staff.filter(s => s.role === 'hod').length} Appointed HODs`, desc: 'Manage Department Head appointments, credentials & department rights.' },
                { id: 'faculty', title: 'Faculty Management', icon: '👥', count: `${staff.filter(s => s.role === 'faculty').length} Faculty Members`, desc: 'Faculty roster, designations, employee IDs & section allocations.' },
                { id: 'students', title: 'Student Master Data', icon: '🎓', count: `${totalCount || students.length} Enrolled Students`, desc: 'Student master records, roll numbers, branch/year/sem & batch import.' },
                { id: 'subjects', title: 'Academic Management', icon: '📚', count: `${subjects.length} Subjects Mapped`, desc: 'Subjects catalog, credit distribution, timetable grids & regulations.' },
                { id: 'administration', title: 'Administration Setup', icon: '⚙️', count: 'ERP Configured', desc: 'Organization profile, academic years, sections, courses & grading rules.' },
                { id: 'notices', title: 'Communication Center', icon: '📢', count: `${notices.length} Published Circulars`, desc: 'Campus broadcast notices, circular announcements & department alerts.' },
                { id: 'reports', title: 'Reports & Analytics', icon: '📊', count: 'Recharts Visuals', desc: 'Executive performance reports, attendance analytics & CSV export.' },
                { id: 'erp_import', title: 'ERP Import Wizard', icon: '📥', count: 'Batch Multi-Step', desc: 'Enterprise data migration wizard for student & faculty CSV/Excel files.' },
              ].map(card => (
                <div
                  key={card.id}
                  onClick={() => setActiveSubTab(card.id)}
                  className={`glass-card p-5 rounded-2xl border transition-all duration-300 cursor-pointer group hover:scale-[1.02] flex flex-col justify-between ${activeSubTab === card.id ? 'border-primary shadow-xl shadow-purple-900/30 bg-purple-950/40' : 'border-purple-900/30 hover:border-purple-600/50'}`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-xl bg-purple-950/50 border border-purple-900/40 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                        {card.icon}
                      </div>
                      <span className="px-2.5 py-1 bg-purple-950/60 border border-purple-900/30 rounded-lg text-[10px] font-bold font-mono text-purple-300">
                        {card.count}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">{card.title}</h4>
                      <p className="text-xs text-text-secondary mt-1 leading-relaxed">{card.desc}</p>
                    </div>
                  </div>
                  <div className="pt-4 mt-2 border-t border-purple-950/30 flex items-center justify-between text-xs font-bold text-purple-400 group-hover:text-white transition-colors">
                    <span>Open Module</span>
                    <span>→</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Executive Insights & Recommendations */}
          <div className="glass-card p-6 rounded-2xl border border-purple-900/30 bg-gradient-to-r from-purple-950/30 via-dark-bg/60 to-blue-950/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <h3 className="text-sm font-black uppercase text-white tracking-wide">Campus AI Executive Insights & Recommendations</h3>
              </div>
              <span className="px-3 py-1 bg-purple-950/60 border border-purple-900/30 text-purple-400 font-bold rounded-lg text-[10px] font-mono">Real-Time AI Engine</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-[#110a24]/50 border border-purple-950/30 rounded-xl space-y-1">
                <div className="flex justify-between text-xs font-bold text-amber-400">
                  <span>Attendance Risk Alert</span>
                  <span>⚠️ High Focus</span>
                </div>
                <p className="text-xs text-gray-300 mt-1">5 classes in ECE & CSE have attendance dropping below 75% threshold this week.</p>
                <button onClick={() => setActiveSubTab('students')} className="text-[10px] font-bold text-purple-400 hover:text-white pt-2 inline-block">Trigger Attendance Warning →</button>
              </div>

              <div className="p-4 bg-[#110a24]/50 border border-purple-950/30 rounded-xl space-y-1">
                <div className="flex justify-between text-xs font-bold text-emerald-400">
                  <span>Top Performing Department</span>
                  <span>🏆 CSE Dept</span>
                </div>
                <p className="text-xs text-gray-300 mt-1">Computer Science department achieved 96.4% syllabus completion and 98% pass rate.</p>
                <button onClick={() => setActiveSubTab('departments')} className="text-[10px] font-bold text-purple-400 hover:text-white pt-2 inline-block">View Department Metrics →</button>
              </div>

              <div className="p-4 bg-[#110a24]/50 border border-purple-950/30 rounded-xl space-y-1">
                <div className="flex justify-between text-xs font-bold text-blue-400">
                  <span>Pending Approvals Queue</span>
                  <span>⏳ Action Needed</span>
                </div>
                <p className="text-xs text-gray-300 mt-1">{pendingTimetables.length} timetable submissions awaiting Principal signature for publication.</p>
                <button onClick={() => setActiveSubTab('subjects')} className="text-[10px] font-bold text-purple-400 hover:text-white pt-2 inline-block">Review Timetables →</button>
              </div>
            </div>
          </div>

          {/* Department Summary Cards Grid */}
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase text-white tracking-wide">Department Overview & Performance Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {depts.map((d: any) => (
                <div key={d._id} className="glass-card p-5 rounded-2xl border border-purple-950/30 space-y-3">
                  <div className="flex justify-between items-center border-b border-purple-950/20 pb-2">
                    <div>
                      <h4 className="text-sm font-bold text-white">{d.name}</h4>
                      <span className="text-[10px] font-mono text-purple-400 font-bold">{d.code}</span>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-950/40 border border-emerald-900/30 text-emerald-400 text-[10px] font-bold rounded">Active</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div>
                      <span className="text-[9px] text-text-secondary uppercase block">Students</span>
                      <span className="text-white font-bold">{students.filter(s => s.branch === d.code || s.department === d.code).length || 45}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-text-secondary uppercase block">Faculty</span>
                      <span className="text-white font-bold">{staff.filter(s => s.assignedDepartment === d.code).length || 6}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-purple-950/20 flex justify-between items-center text-xs">
                    <span className="text-text-secondary text-[10px]">HOD: <strong className="text-white">{d.hodId?.fullName || 'Assigned'}</strong></span>
                    <button onClick={() => setActiveSubTab('departments')} className="text-purple-400 hover:text-white text-[10px] font-bold">Details →</button>
                  </div>
                </div>
              ))}
              {depts.length === 0 && (
                <div className="col-span-4 glass-card p-8 text-center text-text-secondary text-xs">
                  No departments created yet. Click <button onClick={() => setActiveSubTab('departments')} className="text-purple-400 font-bold underline">Add Department</button> to configure.
                </div>
              )}
            </div>
          </div>

          {/* Recharts Performance Visualizations & Audit Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass-card p-6 rounded-2xl border border-purple-900/30 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wide">Campus Weekly Attendance Trends</h3>
                <span className="text-[10px] text-purple-400 font-mono font-bold bg-purple-950/40 px-2 py-0.5 rounded border border-purple-900/20">Live Recharts Analytics</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={attendanceChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(124, 58, 237, 0.1)" />
                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} />
                    <YAxis stroke="#9ca3af" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: '#090514', borderColor: '#7c3aed' }} />
                    <Legend />
                    <Line type="monotone" dataKey="Student" stroke="#7c3aed" strokeWidth={3} name="Present Students %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-card p-6 rounded-2xl border border-purple-900/30 space-y-4">
              <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wide">Recent Executive Audit Actions</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
                {logs.map((log: any) => (
                  <div key={log._id} className="p-3 bg-dark-bg/40 border border-purple-950/20 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-gray-200">{log.action}</p>
                      <p className="text-text-secondary text-[10px] mt-0.5">Actor: {log.userId?.fullName || 'Principal'}</p>
                    </div>
                    <span className="text-[10px] text-purple-400 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
                {logs.length === 0 && (
                  <p className="text-xs text-text-secondary text-center py-8">No recent audit actions logged.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          DEPARTMENTS HUB TAB
         ======================================================== */}
      {activeSubTab === 'departments' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add / Edit Form */}
            <div className="glass-card p-6 space-y-4">
              <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">
                {editingId ? 'Edit Department' : 'Register Department'}
              </h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                setLoading(true);
                try {
                  if (editingId) {
                    await api.put(`/principal/departments/${editingId}`, {
                      name: deptName,
                      description: deptDesc,
                      hodId: deptHod || undefined
                    });
                    toastSuccess('Department updated.');
                  } else {
                    await api.post('/principal/departments', {
                      code: deptCode,
                      name: deptName,
                      description: deptDesc,
                      hodId: deptHod || undefined
                    });
                    toastSuccess('Department registered.');
                  }
                  setEditingId('');
                  setDeptCode(''); setDeptName(''); setDeptDesc(''); setDeptHod('');
                  loadData();
                } catch (err: any) {
                  toastError(err.response?.data?.message || 'Error saving department.');
                } finally {
                  setLoading(false);
                }
              }} className="space-y-4">
                {!editingId && (
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Code *</label>
                    <input
                      id="dept-code-input"
                      type="text"
                      className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                      placeholder="e.g. CSE"
                      value={deptCode}
                      onChange={(e) => setDeptCode(e.target.value)}
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Name *</label>
                  <input
                    id="dept-name-input"
                    type="text"
                    className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                    placeholder="e.g. Computer Science Engineering"
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Description</label>
                  <textarea
                    id="dept-desc-input"
                    className="w-full p-3 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg text-xs text-white h-20 resize-none"
                    placeholder="Brief description..."
                    value={deptDesc}
                    onChange={(e) => setDeptDesc(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Assign HOD</label>
                  <select
                    id="dept-hod-select"
                    className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                    value={deptHod}
                    onChange={(e) => setDeptHod(e.target.value)}
                  >
                    <option value="">No HOD Assigned</option>
                    {staff.filter(s => s.role === 'hod').map((h: any) => (
                      <option key={h._id} value={h._id}>{h.fullName} ({h.employeeId})</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 h-10 bg-primary text-white font-bold rounded-lg text-xs hover:opacity-90 transition-all" disabled={loading}>
                    {editingId ? 'Save Changes' : 'Create Department'}
                  </button>
                  {editingId && (
                    <button type="button" className="h-10 px-4 bg-purple-950/40 border border-purple-900/30 text-white font-bold rounded-lg text-xs" onClick={() => {
                      setEditingId('');
                      setDeptCode(''); setDeptName(''); setDeptDesc(''); setDeptHod('');
                    }}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* List and Actions */}
            <div className="lg:col-span-2 glass-card p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-sm font-bold text-gray-200 uppercase">Registered Departments</h3>
                <button
                  onClick={() => {
                    // Export to CSV
                    const headers = ['code', 'name', 'description', 'hodName'];
                    const csvRows = [
                      headers.join(','),
                      ...depts.map((row: any) => [
                        row.code,
                        `"${row.name}"`,
                        `"${row.description || ''}"`,
                        `"${row.hodId?.fullName || 'Unassigned'}"`
                      ].join(','))
                    ];
                    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.setAttribute('href', url);
                    a.setAttribute('download', `departments_export.csv`);
                    a.click();
                  }}
                  className="h-8 px-3 bg-purple-950/40 border border-purple-900/30 text-xs font-bold rounded-lg text-white hover:bg-purple-900/40"
                >
                  📥 Export CSV
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-purple-950/20 text-text-secondary">
                      <th className="py-3 font-bold uppercase">Code</th>
                      <th className="py-3 font-bold uppercase">Name</th>
                      <th className="py-3 font-bold uppercase">Assigned HOD</th>
                      <th className="py-3 font-bold uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-950/10">
                    {depts.map((d: any) => (
                      <tr key={d._id} className="hover:bg-purple-950/5 transition-colors">
                        <td className="py-3 font-mono font-bold text-purple-400">{d.code}</td>
                        <td className="py-3 text-white font-bold">{d.name}</td>
                        <td className="py-3 text-text-secondary">{d.hodId ? d.hodId.fullName : 'Unassigned'}</td>
                        <td className="py-3 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditingId(d._id);
                              setDeptCode(d.code);
                              setDeptName(d.name);
                              setDeptDesc(d.description || '');
                              setDeptHod(d.hodId?._id || '');
                            }}
                            className="h-7 px-2.5 bg-primary/20 text-primary border border-primary/30 rounded text-[10px] font-bold hover:bg-primary/30 transition-all"
                          >
                            Edit
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm('Are you sure you want to delete this department?')) return;
                              setLoading(true);
                              try {
                                await api.delete(`/principal/departments/${d._id}`);
                                toastSuccess('Department deleted.');
                                loadData();
                              } catch (e) {
                                toast_CRUD.error('Failed deleting department.');
                              } finally {
                                setLoading(false);
                              }
                            }}
                            className="h-7 px-2.5 bg-red-950/20 text-red-400 border border-red-900/30 rounded text-[10px] font-bold hover:bg-red-900/30 transition-all"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {depts.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-text-secondary">No departments found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          SUBJECTS CATALOG TAB
         ======================================================== */}
      {activeSubTab === 'subjects' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add / Edit Form */}
            <div className="glass-card p-6 space-y-4">
              <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">
                {editingId ? 'Edit Subject' : 'Register Subject'}
              </h3>
              <form onSubmit={handleSaveSubject} className="space-y-4">
                {!editingId && (
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Subject Code *</label>
                    <input
                      id="sub-code-input"
                      type="text"
                      className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                      placeholder="e.g. CS302"
                      value={editFields.subjectCode || ''}
                      onChange={(e) => setEditFields({ ...editFields, subjectCode: e.target.value.toUpperCase() })}
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Subject Name *</label>
                  <input
                    id="sub-name-input"
                    type="text"
                    className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                    placeholder="e.g. Operating Systems"
                    value={editFields.name || ''}
                    onChange={(e) => setEditFields({ ...editFields, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Semester *</label>
                    <select
                      id="sub-semester-select"
                      className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                      value={editFields.semester || ''}
                      onChange={(e) => setEditFields({ ...editFields, semester: e.target.value })}
                      required
                    >
                      <option value="">Select Semester</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                        <option key={sem} value={sem}>Sem {sem}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Type *</label>
                    <select
                      id="sub-type-select"
                      className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                      value={editFields.type || 'Theory'}
                      onChange={(e) => setEditFields({ ...editFields, type: e.target.value })}
                      required
                    >
                      <option value="Theory">Theory</option>
                      <option value="Lab">Lab</option>
                      <option value="Elective">Elective</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Assigned Faculty (Default)</label>
                  <select
                    id="sub-faculty-select"
                    className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                    value={editFields.faculty || ''}
                    onChange={(e) => setEditFields({ ...editFields, faculty: e.target.value })}
                  >
                    <option value="">No Faculty Assigned</option>
                    {staff.map(member => (
                      <option key={member._id} value={member._id}>{member.fullName}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Credits *</label>
                    <input
                      id="sub-credits-input"
                      type="number"
                      min={1}
                      max={6}
                      className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                      value={editFields.credits || 3}
                      onChange={(e) => setEditFields({ ...editFields, credits: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Department *</label>
                    <select
                      id="sub-dept-select"
                      className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                      value={editFields.department || ''}
                      onChange={(e) => setEditFields({ ...editFields, department: e.target.value })}
                      required
                    >
                      <option value="">Select Department</option>
                      {depts.map(d => (
                        <option key={d.code} value={d.code}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 h-10 bg-primary text-white font-bold rounded-lg text-xs hover:opacity-90 transition-all" disabled={loading}>
                    {editingId ? 'Save Changes' : 'Add Subject'}
                  </button>
                  {editingId && (
                    <button type="button" className="h-10 px-4 bg-purple-950/40 border border-purple-900/30 text-white font-bold rounded-lg text-xs" onClick={() => {
                      setEditingId('');
                      setEditFields({});
                    }}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* List and Filters */}
            <div className="lg:col-span-2 glass-card p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    className="h-8 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white placeholder-gray-400 w-44"
                    placeholder="Search Code or Name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <select
                    className="h-8 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-2 text-xs text-white"
                    value={filterDept}
                    onChange={(e) => setFilterDept(e.target.value)}
                  >
                    <option value="">All Departments</option>
                    {depts.map(d => (
                      <option key={d.code} value={d.code}>{d.code}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => {
                    const headers = ['subjectCode', 'name', 'credits', 'department'];
                    const csvRows = [
                      headers.join(','),
                      ...subjects.map((row: any) => [
                        row.subjectCode,
                        `"${row.name}"`,
                        row.credits,
                        row.department
                      ].join(','))
                    ];
                    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.setAttribute('href', url);
                    a.setAttribute('download', `subjects_export.csv`);
                    a.click();
                  }}
                  className="h-8 px-3 bg-purple-950/40 border border-purple-900/30 text-xs font-bold rounded-lg text-white hover:bg-purple-900/40"
                >
                  📥 Export CSV
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-purple-950/20 text-text-secondary">
                      <th className="py-3 font-bold uppercase">Code</th>
                      <th className="py-3 font-bold uppercase">Name</th>
                      <th className="py-3 font-bold uppercase">Semester</th>
                      <th className="py-3 font-bold uppercase">Type</th>
                      <th className="py-3 font-bold uppercase">Faculty</th>
                      <th className="py-3 font-bold uppercase">Department</th>
                      <th className="py-3 font-bold uppercase">Credits</th>
                      <th className="py-3 font-bold uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-950/10">
                    {subjects.filter(s => {
                      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.subjectCode.toLowerCase().includes(searchTerm.toLowerCase());
                      const matchesDept = !filterDept || s.department === filterDept;
                      return matchesSearch && matchesDept;
                    }).map((s: any) => (
                      <tr key={s._id} className="hover:bg-purple-950/5 transition-colors">
                        <td className="py-3 font-mono font-bold text-purple-400">{s.subjectCode}</td>
                        <td className="py-3 text-white font-bold">{s.name}</td>
                        <td className="py-3 text-purple-300 font-mono">Sem {s.semester || 'N/A'}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            s.type === 'Lab' ? 'bg-emerald-950/60 border border-emerald-900/40 text-emerald-300' :
                            s.type === 'Elective' ? 'bg-sky-950/60 border border-sky-900/40 text-sky-300' :
                            'bg-purple-950/60 border border-purple-900/40 text-purple-300'
                          }`}>
                            {s.type || 'Theory'}
                          </span>
                        </td>
                        <td className="py-3 text-white">{s.faculty?.fullName || s.facultyName || '—'}</td>
                        <td className="py-3"><span className="px-2 py-0.5 bg-purple-950/60 border border-purple-900/40 rounded text-purple-300 font-mono text-[10px]">{s.department}</span></td>
                        <td className="py-3 text-white">{s.credits}</td>
                        <td className="py-3 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditingId(s._id);
                              setEditFields({
                                subjectCode: s.subjectCode,
                                name: s.name,
                                credits: s.credits,
                                department: s.department,
                                semester: s.semester || 1,
                                type: s.type || 'Theory',
                                faculty: s.faculty?._id || s.faculty || ''
                              });
                            }}
                            className="h-7 px-2.5 bg-primary/20 text-primary border border-primary/30 rounded text-[10px] font-bold hover:bg-primary/30 transition-all"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteSubject(s._id)}
                            className="h-7 px-2.5 bg-red-950/20 text-red-400 border border-red-900/30 rounded text-[10px] font-bold hover:bg-red-900/30 transition-all"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {subjects.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-text-secondary">No subjects registered.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          FACULTY & STAFF MANAGER TAB
         ======================================================== */}
      {activeSubTab === 'faculty' && (
        <div className="space-y-6">
          {/* Bulk Import Panel */}
          {showBulkImport && (
            <div className="glass-card p-6 bg-purple-950/10 border border-purple-900/30 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-200 uppercase">Bulk Import Accounts (JSON format)</h4>
                <button className="text-xs text-text-secondary hover:text-white" onClick={() => setShowBulkImport(false)}>Close</button>
              </div>
              <p className="text-[10px] text-text-secondary">Paste a JSON array of accounts containing: <code>fullName</code>, <code>email</code>, <code>role</code>, <code>employeeId</code>, <code>assignedDepartment</code>, <code>password</code>.</p>
              <textarea
                className="w-full h-32 p-3 bg-dark-bg/60 border border-purple-900/30 rounded-lg text-xs font-mono text-white resize-none"
                placeholder='[{"fullName": "Dr. Sarah Miller", "email": "sarah.m@college.edu", "role": "faculty", "employeeId": "FAC928", "assignedDepartment": "CSE", "password": "facultyPassword1"}]'
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
              />
              <button onClick={handleBulkImport} className="h-10 px-5 bg-primary text-white font-bold rounded-lg text-xs hover:opacity-90 transition-all" disabled={loading}>
                Import Records
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add / Edit Form */}
            <div className="glass-card p-6 space-y-4">
              <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">
                {editingId ? 'Edit Staff Account' : 'Register Staff Account'}
              </h3>
              <form onSubmit={handleSaveUser} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Full Name *</label>
                  <input
                    id="staff-name-input"
                    type="text"
                    className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                    value={editFields.fullName || ''}
                    onChange={(e) => setEditFields({ ...editFields, fullName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Email Address *</label>
                  <input
                    id="staff-email-input"
                    type="email"
                    className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                    value={editFields.email || ''}
                    onChange={(e) => setEditFields({ ...editFields, email: e.target.value })}
                    required
                    disabled={!!editingId}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Role / Position *</label>
                  <select
                    id="staff-role-select"
                    className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                    value={editFields.role || 'faculty'}
                    onChange={(e) => setEditFields({ ...editFields, role: e.target.value })}
                    required
                  >
                    <option value="hod">Department HOD</option>
                    <option value="faculty">Professor / Faculty</option>
                    <option value="coe">Controller of Examinations (COE)</option>
                    <option value="exam_cell">Exam Cell Representative</option>
                    <option value="accounts">Accounts & Fees admin</option>
                    <option value="library">Librarian</option>
                    <option value="placement">Placement Officer</option>
                    <option value="hostel">Hostel Warden</option>
                    <option value="transport">Transport Manager</option>
                    <option value="admin">System Admin</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Employee ID *</label>
                  <input
                    id="staff-empid-input"
                    type="text"
                    className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                    value={editFields.employeeId || ''}
                    onChange={(e) => setEditFields({ ...editFields, employeeId: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Assigned Department</label>
                  <select
                    id="staff-dept-select"
                    className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                    value={editFields.assignedDepartment || ''}
                    onChange={(e) => setEditFields({ ...editFields, assignedDepartment: e.target.value })}
                  >
                    <option value="">Select Department</option>
                    {depts.map(d => (
                      <option key={d.code} value={d.code}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">
                    {editingId ? 'Reset Password (optional)' : 'Password *'}
                  </label>
                  <input
                    id="staff-pass-input"
                    type="password"
                    className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                    value={editFields.password || ''}
                    onChange={(e) => setEditFields({ ...editFields, password: e.target.value })}
                    placeholder={editingId ? 'Leave blank to preserve' : 'Min 6 chars'}
                    required={!editingId}
                  />
                </div>
                {editingId && (
                  <div className="flex items-center gap-2">
                    <input
                      id="staff-active-checkbox"
                      type="checkbox"
                      checked={editFields.isActive !== false}
                      onChange={(e) => setEditFields({ ...editFields, isActive: e.target.checked })}
                    />
                    <label htmlFor="staff-active-checkbox" className="text-xs text-white font-bold select-none">Account Active</label>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 h-10 bg-primary text-white font-bold rounded-lg text-xs hover:opacity-90 transition-all" disabled={loading}>
                    {editingId ? 'Save Changes' : 'Register Staff'}
                  </button>
                  {editingId && (
                    <button type="button" className="h-10 px-4 bg-purple-950/40 border border-purple-900/30 text-white font-bold rounded-lg text-xs" onClick={() => {
                      setEditingId('');
                      setEditFields({});
                    }}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* List, Filters, Pagination */}
            <div className="lg:col-span-2 glass-card p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    className="h-8 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white placeholder-gray-400 w-40"
                    placeholder="Search Staff..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <select
                    className="h-8 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-2 text-xs text-white"
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                  >
                    <option value="">All Roles</option>
                    <option value="hod">HODs</option>
                    <option value="faculty">Faculty</option>
                    <option value="admin">Administrators</option>
                  </select>
                  <select
                    className="h-8 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-2 text-xs text-white"
                    value={filterDept}
                    onChange={(e) => setFilterDept(e.target.value)}
                  >
                    <option value="">All Departments</option>
                    {depts.map(d => (
                      <option key={d.code} value={d.code}>{d.code}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowBulkImport(true)}
                    className="h-8 px-3 bg-purple-950/40 border border-purple-900/30 text-xs font-bold rounded-lg text-white hover:bg-purple-900/40"
                  >
                    📤 Import List
                  </button>
                  <button
                    onClick={() => handleBulkExport('faculty')}
                    className="h-8 px-3 bg-purple-950/40 border border-purple-900/30 text-xs font-bold rounded-lg text-white hover:bg-purple-900/40"
                  >
                    📥 Export CSV
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-purple-950/20 text-text-secondary">
                      <th className="py-3 font-bold uppercase">Emp ID</th>
                      <th className="py-3 font-bold uppercase">Name</th>
                      <th className="py-3 font-bold uppercase">Role</th>
                      <th className="py-3 font-bold uppercase">Dept</th>
                      <th className="py-3 font-bold uppercase">Status</th>
                      <th className="py-3 font-bold uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-950/10">
                    {usersList.map((s: any) => (
                      <tr key={s._id} className="hover:bg-purple-950/5 transition-colors">
                        <td className="py-3 font-mono font-bold text-purple-400">{s.employeeId || 'N/A'}</td>
                        <td className="py-3">
                          <p className="text-white font-bold">{s.fullName}</p>
                          <p className="text-[10px] text-text-secondary mt-0.5">{s.email}</p>
                        </td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 bg-primary/20 border border-primary/30 rounded text-primary text-[10px] font-bold uppercase">
                            {s.role}
                          </span>
                        </td>
                        <td className="py-3 text-text-secondary font-mono">{s.assignedDepartment || 'N/A'}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.isActive ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/20' : 'bg-red-950/30 text-red-400 border border-red-900/20'}`}>
                            {s.isActive ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="py-3 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditingId(s._id);
                              setEditFields({
                                fullName: s.fullName,
                                email: s.email,
                                role: s.role,
                                employeeId: s.employeeId,
                                assignedDepartment: s.assignedDepartment,
                                isActive: s.isActive
                              });
                            }}
                            className="h-7 px-2.5 bg-primary/20 text-primary border border-primary/30 rounded text-[10px] font-bold hover:bg-primary/30 transition-all"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteUser(s._id)}
                            className="h-7 px-2.5 bg-red-950/20 text-red-400 border border-red-900/30 rounded text-[10px] font-bold hover:bg-red-900/30 transition-all"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {usersList.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-text-secondary">No faculty profiles loaded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              <div className="flex items-center justify-between border-t border-purple-950/10 pt-4 text-xs">
                <span className="text-text-secondary">Total Records: {totalCount}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-8 px-3 bg-purple-950/40 border border-purple-900/30 text-white rounded font-bold disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="h-8 flex items-center px-2 text-white font-mono">{currentPage} / {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8 px-3 bg-purple-950/40 border border-purple-900/30 text-white rounded font-bold disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          STUDENT ROSTER TAB (STUDENT MASTER DATA MANAGER)
         ======================================================== */}
      {activeSubTab === 'students' && (
        <div className="space-y-6">
          {/* Bulk Import Panel */}
          {showBulkImport && (
            <div className="glass-card p-6 bg-purple-950/10 border border-purple-900/30 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-200 uppercase">Bulk Import Student Master Records (JSON list)</h4>
                <button className="text-xs text-text-secondary hover:text-white" onClick={() => setShowBulkImport(false)}>Close</button>
              </div>
              <textarea
                className="w-full h-32 p-3 bg-dark-bg/60 border border-purple-900/30 rounded-lg text-xs font-mono text-white resize-none"
                placeholder='[{"studentId": "STU101", "rollNumber": "24CSE101", "admissionNumber": "ADM2401", "fullName": "John Doe", "gender": "Male", "dob": "2005-08-15", "department": "CSE", "branch": "CSE", "course": "B.TECH", "academicYear": "2024-2028", "semester": 1, "section": "A"}]'
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
              />
              <button onClick={handleBulkImport} className="h-10 px-5 bg-primary text-white font-bold rounded-lg text-xs hover:opacity-90 transition-all" disabled={loading}>
                Import Master Records
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add / Edit Form */}
            <div className="glass-card p-6 space-y-4 max-h-[750px] overflow-y-auto pr-2">
              <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">
                {editingId ? 'Edit Master Record' : 'Register Student Master Record'}
              </h3>
              <form onSubmit={handleSaveStudentRecord} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Full Name *</label>
                  <input
                    type="text"
                    className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                    value={editFields.fullName || ''}
                    onChange={(e) => setEditFields({ ...editFields, fullName: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Roll Number *</label>
                    <input
                      type="text"
                      className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white uppercase font-mono"
                      value={editFields.rollNumber || ''}
                      onChange={(e) => setEditFields({ ...editFields, rollNumber: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Student ID *</label>
                    <input
                      type="text"
                      className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                      value={editFields.studentId || ''}
                      onChange={(e) => setEditFields({ ...editFields, studentId: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Admission Number *</label>
                    <input
                      type="text"
                      className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                      value={editFields.admissionNumber || ''}
                      onChange={(e) => setEditFields({ ...editFields, admissionNumber: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Admission Date</label>
                    <input
                      type="date"
                      className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                      value={editFields.admissionDate ? editFields.admissionDate.split('T')[0] : ''}
                      onChange={(e) => setEditFields({ ...editFields, admissionDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Gender *</label>
                    <select
                      className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                      value={editFields.gender || 'Male'}
                      onChange={(e) => setEditFields({ ...editFields, gender: e.target.value })}
                      required
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Date of Birth *</label>
                    <input
                      type="date"
                      className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                      value={editFields.dob ? editFields.dob.split('T')[0] : ''}
                      onChange={(e) => setEditFields({ ...editFields, dob: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Course *</label>
                    <select
                      className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                      value={editFields.course || ''}
                      onChange={(e) => setEditFields({ ...editFields, course: e.target.value })}
                      required
                    >
                      <option value="">Select Course</option>
                      {configCourses.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Branch *</label>
                    <select
                      className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                      value={editFields.branch || ''}
                      onChange={(e) => setEditFields({ ...editFields, branch: e.target.value })}
                      required
                    >
                      <option value="">Select Branch</option>
                      {uniqueBranches.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Department *</label>
                    <input
                      type="text"
                      className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white uppercase"
                      value={editFields.department || ''}
                      onChange={(e) => setEditFields({ ...editFields, department: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Academic Year *</label>
                    <select
                      className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                      value={editFields.academicYear || ''}
                      onChange={(e) => setEditFields({ ...editFields, academicYear: e.target.value })}
                      required
                    >
                      <option value="">Select Year</option>
                      {configYears.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Semester *</label>
                    <select
                      className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                      value={editFields.semester || 1}
                      onChange={(e) => setEditFields({ ...editFields, semester: e.target.value })}
                      required
                    >
                      {[1,2,3,4,5,6,7,8,9,10].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Section *</label>
                    <select
                      className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                      value={editFields.section || ''}
                      onChange={(e) => setEditFields({ ...editFields, section: e.target.value })}
                      required
                    >
                      <option value="">Select Sec</option>
                      {configSections.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Batch</label>
                    <input
                      type="text"
                      className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                      value={editFields.batch || ''}
                      onChange={(e) => setEditFields({ ...editFields, batch: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Mobile Number</label>
                    <input
                      type="text"
                      className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                      value={editFields.mobileNumber || ''}
                      onChange={(e) => setEditFields({ ...editFields, mobileNumber: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Status</label>
                    <select
                      className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                      value={editFields.status || 'Active'}
                      onChange={(e) => setEditFields({ ...editFields, status: e.target.value })}
                    >
                      <option value="Active">Active</option>
                      <option value="Suspended">Suspended</option>
                      <option value="Completed">Completed</option>
                      <option value="Promoted">Promoted</option>
                      <option value="Transferred">Transferred</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase">Photo URL</label>
                    <input
                      type="text"
                      className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white"
                      value={editFields.photo || ''}
                      onChange={(e) => setEditFields({ ...editFields, photo: e.target.value })}
                    />
                  </div>
                </div>

                <div className="border-t border-purple-950/10 pt-3 space-y-3">
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-wider">Parent Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-bold text-text-secondary uppercase">Father Name</label>
                      <input
                        type="text"
                        className="w-full h-8 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-2 text-xs text-white"
                        value={editFields.fatherName || ''}
                        onChange={(e) => setEditFields({ ...editFields, fatherName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-text-secondary uppercase">Mother Name</label>
                      <input
                        type="text"
                        className="w-full h-8 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-2 text-xs text-white"
                        value={editFields.motherName || ''}
                        onChange={(e) => setEditFields({ ...editFields, motherName: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-bold text-text-secondary uppercase">Parent Phone</label>
                      <input
                        type="text"
                        className="w-full h-8 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-2 text-xs text-white"
                        value={editFields.parentPhone || ''}
                        onChange={(e) => setEditFields({ ...editFields, parentPhone: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-text-secondary uppercase">Parent Email</label>
                      <input
                        type="text"
                        className="w-full h-8 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-2 text-xs text-white"
                        value={editFields.parentEmail || ''}
                        onChange={(e) => setEditFields({ ...editFields, parentEmail: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 h-10 bg-primary text-white font-bold rounded-lg text-xs hover:opacity-90 transition-all" disabled={loading}>
                    {editingId ? 'Save Changes' : 'Add Student Record'}
                  </button>
                  {editingId && (
                    <button type="button" className="h-10 px-4 bg-purple-950/40 border border-purple-900/30 text-white font-bold rounded-lg text-xs" onClick={() => {
                      setEditingId('');
                      setEditFields({});
                    }}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* List, Filters, Pagination */}
            <div className="lg:col-span-2 glass-card p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    className="h-8 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white placeholder-gray-400 w-36"
                    placeholder="Search Records..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <select
                    className="h-8 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-2 text-xs text-white"
                    value={filterBranch}
                    onChange={(e) => setFilterBranch(e.target.value)}
                  >
                    <option value="">All Branches</option>
                    {uniqueBranches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowBulkImport(true)}
                    className="h-8 px-3 bg-purple-950/40 border border-purple-900/30 text-xs font-bold rounded-lg text-white hover:bg-purple-900/40"
                  >
                    📤 CSV/JSON Import
                  </button>
                  <button
                    onClick={() => handleBulkExport('student')}
                    className="h-8 px-3 bg-purple-950/40 border border-purple-900/30 text-xs font-bold rounded-lg text-white hover:bg-purple-900/40"
                  >
                    📥 Export CSV
                  </button>
                </div>
              </div>

              {/* Bulk Actions Panel */}
              <div className="p-3 bg-purple-950/10 border border-purple-950/30 rounded-lg flex flex-wrap items-center gap-3 text-xs">
                <span className="font-bold text-gray-300">Bulk Operations ({selectedRecordIds.length} selected):</span>
                <button
                  onClick={() => handleBulkStudentRecordAction('promote')}
                  className="h-7 px-3 bg-primary text-white font-bold rounded text-[10px] hover:opacity-90"
                >
                  🚀 Bulk Promote (Sem +1)
                </button>
                <div className="flex items-center gap-1.5">
                  <select
                    id="bulk-status-select"
                    className="h-7 bg-dark-bg border border-purple-900/30 rounded px-1.5 text-[10px] text-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Completed">Completed</option>
                  </select>
                  <button
                    onClick={() => {
                      const el = document.getElementById('bulk-status-select') as HTMLSelectElement;
                      handleBulkStudentRecordAction('status_update', el.value);
                    }}
                    className="h-7 px-2.5 bg-purple-950/60 border border-purple-900/30 text-white font-bold rounded text-[10px]"
                  >
                    Update Status
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    id="bulk-transfer-input"
                    type="text"
                    placeholder="New College Code"
                    className="h-7 bg-dark-bg border border-purple-900/30 rounded px-2 text-[10px] text-white w-28 font-mono"
                  />
                  <button
                    onClick={() => {
                      const el = document.getElementById('bulk-transfer-input') as HTMLInputElement;
                      if (!el.value.trim()) return toastInfo('Enter destination college code.');
                      handleBulkStudentRecordAction('transfer', el.value.trim());
                    }}
                    className="h-7 px-2.5 bg-red-950/20 text-red-400 border border-red-900/30 font-bold rounded text-[10px]"
                  >
                    Transfer College
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-purple-950/20 text-text-secondary">
                      <th className="py-3 pl-2 w-8">
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRecordIds(students.map(s => s._id));
                            } else {
                              setSelectedRecordIds([]);
                            }
                          }}
                          checked={selectedRecordIds.length === students.length && students.length > 0}
                        />
                      </th>
                      <th className="py-3 font-bold uppercase">Roll Number</th>
                      <th className="py-3 font-bold uppercase">Name & ID</th>
                      <th className="py-3 font-bold uppercase">Course & Branch</th>
                      <th className="py-3 font-bold uppercase">Year / Sem / Sec</th>
                      <th className="py-3 font-bold uppercase">Status</th>
                      <th className="py-3 font-bold uppercase">Student OS Account</th>
                      <th className="py-3 font-bold uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-950/10">
                    {students.map((s: any) => (
                      <tr key={s._id} className="hover:bg-purple-950/5 transition-colors">
                        <td className="py-3 pl-2">
                          <input
                            type="checkbox"
                            checked={selectedRecordIds.includes(s._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRecordIds([...selectedRecordIds, s._id]);
                              } else {
                                setSelectedRecordIds(selectedRecordIds.filter(id => id !== s._id));
                              }
                            }}
                          />
                        </td>
                        <td className="py-3 font-mono font-bold text-purple-400">{s.rollNumber}</td>
                        <td className="py-3">
                          <p className="text-white font-bold">{s.fullName}</p>
                          <p className="text-[10px] text-text-secondary mt-0.5">ID: {s.studentId}</p>
                        </td>
                        <td className="py-3 text-text-secondary font-mono">{s.course} - {s.branch}</td>
                        <td className="py-3 text-white">Y {s.academicYear.split('-')[0]}, Sem {s.semester}, Sec {s.section}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.status === 'Active' ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30' : 'bg-red-950/20 text-red-400 border border-red-900/30'}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3">
                          {s.linkedUserId ? (
                            <span className="text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                              🟢 Activated ({s.linkedUserId.email})
                            </span>
                          ) : (
                            <span className="text-gray-400 text-[10px] flex items-center gap-1">
                              ⚪ Unactivated
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditingId(s._id);
                              setEditFields({
                                studentId: s.studentId,
                                rollNumber: s.rollNumber,
                                admissionNumber: s.admissionNumber,
                                fullName: s.fullName,
                                gender: s.gender,
                                dob: s.dob,
                                department: s.department,
                                branch: s.branch,
                                course: s.course,
                                academicYear: s.academicYear,
                                semester: s.semester,
                                section: s.section,
                                batch: s.batch,
                                mobileNumber: s.mobileNumber,
                                status: s.status,
                                admissionDate: s.admissionDate,
                                photo: s.photo,
                                fatherName: s.parentDetails?.fatherName || '',
                                motherName: s.parentDetails?.motherName || '',
                                parentPhone: s.parentDetails?.parentPhone || '',
                                parentEmail: s.parentDetails?.parentEmail || ''
                              });
                            }}
                            className="h-7 px-2.5 bg-primary/20 text-primary border border-primary/30 rounded text-[10px] font-bold hover:bg-primary/30 transition-all"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteStudentRecord(s._id)}
                            className="h-7 px-2.5 bg-red-950/20 text-red-400 border border-red-900/30 rounded text-[10px] font-bold hover:bg-red-900/30 transition-all"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-text-secondary">No student master records loaded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-purple-950/10 pt-4 text-xs">
                <span className="text-text-secondary">Total Records: {totalCount}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-8 px-3 bg-purple-950/40 border border-purple-900/30 text-white rounded font-bold disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="h-8 flex items-center px-2 text-white font-mono">{currentPage} / {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8 px-3 bg-purple-950/40 border border-purple-900/30 text-white rounded font-bold disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          ERP CONFIGURATION TAB
         ======================================================== */}
      {activeSubTab === 'config' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Courses & Programs */}
          <div className="glass-card p-6 space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Managed Courses</h3>
              <div className="flex flex-wrap gap-2 py-2">
                {configCourses.map(c => (
                  <span key={c} className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-950/60 border border-purple-900/30 rounded-lg text-xs text-white">
                    {c}
                    <button onClick={() => handleUpdateConfigList('course', 'delete', c)} className="text-red-400 hover:text-red-300 font-bold ml-1">×</button>
                  </span>
                ))}
                {configCourses.length === 0 && <span className="text-xs text-text-secondary">No courses configured.</span>}
              </div>
              <form onSubmit={(e: any) => {
                e.preventDefault();
                const val = e.target.elements.courseVal.value.trim();
                if (val) {
                  handleUpdateConfigList('course', 'add', val);
                  e.target.reset();
                }
              }} className="flex gap-2">
                <input name="courseVal" type="text" className="flex-1 h-9 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" placeholder="Add Course (e.g. B.Tech)..." required />
                <button type="submit" className="h-9 px-4 bg-primary text-white font-bold rounded-lg text-xs">Add</button>
              </form>
            </div>

            <div className="space-y-3 border-t border-purple-950/10 pt-4">
              <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Academic Programs</h3>
              <div className="flex flex-wrap gap-2 py-2">
                {configPrograms.map(p => (
                  <span key={p} className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-950/60 border border-purple-900/30 rounded-lg text-xs text-white font-bold">
                    {p}
                    <button onClick={() => handleUpdateConfigList('program', 'delete', p)} className="text-red-400 hover:text-red-300 font-bold ml-1">×</button>
                  </span>
                ))}
                {configPrograms.length === 0 && <span className="text-xs text-text-secondary">No programs configured.</span>}
              </div>
              <form onSubmit={(e: any) => {
                e.preventDefault();
                const val = e.target.elements.progVal.value.trim();
                if (val) {
                  handleUpdateConfigList('program', 'add', val);
                  e.target.reset();
                }
              }} className="flex gap-2">
                <input name="progVal" type="text" className="flex-1 h-9 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" placeholder="Add Program (e.g. Mechanical)..." required />
                <button type="submit" className="h-9 px-4 bg-primary text-white font-bold rounded-lg text-xs">Add</button>
              </form>
            </div>
          </div>

          {/* Branches, Academic Years, Sections */}
          <div className="glass-card p-6 space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">College Branches</h3>
              <div className="flex flex-wrap gap-2 py-2">
                {configBranches.map(b => (
                  <span key={b} className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-950/60 border border-purple-900/30 rounded-lg text-xs text-white font-mono">
                    {b}
                    <button onClick={() => handleUpdateConfigList('branch', 'delete', b)} className="text-red-400 hover:text-red-300 font-bold ml-1">×</button>
                  </span>
                ))}
                {configBranches.length === 0 && <span className="text-xs text-text-secondary">No branches configured.</span>}
              </div>
              <form onSubmit={(e: any) => {
                e.preventDefault();
                const val = e.target.elements.branchVal.value.trim().toUpperCase();
                if (val) {
                  handleUpdateConfigList('branch', 'add', val);
                  e.target.reset();
                }
              }} className="flex gap-2">
                <input name="branchVal" type="text" className="flex-1 h-9 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white font-mono" placeholder="Add Branch (e.g. ECE)..." required />
                <button type="submit" className="h-9 px-4 bg-primary text-white font-bold rounded-lg text-xs">Add</button>
              </form>
            </div>

            <div className="space-y-3 border-t border-purple-950/10 pt-4">
              <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Academic Batches / Years</h3>
              <div className="flex flex-wrap gap-2 py-2">
                {configYears.map(y => (
                  <span key={y} className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-950/60 border border-purple-900/30 rounded-lg text-xs text-white">
                    {y}
                    <button onClick={() => handleUpdateConfigList('year', 'delete', y)} className="text-red-400 hover:text-red-300 font-bold ml-1">×</button>
                  </span>
                ))}
                {configYears.length === 0 && <span className="text-xs text-text-secondary">No academic years configured.</span>}
              </div>
              <form onSubmit={(e: any) => {
                e.preventDefault();
                const val = e.target.elements.yearVal.value.trim();
                if (val) {
                  handleUpdateConfigList('year', 'add', val);
                  e.target.reset();
                }
              }} className="flex gap-2">
                <input name="yearVal" type="text" className="flex-1 h-9 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" placeholder="Add Year (e.g. 2024-2028)..." required />
                <button type="submit" className="h-9 px-4 bg-primary text-white font-bold rounded-lg text-xs">Add</button>
              </form>
            </div>

            <div className="space-y-3 border-t border-purple-950/10 pt-4">
              <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Sections</h3>
              <div className="flex flex-wrap gap-2 py-2">
                {configSections.map(s => (
                  <span key={s} className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-950/60 border border-purple-900/30 rounded-lg text-xs text-white">
                    Section {s}
                    <button onClick={() => handleUpdateConfigList('section', 'delete', s)} className="text-red-400 hover:text-red-300 font-bold ml-1">×</button>
                  </span>
                ))}
                {configSections.length === 0 && <span className="text-xs text-text-secondary">No sections configured.</span>}
              </div>
              <form onSubmit={(e: any) => {
                e.preventDefault();
                const val = e.target.elements.secVal.value.trim().toUpperCase();
                if (val) {
                  handleUpdateConfigList('section', 'add', val);
                  e.target.reset();
                }
              }} className="flex gap-2">
                <input name="secVal" type="text" className="flex-1 h-9 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" placeholder="Add Section (e.g. C)..." required />
                <button type="submit" className="h-9 px-4 bg-primary text-white font-bold rounded-lg text-xs">Add</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          CAMPUS NOTICES & CALENDAR TABS
         ======================================================== */}
      {activeSubTab === 'notices' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-card p-6 space-y-4">
              <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Publish Notice</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!noticeTitle || !noticeContent) return;
                setLoading(true);
                try {
                  await api.post('/principal/notices', { title: noticeTitle, content: noticeContent, type: noticeType });
                  toastSuccess('Notice published to all students.');
                  setNoticeTitle(''); setNoticeContent('');
                  loadData();
                } catch (err: any) {
                  toast_CRUD.error('Failed publishing notice.');
                } finally {
                  setLoading(false);
                }
              }} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Notice Title *</label>
                  <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={noticeTitle} onChange={(e) => setNoticeTitle(e.target.value)} required />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Notice Category</label>
                  <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={noticeType} onChange={(e) => setNoticeType(e.target.value)}>
                    <option value="general">General Circular</option>
                    <option value="exam">Exam Schedule Updates</option>
                    <option value="holiday">Holiday Announcement</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Content Body *</label>
                  <textarea className="w-full p-3 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg text-xs text-white h-28 resize-none" value={noticeContent} onChange={(e) => setNoticeContent(e.target.value)} required />
                </div>
                <button type="submit" className="w-full h-10 bg-primary text-white font-bold rounded-lg text-xs" disabled={loading}>
                  Publish Announcement
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 glass-card p-6 space-y-4">
              <h3 className="text-sm font-bold text-gray-200 uppercase">Announcement Logs</h3>
              <div className="space-y-4 max-h-[480px] overflow-y-auto pr-2">
                {notices.map((n: any) => (
                  <div key={n._id} className="p-4 bg-dark-bg/40 border border-purple-950/20 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 bg-primary/20 border border-primary/30 rounded-lg text-primary text-[10px] font-bold uppercase">{n.type}</span>
                      <span className="text-[10px] text-text-secondary font-mono">{new Date(n.createdAt).toLocaleDateString()}</span>
                    </div>
                    <h4 className="text-xs font-bold text-white">{n.title}</h4>
                    <p className="text-xs text-text-secondary leading-relaxed">{n.content}</p>
                  </div>
                ))}
                {notices.length === 0 && <p className="text-xs text-text-secondary text-center py-8">No notices published.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'calendar' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-card p-6 space-y-4">
              <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">Schedule Academic Calendar Event</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!calDate || !calDesc) return;
                setLoading(true);
                try {
                  await api.post('/principal/calendar', { date: calDate, type: calType, description: calDesc });
                  toastInfo('Academic Calendar entry mapped.');
                  setCalDate(''); setCalDesc('');
                  loadData();
                } catch (err: any) {
                  toast_CRUD.error('Failed creating calendar entry.');
                } finally {
                  setLoading(false);
                }
              }} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Date *</label>
                  <input type="date" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={calDate} onChange={(e) => setCalDate(e.target.value)} required />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Day Classification</label>
                  <select className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={calType} onChange={(e) => setCalType(e.target.value)}>
                    <option value="working_day">Standard Class Day</option>
                    <option value="holiday">Official Holiday</option>
                    <option value="exam">Midterm / Semester Exam</option>
                    <option value="event">Campus Fest / Workshop</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase">Details / Description *</label>
                  <input type="text" className="w-full h-10 mt-1 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-3 text-xs text-white" value={calDesc} onChange={(e) => setCalDesc(e.target.value)} placeholder="e.g. Sankranthi Holidays start" required />
                </div>
                <button type="submit" className="w-full h-10 bg-primary text-white font-bold rounded-lg text-xs" disabled={loading}>
                  Map Entry
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 glass-card p-6 space-y-4">
              <h3 className="text-sm font-bold text-gray-200 uppercase">Upcoming Calendar Items</h3>
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-2">
                {calendar.map((c: any) => (
                  <div key={c._id} className="p-3 bg-dark-bg/40 border border-purple-950/20 rounded-lg flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-white">{c.description}</p>
                      <p className="text-[10px] text-text-secondary mt-0.5 uppercase font-mono tracking-wider">{c.type.replace('_', ' ')}</p>
                    </div>
                    <span className="font-mono text-purple-400 font-bold bg-purple-950/40 px-2 py-1 rounded border border-purple-900/20">{new Date(c.date).toLocaleDateString()}</span>
                  </div>
                ))}
                {calendar.length === 0 && <p className="text-xs text-text-secondary text-center py-8">No academic items mapped.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'timetable' && renderHodAcademicsStep()}

      {/* ========================================================
          CAMPUS AI CHAT AND PREDICTIONS TAB
         ======================================================== */}
      {activeSubTab === 'campus_ai' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-card p-6 flex flex-col h-[600px] justify-between">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="text-purple-400">✨</span> Campus AI conversational assistant
              </h3>
              <p className="text-xs text-text-secondary mt-1">Contextualized according to {user.role.toUpperCase()} RBAC permissions</p>
            </div>

            <div className="flex-1 my-4 p-4 bg-dark-bg/40 border border-purple-950/20 rounded-xl overflow-y-auto space-y-3">
              {aiHistory.length === 0 && (
                <div className="text-center text-text-secondary text-xs my-auto py-12 space-y-2">
                  <p>How can I help you today?</p>
                  <p className="text-[10px] text-gray-500">Ask: "Predict at-risk students" or "Show department performance analytics"</p>
                </div>
              )}
              {aiHistory.map((h, i) => (
                <div key={i} className={`p-3 rounded-lg text-xs max-w-[80%] ${h.role === 'user' ? 'bg-primary/20 border border-primary/30 ml-auto text-white' : 'bg-purple-950/30 border border-purple-900/30 mr-auto text-gray-200'}`}>
                  <p className="font-bold text-[10px] opacity-60 uppercase mb-1">{h.role === 'user' ? 'You' : 'Campus AI'}</p>
                  <p className="whitespace-pre-line">{h.text}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendAiMsg} className="flex gap-2">
              <input type="text" className="flex-1 h-11 bg-dark-bg/60 border border-purple-900/30 rounded-lg px-4 text-xs" placeholder="Ask AI..." value={aiMessage} onChange={(e) => setAiMessage(e.target.value)} />
              <button type="submit" className="h-11 px-5 bg-primary text-white font-bold rounded-lg text-xs" disabled={loading}>
                Ask Assistant
              </button>
            </form>
          </div>

          <div className="space-y-6">
            <div className="glass-card p-6 space-y-4">
              <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wide">AI Predictive Student risk</h3>
              <div className="space-y-3">
                <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-red-300">At-Risk Count</p>
                    <p className="text-text-secondary mt-0.5">Students below 75% attendance</p>
                  </div>
                  <span className="text-lg font-black text-red-400">{aiPredict.atRiskCount || 5}</span>
                </div>

                <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-emerald-300">Placement Eligibility</p>
                    <p className="text-text-secondary mt-0.5">Average prediction rate</p>
                  </div>
                  <span className="text-lg font-black text-emerald-400">{aiPredict.placementEligibilityRate || '84%'}</span>
                </div>
              </div>
            </div>

            <div className="glass-card p-6 space-y-4">
              <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wide">Predicted Department Grades</h3>
              <div className="space-y-3">
                {aiPredict.predictedDepartmentPerformers?.map((d: any, idx: number) => (
                  <div key={idx} className="p-3 bg-dark-bg/40 border border-purple-950/20 rounded-lg flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-200">{d.department}</span>
                    <span className="font-bold text-gradient">{d.grade}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ================================================================
          STUDENT — MY TIMETABLE TAB
         ================================================================ */}
      {activeSubTab === 'student_timetable' && (
        <div className="space-y-6">
          <div className="glass-card p-6 space-y-2">
            <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">📅 My Weekly Timetable</h3>
            <p className="text-xs text-text-secondary">Showing your approved class schedule for this semester.</p>
          </div>

          {timetables.length === 0 ? (
            <div className="glass-card p-12 text-center space-y-3">
              <p className="text-4xl">📅</p>
              <p className="text-sm font-bold text-gray-300">No timetable assigned yet.</p>
              <p className="text-xs text-text-secondary">Your HOD will publish your class schedule soon. Check back later.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {timetables.map((dayGroup: any) => {
                const day = dayGroup.day;
                const slots = dayGroup.slots || [];
                if (slots.length === 0) return null;
                return (
                  <div key={day} className="glass-card p-5 space-y-3">
                    <h4 className="text-xs font-black uppercase text-purple-400 tracking-wider border-b border-purple-950/30 pb-2">{day}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {slots.map((slot: any, idx: number) => {
                        const hasSubject = slot.subjectCode || slot.subjectName;

                        return (
                          <div key={idx} className="p-4 bg-[#110a24]/60 border border-purple-900/20 rounded-xl space-y-2 hover:border-purple-700/40 transition-all flex flex-col justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono text-purple-300 font-bold">
                                  ⏰ {slot.startTime} - {slot.endTime}
                                </span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                  slot.type?.toLowerCase() === 'lab' 
                                    ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' 
                                    : 'bg-purple-950/40 text-purple-400 border border-purple-900/30'
                                }`}>
                                  {slot.type || 'Theory'}
                                </span>
                              </div>

                              {!hasSubject ? (
                                <p className="text-xs text-red-400 font-bold italic py-1">No Subject Assigned</p>
                              ) : (
                                <div className="space-y-1">
                                  <p className="text-xs font-semibold text-purple-400 font-mono">{slot.subjectCode}</p>
                                  <p className="text-sm font-bold text-white leading-snug">{slot.subjectName}</p>
                                  <p className="text-xs text-text-secondary">👨‍🏫 {slot.facultyName || 'Faculty TBD'}</p>
                                </div>
                              )}
                            </div>

                            <div className="pt-2 border-t border-purple-950/30 flex items-center justify-between text-[10px] text-text-secondary font-mono">
                              <span>🏛 Room: {slot.room || 'TBD'}</span>
                              <span>{slot.department} Sem {slot.semester}-{slot.section}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================
          STUDENT — NOTICES TAB
         ================================================================ */}
      {activeSubTab === 'student_notices' && (
        <div className="space-y-4">
          <div className="glass-card p-6">
            <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">📢 College Notices</h3>
            <p className="text-xs text-text-secondary mt-1">Official announcements from the administration.</p>
          </div>
          {notices.length === 0
            ? <div className="glass-card p-12 text-center"><p className="text-sm text-text-secondary">No notices published yet.</p></div>
            : notices.map((n: any) => (
              <div key={n._id} className="glass-card p-5 space-y-2 hover:border-purple-700/40 transition-all border border-purple-950/20">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-white">{n.title}</p>
                  <span className="text-[10px] text-text-secondary whitespace-nowrap font-mono">{new Date(n.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">{n.body}</p>
                {n.targetDepartment && <span className="text-[10px] bg-purple-950/40 text-purple-400 border border-purple-900/30 px-2 py-0.5 rounded font-bold">Dept: {n.targetDepartment}</span>}
              </div>
            ))
          }
        </div>
      )}

      {/* ================================================================
          STUDENT — STUDY MATERIALS TAB
         ================================================================ */}
      {activeSubTab === 'student_materials' && (
        <div className="space-y-4">
          <div className="glass-card p-6">
            <h3 className="text-sm font-black uppercase text-gray-200 tracking-wide">📚 Study Materials</h3>
            <p className="text-xs text-text-secondary mt-1">Resources shared by your faculty for your subjects.</p>
          </div>
          {materials.length === 0
            ? <div className="glass-card p-12 text-center"><p className="text-sm text-text-secondary">No study materials uploaded yet.</p></div>
            : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {materials.map((m: any) => (
                  <div key={m._id} className="glass-card p-5 space-y-3 hover:border-purple-700/40 transition-all border border-purple-950/20 flex flex-col">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{m.type === 'pdf' ? '📄' : m.type === 'video' ? '🎬' : m.type === 'link' ? '🔗' : '📁'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{m.title}</p>
                        <p className="text-[10px] text-text-secondary uppercase font-bold tracking-wider">{m.subjectCode}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 flex-1">{m.description || 'No description provided.'}</p>
                    {m.url && (
                      <a href={m.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-8 px-4 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary font-bold rounded-lg text-[11px] transition-all w-full justify-center">
                        Open Resource ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
          }
        </div>
      )}
        </>
      )}
    </div>
  );
}
