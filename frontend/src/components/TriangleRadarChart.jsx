import React from "react";

// Helper to determine rank tier from a 0-10 or 0-100 score
export function getRankTier(score) {
  const s = score > 10 ? score / 10 : Number(score) || 0;
  if (s >= 8.5) {
    return {
      rank: "S",
      title: "Master (Xuất sắc)",
      desc: "Chuyên sâu, có thể dẫn dắt & đào tạo người khác",
      color: "#eab308",
      glow: "rgba(234, 179, 8, 0.45)",
      bg: "#fef9c3",
      border: "#fde047",
      textColor: "#854d0e"
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
      border: "#ddd6fe",
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
      border: "#a7f3d0",
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
      border: "#fed7aa",
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
    border: "#fecaca",
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
  size = 460,
  interactive = true,
  activeGroup = null,
  onGroupClick = null,
}) {
  // Center coordinates in a 520x520 viewBox for ample breathing room
  const cx = 260;
  const cy = 260;

  // Radii
  const rOuter = 215; // Outer circle ring
  const rInner = 175; // Inner circle ring (tachometer track boundary)
  const maxR = 145;   // Maximum radius of concentric triangle (100% / 10 points)

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

  // Outer tachometer circular ring ticks (72 ticks around the full circle)
  const dialTicks = [];
  const numTicks = 72;
  for (let i = 0; i < numTicks; i++) {
    const rad = (i * 2 * Math.PI) / numTicks;
    const isMajor = i % 6 === 0;
    const rStart = isMajor ? rInner + 2 : rInner + 8;
    const rEnd = rOuter - 2;
    const x1 = cx + rStart * Math.cos(rad);
    const y1 = cy + rStart * Math.sin(rad);
    const x2 = cx + rEnd * Math.cos(rad);
    const y2 = cy + rEnd * Math.sin(rad);
    dialTicks.push({ x1, y1, x2, y2, isMajor, key: i });
  }

  // Exact positions on the tachometer track (radius 195) for the 3 Big Manga Rank Letters
  const rTrack = (rInner + rOuter) / 2; // ~195
  const rankPos1 = getPoint(angles[0], rTrack); // Top: (260, 65)
  const rankPos2 = getPoint(angles[1], rTrack); // Bottom-Right: (428.8, 357.5)
  const rankPos3 = getPoint(angles[2], rTrack); // Bottom-Left: (91.2, 357.5)

  // Label positions outside the dial
  const labelPos1 = { x: 260, y: 22 };
  const labelPos2 = { x: 440, y: 445 };
  const labelPos3 = { x: 80, y: 445 };

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
        viewBox="0 0 520 520"
        style={{
          width: "100%",
          height: "auto",
          overflow: "visible",
          filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.06))",
        }}
      >
        <defs>
          {/* Glowing filter for radar polygon */}
          <filter id="radarGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Manga Halftone Screentone Pattern */}
          <pattern id="mangaHatch" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#94a3b8" strokeWidth="1.2" opacity="0.35" />
          </pattern>

          {/* Linear gradient for radar polygon fill */}
          <linearGradient id="triangleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.5" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.48" />
          </linearGradient>

          {/* Comparison gradient */}
          <linearGradient id="compareGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.42" />
          </linearGradient>

          {/* Dial track subtle background */}
          <radialGradient id="centerDialBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="65%" stopColor="#f8fafc" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#f1f5f9" stopOpacity="0.8" />
          </radialGradient>
        </defs>

        {/* ======================================================== */}
        {/* 1. BLUE LOCK TACHOMETER CIRCULAR DIAL                    */}
        {/* ======================================================== */}
        {/* Outer and Inner Circle Track */}
        <circle cx={cx} cy={cy} r={rOuter + 3} fill="none" stroke="#0f172a" strokeWidth="3" />
        <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="#64748b" strokeWidth="1.2" />
        <circle cx={cx} cy={cy} r={rInner} fill="none" stroke="#0f172a" strokeWidth="2" />
        <circle cx={cx} cy={cy} r={rInner - 1} fill="url(#centerDialBg)" />

        {/* Tachometer Dial Ticks (60-72 radial lines) */}
        {dialTicks.map((t) => (
          <line
            key={t.key}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.isMajor ? "#0f172a" : "#94a3b8"}
            strokeWidth={t.isMajor ? 2 : 1}
          />
        ))}

        {/* ======================================================== */}
        {/* 2. CONCENTRIC TRIANGLE GRID LEVELS (20%, 40%, 60%, 80%, 100%) */}
        {/* ======================================================== */}
        {levels.map((lvl, idx) => {
          const isMax = lvl === 1.0;
          return (
            <g key={lvl}>
              <polygon
                points={getLevelPolygon(lvl)}
                fill={idx % 2 === 0 ? "rgba(241, 245, 249, 0.55)" : "transparent"}
                stroke={isMax ? "#0f172a" : "#cbd5e1"}
                strokeWidth={isMax ? 2 : 1}
                strokeDasharray={isMax ? "none" : "3 3"}
              />
            </g>
          );
        })}

        {/* Small "100" or "10" indicator at each 100% vertex (Manga reference style) */}
        {angles.map((angle, idx) => {
          const [vx, vy] = getPoint(angle, maxR);
          const offsetX = idx === 0 ? 0 : idx === 1 ? -12 : 12;
          const offsetY = idx === 0 ? 12 : -6;
          return (
            <text
              key={`max-100-${idx}`}
              x={vx + offsetX}
              y={vy + offsetY}
              fontSize="9"
              fill="#64748b"
              fontWeight="800"
              fontFamily="Impact, Arial Black, sans-serif"
              textAnchor="middle"
            >
              100
            </text>
          );
        })}

        {/* ======================================================== */}
        {/* 3. 3 SPOKE AXIS LINES (From Center to Inner Ring)        */}
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
              stroke="#475569"
              strokeWidth="1.5"
            />
          );
        })}

        {/* ======================================================== */}
        {/* 4. COMPARISON MEMBER RADAR POLYGON (IF ACTIVE)           */}
        {/* ======================================================== */}
        {comparePolygon && (
          <g>
            <polygon
              points={comparePolygon}
              fill="url(#compareGradient)"
              stroke="#ea580c"
              strokeWidth="2.5"
              strokeDasharray="5 3"
            />
            {[cp1, cp2, cp3].map((pt, idx) => (
              <circle
                key={`cmp-dot-${idx}`}
                cx={pt[0]}
                cy={pt[1]}
                r={4.5}
                fill="#ffffff"
                stroke="#ea580c"
                strokeWidth="2.5"
              />
            ))}
          </g>
        )}

        {/* ======================================================== */}
        {/* 5. ACTIVE MEMBER RADAR POLYGON (MANGA HALFTONE + GLOW)   */}
        {/* ======================================================== */}
        {/* Screentone Hatch Layer */}
        <polygon
          points={dataPolygon}
          fill="url(#mangaHatch)"
          style={{ transition: "all 0.35s ease" }}
        />
        {/* Color Glow Layer */}
        <polygon
          points={dataPolygon}
          fill="url(#triangleGradient)"
          stroke="#0f172a"
          strokeWidth="3"
          filter="url(#radarGlow)"
          style={{ transition: "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)" }}
        />

        {/* Vertex Points & Number Badges */}
        {[
          { pt: p1, val: s1, tier: tier1, angle: angles[0], gid: "group1", textAnchor: "middle", offsetX: 0, offsetY: -12 },
          { pt: p2, val: s2, tier: tier2, angle: angles[1], gid: "group2", textAnchor: "start", offsetX: 10, offsetY: 4 },
          { pt: p3, val: s3, tier: tier3, angle: angles[2], gid: "group3", textAnchor: "end", offsetX: -10, offsetY: 4 },
        ].map((v, idx) => {
          const isSelected = activeGroup === v.gid;
          return (
            <g
              key={`vertex-group-${idx}`}
              onClick={() => onGroupClick && onGroupClick(v.gid)}
              style={{ cursor: "pointer" }}
            >
              {/* Outer Glow Ring */}
              <circle
                cx={v.pt[0]}
                cy={v.pt[1]}
                r={isSelected ? 9 : 6.5}
                fill="#ffffff"
                stroke={isSelected ? "#2563eb" : "#0f172a"}
                strokeWidth={isSelected ? 3.5 : 2.5}
                style={{ transition: "all 0.25s ease" }}
              />

              {/* Exact Numerical Score (Manga style bold text e.g. 72 or 7.2) */}
              <text
                x={v.pt[0] + v.offsetX}
                y={v.pt[1] + v.offsetY}
                textAnchor={v.textAnchor}
                fontSize="13"
                fontWeight="900"
                fill="#0f172a"
                fontFamily="Impact, Arial Black, sans-serif"
                style={{ filter: "drop-shadow(0 1px 2px #ffffff)" }}
              >
                {Math.round(v.val * 10)}
              </text>
            </g>
          );
        })}

        {/* ======================================================== */}
        {/* 6. CENTER PIVOT DOT (Bỏ vòng tròn OVR theo yêu cầu)     */}
        {/* ======================================================== */}
        <circle cx={cx} cy={cy} r={3} fill="#475569" />

        {/* ======================================================== */}
        {/* 7. MANGA RANK LETTERS S / A / B / C / D ON TACHOMETER    */}
        {/*    (Placed exactly inside the circular track)           */}
        {/* ======================================================== */}

        {/* TOP: NHÓM 1 RANK LETTER */}
        <g
          onClick={() => onGroupClick && onGroupClick("group1")}
          style={{ cursor: interactive ? "pointer" : "default" }}
        >
          <circle
            cx={rankPos1[0]}
            cy={rankPos1[1]}
            r={20}
            fill="#ffffff"
            stroke="#0f172a"
            strokeWidth="2.5"
          />
          <text
            x={rankPos1[0]}
            y={rankPos1[1] + 10}
            textAnchor="middle"
            fontSize="30"
            fontWeight="900"
            fill={tier1.color}
            stroke="#0f172a"
            strokeWidth="1.5"
            fontFamily="Impact, Arial Black, sans-serif"
          >
            {tier1.rank}
          </text>
        </g>

        {/* BOTTOM-RIGHT: NHÓM 2 RANK LETTER */}
        <g
          onClick={() => onGroupClick && onGroupClick("group2")}
          style={{ cursor: interactive ? "pointer" : "default" }}
        >
          <circle
            cx={rankPos2[0]}
            cy={rankPos2[1]}
            r={20}
            fill="#ffffff"
            stroke="#0f172a"
            strokeWidth="2.5"
          />
          <text
            x={rankPos2[0]}
            y={rankPos2[1] + 10}
            textAnchor="middle"
            fontSize="30"
            fontWeight="900"
            fill={tier2.color}
            stroke="#0f172a"
            strokeWidth="1.5"
            fontFamily="Impact, Arial Black, sans-serif"
          >
            {tier2.rank}
          </text>
        </g>

        {/* BOTTOM-LEFT: NHÓM 3 RANK LETTER */}
        <g
          onClick={() => onGroupClick && onGroupClick("group3")}
          style={{ cursor: interactive ? "pointer" : "default" }}
        >
          <circle
            cx={rankPos3[0]}
            cy={rankPos3[1]}
            r={20}
            fill="#ffffff"
            stroke="#0f172a"
            strokeWidth="2.5"
          />
          <text
            x={rankPos3[0]}
            y={rankPos3[1] + 10}
            textAnchor="middle"
            fontSize="30"
            fontWeight="900"
            fill={tier3.color}
            stroke="#0f172a"
            strokeWidth="1.5"
            fontFamily="Impact, Arial Black, sans-serif"
          >
            {tier3.rank}
          </text>
        </g>

        {/* ======================================================== */}
        {/* 8. CATEGORY LABELS OUTSIDE THE CIRCLE (CLEAN & NON-OVERLAPPING) */}
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
            fontSize="14"
            fontWeight="900"
            letterSpacing="1px"
            fill="#0f172a"
            fontFamily="Impact, Arial Black, sans-serif"
          >
            QUẢN LÝ & ĐỐI NGOẠI
          </text>
          <text
            x={labelPos1.x}
            y={labelPos1.y + 14}
            textAnchor="middle"
            fontSize="10"
            fontWeight="700"
            fill="#64748b"
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
            fontSize="14"
            fontWeight="900"
            letterSpacing="1px"
            fill="#0f172a"
            fontFamily="Impact, Arial Black, sans-serif"
          >
            KỸ THUẬT & HỆ THỐNG
          </text>
          <text
            x={labelPos2.x}
            y={labelPos2.y + 14}
            textAnchor="middle"
            fontSize="10"
            fontWeight="700"
            fill="#64748b"
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
            fontSize="14"
            fontWeight="900"
            letterSpacing="1px"
            fill="#0f172a"
            fontFamily="Impact, Arial Black, sans-serif"
          >
            RESEARCH & AI
          </text>
          <text
            x={labelPos3.x}
            y={labelPos3.y + 14}
            textAnchor="middle"
            fontSize="10"
            fontWeight="700"
            fill="#64748b"
          >
            Nghiên Cứu • Data • Bài Báo
          </text>
        </g>
      </svg>

      {/* Legend below the chart */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          fontSize: 11.5,
          fontWeight: 800,
          marginTop: 6,
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
            padding: "4px 8px",
            borderRadius: 8,
            background: activeGroup === "group1" ? "#dbeafe" : "#eff6ff",
            border: "1px solid #bfdbfe"
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563eb" }} />
          Quản Lý: {s1.toFixed(1)}/10 ({tier1.rank})
        </span>
        <span
          onClick={() => onGroupClick && onGroupClick("group2")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#047857",
            cursor: "pointer",
            padding: "4px 8px",
            borderRadius: 8,
            background: activeGroup === "group2" ? "#d1fae5" : "#ecfdf5",
            border: "1px solid #a7f3d0"
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#059669" }} />
          Kỹ Thuật: {s2.toFixed(1)}/10 ({tier2.rank})
        </span>
        <span
          onClick={() => onGroupClick && onGroupClick("group3")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#6d28d9",
            cursor: "pointer",
            padding: "4px 8px",
            borderRadius: 8,
            background: activeGroup === "group3" ? "#ede9fe" : "#f5f3ff",
            border: "1px solid #ddd6fe"
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7c3aed" }} />
          Research: {s3.toFixed(1)}/10 ({tier3.rank})
        </span>

        {compareData && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "#c2410c",
              padding: "4px 8px",
              borderRadius: 8,
              background: "#fff7ed",
              border: "1.5px dashed #ea580c"
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
