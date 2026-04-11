const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  TableOfContents, PageBreak, LevelFormat,
} = require("docx");
const fs = require("fs");

// ─── Palette: GO-1 Graphite Orange (PRD/Proposal) ───
const P = {
  bg: "1A2330", primary: "FFFFFF", accent: "D4875A",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "D4875A", headerText: "FFFFFF", accentLine: "D4875A", innerLine: "DDD0C8", surface: "F8F0EB" },
};
const c = (hex) => hex.replace("#", "");

// ─── Body colors ───
const bodyPalette = { primary: "1A2330", body: "2C3E50", secondary: "687078", accent: "D4875A", surface: "F8F0EB" };

// ─── No borders ───
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ─── Title layout calc ───
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 20;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt;
  let lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    lines = splitTitleLines(title, charsPerLine(minPt));
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([...'\uFF0C\u3002\u3001\uFF1B\uFF1A\uFF01\uFF1F', ...'\u7684\u4E0E\u548C\u53CA\u4E4B\u5728\u4E8E\u4E3A', ...'-_/\u3000 ']);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += last;
  }
  return lines;
}

// ─── Helper builders ───
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, bold: true, font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 32, color: c(bodyPalette.primary) })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
    children: [new TextRun({ text, bold: true, font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 28, color: c(bodyPalette.primary) })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 24, color: c(bodyPalette.primary) })],
  });
}

function body(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { line: 312, after: 80 },
    children: [new TextRun({ text, size: 24, color: c(bodyPalette.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}

function bodyNoIndent(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: 80 },
    children: [new TextRun({ text, size: 24, color: c(bodyPalette.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}

function emptyLine() {
  return new Paragraph({ spacing: { after: 60 }, children: [] });
}

// ─── Table helper ───
function makeTable(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: c(P.table.accentLine) },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: c(P.table.accentLine) },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: c(P.table.innerLine) },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: headers.map(h => new TableCell({
          width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: c(P.table.headerBg) },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 21, color: c(P.table.headerText) })] })],
        })),
      }),
      ...rows.map((row, i) => new TableRow({
        cantSplit: true,
        children: row.map(cell => new TableCell({
          width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
          shading: i % 2 === 0 ? { type: ShadingType.CLEAR, fill: c(P.table.surface) } : undefined,
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: cell, size: 21, color: c(bodyPalette.body) })] })],
        })),
      })),
    ],
  });
}

// ═══════════════════════════════════════════
// COVER — R4 (Top Color Block) + GO-1
// ═══════════════════════════════════════════
const { titlePt, titleLines } = calcTitleLayout("Love Tracks \u604B\u7231\u8F68\u8FF9\u8BB0\u5F55\u5668\u4EA7\u54C1\u9700\u6C42\u6587\u6863", 9500, 36, 24);

const coverChildren = [
  // Top color block table
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: allNoBorders,
    rows: [
      new TableRow({
        height: { value: 5800, rule: "exact" },
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: c(P.bg) },
            verticalAlign: "top",
            borders: allNoBorders,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [
              // Accent stripe
              new Paragraph({
                spacing: { before: 0, after: 0 },
                border: { top: { style: BorderStyle.SINGLE, size: 48, color: c(P.accent), space: 0 } },
                children: [],
              }),
              // Spacer
              new Paragraph({ spacing: { before: 600 }, children: [] }),
              // Title
              ...titleLines.map(line => new Paragraph({
                alignment: AlignmentType.LEFT,
                indent: { left: 1200 },
                spacing: { line: Math.ceil(titlePt * 23), lineRule: "atLeast", after: 60 },
                children: [new TextRun({ text: line, bold: true, size: titlePt * 2, color: c(P.cover.titleColor), font: { ascii: "Calibri", eastAsia: "SimHei" } })],
              })),
              // Subtitle
              new Paragraph({
                alignment: AlignmentType.LEFT,
                indent: { left: 1200 },
                spacing: { before: 200, after: 0 },
                children: [new TextRun({ text: "\u50CF\u7D20\u70B9\u9635\u98CE\u683C \u00B7 \u4EB2\u5BC6\u5173\u7CFB\u8F68\u8FF9\u8BB0\u5F55\u4E0E\u53EF\u89C6\u5316\u5E73\u53F0", size: 24, color: c(P.cover.subtitleColor), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
              }),
            ],
          }),
        ],
      }),
    ],
  }),
  // Meta info area
  emptyLine(),
  emptyLine(),
  emptyLine(),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { left: 1200 },
    spacing: { after: 80 },
    children: [
      new TextRun({ text: "\u6587\u6863\u7C7B\u578B\uFF1A", size: 22, color: c(bodyPalette.secondary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
      new TextRun({ text: "\u4EA7\u54C1\u9700\u6C42\u6587\u6863\uFF08PRD\uFF09", size: 22, color: c(bodyPalette.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { left: 1200 },
    spacing: { after: 80 },
    children: [
      new TextRun({ text: "\u7248\u672C\u53F7\uFF1A", size: 22, color: c(bodyPalette.secondary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
      new TextRun({ text: "V1.0", size: 22, color: c(bodyPalette.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { left: 1200 },
    spacing: { after: 80 },
    children: [
      new TextRun({ text: "\u521B\u5EFA\u65E5\u671F\uFF1A", size: 22, color: c(bodyPalette.secondary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
      new TextRun({ text: "2025\u5E746\u670810\u65E5", size: 22, color: c(bodyPalette.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { left: 1200 },
    spacing: { after: 80 },
    children: [
      new TextRun({ text: "\u72B6\u6001\uFF1A", size: 22, color: c(bodyPalette.secondary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
      new TextRun({ text: "\u8349\u7A3F\u8BA8\u8BBA", size: 22, color: c(bodyPalette.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
    ],
  }),
];

// ═══════════════════════════════════════════
// TOC Section
// ═══════════════════════════════════════════
const tocChildren = [
  new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 200, after: 300 },
    children: [new TextRun({ text: "\u76EE\u5F55", bold: true, size: 36, color: c(bodyPalette.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  }),
  new TableOfContents("Table of Contents", {
    hyperlink: true,
    headingStyleRange: "1-3",
  }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ═══════════════════════════════════════════
// BODY CONTENT
// ═══════════════════════════════════════════
const bodyChildren = [

  // ── 1. 项目概述 ──
  h1("1. \u9879\u76EE\u6982\u8FF0"),
  h2("1.1 \u9879\u76EE\u80CC\u666F"),
  body("Love Tracks\uFF08\u604B\u7231\u8F68\u8FF9\u8BB0\u5F55\u5668\uFF09\u662F\u4E00\u6B3E\u9762\u5411\u60C5\u4FA3\u7684\u65C5\u884C\u8F68\u8FF9\u8BB0\u5F55\u4E0E\u53EF\u89C6\u5316\u5E73\u53F0\u3002\u4EA7\u54C1\u91C7\u7528\u72EC\u7279\u7684\u50CF\u7D20\u70B9\u9635\uFF08Dot Matrix\uFF09\u89C6\u89C9\u98CE\u683C\uFF0C\u4EE5\u4E00\u4E2A\u53EF\u4EA4\u4E92\u7684 3D \u50CF\u7D20\u5730\u7403\u4E3A\u6838\u5FC3\u754C\u9762\uFF0C\u8BA9\u7528\u6237\u80FD\u591F\u76F4\u89C2\u5730\u6D4F\u89C8\u3001\u8BB0\u5F55\u548C\u56DE\u987E\u4E0E\u7231\u4EBA\u5171\u540C\u8D70\u8FC7\u7684\u6BCF\u4E00\u6B65\u3002"),
  body("\u5728\u6570\u5B57\u65F6\u4EE3\uFF0C\u6BCF\u4E00\u6B21\u51FA\u884C\u90FD\u662F\u4E00\u6BB5\u73CD\u8D35\u7684\u8BB0\u5FC6\u3002\u7136\u800C\uFF0C\u73B0\u6709\u7684\u65C5\u884C\u8BB0\u5F55\u5DE5\u5177\u5F80\u5F80\u529F\u80FD\u590D\u6742\u3001\u754C\u9762\u6742\u4E71\uFF0C\u7F3A\u4E4F\u60C5\u611F\u5316\u7684\u8868\u8FBE\u3002Love Tracks \u5E0C\u671B\u901A\u8FC7\u6781\u7B80\u7684\u89C6\u89C9\u8BBE\u8BA1\u548C\u6D41\u7545\u7684\u4EA4\u4E92\u4F53\u9A8C\uFF0C\u8BA9\u8BB0\u5F55\u8F68\u8FF9\u53D8\u6210\u4E00\u4EF6\u5145\u6EE1\u4EEA\u5F0F\u611F\u548C\u6E29\u5EA6\u7684\u4E8B\u60C5\u3002"),

  h2("1.2 \u6838\u5FC3\u7406\u5FF5"),
  makeTable(
    ["\u7406\u5FF5", "\u63CF\u8FF0"],
    [
      ["\u50CF\u7D20\u70B9\u9635\u7F8E\u5B66", "\u7528\u7C92\u5B50\u5316\u7684\u89C6\u89C9\u5143\u7D20\u6784\u5EFA\u5730\u7403\u4E0E\u5730\u56FE\uFF0C\u8425\u9020\u590D\u53E4\u4E0E\u73B0\u4EE3\u4EA4\u878D\u7684\u72EC\u7279\u7F8E\u611F"],
      ["\u6700\u5C0F\u5316\u4EA4\u4E92", "\u53BB\u9664\u590D\u6742\u529F\u80FD\uFF0C\u4EC5\u4FDD\u7559\u589E\u5220\u8F68\u8FF9\u3001\u67E5\u770B\u5730\u56FE\u6838\u5FC3\u64CD\u4F5C"],
      ["\u60C5\u611F\u5316\u8BB0\u5F55", "\u6BCF\u4E00\u6761\u8F68\u8FF9\u90FD\u662F\u4E00\u6BB5\u6545\u4E8B\uFF0C\u5728\u5730\u7403\u4E0A\u4EE5\u5149\u70B9\u7684\u5F62\u5F0F\u6C38\u4E45\u95EA\u8000"],
      ["\u5730\u7406\u771F\u5B9E\u6027", "\u6240\u6709\u5730\u70B9\u5BF9\u5E94\u771F\u5B9E\u5730\u56FE\u5750\u6807\uFF0C\u53EF\u5728\u5730\u7403\u4E0A\u7CBE\u786E\u5B9A\u4F4D"],
    ]
  ),

  h2("1.3 \u76EE\u6807\u7528\u6237"),
  makeTable(
    ["\u7528\u6237\u7C7B\u578B", "\u7279\u5F81\u63CF\u8FF0", "\u6838\u5FC3\u9700\u6C42"],
    [
      ["\u70ED\u604B\u60C5\u4FA3", "\u5E38\u5E74\u4E00\u8D77\u65C5\u884C\uFF0C\u5E0C\u671B\u8BB0\u5F55\u6BCF\u6B21\u540C\u884C\u7684\u8DB3\u8FF9", "\u76F4\u89C2\u7684\u5730\u7403\u53EF\u89C6\u5316\u3001\u5FEB\u901F\u589E\u5220\u8F68\u8FF9"],
      ["\u5F02\u5730\u604B\u60C5\u4FA3", "\u5206\u5C45\u4E24\u5730\uFF0C\u9700\u8981\u8BB0\u5F55\u6BCF\u6B21\u89C1\u9762\u65C5\u884C", "\u65F6\u95F4\u7EBF\u8BB0\u5F55\u3001\u5730\u70B9\u6807\u6CE8\u3001\u60C5\u611F\u5907\u6CE8"],
      ["\u5DF2\u5A5A\u592B\u59BB", "\u5E0C\u671B\u56DE\u987E\u5E74\u8F7B\u65F6\u7684\u65C5\u884C\u8BB0\u5FC6", "\u65F6\u95F4\u5E8F\u5217\u6D4F\u89C8\u3001\u56DE\u5FC6\u6548\u679C"],
    ]
  ),

  // ── 2. 功能需求 ──
  h1("2. \u529F\u80FD\u9700\u6C42"),
  h2("2.1 \u6838\u5FC3\u529F\u80FD"),

  h3("2.1.1 3D \u50CF\u7D20\u5730\u7403\u4E3B\u9875"),
  body("\u4E3B\u9875\u4EE5\u5168\u5C4F\u7684 3D \u50CF\u7D20\u5730\u7403\u4E3A\u4E3B\u89C6\u89C9\u5143\u7D20\u3002\u5730\u7403\u91C7\u7528\u50CF\u7D20\u70B9\u9635\uFF08Dot Matrix\uFF09\u98CE\u683C\u6E32\u67D3\uFF0C\u901A\u8FC7\u5C0F\u5706\u70B9\u7EC4\u6210\u5927\u9646\u8F6E\u5ED3\u548C\u5730\u7403\u7403\u4F53\u3002\u5730\u7403\u9ED8\u8BA4\u6301\u7EED\u7F13\u6162\u65CB\u8F6C\uFF0C\u8425\u9020\u52A8\u6001\u89C6\u89C9\u6548\u679C\u3002\u7528\u6237\u53EF\u4EE5\u901A\u8FC7\u9F20\u6807\u62D6\u62FD\u624B\u52BF\u63A7\u5236\u5730\u7403\u65CB\u8F6C\u65B9\u5411\uFF0C\u901A\u8FC7\u6EDA\u8F6E\u7F29\u653E\u63A7\u5236\u89C6\u89C9\u8DDD\u79BB\u3002"),
  body("\u50CF\u7D20\u70B9\u9635\u98CE\u683C\u7684\u5177\u4F53\u5B9E\u73B0\u8981\u6C42\uFF1A\u5730\u7403\u8868\u9762\u7531\u5747\u5300\u5206\u5E03\u7684\u5C0F\u5706\u70B9\u6784\u6210\uFF0C\u70B9\u7684\u5927\u5C0F\u7EDF\u4E00\uFF08\u7EA6 2-3px\uFF09\uFF0C\u989C\u8272\u91C7\u7528\u9ED1\u767D\u9AD8\u5BF9\u6BD4\u65B9\u6848\u3002\u5927\u9646\u533A\u57DF\u7684\u70B9\u5BC6\u5EA6\u8F83\u9AD8\uFF0C\u6D77\u6D0B\u533A\u57DF\u65E0\u70B9\u6216\u7A00\u758F\u70B9\uFF0C\u901A\u8FC7\u70B9\u7684\u5BC6\u5EA6\u5DEE\u5F02\u5448\u73B0\u5730\u7403\u7684\u7ACB\u4F53\u611F\u3002"),

  h3("2.1.2 \u8F68\u8FF9\u53EF\u89C6\u5316"),
  body("\u6240\u6709\u5DF2\u8BB0\u5F55\u7684\u65C5\u884C\u8F68\u8FF9\u4EE5\u53D1\u5149\u70B9\u7684\u5F62\u5F0F\u6807\u6CE8\u5728\u5730\u7403\u4E0A\u3002\u6BCF\u6761\u8F68\u8FF9\u7531\u591A\u4E2A\u5730\u70B9\u7EC4\u6210\uFF0C\u76F8\u90BB\u5730\u70B9\u4E4B\u95F4\u4EE5\u7EBF\u6761\u8FDE\u63A5\uFF0C\u5F62\u6210\u8F68\u8FF9\u7EBF\u3002\u8F68\u8FF9\u7EBF\u548C\u70B9\u5747\u91C7\u7528\u50CF\u7D20\u98CE\u683C\u6E32\u67D3\uFF0C\u4FDD\u6301\u6574\u4F53\u89C6\u89C9\u4E00\u81F4\u6027\u3002\u5F53\u7528\u6237\u5C06\u9F20\u6807\u60AC\u505C\u5728\u8F68\u8FF9\u4E0A\u65F6\uFF0C\u663E\u793A\u8F68\u8FF9\u57FA\u672C\u4FE1\u606F\uFF08\u540D\u79F0\u3001\u65F6\u95F4\u3001\u5730\u70B9\u6570\u91CF\uFF09\u3002"),
  body("\u5730\u7403\u7F29\u653E\u4EA4\u4E92\uFF1A\u9ED8\u8BA4\u89C6\u89C9\u4E3A\u5730\u7403\u5168\u666F\u89C6\u56FE\uFF0C\u7528\u6237\u53EF\u4EE5\u901A\u8FC7\u6EDA\u8F6E\u653E\u5927\u67E5\u770B\u7279\u5B9A\u533A\u57DF\u7684\u8F68\u8FF9\u7EC6\u8282\u3002\u7F29\u653E\u8FC7\u7A0B\u4E2D\uFF0C\u50CF\u7D20\u70B9\u4F1A\u6839\u636E\u89C6\u89C9\u7EA7\u522B\u52A8\u6001\u8C03\u6574\u5BC6\u5EA6\uFF0C\u8FD1\u8DDD\u79BB\u89C6\u56FE\u4E0B\u663E\u793A\u66F4\u591A\u5730\u7406\u7EC6\u8282\u3002"),

  h3("2.1.3 \u589E\u52A0\u8F68\u8FF9"),
  body("\u7528\u6237\u53EF\u4EE5\u901A\u8FC7\u53F3\u4E0B\u89D2\u7684\u6D6E\u52A8\u6309\u94AE\u6253\u5F00\u201C\u65B0\u5EFA\u8F68\u8FF9\u201D\u5BF9\u8BDD\u6846\u3002\u5BF9\u8BDD\u6846\u5305\u542B\u4EE5\u4E0B\u5B57\u6BB5\uFF1A"),
  makeTable(
    ["\u5B57\u6BB5", "\u7C7B\u578B", "\u5FC5\u586B", "\u8BF4\u660E"],
    [
      ["\u8F68\u8FF9\u540D\u79F0", "\u6587\u672C", "\u662F", "\u4F8B\u5982\u201C\u4E0A\u6D77\u4E4C\u9547\u4E4B\u65C5\u201D\u3001\u201C\u5DF4\u9ECE\u5DE6\u5CB8\u201D"],
      ["\u65C5\u884C\u65E5\u671F", "\u65E5\u671F\u9009\u62E9\u5668", "\u662F", "\u5F00\u59CB\u65E5\u671F\u548C\u7ED3\u675F\u65E5\u671F"],
      ["\u5730\u70B9\u5217\u8868", "\u52A8\u6001\u5217\u8868", "\u662F", "\u6BCF\u4E2A\u5730\u70B9\u5305\u542B\u5730\u540D\u548C\u5730\u56FE\u5750\u6807"],
      ["\u5907\u6CE8", "\u591A\u884C\u6587\u672C", "\u5426", "\u8FD9\u6B21\u65C5\u884C\u7684\u611F\u53D7\u6216\u7279\u522B\u7684\u8BB0\u5FC6"],
      ["\u989C\u8272\u6807\u8BB0", "\u989C\u8272\u9009\u62E9\u5668", "\u5426", "\u4E3A\u8F68\u8FF9\u9009\u62E9\u4E00\u4E2A\u6807\u8BC6\u989C\u8272"],
    ]
  ),
  body("\u5730\u70B9\u6DFB\u52A0\u652F\u6301\u5730\u56FE\u641C\u7D22\uFF1A\u7528\u6237\u5728\u5730\u70B9\u5217\u8868\u4E2D\u8F93\u5165\u5730\u540D\u5173\u952E\u8BCD\uFF0C\u7CFB\u7EDF\u81EA\u52A8\u641C\u7D22\u5E76\u5339\u914D\u771F\u5B9E\u5730\u7406\u5750\u6807\uFF08\u7ECF\u7EAC\u5EA6\uFF09\u3002\u7528\u6237\u4E5F\u53EF\u4EE5\u76F4\u63A5\u70B9\u51FB\u5730\u56FE\u9009\u62E9\u4F4D\u7F6E\uFF0C\u7CFB\u7EDF\u81EA\u52A8\u53CD\u5411\u89E3\u6790\u5730\u540D\u3002\u5730\u70B9\u6309\u7167\u65F6\u95F4\u987A\u5E8F\u6392\u5217\uFF0C\u652F\u6301\u62D6\u62FD\u8C03\u6574\u987A\u5E8F\u3002"),

  h3("2.1.4 \u5220\u9664\u8F68\u8FF9"),
  body("\u7528\u6237\u53EF\u4EE5\u5728\u8F68\u8FF9\u8BE6\u60C5\u9875\u6216\u8F68\u8FF9\u5217\u8868\u4E2D\u70B9\u51FB\u5220\u9664\u6309\u94AE\u3002\u5220\u9664\u64CD\u4F5C\u9700\u8981\u4E8C\u6B21\u786E\u8BA4\uFF0C\u907F\u514D\u8BEF\u64CD\u4F5C\u3002\u5220\u9664\u540E\u5730\u7403\u4E0A\u5BF9\u5E94\u7684\u8F68\u8FF9\u70B9\u548C\u7EBF\u6761\u540C\u6B65\u6D88\u5931\u3002"),

  h2("2.2 \u8F85\u52A9\u529F\u80FD"),
  h3("2.2.1 \u8F68\u8FF9\u5217\u8868\u4FA7\u8FB9\u680F"),
  body("\u9875\u9762\u5DE6\u4FA7\u6216\u53F3\u4FA7\u63D0\u4F9B\u4E00\u4E2A\u53EF\u6536\u8D77\u7684\u4FA7\u8FB9\u680F\uFF0C\u5C55\u793A\u6240\u6709\u8F68\u8FF9\u7684\u7F29\u7565\u5217\u8868\u3002\u6BCF\u6761\u8BB0\u5F55\u663E\u793A\u8F68\u8FF9\u540D\u79F0\u3001\u65F6\u95F4\u8303\u56F4\u548C\u5730\u70B9\u6570\u91CF\u3002\u70B9\u51FB\u67D0\u6761\u8F68\u8FF9\u53EF\u5C06\u5730\u7403\u81EA\u52A8\u5B9A\u4F4D\u5230\u8BE5\u8F68\u8FF9\u6240\u5728\u533A\u57DF\u5E76\u9AD8\u4EAE\u663E\u793A\u3002"),

  h3("2.2.2 \u8F68\u8FF9\u8BE6\u60C5\u9762\u677F"),
  body("\u70B9\u51FB\u5730\u7403\u4E0A\u7684\u8F68\u8FF9\u70B9\uFF0C\u5F39\u51FA\u8BE6\u60C5\u9762\u677F\u3002\u9762\u677F\u5185\u5BB9\u5305\u62EC\uFF1A\u8F68\u8FF9\u540D\u79F0\u3001\u65C5\u884C\u65F6\u95F4\u3001\u5907\u6CE8\u5185\u5BB9\u3001\u6240\u6709\u5730\u70B9\u5217\u8868\uFF08\u5E26\u6709\u987A\u5E8F\u7F16\u53F7\uFF09\u3001\u7F16\u8F91\u548C\u5220\u9664\u6309\u94AE\u3002\u9762\u677F\u91C7\u7528\u5361\u7247\u5F0F\u8BBE\u8BA1\uFF0C\u4FDD\u6301\u50CF\u7D20\u98CE\u683C\u7684\u89C6\u89C9\u4E00\u81F4\u6027\u3002"),

  h3("2.2.3 \u7EDF\u8BA1\u4FE1\u606F"),
  body("\u4E3B\u9875\u5E95\u90E8\u6216\u4FA7\u8FB9\u680F\u9876\u90E8\u5C55\u793A\u7B80\u6D01\u7684\u7EDF\u8BA1\u4FE1\u606F\uFF0C\u5305\u62EC\uFF1A\u603B\u8F68\u8FF9\u6570\u3001\u603B\u5730\u70B9\u6570\u3001\u8BBF\u95EE\u56FD\u5BB6/\u57CE\u5E02\u6570\u91CF\u3002\u7EDF\u8BA1\u6570\u5B57\u91C7\u7528\u50CF\u7D20\u98CE\u683C\u7684\u6570\u5B57\u663E\u793A\u65B9\u5F0F\u3002"),

  // ── 3. 视觉设计规范 ──
  h1("3. \u89C6\u89C9\u8BBE\u8BA1\u89C4\u8303"),
  h2("3.1 \u8BBE\u8BA1\u98CE\u683C"),
  body("\u6574\u4F53\u89C6\u89C9\u98CE\u683C\u5B9A\u4F4D\u4E3A\u201C\u50CF\u7D20\u70B9\u9635\u6781\u7B80\u4E3B\u4E49\u201D\u3002\u501F\u9274\u590D\u53E4\u50CF\u7D20\u6E38\u620F\u548C\u6570\u636E\u53EF\u89C6\u5316\u7684\u7F8E\u5B66\u7406\u5FF5\uFF0C\u4EE5\u7C92\u5B50\u5316\u7684\u89C6\u89C9\u5143\u7D20\u6784\u5EFA\u6574\u4E2A\u754C\u9762\u3002\u6240\u6709\u89C6\u89C9\u5143\u7D20\uFF08\u5730\u7403\u3001\u5730\u56FE\u3001\u6309\u94AE\u3001\u6587\u5B57\uFF09\u5747\u4FDD\u6301\u7EDF\u4E00\u7684\u50CF\u7D20\u611F\u3002"),

  h2("3.2 \u914D\u8272\u65B9\u6848"),
  makeTable(
    ["\u8272\u5F69\u5143\u7D20", "\u4EAE\u8272\u6A21\u5F0F", "\u6697\u8272\u6A21\u5F0F", "\u7528\u9014"],
    [
      ["\u80CC\u666F\u8272", "#FFFFFF", "#0A0A0A", "\u9875\u9762\u80CC\u666F"],
      ["\u50CF\u7D20\u70B9\u8272", "#1A1A1A", "#E0E0E0", "\u5730\u7403\u548C\u5730\u56FE\u7684\u50CF\u7D20\u70B9"],
      ["\u8F68\u8FF9\u70B9\u8272", "#E85D4A", "#FF7B6B", "\u8F68\u8FF9\u6807\u8BB0\u70B9\uFF08\u6696\u7EA2\u8272\uFF0C\u8C61\u5F81\u7231\u60C5\uFF09"],
      ["\u8F68\u8FF9\u7EBF\u8272", "#FFB74D", "#FFD180", "\u8F68\u8FF9\u8FDE\u63A5\u7EBF"],
      ["\u8F85\u52A9\u8272", "#6B7280", "#9CA3AF", "\u6B21\u8981\u4FE1\u606F\u3001\u8FB9\u6846\u3001\u5206\u5272\u7EBF"],
      ["\u5F3A\u8C03\u8272", "#E85D4A", "#FF7B6B", "\u91CD\u8981\u64CD\u4F5C\u6309\u94AE"],
    ]
  ),

  h2("3.3 \u5B57\u4F53\u89C4\u8303"),
  makeTable(
    ["\u7528\u9014", "\u5B57\u4F53", "\u5B57\u53F7", "\u5907\u6CE8"],
    [
      ["\u6807\u9898", "Geist Mono / JetBrains Mono", "18-24px", "\u7B49\u5BBD\u50CF\u7D20\u5B57\u4F53"],
      ["\u6B63\u6587", "Geist Sans / Inter", "14-16px", "\u6E05\u6670\u6613\u8BFB"],
      ["\u6570\u636E", "Geist Mono / JetBrains Mono", "12-14px", "\u7EDF\u8BA1\u6570\u5B57\u7528\u7B49\u5BBD\u5B57\u4F53"],
      ["\u6309\u94AE", "Geist Sans / Inter", "14px", "\u4E0E\u6B63\u6587\u4FDD\u6301\u4E00\u81F4"],
    ]
  ),

  h2("3.4 \u50CF\u7D20\u70B9\u9635\u89C4\u8303"),
  makeTable(
    ["\u5143\u7D20", "\u70B9\u5927\u5C0F", "\u70B9\u95F4\u8DDD", "\u8BF4\u660E"],
    [
      ["\u5730\u7403\u50CF\u7D20\u70B9", "2px", "4-6px", "\u7EC4\u6210\u5927\u9646\u8F6E\u5ED3\u7684\u57FA\u7840\u70B9\u9635"],
      ["\u8F68\u8FF9\u5730\u70B9\u6807\u8BB0", "6px", "-", "\u66F4\u5927\u7684\u70B9\uFF0C\u5E26\u53D1\u5149\u6548\u679C"],
      ["\u8F68\u8FF9\u8FDE\u63A5\u7EBF", "-", "-", "\u7531\u5C0F\u70B9\u7EC4\u6210\u7684\u865A\u7EBF"],
      ["\u6309\u94AE\u8FB9\u6846", "-", "-", "\u50CF\u7D20\u98CE\u683C\u7684\u952F\u9F7F\u72B6\u8FB9\u6846"],
    ]
  ),

  // ── 4. 技术架构 ──
  h1("4. \u6280\u672F\u67B6\u6784"),
  h2("4.1 \u6280\u672F\u6808"),
  makeTable(
    ["\u5C42\u7EA7", "\u6280\u672F\u9009\u578B", "\u8BF4\u660E"],
    [
      ["\u524D\u7AEF\u6846\u67B6", "Next.js 16 + App Router", "\u57FA\u4E8E React \u7684\u5168\u6808\u6846\u67B6"],
      ["3D \u6E32\u67D3", "Three.js + React Three Fiber", "\u50CF\u7D20\u5730\u7403\u6E32\u67D3\u548C\u4EA4\u4E92"],
      ["\u6837\u5F0F\u65B9\u6848", "Tailwind CSS 4 + shadcn/ui", "\u54CD\u5E94\u5F0F\u5E03\u5C40\u548C\u57FA\u7840\u7EC4\u4EF6"],
      ["\u72B6\u6001\u7BA1\u7406", "Zustand + TanStack Query", "\u5BA2\u6237\u7AEF\u72B6\u6001\u548C\u670D\u52A1\u5668\u72B6\u6001"],
      ["\u6570\u636E\u5E93", "Prisma ORM + SQLite", "\u8F68\u8FF9\u548C\u5730\u70B9\u6570\u636E\u6301\u4E45\u5316"],
      ["\u5730\u7406\u670D\u52A1", "Nominatim / OpenStreetMap", "\u5730\u5740\u641C\u7D22\u548C\u53CD\u5411\u5730\u7406\u7F16\u7801"],
      ["\u52A8\u753B\u5F15\u64CE", "Framer Motion", "\u9875\u9762\u8FC7\u6E21\u548C\u5FAE\u4EA4\u4E92\u52A8\u753B"],
    ]
  ),

  h2("4.2 \u7CFB\u7EDF\u67B6\u6784"),
  body("\u7CFB\u7EDF\u91C7\u7528\u524D\u540E\u7AEF\u5206\u79BB\u67B6\u6784\u3002\u524D\u7AEF\u8D1F\u8D23 3D \u5730\u7403\u6E32\u67D3\u3001\u7528\u6237\u4EA4\u4E92\u548C\u9875\u9762\u5C55\u793A\uFF1B\u540E\u7AEF\u901A\u8FC7 Next.js API Routes \u63D0\u4F9B RESTful API\uFF0C\u8D1F\u8D23\u6570\u636E\u6301\u4E45\u5316\u548C\u5730\u7406\u670D\u52A1\u8C03\u7528\u3002"),
  body("\u50CF\u7D20\u5730\u7403\u7684\u6570\u636E\u6E90\u91C7\u7528\u7B80\u5316\u7684\u4E16\u754C\u5730\u56FE GeoJSON \u6570\u636E\uFF0C\u63D0\u53D6\u5927\u9646\u8F6E\u5ED3\u7684\u7ECF\u7EAC\u5EA6\u5750\u6807\u70B9\uFF0C\u5E76\u5C06\u5176\u6620\u5C04\u5230\u7403\u4F53\u8868\u9762\u4EE5\u70B9\u9635\u5F62\u5F0F\u5448\u73B0\u3002\u8F68\u8FF9\u6570\u636E\u5B58\u50A8\u5728 SQLite \u6570\u636E\u5E93\u4E2D\uFF0C\u901A\u8FC7 API \u63A5\u53E3\u8FDB\u884C CRUD \u64CD\u4F5C\u3002"),

  h2("4.3 \u524D\u7AEF\u7EC4\u4EF6\u67B6\u6784"),
  makeTable(
    ["\u7EC4\u4EF6", "\u804C\u8D23", "\u6280\u672F"],
    [
      ["PixelGlobe", "3D \u50CF\u7D20\u5730\u7403\u4E3B\u7EC4\u4EF6\uFF0C\u5305\u542B\u65CB\u8F6C\u3001\u7F29\u653E\u3001\u8F68\u8FF9\u6E32\u67D3", "Three.js / R3F"],
      ["TrajectoryPanel", "\u8F68\u8FF9\u8BE6\u60C5\u5F39\u51FA\u9762\u677F", "shadcn/ui Dialog"],
      ["TrajectoryForm", "\u65B0\u5EFA/\u7F16\u8F91\u8F68\u8FF9\u8868\u5355", "React Hook Form + Zod"],
      ["Sidebar", "\u8F68\u8FF9\u5217\u8868\u4FA7\u8FB9\u680F", "shadcn/ui Sheet"],
      ["LocationSearch", "\u5730\u70B9\u641C\u7D22\u8F93\u5165\u7EC4\u4EF6", "shadcn/ui Command + API"],
      ["StatsBar", "\u7EDF\u8BA1\u4FE1\u606F\u680F", "shadcn/ui Badge"],
      ["PixelButton", "\u50CF\u7D20\u98CE\u683C\u6309\u94AE\u7EC4\u4EF6", "\u81EA\u5B9A\u4E49 Tailwind"],
    ]
  ),

  // ── 5. 数据模型 ──
  h1("5. \u6570\u636E\u6A21\u578B"),
  h2("5.1 \u6570\u636E\u5E93 Schema"),
  body("\u6570\u636E\u5E93\u91C7\u7528 Prisma ORM + SQLite\uFF0C\u4E3B\u8981\u5305\u542B\u4E24\u4E2A\u6570\u636E\u6A21\u578B\uFF1A\u8F68\u8FF9\uFF08Trajectory\uFF09\u548C\u5730\u70B9\uFF08Location\uFF09\u3002"),

  h3("Trajectory \u6A21\u578B"),
  makeTable(
    ["\u5B57\u6BB5", "\u7C7B\u578B", "\u7EA6\u675F", "\u8BF4\u660E"],
    [
      ["id", "String", "PK, CUID", "\u552F\u4E00\u6807\u8BC6"],
      ["name", "String", "\u5FC5\u586B", "\u8F68\u8FF9\u540D\u79F0"],
      ["startDate", "DateTime", "\u5FC5\u586B", "\u65C5\u884C\u5F00\u59CB\u65E5\u671F"],
      ["endDate", "DateTime", "\u53EF\u9009", "\u65C5\u884C\u7ED3\u675F\u65E5\u671F"],
      ["color", "String", "\u9ED8\u8BA4 #E85D4A", "\u8F68\u8FF9\u6807\u8BC6\u989C\u8272"],
      ["note", "String", "\u53EF\u9009", "\u5907\u6CE8\u5185\u5BB9"],
      ["createdAt", "DateTime", "\u81EA\u52A8", "\u521B\u5EFA\u65F6\u95F4"],
      ["updatedAt", "DateTime", "\u81EA\u52A8", "\u66F4\u65B0\u65F6\u95F4"],
    ]
  ),

  h3("Location \u6A21\u578B"),
  makeTable(
    ["\u5B57\u6BB5", "\u7C7B\u578B", "\u7EA6\u675F", "\u8BF4\u660E"],
    [
      ["id", "String", "PK, CUID", "\u552F\u4E00\u6807\u8BC6"],
      ["trajectoryId", "String", "FK", "\u5173\u8054\u8F68\u8FF9"],
      ["name", "String", "\u5FC5\u586B", "\u5730\u70B9\u540D\u79F0"],
      ["latitude", "Float", "\u5FC5\u586B", "\u7EF4\u5EA6\uFF08-90 \u5230 90\uFF09"],
      ["longitude", "Float", "\u5FC5\u586B", "\u7ECF\u5EA6\uFF08-180 \u5230 180\uFF09"],
      ["order", "Int", "\u5FC5\u586B", "\u5728\u8F68\u8FF9\u4E2D\u7684\u987A\u5E8F"],
      ["createdAt", "DateTime", "\u81EA\u52A8", "\u521B\u5EFA\u65F6\u95F4"],
    ]
  ),

  // ── 6. API 设计 ──
  h1("6. API \u8BBE\u8BA1"),
  h2("6.1 \u8F68\u8FF9\u63A5\u53E3"),
  makeTable(
    ["\u65B9\u6CD5", "\u8DEF\u5F84", "\u8BF4\u660E"],
    [
      ["GET", "/api/trajectories", "\u83B7\u53D6\u6240\u6709\u8F68\u8FF9\u5217\u8868"],
      ["POST", "/api/trajectories", "\u521B\u5EFA\u65B0\u8F68\u8FF9"],
      ["GET", "/api/trajectories/:id", "\u83B7\u53D6\u5355\u4E2A\u8F68\u8FF9\u8BE6\u60C5"],
      ["PUT", "/api/trajectories/:id", "\u66F4\u65B0\u8F68\u8FF9\u4FE1\u606F"],
      ["DELETE", "/api/trajectories/:id", "\u5220\u9664\u8F68\u8FF9\u53CA\u5176\u5173\u8054\u5730\u70B9"],
    ]
  ),

  h2("6.2 \u5730\u70B9\u63A5\u53E3"),
  makeTable(
    ["\u65B9\u6CD5", "\u8DEF\u5F84", "\u8BF4\u660E"],
    [
      ["GET", "/api/trajectories/:id/locations", "\u83B7\u53D6\u8F68\u8FF9\u4E0B\u6240\u6709\u5730\u70B9"],
      ["POST", "/api/trajectories/:id/locations", "\u5411\u8F68\u8FF9\u6DFB\u52A0\u5730\u70B9"],
      ["PUT", "/api/locations/:id", "\u66F4\u65B0\u5730\u70B9\u4FE1\u606F"],
      ["DELETE", "/api/locations/:id", "\u5220\u9664\u5730\u70B9"],
    ]
  ),

  h2("6.3 \u5730\u7406\u670D\u52A1\u63A5\u53E3"),
  makeTable(
    ["\u65B9\u6CD5", "\u8DEF\u5F84", "\u8BF4\u660E"],
    [
      ["GET", "/api/geocode/search?q=\u5173\u952E\u8BCD", "\u5730\u70B9\u641C\u7D22\uFF0C\u8FD4\u56DE\u5339\u914D\u5730\u70B9\u53CA\u5750\u6807"],
      ["GET", "/api/geocode/reverse?lat=x&lng=y", "\u53CD\u5411\u5730\u7406\u7F16\u7801\uFF0C\u5750\u6807\u8F6C\u5730\u540D"],
    ]
  ),

  // ── 7. 交互设计 ──
  h1("7. \u4EA4\u4E92\u8BBE\u8BA1"),
  h2("7.1 \u4E3B\u9875\u4EA4\u4E92"),
  makeTable(
    ["\u64CD\u4F5C", "\u89E6\u53D1\u65B9\u5F0F", "\u54CD\u5E94"],
    [
      ["\u65CB\u8F6C\u5730\u7403", "\u9F20\u6807\u62D6\u62FD / \u89E6\u6478\u6ED1\u52A8", "\u5730\u7403\u8DDF\u968F\u624B\u52BF\u65B9\u5411\u65CB\u8F6C"],
      ["\u7F29\u653E\u89C6\u56FE", "\u6EDA\u8F6E / \u53CC\u6307\u7F29\u653E", "\u8C03\u6574\u76F8\u673A\u8DDD\u79BB\uFF0C\u7F29\u653E\u89C6\u56FE"],
      ["\u67E5\u770B\u8F68\u8FF9", "\u70B9\u51FB\u5730\u7403\u4E0A\u7684\u8F68\u8FF9\u70B9", "\u5F39\u51FA\u8F68\u8FF9\u8BE6\u60C5\u9762\u677F"],
      ["\u65B0\u5EFA\u8F68\u8FF9", "\u70B9\u51FB\u53F3\u4E0B\u89D2 FAB \u6309\u94AE", "\u6253\u5F00\u65B0\u5EFA\u8F68\u8FF9\u8868\u5355\u5BF9\u8BDD\u6846"],
      ["\u5C55\u5F00\u5217\u8868", "\u70B9\u51FB\u5DE6\u4E0A\u89D2\u83DC\u5355\u6309\u94AE", "\u5C55\u5F00/\u6536\u8D77\u4FA7\u8FB9\u8F68\u8FF9\u5217\u8868"],
      ["\u5B9A\u4F4D\u8F68\u8FF9", "\u70B9\u51FB\u4FA7\u8FB9\u680F\u4E2D\u7684\u8F68\u8FF9\u9879", "\u5730\u7403\u81EA\u52A8\u65CB\u8F6C\u5230\u8BE5\u8F68\u8FF9\u533A\u57DF"],
    ]
  ),

  h2("7.2 \u52A8\u753B\u4E0E\u8FC7\u6E21"),
  body("\u5730\u7403\u65CB\u8F6C\u91C7\u7528\u60EF\u6027\u52A8\u753B\uFF08Inertia\uFF09\uFF0C\u62D6\u62FD\u91CA\u653E\u540E\u5730\u7403\u7EE7\u7EED\u7F13\u6162\u6ED1\u884C\u3002\u8F68\u8FF9\u70B9\u91C7\u7528\u8109\u51B2\u53D1\u5149\u6548\u679C\uFF08\u5468\u671F\u6027\u660E\u6697\u53D8\u5316\uFF09\uFF0C\u9700\u8981\u65F6\u53EF\u914D\u5408\u7C92\u5B50\u6563\u5C04\u52A8\u753B\u3002\u9762\u677F\u5F39\u51FA\u91C7\u7528 Framer Motion \u5B9E\u73B0\u5E73\u6ED1\u8FC7\u6E21\u52A8\u753B\u3002\u65B0\u5EFA\u8F68\u8FF9\u6210\u529F\u540E\uFF0C\u5730\u7403\u81EA\u52A8\u65CB\u8F6C\u5230\u8BE5\u8F68\u8FF9\u6240\u5728\u533A\u57DF\uFF0C\u540C\u65F6\u65B0\u8F68\u8FF9\u7684\u70B9\u4EE5\u52A8\u753B\u65B9\u5F0F\u9010\u4E2A\u4EAE\u8D77\u3002"),

  // ── 8. 非功能需求 ──
  h1("8. \u975E\u529F\u80FD\u9700\u6C42"),
  h2("8.1 \u6027\u80FD\u8981\u6C42"),
  body("\u5730\u7403\u6E32\u67D3\u5E27\u7387\u4E0D\u4F4E\u4E8E 60fps\uFF0C\u652F\u6301\u540C\u65F6\u5448\u73B0 500 \u4E2A\u4EE5\u4E0A\u7684\u50CF\u7D20\u70B9\u3002API \u54CD\u5E94\u65F6\u95F4\u4E0D\u8D85\u8FC7 500ms\uFF0C\u5730\u7406\u641C\u7D22\u54CD\u5E94\u4E0D\u8D85\u8FC7 2 \u79D2\u3002\u9875\u9762\u9996\u6B21\u52A0\u8F7D\u65F6\u95F4\u4E0D\u8D85\u8FC7 3 \u79D2\uFF08\u5305\u542B 3D \u5730\u7403\u6E32\u67D3\uFF09\u3002"),

  h2("8.2 \u517C\u5BB9\u6027"),
  body("\u652F\u6301 Chrome\u3001Firefox\u3001Safari\u3001Edge \u6700\u65B0\u4E24\u4E2A\u7248\u672C\u3002\u79FB\u52A8\u7AEF\u652F\u6301 iOS Safari \u548C Android Chrome\uFF0C\u63D0\u4F9B\u89E6\u6478\u624B\u52BF\u4EA4\u4E92\uFF08\u62D6\u62FD\u65CB\u8F6C\u3001\u53CC\u6307\u7F29\u653E\uFF09\u3002\u54CD\u5E94\u5F0F\u5E03\u5C40\u9002\u914D\u624B\u673A\u3001\u5E73\u677F\u548C\u684C\u9762\u7AEF\u3002"),

  h2("8.3 \u53EF\u8BBF\u95EE\u6027"),
  body("\u9075\u5FAA WCAG 2.1 AA \u6807\u51C6\uFF0C\u786E\u4FDD\u8DB3\u591F\u7684\u989C\u8272\u5BF9\u6BD4\u5EA6\u3002\u6240\u6709\u4EA4\u4E92\u5143\u7D20\u652F\u6301\u952E\u76D8\u5BFC\u822A\u3002\u50CF\u7D20\u5730\u7403\u63D0\u4F9B\u65E0\u969C\u788D\u7684\u7EAF\u6587\u672C\u66FF\u4EE3\u65B9\u6848\u3002"),

  // ── 9. 项目里程碑 ──
  h1("9. \u9879\u76EE\u91CC\u7A0B\u7891"),
  makeTable(
    ["\u9636\u6BB5", "\u5185\u5BB9", "\u4EA4\u4ED8\u7269"],
    [
      ["MVP\uFF08\u7B2C\u4E00\u9636\u6BB5\uFF09", "3D\u50CF\u7D20\u5730\u7403\u3001\u57FA\u7840\u8F68\u8FF9\u589E\u5220\u3001\u5730\u56FE\u5750\u6807\u5B9A\u4F4D", "\u53EF\u8FD0\u884C\u7684\u57FA\u7840\u7248\u672C"],
      ["\u7B2C\u4E8C\u9636\u6BB5", "\u5730\u70B9\u641C\u7D22\u3001\u8F68\u8FF9\u7F16\u8F91\u3001\u52A8\u753B\u4F18\u5316", "\u5B8C\u6574\u529F\u80FD\u7248\u672C"],
      ["\u7B2C\u4E09\u9636\u6BB5", "\u7EDF\u8BA1\u4FE1\u606F\u3001\u54CD\u5E94\u5F0F\u4F18\u5316\u3001\u6027\u80FD\u8C03\u4F18", "\u6B63\u5F0F\u53D1\u5E03\u7248\u672C"],
    ]
  ),
  emptyLine(),
  body("\u672C\u6587\u6863\u4E3A Love Tracks \u4EA7\u54C1\u7684\u521D\u59CB\u9700\u6C42\u5B9A\u4E49\uFF0C\u540E\u7EED\u5C06\u6839\u636E\u5B9E\u9645\u5F00\u53D1\u8FDB\u5C55\u548C\u7528\u6237\u53CD\u9988\u8FDB\u884C\u8FED\u4EE3\u66F4\u65B0\u3002"),
];

// ═══════════════════════════════════════════
// ASSEMBLE DOCUMENT
// ═══════════════════════════════════════════
const doc = new Document({
  styles: {
    default: {
      document: {
        run: {
          font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
          size: 24, color: c(bodyPalette.body),
        },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 32, bold: true, color: c(bodyPalette.primary) },
        paragraph: { spacing: { before: 400, after: 200, line: 312 } },
      },
      heading2: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 28, bold: true, color: c(bodyPalette.primary) },
        paragraph: { spacing: { before: 300, after: 150, line: 312 } },
      },
      heading3: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 24, bold: true, color: c(bodyPalette.primary) },
        paragraph: { spacing: { before: 200, after: 100, line: 312 } },
      },
    },
  },
  numbering: {
    config: [
      {
        reference: "list-features",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  sections: [
    // Section 1: Cover
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: 0 },
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        },
      },
      children: coverChildren,
    },
    // Section 2: TOC (Roman numerals)
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: 0 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(bodyPalette.secondary) })],
          })],
        }),
      },
      children: tocChildren,
    },
    // Section 3: Body (Arabic, reset to 1)
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: 0 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Love Tracks PRD V1.0", size: 18, color: c(bodyPalette.secondary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(bodyPalette.secondary) })],
          })],
        }),
      },
      children: bodyChildren,
    },
  ],
});

// ─── Generate ───
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/home/z/my-project/download/Love_Tracks_PRD.docx", buf);
  console.log("PRD generated successfully: /home/z/my-project/download/Love_Tracks_PRD.docx");
});
