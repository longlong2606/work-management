import React, { useState, useEffect, useMemo } from "react";
import { api } from "../services/api";
import { SHIFTS } from "../constants/shifts";
import {
  X,
  GraduationCap,
  Upload,
  Download,
  CheckCircle2,
  Trash2,
  Calendar,
  RefreshCw,
  User,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Sparkles
} from "lucide-react";

const GREENWICH_COURSES = {
  COMP1753: "Lập trình cơ bản (Programming Foundations)",
  COMP1589: "Hệ thống máy tính và công nghệ internet (Computer Systems and Internet Technologies)",
  COMP1843: "Nguyên lý của Bảo mật (Principles of Security)",
  COMP1752: "Lập trình hướng đối tượng (Object Oriented Programming)",
  COMP1845: "Phát triển hệ thống (Systems Development)",
  COMP1857: "Giới thiệu về Khoa học dữ liệu (Introduction to Data Science)",
  MATH1179: "Toán cho Khoa học máy tính (Mathematics for Computer Science)",
  MATH1204: "Toán cho Khoa học máy tính (Mathematics for Computing)",
  COMP1821: "Nguyên lý của kỹ nghệ phần mềm (Principles of Software Engineering)",
  COMP1856: "Kỹ nghệ phần mềm (Software Engineering)",
  COMP1841: "Lập trình web 1 (Web Programming 1)",
  COMP1770: "Quản lý dự án chuyên nghiệp (Professional Project Management)",
  COMP1773: "Thiết kế giao diện người dùng (User Interface Design)",
  COMP1551: "Phát triển ứng dụng (Application Development)",
  COMP1807: "Quản lý dự án theo mô hình SCRUM (Agile Development with SCRUM)",
  COMP1842: "Lập trình Web 2 (Web Programming 2)",
  COMP1810: "Phân tích web và dữ liệu (Data and Web Analytics)",
  COMP1844: "Phân tích thông tin và trực quan hoá (Information Analysis and Visualisation)",
  COMP1891: "Ứng dụng trong AI và Khoa học dữ liệu (Applications in AI and Data Science)",
  COMP1858: "Cấu trúc dữ liệu và thuật toán (Data Structures and Algorithms)",
  COMP1806: "An toàn thông tin (Information Security)",
  COMP1682: "Đồ án tốt nghiệp (Final Year Projects)",
  COMP1787: "Quản lý yêu cầu (Requirements Management)",
  COMP1649: "Thiết kế và tương tác người máy (Human Computer Interaction and Design)",
  COMP1643: "Quản lý thông tin và nội dung (Information and Content Management)",
  COMP1786: "Thiết kế và Phát triển ứng dụng di động (Mobile Application Design And Development)",
  COMP1921: "Các chủ đề nâng cao trong KH dữ liệu & AI (Advanced Topics in Data Science and AI)"
};

export function ClassScheduleModal({
  isOpen,
  onClose,
  currentUser,
  allMembers = [],
  weekDays = [],
  onSuccess,
  showToast
}) {
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "leader" || currentUser?.role === "manager" || Boolean(currentUser?.username && currentUser.username.toLowerCase().includes("leader")) || Boolean(currentUser?.can_manage_schedule);
  const [activeTab, setActiveTab] = useState("import"); // 'import' | 'list'
  const [targetUserId, setTargetUserId] = useState(currentUser?.id || "");
  
  // Import states
  const [, setFileContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState([]);
  const [parsingError, setParsingError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // List states
  const [savedSchedules, setSavedSchedules] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [listFilterUser, setListFilterUser] = useState(currentUser?.id || "");
  const [expandedCourseKey, setExpandedCourseKey] = useState(null);
  const [viewMode, setViewMode] = useState("grouped"); // 'grouped' | 'flat'

  // Format YYYY-MM-DD
  const fmtDate = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // Compute default start/end dates
  const defaultDates = useMemo(() => {
    const baseMonday = (weekDays && weekDays.length > 0 && weekDays[0]?.dateStr)
      ? new Date(weekDays[0].dateStr + "T00:00:00")
      : (() => {
          const now = new Date();
          const curDay = now.getDay();
          const diffToMonday = (curDay === 0 ? -6 : 1) - curDay;
          const mon = new Date(now);
          mon.setDate(now.getDate() + diffToMonday);
          return mon;
        })();

    const sStr = fmtDate(baseMonday);
    const end8Weeks = new Date(baseMonday.getTime() + 8 * 7 * 86400000 - 86400000);
    const eStr = fmtDate(end8Weeks);
    return { start: sStr, end: eStr, baseMonday };
  }, [weekDays]);

  useEffect(() => {
    if (currentUser?.id) {
      setTargetUserId(currentUser.id);
      setListFilterUser(currentUser.id);
    }
  }, [currentUser]);

  // Fetch saved schedules when switching to 'list' tab
  const fetchSavedSchedules = async (uid) => {
    try {
      setIsLoadingList(true);
      const params = {};
      if (uid && uid !== "all") {
        params.user_id = uid;
      }
      const data = await api.getClassSchedules(params);
      setSavedSchedules(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === "list") {
      fetchSavedSchedules(listFilterUser);
    }
  }, [isOpen, activeTab, listFilterUser]);

  // Standard RFC-compliant CSV line parser
  const splitCsvLine = (line, delimiter = ",") => {
    const result = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(cur.replace(/^["']|["']$/g, "").trim());
        cur = "";
      } else {
        cur += char;
      }
    }
    result.push(cur.replace(/^["']|["']$/g, "").trim());
    return result;
  };

  // Map shift number or text to contiguous shift periods
  const parseShiftPeriods = (shiftVal) => {
    if (!shiftVal) return [];
    const str = shiftVal.toString().trim();
    const rawNums = str.match(/\d+/g);
    if (!rawNums || rawNums.length === 0) return [];

    const nums = Array.from(new Set(rawNums.map((n) => parseInt(n, 10)).filter((n) => n >= 1 && n <= 9))).sort((a, b) => a - b);
    if (nums.length === 0) return [];

    const groups = [];
    let currentGroup = [nums[0]];
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] === nums[i - 1] + 1) {
        currentGroup.push(nums[i]);
      } else {
        groups.push(currentGroup);
        currentGroup = [nums[i]];
      }
    }
    groups.push(currentGroup);

    return groups.map((group) => {
      const startId = group[0];
      const endId = group[group.length - 1];
      const startShift = SHIFTS.find((s) => s.id === startId) || SHIFTS[0];
      const endShift = SHIFTS.find((s) => s.id === endId) || startShift;

      return {
        startId,
        endId,
        startTime: startShift.startTime,
        endTime: endShift.endTime,
        shiftLabel: startId === endId
          ? `Ca ${startId} (${startShift.label})`
          : `Ca ${startId} - Ca ${endId} (${startShift.startTime} - ${endShift.endTime})`,
        shiftName: startId === endId ? `Ca ${startId}` : `Ca ${startId}-${endId}`
      };
    });
  };

  // Check if a time range overlaps with any of the 9 lab shifts
  const getOverlappingShifts = (startTime, endTime) => {
    const overlapping = [];
    SHIFTS.forEach((shift) => {
      const sStart = shift.startTime;
      const sEnd = shift.endTime;
      const maxStart = sStart > startTime ? sStart : startTime;
      const minEnd = sEnd < endTime ? sEnd : endTime;
      if (maxStart < minEnd) {
        overlapping.push(shift);
      }
    });
    return overlapping;
  };

  // Parse days of week string e.g. "2,4,6" or "T2,T4,T6" or "Mon,Wed,Fri" -> [1, 3, 5]
  const parseDaysOfWeek = (rawStr) => {
    if (!rawStr) return [];
    const s = rawStr.toString().toLowerCase().trim();
    if (s === "all" || s === "tat_ca" || s === "tất cả" || s === "hàng ngày" || s === "hang ngay" || s === "daily") {
      return [1, 2, 3, 4, 5, 6]; // T2 -> T7
    }

    const tokens = s.split(/[,;\/\s\-_]+/).map((t) => t.trim()).filter(Boolean);
    const result = new Set();

    tokens.forEach((t) => {
      if (t === "2" || t === "t2" || t === "thu2" || t === "thứ 2" || t === "thu 2" || t === "mon" || t === "monday") {
        result.add(1);
      } else if (t === "3" || t === "t3" || t === "thu3" || t === "thứ 3" || t === "thu 3" || t === "tue" || t === "tuesday") {
        result.add(2);
      } else if (t === "4" || t === "t4" || t === "thu4" || t === "thứ 4" || t === "thu 4" || t === "wed" || t === "wednesday") {
        result.add(3);
      } else if (t === "5" || t === "t5" || t === "thu5" || t === "thứ 5" || t === "thu 5" || t === "thu" || t === "thursday") {
        result.add(4);
      } else if (t === "6" || t === "t6" || t === "thu6" || t === "thứ 6" || t === "thu 6" || t === "fri" || t === "friday") {
        result.add(5);
      } else if (t === "7" || t === "t7" || t === "thu7" || t === "thứ 7" || t === "thu 7" || t === "sat" || t === "saturday") {
        result.add(6);
      } else if (t === "8" || t === "cn" || t === "chunhat" || t === "chủ nhật" || t === "chu nhat" || t === "sun" || t === "sunday") {
        result.add(0);
      }
    });

    return Array.from(result).sort();
  };

  const normalizeDate = (rawStr) => {
    if (!rawStr) return "";
    let s = rawStr.toString().trim().split(" ")[0].trim();
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
      const [y, m, d] = s.split("-");
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) {
      const [y, m, d] = s.split("/");
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    if (s.includes("/")) {
      const segs = s.split("/");
      if (segs.length === 3) {
        let y = segs[2].trim();
        if (y.length === 2) y = "20" + y;
        const p1 = parseInt(segs[0], 10);
        const p2 = parseInt(segs[1], 10);
        let m, d;
        if (p1 > 12) {
          d = String(p1).padStart(2, "0");
          m = String(p2).padStart(2, "0");
        } else if (p2 > 12) {
          m = String(p1).padStart(2, "0");
          d = String(p2).padStart(2, "0");
        } else {
          const curM = new Date().getMonth() + 1;
          if (p1 === curM && p2 !== curM) {
            m = String(p1).padStart(2, "0");
            d = String(p2).padStart(2, "0");
          } else {
            d = String(p1).padStart(2, "0");
            m = String(p2).padStart(2, "0");
          }
        }
        return `${y}-${m}-${d}`;
      }
    }
    if (s.includes(".")) {
      const segs = s.split(".");
      if (segs.length === 3) {
        let y = segs[2].trim();
        if (y.length === 2) y = "20" + y;
        return `${y}-${segs[1].trim().padStart(2, "0")}-${segs[0].trim().padStart(2, "0")}`;
      }
    }
    return s;
  };

  // Parse CSV content
  const handleParseCsv = (content, name = "") => {
    setParsingError("");
    setFileName(name);
    setFileContent(content);

    if (!content || !content.trim()) {
      setParsedRows([]);
      return;
    }

    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      setParsingError("File phải có ít nhất 1 dòng tiêu đề và 1 dòng dữ liệu.");
      setParsedRows([]);
      return;
    }

    const delimiter = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
    const rawHeaders = splitCsvLine(lines[0], delimiter).map((h) => h.replace(/^["']|["']$/g, "").trim().toLowerCase());

    const colIndex = {
      course_code: rawHeaders.findIndex((h) => h === "course_code" || h.includes("code") || h.includes("mã môn") || h.includes("subject")),
      class_name: rawHeaders.findIndex((h) => h === "class_name" || h.includes("class") || h.includes("name") || h.includes("tên môn") || h.includes("môn học")),
      start_date: rawHeaders.findIndex((h) => h === "start_date" || h.includes("start_date") || h.includes("start date") || h.includes("ngày bắt đầu") || h.includes("ngay bat dau") || h.includes("work_date") || h.includes("work date") || h === "date" || h === "ngày"),
      end_date: rawHeaders.findIndex((h) => h === "end_date" || h.includes("end_date") || h.includes("end date") || h.includes("ngày kết thúc") || h.includes("ngay ket thuc")),
      day_of_week: rawHeaders.findIndex((h) => h === "day_of_week" || h === "days_of_week" || h === "days" || h === "day" || h.includes("thứ") || h.includes("thu") || h.includes("day of week") || h.includes("days of week")),
      shift: rawHeaders.findIndex((h) => h === "shift" || h.includes("shift") || h.includes("ca") || h.includes("slot") || h.includes("buổi")),
      start_time: rawHeaders.findIndex((h) => h.includes("start_time") || h.includes("giờ bắt đầu") || h.includes("from")),
      end_time: rawHeaders.findIndex((h) => h.includes("end_time") || h.includes("giờ kết thúc") || h.includes("to")),
      room: rawHeaders.findIndex((h) => h.includes("room") || h.includes("phòng") || h.includes("địa điểm")),
    };

    if (colIndex.start_date === -1 || (colIndex.course_code === -1 && colIndex.class_name === -1) || (colIndex.shift === -1 && colIndex.start_time === -1)) {
      setParsingError("Cột tiêu đề không hợp lệ! File cần có các cột: course_code, class_name, start_date, end_date, shift, room (và tùy chọn day_of_week).");
      setParsedRows([]);
      return;
    }

    const parsed = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      let parts = splitCsvLine(line, delimiter);

      if (parts.length > rawHeaders.length && colIndex.shift !== -1) {
        const extraCount = parts.length - rawHeaders.length;
        const shiftParts = parts.slice(colIndex.shift, colIndex.shift + extraCount + 1);
        parts = [
          ...parts.slice(0, colIndex.shift),
          shiftParts.join(","),
          ...parts.slice(colIndex.shift + extraCount + 1),
        ];
      }
      
      let courseCode = colIndex.course_code !== -1 ? (parts[colIndex.course_code] || "") : "";
      let className = colIndex.class_name !== -1 ? (parts[colIndex.class_name] || "") : "";
      let startDateRaw = colIndex.start_date !== -1 ? (parts[colIndex.start_date] || "") : "";
      let endDateRaw = colIndex.end_date !== -1 ? (parts[colIndex.end_date] || "") : "";
      let dayOfWeekRaw = colIndex.day_of_week !== -1 ? (parts[colIndex.day_of_week] || "") : "";
      let shiftVal = colIndex.shift !== -1 ? (parts[colIndex.shift] || "") : "";
      let startTime = colIndex.start_time !== -1 ? (parts[colIndex.start_time] || "") : "";
      let endTime = colIndex.end_time !== -1 ? (parts[colIndex.end_time] || "") : "";
      const room = colIndex.room !== -1 ? (parts[colIndex.room] || "") : "";

      let shiftPeriods = [];
      if (shiftVal) {
        shiftPeriods = parseShiftPeriods(shiftVal);
      }

      if (shiftPeriods.length === 0) {
        let sTime = startTime;
        let eTime = endTime;
        if (sTime.length === 4 && sTime.includes(":")) sTime = "0" + sTime;
        if (eTime.length === 4 && eTime.includes(":")) eTime = "0" + eTime;

        let label = "";
        if (sTime && eTime) {
          const matching = SHIFTS.find((s) => s.startTime === sTime && s.endTime === eTime);
          label = matching ? `Ca ${matching.id} (${matching.label})` : `${sTime} - ${eTime}`;
        }
        shiftPeriods = [{
          startTime: sTime,
          endTime: eTime,
          shiftLabel: label || shiftVal || "Ca học"
        }];
      }

      // Smart lookup from GREENWICH_COURSES
      if (courseCode && !className && GREENWICH_COURSES[courseCode.toUpperCase()]) {
        className = GREENWICH_COURSES[courseCode.toUpperCase()];
      } else if (!courseCode && className) {
        const foundEntry = Object.entries(GREENWICH_COURSES).find(([, val]) => val.toLowerCase() === className.toLowerCase());
        if (foundEntry) courseCode = foundEntry[0];
      }
      if (!className && courseCode) className = courseCode;

      const sDateStr = normalizeDate(startDateRaw);
      const eDateStr = normalizeDate(endDateRaw) || sDateStr;

      // Intelligent Date Expansion across weeks
      let dateList = [];
      const sD = new Date(sDateStr + "T00:00:00");
      const eD = new Date(eDateStr + "T00:00:00");

      if (!isNaN(sD.getTime()) && !isNaN(eD.getTime()) && eD >= sD) {
        let targetDays = parseDaysOfWeek(dayOfWeekRaw);
        if (targetDays.length === 0) {
          if (sDateStr === eDateStr) {
            dateList.push(sDateStr);
          } else {
            // Default: repeat on the same day of week as start_date
            targetDays = [sD.getDay()];
          }
        }

        if (targetDays.length > 0) {
          const cur = new Date(sD);
          while (cur <= eD) {
            if (targetDays.includes(cur.getDay())) {
              const yyyy = cur.getFullYear();
              const mm = String(cur.getMonth() + 1).padStart(2, "0");
              const dd = String(cur.getDate()).padStart(2, "0");
              dateList.push(`${yyyy}-${mm}-${dd}`);
            }
            cur.setDate(cur.getDate() + 1);
          }
        }
      } else if (sDateStr) {
        dateList.push(sDateStr);
      }

      if (dateList.length === 0 && sDateStr) {
        dateList.push(sDateStr);
      }

      for (const dStr of dateList) {
        for (const period of shiftPeriods) {
          const sTime = period.startTime;
          const eTime = period.endTime;
          const isValid = Boolean(className && dStr && sTime && eTime && eTime > sTime);
          const overlapping = isValid ? getOverlappingShifts(sTime, eTime) : [];

          parsed.push({
            rowNum: i + 1,
            course_code: courseCode,
            class_name: className,
            work_date: dStr,
            start_date: sDateStr,
            end_date: eDateStr,
            start_time: sTime,
            end_time: eTime,
            shiftLabel: period.shiftLabel,
            room,
            isValid,
            error: !isValid ? (eTime <= sTime ? "Giờ kết thúc phải sau giờ bắt đầu" : "Thiếu thông tin bắt buộc") : null,
            overlappingShifts: overlapping
          });
        }
      }
    }

    setParsedRows(parsed);
  };

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text === "string") {
        handleParseCsv(text, uploadedFile.name);
      }
    };
    reader.readAsText(uploadedFile);
  };

  // Download template CSV with recurring weeks and day_of_week column
  const handleDownloadTemplate = () => {
    const csvHeader = "course_code,class_name,start_date,end_date,day_of_week,shift,room\n";
    const dStart = defaultDates.start;
    const dEnd = defaultDates.end;

    const sampleRows = [
      `COMP1752,Lập trình hướng đối tượng,${dStart},${dEnd},"2,4,6","1,2,3",Room 302`,
      `COMP1841,Lập trình Web 1,${dStart},${dEnd},"3,5","6",Room 401`,
      `MATH1179,Toán cho Khoa học máy tính,${dStart},${dEnd},"2,4","4,5",Room 405`,
      `COMP1843,Nguyên lý Bảo mật,${dStart},${dEnd},"6","7,8",Room 201`,
      `COMP1807,Quản lý dự án SCRUM,${dStart},${dEnd},"7","1,2",Room 102`,
    ].join("\n") + "\n";

    const blob = new Blob(["\uFEFF" + csvHeader + sampleRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Mau_Thoi_Khoa_Bieu_DaTuan_${dStart}_den_${dEnd}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Submit parsed CSV rows
  const handleConfirmImport = async () => {
    const validEntries = parsedRows
      .filter((r) => r.isValid)
      .map((r) => ({
        course_code: r.course_code,
        class_name: r.class_name,
        work_date: r.work_date,
        start_time: r.start_time,
        end_time: r.end_time,
        room: r.room,
      }));

    if (validEntries.length === 0) {
      alert("Không có buổi học hợp lệ nào để import!");
      return;
    }

    try {
      setIsSubmitting(true);
      const chosenUserId = targetUserId ? parseInt(targetUserId) : currentUser.id;
      const res = await api.importClassSchedules({
        target_user_id: chosenUserId,
        entries: validEntries,
      });

      const earliestDate = validEntries[0]?.work_date;
      const successMsg = res.message || `Đã nhập thành công ${validEntries.length} buổi học và tự động trừ KPI cho các ca trực trùng trên toàn bộ các tuần!`;
      if (showToast) {
        showToast(successMsg, "success");
      } else {
        alert(successMsg);
      }
      setParsedRows([]);
      setFileContent("");
      setFileName("");
      await api.syncClassScheduleKpi().catch(() => {});
      if (onSuccess) await onSuccess(earliestDate);
      onClose();
    } catch (err) {
      alert("Lỗi khi import thời khóa biểu: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete single schedule
  const handleDeleteSchedule = async (id) => {
    if (!window.confirm("Bạn có chắc muốn xóa buổi học này không?\n\nCa trực bị trừ KPI do buổi học này sẽ được tự động khôi phục có mặt và cộng lại giờ KPI!")) return;
    try {
      const res = await api.deleteClassSchedule(id);
      await api.syncClassScheduleKpi().catch(() => {});
      const msg = res.message || "Đã xóa buổi học và tự động cộng lại giờ KPI thành công!";
      if (showToast) showToast(msg, "success");
      fetchSavedSchedules(listFilterUser);
      if (onSuccess) await onSuccess();
    } catch (err) {
      alert("Lỗi khi xóa buổi học: " + err.message);
    }
  };

  // Delete entire course across all weeks
  const handleDeleteCourse = async (group) => {
    const confirmMsg = `Bạn có chắc muốn XÓA TOÀN BỘ ${group.sessions.length} buổi học của môn:\n"${group.course_code ? group.course_code + ' - ' : ''}${group.class_name}"?\n\nTất cả các ca trực bị trừ KPI do môn này trong toàn bộ các tuần sẽ được tự động khôi phục có mặt và cộng lại đủ giờ KPI!`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const params = {
        user_id: listFilterUser && listFilterUser !== "all" ? listFilterUser : targetUserId,
      };
      if (group.course_code) params.course_code = group.course_code;
      if (group.class_name) params.class_name = group.class_name;

      const res = await api.deleteClassScheduleByCourse(params);
      await api.syncClassScheduleKpi().catch(() => {});
      const msg = res.message || `Đã xóa toàn bộ ${group.sessions.length} buổi học và khôi phục KPI thành công!`;
      if (showToast) showToast(msg, "success");
      fetchSavedSchedules(listFilterUser);
      if (onSuccess) await onSuccess();
    } catch (err) {
      alert("Lỗi khi xóa môn học: " + err.message);
    }
  };

  // Clear all schedules
  const handleClearAllSchedules = async () => {
    const confirmMsg = "⚠️ CẢNH BÁO: Bạn có chắc muốn XÓA TOÀN BỘ thời khóa biểu này không?\n\nToàn bộ các ca trực bị trừ do trùng lịch học sẽ được tự động khôi phục có mặt và cộng lại đủ giờ KPI!";
    if (!window.confirm(confirmMsg)) return;

    try {
      const params = {};
      if (listFilterUser && listFilterUser !== "all") params.user_id = listFilterUser;
      const res = await api.clearClassSchedules(params);
      await api.syncClassScheduleKpi().catch(() => {});

      const msg = res.message || "Đã xóa toàn bộ thời khóa biểu và khôi phục lại đủ giờ KPI thành công!";
      if (showToast) showToast(msg, "success");
      fetchSavedSchedules(listFilterUser);
      if (onSuccess) await onSuccess();
      onClose();
    } catch (err) {
      alert("Lỗi khi xóa thời khóa biểu: " + err.message);
    }
  };

  // Grouped saved schedules by course & shift
  const groupedCourses = useMemo(() => {
    const map = {};
    savedSchedules.forEach((item) => {
      const key = `${item.course_code || ""}_${item.class_name}_${item.start_time}_${item.end_time}`;
      if (!map[key]) {
        map[key] = {
          key,
          course_code: item.course_code,
          class_name: item.class_name,
          start_time: item.start_time,
          end_time: item.end_time,
          room: item.room,
          sessions: [],
          dates: [],
          daysOfWeek: new Set(),
        };
      }
      map[key].sessions.push(item);
      map[key].dates.push(item.work_date);
      const d = new Date(item.work_date + "T00:00:00");
      if (!isNaN(d.getTime())) {
        map[key].daysOfWeek.add(d.getDay());
      }
    });

    return Object.values(map).map((group) => {
      const sortedDates = group.dates.sort();
      const minDate = sortedDates[0] || "";
      const maxDate = sortedDates[sortedDates.length - 1] || "";
      const dayNames = Array.from(group.daysOfWeek)
        .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
        .map((d) => (d === 0 ? "Chủ nhật" : `Thứ ${d + 1}`))
        .join(", ");

      const matchingShift = SHIFTS.find((s) => s.startTime === group.start_time && s.endTime === group.end_time);

      return {
        ...group,
        minDate,
        maxDate,
        dayNames: dayNames || "Theo lịch",
        shiftLabel: matchingShift ? `Ca ${matchingShift.id} (${matchingShift.label})` : `${group.start_time} - ${group.end_time}`
      };
    });
  }, [savedSchedules]);

  // Calculations for preview
  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;
  const overlapCount = parsedRows.filter((r) => r.isValid && r.overlappingShifts.length > 0).length;

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{
          maxWidth: 960,
          width: "95%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 20,
          background: "#ffffff",
          padding: 0,
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
            color: "#ffffff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "rgba(255,255,255,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <GraduationCap size={26} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#ffffff" }}>
                Thời Khóa Biểu & Lịch Học Lặp Tuần (Class Schedule)
              </h3>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                Tự động lặp lại theo tuần cho toàn bộ học kỳ (start_date → end_date) và tự động đánh vắng, trừ KPI (20h/tuần) cho các ca trực trùng lịch.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "none",
              borderRadius: 8,
              width: 32,
              height: 32,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Controls (Only 2 tabs: Import CSV & Saved Schedules) */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
            padding: "0 24px",
            gap: 8,
            overflowX: "auto",
          }}
        >
          <button
            onClick={() => setActiveTab("import")}
            style={{
              padding: "14px 20px",
              border: "none",
              background: "none",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: activeTab === "import" ? "#2563eb" : "#64748b",
              borderBottom: activeTab === "import" ? "3px solid #2563eb" : "3px solid transparent",
              whiteSpace: "nowrap"
            }}
          >
            <Upload size={16} /> <span>Import File CSV / Excel Đa Tuần</span>
          </button>

          <button
            onClick={() => setActiveTab("list")}
            style={{
              padding: "14px 20px",
              border: "none",
              background: "none",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: activeTab === "list" ? "#2563eb" : "#64748b",
              borderBottom: activeTab === "list" ? "3px solid #2563eb" : "3px solid transparent",
              whiteSpace: "nowrap"
            }}
          >
            <Calendar size={16} /> <span>Thời Khóa Biểu Đã Lưu ({savedSchedules.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          
          {/* Member Selector for Admin/Leader */}
          {isAdmin && allMembers.length > 0 && activeTab !== "list" && (
            <div
              style={{
                background: "#f0f7ff",
                border: "1.5px solid #bfdbfe",
                borderRadius: 12,
                padding: "10px 16px",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <User size={18} color="#2563eb" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#1e3a8a" }}>
                    Nhân sự áp dụng Thời Khóa Biểu:
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    Hệ thống sẽ đối chiếu và tự động trừ KPI cho nhân sự được chọn này trên tất cả các tuần
                  </div>
                </div>
              </div>
              <select
                value={targetUserId}
                onChange={(e) => {
                  const uid = e.target.value;
                  setTargetUserId(uid);
                  setListFilterUser(uid);
                }}
                style={{
                  padding: "7px 12px",
                  borderRadius: 8,
                  border: "1.5px solid #93c5fd",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#1e3a8a",
                  minWidth: 240,
                  background: "#ffffff",
                  cursor: "pointer",
                }}
              >
                {allMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name || m.username} (@{m.username}) {m.role === "admin" ? "[Quản lý]" : m.role === "leader" ? "[Leader]" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* TAB 1: IMPORT CSV */}
          {activeTab === "import" && (
            <div>
              {/* Upload Dropzone */}
              <div
                style={{
                  border: "2px dashed #93c5fd",
                  borderRadius: 14,
                  padding: "20px 20px",
                  textAlign: "center",
                  background: "#eff6ff",
                  marginBottom: 16,
                }}
              >
                <Upload size={32} color="#2563eb" style={{ marginBottom: 6 }} />
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e3a8a" }}>
                  Tải lên File Thời Khóa Biểu (Excel / CSV)
                </h4>
                <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 12px" }}>
                  Hỗ trợ các cột: <code>course_code</code>, <code>class_name</code>, <code>start_date</code>, <code>end_date</code>, <strong><code>day_of_week</code> (vd: 2,4,6 hoặc T2,T4,T6)</strong>, <strong><code>shift</code> (1, 2, 6... hoặc Ca 6)</strong>, <code>room</code>
                </p>

                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <label
                    className="btn btn-primary btn-sm"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "8px 16px" }}
                  >
                    <Upload size={15} /> <span>Chọn File CSV Từ Máy</span>
                    <input
                      type="file"
                      accept=".csv,text/csv,text/plain"
                      onChange={handleFileUpload}
                      style={{ display: "none" }}
                    />
                  </label>

                  <button
                    onClick={handleDownloadTemplate}
                    className="btn btn-secondary btn-sm"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px" }}
                  >
                    <Download size={15} /> <span>Tải Mẫu CSV Đa Tuần (Mẫu Chuẩn)</span>
                  </button>
                </div>

                {fileName && (
                  <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: "#2563eb" }}>
                    📄 Đã tải: {fileName}
                  </div>
                )}
              </div>

              {/* Informative Note */}
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 12,
                  color: "#166534",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Sparkles size={16} color="#16a34a" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Cơ chế tự động áp dụng qua các tuần tiếp theo:</strong> Bạn chỉ cần nhập <code>start_date</code> (ngày bắt đầu kỳ) và <code>end_date</code> (ngày kết thúc kỳ) cùng cột <code>day_of_week</code> (ví dụ: <code>2,4,6</code>). Hệ thống sẽ tự động nhân bản lịch học cho tất cả các tuần tiếp theo và giữ nguyên trạng thái vắng, trừ KPI cho các tuần đó!
                </div>
              </div>

              {parsingError && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", color: "#dc2626", fontSize: 13, marginBottom: 14 }}>
                  ⚠️ {parsingError}
                </div>
              )}

              {/* Preview Table */}
              {parsedRows.length > 0 && (
                <div>
                  {overlapCount > 0 && (
                    <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: "#c2410c", display: "flex", alignItems: "center", gap: 6 }}>
                      <span>⚡ Phát hiện <strong>{overlapCount}</strong> ca trực trùng lịch học trên các tuần. Khi xác nhận import, hệ thống sẽ tự động chuyển sang <strong>Vắng mặt</strong> và <strong>trừ giờ KPI</strong> tương ứng cho toàn bộ các tuần!</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <span>Tổng: <strong>{parsedRows.length}</strong> buổi học</span>
                      <span style={{ color: "#16a34a" }}>• Hợp lệ: <strong>{validCount}</strong></span>
                      {invalidCount > 0 && <span style={{ color: "#dc2626" }}>• Lỗi: <strong>{invalidCount}</strong></span>}
                      {overlapCount > 0 && <span style={{ color: "#d97706" }}>• Trùng ca trực: <strong>{overlapCount}</strong></span>}
                    </div>

                    <button
                      onClick={handleConfirmImport}
                      disabled={isSubmitting || validCount === 0}
                      className="btn btn-primary btn-sm"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}
                    >
                      <CheckCircle2 size={16} />
                      <span>{isSubmitting ? "Đang lưu..." : `Xác Nhận Import (${validCount} buổi vào các tuần)`}</span>
                    </button>
                  </div>

                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", maxHeight: 340, overflowY: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
                      <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 1 }}>
                        <tr>
                          <th style={{ padding: "10px 12px" }}>Mã / Tên Môn Học</th>
                          <th style={{ padding: "10px 12px" }}>Ngày Học</th>
                          <th style={{ padding: "10px 12px" }}>Ca Học</th>
                          <th style={{ padding: "10px 12px" }}>Phòng</th>
                          <th style={{ padding: "10px 12px" }}>Đối Chiếu Ca Trực Lab</th>
                          <th style={{ padding: "10px 12px" }}>Trạng Thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.map((r, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", background: r.isValid ? "#ffffff" : "#fff1f2" }}>
                            <td style={{ padding: "8px 12px" }}>
                              <div style={{ fontWeight: 700, color: "#1e293b" }}>{r.course_code || "N/A"}</div>
                              <div style={{ fontSize: 11, color: "#64748b" }}>{r.class_name}</div>
                            </td>
                            <td style={{ padding: "8px 12px", fontWeight: 600 }}>{r.work_date}</td>
                            <td style={{ padding: "8px 12px" }}>
                              <span style={{ fontWeight: 700, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", padding: "2px 8px", borderRadius: 6, fontSize: 11.5 }}>
                                {r.shiftLabel}
                              </span>
                            </td>
                            <td style={{ padding: "8px 12px" }}>{r.room || "-"}</td>
                            <td style={{ padding: "8px 12px" }}>
                              {r.overlappingShifts.length > 0 ? (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                  {r.overlappingShifts.map((s) => (
                                    <span
                                      key={s.id}
                                      style={{
                                        padding: "2px 6px",
                                        borderRadius: 4,
                                        fontSize: 10.5,
                                        fontWeight: 700,
                                        background: "#fee2e2",
                                        color: "#dc2626",
                                        border: "1px solid #fca5a5"
                                      }}
                                      title={`Trùng với ${s.name} (${s.label}) - Sẽ tự động trừ KPI`}
                                    >
                                      ⚠️ Ca {s.id} (Trừ KPI)
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: "#16a34a", fontSize: 11, fontWeight: 600 }}>✓ Rảnh các ca</span>
                              )}
                            </td>
                            <td style={{ padding: "8px 12px" }}>
                              {r.isValid ? (
                                <span style={{ color: "#16a34a", fontWeight: 700 }}>Hợp lệ</span>
                              ) : (
                                <span style={{ color: "#dc2626", fontWeight: 700 }}>{r.error}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LIST SAVED SCHEDULES */}
          {activeTab === "list" && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                {isAdmin ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 700 }}>Xem TKB của:</label>
                    <select
                      className="form-select form-select-sm"
                      style={{ maxWidth: 220 }}
                      value={listFilterUser}
                      onChange={(e) => setListFilterUser(e.target.value)}
                    >
                      <option value="all">-- Tất cả nhân sự --</option>
                      {allMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name} ({m.username})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "#64748b" }}>
                    Thời khóa biểu học tập của: <strong>{currentUser?.full_name}</strong>
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 8, padding: 2 }}>
                    <button
                      type="button"
                      onClick={() => setViewMode("grouped")}
                      style={{
                        border: "none",
                        padding: "4px 10px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        background: viewMode === "grouped" ? "#ffffff" : "transparent",
                        color: viewMode === "grouped" ? "#2563eb" : "#64748b",
                        boxShadow: viewMode === "grouped" ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
                      }}
                    >
                      Gom nhóm môn ({groupedCourses.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("flat")}
                      style={{
                        border: "none",
                        padding: "4px 10px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        background: viewMode === "flat" ? "#ffffff" : "transparent",
                        color: viewMode === "flat" ? "#2563eb" : "#64748b",
                        boxShadow: viewMode === "flat" ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
                      }}
                    >
                      Tất cả buổi ({savedSchedules.length})
                    </button>
                  </div>

                  <button
                    onClick={() => fetchSavedSchedules(listFilterUser)}
                    className="btn btn-secondary btn-sm"
                    title="Làm mới"
                  >
                    <RefreshCw size={14} />
                  </button>
                  {savedSchedules.length > 0 && (
                    <button
                      onClick={handleClearAllSchedules}
                      className="btn btn-secondary btn-sm"
                      style={{ color: "#dc2626", borderColor: "#fecaca", background: "#fef2f2" }}
                    >
                      <Trash2 size={14} /> <span>Xóa Tất Cả TKB</span>
                    </button>
                  )}
                </div>
              </div>

              {isLoadingList ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                  Đang tải thời khóa biểu...
                </div>
              ) : savedSchedules.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "50px 20px",
                    background: "#f8fafc",
                    borderRadius: 12,
                    border: "1px dashed #cbd5e1",
                  }}
                >
                  <Calendar size={36} color="#94a3b8" style={{ marginBottom: 8 }} />
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#334155" }}>
                    Chưa có lịch học nào được lưu
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
                    Chuyển sang tab <strong>Import File CSV / Excel Đa Tuần</strong> để tải lên file thời khóa biểu.
                  </p>
                </div>
              ) : viewMode === "grouped" ? (
                /* Grouped Course Cards */
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {groupedCourses.map((group) => {
                    const isExpanded = expandedCourseKey === group.key;
                    return (
                      <div
                        key={group.key}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: 12,
                          background: "#ffffff",
                          overflow: "hidden",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                        }}
                      >
                        <div
                          style={{
                            padding: "14px 18px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            background: "#f8fafc",
                            borderBottom: isExpanded ? "1px solid #e2e8f0" : "none",
                            flexWrap: "wrap",
                            gap: 10,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 10,
                                background: "#eff6ff",
                                border: "1px solid #bfdbfe",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#2563eb",
                              }}
                            >
                              <BookOpen size={20} />
                            </div>
                            <div>
                              <div style={{ fontSize: 14.5, fontWeight: 800, color: "#1e293b" }}>
                                {group.course_code ? `${group.course_code} - ` : ""}{group.class_name}
                              </div>
                              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontWeight: 700, color: "#2563eb" }}>📅 {group.dayNames}</span>
                                <span>•</span>
                                <span style={{ fontWeight: 700, color: "#7c3aed" }}>⏰ {group.shiftLabel}</span>
                                {group.room && (
                                  <>
                                    <span>•</span>
                                    <span>🏫 {group.room}</span>
                                  </>
                                )}
                                <span>•</span>
                                <span style={{ fontWeight: 700, color: "#059669" }}>
                                  {group.sessions.length} buổi ({group.minDate} → {group.maxDate})
                                </span>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => setExpandedCourseKey(isExpanded ? null : group.key)}
                              className="btn btn-secondary btn-sm"
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}
                            >
                              <span>{isExpanded ? "Ẩn ngày" : `Xem ${group.sessions.length} ngày`}</span>
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteCourse(group)}
                              className="btn btn-sm"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 12,
                                fontWeight: 700,
                                background: "#fef2f2",
                                color: "#dc2626",
                                border: "1px solid #fecaca",
                              }}
                              title="Xóa toàn bộ các buổi của môn này và khôi phục KPI cho tất cả các tuần"
                            >
                              <Trash2 size={13} />
                              <span>Xóa Môn Này</span>
                            </button>
                          </div>
                        </div>

                        {/* Expanded details list of dates */}
                        {isExpanded && (
                          <div style={{ padding: "12px 18px", background: "#ffffff", maxHeight: 220, overflowY: "auto" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
                              {group.sessions.map((s) => (
                                <div
                                  key={s.id}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "6px 10px",
                                    background: "#f8fafc",
                                    borderRadius: 8,
                                    border: "1px solid #e2e8f0",
                                    fontSize: 12,
                                  }}
                                >
                                  <div>
                                    <span style={{ fontWeight: 700, color: "#1e293b" }}>{s.work_date}</span>
                                    <span style={{ color: "#64748b", marginLeft: 6 }}>({s.start_time} - {s.end_time})</span>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteSchedule(s.id)}
                                    style={{
                                      border: "none",
                                      background: "none",
                                      color: "#ef4444",
                                      cursor: "pointer",
                                      padding: 2,
                                    }}
                                    title="Xóa buổi này"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Flat Schedule Table */
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", maxHeight: 380, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
                    <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 1 }}>
                      <tr>
                        <th style={{ padding: "10px 12px" }}>Mã / Tên Môn Học</th>
                        <th style={{ padding: "10px 12px" }}>Ngày Học</th>
                        <th style={{ padding: "10px 12px" }}>Thời Gian</th>
                        <th style={{ padding: "10px 12px" }}>Phòng</th>
                        <th style={{ padding: "10px 12px", textAlign: "right" }}>Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedSchedules.map((s) => (
                        <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "8px 12px" }}>
                            <div style={{ fontWeight: 700, color: "#1e293b" }}>{s.course_code || "N/A"}</div>
                            <div style={{ fontSize: 11, color: "#64748b" }}>{s.class_name}</div>
                          </td>
                          <td style={{ padding: "8px 12px", fontWeight: 600 }}>{s.work_date}</td>
                          <td style={{ padding: "8px 12px" }}>
                            <span style={{ fontWeight: 700, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", padding: "2px 8px", borderRadius: 6, fontSize: 11.5 }}>
                              {s.start_time} - {s.end_time}
                            </span>
                          </td>
                          <td style={{ padding: "8px 12px" }}>{s.room || "-"}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right" }}>
                            <button
                              onClick={() => handleDeleteSchedule(s.id)}
                              className="btn btn-sm"
                              style={{ color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", padding: "4px 8px" }}
                              title="Xóa buổi này và khôi phục KPI"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
