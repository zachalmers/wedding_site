const SETTINGS = {
  RSVP_PUBLIC_URL: "https://umangiandzach.love/5t6y7u8k/rsvp.html",
  FROM_EMAIL: "info@umangiandzach.love",
  REPLY_TO: "info@umangiandzach.love",
  LODGING_FORM_URL: "",
};

const SHEETS = {
  households: {
    name: "Households",
    headers: ["householdId", "email", "householdLabel", "maxPlusOnes", "editToken", "lastSubmitted"],
  },
  guests: {
    name: "Guests",
    headers: ["householdId", "firstName", "lastName", "email", "isPlusOne", "attending", "events", "dietary", "updatedAt"],
  },
  submissions: {
    name: "Submissions",
    headers: ["submittedAt", "householdId", "email", "notes", "payload"],
  },
};

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    const action = (payload.action || "").toLowerCase();
    if (action === "lookup") {
      return json_(lookup_(payload));
    }
    if (action === "submit") {
      return json_(submit_(payload));
    }
    return jsonError_("Unknown action.");
  } catch (err) {
    return jsonError_(err.message || "Server error.");
  }
}

function lookup_(payload) {
  const email = normalizeEmail_(payload.email);
  const token = String(payload.token || "").trim();
  if (!email && !token) throw new Error("Email is required.");

  const householdSheet = getOrCreateSheet_(SHEETS.households);
  const householdMatch = token
    ? findHouseholdByToken_(householdSheet, token)
    : findHouseholdByEmail_(householdSheet, email);

  if (!householdMatch) throw new Error("We couldn't find an invitation for that email.");

  const guestsSheet = getOrCreateSheet_(SHEETS.guests);
  const guests = getGuestsByHousehold_(guestsSheet, householdMatch.householdId);

  return {
    ok: true,
    email: householdMatch.email,
    token: householdMatch.editToken || token || "",
    household: { householdId: householdMatch.householdId },
    householdLabel: householdMatch.householdLabel,
    maxPlusOnes: householdMatch.maxPlusOnes,
    guests,
  };
}

function submit_(payload) {
  const householdId = String(payload.householdId || "").trim();
  const email = normalizeEmail_(payload.email);
  const token = String(payload.token || "").trim();
  const guests = Array.isArray(payload.guests) ? payload.guests : [];
  if (!householdId) throw new Error("Missing household id.");
  if (!guests.length) throw new Error("Please add at least one guest.");

  const householdSheet = getOrCreateSheet_(SHEETS.households);
  const householdMatch = findHouseholdById_(householdSheet, householdId);
  if (!householdMatch) throw new Error("Household not found.");

  if (token && householdMatch.editToken && token !== householdMatch.editToken) {
    throw new Error("Invalid edit link. Please search again by email.");
  }
  if (!token && email && householdMatch.email && email !== householdMatch.email) {
    throw new Error("Email does not match this invitation.");
  }

  const maxPlusOnes = Number(householdMatch.maxPlusOnes || 0);
  const plusOnes = guests.filter((guest) => guest.isPlusOne).length;
  if (plusOnes > maxPlusOnes) throw new Error("Too many plus-ones for this invitation.");

  guests.forEach((guest) => {
    const firstName = String(guest.firstName || "").trim();
    const lastName = String(guest.lastName || "").trim();
    const attending = String(guest.attending || "").trim();
    const dietary = String(guest.dietary || "").trim();
    const events = Array.isArray(guest.events) ? guest.events : [];
    if (!firstName || !lastName) throw new Error("Each guest needs a first and last name.");
    if (!attending) throw new Error("Please choose attending for each guest.");
    if (attending === "yes" && events.length === 0) {
      throw new Error("Please select at least one event for each attending guest.");
    }
    if (attending === "yes" && !dietary) {
      throw new Error("Dietary needs are required for everyone attending.");
    }
  });

  const guestsSheet = getOrCreateSheet_(SHEETS.guests);
  removeGuestRows_(guestsSheet, householdId);
  appendGuests_(guestsSheet, householdId, guests, householdMatch.email || email);

  const editToken = householdMatch.editToken || Utilities.getUuid();
  updateHouseholdMeta_(householdSheet, householdMatch.rowIndex, editToken);

  const notes = String(payload.notes || "").trim();
  logSubmission_(householdId, email || householdMatch.email, notes, guests);
  sendConfirmationEmail_(householdMatch.email || email, editToken, guests, notes);

  return {
    ok: true,
    message: "Thanks! Your RSVP has been recorded.",
    token: editToken,
  };
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  return JSON.parse(e.postData.contents);
}

function normalizeEmail_(email) {
  return String(email || "").trim().toLowerCase();
}

function getOrCreateSheet_(config) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(config.name);
  if (!sheet) {
    sheet = ss.insertSheet(config.name);
    sheet.getRange(1, 1, 1, config.headers.length).setValues([config.headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function headerMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach((header, index) => {
    map[String(header).trim()] = index;
  });
  return map;
}

function findHouseholdByEmail_(sheet, email) {
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const map = toMap_(headers);
  for (let i = 0; i < data.length; i++) {
    const rowEmail = normalizeEmail_(data[i][map.email]);
    if (rowEmail && rowEmail === email) {
      return formatHousehold_(data[i], map, i + 2);
    }
  }
  return null;
}

function findHouseholdByToken_(sheet, token) {
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const map = toMap_(headers);
  for (let i = 0; i < data.length; i++) {
    const rowToken = String(data[i][map.editToken] || "").trim();
    if (rowToken && rowToken === token) {
      return formatHousehold_(data[i], map, i + 2);
    }
  }
  return null;
}

function findHouseholdById_(sheet, householdId) {
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const map = toMap_(headers);
  for (let i = 0; i < data.length; i++) {
    const rowId = String(data[i][map.householdId] || "").trim();
    if (rowId && rowId === householdId) {
      return formatHousehold_(data[i], map, i + 2);
    }
  }
  return null;
}

function formatHousehold_(row, map, rowIndex) {
  return {
    rowIndex,
    householdId: String(row[map.householdId] || "").trim(),
    email: normalizeEmail_(row[map.email]),
    householdLabel: String(row[map.householdLabel] || "").trim(),
    maxPlusOnes: Number(row[map.maxPlusOnes] || 0),
    editToken: String(row[map.editToken] || "").trim(),
  };
}

function toMap_(headers) {
  const map = {};
  headers.forEach((header, index) => {
    map[String(header).trim()] = index;
  });
  return map;
}

function getGuestsByHousehold_(sheet, householdId) {
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const map = toMap_(headers);
  return data
    .filter((row) => String(row[map.householdId] || "").trim() === householdId)
    .map((row) => ({
      firstName: String(row[map.firstName] || "").trim(),
      lastName: String(row[map.lastName] || "").trim(),
      email: String(row[map.email] || "").trim(),
      attending: String(row[map.attending] || "").trim(),
      events: String(row[map.events] || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      dietary: String(row[map.dietary] || "").trim(),
      isPlusOne: String(row[map.isPlusOne] || "").toLowerCase() === "true",
    }));
}

function removeGuestRows_(sheet, householdId) {
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const map = toMap_(headers);
  for (let i = data.length - 1; i >= 0; i--) {
    if (String(data[i][map.householdId] || "").trim() === householdId) {
      sheet.deleteRow(i + 2);
    }
  }
}

function appendGuests_(sheet, householdId, guests, householdEmail) {
  const now = new Date();
  const rows = guests.map((guest) => [
    householdId,
    String(guest.firstName || "").trim(),
    String(guest.lastName || "").trim(),
    String(guest.email || householdEmail || "").trim(),
    guest.isPlusOne ? "TRUE" : "FALSE",
    String(guest.attending || "").trim(),
    Array.isArray(guest.events) ? guest.events.join(", ") : "",
    String(guest.dietary || "").trim(),
    now,
  ]);
  if (!rows.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function updateHouseholdMeta_(sheet, rowIndex, editToken) {
  const map = headerMap_(sheet);
  const now = new Date();
  if (map.editToken != null) {
    sheet.getRange(rowIndex, map.editToken + 1).setValue(editToken);
  }
  if (map.lastSubmitted != null) {
    sheet.getRange(rowIndex, map.lastSubmitted + 1).setValue(now);
  }
}

function logSubmission_(householdId, email, notes, guests) {
  const sheet = getOrCreateSheet_(SHEETS.submissions);
  sheet.appendRow([new Date(), householdId, email, notes, JSON.stringify(guests)]);
}

function sendConfirmationEmail_(recipient, token, guests, notes) {
  if (!recipient) return;
  const editLink = SETTINGS.RSVP_PUBLIC_URL
    ? `${SETTINGS.RSVP_PUBLIC_URL}?token=${encodeURIComponent(token)}`
    : "";
  const summaryLines = guests.map((guest) => {
    const status = guest.attending === "yes" ? "Attending" : "Not attending";
    const dietary = guest.attending === "yes" ? ` • Dietary: ${guest.dietary || "None"}` : "";
    const events = guest.attending === "yes" && Array.isArray(guest.events) && guest.events.length
      ? ` • Events: ${formatEvents_(guest.events)}`
      : "";
    return `- ${guest.firstName} ${guest.lastName}: ${status}${events}${dietary}`;
  });

  const textBody = [
    "Thanks for your RSVP! We can't wait to celebrate with you in Oaxaca!",
    "",
    "Your details:",
    ...summaryLines,
    "",
    editLink ? `Edit your RSVP: ${editLink}` : "",
    notes ? `Notes for the couple: ${notes}` : "",
    "Please reply to this email with flight and hotel details once you've made arrangements.",
  ].filter(Boolean).join("\n");

  const htmlSummary = summaryLines.map((line) => `<li>${escapeHtml_(line.replace(/^- /, ""))}</li>`).join("");
  const notesHtml = notes ? `<p><strong>Notes for the couple:</strong> ${escapeHtml_(notes)}</p>` : "";
  const htmlBody = `
    <p>Thanks for your RSVP!</p>
    <p><strong>Your details:</strong></p>
    <ul>${htmlSummary}</ul>
    ${notesHtml}
    ${editLink ? `<p><a href="${editLink}">Edit your RSVP</a></p>` : ""}
    <p>Please reply to this email with flight and hotel details once you've made arrangements.</p>
  `;

  const options = {
    htmlBody,
    name: "Umangi & Zach",
    replyTo: SETTINGS.REPLY_TO || SETTINGS.FROM_EMAIL || "",
  };

  try {
    if (SETTINGS.FROM_EMAIL) {
      options.from = SETTINGS.FROM_EMAIL;
    }
    GmailApp.sendEmail(recipient, "RSVP received — Umangi & Zach", textBody, options);
  } catch (err) {
    const fallback = {
      htmlBody,
      name: "Umangi & Zach",
      replyTo: SETTINGS.REPLY_TO || "",
    };
    GmailApp.sendEmail(recipient, "RSVP received — Umangi & Zach", textBody, fallback);
  }
}

function formatEvents_(events) {
  const labels = {
    haldi: "Haldi",
    sangeet: "Sangeet",
    wedding: "Ceremony + Reception",
  };
  return events.map((event) => labels[event] || event).join(", ");
}

function escapeHtml_(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function jsonError_(message) {
  return json_({ ok: false, error: message });
}
