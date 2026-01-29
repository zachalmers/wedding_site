# RSVP setup (Google Sheets + Apps Script)

This site uses a lightweight Google Sheets backend with Apps Script. Follow these steps once; after that it’s automatic.

## 1) Create the RSVP spreadsheet
1. In Google Drive, create a new Google Sheet named `Wedding RSVP`.
2. Add three tabs with these exact names:
   - `Households`
   - `Guests`
   - `Submissions`
3. Add these headers (row 1) for each tab:

**Households**
```
householdId | email | householdLabel | maxPlusOnes | editToken | lastSubmitted
```

**Guests**
```
householdId | firstName | lastName | email | isPlusOne | attending | events | dietary | updatedAt
```

**Submissions**
```
submittedAt | householdId | email | notes | payload
```

If you already created the sheet, insert the new `events` column between `attending` and `dietary` on the `Guests` tab, and insert the `notes` column on the `Submissions` tab.

4. Populate `Households` and `Guests` with your invite list.
   - `householdId` can be any unique ID you choose (e.g., `UMZ-001`).
   - `email` must be the email you want guests to search with.
   - `householdLabel` can be something like `The Patel Family`.
   - `maxPlusOnes` is a number (0, 1, 2, ...).
   - `Guests` should include each invited person in the party (not plus-ones).

Example:
```
Households:
UMZ-001 | person@example.com | The Patel Family | 1 | | 

Guests:
UMZ-001 | Umangi | Patel | person@example.com | FALSE |  |  |  |
UMZ-001 | Zach | Chalmers | person@example.com | FALSE |  |  |  |
```

## 2) Add Apps Script
1. In the spreadsheet, go to **Extensions → Apps Script**.
2. Delete any default code and paste the contents of `rsvp-backend.gs`.
3. Update the constants at the top:
   - `RSVP_PUBLIC_URL` (use the exact public path for `rsvp.html`; on GitHub Pages this is likely `https://umangiandzach.love/5t6y7u8k/rsvp.html`)
   - `FROM_EMAIL` and `REPLY_TO` (use `info@umangiandzach.love`)
4. Save.

## 3) Deploy the web app
1. Click **Deploy → New deployment**.
2. Select **Web app**.
3. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Deploy and copy the **Web app URL** (ends in `/exec`).

## 4) Connect the site to the endpoint
1. Open `assets/js/rsvp.js`.
2. Set:
   ```
   const RSVP_ENDPOINT = "PASTE_YOUR_WEB_APP_URL";
   ```
3. Save and deploy your site.

## 5) Configure the email alias (info@umangiandzach.love)
**If you use Google Workspace:**
1. In Admin console → Gmail → Accounts → Send mail as, add `info@umangiandzach.love`.
2. In Gmail (for the sending account), verify the alias under **Settings → Accounts → Send mail as**.

**If you use a Gmail inbox:**
1. In Gmail **Settings → Accounts → Send mail as**, add the alias and complete verification.

If the alias is not configured, Apps Script will still send but may use the default Gmail address. The script includes a fallback that keeps `replyTo` as your alias.

## 6) Test
1. Open `rsvp.html`.
2. Enter a known email from `Households`.
3. Submit an RSVP and verify:
   - `Guests` rows update
   - `Submissions` logs a row
   - Confirmation email arrives with edit link

---
If you need help importing guest lists or want a bulk CSV template, tell me and I’ll generate one.
