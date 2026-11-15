const CHECKLIST = [
  "North Pole, Alaska postmark batch. Hand fulfillment only. Do not send these through Lob.",
  "Ship the packed batch to: North Pole Postmark Postmaster, 4141 Postmark Dr, Anchorage, AK 99530-9998.",
  "Each child needs a stamped, addressed reply envelope inside a larger stamped envelope.",
  "This file lists approved letters only.",
];

export function approvedPostmarkLetters(queue) {
  const rows = [];
  for (const order of queue || []) {
    if (!order.postmark || order.status !== "paid") continue;
    for (const draft of order.drafts || []) {
      if (draft.status !== "approved" || draft.redactedAt) continue;
      const child = (order.children || []).find((item) => item.id === draft.childId);
      if (!child) continue;
      rows.push({ order, draft, child });
    }
  }
  return rows;
}

export function postmarkCsv(queue) {
  const rows = approvedPostmarkLetters(queue);
  const header = ["order_id", "draft_id", "child_name", "age", "town", "parent_email", "mail_name", "street", "city", "state", "zip", "letter"];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push([
      row.order.id,
      row.draft.id,
      row.child.firstName,
      row.child.age,
      row.child.town,
      row.order.parentEmail,
      row.order.address?.name,
      row.order.address?.street,
      row.order.address?.city,
      row.order.address?.state,
      row.order.address?.zip,
      row.draft.body,
    ].map(cell).join(","));
  }
  return lines.join("\n") + "\n";
}

export function postmarkPdf(queue) {
  const rows = approvedPostmarkLetters(queue);
  const blocks = [CHECKLIST.join("\n\n")];
  if (!rows.length) blocks.push("No approved postmark letters are waiting.");
  for (const row of rows) {
    blocks.push([
      `Child: ${row.child.firstName}, age ${row.child.age}, ${row.child.town}`,
      `To: ${row.order.address?.name}, ${row.order.address?.street}, ${row.order.address?.city}, ${row.order.address?.state} ${row.order.address?.zip}`,
      `Parent: ${row.order.parentEmail}`,
      "",
      row.draft.body,
    ].join("\n"));
  }
  return renderPdf(blocks);
}

function cell(value) {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

function wrap(text, width) {
  const out = [];
  for (const raw of String(text || "").split("\n")) {
    let line = "";
    for (const word of raw.split(/\s+/)) {
      if (!word) continue;
      const next = line ? `${line} ${word}` : word;
      if (next.length > width && line) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

function escapePdf(text) {
  return String(text || "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

export function renderPdf(blocks) {
  const lines = [];
  for (const block of blocks) {
    lines.push(...wrap(block, 85));
    lines.push("");
  }
  if (!lines.length) lines.push("");
  const pages = [];
  for (let i = 0; i < lines.length; i += 46) pages.push(lines.slice(i, i + 46));
  const objects = new Array(3 + pages.length * 2);
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  const kids = pages.map((_, index) => `${5 + index * 2} 0 R`).join(" ");
  objects[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${kids}] >>`;
  objects[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((pageLines, index) => {
    const content = ["BT", "/F1 11 Tf", "14 TL", "72 740 Td"];
    pageLines.forEach((line, lineIndex) => {
      const shown = escapePdf(line || " ");
      content.push(lineIndex === 0 ? `(${shown}) Tj` : `T* (${shown}) Tj`);
    });
    content.push("ET");
    const stream = content.join("\n");
    objects[3 + index * 2] = `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`;
    objects[4 + index * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${4 + index * 2} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`;
  });
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return body;
}
