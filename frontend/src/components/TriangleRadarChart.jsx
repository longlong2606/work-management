import React from "react";

// Helper to determine rank tier from a 0-10 or 0-100 score
export function getRankTier(score) {
  const s = score > 10 ? score / 10 : Number(score) || 0;
  if (s >= 8.5) {
    return {
      rank: "S",
      title: "Master (Xuất sắc)",
      desc: "Chuyên sâu, có thể dẫn dắt & đào tạo người khác",
      color: "#f59e0b",
      glow: "rgba(245, 158, 11, 0.45)",
      bg: "#fef3c7",
      border: "#fbbf24",
      textColor: "#92400e"
    };
  }
  if (s >= 7.0) {
    return {
      rank: "A",
      title: "Expert (Giỏi)",
      desc: "Làm việc độc lập, ổn định và hiệu quả cao",
      color: "#8b5cf6",
      glow: "rgba(139, 92, 246, 0.45)",
      bg: "#f5f3ff",
      border: "#c4b5fd",
      textColor: "#5b21b6"
    };
  }
  if (s >= 5.0) {
    return {
      rank: "B",
      title: "Competent (Khá)",
      desc: "Nền tảng tốt, hoàn thành ổn định các nhiệm vụ",
      color: "#10b981",
      glow: "rgba(16, 185, 129, 0.45)",
      bg: "#ecfdf5",
      border: "#6ee7b7",
      textColor: "#065f46"
    };
  }
  if (s >= 3.5) {
    return {
      rank: "C",
      title: "Developing (Đang phát triển)",
      desc: "Cần hỗ trợ, hướng dẫn ở các tác vụ phức tạp",
      color: "#f97316",
      glow: "rgba(249, 115, 22, 0.45)",
      bg: "#fff7ed",
      border: "#fdba74",
      textColor: "#9a3412"
    };
  }
  return {
    rank: "D",
    title: "Beginner (Cần hướng dẫn)",
    desc: "Cần kèm cặp và hướng dẫn sát trong công việc",
    color: "#ef4444",
    glow: "rgba(239, 68, 68, 0.45)",
    bg: "#fef2f2",
    border: "#fca5a5",
    textColor: "#991b1b"
  };
}

export function TriangleRadarChart({
  group1Score = 7.2, // Nhóm 1: Quản lý & Đối ngoại (0 - 10)
  group2Score = 7.7, // Nhóm 2: Kỹ thuật & Hệ thống (0 - 10)
  group3Score = 8.2, // Nhóm 3: Research & AI (0 - 10)
  compareData = null, // Optional comparison member { group1Score, group2Score, group3Score, name, color }
  memberName = "Thành viên",
  role = "Research Lead",
  size = 480,
  interactive = true,
  activeGroup = null,
  onGroupClick = null,
}) {
  // Center coordinates in a 580x520 viewBox for generous breathing room
  const cx = 290;
  const cy = 250;

  // Radii
  const rOuter = 205; // Outer decorative tech ring
  const rTrack = 188; // Radar orbit track
  const rInner = 168; // Inner circle boundary
  const maxR = 142;   // Maximum radius of concentric triangle (100% / 10 points)

  // 3 Angles (radians)
  // Vertex 0: Top (Management & PM) -> -90 deg (-pi/2)
  // Vertex 1: Bottom Right (Engineering & System) -> 30 deg (pi/6)
  // Vertex 2: Bottom Left (Research & AI) -> 150 deg (5pi/6)
  const angles = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];

  // Helper to calculate (x, y) given angle and radius
  const getPoint = (angle, radius) => [
    cx + radius * Math.cos(angle),
    cy + radius * Math.sin(angle)
  ];

  // Concentric levels: 20%, 40%, 60%, 80%, 100%
  const levels = [0.2, 0.4, 0.6, 0.8, 1.0];

  const getLevelPolygon = (fraction) => {
    return angles
      .map((angle) => {
        const [x, y] = getPoint(angle, maxR * fraction);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };

  // Convert scores (0 - 10) to radius
  const clampScore = (sc) => Math.min(10, Math.max(0, Number(sc) || 0));
  const s1 = clampScore(group1Score);
  const s2 = clampScore(group2Score);
  const s3 = clampScore(group3Score);

  const p1 = getPoint(angles[0], (s1 / 10) * maxR);
  const p2 = getPoint(angles[1], (s2 / 10) * maxR);
  const p3 = getPoint(angles[2], (s3 / 10) * maxR);
  const dataPolygon = `${p1[0].toFixed(1)},${p1[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)} ${p3[0].toFixed(1)},${p3[1].toFixed(1)}`;

  // Compare data polygon if provided
  let comparePolygon = null;
  let cp1 = null, cp2 = null, cp3 = null;
  let cmpOverall = null;
  if (compareData) {
    const cs1 = clampScore(compareData.group1Score);
    const cs2 = clampScore(compareData.group2Score);
    const cs3 = clampScore(compareData.group3Score);
    cp1 = getPoint(angles[0], (cs1 / 10) * maxR);
    cp2 = getPoint(angles[1], (cs2 / 10) * maxR);
    cp3 = getPoint(angles[2], (cs3 / 10) * maxR);
    comparePolygon = `${cp1[0].toFixed(1)},${cp1[1].toFixed(1)} ${cp2[0].toFixed(1)},${cp2[1].toFixed(1)} ${cp3[0].toFixed(1)},${cp3[1].toFixed(1)}`;
    cmpOverall = ((cs1 + cs2 + cs3) / 3).toFixed(1);
  }

  // Calculate Overall Score (Average)
  const overallScore = ((s1 + s2 + s3) / 3).toFixed(1);
  const overallTier = getRankTier(Number(overallScore));

  const tier1 = getRankTier(s1);
  const tier2 = getRankTier(s2);
  const tier3 = getRankTier(s3);

  // Exact positions on the track for the 3 Modern Glass Rank Badges
  const rankPos1 = getPoint(angles[0], rTrack); // Top
  const rankPos2 = getPoint(angles[1], rTrack); // Bottom-Right
  const rankPos3 = getPoint(angles[2], rTrack); // Bottom-Left

  // Label positions outside the dial with generous margins to avoid any clipping
  const labelPos1 = { x: cx, y: 18 };
  const labelPos2 = { x: 442, y: 462 };
  const labelPos3 = { x: 138, y: 462 };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        maxWidth: size,
        margin: "0 auto",
        userSelect: "none",
        position: "relative"
      }}
    >
      <svg
        viewBox="0 0 580 520"
        style={{
          width: "100%",
          height: "auto",
          overflow: "visible",
          filter: "drop-shadow(0 12px 32px rgba(15, 23, 42, 0.05))",
        }}
      >
        <defs>
          {/* Futuristic Soft Neon Blur Filter */}
          <filter id="neonAura" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Clean Drop Shadow for Glass Badges */}
          <filter id="glassShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0f172a" floodOpacity="0.10" />
          </filter>

          <filter id="nodeShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.15" />
          </filter>

          {/* Modern Vibrant Gradient for Radar Polygon */}
          <linearGradient id="cyberPolygonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.52" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.50" />
          </linearGradient>

          {/* Neon Border Gradient */}
          <linearGradient id="cyberBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="50%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>

          {/* Comparison gradient */}
          <linearGradient id="compareGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.50" />
          </linearGradient>

          {/* Center radar ambient glow */}
          <radialGradient id="radarAmbient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="65%" stopColor="#f8fafc" stopOpacity="0.60" />
            <stop offset="100%" stopColor="#f1f5f9" stopOpacity="0.10" />
          </radialGradient>
        </defs>

        {/* ======================================================== */}
        {/* 1. MODERN SLEEK TECH RADAR COMPASS RINGS                 */}
        {/* ======================================================== */}
        {/* Outer ambient glow disc */}
        <circle cx={cx} cy={cy} r={rOuter} fill="url(#radarAmbient)" stroke="#e2e8f0" strokeWidth="1.2" />

        {/* Orbit track with subtle dashes */}
        <circle
          cx={cx}
          cy={cy}
          r={rTrack}
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="1.2"
          strokeDasharray="4 6"
          opacity="0.75"
        />

        {/* Inner clean ring */}
        <circle cx={cx} cy={cy} r={rInner} fill="none" stroke="#e2e8f0" strokeWidth="1" />

        {/* Cardinal tech micro-marks (12 sleek pips around the dial) */}
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i * 2 * Math.PI) / 12;
          const isMain = i % 3 === 0;
          const [x1, y1] = getPoint(a, rTrack - (isMain ? 6 : 3));
          const [x2, y2] = getPoint(a, rTrack + (isMain ? 6 : 3));
          return (
            <line
              key={`tech-pip-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isMain ? "#64748b" : "#94a3b8"}
              strokeWidth={isMain ? 1.5 : 1}
              opacity={isMain ? 0.8 : 0.4}
            />
          );
        })}

        {/* ======================================================== */}
        {/* 2. CONCENTRIC TRIANGLE GRID (20%, 40%, 60%, 80%, 100%)    */}
        {/* ======================================================== */}
        {levels.map((lvl, idx) => {
          const isMax = lvl === 1.0;
          return (
            <polygon
              key={`level-${lvl}`}
              points={getLevelPolygon(lvl)}
              fill={idx % 2 === 0 ? "rgba(241, 245, 249, 0.45)" : "transparent"}
              stroke={isMax ? "#94a3b8" : "#cbd5e1"}
              strokeWidth={isMax ? 1.5 : 0.9}
              strokeDasharray={isMax ? "none" : "3 3"}
              opacity={isMax ? 0.9 : 0.65}
            />
          );
        })}

        {/* ======================================================== */}
        {/* 3. 3 SPOKE AXIS RAYS (Center to Inner Ring)              */}
        {/* ======================================================== */}
        {angles.map((angle, idx) => {
          const [endX, endY] = getPoint(angle, rInner);
          return (
            <line
              key={`spoke-${idx}`}
              x1={cx}
              y1={cy}
              x2={endX}
              y2={endY}
              stroke="#94a3b8"
              strokeWidth="1.2"
              strokeDasharray="4 3"
              opacity="0.8"
            />
          );
        })}

        {/* ======================================================== */}
        {/* 4. COMPARISON MEMBER RADAR (IF ACTIVE)                   */}
        {/* ======================================================== */}
        {comparePolygon && (
          <g>
            <polygon
              points={comparePolygon}
              fill="url(#compareGrad)"
              stroke="#ea580c"
              strokeWidth="2.2"
              strokeDasharray="5 3"
            />
            {[cp1, cp2, cp3].map((pt, idx) => (
              <circle
                key={`cmp-dot-${idx}`}
                cx={pt[0]}
                cy={pt[1]}
                r={4}
                fill="#ffffff"
                stroke="#ea580c"
                strokeWidth="2.2"
              />
            ))}
          </g>
        )}

        {/* ======================================================== */}
        {/* 5. ACTIVE MEMBER RADAR POLYGON (NEON GLOW + CLEAN SHARP) */}
        {/* ======================================================== */}
        {/* Ambient Soft Glow Layer */}
        <polygon
          points={dataPolygon}
          fill="url(#cyberPolygonGrad)"
          filter="url(#neonAura)"
          opacity="0.45"
          style={{ transition: "all 0.35s ease" }}
        />

        {/* Sharp High-Precision Layer */}
        <polygon
          points={dataPolygon}
          fill="url(#cyberPolygonGrad)"
          stroke="url(#cyberBorderGrad)"
          strokeWidth="2.8"
          strokeLinejoin="round"
          style={{ transition: "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)" }}
        />

        {/* ======================================================== */}
        {/* 6. VERTEX TECH NODES & FLOATING SCORE PILLS              */}
        {/* ======================================================== */}
        {[
          { pt: p1, val: s1, tier: tier1, gid: "group1", textAnchor: "middle", offsetX: 0, offsetY: -18 },
          { pt: p2, val: s2, tier: tier2, gid: "group2", textAnchor: "start", offsetX: 14, offsetY: 4 },
          { pt: p3, val: s3, tier: tier3, gid: "group3", textAnchor: "end", offsetX: -14, offsetY: 4 },
        ].map((v, idx) => {
          const isSelected = activeGroup === v.gid;
          const scoreNum = Math.round(v.val * 10);
          return (
            <g
              key={`vertex-group-${idx}`}
              onClick={() => onGroupClick && onGroupClick(v.gid)}
              style={{ cursor: "pointer" }}
            >
              {/* Outer pulsing ring */}
              <circle
                cx={v.pt[0]}
                cy={v.pt[1]}
                r={isSelected ? 10 : 7.5}
                fill={isSelected ? "rgba(37, 99, 235, 0.25)" : "rgba(37, 99, 235, 0.15)"}
                style={{ transition: "all 0.25s ease" }}
              />

              {/* Middle crisp white ring */}
              <circle
                cx={v.pt[0]}
                cy={v.pt[1]}
                r={isSelected ? 6 : 4.5}
                fill="#ffffff"
                stroke={isSelected ? "#1d4ed8" : "#2563eb"}
                strokeWidth={2.2}
                filter="url(#nodeShadow)"
                style={{ transition: "all 0.25s ease" }}
              />

              {/* Inner core jewel */}
              <circle
                cx={v.pt[0]}
                cy={v.pt[1]}
                r={2}
                fill={isSelected ? "#1d4ed8" : "#2563eb"}
              />

              {/* Floating Modern Score Badge */}
              <g transform={`translate(${v.pt[0] + v.offsetX}, ${v.pt[1] + v.offsetY})`}>
                <rect
                  x={v.textAnchor === "middle" ? -14 : v.textAnchor === "start" ? 0 : -28}
                  y={-9}
                  width="28"
                  height="18"
                  rx="6"
                  fill="#0f172a"
                  filter="url(#nodeShadow)"
                />
                <text
                  x={v.textAnchor === "middle" ? 0 : v.textAnchor === "start" ? 14 : -14}
                  y={3.5}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="800"
                  fill="#ffffff"
                  fontFamily="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
                >
                  {scoreNum}
                </text>
              </g>
            </g>
          );
        })}

        {/* Center Pivot Jewel */}
        <circle cx={cx} cy={cy} r={6} fill="none" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2 2" />
        <circle cx={cx} cy={cy} r={2.5} fill="#3b82f6" />

        {/* ======================================================== */}
        {/* 7. FLOATING GLASS CAPSULE RANK BADGES (S / A / B / C / D) */}
        {/* ======================================================== */}

        {/* TOP: NHÓM 1 RANK BADGE */}
        <g
          onClick={() => onGroupClick && onGroupClick("group1")}
          style={{ cursor: interactive ? "pointer" : "default" }}
          transform={`translate(${rankPos1[0]}, ${rankPos1[1]})`}
        >
          {/* Glowing Aura */}
          <circle cx="0" cy="0" r="22" fill={tier1.bg} opacity="0.6" filter="url(#neonAura)" />
          {/* Main Glass Circle */}
          <circle
            cx="0"
            cy="0"
            r="19"
            fill="#ffffff"
            stroke={tier1.border}
            strokeWidth="2.2"
            filter="url(#glassShadow)"
          />
          <text
            x="0"
            y="7"
            textAnchor="middle"
            fontSize="21"
            fontWeight="900"
            fill={tier1.color}
            fontFamily="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
          >
            {tier1.rank}
          </text>
        </g>

        {/* BOTTOM-RIGHT: NHÓM 2 RANK BADGE */}
        <g
          onClick={() => onGroupClick && onGroupClick("group2")}
          style={{ cursor: interactive ? "pointer" : "default" }}
          transform={`translate(${rankPos2[0]}, ${rankPos2[1]})`}
        >
          <circle cx="0" cy="0" r="22" fill={tier2.bg} opacity="0.6" filter="url(#neonAura)" />
          <circle
            cx="0"
            cy="0"
            r="19"
            fill="#ffffff"
            stroke={tier2.border}
            strokeWidth="2.2"
            filter="url(#glassShadow)"
          />
          <text
            x="0"
            y="7"
            textAnchor="middle"
            fontSize="21"
            fontWeight="900"
            fill={tier2.color}
            fontFamily="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
          >
            {tier2.rank}
          </text>
        </g>

        {/* BOTTOM-LEFT: NHÓM 3 RANK BADGE */}
        <g
          onClick={() => onGroupClick && onGroupClick("group3")}
          style={{ cursor: interactive ? "pointer" : "default" }}
          transform={`translate(${rankPos3[0]}, ${rankPos3[1]})`}
        >
          <circle cx="0" cy="0" r="22" fill={tier3.bg} opacity="0.6" filter="url(#neonAura)" />
          <circle
            cx="0"
            cy="0"
            r="19"
            fill="#ffffff"
            stroke={tier3.border}
            strokeWidth="2.2"
            filter="url(#glassShadow)"
          />
          <text
            x="0"
            y="7"
            textAnchor="middle"
            fontSize="21"
            fontWeight="900"
            fill={tier3.color}
            fontFamily="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
          >
            {tier3.rank}
          </text>
        </g>

        {/* ======================================================== */}
        {/* 8. CATEGORY HEADERS (GENEROUS MARGINS - NO CLIPPING)     */}
        {/* ======================================================== */}

        {/* TOP: QUẢN LÝ & ĐỐI NGOẠI */}
        <g
          onClick={() => onGroupClick && onGroupClick("group1")}
          style={{ cursor: interactive ? "pointer" : "default" }}
        >
          <text
            x={labelPos1.x}
            y={labelPos1.y}
            textAnchor="middle"
            fontSize="13.5"
            fontWeight="800"
            letterSpacing="0.8px"
            fill="#0f172a"
            fontFamily="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
          >
            QUẢN LÝ & ĐỐI NGOẠI
          </text>
          <text
            x={labelPos1.x}
            y={labelPos1.y + 15}
            textAnchor="middle"
            fontSize="10.5"
            fontWeight="600"
            fill="#64748b"
            fontFamily="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
          >
            Dự Án • Đào Tạo • Đối Ngoại
          </text>
        </g>

        {/* BOTTOM-RIGHT: KỸ THUẬT & HỆ THỐNG */}
        <g
          onClick={() => onGroupClick && onGroupClick("group2")}
          style={{ cursor: interactive ? "pointer" : "default" }}
        >
          <text
            x={labelPos2.x}
            y={labelPos2.y}
            textAnchor="middle"
            fontSize="13.5"
            fontWeight="800"
            letterSpacing="0.8px"
            fill="#0f172a"
            fontFamily="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
          >
            KỸ THUẬT & HỆ THỐNG
          </text>
          <text
            x={labelPos2.x}
            y={labelPos2.y + 15}
            textAnchor="middle"
            fontSize="10.5"
            fontWeight="600"
            fill="#64748b"
            fontFamily="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
          >
            Lập Trình • AI/Agent • Deploy
          </text>
        </g>

        {/* BOTTOM-LEFT: RESEARCH & AI */}
        <g
          onClick={() => onGroupClick && onGroupClick("group3")}
          style={{ cursor: interactive ? "pointer" : "default" }}
        >
          <text
            x={labelPos3.x}
            y={labelPos3.y}
            textAnchor="middle"
            fontSize="13.5"
            fontWeight="800"
            letterSpacing="0.8px"
            fill="#0f172a"
            fontFamily="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
          >
            RESEARCH & AI
          </text>
          <text
            x={labelPos3.x}
            y={labelPos3.y + 15}
            textAnchor="middle"
            fontSize="10.5"
            fontWeight="600"
            fill="#64748b"
            fontFamily="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
          >
            Nghiên Cứu • Data • Bài Báo
          </text>
        </g>
      </svg>

      {/* Modern Interactive Pill Legend below the chart */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          fontSize: 12,
          fontWeight: 700,
          marginTop: 10,
          flexWrap: "wrap",
        }}
      >
        <span
          onClick={() => onGroupClick && onGroupClick("group1")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#1d4ed8",
            cursor: "pointer",
            padding: "5px 12px",
            borderRadius: 20,
            background: activeGroup === "group1" ? "#dbeafe" : "#ffffff",
            border: activeGroup === "group1" ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
            boxShadow: "0 2px 6px rgba(37, 99, 235, 0.08)",
            transition: "all 0.2s ease"
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563eb", boxShadow: "0 0 6px rgba(37, 99, 235, 0.6)" }} />
          Quản Lý: {s1.toFixed(1)}/10
          <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: tier1.bg, color: tier1.textColor, fontWeight: 800 }}>
            {tier1.rank}
          </span>
        </span>

        <span
          onClick={() => onGroupClick && onGroupClick("group2")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#047857",
            cursor: "pointer",
            padding: "5px 12px",
            borderRadius: 20,
            background: activeGroup === "group2" ? "#d1fae5" : "#ffffff",
            border: activeGroup === "group2" ? "1.5px solid #059669" : "1px solid #e2e8f0",
            boxShadow: "0 2px 6px rgba(5, 150, 105, 0.08)",
            transition: "all 0.2s ease"
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#059669", boxShadow: "0 0 6px rgba(5, 150, 105, 0.6)" }} />
          Kỹ Thuật: {s2.toFixed(1)}/10
          <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: tier2.bg, color: tier2.textColor, fontWeight: 800 }}>
            {tier2.rank}
          </span>
        </span>

        <span
          onClick={() => onGroupClick && onGroupClick("group3")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#6d28d9",
            cursor: "pointer",
            padding: "5px 12px",
            borderRadius: 20,
            background: activeGroup === "group3" ? "#ede9fe" : "#ffffff",
            border: activeGroup === "group3" ? "1.5px solid #7c3aed" : "1px solid #e2e8f0",
            boxShadow: "0 2px 6px rgba(124, 58, 237, 0.08)",
            transition: "all 0.2s ease"
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7c3aed", boxShadow: "0 0 6px rgba(124, 58, 237, 0.6)" }} />
          Research: {s3.toFixed(1)}/10
          <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: tier3.bg, color: tier3.textColor, fontWeight: 800 }}>
            {tier3.rank}
          </span>
        </span>

        {compareData && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "#c2410c",
              padding: "5px 12px",
              borderRadius: 20,
              background: "#fff7ed",
              border: "1.5px dashed #ea580c",
              boxShadow: "0 2px 6px rgba(234, 88, 12, 0.08)"
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#ea580c" }} />
            {compareData.name || "Đối thủ"}: {cmpOverall}/10
          </span>
        )}
      </div>
    </div>
  );
}
