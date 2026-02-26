import { useState, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.sageLight} strokeWidth="10" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s ease" }} />
        </svg>
        <div style={{
          position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: SERIF, fontSize: size * 0.24, fontWeight: 700, color: T.cream,
        }}>
          {pct.toFixed(1)}
        </div>
      </div>
      <div style={{ fontSize: 13, color: T.sage, fontWeight: 600, textAlign: "center", lineHeight: 1.2, maxWidth: size + 20 }}>
        {label}
      </div>
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

  const kpiMap = (rows) => {
    const m = {};
    rows.forEach((r) => {
      const id = r["School ID"] ?? r["SchoolID"] ?? r["school_id"];
      if (id == null) return;
      const kpiEntries = {};
      const scores = [];
      Object.keys(r).forEach((k) => {
        if (k === "School ID" || k === "SchoolID" || k === "school_id") return;
        const val = Number(r[k]) || 0;
        kpiEntries[k] = val;
        scores.push(val);
      });
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      m[id] = { scores, avg, kpis: kpiEntries };
    });
    return m;
  };

  const ae = kpiMap(aeRows);
  const sd = kpiMap(sdRows);
  const tl = kpiMap(tlRows);
  const cs = kpiMap(csRows);

  const schools = register.map((r, idx) => {
    // Flexible column matching — try common variants, then fall back to first column value
    const keys = Object.keys(r);
    const findCol = (...names) => {
      for (const n of names) {
        if (r[n] != null) return r[n];
      }
      return undefined;
    };

    const id = findCol("School ID", "SchoolID", "school_id", "ID", "id") ?? (keys[0] ? r[keys[0]] : idx + 1);
    const name = findCol("School Name", "SchoolName", "school_name", "Name", "name") ?? `School ${id}`;
    const district = findCol("District", "district", "Region", "region") ?? "";
    const type = findCol("Type", "type", "Category", "category") ?? "";

    const pillars = {
      AE: ae[id]?.avg ?? 0,
      SD: sd[id]?.avg ?? 0,
      TL: tl[id]?.avg ?? 0,
      CS: cs[id]?.avg ?? 0,
    };
    const kpiDetail = {
      AE: ae[id]?.kpis ?? {},
      SD: sd[id]?.kpis ?? {},
      TL: tl[id]?.kpis ?? {},
      CS: cs[id]?.kpis ?? {},
    };
    const overall = (pillars.AE + pillars.SD + pillars.TL + pillars.CS) / 4;

    let status;
    if (overall >= 80) status = "Excellent";
    else if (overall >= 60) status = "Good";
    else if (overall >= 40) status = "Developing";
    else status = "Needs Support";

    return { id, name, district, type, pillars, kpiDetail, overall, status };
  });

  schools.sort((a, b) => b.overall - a.overall);
  return schools;
}

/* ================================================================
   Sample Data — 3 Example Schools
   ================================================================ */
function generateSampleSchools() {
  return [
    {
      id: "SCH001",
      name: "Holy Name Convent — Port of Spain",
      district: "Port of Spain & Environs",
      type: "Secondary",
      pillars: { AE: 82.5, SD: 78.3, TL: 85.1, CS: 88.0 },
      kpiDetail: {
        AE: { "Literacy Rate": 88, "Numeracy Rate": 79, "SEA Pass Rate": 84, "CSEC 5+": 78, "Value Added": 83 },
        SD: { "Attendance Rate": 82, "Co-Curricular": 74, "Leadership Programmes": 76, "Student Wellbeing": 81 },
        TL: { "Teacher Qualifications": 90, "Lesson Quality": 82, "Professional Dev": 84, "Differentiation": 84 },
        CS: { "Faith Formation": 91, "Sacramental Life": 86, "Service Learning": 85, "Catholic Ethos": 90 },
      },
      overall: (82.5 + 78.3 + 85.1 + 88.0) / 4,
      status: "Excellent",
    },
    {
      id: "SCH002",
      name: "Presentation College — Chaguanas",
      district: "Caroni",
      type: "Secondary",
      pillars: { AE: 68.2, SD: 62.7, TL: 70.4, CS: 65.0 },
      kpiDetail: {
        AE: { "Literacy Rate": 72, "Numeracy Rate": 64, "SEA Pass Rate": 70, "CSEC 5+": 62, "Value Added": 73 },
        SD: { "Attendance Rate": 68, "Co-Curricular": 58, "Leadership Programmes": 60, "Student Wellbeing": 65 },
        TL: { "Teacher Qualifications": 75, "Lesson Quality": 68, "Professional Dev": 70, "Differentiation": 68 },
        CS: { "Faith Formation": 70, "Sacramental Life": 62, "Service Learning": 60, "Catholic Ethos": 68 },
      },
      overall: (68.2 + 62.7 + 70.4 + 65.0) / 4,
      status: "Good",
    },
    {
      id: "SCH003",
      name: "St. Mary\u2019s RC Primary — Siparia",
      district: "South",
      type: "Primary",
      pillars: { AE: 45.8, SD: 52.1, TL: 48.6, CS: 55.3 },
      kpiDetail: {
        AE: { "Literacy Rate": 50, "Numeracy Rate": 42, "SEA Pass Rate": 44, "CSEC 5+": 0, "Value Added": 47 },
        SD: { "Attendance Rate": 58, "Co-Curricular": 48, "Leadership Programmes": 46, "Student Wellbeing": 56 },
        TL: { "Teacher Qualifications": 55, "Lesson Quality": 44, "Professional Dev": 46, "Differentiation": 49 },
        CS: { "Faith Formation": 60, "Sacramental Life": 52, "Service Learning": 50, "Catholic Ethos": 59 },
      },
      overall: (45.8 + 52.1 + 48.6 + 55.3) / 4,
      status: "Developing",
    },
  ].sort((a, b) => b.overall - a.overall);
}

/* ================================================================
   Zoho API Integration
   ================================================================ */
async function fetchZohoData(config) {
  const { domain, appName, reportName, authToken } = config;
  const baseUrl = `https://${domain}/api/v2/${appName}/report/${reportName}`;

  const headers = { Authorization: `Zoho-oauthtoken ${authToken}` };

  const resp = await fetch(baseUrl, {
    method: "GET",
    headers,
    mode: "cors",
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Zoho API ${resp.status}: ${errText || resp.statusText}`);
  }

  const json = await resp.json();
  return json.data || json;
}

/* ================================================================
   School Analysis Helpers
   ================================================================ */
function computeSchoolAnalysis(school, allSchools, stats) {
  const rank = allSchools.findIndex((s) => s.id === school.id) + 1;
  const n = allSchools.length;
  const percentile = ((n - rank) / n * 100).toFixed(1);

  // Pillar vs system comparison
  const pillarComparison = PILLAR_KEYS.map((k, i) => {
    const schoolScore = school.pillars[k];
    const sysAvg = stats.pillarAvgs[i];
    const diff = schoolScore - sysAvg;
    const allScores = allSchools.map((s) => s.pillars[k]).sort((a, b) => a - b);
    const pillarRank = allSchools.filter((s) => s.pillars[k] > schoolScore).length + 1;
    return {
      key: k,
      name: PILLAR_NAMES[i],
      score: schoolScore,
      sysAvg,
      diff,
      pillarRank,
      min: allScores[0] || 0,
      max: allScores[allScores.length - 1] || 0,
    };
  });

  // Strengths and weaknesses
  const sorted = [...pillarComparison].sort((a, b) => b.score - a.score);
  const strengths = sorted.filter((p) => p.diff > 0);
  const weaknesses = sorted.filter((p) => p.diff <= 0);

  // KPI-level breakdown
  const kpiBreakdown = PILLAR_KEYS.map((k, i) => {
    const kpis = school.kpiDetail[k];
    const entries = Object.entries(kpis).map(([name, score]) => {
      // Compute system average for this specific KPI
      const kpiAvgs = allSchools.map((s) => s.kpiDetail[k]?.[name] ?? 0);
      const kpiSysAvg = kpiAvgs.length ? kpiAvgs.reduce((a, b) => a + b, 0) / kpiAvgs.length : 0;
      return { name, score, sysAvg: kpiSysAvg, diff: score - kpiSysAvg };
    });
    return { pillar: PILLAR_NAMES[i], key: k, kpis: entries };
  });

  // District comparison
  const districtPeers = allSchools.filter((s) => s.district === school.district && s.id !== school.id);
  const districtAvg = districtPeers.length > 0
    ? districtPeers.reduce((sum, s) => sum + s.overall, 0) / districtPeers.length
    : null;
  const districtRank = districtPeers.length > 0
    ? [...districtPeers, school].sort((a, b) => b.overall - a.overall).findIndex((s) => s.id === school.id) + 1
    : 1;
  const districtTotal = districtPeers.length + 1;

  return {
    rank, percentile, pillarComparison, strengths, weaknesses,
    kpiBreakdown, districtAvg, districtRank, districtTotal, districtPeers,
  };
}

/* ================================================================
   PDF Report Generation
   ================================================================ */
function pdfHeader(doc, title) {
  doc.setFillColor(58, 125, 92);
  doc.rect(0, 0, 210, 32, "F");
  doc.setFillColor(27, 67, 50);
  doc.rect(0, 28, 210, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(245, 239, 224);
  doc.text("BLOOM", 14, 16);

  doc.setFontSize(9);
  doc.setTextColor(143, 174, 139);
  doc.text("CEBM School Dashboard — Trinidad & Tobago", 14, 24);

  doc.setFontSize(10);
  doc.setTextColor(245, 239, 224);
  doc.text(title, 196, 16, { align: "right" });
  doc.setFontSize(8);
  doc.text(new Date().toLocaleDateString("en-TT", { year: "numeric", month: "long", day: "numeric" }), 196, 22, { align: "right" });

  return 40;
}

function pdfFooter(doc) {
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(27, 67, 50);
    doc.rect(0, 285, 210, 12, "F");
    doc.setFontSize(7);
    doc.setTextColor(143, 174, 139);
    doc.text("ANTHICITY — Learning for Life", 14, 291);
    doc.text("\u00A9 Bloom 2026 W. Gopaul", 105, 291, { align: "center" });
    doc.text(`Page ${i} of ${pages}`, 196, 291, { align: "right" });
  }
}

const AUTO_TABLE_STYLES = {
  theme: "grid",
  headStyles: { fillColor: [58, 125, 92], textColor: [245, 239, 224], fontStyle: "bold" },
  alternateRowStyles: { fillColor: [237, 244, 235] },
  margin: { left: 14, right: 14 },
};

function generateDashboardPDF(schools, stats) {
  const doc = new jsPDF();
  let y = pdfHeader(doc, "System Overview Report");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(27, 67, 50);
  doc.text("System Summary", 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(58, 125, 92);
  const summaryItems = [
    `Total Schools: ${stats.n}`,
    `Overall Average: ${stats.avgOverall.toFixed(1)}%`,
    ...PILLAR_KEYS.map((k, i) => `${PILLAR_NAMES[i]}: ${stats.pillarAvgs[i].toFixed(1)}%`),
  ];
  summaryItems.forEach((item) => { doc.text(item, 14, y); y += 6; });
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(27, 67, 50);
  doc.text("Status Distribution", 14, y);
  y += 6;

  doc.autoTable({
    ...AUTO_TABLE_STYLES,
    startY: y,
    head: [["Status", "Count", "Percentage"]],
    body: STATUS_LABELS.map((label, i) => [
      label, stats.statusCounts[i],
      `${((stats.statusCounts[i] / stats.n) * 100).toFixed(1)}%`,
    ]),
    styles: { fontSize: 9 },
  });
  y = doc.lastAutoTable.finalY + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(27, 67, 50);
  doc.text("Top 10 Schools", 14, y);
  y += 6;

  doc.autoTable({
    ...AUTO_TABLE_STYLES,
    startY: y,
    head: [["Rank", "School", "District", "AE", "SD", "TL", "CS", "Overall", "Status"]],
    body: schools.slice(0, 10).map((s, i) => [
      i + 1, s.name, s.district,
      s.pillars.AE.toFixed(1), s.pillars.SD.toFixed(1),
      s.pillars.TL.toFixed(1), s.pillars.CS.toFixed(1),
      s.overall.toFixed(1), s.status,
    ]),
    styles: { fontSize: 8 },
  });

  doc.addPage();
  y = pdfHeader(doc, "System Overview Report");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(27, 67, 50);
  doc.text("Bottom 10 Schools", 14, y);
  y += 6;

  doc.autoTable({
    ...AUTO_TABLE_STYLES,
    startY: y,
    head: [["Rank", "School", "District", "AE", "SD", "TL", "CS", "Overall", "Status"]],
    body: [...schools].slice(-10).reverse().map((s) => [
      schools.indexOf(s) + 1, s.name, s.district,
      s.pillars.AE.toFixed(1), s.pillars.SD.toFixed(1),
      s.pillars.TL.toFixed(1), s.pillars.CS.toFixed(1),
      s.overall.toFixed(1), s.status,
    ]),
    styles: { fontSize: 8 },
  });

  pdfFooter(doc);
  doc.save("CEBM_Dashboard_Overview.pdf");
}

function generateRankingsPDF(schools) {
  const doc = new jsPDF();
  let y = pdfHeader(doc, "Full Rankings Report");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(27, 67, 50);
  doc.text(`Full Rankings \u2014 ${schools.length} Schools`, 14, y);
  y += 6;

  doc.autoTable({
    ...AUTO_TABLE_STYLES,
    startY: y,
    head: [["Rank", "School", "District", "AE", "SD", "TL", "CS", "Overall", "Status"]],
    body: schools.map((s, i) => [
      i + 1, s.name, s.district,
      s.pillars.AE.toFixed(1), s.pillars.SD.toFixed(1),
      s.pillars.TL.toFixed(1), s.pillars.CS.toFixed(1),
      s.overall.toFixed(1), s.status,
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    didDrawPage: () => { pdfHeader(doc, "Full Rankings Report"); },
  });

  pdfFooter(doc);
  doc.save("CEBM_Full_Rankings.pdf");
}

function generateSchoolPDF(school, rank) {
  const doc = new jsPDF();
  let y = pdfHeader(doc, "School Report Card");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(27, 67, 50);
  doc.text(school.name, 14, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(58, 125, 92);
  const meta = [
    ["Rank", `${rank} of 100`],
    ["District", school.district || "N/A"],
    ["Type", school.type || "N/A"],
    ["Overall Score", `${school.overall.toFixed(1)}%`],
    ["Status", school.status],
  ];
  meta.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}: `, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 14 + doc.getTextWidth(`${label}: `), y);
    y += 6;
  });
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(27, 67, 50);
  doc.text("Pillar Performance", 14, y);
  y += 6;

  doc.autoTable({
    ...AUTO_TABLE_STYLES,
    startY: y,
    head: [["Pillar", "Score (%)", "Rating"]],
    body: PILLAR_KEYS.map((k, i) => {
      const score = school.pillars[k];
      const rating = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Developing" : "Needs Support";
      return [PILLAR_NAMES[i], score.toFixed(1), rating];
    }),
    styles: { fontSize: 10 },
  });
  y = doc.lastAutoTable.finalY + 10;

  doc.setFillColor(237, 244, 235);
  doc.roundedRect(14, y, 182, 24, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(27, 67, 50);
  doc.text(`Overall Score: ${school.overall.toFixed(1)}%`, 105, y + 10, { align: "center" });
  doc.setFontSize(11);
  doc.setTextColor(58, 125, 92);
  doc.text(`Status: ${school.status}`, 105, y + 18, { align: "center" });

  y += 34;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(27, 67, 50);
  doc.text("Score Breakdown", 14, y);
  y += 8;

  const barColors = [[58, 125, 92], [200, 151, 62], [91, 154, 122], [212, 168, 83]];
  PILLAR_KEYS.forEach((k, i) => {
    const score = school.pillars[k];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(27, 67, 50);
    doc.text(PILLAR_NAMES[i], 14, y);
    doc.setFillColor(237, 244, 235);
    doc.roundedRect(70, y - 4, 110, 6, 2, 2, "F");
    const [cr, cg, cb] = barColors[i];
    doc.setFillColor(cr, cg, cb);
    doc.roundedRect(70, y - 4, (score / 100) * 110, 6, 2, 2, "F");
    doc.text(`${score.toFixed(1)}%`, 184, y, { align: "right" });
    y += 10;
  });

  pdfFooter(doc);
  doc.save(`CEBM_${school.name.replace(/[^a-zA-Z0-9]/g, "_")}_Report.pdf`);
}

/* ================================================================
   School Analysis PDF (comprehensive)
   ================================================================ */
function generateAnalysisPDF(school, analysis, stats) {
  const doc = new jsPDF();
  let y = pdfHeader(doc, "Integration Analysis Report");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(27, 67, 50);
  doc.text(school.name, 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.setTextColor(58, 125, 92);
  doc.text(`Integration Analysis \u2014 Comprehensive School Report`, 14, y);
  y += 10;

  // Meta summary
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(27, 67, 50);
  const metaLines = [
    `Rank: ${analysis.rank} of ${stats.n}  |  Percentile: ${analysis.percentile}th  |  District: ${school.district || "N/A"}  |  Type: ${school.type || "N/A"}`,
    `Overall Score: ${school.overall.toFixed(1)}%  |  Status: ${school.status}`,
  ];
  metaLines.forEach((line) => { doc.text(line, 14, y); y += 5; });
  y += 4;

  // Pillar vs System comparison table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(27, 67, 50);
  doc.text("Pillar Performance vs System Average", 14, y);
  y += 5;

  doc.autoTable({
    ...AUTO_TABLE_STYLES,
    startY: y,
    head: [["Pillar", "School", "System Avg", "Variance", "Pillar Rank", "Min", "Max"]],
    body: analysis.pillarComparison.map((p) => [
      p.name,
      p.score.toFixed(1),
      p.sysAvg.toFixed(1),
      `${p.diff >= 0 ? "+" : ""}${p.diff.toFixed(1)}`,
      `${p.pillarRank} of ${stats.n}`,
      p.min.toFixed(1),
      p.max.toFixed(1),
    ]),
    styles: { fontSize: 8 },
  });
  y = doc.lastAutoTable.finalY + 8;

  // District comparison
  if (analysis.districtAvg !== null) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(27, 67, 50);
    doc.text("District Comparison", 14, y);
    y += 5;

    doc.autoTable({
      ...AUTO_TABLE_STYLES,
      startY: y,
      head: [["Metric", "Value"]],
      body: [
        ["District", school.district],
        ["District Rank", `${analysis.districtRank} of ${analysis.districtTotal}`],
        ["School Score", `${school.overall.toFixed(1)}%`],
        ["District Average", `${analysis.districtAvg.toFixed(1)}%`],
        ["Variance from District", `${(school.overall - analysis.districtAvg) >= 0 ? "+" : ""}${(school.overall - analysis.districtAvg).toFixed(1)}%`],
      ],
      styles: { fontSize: 8 },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // Strengths & Weaknesses
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(27, 67, 50);
  doc.text("Strengths (Above System Average)", 14, y);
  y += 5;

  if (analysis.strengths.length > 0) {
    doc.autoTable({
      ...AUTO_TABLE_STYLES,
      startY: y,
      head: [["Pillar", "Score", "System Avg", "Above By"]],
      body: analysis.strengths.map((p) => [
        p.name, p.score.toFixed(1), p.sysAvg.toFixed(1), `+${p.diff.toFixed(1)}`,
      ]),
      styles: { fontSize: 8 },
    });
    y = doc.lastAutoTable.finalY + 6;
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("No pillars above system average.", 14, y);
    y += 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(27, 67, 50);
  doc.text("Areas for Development (At or Below System Average)", 14, y);
  y += 5;

  if (analysis.weaknesses.length > 0) {
    doc.autoTable({
      ...AUTO_TABLE_STYLES,
      startY: y,
      head: [["Pillar", "Score", "System Avg", "Gap"]],
      body: analysis.weaknesses.map((p) => [
        p.name, p.score.toFixed(1), p.sysAvg.toFixed(1), p.diff.toFixed(1),
      ]),
      styles: { fontSize: 8 },
    });
    y = doc.lastAutoTable.finalY + 6;
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("All pillars above system average.", 14, y);
    y += 6;
  }

  // KPI-level breakdown on new page
  doc.addPage();
  y = pdfHeader(doc, "Integration Analysis Report");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(27, 67, 50);
  doc.text("KPI-Level Breakdown", 14, y);
  y += 8;

  analysis.kpiBreakdown.forEach((pillar) => {
    if (pillar.kpis.length === 0) return;

    // Check if we need a new page
    if (y > 240) {
      doc.addPage();
      y = pdfHeader(doc, "Integration Analysis Report");
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(58, 125, 92);
    doc.text(pillar.pillar, 14, y);
    y += 5;

    doc.autoTable({
      ...AUTO_TABLE_STYLES,
      startY: y,
      head: [["KPI", "School Score", "System Avg", "Variance"]],
      body: pillar.kpis.map((kpi) => [
        kpi.name,
        kpi.score.toFixed(1),
        kpi.sysAvg.toFixed(1),
        `${kpi.diff >= 0 ? "+" : ""}${kpi.diff.toFixed(1)}`,
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
    });
    y = doc.lastAutoTable.finalY + 8;
  });

  pdfFooter(doc);
  doc.save(`CEBM_${school.name.replace(/[^a-zA-Z0-9]/g, "_")}_Analysis.pdf`);
}

/* ================================================================
   Main Component
   ================================================================ */
export default function CEBMDashboard() {
  const [schools, setSchools] = useState(null);
  const [view, setView] = useState("dashboard");
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [error, setError] = useState("");

  // Zoho integration state
  const [showZoho, setShowZoho] = useState(false);
  const [zohoConfig, setZohoConfig] = useState({
    domain: "creator.zoho.com",
    appName: "",
    reportName: "",
    authToken: "",
  });
  const [zohoLoading, setZohoLoading] = useState(false);
  const [zohoError, setZohoError] = useState("");
  const [zohoSuccess, setZohoSuccess] = useState("");

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

  /* ---------- Single school upload handler (merges into existing data) ---------- */
  const handleSingleUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setError("");
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "binary" });
        const parsed = parseWorkbook(wb);
        if (parsed.length === 0) {
          setError("No school data found in uploaded file.");
          return;
        }
        setSchools((prev) => {
          const existing = prev || [];
          const existingIds = new Set(existing.map((s) => s.id));
          const newSchools = [];
          const updatedExisting = [...existing];
          parsed.forEach((school) => {
            if (existingIds.has(school.id)) {
              const idx = updatedExisting.findIndex((s) => s.id === school.id);
              if (idx !== -1) updatedExisting[idx] = school;
            } else {
              newSchools.push(school);
            }
          });
          const merged = [...updatedExisting, ...newSchools];
          merged.sort((a, b) => b.overall - a.overall);
          return merged;
        });
        // Refresh selectedSchool if it was updated
        setSelectedSchool((prev) => {
          if (!prev) return prev;
          const updated = parsed.find((s) => s.id === prev.id);
          return updated || prev;
        });
        setView("dashboard");
      } catch (err) {
        setError("Failed to parse file: " + err.message);
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  /* ---------- Load example data ---------- */
  const loadExampleData = useCallback(() => {
    setError("");
    setSchools(generateSampleSchools());
    setView("dashboard");
  }, []);

  /* ---------- Go Home (back to upload screen) ---------- */
  const goHome = useCallback(() => {
    setSchools(null);
    setSelectedSchool(null);
    setView("dashboard");
    setError("");
    setZohoError("");
    setZohoSuccess("");
  }, []);

  /* ---------- Zoho import handler ---------- */
  const handleZohoImport = useCallback(async () => {
    if (!zohoConfig.appName || !zohoConfig.authToken) {
      setZohoError("App Name and Auth Token are required.");
      return;
    }
    setZohoLoading(true);
    setZohoError("");
    setZohoSuccess("");

    try {
      // Fetch each report/sheet from Zoho
      const sheetNames = ["School Register", "AE Input", "SD Input", "TL Input", "CS Input"];
      const wb = XLSX.utils.book_new();

      for (const sheetName of sheetNames) {
        const reportName = zohoConfig.reportName
          ? `${zohoConfig.reportName}_${sheetName.replace(/\s/g, "_")}`
          : sheetName.replace(/\s/g, "_");

        try {
          const data = await fetchZohoData({
            ...zohoConfig,
            reportName,
          });

          if (Array.isArray(data) && data.length > 0) {
            const ws = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
          }
        } catch {
          // If individual sheet fails, try the combined report
          if (sheetName === "School Register") throw new Error(`Could not fetch "${reportName}" from Zoho.`);
        }
      }

      const parsed = parseWorkbook(wb);
      if (parsed.length === 0) {
        setZohoError("No school data found in Zoho response. Check report names.");
        return;
      }

      setSchools(parsed);
      setZohoSuccess(`Loaded ${parsed.length} schools from Zoho.`);
      setView("dashboard");
      setShowZoho(false);
    } catch (err) {
      setZohoError(err.message);
    } finally {
      setZohoLoading(false);
    }
  }, [zohoConfig]);

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

  /* ---------- School analysis ---------- */
  const schoolAnalysis = useMemo(() => {
    if (!selectedSchool || !schools || !stats) return null;
    return computeSchoolAnalysis(selectedSchool, schools, stats);
  }, [selectedSchool, schools, stats]);

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
    nav: { display: "flex", gap: 4, flexWrap: "wrap" },
    navBtn: (active) => ({
      background: active ? T.gold : "transparent",
      border: `1px solid ${active ? T.gold : "rgba(245,239,224,0.2)"}`,
      color: active ? T.green2 : T.cream, padding: "8px 18px",
      borderRadius: 6, fontSize: 14, fontWeight: active ? 700 : 400,
      cursor: "pointer", fontFamily: SANS, transition: "all 0.2s",
    }),
    main: { maxWidth: 1280, margin: "0 auto", padding: 24 },
    card: {
      background: T.white, border: "1px solid #e0e8e0", borderRadius: 12,
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
    sectionHeader: {
      display: "flex", alignItems: "center", justifyContent: "space-between",
      flexWrap: "wrap", gap: 12, marginBottom: 16, paddingBottom: 10,
      borderBottom: `2px solid ${T.sage}`,
    },
    sectionHeaderTitle: {
      fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: T.green2, margin: 0,
    },
    goldBtn: {
      padding: "10px 24px", background: T.gold, color: T.green2, border: "none",
      borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: SANS,
    },
    breadcrumb: {
      display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
      marginBottom: 18, fontSize: 14, fontFamily: SANS,
    },
    breadcrumbLink: {
      color: T.green1, cursor: "pointer", fontWeight: 600, background: "none",
      border: "none", padding: 0, fontSize: 14, fontFamily: SANS, textDecoration: "none",
    },
    breadcrumbSep: { color: T.sage, fontSize: 13, userSelect: "none" },
    breadcrumbCurrent: { color: T.green2, fontWeight: 700, fontSize: 14 },
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
    input: {
      padding: "10px 14px", border: `1px solid ${T.sage}`, borderRadius: 8,
      fontSize: 14, fontFamily: SANS, color: T.green2, background: T.white, width: "100%",
    },
    label: {
      fontSize: 12, fontWeight: 600, color: T.green2, marginBottom: 4, display: "block",
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
                <p style={S.subtitle}>Catholic Education Balanced Scorecard</p>
              </div>
            </div>
          </div>
        </header>
        <main style={{ ...S.main, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh" }}>
          <div style={{ ...S.card, maxWidth: 580, textAlign: "center", padding: 48 }}>
            <BloomCross size={80} />
            <h2 style={{ fontFamily: SERIF, fontSize: 28, color: T.green2, margin: "20px 0 8px" }}>
              CEBM School Dashboard
            </h2>
            <p style={{ color: T.sage, marginBottom: 28, fontSize: 15 }}>
              Upload a school workbook to view performance data, or try with example data.
              <br />
              <span style={{ fontSize: 13 }}>
                Required sheets: School Register, AE Input, SD Input, TL Input, CS Input
              </span>
            </p>

            {/* Primary upload button */}
            <label style={{
              ...S.goldBtn, display: "inline-flex", alignItems: "center", gap: 10,
              cursor: "pointer", padding: "14px 32px", fontSize: 17, borderRadius: 10,
              boxShadow: "0 4px 14px rgba(200,151,62,0.3)",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload School Workbook
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} hidden />
            </label>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 16 }}>
              <button style={{ ...S.greenBtn, fontSize: 13, padding: "8px 18px" }} onClick={loadExampleData}>
                Try with Example Data
              </button>
              <button style={{ ...S.greenBtn, fontSize: 13, padding: "8px 18px" }} onClick={() => setShowZoho(!showZoho)}>
                {showZoho ? "Hide Zoho" : "Connect to Zoho"}
              </button>
            </div>

            {error && (
              <p style={{ color: "#D9534F", marginTop: 16, fontSize: 14 }}>{error}</p>
            )}

            {/* Zoho Connection Panel */}
            {showZoho && (
              <div style={{ marginTop: 28, textAlign: "left", padding: "24px", background: T.sageLight, borderRadius: 12, border: `1px solid ${T.sage}` }}>
                <h3 style={{ fontFamily: SERIF, fontSize: 18, color: T.green2, marginBottom: 16 }}>
                  Zoho Database Connection
                </h3>

                <div style={{ marginBottom: 12 }}>
                  <label style={S.label}>Zoho Domain</label>
                  <select
                    style={S.input}
                    value={zohoConfig.domain}
                    onChange={(e) => setZohoConfig({ ...zohoConfig, domain: e.target.value })}
                  >
                    <option value="creator.zoho.com">creator.zoho.com (US)</option>
                    <option value="creator.zoho.eu">creator.zoho.eu (EU)</option>
                    <option value="creator.zoho.in">creator.zoho.in (India)</option>
                    <option value="creator.zoho.com.au">creator.zoho.com.au (AU)</option>
                  </select>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={S.label}>Application Name *</label>
                  <input
                    style={S.input}
                    placeholder="e.g. cebm-school-data"
                    value={zohoConfig.appName}
                    onChange={(e) => setZohoConfig({ ...zohoConfig, appName: e.target.value })}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={S.label}>Report Name Prefix (optional)</label>
                  <input
                    style={S.input}
                    placeholder="e.g. BSC_2026 (sheets appended automatically)"
                    value={zohoConfig.reportName}
                    onChange={(e) => setZohoConfig({ ...zohoConfig, reportName: e.target.value })}
                  />
                  <span style={{ fontSize: 11, color: T.sage }}>
                    Reports fetched: [prefix]_School_Register, [prefix]_AE_Input, etc.
                  </span>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={S.label}>OAuth Token *</label>
                  <input
                    style={S.input}
                    type="password"
                    placeholder="Zoho OAuth token"
                    value={zohoConfig.authToken}
                    onChange={(e) => setZohoConfig({ ...zohoConfig, authToken: e.target.value })}
                  />
                  <span style={{ fontSize: 11, color: T.sage }}>
                    Generate at Zoho API Console &rarr; Self Client &rarr; scope: ZohoCreator.report.READ
                  </span>
                </div>

                <button
                  style={{ ...S.goldBtn, width: "100%", opacity: zohoLoading ? 0.6 : 1 }}
                  onClick={handleZohoImport}
                  disabled={zohoLoading}
                >
                  {zohoLoading ? "Connecting to Zoho..." : "Import from Zoho"}
                </button>

                {zohoError && (
                  <p style={{ color: "#D9534F", marginTop: 12, fontSize: 13 }}>{zohoError}</p>
                )}
                {zohoSuccess && (
                  <p style={{ color: T.green1, marginTop: 12, fontSize: 13 }}>{zohoSuccess}</p>
                )}
              </div>
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

  const openAnalysis = (school) => {
    setSelectedSchool(school);
    setView("analysis");
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
            {[["dashboard", "Dashboard"], ["rankings", "Rankings"]].map(([key, label]) => (
              <button key={key} style={S.navBtn(view === key)} onClick={() => setView(key)}>
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main style={S.main}>
        {/* Breadcrumb trail */}
        <Breadcrumb view={view} school={selectedSchool} setView={setView} onHome={goHome} S={S} />

        {error && (
          <p style={{ color: "#D9534F", fontSize: 14, marginBottom: 12 }}>{error}</p>
        )}

        {/* ===== DASHBOARD VIEW ===== */}
        {view === "dashboard" && (
          <>
            <section style={{ marginBottom: 32 }}>
              <div style={S.sectionHeader}>
                <h2 style={S.sectionHeaderTitle}>System Overview</h2>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <label style={{ ...S.greenBtn, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 2v16M2 10h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                    </svg>
                    Add School
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleSingleUpload} hidden />
                  </label>
                  <button style={S.goldBtn} onClick={() => generateDashboardPDF(schools, stats)}>
                    Export Dashboard PDF
                  </button>
                </div>
              </div>
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 20, marginBottom: 32 }}>
              <SchoolMiniTable title="Top 10 Schools" data={top10} S={S} onSelect={openSchool} />
              <SchoolMiniTable title="Bottom 10 Schools" data={bottom10} S={S} onSelect={openSchool} />
            </div>
          </>
        )}

        {/* ===== RANKINGS VIEW ===== */}
        {view === "rankings" && (
          <section>
            <div style={S.sectionHeader}>
              <h2 style={S.sectionHeaderTitle}>
                Full Rankings &mdash; {schools.length} Schools
              </h2>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <label style={{ ...S.greenBtn, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 2v16M2 10h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                  </svg>
                  Add School
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleSingleUpload} hidden />
                </label>
                <button style={S.goldBtn} onClick={() => generateRankingsPDF(schools)}>
                  Export Rankings PDF
                </button>
              </div>
            </div>
            <div style={{ ...S.card, overflowX: "auto", padding: 0 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: `linear-gradient(135deg, ${T.green1}, ${T.green2})` }}>
                    {["Rank", "School", "District", "AE", "SD", "TL", "CS", "Overall", "Status", ""].map((h) => (
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
                      <td style={{ padding: "10px 8px" }}>
                        <button
                          style={{ ...S.greenBtn, padding: "4px 12px", fontSize: 11 }}
                          onClick={(e) => { e.stopPropagation(); openAnalysis(s); }}
                        >
                          Analyse
                        </button>
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
            <div style={S.sectionHeader}>
              <h2 style={S.sectionHeaderTitle}>{selectedSchool.name}</h2>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={{ ...S.greenBtn, padding: "8px 16px", fontSize: 13 }} onClick={() => openAnalysis(selectedSchool)}>
                  Full Analysis
                </button>
                <button style={S.goldBtn} onClick={() => generateSchoolPDF(selectedSchool, schools.findIndex((s) => s.id === selectedSchool.id) + 1)}>
                  Export School PDF
                </button>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
              <MetaChip label="Rank" value={schools.findIndex((s) => s.id === selectedSchool.id) + 1} />
              <MetaChip label="District" value={selectedSchool.district || "N/A"} />
              <MetaChip label="Type" value={selectedSchool.type || "N/A"} />
              <MetaChip label="Overall" value={selectedSchool.overall.toFixed(1)} />
              <MetaChip label="Status" value={selectedSchool.status} />
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "center", marginBottom: 28 }}>
              {PILLAR_KEYS.map((k, i) => (
                <div key={k} style={S.heroCard}>
                  <ScoreGauge value={selectedSchool.pillars[k]} label={PILLAR_NAMES[i]} size={110} color={PILLAR_COLORS[i]} />
                </div>
              ))}
            </div>

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

        {/* ===== ANALYSIS VIEW ===== */}
        {view === "analysis" && selectedSchool && schoolAnalysis && (
          <section>
            <div style={S.sectionHeader}>
              <h2 style={S.sectionHeaderTitle}>
                Integration Analysis &mdash; {selectedSchool.name}
              </h2>
              <button style={S.goldBtn} onClick={() => generateAnalysisPDF(selectedSchool, schoolAnalysis, stats)}>
                Export Analysis PDF
              </button>
            </div>

            {/* Overview Cards */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
              <MetaChip label="Rank" value={`${schoolAnalysis.rank} of ${stats.n}`} />
              <MetaChip label="Percentile" value={`${schoolAnalysis.percentile}th`} />
              <MetaChip label="Overall" value={`${selectedSchool.overall.toFixed(1)}%`} />
              <MetaChip label="System Avg" value={`${stats.avgOverall.toFixed(1)}%`} />
              <MetaChip label="Variance" value={`${(selectedSchool.overall - stats.avgOverall) >= 0 ? "+" : ""}${(selectedSchool.overall - stats.avgOverall).toFixed(1)}%`} />
              <MetaChip label="Status" value={selectedSchool.status} />
            </div>

            {/* Pillar vs System Comparison Chart */}
            <div style={{ ...S.card, marginBottom: 24 }}>
              <h3 style={{ fontFamily: SERIF, fontSize: 16, color: T.green1, marginBottom: 12 }}>
                Pillar Performance vs System Average
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={schoolAnalysis.pillarComparison.map((p) => ({
                    pillar: p.name,
                    School: Number(p.score.toFixed(1)),
                    System: Number(p.sysAvg.toFixed(1)),
                  }))}
                  margin={{ top: 8, right: 16, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={T.sage} opacity={0.3} />
                  <XAxis dataKey="pillar" tick={{ fill: T.green2, fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: T.green2, fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="School" fill={T.green1} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="System" fill={T.sage} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pillar detail table */}
            <div style={{ ...S.card, marginBottom: 24, padding: 0, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: `linear-gradient(135deg, ${T.green1}, ${T.green2})` }}>
                    {["Pillar", "School Score", "System Avg", "Variance", "Pillar Rank", "Min", "Max"].map((h) => (
                      <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: T.cream, fontFamily: SERIF, fontWeight: 600 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schoolAnalysis.pillarComparison.map((p) => (
                    <tr key={p.key} style={{ borderBottom: `1px solid ${T.sageLight}` }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>{p.name}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700 }}>{p.score.toFixed(1)}</td>
                      <td style={{ padding: "10px 14px" }}>{p.sysAvg.toFixed(1)}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: p.diff >= 0 ? T.green1 : "#D9534F" }}>
                        {p.diff >= 0 ? "+" : ""}{p.diff.toFixed(1)}
                      </td>
                      <td style={{ padding: "10px 14px" }}>{p.pillarRank} of {stats.n}</td>
                      <td style={{ padding: "10px 14px", color: "#999" }}>{p.min.toFixed(1)}</td>
                      <td style={{ padding: "10px 14px", color: "#999" }}>{p.max.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Strengths & Weaknesses */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20, marginBottom: 24 }}>
              <div style={{ ...S.card, borderLeft: `4px solid ${T.green1}` }}>
                <h3 style={{ fontFamily: SERIF, fontSize: 16, color: T.green1, marginBottom: 12 }}>
                  Strengths (Above System Avg)
                </h3>
                {schoolAnalysis.strengths.length > 0 ? (
                  schoolAnalysis.strengths.map((p) => (
                    <div key={p.key} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.sageLight}` }}>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      <span style={{ color: T.green1, fontWeight: 700 }}>+{p.diff.toFixed(1)}</span>
                    </div>
                  ))
                ) : (
                  <p style={{ color: T.sage, fontStyle: "italic" }}>No pillars above system average.</p>
                )}
              </div>
              <div style={{ ...S.card, borderLeft: "4px solid #D9534F" }}>
                <h3 style={{ fontFamily: SERIF, fontSize: 16, color: "#D9534F", marginBottom: 12 }}>
                  Areas for Development
                </h3>
                {schoolAnalysis.weaknesses.length > 0 ? (
                  schoolAnalysis.weaknesses.map((p) => (
                    <div key={p.key} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.sageLight}` }}>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      <span style={{ color: "#D9534F", fontWeight: 700 }}>{p.diff.toFixed(1)}</span>
                    </div>
                  ))
                ) : (
                  <p style={{ color: T.sage, fontStyle: "italic" }}>All pillars above system average.</p>
                )}
              </div>
            </div>

            {/* District Comparison */}
            {schoolAnalysis.districtAvg !== null && (
              <div style={{ ...S.card, marginBottom: 24 }}>
                <h3 style={{ fontFamily: SERIF, fontSize: 16, color: T.green1, marginBottom: 12 }}>
                  District Comparison &mdash; {selectedSchool.district}
                </h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
                  <MetaChip label="District Rank" value={`${schoolAnalysis.districtRank} of ${schoolAnalysis.districtTotal}`} />
                  <MetaChip label="School Score" value={`${selectedSchool.overall.toFixed(1)}%`} />
                  <MetaChip label="District Avg" value={`${schoolAnalysis.districtAvg.toFixed(1)}%`} />
                  <MetaChip label="Variance" value={`${(selectedSchool.overall - schoolAnalysis.districtAvg) >= 0 ? "+" : ""}${(selectedSchool.overall - schoolAnalysis.districtAvg).toFixed(1)}%`} />
                </div>
              </div>
            )}

            {/* KPI-Level Breakdown */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontFamily: SERIF, fontSize: 18, color: T.green2, marginBottom: 16 }}>
                KPI-Level Breakdown
              </h3>
              {schoolAnalysis.kpiBreakdown.map((pillar) => {
                if (pillar.kpis.length === 0) return null;
                return (
                  <div key={pillar.key} style={{ ...S.card, marginBottom: 16, padding: 0, overflowX: "auto" }}>
                    <h4 style={{
                      fontFamily: SERIF, fontSize: 15, color: T.green1, padding: "12px 16px",
                      borderBottom: `1px solid ${T.sageLight}`, margin: 0,
                      background: T.sageLight,
                    }}>
                      {pillar.pillar}
                    </h4>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: T.sageLight }}>
                          <th style={{ padding: "8px 14px", textAlign: "left", color: T.green2, fontWeight: 600 }}>KPI</th>
                          <th style={{ padding: "8px 14px", textAlign: "right", color: T.green2, fontWeight: 600 }}>School</th>
                          <th style={{ padding: "8px 14px", textAlign: "right", color: T.green2, fontWeight: 600 }}>System Avg</th>
                          <th style={{ padding: "8px 14px", textAlign: "right", color: T.green2, fontWeight: 600 }}>Variance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pillar.kpis.map((kpi) => (
                          <tr key={kpi.name} style={{ borderBottom: `1px solid ${T.sageLight}` }}>
                            <td style={{ padding: "8px 14px" }}>{kpi.name}</td>
                            <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: 600 }}>{kpi.score.toFixed(1)}</td>
                            <td style={{ padding: "8px 14px", textAlign: "right" }}>{kpi.sysAvg.toFixed(1)}</td>
                            <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: 600, color: kpi.diff >= 0 ? T.green1 : "#D9534F" }}>
                              {kpi.diff >= 0 ? "+" : ""}{kpi.diff.toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>

            {/* Radar: School vs System */}
            <div style={{ ...S.card, maxWidth: 600, margin: "0 auto" }}>
              <h3 style={{ fontFamily: SERIF, fontSize: 16, color: T.green1, marginBottom: 8 }}>
                School vs System Radar
              </h3>
              <ResponsiveContainer width="100%" height={340}>
                <RadarChart data={schoolAnalysis.pillarComparison.map((p) => ({
                  pillar: p.name,
                  School: p.score,
                  System: p.sysAvg,
                  fullMark: 100,
                }))}>
                  <PolarGrid stroke={T.sage} />
                  <PolarAngleAxis dataKey="pillar" tick={{ fill: T.green2, fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: T.sage, fontSize: 10 }} />
                  <Radar name="School" dataKey="School" stroke={T.green1} fill={T.green1} fillOpacity={0.3} />
                  <Radar name="System" dataKey="System" stroke={T.gold} fill={T.gold} fillOpacity={0.15} />
                  <Legend />
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
function Breadcrumb({ view, school, setView, onHome, S }) {
  const crumbs = [
    { label: "Home", key: "home", action: onHome },
    { label: "Dashboard", key: "dashboard" },
  ];

  if (view === "rankings" || view === "school" || view === "analysis") {
    crumbs.push({ label: "Rankings", key: "rankings" });
  }
  if ((view === "school" || view === "analysis") && school) {
    crumbs.push({ label: school.name, key: "school" });
  }
  if (view === "analysis" && school) {
    crumbs.push({ label: "Analysis", key: "analysis" });
  }

  return (
    <nav style={S.breadcrumb} aria-label="Breadcrumb">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {i > 0 && <span style={S.breadcrumbSep}>/</span>}
            {isLast ? (
              <span style={S.breadcrumbCurrent}>{crumb.label}</span>
            ) : (
              <button
                style={S.breadcrumbLink}
                onClick={() => crumb.action ? crumb.action() : setView(crumb.key)}
              >
                {crumb.key === "home" && (
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style={{ verticalAlign: "middle", marginRight: 3 }}>
                    <path d="M10 2L2 9h3v7h4v-5h2v5h4V9h3L10 2z" />
                  </svg>
                )}
                {crumb.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function Footer({ S }) {
  return (
    <footer style={S.footer}>
      <div style={S.footerInner}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: SERIF, fontSize: 15, color: T.cream, letterSpacing: "0.04em" }}>
          <BloomCross size={28} />
          <span>ANTHICITY &mdash; Learning for Life</span>
        </div>
        <p style={{ fontSize: 13, color: T.sage, margin: 0 }}>&copy; Bloom 2026 W. Gopaul. All rights reserved.</p>
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
