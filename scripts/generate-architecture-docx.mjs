import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const markdownPath = join(root, "docs", "Klaveroq_MVP_and_Future_Architecture.md");
const outputPath = join(root, "docs", "Klaveroq_MVP_and_Future_Architecture.docx");
const templatePath = outputPath;
const workDir = mkdtempSync(join(tmpdir(), "klaveroq-docx-"));

const escapeXml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const runs = (value, options = {}) => {
  const parts = value.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts
    .map((part) => {
      const bold = part.startsWith("**") && part.endsWith("**");
      const code = part.startsWith("`") && part.endsWith("`");
      const text = bold ? part.slice(2, -2) : code ? part.slice(1, -1) : part;
      const properties = [
        bold || options.bold ? "<w:b/>" : "",
        code || options.code
          ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="19"/>'
          : "",
        options.color ? `<w:color w:val="${options.color}"/>` : "",
      ].join("");
      return `<w:r><w:rPr>${properties}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
    })
    .join("");
};

const paragraph = (
  value,
  {
    style,
    before = 0,
    after = 120,
    indent = 0,
    hanging = 0,
    code = false,
    bold = false,
    color,
  } = {},
) => {
  const props = [
    style ? `<w:pStyle w:val="${style}"/>` : "",
    `<w:spacing w:before="${before}" w:after="${after}" w:line="276" w:lineRule="auto"/>`,
    indent || hanging ? `<w:ind w:left="${indent}" w:hanging="${hanging}"/>` : "",
    code ? '<w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"/>' : "",
  ].join("");
  return `<w:p><w:pPr>${props}</w:pPr>${runs(value || " ", { code, bold, color })}</w:p>`;
};

const table = (rows) => {
  const columnCount = Math.max(...rows.map((row) => row.length));
  const width = Math.floor(9360 / columnCount);
  const tableRows = rows
    .map((row, rowIndex) => {
      const cells = Array.from({ length: columnCount }, (_, index) => row[index] ?? "");
      return `<w:tr>${cells.map((cell) => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${rowIndex === 0 ? '<w:shd w:val="clear" w:color="auto" w:fill="DDEBF7"/>' : ""}<w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr>${paragraph(cell, { after: 40, bold: rowIndex === 0 })}</w:tc>`).join("")}</w:tr>`;
    })
    .join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="B7C9DD"/><w:left w:val="single" w:sz="4" w:color="B7C9DD"/><w:bottom w:val="single" w:sz="4" w:color="B7C9DD"/><w:right w:val="single" w:sz="4" w:color="B7C9DD"/><w:insideH w:val="single" w:sz="4" w:color="D5DEE8"/><w:insideV w:val="single" w:sz="4" w:color="D5DEE8"/></w:tblBorders></w:tblPr>${tableRows}</w:tbl>${paragraph("", { after: 80 })}`;
};

const source = readFileSync(markdownPath, "utf8").replaceAll("\r\n", "\n");
const lines = source.split("\n");
const body = [];
let index = 0;
let inCode = false;
let codeLines = [];

while (index < lines.length) {
  const line = lines[index];
  if (line.startsWith("```")) {
    if (inCode) {
      for (const codeLine of codeLines)
        body.push(paragraph(codeLine || " ", { code: true, after: 0, indent: 160 }));
      body.push(paragraph("", { after: 100 }));
      codeLines = [];
    }
    inCode = !inCode;
    index += 1;
    continue;
  }
  if (inCode) {
    codeLines.push(line);
    index += 1;
    continue;
  }
  if (line.startsWith("|")) {
    const rows = [];
    while (index < lines.length && lines[index].startsWith("|")) {
      const cells = lines[index]
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim());
      if (!cells.every((cell) => /^:?-+:?$/.test(cell))) rows.push(cells);
      index += 1;
    }
    body.push(table(rows));
    continue;
  }
  if (/^# /.test(line))
    body.push(paragraph(line.slice(2), { style: "Title", after: 140, color: "163A5F" }));
  else if (/^## /.test(line))
    body.push(
      paragraph(line.slice(3), { style: "Heading1", before: 260, after: 100, color: "163A5F" }),
    );
  else if (/^### /.test(line))
    body.push(
      paragraph(line.slice(4), { style: "Heading2", before: 180, after: 80, color: "275D85" }),
    );
  else if (/^#### /.test(line))
    body.push(paragraph(line.slice(5), { style: "Heading3", before: 140, after: 60 }));
  else if (/^- /.test(line))
    body.push(
      paragraph(`${String.fromCharCode(0x2022)} ${line.slice(2)}`, {
        indent: 360,
        hanging: 220,
        after: 50,
      }),
    );
  else if (/^\d+\. /.test(line))
    body.push(paragraph(line, { indent: 360, hanging: 220, after: 50 }));
  else if (line === "---")
    body.push(
      '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="9FBAD0"/></w:pBdr><w:spacing w:before="80" w:after="100"/></w:pPr></w:p>',
    );
  else if (line.trim()) body.push(paragraph(line));
  index += 1;
}

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>${body.join("")}
<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="500" w:footer="500"/><w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr>
</w:body></w:document>`;

try {
  execFileSync("unzip", ["-q", templatePath, "-d", workDir]);
  writeFileSync(join(workDir, "word", "document.xml"), documentXml);

  const corePath = join(workDir, "docProps", "core.xml");
  let core = readFileSync(corePath, "utf8");
  core = core
    .replace(
      /<dc:title>.*?<\/dc:title>/s,
      "<dc:title>Klaveroq MVP Architecture, Product Rules, and Future Roadmap</dc:title>",
    )
    .replace(
      /<dc:subject>.*?<\/dc:subject>/s,
      "<dc:subject>Klaveroq implementation architecture version 1.1</dc:subject>",
    )
    .replace(/<dc:creator>.*?<\/dc:creator>/s, "<dc:creator>Klaveroq</dc:creator>")
    .replace(
      /<cp:lastModifiedBy>.*?<\/cp:lastModifiedBy>/s,
      "<cp:lastModifiedBy>Klaveroq</cp:lastModifiedBy>",
    );
  writeFileSync(corePath, core);

  const headerPath = join(workDir, "word", "header1.xml");
  const header = readFileSync(headerPath, "utf8").replace(
    /<w:t>.*? PRODUCT ARCHITECTURE<\/w:t>/s,
    "<w:t>KLAVEROQ PRODUCT ARCHITECTURE</w:t>",
  );
  writeFileSync(headerPath, header);

  const footerPath = join(workDir, "word", "footer1.xml");
  const footer = readFileSync(footerPath, "utf8").replace(
    /<w:t>.*?MVP and Future Improvement Roadmap<\/w:t>/s,
    "<w:t>Klaveroq - MVP and Future Improvement Roadmap</w:t>",
  );
  writeFileSync(footerPath, footer);

  rmSync(outputPath);
  execFileSync("zip", ["-q", "-r", outputPath, "."], { cwd: workDir });
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

console.log(`Generated ${outputPath}`);
