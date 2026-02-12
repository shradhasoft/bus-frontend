const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const LEFT_MARGIN = 50;
const TOP_START = 790;
const BOTTOM_MARGIN = 60;
const DEFAULT_LINE_HEIGHT = 15;
const DEFAULT_FONT_SIZE = 11;
const WRAP_LIMIT = 86;

const toAscii = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, " ")
    .trim();

const escapePdfText = (value) =>
  toAscii(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const formatAmount = (amount, currency = "INR") => {
  const num = Number(amount);
  if (!Number.isFinite(num)) return "N/A";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currency} ${num.toFixed(2)}`;
  }
};

const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const wrapText = (value, maxLength = WRAP_LIMIT) => {
  const clean = toAscii(value);
  if (!clean) return [""];

  const words = clean.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }

    const next = `${current} ${word}`;
    if (next.length <= maxLength) {
      current = next;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
};

const buildInvoiceLines = (invoice) => {
  const passengers = Array.isArray(invoice.passengers) ? invoice.passengers : [];
  const seats = passengers.map((item) => item.seatNumber).filter(Boolean).join(", ");
  const supportEmail = toAscii(invoice.supportEmail || "support@bookmyseat.com");
  const lines = [];

  lines.push({ text: toAscii(invoice.companyName || "BookMySeat"), bold: true, size: 20 });
  lines.push({ text: "Tax Invoice", bold: true, size: 14, gapBefore: 4 });
  lines.push({ text: `Invoice No: ${invoice.invoiceNumber}` });
  lines.push({ text: `Issued At: ${formatDateTime(invoice.issuedAt)}` });
  lines.push({ text: `Support: ${supportEmail}` });
  lines.push({ text: "" });

  lines.push({ text: "Customer Details", bold: true, size: 12 });
  lines.push({ text: `Name: ${toAscii(invoice.customerName || "N/A")}` });
  lines.push({ text: `Email: ${toAscii(invoice.customerEmail || "N/A")}` });
  lines.push({ text: `Phone: ${toAscii(invoice.customerPhone || "N/A")}` });
  lines.push({ text: "" });

  lines.push({ text: "Booking Details", bold: true, size: 12 });
  lines.push({ text: `Booking ID: ${toAscii(invoice.bookingId || "N/A")}` });
  lines.push({ text: `Route: ${toAscii(invoice.route || "N/A")}` });
  lines.push({ text: `Travel Date: ${formatDateTime(invoice.travelDate)}` });
  lines.push({ text: `Bus: ${toAscii(invoice.busLabel || "N/A")}` });
  lines.push({ text: `Boarding: ${toAscii(invoice.boardingPoint || "N/A")}` });
  lines.push({ text: `Dropping: ${toAscii(invoice.droppingPoint || "N/A")}` });
  lines.push({ text: `Seats: ${toAscii(seats || "N/A")}` });
  lines.push({ text: `Passengers: ${passengers.length}` });
  lines.push({ text: "" });

  lines.push({ text: "Payment Details", bold: true, size: 12 });
  lines.push({ text: `Payment ID: ${toAscii(invoice.paymentId || "N/A")}` });
  if (invoice.transactionRef) {
    lines.push({ text: `Transaction Ref: ${toAscii(invoice.transactionRef)}` });
  }
  lines.push({ text: `Method: ${toAscii(invoice.paymentMethod || "N/A")}` });
  lines.push({ text: `Status: ${toAscii(invoice.paymentStatus || "N/A")}` });
  lines.push({ text: "" });

  lines.push({ text: "Amount Summary", bold: true, size: 12 });
  lines.push({
    text: `Ticket Amount: ${formatAmount(invoice.totalAmount, invoice.currency)}`,
  });
  lines.push({ text: "Tax: Included in fare" });
  lines.push({
    text: `Total Paid: ${formatAmount(invoice.totalAmount, invoice.currency)}`,
    bold: true,
    size: 12,
    gapBefore: 2,
  });
  lines.push({ text: "" });
  lines.push({
    text:
      "This is a computer-generated invoice and does not require a physical signature.",
  });

  return lines;
};

const paginateInvoiceLines = (invoiceLines) => {
  const pages = [[]];
  let pageIndex = 0;
  let currentY = TOP_START;

  const pushPage = () => {
    pages.push([]);
    pageIndex += 1;
    currentY = TOP_START;
  };

  const appendCommand = (command) => {
    pages[pageIndex].push(command);
  };

  for (const entry of invoiceLines) {
    const fontSize = Number(entry?.size) > 0 ? Number(entry.size) : DEFAULT_FONT_SIZE;
    const isBold = Boolean(entry?.bold);
    const gapBefore = Number(entry?.gapBefore) > 0 ? Number(entry.gapBefore) : 0;
    const wrapped = wrapText(entry?.text ?? "", WRAP_LIMIT);
    const step = Math.max(DEFAULT_LINE_HEIGHT, fontSize + 3);

    if (gapBefore > 0) currentY -= gapBefore;

    for (const line of wrapped) {
      if (currentY < BOTTOM_MARGIN) {
        pushPage();
      }

      const fontRef = isBold ? "F2" : "F1";
      appendCommand(
        `BT /${fontRef} ${fontSize} Tf 1 0 0 1 ${LEFT_MARGIN} ${currentY} Tm (${escapePdfText(
          line
        )}) Tj ET`
      );
      currentY -= step;
    }
  }

  return pages;
};

const getPdfDate = (value = new Date()) => {
  const date = new Date(value);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `D:${yyyy}${mm}${dd}${hh}${min}${ss}Z`;
};

const buildPdfBuffer = (pages, meta = {}) => {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "", // pages root placeholder
  ];
  const pageRefs = [];
  const contentRefs = [];

  for (const commands of pages) {
    const content = `${commands.join("\n")}\n`;
    const contentLength = Buffer.byteLength(content, "utf8");
    const pageObjRef = objects.length + 1;
    const contentObjRef = objects.length + 2;
    pageRefs.push(pageObjRef);
    contentRefs.push(contentObjRef);

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH} ${A4_HEIGHT}] /Contents ${contentObjRef} 0 R /Resources << /Font << /F1 ${
        pageObjRef + pages.length * 2
      } 0 R /F2 ${pageObjRef + pages.length * 2 + 1} 0 R >> >> >>`
    );
    objects.push(
      `<< /Length ${contentLength} >>\nstream\n${content}endstream`
    );
  }

  const fontRegularRef = objects.length + 1;
  const fontBoldRef = objects.length + 2;
  const infoRef = objects.length + 3;

  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  objects.push(
    `<< /Producer (${escapePdfText(
      meta.producer || "BookMySeat Invoice Service"
    )}) /Title (${escapePdfText(meta.title || "BookMySeat Invoice")}) /CreationDate (${getPdfDate(
      meta.createdAt || new Date()
    )}) >>`
  );

  objects[1] = `<< /Type /Pages /Kids [${pageRefs
    .map((ref) => `${ref} 0 R`)
    .join(" ")}] /Count ${pageRefs.length} >>`;

  // Fix font references in page objects now that final font refs are known.
  for (let i = 0; i < pageRefs.length; i += 1) {
    const pageRef = pageRefs[i];
    const contentRef = contentRefs[i];
    objects[pageRef - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH} ${A4_HEIGHT}] ` +
      `/Contents ${contentRef} 0 R /Resources << /Font << /F1 ${fontRegularRef} 0 R /F2 ${fontBoldRef} 0 R >> >> >>`;
  }

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let i = 0; i < objects.length; i += 1) {
    const objNum = i + 1;
    offsets[objNum] = Buffer.byteLength(pdf, "utf8");
    pdf += `${objNum} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    const pointer = String(offsets[i] || 0).padStart(10, "0");
    pdf += `${pointer} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoRef} 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
};

export const generateInvoicePdfBuffer = (invoice) => {
  const lines = buildInvoiceLines(invoice);
  const pages = paginateInvoiceLines(lines);
  return buildPdfBuffer(pages, {
    title: `Invoice ${invoice?.invoiceNumber || ""}`,
    createdAt: invoice?.issuedAt || new Date(),
  });
};

