import React from "react";

// Helper to determine rank tier from a 0-10 or 0-100 score
export function getRankTier(score) {
  const s = score > 10 ? score / 10 : score;
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
  const cx = 230;
  const cy = 230;
  const maxR = 135; // Maximum radius of the triangle

  // 3 Vertices Angles (radians)
  // Vertex 0: Top (Management) -> -90 deg (-pi/2)
  // Vertex 1: Bottom Right (Engineering) -> 30 deg (pi/6)
  // Vertex 2: Bottom Left (Research) -> 150 deg (5pi/6)
  const angles = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];

  // Concentric levels (20%, 40%, 60%, 80%, 100%)
  const levels = [0.2, 0.4, 0.6, 0.8, 1.0];

  const getPoint = (angle, radius) => {
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  };

  // Build triangle points string for a given level
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

  // Compare data if provided
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

  // Outer tachometer/speedometer circular ring ticks (60 ticks)
  const dialTicks = [];
  const numTicks = 60;
  for (let i = 0; i < numTicks; i++) {
    const rad = (i * 2 * Math.PI) / numTicks;
    const isMajor = i % 5 === 0;
    const r1 = isMajor ? 188 : 191;
    const r2 = 196;
    const x1 = cx + r1 * Math.cos(rad);
    const y1 = cy + r1 * Math.sin(rad);
    const x2 = cx + r2 * Math.cos(rad);
    const y2 = cy + r2 * Math.sin(rad);
    dialTicks.push({ x1, y1, x2, y2, isMajor, key: i });
  }

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
        viewBox="0 0 460 460"
        style={{
          width: "100%",
          height: "auto",
          overflow: "visible",
          filter: "drop-shadow(0 10px 25px rgba(0,0,0,0.06))",
        }}
      >
        <defs>
          {/* Glowing filter for radar polygon */}
          <filter id="radarGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Linear gradient for radar polygon fill */}
          <linearGradient id="triangleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.42" />
          </linearGradient>

          {/* Comparison gradient */}
          <linearGradient id="compareGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.38" />
          </linearGradient>

          {/* Radial subtle background */}
          <radialGradient id="centerDialBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="70%" stopColor="#f8fafc" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#f1f5f9" stopOpacity="0.75" />
          </radialGradient>
        </defs>

        {/* 1. OUTER TACHOMETER CIRCULAR DIAL RING (Anime Blue Lock Style) */}
        <circle cx={cx} cy={cy} r={200} fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r={186} fill="none" stroke="#e2e8f0" strokeWidth="1" />
        <circle cx={cx} cy={cy} r={185} fill="url(#centerDialBg)" />

        {/* Dial ticks */}
        {dialTicks.map((t) => (
          <line
            key={t.key}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.isMajor ? "#475569" : "#cbd5e1"}
            strokeWidth={t.isMajor ? 1.8 : 1}
          />
        ))}

        {/* 2. CONCENTRIC TRIANGLE GRID LEVELS (20%, 40%, 60%, 80%, 100%) */}
        {levels.map((lvl, idx) => (
          <g key={lvl}>
            <polygon
              points={getLevelPolygon(lvl)}
              fill={idx % 2 === 0 ? "rgba(241, 245, 249, 0.45)" : "transparent"}
              stroke={lvl === 1.0 ? "#94a3b8" : "#cbd5e1"}
              strokeWidth={lvl === 1.0 ? 1.5 : 1}
              strokeDasharray={lvl === 1.0 ? "none" : "3 3"}
            />
            {/* Axis scale number indicator on top axis */}
            <text
              x={cx + 6}
              y={cy - maxR * lvl + 3}
              fontSize="9"
              fill="#94a3b8"
              fontWeight="600"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {(lvl * 10).toFixed(0)}
            </text>
          </g>
        ))}

        {/* 3. 3 SPOKE AXIS LINES (Center to 3 Vertices) */}
        {angles.map((angle, idx) => {
          const [vx, vy] = getPoint(angle, maxR);
          return (
            <line
              key={idx}
              x1={cx}
              y1={cy}
              x2={vx}
              y2={vy}
              stroke="#64748b"
              strokeWidth="1.5"
            />
          );
        })}

        {/* 4. COMPARISON MEMBER RADAR POLYGON (IF ACTIVE) */}
        {comparePolygon && (
          <g>
            <polygon
              points={comparePolygon}
              fill="url(#compareGradient)"
              stroke="#ea580c"
              strokeWidth="2.5"
              strokeDasharray="4 2"
            />
            {[cp1, cp2, cp3].map((pt, idx) => (
              <circle
                key={`cmp-dot-${idx}`}
                cx={pt[0]}
                cy={pt[1]}
                r={4}
                fill="#ffffff"
                stroke="#ea580c"
                strokeWidth="2"
              />
            ))}
          </g>
        )}

        {/* 5. ACTIVE MEMBER RADAR POLYGON (TAM GIÁC NĂNG LỰC) */}
        <polygon
          points={dataPolygon}
          fill="url(#triangleGradient)"
          stroke="#2563eb"
          strokeWidth="3"
          filter="url(#radarGlow)"
          style={{ transition: "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)" }}
        />

        {/* Vertex markers with white core and glowing stroke */}
        {[
          { pt: p1, val: s1, tier: tier1, angle: angles[0], gid: "group1" },
          { pt: p2, val: s2, tier: tier2, angle: angles[1], gid: "group2" },
          { pt: p3, val: s3, tier: tier3, angle: angles[2], gid: "group3" },
        ].map((v, idx) => {
          const isSelected = activeGroup === v.gid;
          return (
            <g
              key={`vertex-${idx}`}
              onClick={() => onGroupClick && onGroupClick(v.gid)}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={v.pt[0]}
                cy={v.pt[1]}
                r={isSelected ? 8.5 : 6.5}
                fill="#ffffff"
                stroke={isSelected ? "#1e40af" : v.tier.color}
                strokeWidth={isSelected ? 4 : 3}
                style={{ transition: "all 0.25s ease" }}
              />
              {/* Value capsule badge on vertex */}
              <rect
                x={v.pt[0] - 16}
                y={idx === 0 ? v.pt[1] - 22 : v.pt[1] + 8}
                width={32}
                height={16}
                rx={8}
                fill="#0f172a"
                opacity={isSelected ? "0.95" : "0.85"}
              />
              <text
                x={v.pt[0]}
                y={idx === 0 ? v.pt[1] - 11 : v.pt[1] + 19}
                textAnchor="middle"
                fontSize="10"
                fontWeight="800"
                fill="#ffffff"
                fontFamily="system-ui, sans-serif"
              >
                {v.val.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* 6. CENTER CIRCLE WITH OVERALL SCORE & RANK */}
        <g style={{ cursor: "pointer" }}>
          <circle
            cx={cx}
            cy={cy}
            r={34}
            fill="#ffffff"
            stroke={overallTier.color}
            strokeWidth="3.5"
            filter="drop-shadow(0 3px 8px rgba(0,0,0,0.12))"
          />
          <text
            x={cx}
            y={cy - 12}
            textAnchor="middle"
            fontSize="8"
            fontWeight="800"
            fill="#64748b"
            letterSpacing="0.8px"
          >
            OVERALL
          </text>
          <text
            x={cx}
            y={cy + 8}
            textAnchor="middle"
            fontSize="18"
            fontWeight="900"
            fill={overallTier.color}
            fontFamily="Impact, Arial Black, sans-serif"
          >
            {overallScore}
          </text>
          <text
            x={cx}
            y={cy + 22}
            textAnchor="middle"
            fontSize="9"
            fontWeight="800"
            fill="#1e293b"
          >
            HẠNG {overallTier.rank}
          </text>
        </g>

        {/* ======================================================== */}
        {/* 7. THREE RADIAL CATEGORY LABELS & BLUE-LOCK RANK LETTERS */}
        {/* ======================================================== */}

        {/* TOP: NHÓM 1 - QUẢN LÝ & ĐỐI NGOẠI */}
        <g
          onClick={() => onGroupClick && onGroupClick("group1")}
          style={{ cursor: interactive ? "pointer" : "default" }}
        >
          {/* Active highlight background if selected */}
          {activeGroup === "group1" && (
            <rect x={cx - 85} y={10} width={170} height={85} rx={12} fill="rgba(37, 99, 235, 0.08)" stroke="#2563eb" strokeWidth="1" strokeDasharray="3 2" />
          )}
          {/* Category Title */}
          <text
            x={cx}
            y={24}
            textAnchor="middle"
            fontSize="12.5"
            fontWeight="900"
            letterSpacing="0.5px"
            fill="#1e3a8a"
            fontFamily="system-ui, sans-serif"
          >
            QUẢN LÝ & ĐỐI NGOẠI
          </text>
          <text
            x={cx}
            y={38}
            textAnchor="middle"
            fontSize="9.5"
            fontWeight="600"
            fill="#64748b"
          >
            Dự Án • Đào Tạo • Đối Ngoại
          </text>
          {/* Big Stylized Blue-Lock Rank Letter */}
          <text
            x={cx}
            y={68}
            textAnchor="middle"
            fontSize="32"
            fontWeight="900"
            fill={tier1.color}
            stroke="#0f172a"
            strokeWidth="1.2"
            fontFamily="Impact, Arial Black, sans-serif"
            letterSpacing="1px"
          >
            {tier1.rank}
          </text>
          {/* Score display */}
          <text
            x={cx}
            y={82}
            textAnchor="middle"
            fontSize="11"
            fontWeight="800"
            fill="#334155"
          >
            {s1.toFixed(1)} <tspan fontSize="9" fill="#94a3b8">/ 10</tspan>
          </text>
        </g>

        {/* BOTTOM RIGHT: NHÓM 2 - KỸ THUẬT & HỆ THỐNG */}
        <g
          onClick={() => onGroupClick && onGroupClick("group2")}
          style={{ cursor: interactive ? "pointer" : "default" }}
        >
          {activeGroup === "group2" && (
            <rect x={280} y={315} width={170} height={100} rx={12} fill="rgba(5, 150, 105, 0.08)" stroke="#059669" strokeWidth="1" strokeDasharray="3 2" />
          )}
          {/* Category Title */}
          <text
            x={365}
            y={330}
            textAnchor="middle"
            fontSize="12.5"
            fontWeight="900"
            letterSpacing="0.5px"
            fill="#065f46"
            fontFamily="system-ui, sans-serif"
          >
            KỸ THUẬT & HỆ THỐNG
          </text>
          <text
            x={365}
            y={344}
            textAnchor="middle"
            fontSize="9.5"
            fontWeight="600"
            fill="#64748b"
          >
            Lập Trình • AI/Agent • Deploy
          </text>
          {/* Big Stylized Rank Letter */}
          <text
            x={365}
            y={384}
            textAnchor="middle"
            fontSize="34"
            fontWeight="900"
            fill={tier2.color}
            stroke="#0f172a"
            strokeWidth="1.2"
            fontFamily="Impact, Arial Black, sans-serif"
          >
            {tier2.rank}
          </text>
          {/* Score display */}
          <text
            x={365}
            y={400}
            textAnchor="middle"
            fontSize="11.5"
            fontWeight="800"
            fill="#334155"
          >
            {s2.toFixed(1)} <tspan fontSize="9" fill="#94a3b8">/ 10</tspan>
          </text>
        </g>

        {/* BOTTOM LEFT: NHÓM 3 - RESEARCH & AI */}
        <g
          onClick={() => onGroupClick && onGroupClick("group3")}
          style={{ cursor: interactive ? "pointer" : "default" }}
        >
          {activeGroup === "group3" && (
            <rect x={10} y={315} width={170} height={100} rx={12} fill="rgba(124, 58, 237, 0.08)" stroke="#7c3aed" strokeWidth="1" strokeDasharray="3 2" />
          )}
          {/* Category Title */}
          <text
            x={95}
            y={330}
            textAnchor="middle"
            fontSize="12.5"
            fontWeight="900"
            letterSpacing="0.5px"
            fill="#581c87"
            fontFamily="system-ui, sans-serif"
          >
            RESEARCH & AI
          </text>
          <text
            x={95}
            y={344}
            textAnchor="middle"
            fontSize="9.5"
            fontWeight="600"
            fill="#64748b"
          >
            Nghiên Cứu • Data • Bài Báo
          </text>
          {/* Big Stylized Rank Letter */}
          <text
            x={95}
            y={384}
            textAnchor="middle"
            fontSize="34"
            fontWeight="900"
            fill={tier3.color}
            stroke="#0f172a"
            strokeWidth="1.2"
            fontFamily="Impact, Arial Black, sans-serif"
          >
            {tier3.rank}
          </text>
          {/* Score display */}
          <text
            x={95}
            y={400}
            textAnchor="middle"
            fontSize="11.5"
            fontWeight="800"
            fill="#334155"
          >
            {s3.toFixed(1)} <tspan fontSize="9" fill="#94a3b8">/ 10</tspan>
          </text>
        </g>
      </svg>

      {/* Legend below the chart */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          fontSize: 11,
          fontWeight: 700,
          marginTop: -6,
          flexWrap: "wrap",
        }}
      >
        <span
          onClick={() => onGroupClick && onGroupClick("group1")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#1e40af",
            cursor: "pointer",
            padding: "3px 8px",
            borderRadius: 6,
            background: activeGroup === "group1" ? "#dbeafe" : "transparent"
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#2563eb" }} />
          Quản Lý: {s1.toFixed(1)}/10 ({tier1.rank})
        </span>
        <span
          onClick={() => onGroupClick && onGroupClick("group2")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#065f46",
            cursor: "pointer",
            padding: "3px 8px",
            borderRadius: 6,
            background: activeGroup === "group2" ? "#d1fae5" : "transparent"
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#059669" }} />
          Kỹ Thuật: {s2.toFixed(1)}/10 ({tier2.rank})
        </span>
        <span
          onClick={() => onGroupClick && onGroupClick("group3")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#6b21a8",
            cursor: "pointer",
            padding: "3px 8px",
            borderRadius: 6,
            background: activeGroup === "group3" ? "#ede9fe" : "transparent"
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#7c3aed" }} />
          Research: {s3.toFixed(1)}/10 ({tier3.rank})
        </span>

        {compareData && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "#c2410c",
              padding: "3px 8px",
              borderRadius: 6,
              background: "#ffedd5",
              border: "1px dashed #f97316"
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "#ea580c" }} />
            {compareData.name || "Đối thủ"}: {cmpOverall}/10
          </span>
        )}
      </div>
    </div>
  );
}
