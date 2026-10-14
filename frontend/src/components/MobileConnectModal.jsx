import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import {
  Smartphone,
  X,
  Copy,
  Check,
  Wifi,
  Globe,
  Sparkles,
  ExternalLink
} from "lucide-react";

export function MobileConnectModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  // 2 chế độ: "tunnel" (Khuyên dùng - 4G/5G/Mọi nơi) hoặc "lan" (Cùng Wi-Fi)
  const [connectMode, setConnectMode] = useState("tunnel");
  
  // Public Tunnel URL do cloudflared tạo
  const TUNNEL_URL = "https://visibility-skip-receives-criterion.trycloudflare.com";
  
  // Địa chỉ LAN Wi-Fi thực tế
  const LAN_IP = "192.168.1.161";
  const [ipAddress, setIpAddress] = useState(LAN_IP);
  const [port, setPort] = useState(typeof window !== "undefined" ? (window.location.port || "5173") : "5173");
  
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const activeUrl = connectMode === "tunnel" ? TUNNEL_URL : `http://${ipAddress}:${port}`;

  useEffect(() => {
    QRCode.toDataURL(activeUrl, {
      width: 230,
      margin: 1.5,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("QR Code error:", err));
  }, [activeUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeUrl).then(() => {
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
          maxWidth: 490,
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
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
                Mở & Chạy Trên Điện Thoại
              </h3>
              <p style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                Quét mã QR bằng Camera điện thoại hoặc truy cập link
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

        {/* Mode Selector Tabs */}
        <div
          style={{
            display: "flex",
            background: "#f1f5f9",
            borderRadius: 10,
            padding: 3,
            marginBottom: 14,
          }}
        >
          <button
            onClick={() => setConnectMode("tunnel")}
            style={{
              flex: 1,
              padding: "7px 10px",
              borderRadius: 8,
              border: "none",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              background: connectMode === "tunnel" ? "#ffffff" : "transparent",
              color: connectMode === "tunnel" ? "#2563eb" : "#64748b",
              boxShadow: connectMode === "tunnel" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            <Globe size={14} color={connectMode === "tunnel" ? "#2563eb" : "#64748b"} />
            <span>Link Online (4G / 5G / Wi-Fi)</span>
          </button>

          <button
            onClick={() => setConnectMode("lan")}
            style={{
              flex: 1,
              padding: "7px 10px",
              borderRadius: 8,
              border: "none",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              background: connectMode === "lan" ? "#ffffff" : "transparent",
              color: connectMode === "lan" ? "#2563eb" : "#64748b",
              boxShadow: connectMode === "lan" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            <Wifi size={14} color={connectMode === "lan" ? "#2563eb" : "#64748b"} />
            <span>Mạng Wi-Fi Nội Bộ (LAN)</span>
          </button>
        </div>

        {/* QR Code Container */}
        <div
          style={{
            background: "#f8fafc",
            borderRadius: 16,
            border: "1.5px dashed #cbd5e1",
            padding: "16px 14px",
            textAlign: "center",
            marginBottom: 14,
          }}
        >
          {qrDataUrl ? (
            <div style={{ display: "inline-block", padding: 8, background: "#ffffff", borderRadius: 14, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
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

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10, color: "#64748b", fontSize: 12 }}>
            {connectMode === "tunnel" ? (
              <>
                <Globe size={14} color="#059669" />
                <span style={{ color: "#059669", fontWeight: 700 }}>HTTPS Cloudflare bảo mật - Mở được trên mọi mạng di động</span>
              </>
            ) : (
              <>
                <Wifi size={14} color="#2563eb" />
                <span>Yêu cầu điện thoại kết nối cùng Wi-Fi với máy tính ({LAN_IP})</span>
              </>
            )}
          </div>
        </div>

        {/* URL Link Box */}
        <div style={{ marginBottom: 12 }}>
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
            <span style={{ flex: 1, fontFamily: "monospace", fontSize: 12.5, fontWeight: 700, color: "#2563eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={activeUrl}>
              {activeUrl}
            </span>
            <button
              onClick={handleCopy}
              className="btn btn-sm btn-primary"
              style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? "Đã chép!" : "Sao chép"}</span>
            </button>
            <a
              href={activeUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-sm btn-secondary"
              style={{ padding: "6px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 3 }}
              title="Mở tab mới"
            >
              <ExternalLink size={13} />
            </a>
          </div>
        </div>

        {/* Instructions list */}
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 12,
            padding: "10px 12px",
            fontSize: 12,
            color: "#1e40af",
            lineHeight: 1.45,
          }}
        >
          <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Sparkles size={14} color="#2563eb" />
            <span>Trải nghiệm Native Mobile Web:</span>
          </div>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li>Thanh điều hướng bo tròn dưới đáy màn hình (Bottom Bar) thao tác 1 tay cực kỳ tiện lợi.</li>
            <li>Đầy đủ: Xem lịch 9 ca, nhận việc, chấm năng lực radar tam giác, đổi mật khẩu.</li>
            <li>Bấm <em>"Thêm vào Màn hình chính" (Add to Home Screen)</em> trên Safari/Chrome để hiển thị toàn màn hình như App.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
