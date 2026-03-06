import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Helper: triggers a file download from a Blob
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Data ────────────────────────────────────────────────────────────────────
const STOCKS = [
  { ticker: "YPF",  name: "YPF Sociedad Anónima",           sector: "Energy",              floatMktCap: 7240, adtvM: 42.1, freeFlt: 0.49, listing: "ADR",    domestic: true  },
  { ticker: "GGAL", name: "Grupo Financiero Galicia",        sector: "Financials",           floatMktCap: 6030, adtvM: 38.5, freeFlt: 0.62, listing: "ADR",    domestic: true  },
  { ticker: "GLOB", name: "Globant",                         sector: "Information Tech.",    floatMktCap: 5200, adtvM: 31.4, freeFlt: 0.82, listing: "NYSE",   domestic: false },
  { ticker: "VIST", name: "Vista Energy",                    sector: "Energy",              floatMktCap: 3840, adtvM: 28.7, freeFlt: 0.71, listing: "ADR",    domestic: true  },
  { ticker: "PAM",  name: "Pampa Energía",                   sector: "Utilities",           floatMktCap: 3700, adtvM: 19.2, freeFlt: 0.58, listing: "ADR",    domestic: true  },
  { ticker: "BMA",  name: "Banco Macro",                     sector: "Financials",           floatMktCap: 3500, adtvM: 22.4, freeFlt: 0.55, listing: "ADR",    domestic: true  },
  { ticker: "TGS",  name: "Transportadora de Gas del Sur",   sector: "Energy",              floatMktCap: 2180, adtvM: 14.3, freeFlt: 0.52, listing: "ADR",    domestic: true  },
  { ticker: "CEPU", name: "Central Puerto",                  sector: "Utilities",           floatMktCap: 1560, adtvM:  8.6, freeFlt: 0.44, listing: "ADR",    domestic: true  },
  { ticker: "BBAR", name: "BBVA Argentina",                  sector: "Financials",           floatMktCap: 1150, adtvM: 10.2, freeFlt: 0.36, listing: "ADR",    domestic: true  },
  { ticker: "TEO",  name: "Telecom Argentina",               sector: "Comm. Services",      floatMktCap: 1110, adtvM:  6.8, freeFlt: 0.41, listing: "ADR",    domestic: true  },
  { ticker: "ARCO", name: "Arcos Dorados Holdings",          sector: "Cons. Discretionary", floatMktCap:  980, adtvM:  7.4, freeFlt: 0.33, listing: "NYSE",   domestic: false },
  { ticker: "AGRO", name: "Adecoagro",                       sector: "Consumer Staples",    floatMktCap:  780, adtvM:  5.1, freeFlt: 0.68, listing: "NYSE",   domestic: false },
  { ticker: "LOMA", name: "Loma Negra",                      sector: "Materials",            floatMktCap:  630, adtvM:  3.9, freeFlt: 0.29, listing: "ADR",    domestic: true  },
  { ticker: "SUPV", name: "Grupo Supervielle",               sector: "Financials",           floatMktCap:  510, adtvM:  4.7, freeFlt: 0.62, listing: "ADR",    domestic: true  },
  { ticker: "IRS",  name: "IRSA Propiedades Comerciales",    sector: "Real Estate",          floatMktCap:  420, adtvM:  2.8, freeFlt: 0.51, listing: "ADR",    domestic: true  },
  { ticker: "CRES", name: "Cresud",                          sector: "Consumer Staples",    floatMktCap:  380, adtvM:  2.3, freeFlt: 0.57, listing: "NASDAQ", domestic: true  },
  { ticker: "EDN",  name: "Edenor",                          sector: "Utilities",           floatMktCap:  310, adtvM:  1.9, freeFlt: 0.47, listing: "ADR",    domestic: true  },
  { ticker: "DESP", name: "Despegar.com",                    sector: "Cons. Discretionary", floatMktCap:  290, adtvM:  3.2, freeFlt: 0.72, listing: "NYSE",   domestic: false },
  { ticker: "BIOX", name: "Bioceres Crop Solutions",         sector: "Materials",            floatMktCap:  210, adtvM:  1.4, freeFlt: 0.65, listing: "NASDAQ", domestic: false },
];

const SCENARIOS = {
  frontier: {
    label: "Frontier Market",
    minFloatMktCap: 700, minADTV: 2.5,
    color: "#F59E0B", colorDim: "rgba(245,158,11,0.12)",
    passiveAUM: 4, argWeight: 0.065, active_multiplier: 0.8,
    timeline: "June 2027 (watchlist Jun 2026)",
    total_flows_low: 200, total_flows_high: 700,
    passiveAUM_min: 1, passiveAUM_max: 10, passiveAUM_step: 0.5,
  },
  emerging: {
    label: "Emerging Market",
    minFloatMktCap: 1400, minADTV: 20,
    color: "#23a29e", colorDim: "rgba(35,162,158,0.12)",
    passiveAUM: 380, argWeight: 0.0024, active_multiplier: 0.8,
    timeline: "Nov 2027 (watchlist Jun 2026)",
    total_flows_low: 800, total_flows_high: 3000,
    passiveAUM_min: 100, passiveAUM_max: 600, passiveAUM_step: 10,
  },
};

const SECTOR_COLORS = {
  "Energy": "#F97316", "Financials": "#3399ff", "Utilities": "#1e5ab0",
  "Comm. Services": "#06B6D4", "Cons. Discretionary": "#ff8269",
  "Consumer Staples": "#acd484", "Materials": "#84cc16",
  "Information Tech.": "#23a29e", "Real Estate": "#ebaca2",
};

const fmt    = (n, d = 1) => n >= 1000 ? `$${(n/1000).toFixed(1)}B` : `$${n.toFixed(d)}M`;
const fmtPct = (n) => `${(n * 100).toFixed(2)}%`;

// ─── Export helpers ───────────────────────────────────────────────────────────
function exportExcel({ scenario, cfg, qualified, stocksWithWeights, passiveInflows, activeInflows, totalInflows, effectivePassiveAUM, activeFrac }) {
  const wb = XLSX.utils.book_new();

  // Sheet 1 — Summary
  const summaryData = [
    ["MSCI Argentina Inclusion Simulator", "", ""],
    ["Latin Securities — Research Tool", "", ""],
    ["Generated", new Date().toLocaleDateString("es-AR"), ""],
    ["", "", ""],
    ["SCENARIO", cfg.label, ""],
    ["Timeline", cfg.timeline, ""],
    ["Passive AUM tracked", `$${effectivePassiveAUM}B`, ""],
    ["Argentina est. weight", `${(cfg.argWeight * 100).toFixed(3)}%`, ""],
    ["Active/Passive fraction", `${activeFrac.toFixed(2)}×`, ""],
    ["", "", ""],
    ["FLOW ESTIMATES", "", ""],
    ["Passive Inflows", `$${passiveInflows.toFixed(0)}M`, ""],
    ["Active Inflows",  `$${activeInflows.toFixed(0)}M`, ""],
    ["Total Inflows",   `$${totalInflows.toFixed(0)}M`, ""],
    ["Analyst range",   `$${(cfg.total_flows_low/1000).toFixed(1)}B – $${(cfg.total_flows_high/1000).toFixed(1)}B`, ""],
    ["", "", ""],
    ["ELIGIBILITY THRESHOLDS", "", ""],
    ["Min Float Mkt Cap", `$${cfg.minFloatMktCap >= 1000 ? (cfg.minFloatMktCap/1000).toFixed(1)+"B" : cfg.minFloatMktCap+"M"}`, ""],
    ["Min ADTV (3M)",    `$${cfg.minADTV}M/day`, ""],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Summary");

  // Sheet 2 — Constituents
  const totalFloatCap = qualified.reduce((a, s) => a + s.floatMktCap, 0);
  const constituentRows = [
    ["Ticker", "Company", "Sector", "Float Mkt Cap (USD M)", "ADTV 3M (USD M)", "Free Float %", "Listing", "Est. Index Weight %", "Days of Trading (Passive)", "Days of Trading (Total)", "Status"],
  ];
  STOCKS.sort((a, b) => b.floatMktCap - a.floatMktCap).forEach(s => {
    const isIn = qualified.find(q => q.ticker === s.ticker);
    const sw   = stocksWithWeights.find(q => q.ticker === s.ticker);
    const sizeOk = s.floatMktCap >= cfg.minFloatMktCap;
    const adtvOk = s.adtvM >= cfg.minADTV;
    const passFlow  = isIn && sw ? passiveInflows * sw.indexWeight : 0;
    const totalFlow = isIn && sw ? totalInflows * sw.indexWeight : 0;
    constituentRows.push([
      s.ticker, s.name, s.sector,
      s.floatMktCap, s.adtvM,
      `${(s.freeFlt * 100).toFixed(0)}%`,
      s.listing,
      isIn && sw ? `${(sw.indexWeight * 100).toFixed(2)}%` : "—",
      isIn && sw ? (passFlow / s.adtvM).toFixed(2) : "—",
      isIn && sw ? (totalFlow / s.adtvM).toFixed(2) : "—",
      isIn ? "ELIGIBLE" : (!sizeOk && !adtvOk ? "SIZE+ADTV" : !sizeOk ? "SIZE" : "ADTV"),
    ]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(constituentRows), "Constituents");

  // Sheet 3 — Flow Breakdown
  const flowRows = [
    ["Ticker", "Company", "Index Weight %", "Passive Inflow (USD M)", "Active Inflow (USD M)", "Total Inflow (USD M)", "Days of Trading (Passive)", "Days of Trading (Total)"],
  ];
  stocksWithWeights.sort((a, b) => b.floatMktCap - a.floatMktCap).forEach(s => {
    const pf = passiveInflows * s.indexWeight;
    const af = activeInflows  * s.indexWeight;
    const tf = totalInflows   * s.indexWeight;
    flowRows.push([
      s.ticker, s.name,
      `${(s.indexWeight * 100).toFixed(2)}%`,
      pf.toFixed(1), af.toFixed(1), tf.toFixed(1),
      (pf / s.adtvM).toFixed(2),
      (tf / s.adtvM).toFixed(2),
    ]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(flowRows), "Flow Breakdown");

  // Sheet 4 — Precedents
  const precedentRows = [
    ["Country", "Direction", "Year", "Passive Inflows", "Active Inflows", "Total", "Notes"],
    ["Argentina", "FM→EM", 2019, "$500M", "$1.2B", "$1.7B", "Prior EM inclusion, capital controls reintroduced 2019"],
    ["Saudi Arabia", "FM→EM", 2019, "$10B", "$30B", "$40B", "ARAMCO IPO; phased over 2 SAIR cycles"],
    ["Kuwait", "FM→EM", 2019, "$2.5B", "$5B", "$7.5B", "Gradual rebalancing; high domestic liquidity"],
    ["UAE/Qatar", "FM→EM", 2014, "$1B ea.", "$2B ea.", "$3B ea.", "Dual listing structure facilitated flows"],
    ["Pakistan", "FM→EM", 2017, "$600M", "$1B", "$1.6B", "Downgraded back to FM in 2021"],
    ["Greece", "EM→DM", 2013, "$1.2B out", "$2B out", "$3.2B out", "Outflows due to downgrade"],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(precedentRows), "Precedents");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  downloadBlob(blob, `LS_MSCI_Argentina_${scenario}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function exportPDF({ scenario, cfg, qualified, stocksWithWeights, passiveInflows, activeInflows, totalInflows, effectivePassiveAUM, activeFrac }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const LS_NAVY = [0, 0, 57];
  const LS_BLUE = [51, 153, 255];
  const LS_TEAL = [35, 162, 158];
  const GRAY    = [120, 144, 168];
  const WHITE   = [255, 255, 255];
  const pageW   = doc.internal.pageSize.getWidth();

  // ── Header bar ──
  doc.setFillColor(...LS_NAVY);
  doc.rect(0, 0, pageW, 22, "F");

  // Logo shapes
  doc.setFillColor(30, 90, 176);
  doc.roundedRect(8, 4, 8, 14, 1.5, 1.5, "F");
  doc.setFillColor(...LS_BLUE);
  doc.roundedRect(13, 4, 8, 14, 1.5, 1.5, "F");

  doc.setTextColor(...WHITE);
  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("LATIN SECURITIES", 25, 11);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text("MSCI ARGENTINA INCLUSION SIMULATOR", 25, 16);

  // Scenario badge
  const badgeColor = scenario === "frontier" ? [245, 158, 11] : [35, 162, 158];
  doc.setFillColor(...badgeColor);
  doc.roundedRect(pageW - 60, 6, 52, 10, 2, 2, "F");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text(`SCENARIO: ${cfg.label.toUpperCase()}`, pageW - 56, 12.5);

  // ── Summary section ──
  doc.setTextColor(...LS_NAVY);
  doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text("Simulation Parameters", 10, 32);

  const summaryItems = [
    ["Timeline", cfg.timeline],
    ["Passive AUM", `$${effectivePassiveAUM}B`],
    ["Argentina Weight", `${(cfg.argWeight * 100).toFixed(3)}%`],
    ["Active Fraction", `${activeFrac.toFixed(1)}×`],
    ["Passive Inflows", `$${passiveInflows.toFixed(0)}M`],
    ["Active Inflows",  `$${activeInflows.toFixed(0)}M`],
    ["Total Inflows",   `$${totalInflows.toFixed(0)}M`],
    ["Analyst Range",   `$${(cfg.total_flows_low/1000).toFixed(1)}B – $${(cfg.total_flows_high/1000).toFixed(1)}B`],
  ];

  const colW = (pageW - 20) / 4;
  summaryItems.forEach((item, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = 10 + col * colW, y = 38 + row * 16;
    doc.setFillColor(232, 238, 246);
    doc.roundedRect(x, y, colW - 3, 13, 1, 1, "F");
    doc.setTextColor(...GRAY); doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
    doc.text(item[0].toUpperCase(), x + 3, y + 5);
    doc.setTextColor(...LS_NAVY); doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text(item[1], x + 3, y + 11);
  });

  // ── Eligible Constituents table ──
  doc.setTextColor(...LS_NAVY);
  doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text("Eligible Constituents", 10, 76);

  const totalFloatCap = qualified.reduce((a, s) => a + s.floatMktCap, 0);
  autoTable(doc, {
    startY: 80,
    head: [["Ticker", "Company", "Sector", "Float Cap", "ADTV", "Free Float", "Index Wt.", "Days (Passive)", "Days (Total)", "Status"]],
    body: STOCKS.sort((a, b) => b.floatMktCap - a.floatMktCap).map(s => {
      const isIn = qualified.find(q => q.ticker === s.ticker);
      const sw   = stocksWithWeights.find(q => q.ticker === s.ticker);
      const pf   = isIn && sw ? passiveInflows * sw.indexWeight : 0;
      const tf   = isIn && sw ? totalInflows * sw.indexWeight : 0;
      return [
        s.ticker, s.name.length > 22 ? s.name.slice(0,22)+"…" : s.name,
        s.sector, fmt(s.floatMktCap), `$${s.adtvM}M`,
        `${(s.freeFlt*100).toFixed(0)}%`,
        isIn && sw ? fmtPct(sw.indexWeight) : "—",
        isIn && sw ? (pf / s.adtvM).toFixed(1)+"d" : "—",
        isIn && sw ? (tf / s.adtvM).toFixed(1)+"d" : "—",
        isIn ? "ELIGIBLE" : "EXCLUDED",
      ];
    }),
    headStyles: { fillColor: LS_NAVY, textColor: WHITE, fontSize: 7, fontStyle: "bold" },
    bodyStyles: { fontSize: 7, textColor: [30, 40, 60] },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    didParseCell: (data) => {
      if (data.section === "body") {
        const val = data.cell.raw;
        if (val === "ELIGIBLE")  { data.cell.styles.textColor = [35, 162, 158]; data.cell.styles.fontStyle = "bold"; }
        if (val === "EXCLUDED")  { data.cell.styles.textColor = [220, 50, 50]; }
        if (typeof val === "string" && val.endsWith("d") && parseFloat(val) > 5)
          data.cell.styles.textColor = [220, 50, 50];
        if (typeof val === "string" && val.endsWith("d") && parseFloat(val) > 2 && parseFloat(val) <= 5)
          data.cell.styles.textColor = [220, 140, 0];
      }
    },
    margin: { left: 10, right: 10 },
  });

  // ── Page 2: Flow Breakdown ──
  doc.addPage();
  doc.setFillColor(...LS_NAVY);
  doc.rect(0, 0, pageW, 14, "F");
  doc.setTextColor(...WHITE); doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text("LATIN SECURITIES  //  Flow Breakdown by Constituent", 10, 9);

  autoTable(doc, {
    startY: 20,
    head: [["Ticker", "Company", "Index Wt. %", "Passive Inflow", "Active Inflow", "Total Inflow", "Days (Passive)", "Days (Total)"]],
    body: stocksWithWeights.sort((a, b) => b.floatMktCap - a.floatMktCap).map(s => {
      const pf = passiveInflows * s.indexWeight;
      const af = activeInflows  * s.indexWeight;
      const tf = totalInflows   * s.indexWeight;
      return [
        s.ticker, s.name.length > 28 ? s.name.slice(0,28)+"…" : s.name,
        fmtPct(s.indexWeight),
        `$${pf.toFixed(1)}M`, `$${af.toFixed(1)}M`, `$${tf.toFixed(1)}M`,
        (pf / s.adtvM).toFixed(2)+"d", (tf / s.adtvM).toFixed(2)+"d",
      ];
    }),
    headStyles: { fillColor: LS_NAVY, textColor: WHITE, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, textColor: [30, 40, 60] },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    margin: { left: 10, right: 10 },
  });

  // Analyst consensus box
  const ay = doc.lastAutoTable.finalY + 10;
  doc.setFillColor(232, 238, 246);
  doc.roundedRect(10, ay, pageW - 20, 36, 2, 2, "F");
  doc.setTextColor(...LS_NAVY); doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text("ANALYST CONSENSUS ESTIMATES", 14, ay + 7);
  const analysts = [
    ["JPMorgan (2024)", "$200M–$400M FM", "~$1B EM passive"],
    ["Goldman Sachs",   "$150M–$350M FM", "$800M–$2.0B EM"],
    ["UBS / Citi",      "$200M–$500M FM", "$1.0B–$2.5B EM"],
    ["Latam Advisors",  "$300M–$700M FM", "$1.5B–$3.0B EM (incl. active)"],
  ];
  analysts.forEach((a, i) => {
    const x = 14 + i * (pageW - 28) / 4;
    doc.setTextColor(...GRAY); doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
    doc.text(a[0], x, ay + 16);
    doc.setTextColor([245,158,11]); doc.setFontSize(7);
    doc.text(a[1], x, ay + 22);
    doc.setTextColor(...LS_TEAL);
    doc.text(a[2], x, ay + 28);
  });

  // ── Footer ──
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(6.5); doc.setTextColor(...GRAY);
    doc.text(
      "Latin Securities · MSCI Argentina Simulation · For analytical purposes only · Not investment advice · " + new Date().toLocaleDateString("es-AR"),
      10, doc.internal.pageSize.getHeight() - 5
    );
    doc.text(`${p} / ${pages}`, pageW - 15, doc.internal.pageSize.getHeight() - 5);
  }

  doc.save(`LS_MSCI_Argentina_${scenario}_${new Date().toISOString().slice(0,10)}.pdf`);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MSCISimulator() {
  const [scenario, setScenario]           = useState("frontier");
  const [customPassiveAUM, setCustomPassiveAUM] = useState(null);
  const [activeTab, setActiveTab]         = useState("inclusion");
  const [activeMultiplier, setActiveMultiplier] = useState(null);

  const cfg = SCENARIOS[scenario];

  const qualified = useMemo(() =>
    STOCKS.filter(s => s.floatMktCap >= cfg.minFloatMktCap && s.adtvM >= cfg.minADTV),
  [scenario]);

  const totalFloatCap = useMemo(() => qualified.reduce((a, s) => a + s.floatMktCap, 0), [qualified]);

  const effectivePassiveAUM = customPassiveAUM !== null ? customPassiveAUM : cfg.passiveAUM;
  const passiveInflows = effectivePassiveAUM * cfg.argWeight * 1000;

  const stocksWithWeights = useMemo(() =>
    qualified.map(s => ({
      ...s,
      indexWeight: s.floatMktCap / totalFloatCap,
      daysOfTrading: (passiveInflows * (s.floatMktCap / totalFloatCap)) / s.adtvM,
    })),
  [qualified, totalFloatCap, passiveInflows]);

  const activeFrac     = activeMultiplier !== null ? activeMultiplier : cfg.active_multiplier;
  const activeInflows  = passiveInflows * activeFrac;
  const totalInflows   = passiveInflows + activeInflows;

  const exportArgs = { scenario, cfg, qualified, stocksWithWeights, passiveInflows, activeInflows, totalInflows, effectivePassiveAUM, activeFrac };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Titillium Web', sans-serif", background: "#e8eef6", minHeight: "100vh", color: "#000039", padding: 0 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Titillium+Web:wght@300;400;600;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #e8eef6; }
        ::-webkit-scrollbar-thumb { background: #3399ff; border-radius: 3px; }
        .tab-btn  { background: none; border: none; cursor: pointer; transition: all 0.2s; }
        .tab-btn:hover { opacity: 0.8; }
        .sc-btn   { transition: all 0.2s; border: 1px solid; cursor: pointer; border-radius: 5px; }
        .sc-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,57,0.15); }
        .row-hover { transition: background 0.12s; }
        .row-hover:hover { background: rgba(51,153,255,0.07) !important; }
        .exp-btn  { display: flex; align-items: center; gap: 7px; padding: 8px 16px; border: none;
                    border-radius: 6px; cursor: pointer; font-family: 'Titillium Web', sans-serif;
                    font-size: 13px; font-weight: 600; transition: all 0.2s; }
        .exp-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.15); }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
        @keyframes slideIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .slide-in { animation: slideIn 0.35s ease-out; }
        input[type=range] { accent-color: #3399ff; width: 100%; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background: "linear-gradient(135deg, #000039 0%, #1a4a9a 100%)", padding: "18px 28px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>

          {/* Logo + title */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width="36" height="44" viewBox="0 0 36 44" fill="none">
              <path d="M3 0H15C17.2 0 19 1.8 19 4V40C19 42.4 16.6 44 15 42L3 42C0.8 42 0 40.2 0 38V4C0 1.8 1.8 0 3 0Z" fill="#1e5ab0"/>
              <path d="M15 0H27C29.2 0 31 1.8 31 4V32C31 34.2 29 36.5 27 38L19 42C17.4 44 17 42.4 17 40V4C17 1.8 18.8 0 15 0Z" fill="#3399ff"/>
              <path d="M17 4H19V40H17Z" fill="white" opacity="0.12"/>
            </svg>
            <div>
              <div style={{ fontSize: 19, fontWeight: 700, color: "#fff", letterSpacing: 2.5, lineHeight: 1.1 }}>LATIN</div>
              <div style={{ fontSize: 19, fontWeight: 700, color: "#fff", letterSpacing: 2.5, lineHeight: 1.1 }}>SECURITIES</div>
            </div>
            <div style={{ width: 1, height: 38, background: "rgba(255,255,255,0.2)", margin: "0 6px" }} />
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 2.5, marginBottom: 3 }}>RESEARCH TOOL</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>MSCI Argentina Inclusion Simulator</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                Constituent eligibility · Passive & active inflows · Days-of-trading
              </div>
            </div>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.color, marginLeft: 8, animation: "pulse 2s infinite" }} />
          </div>

          {/* Scenario buttons + export */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 2 }}>SCENARIO</span>
              {Object.entries(SCENARIOS).map(([key, s]) => (
                <button key={key} className="sc-btn"
                  onClick={() => { setScenario(key); setCustomPassiveAUM(null); setActiveMultiplier(null); }}
                  style={{
                    padding: "7px 18px", fontSize: 12, fontWeight: 600, letterSpacing: 0.5,
                    color:      scenario === key ? "#000039" : "#fff",
                    background: scenario === key ? "#fff"    : "rgba(255,255,255,0.1)",
                    borderColor: scenario === key ? "#fff"   : "rgba(255,255,255,0.3)",
                  }}>
                  {s.label.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="exp-btn"
                style={{ background: "#217346", color: "#fff" }}
                onClick={() => exportExcel(exportArgs)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                Export Excel
              </button>
              <button className="exp-btn"
                style={{ background: "#c0392b", color: "#fff" }}
                onClick={() => exportPDF(exportArgs)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                Export PDF
              </button>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div style={{ display: "flex", gap: 28, marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.12)", flexWrap: "wrap" }}>
          {[
            { label: "STATUS",       value: "STANDALONE",                              color: "#ff8269" },
            { label: "TARGET",       value: cfg.label.toUpperCase(),                   color: "#fff" },
            { label: "TIMELINE",     value: cfg.timeline,                              color: "rgba(255,255,255,0.8)" },
            { label: "CONSTITUENTS", value: `${qualified.length} eligible`,            color: "rgba(255,255,255,0.8)" },
            { label: "PASSIVE AUM",  value: `$${effectivePassiveAUM.toFixed(0)}B tracked`, color: "rgba(255,255,255,0.8)" },
            { label: "TOTAL INFLOWS (BASE)", value: `$${totalInflows.toFixed(0)}M`,   color: cfg.color },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 1.8, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, color, fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid #dbe6f0", padding: "0 28px" }}>
        {[
          { id: "inclusion", label: "Constituent Analysis" },
          { id: "flows",     label: "Flow Estimates" },
          { id: "timeline",  label: "Timeline & Process" },
        ].map(t => (
          <button key={t.id} className="tab-btn"
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: "12px 22px", fontSize: 13, fontWeight: 600, letterSpacing: 0.3,
              color: activeTab === t.id ? cfg.color : "#8a9eb8",
              borderBottom: `2px solid ${activeTab === t.id ? cfg.color : "transparent"}`,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: "24px 28px" }}>

        {/* ═══ INCLUSION TAB ═══ */}
        {activeTab === "inclusion" && (
          <div className="slide-in">

            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px,1fr))", gap: 12, marginBottom: 22 }}>
              {[
                { label: "Eligible Stocks",  value: qualified.length,             sub: `of ${STOCKS.length} screened`,  accent: cfg.color    },
                { label: "Combined Float Cap", value: fmt(totalFloatCap),           sub: "eligible universe",             accent: "#1e5ab0"    },
                { label: "Size Floor",        value: fmt(cfg.minFloatMktCap),      sub: "float-adj threshold",           accent: "#1e5ab0"    },
                { label: "ADTV Floor",        value: `$${cfg.minADTV}M`,           sub: "3-month average",               accent: "#1e5ab0"    },
                { label: "Excluded",          value: STOCKS.length - qualified.length, sub: "below threshold",           accent: "#EF4444"    },
              ].map(card => (
                <div key={card.label} style={{ background: "#fff", border: "1px solid #dbe6f0", borderRadius: 8, padding: "14px 16px", boxShadow: "0 2px 8px rgba(30,90,176,0.06)" }}>
                  <div style={{ fontSize: 10, color: "#8a9eb8", letterSpacing: 1.5, marginBottom: 6, textTransform: "uppercase" }}>{card.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: card.accent }}>{card.value}</div>
                  <div style={{ fontSize: 11, color: "#7a90a8", marginTop: 2 }}>{card.sub}</div>
                </div>
              ))}
            </div>

            {/* Criteria tags */}
            <div style={{ background: "#fff", border: `1px solid ${cfg.color}30`, borderRadius: 8, padding: "11px 16px", marginBottom: 18, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", boxShadow: "0 2px 8px rgba(30,90,176,0.05)" }}>
              <span style={{ fontSize: 11, color: "#8a9eb8", letterSpacing: 1, marginRight: 4 }}>ELIGIBILITY —</span>
              {[
                `Float Cap ≥ $${cfg.minFloatMktCap >= 1000 ? (cfg.minFloatMktCap/1000).toFixed(1)+"B" : cfg.minFloatMktCap+"M"}`,
                `ADTV ≥ $${cfg.minADTV}M/day`,
                "Foreign ownership: unrestricted",
                "FX repatriation: approved",
              ].map(c => (
                <span key={c} style={{ fontSize: 11, color: cfg.color, background: cfg.colorDim, padding: "3px 9px", borderRadius: 4, fontWeight: 600 }}>{c}</span>
              ))}
            </div>

            {/* Stock table */}
            <div style={{ overflowX: "auto", background: "#fff", borderRadius: 8, border: "1px solid #dbe6f0", boxShadow: "0 2px 8px rgba(30,90,176,0.06)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "#f4f7fb", borderBottom: "2px solid #dbe6f0" }}>
                    {["Ticker","Company","Sector","Float Cap","ADTV (3M)","Free Float","Listing","Index Wt.","Days of Trading","Status"].map(h => (
                      <th key={h} style={{ padding: "10px 13px", textAlign: "left", color: "#7a90a8", fontSize: 10, letterSpacing: 1.2, fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {STOCKS.sort((a, b) => b.floatMktCap - a.floatMktCap).map(stock => {
                    const isIn   = qualified.find(q => q.ticker === stock.ticker);
                    const sw     = stocksWithWeights.find(q => q.ticker === stock.ticker);
                    const sizeOk = stock.floatMktCap >= cfg.minFloatMktCap;
                    const adtvOk = stock.adtvM >= cfg.minADTV;
                    return (
                      <tr key={stock.ticker} className="row-hover"
                        style={{ borderBottom: "1px solid #f0f4f8", background: isIn ? "#fafcff" : "#fff", opacity: isIn ? 1 : 0.5 }}>
                        <td style={{ padding: "10px 13px", fontWeight: 700, color: isIn ? cfg.color : "#8a9eb8" }}>{stock.ticker}</td>
                        <td style={{ padding: "10px 13px", color: "#1e3a5a", maxWidth: 180, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{stock.name}</td>
                        <td style={{ padding: "10px 13px" }}>
                          <span style={{ background: `${SECTOR_COLORS[stock.sector]}18`, color: SECTOR_COLORS[stock.sector], padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>
                            {stock.sector}
                          </span>
                        </td>
                        <td style={{ padding: "10px 13px", color: sizeOk ? "#1e3a5a" : "#EF4444", textAlign: "right", fontWeight: sizeOk ? 400 : 600 }}>{fmt(stock.floatMktCap)}</td>
                        <td style={{ padding: "10px 13px", color: adtvOk ? "#1e3a5a" : "#EF4444", textAlign: "right", fontWeight: adtvOk ? 400 : 600 }}>${stock.adtvM.toFixed(1)}M</td>
                        <td style={{ padding: "10px 13px", color: "#5a7090", textAlign: "right" }}>{(stock.freeFlt*100).toFixed(0)}%</td>
                        <td style={{ padding: "10px 13px", color: "#5a7090" }}>{stock.listing}</td>
                        <td style={{ padding: "10px 13px", textAlign: "right" }}>
                          {isIn && sw ? <span style={{ color: "#000039", fontWeight: 600 }}>{fmtPct(sw.indexWeight)}</span> : <span style={{ color: "#c8d6e8" }}>—</span>}
                        </td>
                        <td style={{ padding: "10px 13px", textAlign: "right" }}>
                          {isIn && sw ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 7, justifyContent: "flex-end" }}>
                              <div style={{ width: 44, height: 5, background: "#e8eef6", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ width: `${Math.min(100,(sw.daysOfTrading/8)*100)}%`, height: "100%", background: sw.daysOfTrading > 5 ? "#EF4444" : sw.daysOfTrading > 2 ? "#F59E0B" : cfg.color, borderRadius: 3 }} />
                              </div>
                              <span style={{ color: sw.daysOfTrading > 5 ? "#EF4444" : sw.daysOfTrading > 2 ? "#F59E0B" : cfg.color, fontWeight: 600, minWidth: 32, textAlign: "right" }}>
                                {sw.daysOfTrading.toFixed(1)}d
                              </span>
                            </div>
                          ) : <span style={{ color: "#c8d6e8" }}>—</span>}
                        </td>
                        <td style={{ padding: "10px 13px" }}>
                          {isIn
                            ? <span style={{ color: cfg.color, background: cfg.colorDim, padding: "3px 9px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>ELIGIBLE ✓</span>
                            : <span style={{ color: "#EF4444", background: "rgba(239,68,68,0.08)", padding: "3px 9px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                                {!sizeOk && !adtvOk ? "SIZE + ADTV" : !sizeOk ? "SIZE" : "ADTV"}
                              </span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ FLOWS TAB ═══ */}
        {activeTab === "flows" && (
          <div className="slide-in">

            {/* Model params */}
            <div style={{ background: "#fff", border: "1px solid #dbe6f0", borderRadius: 8, padding: "20px 24px", marginBottom: 20, boxShadow: "0 2px 8px rgba(30,90,176,0.06)" }}>
              <div style={{ fontSize: 11, color: "#8a9eb8", letterSpacing: 1.5, marginBottom: 16, fontWeight: 700 }}>MODEL PARAMETERS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px,1fr))", gap: 28 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#1e3a5a", fontWeight: 600, display: "block", marginBottom: 4 }}>
                    Passive-Only AUM — <span style={{ color: cfg.color }}>${effectivePassiveAUM.toFixed(0)}B</span>
                  </label>
                  <div style={{ fontSize: 11, color: "#8a9eb8", marginBottom: 8 }}>ETFs + institutional trackers only (not total benchmarked)</div>
                  <input type="range" min={cfg.passiveAUM_min} max={cfg.passiveAUM_max} step={cfg.passiveAUM_step}
                    value={effectivePassiveAUM} onChange={e => setCustomPassiveAUM(Number(e.target.value))} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#8a9eb8", marginTop: 4 }}>
                    <span>${cfg.passiveAUM_min}B</span>
                    <span style={{ color: cfg.color }}>Default: ${cfg.passiveAUM}B</span>
                    <span>${cfg.passiveAUM_max}B</span>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#1e3a5a", fontWeight: 600, display: "block", marginBottom: 4 }}>
                    Active inflows as fraction of passive — <span style={{ color: cfg.color }}>{activeFrac.toFixed(2)}×</span>
                  </label>
                  <div style={{ fontSize: 11, color: "#8a9eb8", marginBottom: 8 }}>Active = front-running + discretionary overweights on top of passive</div>
                  <input type="range" min={0} max={2} step={0.05}
                    value={activeFrac} onChange={e => setActiveMultiplier(Number(e.target.value))} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#8a9eb8", marginTop: 4 }}>
                    <span>0× (passive only)</span>
                    <span style={{ color: cfg.color }}>Default: {cfg.active_multiplier}×</span>
                    <span>2× (high conviction)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Big 3 flow cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
              {[
                { label: "PASSIVE INFLOWS",        val: passiveInflows, sub: `$${effectivePassiveAUM}B AUM × ${(cfg.argWeight*100).toFixed(3)}% weight`, color: "#3399ff", bg: "rgba(51,153,255,0.07)" },
                { label: "ACTIVE INFLOWS",         val: activeInflows,  sub: `${activeFrac.toFixed(2)}× passive — front-running + overweights`,         color: "#1e5ab0", bg: "rgba(30,90,176,0.07)" },
                { label: "TOTAL EXPECTED INFLOWS", val: totalInflows,   sub: `Analyst range $${(cfg.total_flows_low/1000).toFixed(1)}B–$${(cfg.total_flows_high/1000).toFixed(1)}B`, color: cfg.color, bg: cfg.colorDim },
              ].map(card => (
                <div key={card.label} style={{ background: "#fff", border: `1px solid ${card.color}25`, borderRadius: 8, padding: "20px 22px", boxShadow: `0 2px 12px ${card.color}15` }}>
                  <div style={{ fontSize: 10, color: "#8a9eb8", letterSpacing: 1.5, marginBottom: 10, fontWeight: 700 }}>{card.label}</div>
                  <div style={{ fontSize: 30, fontWeight: 900, color: card.color, letterSpacing: -1 }}>${card.val.toFixed(0)}M</div>
                  <div style={{ fontSize: 11, color: "#7a90a8", marginTop: 8, lineHeight: 1.5 }}>{card.sub}</div>
                </div>
              ))}
            </div>

            {/* Per-stock table */}
            <div style={{ background: "#fff", border: "1px solid #dbe6f0", borderRadius: 8, padding: "20px 24px", marginBottom: 20, boxShadow: "0 2px 8px rgba(30,90,176,0.06)" }}>
              <div style={{ fontSize: 11, color: "#8a9eb8", letterSpacing: 1.5, marginBottom: 16, fontWeight: 700 }}>ESTIMATED INFLOWS BY CONSTITUENT</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#f4f7fb", borderBottom: "2px solid #dbe6f0" }}>
                      {["Ticker","Index Wt.","Passive Inflow","Active Inflow","Total Inflow","Days (Passive)","Days (Total)"].map(h => (
                        <th key={h} style={{ padding: "10px 13px", textAlign: h==="Ticker"?"left":"right", color: "#7a90a8", fontSize: 10, letterSpacing: 1.2, fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stocksWithWeights.sort((a,b) => b.floatMktCap - a.floatMktCap).map(s => {
                      const pf = passiveInflows * s.indexWeight;
                      const af = activeInflows  * s.indexWeight;
                      const tf = totalInflows   * s.indexWeight;
                      const dp = pf / s.adtvM, dt = tf / s.adtvM;
                      return (
                        <tr key={s.ticker} className="row-hover" style={{ borderBottom: "1px solid #f0f4f8" }}>
                          <td style={{ padding: "10px 13px", color: cfg.color, fontWeight: 700 }}>{s.ticker}</td>
                          <td style={{ padding: "10px 13px", color: "#5a7090", textAlign: "right" }}>{fmtPct(s.indexWeight)}</td>
                          <td style={{ padding: "10px 13px", color: "#3399ff", textAlign: "right", fontWeight: 600 }}>${pf.toFixed(1)}M</td>
                          <td style={{ padding: "10px 13px", color: "#1e5ab0", textAlign: "right", fontWeight: 600 }}>${af.toFixed(1)}M</td>
                          <td style={{ padding: "10px 13px", color: cfg.color,  textAlign: "right", fontWeight: 700 }}>${tf.toFixed(1)}M</td>
                          <td style={{ padding: "10px 13px", textAlign: "right" }}>
                            <span style={{ color: dp>3?"#EF4444":dp>1.5?"#F59E0B":"#23a29e", fontWeight: 600 }}>{dp.toFixed(2)}d</span>
                          </td>
                          <td style={{ padding: "10px 13px", textAlign: "right" }}>
                            <span style={{ color: dt>5?"#EF4444":dt>2?"#F59E0B":"#23a29e", fontWeight: 600 }}>{dt.toFixed(2)}d</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Analyst consensus */}
            <div style={{ background: "#fff", border: "1px solid #dbe6f0", borderRadius: 8, padding: "20px 24px", boxShadow: "0 2px 8px rgba(30,90,176,0.06)" }}>
              <div style={{ fontSize: 11, color: "#8a9eb8", letterSpacing: 1.5, marginBottom: 16, fontWeight: 700 }}>EXTERNAL ESTIMATES — ANALYST CONSENSUS</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[
                  { source: "JPMorgan (2024)", fm: "$200M–$400M", em: "~$1B passive" },
                  { source: "Goldman Sachs",   fm: "$150M–$350M", em: "$800M–$2.0B" },
                  { source: "UBS / Citi",      fm: "$200M–$500M", em: "$1.0B–$2.5B" },
                  { source: "Latam Advisors",  fm: "$300M–$700M", em: "$1.5B–$3.0B (incl. active)" },
                ].map(e => (
                  <div key={e.source} style={{ background: "#f4f7fb", border: "1px solid #dbe6f0", borderRadius: 6, padding: "14px 16px", flex: "1", minWidth: 150 }}>
                    <div style={{ fontSize: 12, color: "#1e3a5a", fontWeight: 700, marginBottom: 10 }}>{e.source}</div>
                    <div style={{ fontSize: 10, color: "#8a9eb8", marginBottom: 3, letterSpacing: 0.5 }}>FRONTIER</div>
                    <div style={{ fontSize: 13, color: "#F59E0B", fontWeight: 700, marginBottom: 8 }}>{e.fm}</div>
                    <div style={{ fontSize: 10, color: "#8a9eb8", marginBottom: 3, letterSpacing: 0.5 }}>EMERGING</div>
                    <div style={{ fontSize: 13, color: "#23a29e", fontWeight: 700 }}>{e.em}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, fontSize: 11, color: "#8a9eb8", lineHeight: 1.6 }}>
                ⚠ Excludes MercadoLibre (MELI) — classified as US company in EM context. Active estimates assume 0.8–1.5× passive, consistent with Kuwait (2019) and Saudi Arabia (2018) precedents.
              </div>
            </div>
          </div>
        )}

        {/* ═══ TIMELINE TAB ═══ */}
        {activeTab === "timeline" && (
          <div className="slide-in">
            {/* Timeline */}
            <div style={{ background: "#fff", border: "1px solid #dbe6f0", borderRadius: 8, padding: "24px", marginBottom: 20, boxShadow: "0 2px 8px rgba(30,90,176,0.06)" }}>
              <div style={{ fontSize: 11, color: "#8a9eb8", letterSpacing: 1.5, marginBottom: 24, fontWeight: 700 }}>RECLASSIFICATION PROCESS — MSCI METHODOLOGY</div>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 18, top: 0, bottom: 0, width: 2, background: "linear-gradient(180deg, #3399ff 0%, #e8eef6 100%)", borderRadius: 1 }} />
                {[
                  { date: "Apr 2025", status: "done",    color: "#23a29e", title: "Major Accessibility Reforms",
                    detail: "IMF deal secured. Crawling peg replaced by managed float with bands. Capital controls largely lifted for residents. Dividend repatriation allowed from Jan 1, 2025." },
                  { date: "Jun 2025", status: "done",    color: "#EF4444", title: "MSCI Annual Review — No Watchlist",
                    detail: "MSCI keeps Argentina as Standalone. Notes 'several restrictions for foreign institutional investors still in place.' Market accessibility review ongoing." },
                  { date: "Jun 2026", status: "pending", color: cfg.color, title: "MSCI Annual Review — Watchlist Addition (Expected)",
                    detail: "Earliest date Argentina can be added to the watchlist for reclassification. Requires 12 months of demonstrated FX accessibility and sufficient secondary market liquidity." },
                  { date: "Jun–Nov 2026", status: "pending", color: "#8a9eb8", title: "Consultation Period",
                    detail: "MSCI solicits feedback from international institutional investors. Screens for foreign ownership limits, capital flow restrictions, market infrastructure, settlement efficiency." },
                  { date: scenario==="emerging"?"Nov 2027":"Jun 2027", status: "pending", color: cfg.color,
                    title: `Formal Reclassification to ${cfg.label}`,
                    detail: `Implementation date. Argentina added to MSCI ${cfg.label} Index. Passive funds begin rebalancing. Provisional index launched ~3 months prior.` },
                  { date: scenario==="emerging"?"May 2028":"Dec 2027", status: "pending", color: "#8a9eb8", title: "Semi-Annual Review — Full Implementation",
                    detail: "First SAIR post-inclusion. Additional constituents may be added as domestic liquidity improves. MSCI evaluates shift from offshore ADRs to onshore listings." },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 20, marginBottom: 22, paddingLeft: 10 }}>
                    <div style={{ flexShrink: 0, marginTop: 1 }}>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", background: item.status==="done"?item.color:"#fff", border: `2.5px solid ${item.color}`, boxShadow: item.status==="pending"&&item.color===cfg.color?`0 0 10px ${cfg.color}60`:"none" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 5, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: item.color, fontWeight: 700, letterSpacing: 0.5 }}>{item.date}</span>
                        <span style={{ fontSize: 12, color: "#1e3a5a", fontWeight: 600 }}>{item.title}</span>
                        {item.status==="done" && <span style={{ fontSize: 9, color: "#23a29e", background: "rgba(35,162,158,0.12)", padding: "2px 8px", borderRadius: 3, fontWeight: 700, letterSpacing: 1 }}>COMPLETED</span>}
                      </div>
                      <p style={{ fontSize: 11.5, color: "#5a7090", lineHeight: 1.65 }}>{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Precedents */}
            <div style={{ background: "#fff", border: "1px solid #dbe6f0", borderRadius: 8, padding: "20px 24px", marginBottom: 20, boxShadow: "0 2px 8px rgba(30,90,176,0.06)" }}>
              <div style={{ fontSize: 11, color: "#8a9eb8", letterSpacing: 1.5, marginBottom: 16, fontWeight: 700 }}>HISTORICAL PRECEDENTS — MSCI RECLASSIFICATIONS</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#f4f7fb", borderBottom: "2px solid #dbe6f0" }}>
                      {["Country","Direction","Year","Passive Inflows","Active Inflows","Total","Notes"].map(h => (
                        <th key={h} style={{ padding: "10px 13px", textAlign: "left", color: "#7a90a8", fontSize: 10, letterSpacing: 1.2, fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { country:"Argentina",    dir:"FM→EM", year:"2019", passive:"$500M",     active:"$1.2B",     total:"$1.7B",     note:"Prior EM inclusion, capital controls reintroduced" },
                      { country:"Saudi Arabia", dir:"FM→EM", year:"2019", passive:"$10B",      active:"$30B",      total:"$40B",      note:"ARAMCO IPO; phased over 2 SAIR cycles" },
                      { country:"Kuwait",       dir:"FM→EM", year:"2019", passive:"$2.5B",     active:"$5B",       total:"$7.5B",     note:"Gradual rebalancing; high domestic liquidity" },
                      { country:"UAE/Qatar",    dir:"FM→EM", year:"2014", passive:"$1B ea.",   active:"$2B ea.",   total:"$3B ea.",   note:"Dual listing structure facilitated flows" },
                      { country:"Pakistan",     dir:"FM→EM", year:"2017", passive:"$600M",     active:"$1B",       total:"$1.6B",     note:"Downgraded back to FM in 2021" },
                      { country:"Greece",       dir:"EM→DM", year:"2013", passive:"$1.2B out", active:"$2B out",   total:"$3.2B out", note:"Outflows due to downgrade" },
                    ].map(row => (
                      <tr key={row.country} className="row-hover" style={{ borderBottom: "1px solid #f0f4f8" }}>
                        <td style={{ padding: "10px 13px", color: row.country==="Argentina"?cfg.color:"#1e3a5a", fontWeight: row.country==="Argentina"?700:400 }}>{row.country}</td>
                        <td style={{ padding: "10px 13px" }}>
                          <span style={{ background: row.dir.includes("out")?"rgba(239,68,68,0.1)":"rgba(35,162,158,0.12)", color: row.dir.includes("out")?"#EF4444":"#23a29e", padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{row.dir}</span>
                        </td>
                        <td style={{ padding: "10px 13px", color: "#5a7090" }}>{row.year}</td>
                        <td style={{ padding: "10px 13px", color: "#3399ff", fontWeight: 600 }}>{row.passive}</td>
                        <td style={{ padding: "10px 13px", color: "#1e5ab0", fontWeight: 600 }}>{row.active}</td>
                        <td style={{ padding: "10px 13px", color: "#000039", fontWeight: 700 }}>{row.total}</td>
                        <td style={{ padding: "10px 13px", color: "#7a90a8", fontSize: 11 }}>{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Risk grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { title: "INCLUSION ENABLERS", icon: "▲", iconColor: "#23a29e", items: [
                  "IMF program providing FX stability framework",
                  "Managed float with explicit bands reduces FX risk",
                  "Dividend repatriation approved from Jan 2025",
                  "Fiscal primary surplus maintained (+1.8% GDP)",
                  "Inflation declining sharply (from 211% → ~55% YoY)",
                  "Political stability: Milei midterm results 2025",
                  "Vaca Muerta shale driving energy sector re-rating",
                ]},
                { title: "KEY RISKS TO INCLUSION", icon: "▼", iconColor: "#EF4444", items: [
                  "Institutional investor FX restrictions still in place",
                  "Onshore market liquidity insufficient (BYMA turnover)",
                  "Settlement infrastructure: T+2 vs EM standard T+1",
                  "FX band may be viewed as residual capital control",
                  "Argentina's history: 5 IMF programs since 2000",
                  "Political risk: 2027 general elections (Oct)",
                  "Limited free float on domestic listings",
                ]},
              ].map(panel => (
                <div key={panel.title} style={{ background: "#fff", border: "1px solid #dbe6f0", borderRadius: 8, padding: "20px 24px", boxShadow: "0 2px 8px rgba(30,90,176,0.06)" }}>
                  <div style={{ fontSize: 11, color: "#8a9eb8", letterSpacing: 1.5, marginBottom: 16, fontWeight: 700 }}>{panel.title}</div>
                  {panel.items.map(r => (
                    <div key={r} style={{ display: "flex", gap: 9, marginBottom: 9, fontSize: 12 }}>
                      <span style={{ color: panel.iconColor, flexShrink: 0, fontWeight: 700 }}>{panel.icon}</span>
                      <span style={{ color: "#1e3a5a", lineHeight: 1.55 }}>{r}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div style={{ padding: "12px 28px", borderTop: "1px solid #dbe6f0", background: "#fff", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 10.5, color: "#8a9eb8" }}>
          Data: MSCI Argentina IMI (Nov 2025 factsheet) · Market caps in USD · ADTV = 3-month average daily traded value
        </span>
        <span style={{ fontSize: 10.5, color: "#8a9eb8" }}>
          ⚠ Simulation model for analytical purposes only · Not investment advice · Latin Securities © {new Date().getFullYear()}
        </span>
      </div>
    </div>
  );
}
