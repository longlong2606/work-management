import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import {
  Smartphone,
  X,
  Copy,
  Check,
  Wifi,
  Sparkles
} from "lucide-react";

export function MobileConnectModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  // Xác định host LAN: nếu đang trên localhost thì lấy IP Wi-Fi thực tế 192.168.123.49
  const currentHost = typeof window !== "undefined" ? window.location.hostname : "192.168.123.49";
  const defaultIp = (currentHost === "localhost" || currentHost === "127.0.0.1")
    ? "192.168.123.49"
    : currentHost;

  const [ipAddress, setIpAddress] = useState(defaultIp);
  const [port, setPort] = useState(typeof window !== "undefined" ? (window.location.port || "5173") : "5173");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const fullUrl = `http://${ipAddress}:${port}`;

  useEffect(() => {
    QRCode.toDataURL(fullUrl, {
      width: 220,
      margin: 1.5,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("QR Code error:", err));
  }, [fullUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="glass-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 480,
          width: "100%",
          padding: "24px 22px",
          borderRadius: 20,
          background: "#ffffff",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          position: "relative",
          animation: "fadeIn 0.2s ease-out",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
              }}
            >
              <Smartphone size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}>
                Mở & Thao Tác Trên Điện Thoại
              </h3>
              <p style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                Quét mã QR để mở trang web trực tiếp trên điện thoại
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748b",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* QR Code Container */}
        <div
          style={{
            background: "#f8fafc",
            borderRadius: 16,
            border: "1.5px dashed #cbd5e1",
            padding: "18px 16px",
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          {qrDataUrl ? (
            <div style={{ display: "inline-block", padding: 8, background: "#ffffff", borderRadius: 14, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
              <img
                src={qrDataUrl}
                alt="QR Code"
                style={{ width: 190, height: 190, display: "block", borderRadius: 8 }}
              />
            </div>
          ) : (
            <div style={{ height: 190, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
              Đang tạo mã QR...
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, color: "#059669", fontSize: 12, fontWeight: 700 }}>
            <Wifi size={14} />
            <span>Kết nối điện thoại vào cùng mạng Wi-Fi với máy tính</span>
          </div>
        </div>

        {/* URL Link Box */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6, display: "block" }}>
            Địa chỉ mạng nội bộ (mở bằng Safari / Chrome / Zalo):
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#f1f5f9",
              borderRadius: 10,
              padding: "6px 8px 6px 12px",
              border: "1px solid #cbd5e1",
            }}
          >
            <span style={{ flex: 1, fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: "#2563eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {fullUrl}
            </span>
            <button
              onClick={handleCopy}
              className="btn btn-sm btn-primary"
              style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? "Đã chép!" : "Sao chép"}</span>
            </button>
          </div>
        </div>

        {/* IP Config toggler for advanced setup */}
        <details style={{ marginBottom: 14, fontSize: 12, color: "#64748b" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, color: "#475569" }}>
            Tùy chỉnh địa chỉ IP nếu đổi Wi-Fi
          </summary>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <input
              type="text"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              placeholder="Nhập IP Wi-Fi (ví dụ: 192.168.1.50)"
              className="form-control"
              style={{ fontSize: 12, padding: "6px 10px" }}
            />
          </div>
        </details>

        {/* Instructions list */}
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 12,
            padding: "12px 14px",
            fontSize: 12,
            color: "#1e40af",
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Sparkles size={14} color="#2563eb" />
            <span>Đã tối ưu giao diện hoàn chỉnh cho điện thoại:</span>
          </div>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li><strong>Thanh điều hướng dưới cùng (Bottom Bar)</strong> giúp chuyển nhanh Lịch ca, Nhiệm vụ, Ghi chú, Góp ý bằng ngón cái.</li>
            <li>Báo vắng, xem KPI, nhận việc và duyệt dự án trực tiếp bằng cảm ứng.</li>
            <li>Chọn <em>"Thêm vào Màn hình chính" (Add to Home Screen)</em> trên Safari/Chrome để dùng toàn màn hình như ứng dụng App.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
