import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

const FIREBASE_DB_URL = 'https://stock-dashboard-5c25c-default-rtdb.asia-southeast1.firebasedatabase.app';

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Standard National Holidays common across Indian years
const STANDARD_RECURRING_HOLIDAYS = {
  "01-26": "Republic Day",
  "05-01": "Maharashtra Day",
  "08-15": "Independence Day",
  "10-02": "Mahatma Gandhi Jayanti",
  "12-25": "Christmas"
};

// Sample NSE Circular text for the "Load Sample" helper button
const SAMPLE_NSE_IMPORT_TEXT = `26-Jan-2026 : Republic Day
03-Mar-2026 : Holi
26-Mar-2026 : Shri Ram Navami
31-Mar-2026 : Shri Mahavir Jayanti
03-Apr-2026 : Good Friday
14-Apr-2026 : Dr. Baba Saheb Ambedkar Jayanti
01-May-2026 : Maharashtra Day
28-May-2026 : Bakri Id
26-Jun-2026 : Muharram
14-Sep-2026 : Ganesh Chaturthi
02-Oct-2026 : Mahatma Gandhi Jayanti
20-Oct-2026 : Dussehra
08-Nov-2026 : Diwali Laxmi Pujan (Muhurat Trading)
10-Nov-2026 : Diwali-Balipratipada
24-Nov-2026 : Prakash Gurpurb Sri Guru Nanak Dev
25-Dec-2026 : Christmas`;

// Helper: normalize varied date formats to YYYY-MM-DD
const normalizeDateString = (rawStr, defaultYear) => {
  if (!rawStr) return null;
  const s = String(rawStr).trim();

  // 1. YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // 2. YYYY/MM/DD or YYYY.MM.DD
  const ymdMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${String(ymdMatch[2]).padStart(2, '0')}-${String(ymdMatch[3]).padStart(2, '0')}`;
  }

  // 3. DD-MM-YYYY or DD/MM/YYYY
  const dmyNumMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyNumMatch) {
    return `${dmyNumMatch[3]}-${String(dmyNumMatch[2]).padStart(2, '0')}-${String(dmyNumMatch[1]).padStart(2, '0')}`;
  }

  // 4. DD-MMM-YYYY or DD MMM YYYY (e.g. 26-Jan-2026, 03-March-2026, 26 Jan 2026, 26-Jan)
  const dmyTextMatch = s.match(/^(\d{1,2})[-\s/.]([A-Za-z]{3,9})(?:[-\s/.](\d{2,4}))?$/);
  if (dmyTextMatch) {
    const day = String(dmyTextMatch[1]).padStart(2, '0');
    const monthKey = dmyTextMatch[2].toLowerCase().slice(0, 3);
    const mIdx = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(monthKey);
    if (mIdx !== -1) {
      const month = String(mIdx + 1).padStart(2, '0');
      let yr = dmyTextMatch[3] ? parseInt(dmyTextMatch[3], 10) : defaultYear;
      if (yr < 100) yr += 2000;
      return `${yr}-${month}-${day}`;
    }
  }

  return null;
};

// Smart Parser: Handles JSON (raw dict or array or NSE API format) or plain text circular tables
const parseHolidayText = (rawText, defaultYear) => {
  if (!rawText || !rawText.trim()) return [];
  const trimmed = rawText.trim();
  const results = [];
  const seenDates = new Set();

  // Try JSON first
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        parsed.forEach(item => {
          if (!item) return;
          const dStr = item.date || item.tradingDate || item.Date;
          const name = item.name || item.holiday || item.description || item.Holiday || 'NSE Holiday';
          const normDate = normalizeDateString(dStr, defaultYear);
          if (normDate && !seenDates.has(normDate)) {
            seenDates.add(normDate);
            results.push({ date: normDate, name: String(name).trim() });
          }
        });
        if (results.length > 0) return results.sort((a, b) => a.date.localeCompare(b.date));
      } else if (typeof parsed === 'object') {
        if (Array.isArray(parsed.CM)) {
          parsed.CM.forEach(item => {
            const dStr = item.tradingDate || item.date;
            const name = item.description || item.holiday || 'NSE Holiday';
            const normDate = normalizeDateString(dStr, defaultYear);
            if (normDate && !seenDates.has(normDate)) {
              seenDates.add(normDate);
              results.push({ date: normDate, name: String(name).trim() });
            }
          });
          if (results.length > 0) return results.sort((a, b) => a.date.localeCompare(b.date));
        } else {
          Object.entries(parsed).forEach(([k, v]) => {
            const normDate = normalizeDateString(k, defaultYear);
            const name = typeof v === 'string' ? v : (v?.name || v?.description || 'NSE Holiday');
            if (normDate && !seenDates.has(normDate)) {
              seenDates.add(normDate);
              results.push({ date: normDate, name: String(name).trim() });
            }
          });
          if (results.length > 0) return results.sort((a, b) => a.date.localeCompare(b.date));
        }
      }
    } catch (e) {
      // Proceed to line-by-line fallback
    }
  }

  // Line-by-line parsing
  const lines = trimmed.split(/\r?\n/);
  lines.forEach(line => {
    const l = line.trim();
    if (!l) return;

    // Regex looks for date pattern anywhere in line
    const dateRegex = /(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})|(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})|(\d{1,2}[-\s/][A-Za-z]{3,9}[-\s/]\d{2,4})|(\d{1,2}[-\s/][A-Za-z]{3,9})/;
    const match = l.match(dateRegex);
    if (match) {
      const rawDateMatch = match[0];
      const normDate = normalizeDateString(rawDateMatch, defaultYear);
      if (normDate) {
        let name = l.replace(rawDateMatch, '')
          .replace(/^[:\-\t,;|]+/, '')
          .replace(/[:\-\t,;|]+$/, '')
          .trim();
        if (!name) name = 'NSE Holiday';

        if (!seenDates.has(normDate)) {
          seenDates.add(normDate);
          results.push({ date: normDate, name });
        }
      }
    }
  });

  return results.sort((a, b) => a.date.localeCompare(b.date));
};

export default function CalendarModal({ isOpen, onClose }) {
  const [calendarData, setCalendarData] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonthIndex, setSelectedMonthIndex] = useState("ALL"); // "ALL" or 0..11
  const [activeDateModal, setActiveDateModal] = useState(null); // Date string 'YYYY-MM-DD' being edited
  const [editForm, setEditForm] = useState({
    type: 'TRADING', // 'TRADING', 'HOLIDAY', 'SPECIAL_TRADING', 'OVERRIDE_HOLIDAY'
    name: '',
    start: '09:15',
    end: '15:30'
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [notification, setNotification] = useState(null);

  // Sub-modal states
  const [isNewYearModalOpen, setIsNewYearModalOpen] = useState(false);
  const [newYearInput, setNewYearInput] = useState(new Date().getFullYear() + 1);

  // Import Modal States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importYear, setImportYear] = useState(new Date().getFullYear());
  const [importMode, setImportMode] = useState('MERGE'); // 'MERGE' or 'REPLACE'

  // Cautionary Save Confirmation Modal State
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);

  // Update importYear when selectedYear changes
  useEffect(() => {
    setImportYear(selectedYear);
  }, [selectedYear]);

  // Show auto-dismiss notification toast
  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // 1. Fetch Calendar Configuration from Firebase
  const fetchCalendar = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${FIREBASE_DB_URL}/config/nse_calendar.json?_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          setCalendarData({
            regular_market: data.regular_market || { start: "09:15", end: "15:30" },
            pre_open: data.pre_open || { start: "09:00", end: "09:08" },
            closing_auction: data.closing_auction || {},
            closing_session: data.closing_session || {},
            holidays: data.holidays || {},
            weekend_holidays: data.weekend_holidays || {},
            special_trading_days: data.special_trading_days || {},
            manual_overrides: data.manual_overrides || {},
            weekend: data.weekend || { saturday: "HOLIDAY", sunday: "HOLIDAY" }
          });
          setHasUnsavedChanges(false);
        }
      } else {
        showToast("Failed to load calendar from Firebase", "error");
      }
    } catch (err) {
      console.error("Calendar fetch error:", err);
      showToast("Error connecting to Firebase", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCalendar();
    }
  }, [isOpen]);

  // 2. Open Cautionary Confirmation Modal before saving
  const handleInitiateSave = () => {
    if (!calendarData) return;
    setShowSaveConfirmModal(true);
  };

  // 2b. Execute final write to Firebase after user confirmation
  const executeConfirmSave = async () => {
    if (!calendarData) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${FIREBASE_DB_URL}/config/nse_calendar.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(calendarData)
      });

      if (res.ok) {
        setHasUnsavedChanges(false);
        setShowSaveConfirmModal(false);
        showToast("NSE Calendar successfully saved to Firebase!");
      } else {
        showToast("Failed to save to Firebase", "error");
      }
    } catch (err) {
      console.error("Calendar save error:", err);
      showToast("Network error saving calendar", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // 3. Helper: Format Date string YYYY-MM-DD
  const formatDateKey = (year, monthIdx, dayNum) => {
    const mm = String(monthIdx + 1).padStart(2, '0');
    const dd = String(dayNum).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  // 4. Resolve status of a single day
  const getDayInfo = (dateStr) => {
    if (!calendarData) {
      return { status: 'TRADING', label: 'Trading Day', color: '#10b981', badge: null };
    }

    const { holidays = {}, special_trading_days = {}, manual_overrides = {}, weekend_holidays = {} } = calendarData;
    const d = new Date(`${dateStr}T12:00:00Z`);
    const dayOfWeek = d.getUTCDay(); // 0 = Sun, 6 = Sat
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

    // 1. Manual Overrides (Highest Priority)
    if (manual_overrides[dateStr]) {
      const ov = manual_overrides[dateStr];
      const st = String(ov.status || '').toUpperCase();
      if (st === 'HOLIDAY' || st === 'CLOSED') {
        return {
          status: 'OVERRIDE_HOLIDAY',
          label: ov.name || 'Manual Holiday Override',
          color: '#eab308', // Amber
          badge: 'OVERRIDE',
          data: ov
        };
      }
      if (st === 'SPECIAL_TRADING') {
        return {
          status: 'SPECIAL_TRADING',
          label: ov.name || 'Special Trading Override',
          color: '#a855f7', // Purple
          badge: `${ov.start || '18:00'}-${ov.end || '19:00'}`,
          data: ov
        };
      }
      if (st === 'TRADING') {
        return {
          status: 'TRADING',
          label: 'Trading Day (Override)',
          color: '#10b981',
          badge: 'OPEN',
          data: ov
        };
      }
    }

    // 2. Special Trading Session (e.g. Diwali Muhurat)
    if (special_trading_days[dateStr]) {
      const sp = special_trading_days[dateStr];
      return {
        status: 'SPECIAL_TRADING',
        label: sp.name || 'Special / Muhurat Trading',
        color: '#8b5cf6', // Violet
        badge: `${sp.start || '18:00'}-${sp.end || '19:00'}`,
        data: sp
      };
    }

    // 3. Official Scheduled Holidays
    if (holidays[dateStr]) {
      return {
        status: 'HOLIDAY',
        label: holidays[dateStr],
        color: '#ef4444', // Red
        badge: 'HOLIDAY',
        data: { name: holidays[dateStr] }
      };
    }

    // 4. Weekend Holidays (Special festival falling on weekend)
    if (weekend_holidays[dateStr]) {
      return {
        status: 'WEEKEND_HOLIDAY',
        label: `${weekend_holidays[dateStr]} (Weekend)`,
        color: '#f87171',
        badge: 'HOLIDAY',
        data: { name: weekend_holidays[dateStr] }
      };
    }

    // 5. Standard Weekend
    if (isWeekend) {
      return {
        status: 'WEEKEND',
        label: dayOfWeek === 6 ? 'Saturday (Weekend)' : 'Sunday (Weekend)',
        color: '#475569', // Slate
        badge: null
      };
    }

    // 6. Normal Regular Trading Day
    return {
      status: 'TRADING',
      label: 'Normal Trading Session (09:15 - 15:30 IST)',
      color: '#10b981', // Green
      badge: null
    };
  };

  // 5. Day Click -> Open Date Editor
  const handleDateClick = (dateStr) => {
    const info = getDayInfo(dateStr);
    setActiveDateModal(dateStr);

    if (info.status === 'SPECIAL_TRADING') {
      setEditForm({
        type: 'SPECIAL_TRADING',
        name: info.data?.name || 'Diwali Muhurat Trading',
        start: info.data?.start || '18:00',
        end: info.data?.end || '19:00'
      });
    } else if (info.status === 'HOLIDAY' || info.status === 'WEEKEND_HOLIDAY') {
      setEditForm({
        type: 'HOLIDAY',
        name: info.data?.name || info.label || '',
        start: '09:15',
        end: '15:30'
      });
    } else if (info.status === 'OVERRIDE_HOLIDAY') {
      setEditForm({
        type: 'OVERRIDE_HOLIDAY',
        name: info.data?.name || 'Emergency Holiday',
        start: '09:15',
        end: '15:30'
      });
    } else {
      setEditForm({
        type: 'TRADING',
        name: '',
        start: '09:15',
        end: '15:30'
      });
    }
  };

  // 6. Apply Edit to Calendar State
  const handleApplyDateEdit = () => {
    if (!activeDateModal || !calendarData) return;

    const dateStr = activeDateModal;
    const nextHolidays = { ...calendarData.holidays };
    const nextSpecial = { ...calendarData.special_trading_days };
    const nextOverrides = { ...calendarData.manual_overrides };
    const nextWeekendHolidays = { ...calendarData.weekend_holidays };

    delete nextHolidays[dateStr];
    delete nextSpecial[dateStr];
    delete nextOverrides[dateStr];
    delete nextWeekendHolidays[dateStr];

    const d = new Date(`${dateStr}T12:00:00Z`);
    const isWeekend = (d.getUTCDay() === 0 || d.getUTCDay() === 6);

    if (editForm.type === 'HOLIDAY') {
      if (isWeekend) {
        nextWeekendHolidays[dateStr] = editForm.name.trim() || 'NSE Weekend Holiday';
      } else {
        nextHolidays[dateStr] = editForm.name.trim() || 'Exchange Holiday';
      }
    } else if (editForm.type === 'SPECIAL_TRADING') {
      nextSpecial[dateStr] = {
        status: "SPECIAL_TRADING",
        name: editForm.name.trim() || 'Muhurat Trading',
        start: editForm.start.trim() || '18:00',
        end: editForm.end.trim() || '19:00',
        timing_pending: false
      };
    } else if (editForm.type === 'OVERRIDE_HOLIDAY') {
      nextOverrides[dateStr] = {
        status: "HOLIDAY",
        name: editForm.name.trim() || 'Emergency Closed'
      };
    } else if (editForm.type === 'TRADING' && isWeekend) {
      nextOverrides[dateStr] = {
        status: "TRADING",
        name: editForm.name.trim() || 'Weekend Mock Trading'
      };
    }

    setCalendarData({
      ...calendarData,
      holidays: nextHolidays,
      special_trading_days: nextSpecial,
      manual_overrides: nextOverrides,
      weekend_holidays: nextWeekendHolidays
    });

    setHasUnsavedChanges(true);
    setActiveDateModal(null);
    showToast(`Updated ${dateStr}`);
  };

  // 7. Reset Date back to default (Normal Weekday or Weekend)
  const handleResetDate = () => {
    if (!activeDateModal || !calendarData) return;
    const dateStr = activeDateModal;

    const nextHolidays = { ...calendarData.holidays };
    const nextSpecial = { ...calendarData.special_trading_days };
    const nextOverrides = { ...calendarData.manual_overrides };
    const nextWeekendHolidays = { ...calendarData.weekend_holidays };

    delete nextHolidays[dateStr];
    delete nextSpecial[dateStr];
    delete nextOverrides[dateStr];
    delete nextWeekendHolidays[dateStr];

    setCalendarData({
      ...calendarData,
      holidays: nextHolidays,
      special_trading_days: nextSpecial,
      manual_overrides: nextOverrides,
      weekend_holidays: nextWeekendHolidays
    });

    setHasUnsavedChanges(true);
    setActiveDateModal(null);
    showToast(`Reset ${dateStr} to standard default`);
  };

  // 8. Initialize a New Year
  const handleCreateNewYear = () => {
    const yr = parseInt(newYearInput, 10);
    if (!yr || yr < 2020 || yr > 2040) {
      alert("Please enter a valid year between 2020 and 2040");
      return;
    }

    const nextHolidays = { ...(calendarData?.holidays || {}) };

    Object.entries(STANDARD_RECURRING_HOLIDAYS).forEach(([mmdd, name]) => {
      const fullDate = `${yr}-${mmdd}`;
      const d = new Date(`${fullDate}T12:00:00Z`);
      if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) {
        nextHolidays[fullDate] = name;
      }
    });

    setCalendarData(prev => ({
      ...prev,
      holidays: nextHolidays
    }));

    setSelectedYear(yr);
    setHasUnsavedChanges(true);
    setIsNewYearModalOpen(false);
    showToast(`Initialized Calendar for Year ${yr}!`);
  };

  // 9. Quick Copy/Clone Holidays from Selected Year into target Year
  const handleCloneHolidays = (sourceYear, targetYear) => {
    if (!calendarData) return;
    const nextHolidays = { ...calendarData.holidays };
    let clonedCount = 0;

    Object.entries(calendarData.holidays).forEach(([dateStr, name]) => {
      if (dateStr.startsWith(String(sourceYear))) {
        const mmdd = dateStr.slice(5);
        const targetDate = `${targetYear}-${mmdd}`;
        nextHolidays[targetDate] = name;
        clonedCount++;
      }
    });

    setCalendarData(prev => ({
      ...prev,
      holidays: nextHolidays
    }));

    setHasUnsavedChanges(true);
    showToast(`Cloned ${clonedCount} holiday entries to ${targetYear}`);
  };

  // 10. Execute Bulk Import
  const parsedImportItems = useMemo(() => {
    return parseHolidayText(importText, importYear);
  }, [importText, importYear]);

  const handleApplyImport = () => {
    if (!parsedImportItems || parsedImportItems.length === 0) {
      alert("No valid holiday dates could be detected in the pasted text.");
      return;
    }

    let nextHolidays = { ...(calendarData?.holidays || {}) };
    let nextSpecial = { ...(calendarData?.special_trading_days || {}) };
    let nextWeekendHolidays = { ...(calendarData?.weekend_holidays || {}) };

    // If replace mode, purge all holidays for the target import year first
    if (importMode === 'REPLACE') {
      const yrPrefix = String(importYear);
      Object.keys(nextHolidays).forEach(k => { if (k.startsWith(yrPrefix)) delete nextHolidays[k]; });
      Object.keys(nextSpecial).forEach(k => { if (k.startsWith(yrPrefix)) delete nextSpecial[k]; });
      Object.keys(nextWeekendHolidays).forEach(k => { if (k.startsWith(yrPrefix)) delete nextWeekendHolidays[k]; });
    }

    let addedCount = 0;
    parsedImportItems.forEach(item => {
      const d = new Date(`${item.date}T12:00:00Z`);
      const isWeekend = (d.getUTCDay() === 0 || d.getUTCDay() === 6);
      const isMuhurat = /muhurat/i.test(item.name);

      if (isMuhurat) {
        nextSpecial[item.date] = {
          status: "SPECIAL_TRADING",
          name: item.name,
          start: "18:00",
          end: "19:00",
          timing_pending: false
        };
      } else if (isWeekend) {
        nextWeekendHolidays[item.date] = item.name;
      } else {
        nextHolidays[item.date] = item.name;
      }
      addedCount++;
    });

    setCalendarData(prev => ({
      ...prev,
      holidays: nextHolidays,
      special_trading_days: nextSpecial,
      weekend_holidays: nextWeekendHolidays
    }));

    setSelectedYear(importYear);
    setHasUnsavedChanges(true);
    setIsImportModalOpen(false);
    setImportText('');
    showToast(`Successfully imported ${addedCount} holidays into Year ${importYear}!`);
  };

  // 11. Summary Statistics for Selected Year
  const yearStats = useMemo(() => {
    if (!calendarData) return { tradingDays: 0, holidays: 0, specials: 0 };

    let tradingDays = 0;
    let holidays = 0;
    let specials = 0;

    const startDate = new Date(Date.UTC(selectedYear, 0, 1));
    const endDate = new Date(Date.UTC(selectedYear, 11, 31));

    for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${day}`;
      const info = getDayInfo(dateStr);

      if (info.status === 'TRADING') tradingDays++;
      else if (info.status === 'HOLIDAY' || info.status === 'OVERRIDE_HOLIDAY') holidays++;
      else if (info.status === 'SPECIAL_TRADING') specials++;
    }

    return { tradingDays, holidays, specials };
  }, [calendarData, selectedYear]);

  // Today's Date String in Asia/Kolkata
  const todayIstStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }, []);

  const todayInfo = useMemo(() => getDayInfo(todayIstStr), [todayIstStr, calendarData]);

  if (!isOpen) return null;

  // Render a Monthly Calendar Grid
  const renderMonth = (monthIdx) => {
    const monthName = MONTH_NAMES[monthIdx];
    const firstDayOfMonth = new Date(Date.UTC(selectedYear, monthIdx, 1));
    const lastDayOfMonth = new Date(Date.UTC(selectedYear, monthIdx + 1, 0));
    const daysInMonth = lastDayOfMonth.getUTCDate();

    // Monday-based indexing: Monday=0, ..., Sunday=6
    let startDayOfWeek = firstDayOfMonth.getUTCDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const cells = [];

    // Empty lead cells
    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push(<div key={`empty-${monthIdx}-${i}`} style={{ height: '42px', opacity: 0.15 }} />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatDateKey(selectedYear, monthIdx, day);
      const dayInfo = getDayInfo(dateStr);
      const isToday = dateStr === todayIstStr;

      let bgColor = 'rgba(15, 23, 42, 0.6)';
      let borderColor = '#334155';
      let textColor = '#cbd5e1';

      if (dayInfo.status === 'TRADING') {
        bgColor = 'rgba(16, 185, 129, 0.08)';
        borderColor = 'rgba(16, 185, 129, 0.4)';
        textColor = '#34d399';
      } else if (dayInfo.status === 'HOLIDAY' || dayInfo.status === 'WEEKEND_HOLIDAY') {
        bgColor = 'rgba(239, 68, 68, 0.2)';
        borderColor = '#ef4444';
        textColor = '#fca5a5';
      } else if (dayInfo.status === 'SPECIAL_TRADING') {
        bgColor = 'rgba(139, 92, 246, 0.25)';
        borderColor = '#a855f7';
        textColor = '#c084fc';
      } else if (dayInfo.status === 'OVERRIDE_HOLIDAY') {
        bgColor = 'rgba(234, 179, 8, 0.25)';
        borderColor = '#eab308';
        textColor = '#fde047';
      } else if (dayInfo.status === 'WEEKEND') {
        bgColor = '#0b0f19';
        borderColor = '#1e293b';
        textColor = '#64748b';
      }

      cells.push(
        <button
          key={dateStr}
          type="button"
          onClick={() => handleDateClick(dateStr)}
          title={`${dateStr}: ${dayInfo.label}`}
          style={{
            position: 'relative',
            height: '46px',
            backgroundColor: bgColor,
            border: `1.5px solid ${isToday ? '#38bdf8' : borderColor}`,
            borderRadius: '6px',
            color: textColor,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: '2px',
            transition: 'all 0.12s ease',
            boxShadow: isToday ? '0 0 10px rgba(56, 189, 248, 0.6)' : 'none',
            transform: isToday ? 'scale(1.02)' : 'none'
          }}
        >
          {isToday && (
            <span style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              width: '6px',
              height: '6px',
              backgroundColor: '#38bdf8',
              borderRadius: '50%'
            }} />
          )}

          <span style={{ fontSize: '13px', fontWeight: '900' }}>{day}</span>

          {dayInfo.badge && (
            <span style={{
              fontSize: '8px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '95%',
              color: dayInfo.color,
              marginTop: '1px'
            }}>
              {dayInfo.badge}
            </span>
          )}
        </button>
      );
    }

    return (
      <div 
        key={`month-${monthIdx}`}
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '10px',
          padding: '12px',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)'
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
          borderBottom: '1px solid #334155',
          paddingBottom: '6px'
        }}>
          <h4 style={{ margin: 0, color: '#38bdf8', fontSize: '14px', fontWeight: '900', letterSpacing: '0.5px' }}>
            {monthName} {selectedYear}
          </h4>
          <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold' }}>
            {daysInMonth} Days
          </span>
        </div>

        {/* Weekday headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '6px', textAlign: 'center' }}>
          {WEEKDAY_NAMES.map((wd, i) => (
            <span key={wd} style={{ fontSize: '10px', fontWeight: 'bold', color: i >= 5 ? '#f87171' : '#94a3b8' }}>
              {wd}
            </span>
          ))}
        </div>

        {/* Days grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {cells}
        </div>
      </div>
    );
  };

  const modalNode = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(3, 7, 18, 0.88)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 99999,
        padding: '16px',
        boxSizing: 'border-box'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !hasUnsavedChanges) {
          onClose();
        }
      }}
    >
      <div
        style={{
          width: '96%',
          maxWidth: '1360px',
          height: '92vh',
          backgroundColor: '#020617',
          border: '2px solid #38bdf8',
          borderRadius: '14px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 0 35px rgba(56, 189, 248, 0.25)',
          overflow: 'hidden'
        }}
      >
        {/* HEADER BAR */}
        <header style={{
          padding: '14px 20px',
          backgroundColor: '#0f172a',
          borderBottom: '2px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '22px' }}>📅</span>
            <div>
              <h2 style={{ margin: 0, color: '#ffffff', fontSize: '18px', fontWeight: '900', letterSpacing: '0.8px' }}>
                NSE MARKET TRADING CALENDAR
              </h2>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Manage regular trading days, official holidays, and special Muhurat sessions
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {hasUnsavedChanges && (
              <span style={{
                backgroundColor: 'rgba(234, 179, 8, 0.2)',
                color: '#facc15',
                border: '1px solid #eab308',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '900'
              }}>
                ● Unsaved Changes
              </span>
            )}

            <button
              type="button"
              onClick={handleInitiateSave}
              disabled={isSaving}
              style={{
                backgroundColor: '#10b981',
                color: '#000000',
                border: 'none',
                padding: '8px 18px',
                borderRadius: '6px',
                fontWeight: '900',
                fontSize: '12px',
                letterSpacing: '0.5px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 0 14px rgba(16, 185, 129, 0.4)'
              }}
            >
              {isSaving ? "⏳ SAVING..." : "💾 SAVE TO FIREBASE"}
            </button>

            <button
              type="button"
              onClick={fetchCalendar}
              disabled={isLoading}
              style={{
                backgroundColor: '#1e293b',
                color: '#cbd5e1',
                border: '1px solid #334155',
                padding: '8px 14px',
                borderRadius: '6px',
                fontWeight: 'bold',
                fontSize: '12px',
                cursor: 'pointer'
              }}
              title="Reload from Firebase"
            >
              🔄
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                backgroundColor: '#334155',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: '900',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              ✕ CLOSE
            </button>
          </div>
        </header>

        {/* CONTROL STRIP: YEAR SELECTOR, STATS & LEGEND */}
        <div style={{
          padding: '10px 20px',
          backgroundColor: '#0b1120',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Year Navigator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8' }}>YEAR:</span>
            <button
              type="button"
              onClick={() => setSelectedYear(y => y - 1)}
              style={{
                backgroundColor: '#1e293b',
                color: '#38bdf8',
                border: '1px solid #334155',
                borderRadius: '4px',
                padding: '4px 10px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ◀
            </button>
            <span style={{
              fontSize: '16px',
              fontWeight: '900',
              color: '#38bdf8',
              padding: '0 8px',
              letterSpacing: '1px'
            }}>
              {selectedYear}
            </span>
            <button
              type="button"
              onClick={() => setSelectedYear(y => y + 1)}
              style={{
                backgroundColor: '#1e293b',
                color: '#38bdf8',
                border: '1px solid #334155',
                borderRadius: '4px',
                padding: '4px 10px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ▶
            </button>

            {/* ACTION 1: Init New Year */}
            <button
              type="button"
              onClick={() => setIsNewYearModalOpen(true)}
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                padding: '5px 12px',
                fontSize: '11px',
                fontWeight: '900',
                cursor: 'pointer',
                marginLeft: '8px'
              }}
            >
              ➕ Init New Year
            </button>

            {/* ACTION 2: Clone from Previous Year */}
            <button
              type="button"
              onClick={() => handleCloneHolidays(selectedYear - 1, selectedYear)}
              style={{
                backgroundColor: '#1e293b',
                color: '#cbd5e1',
                border: '1px solid #334155',
                borderRadius: '4px',
                padding: '5px 10px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
              title={`Copy holidays from ${selectedYear - 1} into ${selectedYear}`}
            >
              📋 Copy from {selectedYear - 1}
            </button>

            {/* ACTION 3: IMPORT OFFICIAL HOLIDAYS (THE REQUESTED FEATURE) */}
            <button
              type="button"
              onClick={() => {
                setImportYear(selectedYear);
                setIsImportModalOpen(true);
              }}
              style={{
                backgroundColor: 'linear-gradient(180deg, #8b5cf6 0%, #6d28d9 100%)',
                background: '#7c3aed',
                color: '#ffffff',
                border: '1px solid #8b5cf6',
                borderRadius: '4px',
                padding: '5px 12px',
                fontSize: '11px',
                fontWeight: '900',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 0 10px rgba(124, 58, 237, 0.4)'
              }}
              title="Paste official NSE holidays or JSON to update all dates in one second"
            >
              📥 Import NSE Holidays
            </button>
          </div>

          {/* Today Ribbon */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            padding: '5px 12px',
            borderRadius: '6px',
            border: `1px solid ${todayInfo.color}`
          }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>TODAY ({todayIstStr}):</span>
            <span style={{ fontSize: '12px', fontWeight: '900', color: todayInfo.color }}>
              {todayInfo.status === 'TRADING' ? '🟢 LIVE / TRADING' : `🔴 ${todayInfo.label}`}
            </span>
          </div>

          {/* Year Stats */}
          <div style={{ display: 'flex', gap: '14px', fontSize: '11px', fontWeight: 'bold' }}>
            <span style={{ color: '#34d399' }}>🟢 Trading Days: {yearStats.tradingDays}</span>
            <span style={{ color: '#f87171' }}>🔴 Holidays: {yearStats.holidays}</span>
            <span style={{ color: '#c084fc' }}>🟣 Muhurat Sessions: {yearStats.specials}</span>
          </div>
        </div>

        {/* MONTH TAB STRIP & COLOR LEGEND */}
        <div style={{
          padding: '8px 20px',
          backgroundColor: '#0a0f1d',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          overflowX: 'auto',
          gap: '8px'
        }}>
          {/* Month selector pills */}
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setSelectedMonthIndex("ALL")}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: '900',
                borderRadius: '4px',
                border: selectedMonthIndex === "ALL" ? '1px solid #38bdf8' : '1px solid #1e293b',
                backgroundColor: selectedMonthIndex === "ALL" ? '#38bdf8' : '#0f172a',
                color: selectedMonthIndex === "ALL" ? '#000000' : '#94a3b8',
                cursor: 'pointer'
              }}
            >
              ALL 12 MONTHS
            </button>
            {MONTH_NAMES.map((m, idx) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedMonthIndex(idx)}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  borderRadius: '4px',
                  border: selectedMonthIndex === idx ? '1px solid #38bdf8' : '1px solid #1e293b',
                  backgroundColor: selectedMonthIndex === idx ? '#0284c7' : '#0f172a',
                  color: selectedMonthIndex === idx ? '#ffffff' : '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                {m.slice(0, 3).toUpperCase()}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '10px', fontSize: '10px', fontWeight: 'bold', flexShrink: 0 }}>
            <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              Normal Trading
            </span>
            <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
              Holiday
            </span>
            <span style={{ color: '#c084fc', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#8b5cf6' }} />
              Special / Muhurat
            </span>
            <span style={{ color: '#facc15', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#eab308' }} />
              Override
            </span>
            <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#334155' }} />
              Weekend
            </span>
          </div>
        </div>

        {/* MAIN CALENDAR CONTENT GRID */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '18px 20px',
          display: 'grid',
          gridTemplateColumns: selectedMonthIndex === "ALL" ? 'repeat(auto-fit, minmax(310px, 1fr))' : '1fr',
          gap: '16px'
        }}>
          {selectedMonthIndex === "ALL" ? (
            MONTH_NAMES.map((_, idx) => renderMonth(idx))
          ) : (
            <div style={{ maxWidth: '650px', margin: '0 auto', width: '100%' }}>
              {renderMonth(selectedMonthIndex)}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <footer style={{
          padding: '10px 20px',
          backgroundColor: '#0f172a',
          borderTop: '1px solid #1e293b',
          fontSize: '11px',
          color: '#64748b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>💡 Click any date above to edit session type, set holiday names, or configure Muhurat trading hours.</span>
          <span>Target Node: <code style={{ color: '#38bdf8' }}>/config/nse_calendar</code></span>
        </footer>

        {/* POPUP 2: DATE INSPECTOR / EDIT DRAWER */}
        {activeDateModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100001
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setActiveDateModal(null);
            }}
          >
            <div
              style={{
                backgroundColor: '#0f172a',
                border: '2px solid #38bdf8',
                borderRadius: '12px',
                padding: '22px',
                width: '90%',
                maxWidth: '460px',
                boxShadow: '0 0 25px rgba(56, 189, 248, 0.35)'
              }}
            >
              <h3 style={{ margin: '0 0 4px 0', color: '#ffffff', fontSize: '17px', fontWeight: '900' }}>
                ⚙️ EDIT SESSION: {activeDateModal}
              </h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '11px', color: '#94a3b8' }}>
                Configure market behavior and session rules for this day
              </p>

              {/* Status Radio Pills */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#cbd5e1', marginBottom: '8px' }}>
                  SESSION TYPE:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {[
                    { key: 'TRADING', label: '🟢 Normal Trading', desc: '09:15 - 15:30' },
                    { key: 'HOLIDAY', label: '🔴 Exchange Holiday', desc: 'Full-Day Closed' },
                    { key: 'SPECIAL_TRADING', label: '🟣 Special Muhurat', desc: 'Custom Hours' },
                    { key: 'OVERRIDE_HOLIDAY', label: '🟡 Emergency Closed', desc: 'Sudden Override' }
                  ].map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setEditForm(prev => ({ ...prev, type: opt.key }))}
                      style={{
                        padding: '10px 8px',
                        borderRadius: '6px',
                        border: editForm.type === opt.key ? '2px solid #38bdf8' : '1px solid #334155',
                        backgroundColor: editForm.type === opt.key ? '#1e293b' : '#0b1120',
                        color: editForm.type === opt.key ? '#38bdf8' : '#94a3b8',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontWeight: 'bold',
                        fontSize: '11px'
                      }}
                    >
                      <div>{opt.label}</div>
                      <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Holiday or Override Name */}
              {(editForm.type === 'HOLIDAY' || editForm.type === 'OVERRIDE_HOLIDAY') && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#cbd5e1', marginBottom: '6px' }}>
                    HOLIDAY NAME / REASON:
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Diwali-Balipratipada / Cyclone Alert"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontSize: '12px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

              {/* Special Muhurat Trading Settings */}
              {editForm.type === 'SPECIAL_TRADING' && (
                <div style={{ marginBottom: '16px', backgroundColor: '#1e1b4b', padding: '12px', borderRadius: '8px', border: '1px solid #6366f1' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#c7d2fe', marginBottom: '6px' }}>
                    SESSION NAME:
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Muhurat Trading - Diwali Laxmi Pujan"
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      backgroundColor: '#0f172a',
                      border: '1px solid #4338ca',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontSize: '12px',
                      marginBottom: '10px',
                      boxSizing: 'border-box'
                    }}
                  />

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#c7d2fe', marginBottom: '4px' }}>
                        START (IST):
                      </label>
                      <input
                        type="time"
                        value={editForm.start}
                        onChange={(e) => setEditForm(prev => ({ ...prev, start: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '6px',
                          backgroundColor: '#0f172a',
                          border: '1px solid #4338ca',
                          borderRadius: '6px',
                          color: '#ffffff',
                          fontSize: '12px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#c7d2fe', marginBottom: '4px' }}>
                        END (IST):
                      </label>
                      <input
                        type="time"
                        value={editForm.end}
                        onChange={(e) => setEditForm(prev => ({ ...prev, end: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '6px',
                          backgroundColor: '#0f172a',
                          border: '1px solid #4338ca',
                          borderRadius: '6px',
                          color: '#ffffff',
                          fontSize: '12px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={handleResetDate}
                  style={{
                    backgroundColor: 'transparent',
                    color: '#f87171',
                    border: '1px solid #ef4444',
                    padding: '7px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  🗑️ Reset to Default
                </button>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setActiveDateModal(null)}
                    style={{
                      backgroundColor: '#334155',
                      color: '#ffffff',
                      border: 'none',
                      padding: '7px 14px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyDateEdit}
                    style={{
                      backgroundColor: '#10b981',
                      color: '#000000',
                      border: 'none',
                      padding: '7px 18px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '900',
                      cursor: 'pointer',
                      boxShadow: '0 0 10px rgba(16, 185, 129, 0.4)'
                    }}
                  >
                    ✔️ Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* POPUP 3: CREATE NEW YEAR PROMPT */}
        {isNewYearModalOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100002
            }}
          >
            <div style={{
              backgroundColor: '#0f172a',
              border: '2px solid #0284c7',
              borderRadius: '10px',
              padding: '20px',
              maxWidth: '380px',
              width: '90%'
            }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#38bdf8', fontSize: '16px' }}>
                ➕ Initialize New Year Calendar
              </h3>
              <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '14px' }}>
                Pre-seeds all 52 weekends and fixed national holidays for the selected year.
              </p>
              <input
                type="number"
                min="2020"
                max="2040"
                value={newYearInput}
                onChange={(e) => setNewYearInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #38bdf8',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  boxSizing: 'border-box',
                  marginBottom: '16px'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsNewYearModalOpen(false)}
                  style={{
                    backgroundColor: '#334155',
                    color: '#ffffff',
                    border: 'none',
                    padding: '7px 14px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateNewYear}
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    padding: '7px 18px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '900',
                    cursor: 'pointer'
                  }}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* POPUP 4: IMPORT OFFICIAL NSE HOLIDAYS MODAL */}
        {isImportModalOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100003
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsImportModalOpen(false);
            }}
          >
            <div
              style={{
                backgroundColor: '#0f172a',
                border: '2px solid #8b5cf6',
                borderRadius: '12px',
                padding: '24px',
                width: '92%',
                maxWidth: '680px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 0 30px rgba(139, 92, 246, 0.4)'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>📥</span>
                  <h3 style={{ margin: 0, color: '#c084fc', fontSize: '18px', fontWeight: '900' }}>
                    IMPORT OFFICIAL NSE HOLIDAYS
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#94a3b8',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>

              <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: '#94a3b8', lineHeight: '1.5' }}>
                Paste official NSE circular lines, table data, or JSON below. The smart parser automatically extracts dates (e.g. <code>26-Jan-2026</code>, <code>2026-01-26</code>, or <code>26/01/2026</code>) and holiday descriptions in 1 second.
              </p>

              {/* Target Year & Mode Strip */}
              <div style={{
                display: 'flex',
                gap: '14px',
                alignItems: 'center',
                backgroundColor: '#0b1120',
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '14px',
                border: '1px solid #1e293b',
                flexWrap: 'wrap'
              }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#cbd5e1', marginRight: '6px' }}>
                    TARGET YEAR:
                  </label>
                  <select
                    value={importYear}
                    onChange={(e) => setImportYear(parseInt(e.target.value, 10))}
                    style={{
                      backgroundColor: '#1e293b',
                      color: '#38bdf8',
                      border: '1px solid #38bdf8',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    {[selectedYear - 1, selectedYear, selectedYear + 1, selectedYear + 2].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#cbd5e1', marginRight: '6px' }}>
                    MODE:
                  </label>
                  <select
                    value={importMode}
                    onChange={(e) => setImportMode(e.target.value)}
                    style={{
                      backgroundColor: '#1e293b',
                      color: '#ffffff',
                      border: '1px solid #475569',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '12px'
                    }}
                  >
                    <option value="MERGE">Merge with existing holidays</option>
                    <option value="REPLACE">Replace all holidays for {importYear}</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setImportText(SAMPLE_NSE_IMPORT_TEXT)}
                  style={{
                    marginLeft: 'auto',
                    backgroundColor: '#1e293b',
                    color: '#c084fc',
                    border: '1px solid #8b5cf6',
                    borderRadius: '4px',
                    padding: '5px 10px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  📋 Load NSE Sample Text
                </button>
              </div>

              {/* Textarea Input */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '160px', marginBottom: '14px' }}>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`Paste circular lines or JSON here...\nExample:\n26-Jan-2026 : Republic Day\n03-Mar-2026 : Holi\n08-Nov-2026 : Diwali Laxmi Pujan (Muhurat Trading)`}
                  rows={8}
                  style={{
                    width: '100%',
                    flex: 1,
                    backgroundColor: '#020617',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                    padding: '12px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    lineHeight: '1.6',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Live Detection Preview */}
              <div style={{
                backgroundColor: '#0b1120',
                borderRadius: '8px',
                border: '1px solid #1e293b',
                padding: '10px 14px',
                marginBottom: '16px',
                maxHeight: '130px',
                overflowY: 'auto'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                  <span style={{ color: parsedImportItems.length > 0 ? '#34d399' : '#94a3b8' }}>
                    {parsedImportItems.length > 0 
                      ? `✓ DETECTED ${parsedImportItems.length} VALID HOLIDAY DATES:` 
                      : '⚠️ No dates detected yet. Paste circular text or click "Load NSE Sample Text".'}
                  </span>
                  {parsedImportItems.length > 0 && (
                    <span style={{ color: '#c084fc' }}>Target: Year {importYear}</span>
                  )}
                </div>

                {parsedImportItems.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '4px' }}>
                    {parsedImportItems.map(item => (
                      <div key={item.date} style={{ fontSize: '11px', color: '#cbd5e1', display: 'flex', gap: '6px' }}>
                        <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{item.date}:</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  style={{
                    backgroundColor: '#334155',
                    color: '#ffffff',
                    border: 'none',
                    padding: '9px 18px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleApplyImport}
                  disabled={parsedImportItems.length === 0}
                  style={{
                    backgroundColor: parsedImportItems.length > 0 ? '#10b981' : '#475569',
                    color: parsedImportItems.length > 0 ? '#000000' : '#94a3b8',
                    border: 'none',
                    padding: '9px 24px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '900',
                    cursor: parsedImportItems.length > 0 ? 'pointer' : 'not-allowed',
                    boxShadow: parsedImportItems.length > 0 ? '0 0 14px rgba(16, 185, 129, 0.4)' : 'none'
                  }}
                >
                  🚀 Apply {parsedImportItems.length} Holidays
                </button>
              </div>

            </div>
          </div>
        )}

        {/* POPUP 5: CAUTIONARY CONFIRMATION MODAL BEFORE SAVING TO FIREBASE */}
        {showSaveConfirmModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(3, 7, 18, 0.9)',
              backdropFilter: 'blur(5px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100004
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !isSaving) setShowSaveConfirmModal(false);
            }}
          >
            <div
              style={{
                backgroundColor: '#0f172a',
                border: '2px solid #f59e0b',
                borderRadius: '12px',
                padding: '24px 28px',
                maxWidth: '480px',
                width: '90%',
                boxShadow: '0 0 35px rgba(245, 158, 11, 0.4)',
                color: '#ffffff'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                <span style={{ fontSize: '30px' }}>⚠️</span>
                <div>
                  <h3 style={{ margin: 0, color: '#f59e0b', fontSize: '17px', fontWeight: '900', letterSpacing: '0.5px' }}>
                    CAUTION: OVERWRITE LIVE CALENDAR?
                  </h3>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Database Target: <code style={{ color: '#38bdf8' }}>/config/nse_calendar</code>
                  </span>
                </div>
              </div>

              <div style={{
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '12px',
                color: '#fef08a',
                lineHeight: '1.5',
                marginBottom: '16px'
              }}>
                <strong>ATTENTION:</strong> You are about to update the official trading calendar in Firebase.
                <ul style={{ margin: '6px 0 0 0', paddingLeft: '18px' }}>
                  <li>The backend daemon (<code>master.py</code>) reads this data directly every 5 seconds.</li>
                  <li>Live trading schedules, holiday closures, and tracking will adapt immediately to this calendar.</li>
                </ul>
              </div>

              {/* Change Summary Stats */}
              <div style={{
                backgroundColor: '#020617',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12px',
                marginBottom: '20px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px'
              }}>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '11px' }}>Selected Year:</span>
                  <div style={{ fontWeight: 'bold', color: '#38bdf8' }}>{selectedYear}</div>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '11px' }}>Configured Holidays:</span>
                  <div style={{ fontWeight: 'bold', color: '#ef4444' }}>
                    {Object.keys(calendarData?.holidays || {}).length} Total
                  </div>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '11px' }}>Special Sessions:</span>
                  <div style={{ fontWeight: 'bold', color: '#c084fc' }}>
                    {Object.keys(calendarData?.special_trading_days || {}).length} (Muhurat)
                  </div>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '11px' }}>Manual Overrides:</span>
                  <div style={{ fontWeight: 'bold', color: '#facc15' }}>
                    {Object.keys(calendarData?.manual_overrides || {}).length} Active
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowSaveConfirmModal(false)}
                  disabled={isSaving}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '6px',
                    backgroundColor: '#334155',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: isSaving ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel / Go Back
                </button>

                <button
                  type="button"
                  onClick={executeConfirmSave}
                  disabled={isSaving}
                  style={{
                    padding: '9px 22px',
                    borderRadius: '6px',
                    backgroundColor: isSaving ? '#475569' : '#10b981',
                    color: isSaving ? '#94a3b8' : '#000000',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: '900',
                    letterSpacing: '0.5px',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    boxShadow: isSaving ? 'none' : '0 0 14px rgba(16, 185, 129, 0.4)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isSaving ? "⏳ WRITING TO FIREBASE..." : "⚠️ YES, OVERWRITE FIREBASE"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TOAST NOTIFICATION */}
        {notification && (
          <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: notification.type === 'error' ? '#ef4444' : '#10b981',
            color: '#000000',
            fontWeight: '900',
            padding: '10px 18px',
            borderRadius: '8px',
            fontSize: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            zIndex: 100005
          }}>
            {notification.message}
          </div>
        )}

      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalNode, document.body);
  }

  return modalNode;
}
