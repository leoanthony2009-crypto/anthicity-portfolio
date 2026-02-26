import { useState, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

/* ================================================================
   BLOOM Design Tokens
   ================================================================ */
const T = {
  green1: "#3A7D5C",
  green2: "#1B4332",
  gold:   "#C8973E",
  sage:   "#8FAE8B",
  cream:  "#F5EFE0",
  sageLight: "#EDF4EB",
  white:  "#FFFFFF",
  bg:     "#F7F5F0",
};

const PIE_COLORS = ["#3A7D5C", "#C8973E", "#D9534F", "#8FAE8B"];
const PILLAR_COLORS = [T.green1, T.gold, "#5B9A7A", "#D4A853"];

/* ================================================================
   BloomCross SVG Logo
   ================================================================ */
function BloomCross({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <g transform="translate(32,32)">
        <rect x="-4" y="-24" width="8" height="48" rx="2" fill={T.green1} />
        <rect x="-16" y="-4" width="32" height="8" rx="2" fill={T.green1} />
        <ellipse cx="0" cy="-22" rx="6" ry="10" fill={T.sage} opacity="0.8" />
        <ellipse cx="0" cy="22" rx="6" ry="10" fill={T.sage} opacity="0.8" />
        <ellipse cx="-14" cy="0" rx="10" ry="6" fill={T.sage} opacity="0.8" />
        <ellipse cx="14" cy="0" rx="10" ry="6" fill={T.sage} opacity="0.8" />
        <circle cx="0" cy="0" r="5" fill={T.gold} />
        <rect x="-1.5" y="-8" width="3" height="16" rx="1" fill={T.cream} opacity="0.5" />
        <rect x="-8" y="-1.5" width="16" height="3" rx="1" fill={T.cream} opacity="0.5" />
      </g>
    </svg>
  );
}

/* ================================================================
   Gauge / Score Ring Component
   ================================================================ */
function ScoreGauge({ value, label, size = 120, color = T.green1 }) {
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(Math.max(value, 0), 100);
  const offset = c - (pct / 100) * c;
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.sageLight} strokeWidth="10" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      </svg>
      <div style={{ marginTop: -size / 2 - 14, fontFamily: SERIF, fontSize: size * 0.25, fontWeight: 700, color: T.green2 }}>
        {pct.toFixed(1)}
      </div>
      <div style={{ marginTop: size * 0.13, fontSize: 13, color: T.sage, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

/* ================================================================
   Style Constants
   ================================================================ */
const SERIF = "'EB Garamond', Georgia, 'Palatino Linotype', Palatino, serif";
const SANS = "'Segoe UI', system-ui, -apple-system, sans-serif";

const PILLAR_NAMES = [
  "Academic Excellence",
  "Student Development",
  "Teaching & Learning",
  "Catholic School Identity",
];
const PILLAR_KEYS = ["AE", "SD", "TL", "CS"];

const STATUS_LABELS = ["Excellent", "Good", "Developing", "Needs Support"];

/* ================================================================
   Excel Parsing
   ================================================================ */
function parseWorkbook(wb) {
  const read = (name) => {
    const ws = wb.Sheets[name];
    return ws ? XLSX.utils.sheet_to_json(ws) : [];
  };

  const register = read("School Register");
  const aeRows   = read("AE Input");
  const sdRows   = read("SD Input");
  const tlRows   = read("TL Input");
  const csRows   = read("CS Input");

  const kpiMap = (rows, prefix) => {
    const m = {};
    rows.forEach((r) => {
      const id = r["School ID"] ?? r["SchoolID"] ?? r["school_id"];
      if (id == null) return;
      const scores = Object.keys(r)
        .filter((k) => k !== "School ID" && k !== "SchoolID" && k !== "school_id")
        .map((k) => Number(r[k]) || 0);
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      m[id] = { scores, avg, prefix };
    });
    return m;
  };

  const ae = kpiMap(aeRows, "AE");
  const sd = kpiMap(sdRows, "SD");
  const tl = kpiMap(tlRows, "TL");
  const cs = kpiMap(csRows, "CS");

  const schools = register.map((r) => {
    const id = r["School ID"] ?? r["SchoolID"] ?? r["school_id"] ?? r["ID"];
    const name = r["School Name"] ?? r["SchoolName"] ?? r["school_name"] ?? r["Name"] ?? `School ${id}`;
    const district = r["District"] ?? r["district"] ?? r["Region"] ?? "";
    const type = r["Type"] ?? r["type"] ?? r["Category"] ?? "";

    const pillars = {
      AE: ae[id]?.avg ?? 0,
      SD: sd[id]?.avg ?? 0,
      TL: tl[id]?.avg ?? 0,
      CS: cs[id]?.avg ?? 0,
    };
    const overall = (pillars.AE + pillars.SD + pillars.TL + pillars.CS) / 4;

    let status;
    if (overall >= 80) status = "Excellent";
    else if (overall >= 60) status = "Good";
    else if (overall >= 40) status = "Developing";
    else status = "Needs Support";

    return { id, name, district, type, pillars, overall, status };
  });

  schools.sort((a, b) => b.overall - a.overall);
  return schools;
}

/* ================================================================
   Main Component
   ================================================================ */
export default function CEBMDashboard() {
  const [schools, setSchools] = useState(null);
  const [view, setView] = useState("dashboard");
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [error, setError] = useState("");

  /* ---------- File upload handler ---------- */
  const handleUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "binary" });
        const parsed = parseWorkbook(wb);
        if (parsed.length === 0) {
          setError("No school data found. Ensure the workbook has a 'School Register' sheet.");
          return;
        }
        setSchools(parsed);
        setView("dashboard");
      } catch (err) {
        setError("Failed to parse workbook: " + err.message);
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  /* ---------- Derived data ---------- */
  const stats = useMemo(() => {
    if (!schools) return null;
    const n = schools.length;
    const avgOverall = schools.reduce((s, sc) => s + sc.overall, 0) / n;
    const pillarAvgs = PILLAR_KEYS.map(
      (k) => schools.reduce((s, sc) => s + sc.pillars[k], 0) / n
    );
    const statusCounts = STATUS_LABELS.map(
      (label) => schools.filter((s) => s.status === label).length
    );
    return { n, avgOverall, pillarAvgs, statusCounts };
  }, [schools]);

  /* ---------- Styles ---------- */
  const S = {
    page: { minHeight: "100vh", background: T.bg, fontFamily: SANS, color: T.green2 },
    header: {
      background: `linear-gradient(135deg, ${T.green1} 0%, ${T.green2} 100%)`,
      padding: "0 24px", position: "sticky", top: 0, zIndex: 100,
      boxShadow: "0 2px 12px rgba(27,67,50,0.25)",
    },
    headerInner: {
      maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center",
      justifyContent: "space-between", padding: "14px 0", flexWrap: "wrap", gap: 12,
    },
    logoGroup: { display: "flex", alignItems: "center", gap: 10 },
    title: { fontFamily: SERIF, fontSize: 26, fontWeight: 700, color: T.cream, letterSpacing: "0.08em", margin: 0 },
    subtitle: { fontSize: 12, color: T.sage, margin: 0, letterSpacing: "0.04em" },
    nav: { display: "flex", gap: 4 },
    navBtn: (active) => ({
      background: active ? T.gold : "transparent",
      border: `1px solid ${active ? T.gold : "rgba(245,239,224,0.2)"}`,
      color: active ? T.green2 : T.cream, padding: "8px 18px",
      borderRadius: 6, fontSize: 14, fontWeight: active ? 700 : 400,
      cursor: "pointer", fontFamily: SANS, transition: "all 0.2s",
    }),
    main: { maxWidth: 1280, margin: "0 auto", padding: 24 },
    card: {
      background: T.white, border: `1px solid #e0e8e0`, borderRadius: 12,
      padding: 20, boxShadow: "0 1px 6px rgba(27,67,50,0.06)",
    },
    heroCard: {
      background: `linear-gradient(135deg, ${T.green1} 0%, ${T.green2} 100%)`,
      borderRadius: 12, padding: 20, boxShadow: "0 4px 16px rgba(27,67,50,0.2)",
    },
    sectionTitle: {
      fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: T.green2,
      margin: "0 0 14px 0", paddingBottom: 8, borderBottom: `2px solid ${T.sage}`,
    },
    goldBtn: {
      padding: "10px 24px", background: T.gold, color: T.green2, border: "none",
      borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: SANS,
    },
    greenBtn: {
      padding: "10px 24px", background: T.green1, color: T.cream, border: "none",
      borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: SANS,
    },
    footer: {
      background: `linear-gradient(135deg, ${T.green2} 0%, #0d2a1f 100%)`,
      padding: "20px 24px", marginTop: 32,
    },
    footerInner: {
      maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center",
      justifyContent: "space-between", flexWrap: "wrap", gap: 12,
    },
  };

  /* ---------- Upload Screen ---------- */
  if (!schools) {
    return (
      <div style={S.page}>
        <header style={S.header}>
          <div style={S.headerInner}>
            <div style={S.logoGroup}>
              <BloomCross size={44} />
              <div>
                <h1 style={S.title}>BLOOM</h1>
                <p style={S.subtitle}>Catholic Education Balanced Metric</p>
              </div>
            </div>
          </div>
        </header>
        <main style={{ ...S.main, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh" }}>
          <div style={{ ...S.card, maxWidth: 520, textAlign: "center", padding: 48 }}>
            <BloomCross size={80} />
            <h2 style={{ fontFamily: SERIF, fontSize: 28, color: T.green2, margin: "20px 0 8px" }}>
              CEBM School Dashboard
            </h2>
            <p style={{ color: T.sage, marginBottom: 28, fontSize: 15 }}>
              Upload the <strong>CEBM_BSC_100_Schools.xlsx</strong> workbook to begin.
              <br />
              <span style={{ fontSize: 13 }}>
                Required sheets: School Register, AE Input, SD Input, TL Input, CS Input
              </span>
            </p>
            <label style={{ ...S.goldBtn, display: "inline-block", cursor: "pointer" }}>
              Upload Workbook
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} hidden />
            </label>
            {error && (
              <p style={{ color: "#D9534F", marginTop: 16, fontSize: 14 }}>{error}</p>
            )}
          </div>
        </main>
        <Footer S={S} />
      </div>
    );
  }

  /* ---------- Data for charts ---------- */
  const statusPieData = STATUS_LABELS.map((label, i) => ({
    name: label,
    value: stats.statusCounts[i],
  }));

  const pillarBarData = PILLAR_KEYS.map((k, i) => ({
    pillar: PILLAR_NAMES[i],
    score: Number(stats.pillarAvgs[i].toFixed(1)),
  }));

  const top10 = schools.slice(0, 10);
  const bottom10 = [...schools].slice(-10).reverse();

  /* ---------- School View Data ---------- */
  const schoolRadar = selectedSchool
    ? PILLAR_KEYS.map((k, i) => ({
        pillar: PILLAR_NAMES[i],
        score: selectedSchool.pillars[k],
        fullMark: 100,
      }))
    : [];

  const openSchool = (school) => {
    setSelectedSchool(school);
    setView("school");
  };

  /* ---------- Render ---------- */
  return (
    <div style={S.page}>
      {/* Header */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.logoGroup}>
            <BloomCross size={44} />
            <div>
              <h1 style={S.title}>BLOOM</h1>
              <p style={S.subtitle}>CEBM School Dashboard &mdash; Trinidad &amp; Tobago</p>
            </div>
          </div>
          <nav style={S.nav}>
            {[
              ["dashboard", "Dashboard"],
              ["rankings", "Rankings"],
              ...(selectedSchool ? [["school", selectedSchool.name]] : []),
            ].map(([key, label]) => (
              <button key={key} style={S.navBtn(view === key)} onClick={() => setView(key)}>
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main style={S.main}>
        {/* ===== DASHBOARD VIEW ===== */}
        {view === "dashboard" && (
          <>
            {/* Summary Gauges */}
            <section style={{ marginBottom: 32 }}>
              <h2 style={S.sectionTitle}>System Overview</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "center" }}>
                <div style={S.heroCard}>
                  <ScoreGauge value={stats.avgOverall} label="Overall Score" size={140} color={T.cream} />
                </div>
                {PILLAR_KEYS.map((k, i) => (
                  <div key={k} style={S.heroCard}>
                    <ScoreGauge value={stats.pillarAvgs[i]} label={PILLAR_NAMES[i]} size={120} color={PILLAR_COLORS[i]} />
                  </div>
                ))}
              </div>
            </section>

            {/* Status Distribution + Pillar Performance */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 20, marginBottom: 32 }}>
              <div style={S.card}>
                <h3 style={{ fontFamily: SERIF, fontSize: 16, color: T.green1, marginBottom: 12 }}>
                  Status Distribution
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={100}
                      paddingAngle={3} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {statusPieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={S.card}>
                <h3 style={{ fontFamily: SERIF, fontSize: 16, color: T.green1, marginBottom: 12 }}>
                  Pillar Performance (System Average)
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={pillarBarData} margin={{ top: 8, right: 16, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.sage} opacity={0.3} />
                    <XAxis dataKey="pillar" tick={{ fill: T.green2, fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: T.green2, fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="score" name="Avg Score" radius={[4, 4, 0, 0]}>
                      {pillarBarData.map((_, i) => (
                        <Cell key={i} fill={PILLAR_COLORS[i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top 10 / Bottom 10 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 20, marginBottom: 32 }}>
              <SchoolMiniTable title="Top 10 Schools" data={top10} S={S} onSelect={openSchool} />
              <SchoolMiniTable title="Bottom 10 Schools" data={bottom10} S={S} onSelect={openSchool} />
            </div>
          </>
        )}

        {/* ===== RANKINGS VIEW ===== */}
        {view === "rankings" && (
          <section>
            <h2 style={S.sectionTitle}>Full Rankings &mdash; {schools.length} Schools</h2>
            <div style={{ ...S.card, overflowX: "auto", padding: 0 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: `linear-gradient(135deg, ${T.green1}, ${T.green2})` }}>
                    {["Rank", "School", "District", "AE", "SD", "TL", "CS", "Overall", "Status"].map((h) => (
                      <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: T.cream, fontFamily: SERIF, fontWeight: 600, letterSpacing: "0.03em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schools.map((s, i) => (
                    <tr key={s.id} style={{ borderBottom: `1px solid ${T.sageLight}`, cursor: "pointer" }}
                      onClick={() => openSchool(s)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f5f0")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: T.green1 }}>{i + 1}</td>
                      <td style={{ padding: "10px 14px" }}>{s.name}</td>
                      <td style={{ padding: "10px 14px", color: "#666" }}>{s.district}</td>
                      <td style={{ padding: "10px 14px" }}>{s.pillars.AE.toFixed(1)}</td>
                      <td style={{ padding: "10px 14px" }}>{s.pillars.SD.toFixed(1)}</td>
                      <td style={{ padding: "10px 14px" }}>{s.pillars.TL.toFixed(1)}</td>
                      <td style={{ padding: "10px 14px" }}>{s.pillars.CS.toFixed(1)}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700 }}>{s.overall.toFixed(1)}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <StatusBadge status={s.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ===== SCHOOL VIEW ===== */}
        {view === "school" && selectedSchool && (
          <section>
            <button style={{ ...S.greenBtn, marginBottom: 20 }} onClick={() => setView("rankings")}>
              &larr; Back to Rankings
            </button>
            <h2 style={S.sectionTitle}>{selectedSchool.name}</h2>

            {/* School meta */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
              <MetaChip label="Rank" value={schools.findIndex((s) => s.id === selectedSchool.id) + 1} />
              <MetaChip label="District" value={selectedSchool.district || "N/A"} />
              <MetaChip label="Type" value={selectedSchool.type || "N/A"} />
              <MetaChip label="Overall" value={selectedSchool.overall.toFixed(1)} />
              <MetaChip label="Status" value={selectedSchool.status} />
            </div>

            {/* Pillar gauges */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "center", marginBottom: 28 }}>
              {PILLAR_KEYS.map((k, i) => (
                <div key={k} style={S.heroCard}>
                  <ScoreGauge value={selectedSchool.pillars[k]} label={PILLAR_NAMES[i]} size={110} color={PILLAR_COLORS[i]} />
                </div>
              ))}
            </div>

            {/* Radar */}
            <div style={{ ...S.card, maxWidth: 560, margin: "0 auto" }}>
              <h3 style={{ fontFamily: SERIF, fontSize: 16, color: T.green1, marginBottom: 8 }}>
                Pillar Radar
              </h3>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={schoolRadar}>
                  <PolarGrid stroke={T.sage} />
                  <PolarAngleAxis dataKey="pillar" tick={{ fill: T.green2, fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: T.sage, fontSize: 10 }} />
                  <Radar name="Score" dataKey="score" stroke={T.green1} fill={T.green1} fillOpacity={0.3} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}
      </main>

      <Footer S={S} />
    </div>
  );
}

/* ================================================================
   Sub-components
   ================================================================ */
function Footer({ S }) {
  return (
    <footer style={S.footer}>
      <div style={S.footerInner}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: SERIF, fontSize: 15, color: T.cream, letterSpacing: "0.04em" }}>
          <BloomCross size={28} />
          <span>ANTHICITY &mdash; Learning for Life</span>
        </div>
        <p style={{ fontSize: 13, color: T.sage, margin: 0 }}>&copy; 2026 W. Gopaul. All rights reserved.</p>
      </div>
    </footer>
  );
}

function StatusBadge({ status }) {
  const bg = { Excellent: "#d4edda", Good: "#e8f0e8", Developing: "#fef3cd", "Needs Support": "#f8d7da" };
  const fg = { Excellent: T.green2, Good: "#3A7D5C", Developing: "#7a5e00", "Needs Support": "#721c24" };
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 12,
      fontSize: 12, fontWeight: 700, background: bg[status] || "#eee", color: fg[status] || "#333",
    }}>
      {status}
    </span>
  );
}

function MetaChip({ label, value }) {
  return (
    <div style={{
      background: T.sageLight, border: `1px solid ${T.sage}`, borderRadius: 8,
      padding: "8px 16px", display: "flex", flexDirection: "column", gap: 2,
    }}>
      <span style={{ fontSize: 11, color: T.sage, fontWeight: 600, textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 700, color: T.green2, fontFamily: SERIF }}>{value}</span>
    </div>
  );
}

function SchoolMiniTable({ title, data, S, onSelect }) {
  return (
    <div style={{ ...S.card, padding: 0 }}>
      <h3 style={{
        fontFamily: SERIF, fontSize: 16, color: T.green1, padding: "14px 16px 10px",
        borderBottom: `1px solid ${T.sageLight}`, margin: 0,
      }}>
        {title}
      </h3>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: T.sageLight }}>
            <th style={{ padding: "8px 12px", textAlign: "left", color: T.green2 }}>#</th>
            <th style={{ padding: "8px 12px", textAlign: "left", color: T.green2 }}>School</th>
            <th style={{ padding: "8px 12px", textAlign: "right", color: T.green2 }}>Score</th>
            <th style={{ padding: "8px 12px", textAlign: "left", color: T.green2 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((s, i) => (
            <tr key={s.id} style={{ borderBottom: `1px solid ${T.sageLight}`, cursor: "pointer" }}
              onClick={() => onSelect(s)}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f5f0")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
              <td style={{ padding: "8px 12px", fontWeight: 700, color: T.green1 }}>{i + 1}</td>
              <td style={{ padding: "8px 12px" }}>{s.name}</td>
              <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>{s.overall.toFixed(1)}</td>
              <td style={{ padding: "8px 12px" }}><StatusBadge status={s.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
