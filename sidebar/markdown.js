// Minimal Markdown renderer, safe by construction: every line of user
// input is HTML-escaped BEFORE any transformation, so the only tags in the
// output are the ones this file generates. This is the single place where
// user content may flow into innerHTML — keep it that way.
//
// Supported: # ## ### headings, **bold**, *italic*, ~~strike~~, `code`,
// ``` fenced blocks, - / * bullets, - [ ] / - [x] task items (emitted with
// data-line so the UI can toggle them back into the source), 1. numbered
// lists, > quotes, --- rules, [text](https://link), [[wiki links]] (emitted
// with data-title for the UI to resolve), and | pipe | tables |.

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Runs on already-escaped text.
function inline(text) {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(
      /\[\[([^\][]+)\]\]/g,
      '<a class="wikilink" data-title="$1">$1</a>'
    )
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>");
}

// A table separator looks like "| --- | :--: |" (escaped text keeps the
// pipes and dashes intact). Requires at least one dash and only the
// pipe/dash/colon/space vocabulary.
function isTableSeparator(line) {
  const trimmed = line.trim();
  return (
    trimmed.includes("|") &&
    trimmed.includes("-") &&
    /^\|?[\s:|-]+\|?$/.test(trimmed)
  );
}

function isTableRow(line) {
  return line.includes("|") && line.trim() !== "";
}

// Split "| a | b |" into ["a", "b"], tolerating optional outer pipes.
function tableCells(line) {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((cell) => cell.trim());
}

function renderTable(headerLine, bodyLines) {
  const head = tableCells(headerLine);
  const rows = bodyLines.map(tableCells);
  const th = head.map((cell) => `<th>${inline(cell)}</th>`).join("");
  const body = rows
    .map((cells) => {
      const tds = head
        .map((_, i) => `<td>${inline(cells[i] || "")}</td>`)
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");
  return `<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
}

export function renderMarkdown(source) {
  const lines = source.split("\n").map(escapeHtml);
  const out = [];
  let list = null; // "ul" | "ol" | "quote" | "code" | "p"

  const close = () => {
    if (list === "ul") out.push("</ul>");
    else if (list === "ol") out.push("</ol>");
    else if (list === "quote") out.push("</blockquote>");
    else if (list === "code") out.push("</code></pre>");
    else if (list === "p") out.push("</p>");
    list = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (list === "code") close();
      else {
        close();
        out.push("<pre><code>");
        list = "code";
      }
      continue;
    }
    if (list === "code") {
      out.push(line);
      continue;
    }

    // Table: a row followed by a separator row starts one.
    if (
      list !== "code" &&
      isTableRow(line) &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      close();
      const bodyLines = [];
      let j = i + 2;
      while (j < lines.length && isTableRow(lines[j]) && !isTableSeparator(lines[j])) {
        bodyLines.push(lines[j]);
        j++;
      }
      out.push(renderTable(line, bodyLines));
      i = j - 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    const quoted = line.match(/^&gt;\s?(.*)$/);

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      close();
      out.push("<hr>");
    } else if (heading) {
      close();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    } else if (bullet) {
      if (list !== "ul") {
        close();
        out.push("<ul>");
        list = "ul";
      }
      const task = bullet[1].match(/^\[([ xX])\]\s+(.*)$/);
      if (task) {
        const checked = task[1] !== " " ? " checked" : "";
        out.push(
          `<li class="task"><label><input type="checkbox" class="task-box" data-line="${i}"${checked}> <span>${inline(task[2])}</span></label></li>`
        );
      } else {
        out.push(`<li>${inline(bullet[1])}</li>`);
      }
    } else if (numbered) {
      if (list !== "ol") {
        close();
        out.push("<ol>");
        list = "ol";
      }
      out.push(`<li>${inline(numbered[1])}</li>`);
    } else if (quoted) {
      if (list !== "quote") {
        close();
        out.push("<blockquote>");
        list = "quote";
      }
      out.push(`${inline(quoted[1])}<br>`);
    } else if (line.trim() === "") {
      close();
    } else {
      if (list !== "p") {
        close();
        out.push("<p>");
        list = "p";
      } else {
        out.push("<br>");
      }
      out.push(inline(line));
    }
  }
  close();
  return out.join("\n");
}
