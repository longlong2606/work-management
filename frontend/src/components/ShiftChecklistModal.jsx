import React, { useState, useEffect } from "react";
import { SHIFTS } from "../constants/shifts";
import {
  X, CheckSquare, Square, Plus, Trash2
} from "lucide-react";

export function ShiftChecklistModal({
  isOpen,
  onClose,
  initialShiftId = 1,
  initialDate = "",
  showToast
}) {
  const [selectedShiftId, setSelectedShiftId] = useState(initialShiftId || 1);
  const [selectedDate, setSelectedDate] = useState(
    () => initialDate || new Date().toISOString().split("T")[0]
  );
  const [tasks, setTasks] = useState([]);
  const [newTaskText, setNewTaskText] = useState("");

  const currentShift = SHIFTS.find((s) => s.id === Number(selectedShiftId)) || SHIFTS[0];

  // Key lưu trữ trong localStorage
  const storageKey = `wm_shift_checklist_${selectedDate}_${selectedShiftId}`;

  // Default tasks cho các ca
  const getDefaultTasks = (shiftId) => {
    if (shiftId <= 3) {
      return [
        { id: 1, text: "Mở cửa phòng Lab & kiểm tra khóa từ", completed: false },
        { id: 2, text: "Bật hệ thống đèn chiếu sáng & điều hòa 24-26°C", completed: false },
        { id: 3, text: "Khởi động cụm máy chủ & kiểm tra màn hình Kiosk TV", completed: false },
        { id: 4, text: "Điểm danh thiết bị thí nghiệm đầu ngày", completed: false },
      ];
    } else if (shiftId <= 6) {
      return [
        { id: 1, text: "Tiếp nhận bàn giao ca sáng & kiểm tra vệ sinh", completed: false },
        { id: 2, text: "Giám sát hỗ trợ sinh viên thực hành tại chỗ", completed: false },
        { id: 3, text: "Kiểm tra nhiệt độ phòng máy chủ server", completed: false },
        { id: 4, text: "Ghi nhận sổ nhật ký thiết bị ca chiều", completed: false },
      ];
    } else {
      return [
        { id: 1, text: "Nhắc nhở thành viên thu dọn đồ dùng cá nhân", completed: false },
        { id: 2, text: "Thu hồi toàn bộ thiết bị thí nghiệm đã mượn", completed: false },
        { id: 3, text: "Tắt điều hòa, ngắt điện cụm máy tính sinh viên", completed: false },
        { id: 4, text: "Khóa cửa phòng Lab & bàn giao bảo vệ trực đêm", completed: false },
      ];
    }
  };

  // Load tasks từ localStorage hoặc default
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setTasks(JSON.parse(saved));
      } else {
        setTasks(getDefaultTasks(Number(selectedShiftId)));
      }
    } catch {
      setTasks(getDefaultTasks(Number(selectedShiftId)));
    }
  }, [storageKey, selectedShiftId]);

  if (!isOpen) return null;

  // Toggle hoàn thành task
  const handleToggleTask = (taskId) => {
    const updated = tasks.map((t) =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    setTasks(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  // Thêm task mới
  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    const newTask = {
      id: Date.now(),
      text: newTaskText.trim(),
      completed: false,
    };
    const updated = [...tasks, newTask];
    setTasks(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setNewTaskText("");
    if (showToast) showToast("Đã thêm nhiệm vụ mới vào ca trực!", "success");
  };

  // Xóa task
  const handleDeleteTask = (taskId) => {
    const updated = tasks.filter((t) => t.id !== taskId);
    setTasks(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const allCompleted = tasks.length > 0 && completedCount === tasks.length;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(6px)",
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
          maxWidth: 620,
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
            background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
            color: "#ffffff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "rgba(255, 255, 255, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <CheckSquare size={22} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                Nhiệm Vụ & Checklist Ca Trực
              </h3>
              <div style={{ fontSize: 13, color: "#e0e7ff", marginTop: 2 }}>
                Đầu việc cần làm của thành viên trực {currentShift.name} ({currentShift.label})
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              border: "none",
              color: "#ffffff",
              width: 36,
              height: 36,
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Date & Shift Selectors */}
        <div
          style={{
            padding: "14px 24px",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            gap: 12,
            alignItems: "center"
          }}
        >
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Ngày trực
            </label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ marginTop: 2, borderRadius: 8 }}
            />
          </div>

          <div style={{ flex: 1.5 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Ca làm việc (1 - 9)
            </label>
            <select
              className="form-select form-select-sm"
              value={selectedShiftId}
              onChange={(e) => setSelectedShiftId(Number(e.target.value))}
              style={{ marginTop: 2, borderRadius: 8, fontWeight: 600 }}
            >
              {SHIFTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.label})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ padding: "12px 24px 0", background: "#ffffff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
            <span style={{ color: allCompleted ? "#059669" : "#475569" }}>
              {allCompleted ? "🎉 Đã hoàn thành toàn bộ nhiệm vụ ca!" : `Tiến độ hoàn thành: ${completedCount} / ${tasks.length} mục`}
            </span>
            <span style={{ color: allCompleted ? "#059669" : "#4f46e5" }}>
              {progressPercent}%
            </span>
          </div>

          <div style={{ width: "100%", height: 7, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${progressPercent}%`,
                background: allCompleted
                  ? "linear-gradient(90deg, #10b981, #059669)"
                  : "linear-gradient(90deg, #6366f1, #4f46e5)",
                transition: "width 0.2s"
              }}
            />
          </div>
        </div>

        {/* Task List */}
        <div style={{ padding: "16px 24px", overflowY: "auto", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => handleToggleTask(task.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: task.completed ? "#f0fdf4" : "#ffffff",
                  border: task.completed ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                  cursor: "pointer",
                  transition: "all 0.15s"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                  <div style={{ color: task.completed ? "#16a34a" : "#94a3b8", display: "flex", alignItems: "center" }}>
                    {task.completed ? <CheckSquare size={18} /> : <Square size={18} />}
                  </div>
                  <span
                    style={{
                      fontSize: 14,
                      color: task.completed ? "#15803d" : "#1e293b",
                      textDecoration: task.completed ? "line-through" : "none",
                      fontWeight: task.completed ? 500 : 600
                    }}
                  >
                    {task.text}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTask(task.id);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: 4
                  }}
                  title="Xóa đầu việc này"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          {/* Form thêm task mới */}
          <form onSubmit={handleAddTask} style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="+ Thêm đầu việc cần làm khác cho ca này..."
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              style={{ borderRadius: 8 }}
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              style={{ borderRadius: 8, padding: "6px 14px", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}
            >
              <Plus size={15} /> Thêm
            </button>
          </form>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 24px",
            background: "#f8fafc",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div style={{ fontSize: 11, color: "#64748b" }}>
            * Checklist được tự động lưu theo từng ngày và từng ca.
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 20px",
              background: "#4f46e5",
              color: "#ffffff",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer"
            }}
          >
            Hoàn tất
          </button>
        </div>
      </div>
    </div>
  );
}
