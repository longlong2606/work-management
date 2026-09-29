import React, { useState, useMemo } from "react";
import { SHIFTS } from "../constants/shifts";
import { api } from "../services/api";
import {
  X, Upload, Download, CheckCircle2,
  RefreshCw, FileSpreadsheet
} from "lucide-react";

export function CsvScheduleModal({
  isOpen,
  onClose,
  allMembers = [],
  currentSchedule = [],
  weekDays = [],
  onImportSuccess,
  showToast
}) {
  const [activeTab, setActiveTab] = useState("import"); // "import" | "export"
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  // 1. Phân tích nội dung CSV (Parser)
  const parseCsvContent = (content) => {
    if (!content || !content.trim()) {
      setParsedRows([]);
      return;
    }

    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      setParsedRows([]);
      return;
    }

    // Detect delimiter (, or ; or \t)
    const headerLine = lines[0];
    const delimiter = headerLine.includes(";") ? ";" : headerLine.includes("\t") ? "\t" : ",";

    const cleanField = (f) => (f || "").trim().replace(/^["']|["']$/g, "").trim();

    const headers = headerLine.split(delimiter).map(cleanField).map((h) => h.toLowerCase());

    const getColIdx = (aliases) => headers.findIndex((h) => aliases.some((a) => h.includes(a)));

    const dateIdx = getColIdx(["ngay", "date", "work_date"]);
    const shiftIdx = getColIdx(["ca", "shift", "ca_truc", "shift_id"]);
    const userIdx = getColIdx(["ma_nhan_su", "username", "mssv", "ma_nv", "user"]);
    const nameIdx = getColIdx(["ho_ten", "name", "full_name", "ten"]);
    const statusIdx = getColIdx(["trang_thai", "status", "attendance", "absent"]);
    const noteIdx = getColIdx(["ghi_chu", "note", "reason", "ly_do"]);

    const results = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map(cleanField);
      if (!cols.some((c) => c)) continue;

      const dateRaw = dateIdx >= 0 ? cols[dateIdx] : cols[0];
      const shiftRaw = shiftIdx >= 0 ? cols[shiftIdx] : cols[1];
      const userRaw = userIdx >= 0 ? cols[userIdx] : (nameIdx >= 0 ? "" : cols[2]);
      const nameRaw = nameIdx >= 0 ? cols[nameIdx] : (cols[3] || "");
      const statusRaw = statusIdx >= 0 ? cols[statusIdx] : (cols[4] || "present");
      const noteRaw = noteIdx >= 0 ? cols[noteIdx] : (cols[5] || "");

      // Chuẩn hóa ngày (YYYY-MM-DD hoặc DD/MM/YYYY)
      let formattedDate = "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
        formattedDate = dateRaw;
      } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateRaw)) {
        const [d, m, y] = dateRaw.split("/");
        formattedDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }

      // Chuẩn hóa Ca trực (1 -> 9)
      let shiftId = null;
      const shiftMatch = (shiftRaw || "").match(/\d+/);
      if (shiftMatch) {
        const num = parseInt(shiftMatch[0], 10);
        if (num >= 1 && num <= 9) shiftId = num;
      }

      // Khớp nhân sự từ allMembers
      let matchedUser = null;
      const uQuery = (userRaw || "").toLowerCase();
      const nQuery = (nameRaw || "").toLowerCase();

      if (uQuery) {
        matchedUser = allMembers.find(
          (m) =>
            (m.username || "").toLowerCase() === uQuery ||
            (m.email || "").toLowerCase() === uQuery ||
            String(m.id) === uQuery
        );
      }
      if (!matchedUser && nQuery) {
        matchedUser = allMembers.find(
          (m) => (m.full_name || "").toLowerCase() === nQuery
        );
      }

      // Trạng thái (Có mặt / Báo vắng)
      const stLower = (statusRaw || "").toLowerCase();
      const isAbsent =
        stLower.includes("absent") ||
        stLower.includes("vang") ||
        stLower.includes("vắng") ||
        stLower === "off" ||
        stLower === "0";

      // Kiểm tra tính hợp lệ
      const errors = [];
      if (!formattedDate) errors.push("Ngày không đúng định dạng (YYYY-MM-DD)");
      if (!shiftId) errors.push("Ca trực không hợp lệ (1-9)");
      if (!matchedUser) errors.push(`Không tìm thấy nhân sự (${userRaw || nameRaw || "Trống"})`);

      results.push({
        rowNum: i + 1,
        workDate: formattedDate,
        shiftId,
        shiftName: shiftId ? `Ca ${shiftId}` : shiftRaw,
        userIdentifier: userRaw || nameRaw,
        user: matchedUser,
        attendanceStatus: isAbsent ? "absent" : "present",
        note: noteRaw,
        isValid: errors.length === 0,
        errors
      });
    }

    setParsedRows(results);
  };

  // Đọc file khi user tải lên
  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target.result;
      parseCsvContent(content);
    };
    reader.readAsText(selectedFile, "UTF-8");
  };

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = parsedRows.length;
    const valid = parsedRows.filter((r) => r.isValid).length;
    const absent = parsedRows.filter((r) => r.isValid && r.attendanceStatus === "absent").length;
    const present = valid - absent;
    const invalid = total - valid;
    return { total, valid, present, absent, invalid };
  }, [parsedRows]);

  if (!isOpen) return null;

  // 2. Tải CSV Mẫu
  const handleDownloadSample = () => {
    const sampleHeaders = "ngay,ca_truc,ma_nhan_su,ho_ten,trang_thai,ghi_chu\n";
    const sampleRows = [
      "2026-09-29,1,an.nv,Nguyễn Văn An,present,Trực chính",
      "2026-09-29,Ca 2,duc.pm,Phạm Minh Đức,absent,Báo ốm sốt xuất huyết",
      "2026-09-30,3,em.ht,Hoàng Thị Em,present,",
      "2026-10-01,Ca 4,linh.dt,Đỗ Thùy Linh,present,",
      "2026-10-02,5,tuan.tv,Trần Văn Tuấn,absent,Bận lịch thi học kỳ"
    ].join("\n");

    const blob = new Blob(["\uFEFF" + sampleHeaders + sampleRows], {
      type: "text/csv;charset=utf-8;"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mau_nhap_lich_truc_work_management.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 3. Xuất CSV Lịch Tuần Hiện Tại
  const handleExportCurrentWeek = () => {
    if (!currentSchedule || currentSchedule.length === 0) {
      if (showToast) showToast("Không có dữ liệu ca trực tuần này để xuất!", "warning");
      return;
    }

    const headers = "ngay,ca_truc,gio_bat_dau,gio_ket_thuc,ma_nhan_su,ho_ten,trang_thai,ghi_chu\n";
    const rows = currentSchedule.map((s) => {
      const shiftObj = SHIFTS.find((sh) => sh.id === s.shift_id) || {};
      const statusText = s.attendance_status === "absent" ? "Vắng mặt" : "Có mặt";
      return [
        s.work_date || "",
        `Ca ${s.shift_id}`,
        shiftObj.startTime || "",
        shiftObj.endTime || "",
        s.username || "",
        `"${(s.full_name || s.user_full_name || "").replace(/"/g, '""')}"`,
        statusText,
        `"${(s.note || s.absence_reason || "").replace(/"/g, '""')}"`
      ].join(",");
    }).join("\n");

    const blob = new Blob(["\uFEFF" + headers + rows], {
      type: "text/csv;charset=utf-8;"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lich_truc_tuan_${weekDays[0]?.dateStr || "current"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (showToast) showToast("Đã xuất file lịch tuần thành công!", "success");
  };

  // 4. Thực thi nạp vào hệ thống
  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      if (showToast) showToast("Không có dòng hợp lệ nào để nạp!", "danger");
      return;
    }

    setIsProcessing(true);
    setImportProgress({ current: 0, total: validRows.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      setImportProgress({ current: i + 1, total: validRows.length });

      try {
        const regRes = await api.registerShift(
          row.shiftId,
          row.workDate,
          row.note,
          row.user.id
        );

        if (row.attendanceStatus === "absent") {
          const regId = regRes?.registration?.id || regRes?.id;
          await api.reportAbsence({
            registration_id: regId,
            shift_id: row.shiftId,
            work_date: row.workDate,
            reason: row.note || "Báo vắng qua file CSV",
            user_id: row.user.id
          });
        }

        successCount++;
      } catch (_err) {
        failCount++;
      }
    }

    setIsProcessing(false);

    if (onImportSuccess) {
      onImportSuccess();
    }

    if (showToast) {
      if (failCount === 0) {
        showToast(`Đã nạp thành công ${successCount} ca trực từ file CSV!`, "success");
      } else {
        showToast(`Nạp xong: ${successCount} thành công, ${failCount} thất bại.`, "warning");
      }
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 820,
          maxHeight: "90vh",
          backgroundColor: "#ffffff",
          borderRadius: 20,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            background: "linear-gradient(135deg, #1e40af, #3b82f6)",
            color: "#ffffff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: "rgba(255, 255, 255, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <FileSpreadsheet size={24} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                Quản Lý Ca Trực Qua CSV / Excel
              </h3>
              <div style={{ fontSize: 13, color: "#dbeafe", marginTop: 2 }}>
                Tải mẫu, nhập lịch phân ca & báo vắng hàng loạt hoặc xuất báo cáo tuần
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              border: "none",
              color: "#ffffff",
              width: 36,
              height: 36,
              borderRadius: "50%",
              cursor: isProcessing ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Action Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
            padding: "0 24px"
          }}
        >
          <button
            onClick={() => setActiveTab("import")}
            style={{
              padding: "12px 18px",
              border: "none",
              background: "transparent",
              borderBottom: activeTab === "import" ? "3px solid #2563eb" : "3px solid transparent",
              color: activeTab === "import" ? "#2563eb" : "#64748b",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8
            }}
          >
            <Upload size={16} /> Nhập Lịch / Báo Vắng (Import CSV)
          </button>

          <button
            onClick={() => setActiveTab("export")}
            style={{
              padding: "12px 18px",
              border: "none",
              background: "transparent",
              borderBottom: activeTab === "export" ? "3px solid #2563eb" : "3px solid transparent",
              color: activeTab === "export" ? "#2563eb" : "#64748b",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8
            }}
          >
            <Download size={16} /> Xuất Báo Cáo Tuần (Export CSV)
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
          {activeTab === "import" ? (
            <div>
              {/* Box hướng dẫn & Nút tải mẫu */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: 14,
                  padding: "14px 18px",
                  marginBottom: 20
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1e40af" }}>
                    Chưa có file mẫu chuẩn?
                  </div>
                  <div style={{ fontSize: 12, color: "#3b82f6", marginTop: 2 }}>
                    Tải mẫu CSV chuẩn (chứa sẵn cột Ngày, Ca 1-9, Mã nhân sự, Trạng thái vắng).
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadSample}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    background: "#ffffff",
                    border: "1.5px solid #2563eb",
                    color: "#2563eb",
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(37, 99, 235, 0.1)"
                  }}
                >
                  <Download size={15} /> Tải CSV Mẫu
                </button>
              </div>

              {/* Upload Drop Zone */}
              <div
                style={{
                  border: "2px dashed #cbd5e1",
                  borderRadius: 16,
                  padding: 24,
                  textAlign: "center",
                  background: "#f8fafc",
                  cursor: "pointer",
                  marginBottom: 20,
                  position: "relative"
                }}
              >
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileChange}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0,
                    cursor: "pointer"
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: "50%",
                      background: "#e0e7ff",
                      color: "#4f46e5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Upload size={24} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>
                    {file ? file.name : "Kéo thả file CSV vào đây hoặc click để chọn"}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Hỗ trợ định dạng .csv chuẩn UTF-8 (phân tách bởi dấu phẩy hoặc chấm phẩy)
                  </div>
                </div>
              </div>

              {/* Thống kê sau khi đọc file */}
              {parsedRows.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                    <div
                      style={{
                        flex: 1,
                        background: "#f1f5f9",
                        borderRadius: 12,
                        padding: "10px 14px",
                        textAlign: "center"
                      }}
                    >
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>TỔNG SỐ DÒNG</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>{stats.total}</div>
                    </div>
                    <div
                      style={{
                        flex: 1,
                        background: "#ecfdf5",
                        border: "1px solid #a7f3d0",
                        borderRadius: 12,
                        padding: "10px 14px",
                        textAlign: "center"
                      }}
                    >
                      <div style={{ fontSize: 11, color: "#059669", fontWeight: 700 }}>HỢP LỆ</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "#059669" }}>{stats.valid}</div>
                    </div>
                    <div
                      style={{
                        flex: 1,
                        background: "#eff6ff",
                        border: "1px solid #bfdbfe",
                        borderRadius: 12,
                        padding: "10px 14px",
                        textAlign: "center"
                      }}
                    >
                      <div style={{ fontSize: 11, color: "#2563eb", fontWeight: 700 }}>CÓ MẶT</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "#2563eb" }}>{stats.present}</div>
                    </div>
                    <div
                      style={{
                        flex: 1,
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        borderRadius: 12,
                        padding: "10px 14px",
                        textAlign: "center"
                      }}
                    >
                      <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 700 }}>BÁO VẮNG</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "#dc2626" }}>{stats.absent}</div>
                    </div>
                    {stats.invalid > 0 && (
                      <div
                        style={{
                          flex: 1,
                          background: "#fffbeb",
                          border: "1px solid #fde68a",
                          borderRadius: 12,
                          padding: "10px 14px",
                          textAlign: "center"
                        }}
                      >
                        <div style={{ fontSize: 11, color: "#d97706", fontWeight: 700 }}>CẦN KIỂM TRA</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: "#d97706" }}>{stats.invalid}</div>
                      </div>
                    )}
                  </div>

                  {/* Bảng xem trước (Preview) */}
                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      overflow: "hidden",
                      maxHeight: 240,
                      overflowY: "auto"
                    }}
                  >
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead style={{ background: "#f8fafc", position: "sticky", top: 0 }}>
                        <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#475569" }}>
                          <th style={{ padding: "8px 12px" }}>Dòng</th>
                          <th style={{ padding: "8px 12px" }}>Ngày</th>
                          <th style={{ padding: "8px 12px" }}>Ca</th>
                          <th style={{ padding: "8px 12px" }}>Nhân sự khớp</th>
                          <th style={{ padding: "8px 12px" }}>Trạng thái</th>
                          <th style={{ padding: "8px 12px" }}>Ghi chú</th>
                          <th style={{ padding: "8px 12px" }}>Kiểm tra</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.map((r, idx) => (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: "1px solid #f1f5f9",
                              background: !r.isValid ? "#fff1f2" : r.attendanceStatus === "absent" ? "#fffbeb" : "#ffffff"
                            }}
                          >
                            <td style={{ padding: "8px 12px", color: "#64748b" }}>#{r.rowNum}</td>
                            <td style={{ padding: "8px 12px", fontWeight: 600 }}>{r.workDate || "—"}</td>
                            <td style={{ padding: "8px 12px" }}>
                              <span
                                style={{
                                  background: "#f1f5f9",
                                  padding: "2px 8px",
                                  borderRadius: 12,
                                  fontWeight: 700,
                                  fontSize: 11
                                }}
                              >
                                {r.shiftName}
                              </span>
                            </td>
                            <td style={{ padding: "8px 12px", fontWeight: 600, color: r.user ? "#0f172a" : "#dc2626" }}>
                              {r.user ? r.user.full_name || r.user.username : r.userIdentifier || "Chưa khớp"}
                            </td>
                            <td style={{ padding: "8px 12px" }}>
                              {r.attendanceStatus === "absent" ? (
                                <span style={{ color: "#dc2626", fontWeight: 700, fontSize: 12 }}>⚠️ Vắng</span>
                              ) : (
                                <span style={{ color: "#16a34a", fontWeight: 700, fontSize: 12 }}>✓ Có mặt</span>
                              )}
                            </td>
                            <td style={{ padding: "8px 12px", color: "#64748b", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {r.note || "—"}
                            </td>
                            <td style={{ padding: "8px 12px" }}>
                              {r.isValid ? (
                                <span style={{ color: "#16a34a", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                                  <CheckCircle2 size={14} /> OK
                                </span>
                              ) : (
                                <span
                                  style={{ color: "#dc2626", fontSize: 11, fontWeight: 600 }}
                                  title={r.errors.join("; ")}
                                >
                                  ❌ {r.errors[0]}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Progress bar khi đang import */}
              {isProcessing && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    <span>Đang nạp ca trực vào hệ thống...</span>
                    <span>{importProgress.current} / {importProgress.total}</span>
                  </div>
                  <div style={{ width: "100%", height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        background: "linear-gradient(90deg, #3b82f6, #10b981)",
                        width: `${(importProgress.current / importProgress.total) * 100}%`,
                        transition: "width 0.2s"
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* TAB EXPORT */
            <div style={{ textAlign: "center", padding: "30px 20px" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "#eff6ff",
                  color: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px"
                }}
              >
                <Download size={32} />
              </div>

              <h4 style={{ fontSize: 18, fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>
                Xuất Báo Cáo Lịch Tuần Đang Xem
              </h4>
              <p style={{ color: "#64748b", fontSize: 14, maxWidth: 500, margin: "0 auto 24px" }}>
                Hệ thống sẽ tổng hợp toàn bộ các ca trực từ Thứ 2 đến Thứ 7 ({weekDays[0]?.displayDate} - {weekDays[weekDays.length - 1]?.displayDate}) kèm danh sách nhân sự trực và báo vắng ra file CSV/Excel UTF-8.
              </p>

              <button
                type="button"
                onClick={handleExportCurrentWeek}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 28px",
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)"
                }}
              >
                <Download size={18} /> Xuất File CSV Tuần Này
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "16px 24px",
            background: "#f8fafc",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            style={{
              padding: "10px 20px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 10,
              fontWeight: 600,
              color: "#475569",
              cursor: isProcessing ? "not-allowed" : "pointer"
            }}
          >
            Đóng
          </button>

          {activeTab === "import" && (
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={isProcessing || stats.valid === 0}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 24px",
                background: stats.valid === 0 ? "#94a3b8" : "#16a34a",
                color: "#ffffff",
                border: "none",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 14,
                cursor: isProcessing || stats.valid === 0 ? "not-allowed" : "pointer",
                boxShadow: stats.valid > 0 ? "0 4px 12px rgba(22, 163, 74, 0.25)" : "none"
              }}
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={16} className="spin-animation" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  Xác Nhận Nạp {stats.valid} Ca Vào Lịch
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
