const SETTINGS = {
  RSVP_PUBLIC_URL: "https://umangiandzach.love/5t6y7u8k/rsvp.html",
  WEDDING_SITE_URL: "https://umangiandzach.love/5t6y7u8k/",
  SITE_PASSWORD: "curryandmole",
  FROM_EMAIL: "info@umangiandzach.love",
  REPLY_TO: "info@umangiandzach.love",
  INVITE_SUBJECT: "You're invited to our wedding in Oaxaca - Umangi & Zach",
  REMINDER_SUBJECT: "Friendly RSVP reminder - Umangi & Zach",
  REMINDER_WAIT_DAYS: 30,
  LODGING_FORM_URL: "",
};

const SHEETS = {
  households: {
    name: "Households",
    headers: [
      "householdId",
      "email",
      "householdLabel",
      "maxPlusOnes",
      "notes",
      "editToken",
      "lastSubmitted",
      "sendInvite",
      "inviteSentAt",
      "inviteStatus",
      "inviteError",
      "lastReminderSentAt",
      "reminderStatus",
      "reminderError",
    ],
  },
  guests: {
    name: "Guests",
    headers: ["householdId", "firstName", "lastName", "email", "whatsappPhone", "isPlusOne", "attending", "events", "dietary", "updatedAt"],
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
    notes: householdMatch.notes || "",
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

  const notes = String(payload.notes || "").trim();
  const editToken = householdMatch.editToken || Utilities.getUuid();
  updateHouseholdMeta_(householdSheet, householdMatch.rowIndex, editToken, notes);
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
  } else if (config.headers && config.headers.length) {
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map((header) => String(header || "").trim());
    const missingHeaders = config.headers.filter((header) => !existingHeaders.includes(header));
    if (missingHeaders.length) {
      sheet.getRange(1, existingHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
    }
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
    notes: String(row[map.notes] || "").trim(),
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
      email: map.email != null ? String(row[map.email] || "").trim() : "",
      whatsappPhone: map.whatsappPhone != null ? String(row[map.whatsappPhone] || "").trim() : "",
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
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map((header) => String(header || "").trim());
  const rows = guests.map((guest) => {
    const row = headers.map(() => "");
    const assign = (header, value) => {
      const index = headers.indexOf(header);
      if (index !== -1) row[index] = value;
    };
    assign("householdId", householdId);
    assign("firstName", String(guest.firstName || "").trim());
    assign("lastName", String(guest.lastName || "").trim());
    assign("email", String(guest.email || "").trim());
    assign("whatsappPhone", String(guest.whatsappPhone || "").trim());
    assign("isPlusOne", guest.isPlusOne ? "TRUE" : "FALSE");
    assign("attending", String(guest.attending || "").trim());
    assign("events", Array.isArray(guest.events) ? guest.events.join(", ") : "");
    assign("dietary", String(guest.dietary || "").trim());
    assign("updatedAt", now);
    return row;
  });
  if (!rows.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function updateHouseholdMeta_(sheet, rowIndex, editToken, notes) {
  const map = headerMap_(sheet);
  const now = new Date();
  if (map.notes != null) {
    sheet.getRange(rowIndex, map.notes + 1).setValue(notes || "");
  }
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

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Invites")
    .addItem("Preview queued invites (dry run)", "previewQueuedInvites")
    .addItem("Send queued invites", "sendQueuedInvites")
    .addSeparator()
    .addItem("Preview RSVP reminders (dry run)", "previewRsvpReminders")
    .addItem("Send RSVP reminders", "sendRsvpReminders")
    .addToUi();
}

function previewQueuedInvites() {
  const summary = processInviteQueue_({ dryRun: true, limit: 500 });
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    "Invite preview",
    [
      `Queued rows scanned: ${summary.scanned}`,
      `Eligible invites: ${summary.eligible}`,
      `Would send: ${summary.wouldSend}`,
      `Skipped: ${summary.skipped}`,
      `Errors: ${summary.errors}`,
    ].join("\n"),
    ui.ButtonSet.OK
  );
}

function sendQueuedInvites() {
  const summary = processInviteQueue_({ dryRun: false, limit: 500 });
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    "Invite send complete",
    [
      `Queued rows scanned: ${summary.scanned}`,
      `Eligible invites: ${summary.eligible}`,
      `Sent: ${summary.sent}`,
      `Skipped: ${summary.skipped}`,
      `Errors: ${summary.errors}`,
    ].join("\n"),
    ui.ButtonSet.OK
  );
}

function previewRsvpReminders() {
  const summary = processReminderQueue_({ dryRun: true, limit: 500 });
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    "RSVP reminder preview",
    [
      `Rows scanned: ${summary.scanned}`,
      `Eligible reminders: ${summary.eligible}`,
      `Would send: ${summary.wouldSend}`,
      `Skipped: ${summary.skipped}`,
      `Errors: ${summary.errors}`,
    ].join("\n"),
    ui.ButtonSet.OK
  );
}

function sendRsvpReminders() {
  const summary = processReminderQueue_({ dryRun: false, limit: 500 });
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    "RSVP reminders complete",
    [
      `Rows scanned: ${summary.scanned}`,
      `Eligible reminders: ${summary.eligible}`,
      `Sent: ${summary.sent}`,
      `Skipped: ${summary.skipped}`,
      `Errors: ${summary.errors}`,
    ].join("\n"),
    ui.ButtonSet.OK
  );
}

function processInviteQueue_(options) {
  const opts = options || {};
  const dryRun = opts.dryRun !== false;
  const limit = Number(opts.limit || 500);

  const sheet = getOrCreateSheet_(SHEETS.households);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return { scanned: 0, eligible: 0, wouldSend: 0, sent: 0, skipped: 0, errors: 0 };
  }

  const headers = data[0];
  const map = toMap_(headers);
  const summary = { scanned: 0, eligible: 0, wouldSend: 0, sent: 0, skipped: 0, errors: 0 };

  for (let i = 1; i < data.length; i++) {
    if (summary.scanned >= limit) break;
    summary.scanned += 1;
    const row = data[i];
    const rowIndex = i + 1;

    const queued = isInviteQueued_(rowValue_(row, map, "sendInvite"));
    if (!queued) {
      summary.skipped += 1;
      continue;
    }

    const alreadySent = rowValue_(row, map, "inviteSentAt");
    if (alreadySent) {
      summary.skipped += 1;
      continue;
    }

    const recipient = normalizeEmail_(rowValue_(row, map, "email"));
    const householdLabel = String(rowValue_(row, map, "householdLabel") || "").trim() || "friend";
    if (!recipient) {
      summary.errors += 1;
      writeInviteAudit_(sheet, rowIndex, map, {
        status: "error",
        error: "Missing recipient email",
      });
      continue;
    }

    summary.eligible += 1;
    if (dryRun) {
      summary.wouldSend += 1;
      writeInviteAudit_(sheet, rowIndex, map, {
        status: "queued-preview",
        error: "",
      });
      continue;
    }

    try {
      sendInviteEmail_(recipient, householdLabel);
      summary.sent += 1;
      writeInviteAudit_(sheet, rowIndex, map, {
        status: "sent",
        error: "",
        sentAt: new Date(),
      });
    } catch (err) {
      summary.errors += 1;
      writeInviteAudit_(sheet, rowIndex, map, {
        status: "error",
        error: String(err && err.message ? err.message : err).slice(0, 500),
      });
    }
  }

  return summary;
}

function processReminderQueue_(options) {
  const opts = options || {};
  const dryRun = opts.dryRun !== false;
  const limit = Number(opts.limit || 500);
  const waitDays = Number(SETTINGS.REMINDER_WAIT_DAYS || 30);
  const now = new Date();

  const sheet = getOrCreateSheet_(SHEETS.households);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return { scanned: 0, eligible: 0, wouldSend: 0, sent: 0, skipped: 0, errors: 0 };
  }

  const headers = data[0];
  const map = toMap_(headers);
  const summary = { scanned: 0, eligible: 0, wouldSend: 0, sent: 0, skipped: 0, errors: 0 };

  for (let i = 1; i < data.length; i++) {
    if (summary.scanned >= limit) break;
    summary.scanned += 1;

    const row = data[i];
    const rowIndex = i + 1;
    const submittedAt = parseDateValue_(rowValue_(row, map, "lastSubmitted"));
    if (submittedAt) {
      summary.skipped += 1;
      continue;
    }

    const inviteSentAt = parseDateValue_(rowValue_(row, map, "inviteSentAt"));
    const lastReminderSentAt = parseDateValue_(rowValue_(row, map, "lastReminderSentAt"));
    const lastContactAt = latestDate_(inviteSentAt, lastReminderSentAt);
    if (!lastContactAt) {
      summary.skipped += 1;
      continue;
    }

    const daysSinceContact = Math.floor((now.getTime() - lastContactAt.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceContact < waitDays) {
      summary.skipped += 1;
      continue;
    }

    const recipient = normalizeEmail_(rowValue_(row, map, "email"));
    const householdLabel = String(rowValue_(row, map, "householdLabel") || "").trim() || "friend";
    if (!recipient) {
      summary.errors += 1;
      writeReminderAudit_(sheet, rowIndex, map, {
        status: "error",
        error: "Missing recipient email",
      });
      continue;
    }

    summary.eligible += 1;
    if (dryRun) {
      summary.wouldSend += 1;
      writeReminderAudit_(sheet, rowIndex, map, {
        status: "queued-preview",
        error: "",
      });
      continue;
    }

    try {
      sendReminderEmail_(recipient, householdLabel);
      summary.sent += 1;
      writeReminderAudit_(sheet, rowIndex, map, {
        status: "sent",
        error: "",
        sentAt: new Date(),
      });
    } catch (err) {
      summary.errors += 1;
      writeReminderAudit_(sheet, rowIndex, map, {
        status: "error",
        error: String(err && err.message ? err.message : err).slice(0, 500),
      });
    }
  }

  return summary;
}

function sendInviteEmail_(recipient, householdLabel) {
  const invite = buildInviteEmail_(householdLabel);
  const options = {
    htmlBody: invite.htmlBody,
    name: "Umangi & Zach",
    replyTo: SETTINGS.REPLY_TO || SETTINGS.FROM_EMAIL || "",
  };

  try {
    if (SETTINGS.FROM_EMAIL) options.from = SETTINGS.FROM_EMAIL;
    GmailApp.sendEmail(recipient, SETTINGS.INVITE_SUBJECT, invite.textBody, options);
  } catch (err) {
    const fallback = {
      htmlBody: invite.htmlBody,
      name: "Umangi & Zach",
      replyTo: SETTINGS.REPLY_TO || "",
    };
    GmailApp.sendEmail(recipient, SETTINGS.INVITE_SUBJECT, invite.textBody, fallback);
  }
}

function sendReminderEmail_(recipient, householdLabel) {
  const reminder = buildReminderEmail_(householdLabel);
  const options = {
    htmlBody: reminder.htmlBody,
    name: "Umangi & Zach",
    replyTo: SETTINGS.REPLY_TO || SETTINGS.FROM_EMAIL || "",
  };

  try {
    if (SETTINGS.FROM_EMAIL) options.from = SETTINGS.FROM_EMAIL;
    GmailApp.sendEmail(recipient, SETTINGS.REMINDER_SUBJECT, reminder.textBody, options);
  } catch (err) {
    const fallback = {
      htmlBody: reminder.htmlBody,
      name: "Umangi & Zach",
      replyTo: SETTINGS.REPLY_TO || "",
    };
    GmailApp.sendEmail(recipient, SETTINGS.REMINDER_SUBJECT, reminder.textBody, fallback);
  }
}

function buildInviteEmail_(householdLabel) {
  const websiteUrl = SETTINGS.WEDDING_SITE_URL || "";
  const password = SETTINGS.SITE_PASSWORD || "";
  const monogramUrl = "https://umangiandzach.love/5t6y7u8k/assets/monogram.png";
  const safeLabel = escapeHtml_(householdLabel || "friend");

  const textBody = [
    `Dear ${householdLabel || "friend"},`,
    "",
    "We’re so excited to celebrate with you in Oaxaca and would love for you to join us for our wedding weekend.",
    "",
    "Our website has the full schedule, travel details, and hotel information.",
    websiteUrl ? `Website: ${websiteUrl}` : "",
    password ? `Password: ${password}` : "",
    "",
    "Please RSVP by August 1, 2026.",
    "",
    "Love,",
    "Umangi + Zach",
    "",
    "Questions? Reply to this email or contact info@umangiandzach.love",
  ].filter(Boolean).join("\n");

  const htmlBody = `
    <div style="margin:0;padding:0;background:#b8572d;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#b8572d;padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#ffe8d6;border:1px solid #e8dfd4;border-radius:14px;overflow:hidden;font-family:Georgia,'Times New Roman',serif;color:#1f1f1f;">
              <tr>
                <td style="padding:36px 36px 12px 36px;text-align:center;">
                  <img src="${escapeHtml_(monogramUrl)}" alt="Umangi and Zach monogram" width="96" style="display:block;margin:0 auto 14px auto;width:96px;height:auto;" />
                  <div style="font-size:13px;letter-spacing:1.6px;text-transform:uppercase;color:#8a7b6a;">WE'RE GETTING MARRIED!</div>
                  <h1 style="margin:10px 0 6px 0;font-size:42px;line-height:1.1;font-weight:600;">Umangi &amp; Zach</h1>
                  <p style="margin:0;font-family:Arial,sans-serif;font-size:15px;color:#5f5b56;">Oaxaca, Mexico • December 4–6, 2026</p>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 36px 8px 36px;">
                  <p style="margin:0 0 14px 0;font-family:Arial,sans-serif;font-size:16px;line-height:1.6;">Dear ${safeLabel},</p>
                  <p style="margin:0 0 14px 0;font-family:Arial,sans-serif;font-size:16px;line-height:1.6;">
                    We’re so excited to celebrate with you in Oaxaca and would love for you to join us for our wedding weekend.
                  </p>
                  <p style="margin:0 0 18px 0;font-family:Arial,sans-serif;font-size:16px;line-height:1.6;">
                    Our website has the full schedule, travel details, and hotel information.
                  </p>
                  <p style="margin:0 0 8px 0;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;">
                    ${websiteUrl ? `<strong>Website:</strong> <a href="${escapeHtml_(websiteUrl)}" style="color:#b8572d;">${escapeHtml_(websiteUrl)}</a><br/>` : ""}
                    ${password ? `<strong>Password:</strong> ${escapeHtml_(password)}` : ""}
                  </p>
                  <p style="margin:16px 0 0 0;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;">
                    Please RSVP by <strong>August 1, 2026</strong>.
                  </p>
                  <p style="margin:10px 0 0 0;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f1f1f;">
                    Love,<br/>Umangi + Zach
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 36px 36px 36px;text-align:center;">
                  ${websiteUrl ? `<a href="${escapeHtml_(websiteUrl)}" style="display:inline-block;background:#b8572d;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:.4px;padding:12px 20px;border-radius:999px;">Open Wedding Website</a>` : ""}
                  <p style="margin:18px 0 0 0;font-family:Arial,sans-serif;font-size:13px;color:#7a7268;">
                    Questions? Reply to this email or reach us at info@umangiandzach.love
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;

  return { textBody, htmlBody };
}

function buildReminderEmail_(householdLabel) {
  const websiteUrl = SETTINGS.WEDDING_SITE_URL || "";
  const rsvpUrl = SETTINGS.RSVP_PUBLIC_URL || "";
  const password = SETTINGS.SITE_PASSWORD || "";
  const monogramUrl = "https://umangiandzach.love/5t6y7u8k/assets/monogram.png";
  const safeLabel = escapeHtml_(householdLabel || "friend");

  const textBody = [
    `Dear ${householdLabel || "friend"},`,
    "",
    "Quick RSVP reminder from us — we would love to celebrate with you in Oaxaca.",
    "If you have not submitted yet, please RSVP when you have a moment.",
    "",
    rsvpUrl ? `RSVP: ${rsvpUrl}` : "",
    websiteUrl ? `Website: ${websiteUrl}` : "",
    password ? `Password: ${password}` : "",
    "",
    "Please RSVP by August 1, 2026.",
    "",
    "Love,",
    "Umangi + Zach",
    "",
    "Questions? Reply to this email or contact info@umangiandzach.love",
  ].filter(Boolean).join("\n");

  const htmlBody = `
    <div style="margin:0;padding:0;background:#b8572d;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#b8572d;padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#ffe8d6;border:1px solid #e8dfd4;border-radius:14px;overflow:hidden;font-family:Georgia,'Times New Roman',serif;color:#1f1f1f;">
              <tr>
                <td style="padding:36px 36px 12px 36px;text-align:center;">
                  <img src="${escapeHtml_(monogramUrl)}" alt="Umangi and Zach monogram" width="96" style="display:block;margin:0 auto 14px auto;width:96px;height:auto;" />
                  <div style="font-size:13px;letter-spacing:1.6px;text-transform:uppercase;color:#8a7b6a;">RSVP REMINDER</div>
                  <h1 style="margin:10px 0 6px 0;font-size:42px;line-height:1.1;font-weight:600;">Umangi &amp; Zach</h1>
                  <p style="margin:0;font-family:Arial,sans-serif;font-size:15px;color:#5f5b56;">Oaxaca, Mexico • December 4–6, 2026</p>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 36px 8px 36px;">
                  <p style="margin:0 0 14px 0;font-family:Arial,sans-serif;font-size:16px;line-height:1.6;">Dear ${safeLabel},</p>
                  <p style="margin:0 0 14px 0;font-family:Arial,sans-serif;font-size:16px;line-height:1.6;">
                    Quick RSVP reminder from us — we would love to celebrate with you in Oaxaca.
                  </p>
                  <p style="margin:0 0 18px 0;font-family:Arial,sans-serif;font-size:16px;line-height:1.6;">
                    If you have not submitted yet, please RSVP when you have a moment.
                  </p>
                  <p style="margin:0 0 8px 0;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;">
                    ${rsvpUrl ? `<strong>RSVP:</strong> <a href="${escapeHtml_(rsvpUrl)}" style="color:#b8572d;">${escapeHtml_(rsvpUrl)}</a><br/>` : ""}
                    ${websiteUrl ? `<strong>Website:</strong> <a href="${escapeHtml_(websiteUrl)}" style="color:#b8572d;">${escapeHtml_(websiteUrl)}</a><br/>` : ""}
                    ${password ? `<strong>Password:</strong> ${escapeHtml_(password)}` : ""}
                  </p>
                  <p style="margin:16px 0 0 0;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;">
                    Please RSVP by <strong>August 1, 2026</strong>.
                  </p>
                  <p style="margin:10px 0 0 0;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f1f1f;">
                    Love,<br/>Umangi + Zach
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 36px 36px 36px;text-align:center;">
                  ${rsvpUrl ? `<a href="${escapeHtml_(rsvpUrl)}" style="display:inline-block;background:#b8572d;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:.4px;padding:12px 20px;border-radius:999px;">Complete RSVP</a>` : ""}
                  <p style="margin:18px 0 0 0;font-family:Arial,sans-serif;font-size:13px;color:#7a7268;">
                    Questions? Reply to this email or reach us at info@umangiandzach.love
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;

  return { textBody, htmlBody };
}

function writeInviteAudit_(sheet, rowIndex, map, values) {
  if (map.inviteStatus != null && values.status != null) {
    sheet.getRange(rowIndex, map.inviteStatus + 1).setValue(values.status);
  }
  if (map.inviteError != null && values.error != null) {
    sheet.getRange(rowIndex, map.inviteError + 1).setValue(values.error);
  }
  if (map.inviteSentAt != null && values.sentAt) {
    sheet.getRange(rowIndex, map.inviteSentAt + 1).setValue(values.sentAt);
  }
}

function writeReminderAudit_(sheet, rowIndex, map, values) {
  if (map.reminderStatus != null && values.status != null) {
    sheet.getRange(rowIndex, map.reminderStatus + 1).setValue(values.status);
  }
  if (map.reminderError != null && values.error != null) {
    sheet.getRange(rowIndex, map.reminderError + 1).setValue(values.error);
  }
  if (map.lastReminderSentAt != null && values.sentAt) {
    sheet.getRange(rowIndex, map.lastReminderSentAt + 1).setValue(values.sentAt);
  }
}

function rowValue_(row, map, key) {
  if (map[key] == null) return "";
  return row[map[key]];
}

function isInviteQueued_(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "yes" || normalized === "y" || normalized === "true" || normalized === "1" || normalized === "send";
}

function parseDateValue_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function latestDate_(a, b) {
  if (a && b) return a.getTime() >= b.getTime() ? a : b;
  return a || b || null;
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
