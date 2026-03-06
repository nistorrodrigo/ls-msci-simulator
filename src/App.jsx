import { useState, useMemo } from "react";
import ExcelJS from "exceljs";
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

// ─── Shared style helpers ─────────────────────────────────────────────────────
const XL = {
  NAVY:    "FF000039",
  BLUE:    "FF1E5AB0",
  LTBLUE:  "FF3399FF",
  TEAL:    "FF23A29E",
  RED:     "FFEF4444",
  AMBER:   "FFF59E0B",
  WHITE:   "FFFFFFFF",
  GRAY:    "FF8A9EB8",
  LTGRAY:  "FFF4F7FB",
  MIDGRAY: "FFDBE6F0",
  TEXT:    "FF1E3A5A",
  GREEN:   "FF217346",
};

function applyHeaderStyle(cell, bgColor = XL.NAVY) {
  cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
  cell.font   = { bold: true, color: { argb: XL.WHITE }, size: 10, name: "Calibri" };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = {
    top:    { style: "thin", color: { argb: XL.MIDGRAY } },
    bottom: { style: "thin", color: { argb: XL.MIDGRAY } },
    left:   { style: "thin", color: { argb: XL.MIDGRAY } },
    right:  { style: "thin", color: { argb: XL.MIDGRAY } },
  };
}

function applyDataStyle(cell, rowIdx, align = "right", bold = false) {
  const bg = rowIdx % 2 === 0 ? XL.WHITE : XL.LTGRAY;
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
  cell.font = { bold, color: { argb: XL.TEXT }, size: 10, name: "Calibri" };
  cell.alignment = { horizontal: align, vertical: "middle" };
  cell.border = {
    top:    { style: "hair", color: { argb: XL.MIDGRAY } },
    bottom: { style: "hair", color: { argb: XL.MIDGRAY } },
    left:   { style: "hair", color: { argb: XL.MIDGRAY } },
    right:  { style: "hair", color: { argb: XL.MIDGRAY } },
  };
}

function applyMedianStyle(cell) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.NAVY } };
  cell.font = { bold: true, color: { argb: XL.WHITE }, size: 10, name: "Calibri", italic: true };
  cell.alignment = { horizontal: "center", vertical: "middle" };
  cell.border = {
    top:    { style: "medium", color: { argb: XL.LTBLUE } },
    bottom: { style: "medium", color: { argb: XL.LTBLUE } },
    left:   { style: "hair",   color: { argb: XL.MIDGRAY } },
    right:  { style: "hair",   color: { argb: XL.MIDGRAY } },
  };
}

function applySectorLabelStyle(cell) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCD9F0" } };
  cell.font = { bold: true, color: { argb: XL.NAVY }, size: 10, name: "Calibri" };
  cell.alignment = { horizontal: "left", vertical: "middle" };
  cell.border = {
    top:    { style: "thin",  color: { argb: XL.NAVY } },
    bottom: { style: "hair",  color: { argb: XL.MIDGRAY } },
    left:   { style: "thin",  color: { argb: XL.NAVY } },
    right:  { style: "hair",  color: { argb: XL.MIDGRAY } },
  };
}

function applyTitleStyle(cell) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.NAVY } };
  cell.font = { bold: true, color: { argb: XL.WHITE }, size: 13, name: "Calibri" };
  cell.alignment = { horizontal: "left", vertical: "middle" };
}

// ─── Export helpers ───────────────────────────────────────────────────────────
async function exportExcel({ scenario, cfg, qualified, stocksWithWeights, passiveInflows, activeInflows, totalInflows, effectivePassiveAUM, activeFrac }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Latin Securities";
  wb.created = new Date();

  const totalFloatCap = qualified.reduce((a, s) => a + s.floatMktCap, 0);
  const sortedStocks  = [...STOCKS].sort((a, b) => b.floatMktCap - a.floatMktCap);
  const sectors = [...new Set(sortedStocks.map(s => s.sector))];

  // ══════════════════════════════════════════════════════
  // SHEET 1 — CONSTITUENTS (main table like the reference)
  // ══════════════════════════════════════════════════════
  const ws1 = wb.addWorksheet("Constituents");
  ws1.views = [{ showGridLines: false }];

  // Column widths
  ws1.columns = [
    { key: "company", width: 26 },
    { key: "ticker",  width: 11 },
    { key: "price",   width: 11 },
    { key: "cap",     width: 11 },
    { key: "adtv",    width: 10 },
    { key: "ffloat",  width: 10 },
    { key: "listing", width: 10 },
    { key: "wt",      width: 10 },
    { key: "daysP",   width: 13 },
    { key: "daysT",   width: 13 },
    { key: "status",  width: 12 },
  ];

  // Title row
  const titleRow = ws1.addRow(["MSCI Argentina Inclusion Simulator — Latin Securities", "", "", "", "", "", "", "", "", "", ""]);
  ws1.mergeCells(`A${titleRow.number}:K${titleRow.number}`);
  applyTitleStyle(titleRow.getCell(1));
  titleRow.height = 28;

  // Subtitle row
  const subRow = ws1.addRow([
    `Scenario: ${cfg.label}   |   Passive AUM: $${effectivePassiveAUM}B   |   Active fraction: ${activeFrac.toFixed(1)}x   |   Generated: ${new Date().toLocaleDateString("es-AR")}`,
    ...Array(10).fill("")
  ]);
  ws1.mergeCells(`A${subRow.number}:K${subRow.number}`);
  subRow.getCell(1).fill  = { type: "pattern", pattern: "solid", fgColor: { argb: XL.BLUE } };
  subRow.getCell(1).font  = { color: { argb: XL.WHITE }, size: 10, name: "Calibri" };
  subRow.getCell(1).alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  subRow.height = 18;

  ws1.addRow([]); // spacer

  // Header row
  const hdrs = ["Company", "Ticker", "Float Cap\n(US$m)", "ADTV\n(US$m)", "Free\nFloat%", "Listing", "Index\nWeight%", "Days\n(Passive)", "Days\n(Total)", "Min Size\nOK?", "Status"];
  const hdrRow = ws1.addRow(hdrs);
  hdrRow.height = 32;
  hdrRow.eachCell(cell => applyHeaderStyle(cell));

  // Data rows grouped by sector
  let rowIdx = 0;
  for (const sector of sectors) {
    const sectorStocks = sortedStocks.filter(s => s.sector === sector);
    const eligibleInSector = sectorStocks.filter(s => qualified.find(q => q.ticker === s.ticker));
    if (sectorStocks.length === 0) continue;

    // Sector label row
    const secRow = ws1.addRow([sector, ...Array(10).fill("")]);
    ws1.mergeCells(`A${secRow.number}:K${secRow.number}`);
    secRow.eachCell(cell => applySectorLabelStyle(cell));
    secRow.height = 16;

    for (const s of sectorStocks) {
      const isIn   = qualified.find(q => q.ticker === s.ticker);
      const sw     = stocksWithWeights.find(q => q.ticker === s.ticker);
      const sizeOk = s.floatMktCap >= cfg.minFloatMktCap;
      const adtvOk = s.adtvM >= cfg.minADTV;
      const pf     = isIn && sw ? passiveInflows * sw.indexWeight : null;
      const tf     = isIn && sw ? totalInflows   * sw.indexWeight : null;

      const dr = ws1.addRow([
        s.name,
        s.ticker,
        s.floatMktCap,
        s.adtvM,
        `${(s.freeFlt * 100).toFixed(0)}%`,
        s.listing,
        isIn && sw ? parseFloat((sw.indexWeight * 100).toFixed(2)) : "—",
        pf !== null ? parseFloat((pf / s.adtvM).toFixed(2)) : "—",
        tf !== null ? parseFloat((tf / s.adtvM).toFixed(2)) : "—",
        sizeOk && adtvOk ? "✓" : "✗",
        isIn ? "ELIGIBLE" : (!sizeOk && !adtvOk ? "SIZE+ADTV" : !sizeOk ? "SIZE" : "ADTV"),
      ]);
      dr.height = 16;

      dr.eachCell((cell, colNum) => {
        applyDataStyle(cell, rowIdx, colNum === 1 ? "left" : "center");
      });

      // Color overrides
      const statusCell = dr.getCell(11);
      if (isIn) {
        statusCell.font = { bold: true, color: { argb: XL.GREEN.replace("FF","FF") }, size: 10, name: "Calibri" };
      } else {
        statusCell.font = { bold: true, color: { argb: XL.RED }, size: 10, name: "Calibri" };
      }

      const sizeCell = dr.getCell(10);
      sizeCell.font = { bold: true, color: { argb: sizeOk && adtvOk ? XL.TEAL : XL.RED }, size: 10, name: "Calibri" };
      sizeCell.alignment = { horizontal: "center", vertical: "middle" };

      // Color days-of-trading
      [8, 9].forEach(col => {
        const val = parseFloat(dr.getCell(col).value);
        if (!isNaN(val)) {
          dr.getCell(col).font = { bold: true, size: 10, name: "Calibri",
            color: { argb: val > 5 ? XL.RED : val > 2 ? XL.AMBER : XL.TEAL }
          };
        }
      });

      // Float cap color
      dr.getCell(3).font = { bold: sizeOk, size: 10, name: "Calibri",
        color: { argb: sizeOk ? XL.TEXT : XL.RED }
      };
      dr.getCell(4).font = { bold: adtvOk, size: 10, name: "Calibri",
        color: { argb: adtvOk ? XL.TEXT : XL.RED }
      };

      rowIdx++;
    }

    // Sector median row (eligible only)
    if (eligibleInSector.length > 0) {
      const medianCap  = eligibleInSector.map(s => s.floatMktCap).sort((a,b)=>a-b);
      const medianAdtv = eligibleInSector.map(s => s.adtvM).sort((a,b)=>a-b);
      const mid = i => i[Math.floor(i.length/2)];
      const medRow = ws1.addRow([
        `${sector} Median`, "", mid(medianCap), mid(medianAdtv),
        "", "", "", "", "", "", `${eligibleInSector.length} eligible`,
      ]);
      medRow.height = 17;
      medRow.eachCell(cell => applyMedianStyle(cell));
      medRow.getCell(11).font = { bold: true, italic: true, color: { argb: XL.AMBER }, size: 10, name: "Calibri" };
      rowIdx++;
    }
  }

  // Freeze header rows
  ws1.views[0].state = "frozen";
  ws1.views[0].ySplit = 4;

  // ══════════════════════════════════════════════════════
  // SHEET 2 — FLOW ESTIMATES
  // ══════════════════════════════════════════════════════
  const ws2 = wb.addWorksheet("Flow Estimates");
  ws2.views = [{ showGridLines: false }];
  ws2.columns = [
    { key: "company", width: 26 },
    { key: "ticker",  width: 10 },
    { key: "wt",      width: 12 },
    { key: "passive", width: 16 },
    { key: "active",  width: 16 },
    { key: "total",   width: 16 },
    { key: "daysP",   width: 15 },
    { key: "daysT",   width: 15 },
  ];

  const t2 = ws2.addRow(["MSCI Argentina — Flow Estimates by Constituent", ...Array(7).fill("")]);
  ws2.mergeCells(`A${t2.number}:H${t2.number}`);
  applyTitleStyle(t2.getCell(1)); t2.height = 28;

  const s2 = ws2.addRow([
    `Scenario: ${cfg.label}   |   Passive AUM: $${effectivePassiveAUM}B   |   Active fraction: ${activeFrac.toFixed(1)}x   |   Total flows: $${totalInflows.toFixed(0)}M`,
    ...Array(7).fill("")
  ]);
  ws2.mergeCells(`A${s2.number}:H${s2.number}`);
  s2.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.BLUE } };
  s2.getCell(1).font = { color: { argb: XL.WHITE }, size: 10, name: "Calibri" };
  s2.getCell(1).alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  s2.height = 18;
  ws2.addRow([]);

  const h2 = ws2.addRow(["Company", "Ticker", "Index Wt.\n(%)", "Passive Inflow\n(US$m)", "Active Inflow\n(US$m)", "Total Inflow\n(US$m)", "Days of Trading\n(Passive)", "Days of Trading\n(Total)"]);
  h2.height = 32;
  h2.eachCell(cell => applyHeaderStyle(cell));

  let ri2 = 0;
  [...stocksWithWeights].sort((a, b) => b.floatMktCap - a.floatMktCap).forEach(s => {
    const pf = passiveInflows * s.indexWeight;
    const af = activeInflows  * s.indexWeight;
    const tf = totalInflows   * s.indexWeight;
    const dr = ws2.addRow([
      s.name, s.ticker,
      parseFloat((s.indexWeight * 100).toFixed(2)),
      parseFloat(pf.toFixed(1)),
      parseFloat(af.toFixed(1)),
      parseFloat(tf.toFixed(1)),
      parseFloat((pf / s.adtvM).toFixed(2)),
      parseFloat((tf / s.adtvM).toFixed(2)),
    ]);
    dr.height = 16;
    dr.eachCell((cell, col) => applyDataStyle(cell, ri2, col === 1 ? "left" : "center"));
    dr.getCell(4).font = { bold: false, color: { argb: XL.LTBLUE.replace("FF","FF") }, size: 10, name: "Calibri" };
    dr.getCell(5).font = { bold: false, color: { argb: XL.BLUE  }, size: 10, name: "Calibri" };
    dr.getCell(6).font = { bold: true,  color: { argb: XL.NAVY  }, size: 10, name: "Calibri" };
    const dp = parseFloat((pf / s.adtvM).toFixed(2));
    const dt = parseFloat((tf / s.adtvM).toFixed(2));
    dr.getCell(7).font = { bold: true, size: 10, name: "Calibri", color: { argb: dp>3?XL.RED:dp>1.5?XL.AMBER:XL.TEAL }};
    dr.getCell(8).font = { bold: true, size: 10, name: "Calibri", color: { argb: dt>5?XL.RED:dt>2?XL.AMBER:XL.TEAL }};
    ri2++;
  });

  // Total row
  const totRow = ws2.addRow([
    "TOTAL", "",
    100,
    parseFloat(passiveInflows.toFixed(1)),
    parseFloat(activeInflows.toFixed(1)),
    parseFloat(totalInflows.toFixed(1)),
    "", ""
  ]);
  totRow.height = 18;
  totRow.eachCell(cell => applyMedianStyle(cell));
  totRow.getCell(4).font = { bold: true, color: { argb: XL.LTBLUE }, size: 10, name: "Calibri" };
  totRow.getCell(5).font = { bold: true, color: { argb: "FFADD4FF" }, size: 10, name: "Calibri" };
  totRow.getCell(6).font = { bold: true, color: { argb: XL.AMBER  }, size: 10, name: "Calibri" };

  ws2.views[0].state = "frozen";
  ws2.views[0].ySplit = 4;

  // ══════════════════════════════════════════════════════
  // SHEET 3 — SUMMARY / PARAMETERS
  // ══════════════════════════════════════════════════════
  const ws3 = wb.addWorksheet("Summary");
  ws3.views = [{ showGridLines: false }];
  ws3.columns = [{ width: 28 }, { width: 22 }, { width: 14 }];

  const addParam = (label, value, bold = false) => {
    const r = ws3.addRow([label, value, ""]);
    r.height = 17;
    r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.LTGRAY } };
    r.getCell(1).font = { color: { argb: XL.GRAY }, size: 10, name: "Calibri" };
    r.getCell(1).border = { bottom: { style: "hair", color: { argb: XL.MIDGRAY } } };
    r.getCell(1).alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    r.getCell(2).font = { bold, color: { argb: XL.NAVY }, size: 11, name: "Calibri" };
    r.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
    r.getCell(2).border = { bottom: { style: "hair", color: { argb: XL.MIDGRAY } } };
  };

  const t3 = ws3.addRow(["MSCI Argentina Simulation — Parameters & Flows", "", ""]);
  ws3.mergeCells(`A${t3.number}:C${t3.number}`);
  applyTitleStyle(t3.getCell(1)); t3.height = 28;
  ws3.addRow([]);

  addParam("SCENARIO",              cfg.label, true);
  addParam("Timeline",              cfg.timeline);
  addParam("Passive AUM tracked",   `$${effectivePassiveAUM}B`);
  addParam("Argentina est. weight", `${(cfg.argWeight * 100).toFixed(3)}%`);
  addParam("Active / Passive fraction", `${activeFrac.toFixed(2)}×`);
  addParam("Min Float Mkt Cap",     `$${cfg.minFloatMktCap >= 1000 ? (cfg.minFloatMktCap/1000).toFixed(1)+"B" : cfg.minFloatMktCap+"M"}`);
  addParam("Min ADTV (3M avg)",     `$${cfg.minADTV}M / day`);
  addParam("Eligible constituents", `${qualified.length} of ${STOCKS.length}`);
  ws3.addRow([]);

  const fhRow = ws3.addRow(["FLOW ESTIMATES", "", ""]);
  ws3.mergeCells(`A${fhRow.number}:C${fhRow.number}`);
  fhRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.BLUE } };
  fhRow.getCell(1).font = { bold: true, color: { argb: XL.WHITE }, size: 10, name: "Calibri" };
  fhRow.getCell(1).alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  fhRow.height = 18;

  addParam("Passive Inflows", `$${passiveInflows.toFixed(0)}M`);
  addParam("Active Inflows",  `$${activeInflows.toFixed(0)}M`);
  addParam("Total Inflows",   `$${totalInflows.toFixed(0)}M`, true);
  addParam("Analyst consensus range", `$${(cfg.total_flows_low/1000).toFixed(1)}B – $${(cfg.total_flows_high/1000).toFixed(1)}B`);

  // ══════════════════════════════════════════════════════
  // SHEET 4 — PRECEDENTS
  // ══════════════════════════════════════════════════════
  const ws4 = wb.addWorksheet("Precedents");
  ws4.views = [{ showGridLines: false }];
  ws4.columns = [
    { width: 16 }, { width: 10 }, { width: 8 },
    { width: 15 }, { width: 15 }, { width: 14 }, { width: 40 }
  ];

  const t4 = ws4.addRow(["MSCI Reclassification Historical Precedents", "", "", "", "", "", ""]);
  ws4.mergeCells(`A${t4.number}:G${t4.number}`);
  applyTitleStyle(t4.getCell(1)); t4.height = 28;
  ws4.addRow([]);

  const h4 = ws4.addRow(["Country", "Direction", "Year", "Passive Inflows", "Active Inflows", "Total", "Notes"]);
  h4.height = 22;
  h4.eachCell(cell => applyHeaderStyle(cell));

  const precData = [
    ["Argentina",    "FM→EM", 2019, "$500M",     "$1.2B",   "$1.7B",     "Prior EM inclusion — capital controls reintroduced 2019"],
    ["Saudi Arabia", "FM→EM", 2019, "$10B",       "$30B",    "$40B",      "ARAMCO IPO; phased over 2 SAIR cycles"],
    ["Kuwait",       "FM→EM", 2019, "$2.5B",      "$5B",     "$7.5B",     "Gradual rebalancing; high domestic liquidity"],
    ["UAE / Qatar",  "FM→EM", 2014, "$1B ea.",    "$2B ea.", "$3B ea.",   "Dual listing structure facilitated flows"],
    ["Pakistan",     "FM→EM", 2017, "$600M",      "$1B",     "$1.6B",     "Downgraded back to FM in 2021"],
    ["Greece",       "EM→DM", 2013, "$1.2B out",  "$2B out", "$3.2B out", "Outflows due to downgrade"],
  ];
  precData.forEach((row, ri) => {
    const dr = ws4.addRow(row);
    dr.height = 17;
    dr.eachCell((cell, col) => applyDataStyle(cell, ri, col <= 2 ? "left" : "center"));
    // Argentina highlight
    if (ri === 0) {
      dr.getCell(1).font = { bold: true, color: { argb: XL.TEAL }, size: 10, name: "Calibri" };
      dr.getCell(6).font = { bold: true, color: { argb: XL.TEAL }, size: 10, name: "Calibri" };
    }
    // Direction badge color
    const dir = row[1];
    dr.getCell(2).font = {
      bold: true, size: 10, name: "Calibri",
      color: { argb: dir.includes("DM") ? XL.RED : XL.TEAL }
    };
  });

  // ── Generate and download ──
  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `LS_MSCI_Argentina_${scenario}_${new Date().toISOString().slice(0,10)}.xlsx`
  );
}

function exportPDF({ scenario, cfg, qualified, stocksWithWeights, passiveInflows, activeInflows, totalInflows, effectivePassiveAUM, activeFrac }) {
  const doc   = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const NAVY  = [0,   0,   57];
  const BLUE  = [30,  90,  176];
  const LTBLUE= [51,  153, 255];
  const TEAL  = [35,  162, 158];
  const AMBER = [245, 158, 11];
  const RED   = [220, 50,  50];
  const WHITE = [255, 255, 255];
  const GRAY  = [120, 144, 168];
  const LTGRAY= [244, 247, 251];
  const TEXT  = [30,  58,  90];
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const scColor = scenario === "frontier" ? AMBER : TEAL;

  // ── Helper: draw page header ──────────────────────────────────────────────
  function drawHeader(pageTitle) {
    // Navy bar
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageW, 18, "F");
    // Blue accent stripe
    doc.setFillColor(...BLUE);
    doc.rect(0, 18, pageW, 2, "F");

    // LS logo bookmarks
    doc.setFillColor(...BLUE);
    doc.roundedRect(7, 3, 7, 12, 1, 1, "F");
    doc.setFillColor(...LTBLUE);
    doc.roundedRect(11, 3, 7, 12, 1, 1, "F");

    // Brand text
    doc.setTextColor(...WHITE);
    doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text("LATIN SECURITIES", 22, 9);
    doc.setFontSize(7); doc.setFont("helvetica", "normal");
    doc.text("RESEARCH & CAPITAL MARKETS", 22, 14);

    // Divider
    doc.setDrawColor(...LTBLUE);
    doc.setLineWidth(0.3);
    doc.line(90, 4, 90, 16);

    // Page title
    doc.setTextColor(...WHITE);
    doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text(pageTitle, 95, 9);
    doc.setTextColor(180, 210, 255);
    doc.setFontSize(7); doc.setFont("helvetica", "normal");
    doc.text(`Scenario: ${cfg.label}   ·   Passive AUM: $${effectivePassiveAUM}B   ·   Active: ${activeFrac.toFixed(1)}x`, 95, 14);

    // Scenario badge (right)
    doc.setFillColor(...scColor);
    doc.roundedRect(pageW - 48, 5, 40, 10, 2, 2, "F");
    doc.setTextColor(...NAVY);
    doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.text(cfg.label.toUpperCase(), pageW - 28, 11.5, { align: "center" });
  }

  // ── Helper: draw page footer ──────────────────────────────────────────────
  function drawFooter(pageNum, totalPages) {
    doc.setFillColor(...NAVY);
    doc.rect(0, pageH - 8, pageW, 8, "F");
    doc.setTextColor(150, 180, 220);
    doc.setFontSize(6); doc.setFont("helvetica", "normal");
    doc.text(
      `Latin Securities  ·  MSCI Argentina Inclusion Simulator  ·  ${new Date().toLocaleDateString("es-AR")}  ·  For analytical purposes only — not investment advice`,
      10, pageH - 3
    );
    doc.setTextColor(...WHITE);
    doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.text(`${pageNum} / ${totalPages}`, pageW - 10, pageH - 3, { align: "right" });
  }

  // ══════════════════════════════════════════════════
  // PAGE 1 — PARAMETERS + CONSTITUENT TABLE
  // ══════════════════════════════════════════════════
  drawHeader("MSCI Argentina Inclusion Simulator — Constituent Analysis");

  // ── KPI cards row ──
  const cards = [
    { label: "PASSIVE INFLOWS",  value: `$${passiveInflows.toFixed(0)}M`,  color: LTBLUE },
    { label: "ACTIVE INFLOWS",   value: `$${activeInflows.toFixed(0)}M`,   color: BLUE   },
    { label: "TOTAL INFLOWS",    value: `$${totalInflows.toFixed(0)}M`,    color: scColor },
    { label: "ELIGIBLE STOCKS",  value: `${qualified.length} / ${STOCKS.length}`, color: TEAL },
    { label: "ANALYST RANGE",    value: `$${(cfg.total_flows_low/1000).toFixed(1)}–$${(cfg.total_flows_high/1000).toFixed(1)}B`, color: AMBER },
    { label: "SIZE THRESHOLD",   value: `$${cfg.minFloatMktCap >= 1000 ? (cfg.minFloatMktCap/1000).toFixed(1)+"B" : cfg.minFloatMktCap+"M"}`, color: GRAY },
    { label: "ADTV THRESHOLD",   value: `$${cfg.minADTV}M/day`,            color: GRAY   },
    { label: "ARG. INDEX WEIGHT",value: `${(cfg.argWeight*100).toFixed(3)}%`, color: NAVY },
  ];
  const cardW = (pageW - 20) / 8;
  cards.forEach((card, i) => {
    const x = 10 + i * cardW;
    // card bg
    doc.setFillColor(...LTGRAY);
    doc.roundedRect(x, 23, cardW - 1.5, 14, 1, 1, "F");
    // left accent bar
    doc.setFillColor(...card.color);
    doc.roundedRect(x, 23, 1.5, 14, 0.5, 0.5, "F");
    // label
    doc.setTextColor(...GRAY); doc.setFontSize(5.2); doc.setFont("helvetica", "bold");
    doc.text(card.label, x + 3.5, 28);
    // value
    doc.setTextColor(...card.color); doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text(card.value, x + 3.5, 34);
  });

  // ── Section title ──
  doc.setFillColor(...BLUE);
  doc.rect(10, 40, pageW - 20, 6, "F");
  doc.setTextColor(...WHITE); doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.text("ELIGIBLE CONSTITUENTS — ELIGIBILITY SCREENING", 13, 44.5);

  // ── Sector-grouped constituent table ──
  const sectors = [...new Set([...STOCKS].sort((a,b)=>b.floatMktCap-a.floatMktCap).map(s => s.sector))];
  const tableBody = [];
  const sectorRowIndices = [];

  sectors.forEach(sector => {
    const sectorStocks = [...STOCKS].sort((a,b)=>b.floatMktCap-a.floatMktCap).filter(s=>s.sector===sector);
    if (!sectorStocks.length) return;

    // Sector label
    sectorRowIndices.push({ idx: tableBody.length, label: sector });
    tableBody.push([{ content: sector, colSpan: 10, styles: {
      fillColor: [204, 217, 240], textColor: NAVY,
      fontStyle: "bold", fontSize: 6.5, cellPadding: 2,
    }}]);

    sectorStocks.forEach(s => {
      const isIn = qualified.find(q => q.ticker === s.ticker);
      const sw   = stocksWithWeights.find(q => q.ticker === s.ticker);
      const pf   = isIn && sw ? passiveInflows * sw.indexWeight : null;
      const tf   = isIn && sw ? totalInflows   * sw.indexWeight : null;
      tableBody.push([
        s.ticker,
        s.name.length > 24 ? s.name.slice(0, 24) + "…" : s.name,
        fmt(s.floatMktCap),
        `$${s.adtvM}M`,
        `${(s.freeFlt * 100).toFixed(0)}%`,
        s.listing,
        isIn && sw ? fmtPct(sw.indexWeight) : "—",
        pf !== null ? (pf / s.adtvM).toFixed(1) + "d" : "—",
        tf !== null ? (tf / s.adtvM).toFixed(1) + "d" : "—",
        isIn ? "ELIGIBLE" : "EXCL.",
      ]);
    });
  });

  autoTable(doc, {
    startY: 47,
    head: [["Ticker", "Company", "Float Cap\n(US$m)", "ADTV\n(US$m)", "Free\nFloat%", "Listing", "Index\nWt.%", "Days\n(Pass.)", "Days\n(Total)", "Status"]],
    body: tableBody,
    headStyles: {
      fillColor: NAVY, textColor: WHITE,
      fontSize: 6.5, fontStyle: "bold",
      halign: "center", valign: "middle",
      cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
    },
    bodyStyles: { fontSize: 6.5, textColor: TEXT, cellPadding: 1.8 },
    alternateRowStyles: { fillColor: LTGRAY },
    columnStyles: {
      0: { halign: "center", fontStyle: "bold", cellWidth: 14 },
      1: { halign: "left",   cellWidth: 40 },
      2: { halign: "right",  cellWidth: 20 },
      3: { halign: "right",  cellWidth: 18 },
      4: { halign: "center", cellWidth: 14 },
      5: { halign: "center", cellWidth: 14 },
      6: { halign: "center", cellWidth: 16 },
      7: { halign: "center", cellWidth: 18 },
      8: { halign: "center", cellWidth: 18 },
      9: { halign: "center", cellWidth: 16 },
    },
    didParseCell(data) {
      if (data.section !== "body" || data.row.raw?.[0]?.colSpan) return;
      const val = String(data.cell.raw ?? "");
      const col = data.column.index;
      // Status
      if (col === 9) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = val === "ELIGIBLE" ? TEAL : RED;
      }
      // Float Cap color if below threshold
      if (col === 2) {
        const stock = [...STOCKS].sort((a,b)=>b.floatMktCap-a.floatMktCap)[data.row.index];
        // no easy way to correlate — handled by fillColor below
      }
      // Days of trading color
      if ((col === 7 || col === 8) && val.endsWith("d")) {
        const n = parseFloat(val);
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = n > 5 ? RED : n > 2 ? AMBER : TEAL;
      }
    },
    didDrawCell(data) {
      // Sector row left accent bar
      if (data.section === "body" && data.row.raw?.[0]?.colSpan && data.column.index === 0) {
        doc.setFillColor(...BLUE);
        doc.rect(data.cell.x, data.cell.y, 1.5, data.cell.height, "F");
      }
    },
    margin: { left: 10, right: 10, bottom: 12 },
    tableLineColor: [220, 230, 240],
    tableLineWidth: 0.1,
  });

  // ══════════════════════════════════════════════════
  // PAGE 2 — FLOW BREAKDOWN + ANALYST CONSENSUS
  // ══════════════════════════════════════════════════
  doc.addPage();
  drawHeader("Flow Breakdown by Constituent");

  // ── Section bar ──
  doc.setFillColor(...BLUE);
  doc.rect(10, 23, pageW - 20, 6, "F");
  doc.setTextColor(...WHITE); doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.text("ESTIMATED INFLOWS — PASSIVE · ACTIVE · TOTAL · DAYS OF TRADING IMPACT", 13, 27.5);

  autoTable(doc, {
    startY: 30,
    head: [["Ticker", "Company", "Index Wt.%", "Passive Inflow\n(US$m)", "Active Inflow\n(US$m)", "Total Inflow\n(US$m)", "Days\n(Passive)", "Days\n(Total)"]],
    body: [...stocksWithWeights].sort((a, b) => b.floatMktCap - a.floatMktCap).map(s => {
      const pf = passiveInflows * s.indexWeight;
      const af = activeInflows  * s.indexWeight;
      const tf = totalInflows   * s.indexWeight;
      return [
        s.ticker,
        s.name.length > 28 ? s.name.slice(0, 28) + "…" : s.name,
        fmtPct(s.indexWeight),
        `$${pf.toFixed(1)}M`,
        `$${af.toFixed(1)}M`,
        `$${tf.toFixed(1)}M`,
        (pf / s.adtvM).toFixed(2) + "d",
        (tf / s.adtvM).toFixed(2) + "d",
      ];
    }),
    // Total row
    foot: [[
      "TOTAL", "",
      "100.00%",
      `$${passiveInflows.toFixed(1)}M`,
      `$${activeInflows.toFixed(1)}M`,
      `$${totalInflows.toFixed(1)}M`,
      "", "",
    ]],
    headStyles: {
      fillColor: NAVY, textColor: WHITE, fontSize: 7, fontStyle: "bold",
      halign: "center", valign: "middle",
      cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
    },
    footStyles: {
      fillColor: NAVY, textColor: WHITE, fontSize: 7.5, fontStyle: "bold",
      halign: "center",
    },
    bodyStyles: { fontSize: 7, textColor: TEXT, cellPadding: 1.8 },
    alternateRowStyles: { fillColor: LTGRAY },
    columnStyles: {
      0: { halign: "center", fontStyle: "bold", cellWidth: 16 },
      1: { halign: "left",   cellWidth: 50 },
      2: { halign: "center", cellWidth: 20 },
      3: { halign: "right",  cellWidth: 28, textColor: LTBLUE },
      4: { halign: "right",  cellWidth: 28, textColor: BLUE },
      5: { halign: "right",  cellWidth: 28, fontStyle: "bold" },
      6: { halign: "center", cellWidth: 20 },
      7: { halign: "center", cellWidth: 20 },
    },
    didParseCell(data) {
      if (data.section !== "body") return;
      const val = String(data.cell.raw ?? "");
      const col = data.column.index;
      if ((col === 6 || col === 7) && val.endsWith("d")) {
        const n = parseFloat(val);
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = n > 5 ? RED : n > 2 ? AMBER : TEAL;
      }
      if (col === 5) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = scColor;
      }
    },
    margin: { left: 10, right: 10, bottom: 12 },
    tableLineColor: [220, 230, 240],
    tableLineWidth: 0.1,
  });

  // ── Analyst consensus panel ──
  const panelY = doc.lastAutoTable.finalY + 6;
  const panelH = 26;
  const analysts = [
    { src: "JPMorgan (2024)", fm: "$200M–$400M", em: "~$1B EM passive" },
    { src: "Goldman Sachs",   fm: "$150M–$350M", em: "$800M–$2.0B EM" },
    { src: "UBS / Citi",      fm: "$200M–$500M", em: "$1.0B–$2.5B EM" },
    { src: "Latam Advisors",  fm: "$300M–$700M", em: "$1.5B–$3.0B EM" },
  ];
  const colW2 = (pageW - 20) / analysts.length;

  // Panel header
  doc.setFillColor(...BLUE);
  doc.rect(10, panelY, pageW - 20, 6, "F");
  doc.setTextColor(...WHITE); doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.text("ANALYST CONSENSUS ESTIMATES", 13, panelY + 4.5);

  // Panel body
  doc.setFillColor(...LTGRAY);
  doc.rect(10, panelY + 6, pageW - 20, panelH, "F");

  analysts.forEach((a, i) => {
    const x = 10 + i * colW2;
    // vertical divider (except first)
    if (i > 0) {
      doc.setDrawColor(...[204, 217, 240]);
      doc.setLineWidth(0.3);
      doc.line(x, panelY + 6, x, panelY + 6 + panelH);
    }
    doc.setTextColor(...GRAY); doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.text(a.src, x + 4, panelY + 13);
    doc.setFontSize(6); doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text("FM:", x + 4, panelY + 19);
    doc.setTextColor(...AMBER); doc.setFont("helvetica", "bold");
    doc.text(a.fm, x + 12, panelY + 19);
    doc.setTextColor(...GRAY); doc.setFont("helvetica", "normal");
    doc.text("EM:", x + 4, panelY + 25);
    doc.setTextColor(...TEAL); doc.setFont("helvetica", "bold");
    doc.text(a.em, x + 12, panelY + 25);
  });

  // Border around panel
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.4);
  doc.rect(10, panelY, pageW - 20, panelH + 6);

  // ══════════════════════════════════════════════════
  // FOOTERS on all pages
  // ══════════════════════════════════════════════════
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(p, totalPages);
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
