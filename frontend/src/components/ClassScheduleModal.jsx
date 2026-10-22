import React, { useState, useEffect } from "react";
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
  RefreshCw
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
  onSuccess
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

  // Standard RFC-compliant CSV line parser that respects quotes and delimiters
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
  // e.g. "1,2,3" -> [{ startId: 1, endId: 3, startTime: "08:00", endTime: "12:40", shiftLabel: "Ca 1 - Ca 3 (08:00 - 12:40)" }]
  // e.g. "5,6,7,8" -> [{ startId: 5, endId: 8, startTime: "14:45", endTime: "20:25", shiftLabel: "Ca 5 - Ca 8 (14:45 - 20:25)" }]
  // e.g. "5,7,8,9" -> [
  //   { startId: 5, endId: 5, startTime: "14:45", endTime: "16:15", shiftLabel: "Ca 5 (14:45 - 16:15)" },
  //   { startId: 7, endId: 9, startTime: "18:20", endTime: "22:00", shiftLabel: "Ca 7 - Ca 9 (18:20 - 22:00)" }
  // ]
  const parseShiftPeriods = (shiftVal) => {
    if (!shiftVal) return [];
    const str = shiftVal.toString().trim();
    const rawNums = str.match(/\d+/g);
    if (!rawNums || rawNums.length === 0) return [];

    const nums = Array.from(new Set(rawNums.map((n) => parseInt(n, 10)).filter((n) => n >= 1 && n <= 9))).sort((a, b) => a - b);
    if (nums.length === 0) return [];

    // Group contiguous numbers
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

    // Split headers
    const delimiter = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
    const rawHeaders = splitCsvLine(lines[0], delimiter).map((h) => h.replace(/^["']|["']$/g, "").trim().toLowerCase());

    // Normalize header mapping: supports course_code, class_name, start_date, end_date, shift, room
    const colIndex = {
      course_code: rawHeaders.findIndex((h) => h === "course_code" || h.includes("code") || h.includes("mã môn") || h.includes("subject")),
      class_name: rawHeaders.findIndex((h) => h === "class_name" || h.includes("class") || h.includes("name") || h.includes("tên môn") || h.includes("môn học")),
      start_date: rawHeaders.findIndex((h) => h === "start_date" || h.includes("start_date") || h.includes("start date") || h.includes("ngày bắt đầu") || h.includes("ngay bat dau") || h.includes("work_date") || h.includes("work date") || h === "date" || h === "ngày"),
      end_date: rawHeaders.findIndex((h) => h === "end_date" || h.includes("end_date") || h.includes("end date") || h.includes("ngày kết thúc") || h.includes("ngay ket thuc")),
      shift: rawHeaders.findIndex((h) => h === "shift" || h.includes("shift") || h.includes("ca") || h.includes("slot") || h.includes("buổi")),
      start_time: rawHeaders.findIndex((h) => h.includes("start_time") || h.includes("giờ bắt đầu") || h.includes("from")),
      end_time: rawHeaders.findIndex((h) => h.includes("end_time") || h.includes("giờ kết thúc") || h.includes("to")),
      room: rawHeaders.findIndex((h) => h.includes("room") || h.includes("phòng") || h.includes("địa điểm")),
    };

    if (colIndex.start_date === -1 || (colIndex.course_code === -1 && colIndex.class_name === -1) || (colIndex.shift === -1 && colIndex.start_time === -1)) {
      setParsingError("Cột tiêu đề không hợp lệ! File cần có các cột: course_code, class_name, start_date, end_date, shift, room.");
      setParsedRows([]);
      return;
    }

    const normalizeDate = (rawStr) => {
      if (!rawStr) return "";
      let s = rawStr.toString().trim().split(" ")[0];
      if (s.includes("/")) {
        const segs = s.split("/");
        if (segs.length === 3) {
          if (segs[0].length === 4) {
            s = `${segs[0]}-${segs[1].padStart(2, "0")}-${segs[2].padStart(2, "0")}`;
          } else {
            s = `${segs[2]}-${segs[1].padStart(2, "0")}-${segs[0].padStart(2, "0")}`;
          }
        }
      }
      return s;
    };

    const parsed = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      let parts = splitCsvLine(line, delimiter);

      // Intelligent reconstruction if unquoted shift cell had commas (e.g. 5,6,7,8 or 1,2,3)
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

      // Fallback smart lookup from GREENWICH_COURSES
      if (courseCode && !className && GREENWICH_COURSES[courseCode.toUpperCase()]) {
        className = GREENWICH_COURSES[courseCode.toUpperCase()];
      } else if (!courseCode && className) {
        const foundEntry = Object.entries(GREENWICH_COURSES).find(([, val]) => val.toLowerCase() === className.toLowerCase());
        if (foundEntry) courseCode = foundEntry[0];
      }
      if (!className && courseCode) className = courseCode;

      const sDateStr = normalizeDate(startDateRaw);
      const eDateStr = normalizeDate(endDateRaw) || sDateStr;

      let dateList = [];
      if (!eDateStr || eDateStr === sDateStr) {
        if (sDateStr) dateList.push(sDateStr);
      } else {
        const sD = new Date(sDateStr + "T00:00:00");
        const eD = new Date(eDateStr + "T00:00:00");
        if (!isNaN(sD.getTime()) && !isNaN(eD.getTime()) && eD >= sD) {
          const diffDays = Math.round((eD.getTime() - sD.getTime()) / (1000 * 60 * 60 * 24));
          const stepDays = diffDays >= 7 ? 7 : 1;
          const cur = new Date(sD);
          while (cur <= eD) {
            const yyyy = cur.getFullYear();
            const mm = String(cur.getMonth() + 1).padStart(2, "0");
            const dd = String(cur.getDate()).padStart(2, "0");
            dateList.push(`${yyyy}-${mm}-${dd}`);
            cur.setDate(cur.getDate() + stepDays);
          }
        } else {
          if (sDateStr) dateList.push(sDateStr);
        }
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

  // Download template CSV
  const handleDownloadTemplate = () => {
    const csvHeader = "course_code,class_name,start_date,end_date,shift,room\n";
    const sampleRow = 'COMP1752,Lập trình hướng đối tượng,2026-10-05,2026-10-05,"1,2,3",Room 302\nCOMP1841,Lập trình Web 1,2026-10-06,2026-10-06,"4,5,6",Room 401\nMATH1179,Toán cho Khoa học máy tính,2026-10-07,2026-10-07,3,Room 405\nCOMP1843,Nguyên lý Bảo mật,2026-10-08,2026-10-08,"5,6,7,8",Room 201\n';
    const blob = new Blob(["\uFEFF" + csvHeader + sampleRow], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "Mau_Thoi_Khoa_Bieu_Greenwich.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Submit valid rows
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
      const res = await api.importClassSchedules({
        target_user_id: targetUserId ? parseInt(targetUserId) : currentUser.id,
        entries: validEntries,
      });

      alert(res.message || `Đã nhập thành công ${validEntries.length} buổi học!`);
      setParsedRows([]);
      setFileContent("");
      setFileName("");
      if (onSuccess) onSuccess();
      setActiveTab("list");
      fetchSavedSchedules(targetUserId);
    } catch (err) {
      alert("Lỗi khi import thời khóa biểu: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete single schedule
  const handleDeleteSchedule = async (id) => {
    if (!window.confirm("Bạn có chắc muốn xóa buổi học này không?")) return;
    try {
      await api.deleteClassSchedule(id);
      fetchSavedSchedules(listFilterUser);
      if (onSuccess) onSuccess();
    } catch (err) {
      alert(err.message);
    }
  };

  // Clear all schedules
  const handleClearAllSchedules = async () => {
    if (!window.confirm("⚠️ CẢNH BÁO: Bạn có chắc muốn XÓA TOÀN BỘ thời khóa biểu này không?")) return;
    try {
      const params = {};
      if (listFilterUser && listFilterUser !== "all") params.user_id = listFilterUser;
      await api.clearClassSchedules(params);
      fetchSavedSchedules(listFilterUser);
      if (onSuccess) onSuccess();
    } catch (err) {
      alert(err.message);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;
  const overlapCount = parsedRows.filter((r) => r.isValid && r.overlappingShifts.length > 0).length;

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{
          maxWidth: 920,
          width: "95%",
          maxHeight: "90vh",
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
                Thời Khóa Biểu & Lịch Học Cá Nhân (Class Schedule)
              </h3>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                Nhập lịch học chính khóa từ file CSV/Excel. Hệ thống sẽ tự động phát hiện ca trực trùng lịch, đánh vắng và trừ giờ KPI (81h) tương ứng.
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

        {/* Tab Controls */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
            padding: "0 24px",
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
            }}
          >
            <Upload size={16} /> <span>Import Thời Khóa Biểu (Excel/CSV)</span>
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
            }}
          >
            <Calendar size={16} /> <span>Thời Khóa Biểu Đã Lưu ({savedSchedules.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {activeTab === "import" && (
            <div>
              

              {/* Upload Dropzone / Actions */}
              <div
                style={{
                  border: "2px dashed #93c5fd",
                  borderRadius: 14,
                  padding: "24px 20px",
                  textAlign: "center",
                  background: "#eff6ff",
                  marginBottom: 16,
                }}
              >
                <Upload size={36} color="#2563eb" style={{ marginBottom: 8 }} />
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e3a8a" }}>
                  Tải lên File Thời Khóa Biểu (Excel .xlsx hoặc .csv)
                </h4>
                <p style={{ fontSize: 12, color: "#64748b", margin: "6px 0 16px" }}>
                  Cấu trúc file gồm 6 cột: <code>course_code</code>, <code>class_name</code>, <code>start_date</code>, <code>end_date</code>, <strong><code>shift</code> (1, 2, 3... hoặc Ca 1, Ca 2)</strong>, <code>room</code>
                </p>

                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <label
                    className="btn btn-primary btn-sm"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "8px 16px" }}
                  >
                    <Upload size={15} /> <span>Chọn File Từ Máy</span>
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
                    <Download size={15} /> <span>Tải Mẫu CSV Greenwich</span>
                  </button>


                </div>

                {fileName && (
                  <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: "#2563eb" }}>
                    📄 Đã tải: {fileName}
                  </div>
                )}
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
                      <span>⚡ Phát hiện <strong>{overlapCount}</strong> ca trực trùng lịch học. Khi xác nhận import, hệ thống sẽ tự động chuyển sang <strong>Vắng mặt</strong> và <strong>trừ giờ KPI</strong> tương ứng.</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
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
                      <span>{isSubmitting ? "Đang lưu..." : `Xác Nhận Import (${validCount} buổi)`}</span>
                    </button>
                  </div>

                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", maxHeight: 320, overflowY: "auto" }}>
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

                <div style={{ display: "flex", gap: 8 }}>
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
                  <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                    Hãy chuyển sang tab "Import Thời Khóa Biểu" để tải lên file thời khóa biểu từ trường.
                  </p>
                </div>
              ) : (
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                    <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      <tr>
                        <th style={{ padding: "10px 14px" }}>Môn Học</th>
                        <th style={{ padding: "10px 14px" }}>Sinh Viên / Nhân Sự</th>
                        <th style={{ padding: "10px 14px" }}>Ngày Học</th>
                        <th style={{ padding: "10px 14px" }}>Khung Giờ</th>
                        <th style={{ padding: "10px 14px" }}>Phòng</th>
                        <th style={{ padding: "10px 14px", textAlign: "right" }}>Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedSchedules.map((item) => (
                        <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px 14px" }}>
                            <div style={{ fontWeight: 700, color: "#0f172a" }}>
                              {item.course_code ? `${item.course_code} - ` : ""}
                              {item.class_name}
                            </div>
                          </td>
                          <td style={{ padding: "10px 14px", color: "#475569" }}>{item.user_name}</td>
                          <td style={{ padding: "10px 14px", fontWeight: 600 }}>{item.work_date}</td>
                          <td style={{ padding: "10px 14px", fontWeight: 700, color: "#2563eb" }}>
                            {item.start_time} - {item.end_time}
                          </td>
                          <td style={{ padding: "10px 14px" }}>{item.room || "-"}</td>
                          <td style={{ padding: "10px 14px", textAlign: "right" }}>
                            <button
                              onClick={() => handleDeleteSchedule(item.id)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: "4px 8px", color: "#dc2626" }}
                              title="Xóa buổi học này"
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
