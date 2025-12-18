export function parseCSV(text) {
  const rows = [];
  let cur = "", row = [], inq = false;
  
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    
    if (c === '"') {
      if (inq && n === '"') {
        cur += '"';
        i++;
        continue;
      }
      inq = !inq;
    } else if (c === "," && !inq) {
      row.push(cur);
      cur = "";
    } else if ((c === "\n" || (c === "\r" && n === "\n")) && !inq) {
      if (c === "\r") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else {
      cur += c;
    }
  }
  
  if (cur !== "" || row.length) {
    row.push(cur);
    rows.push(row);
  }

  return rows.map((r) => r.map((c) => c.trim().replace(/^"|"$/g, "")));
}