(() => {
  const RSVP_ENDPOINT = "https://script.google.com/macros/s/AKfycbxVXXVv62576T6A7hTDh1DQ7gUQiTkoiJe0OGfH3eh29U1p_1JZxTeJn8UBJ328bj2Rnw/exec";
  const EVENT_OPTIONS = [
    { id: "haldi", label: "Haldi (Fri morning)" },
    { id: "sangeet", label: "Sangeet (Fri evening)" },
    { id: "wedding", label: "Ceremony + Reception (Sat)" },
  ];
  const lookupForm = document.getElementById("rsvp-lookup");
  const lookupEmail = document.getElementById("lookup-email");
  const lookupStatus = document.getElementById("lookup-status");

  const formCard = document.getElementById("rsvp-form-card");
  const confirmationCard = document.getElementById("rsvp-confirmation");
  const confirmationText = document.getElementById("confirmation-text");
  const householdLabel = document.getElementById("household-label");

  const guestList = document.getElementById("guest-list");
  const addPlusOneBtn = document.getElementById("add-plus-one");
  const rsvpForm = document.getElementById("rsvp-form");
  const submitStatus = document.getElementById("submit-status");
  const notesField = document.getElementById("rsvp-notes");

  let household = null;
  let maxPlusOnes = 0;
  let activeToken = "";

  const setStatus = (el, msg, type) => {
    if (!el) return;
    el.textContent = msg || "";
    el.dataset.type = type || "";
  };

  const escapeAttr = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const showCard = (el) => el && el.classList.remove("is-hidden");
  const hideCard = (el) => el && el.classList.add("is-hidden");

  const createGuestRow = ({ firstName = "", lastName = "", email = "", whatsappPhone = "", attending = "", dietary = "", events = [], isPlusOne = false, isPrimaryGuest = false, householdEmail = "" } = {}) => {
    const row = document.createElement("div");
    row.className = "guest-row";
    row.dataset.plusOne = isPlusOne ? "1" : "0";
    const eventMarkup = EVENT_OPTIONS.map((event) => {
      const checked = events.includes(event.id) ? "checked" : "";
      return `
        <label class="choice">
          <input type="checkbox" name="events" value="${event.id}" ${checked} />
          <span>${event.label}</span>
        </label>
      `;
    }).join("");
    const dietaryValue = dietary || "";
    const dietaryLower = dietaryValue.toLowerCase();
    const dietaryPreset = dietaryLower === "vegan"
      ? "vegan"
      : dietaryLower === "veg" || dietaryLower === "vegetarian"
        ? "vegetarian"
        : dietaryLower === "non-veg" || dietaryLower === "nonveg" || dietaryLower === "omnivore"
          ? "omnivore"
        : dietaryValue
          ? "other"
          : "";
    const dietaryOtherValue = dietaryPreset === "other" ? dietaryValue : "";
    const safeFirstName = escapeAttr(firstName);
    const safeLastName = escapeAttr(lastName);
    const effectiveEmail = isPrimaryGuest ? (householdEmail || email || "") : (email || "");
    const safeEmail = escapeAttr(effectiveEmail);
    const safeWhatsapp = escapeAttr(whatsappPhone);
    const safeDietaryOther = escapeAttr(dietaryOtherValue);

    row.innerHTML = `
      <div class="field">
        <label>First name</label>
        <input type="text" name="firstName" value="${safeFirstName}" placeholder="${isPlusOne ? "First name" : ""}" required />
      </div>
      <div class="field">
        <label>Last name</label>
        <input type="text" name="lastName" value="${safeLastName}" placeholder="${isPlusOne ? "Last name" : ""}" required />
      </div>
      <div class="field">
        <label>Attending</label>
        <select name="attending" required>
          <option value="" ${attending ? "" : "selected"} disabled>Select one</option>
          <option value="yes" ${attending === "yes" ? "selected" : ""}>Yes</option>
          <option value="no" ${attending === "no" ? "selected" : ""}>No</option>
        </select>
      </div>
      <div class="field">
        <label>Dietary needs</label>
        <select name="dietarySelect" ${attending === "yes" ? "required" : ""}>
          <option value="" ${dietaryPreset ? "" : "selected"} disabled>Select one</option>
          <option value="vegetarian" ${dietaryPreset === "vegetarian" ? "selected" : ""}>Vegetarian</option>
          <option value="vegan" ${dietaryPreset === "vegan" ? "selected" : ""}>Vegan</option>
          <option value="omnivore" ${dietaryPreset === "omnivore" ? "selected" : ""}>Omnivore</option>
          <option value="other" ${dietaryPreset === "other" ? "selected" : ""}>Other (provide details)</option>
        </select>
        <textarea name="dietaryOther" rows="1" placeholder="Tell us more" class="dietary-other is-hidden" ${attending === "yes" && dietaryPreset === "other" ? "required" : ""}>${safeDietaryOther}</textarea>
      </div>
      <div class="field">
        <label>${isPrimaryGuest ? "Email" : "Guest email (optional)"}</label>
        <input type="email" name="guestEmail" value="${safeEmail}" placeholder="${isPrimaryGuest ? "" : "guest@example.com"}" autocomplete="email" inputmode="email" ${isPrimaryGuest ? "readonly aria-readonly='true'" : ""} />
      </div>
      <div class="field">
        <label>WhatsApp (optional)</label>
        <input type="tel" name="whatsappPhone" value="${safeWhatsapp}" placeholder="+1 415 555 0123" autocomplete="tel" inputmode="tel" />
      </div>
      <div class="field field--full field--events" aria-hidden="true">
        <label class="label--sentence">Please uncheck if you are unable to attend the Haldi or Sangeet.</label>
        <div class="choices">
          ${eventMarkup}
        </div>
      </div>
      ${isPlusOne ? `<button class="btn btn--ghost btn--mini guest-row__remove" type="button">Remove plus-one</button>` : ""}
    `;

    const attendingSelect = row.querySelector("select[name='attending']");
    const dietarySelect = row.querySelector("select[name='dietarySelect']");
    const dietaryOther = row.querySelector("[name='dietaryOther']");
    const dietaryField = dietarySelect ? dietarySelect.closest(".field") : null;
    const autosizeDietaryOther = () => {
      if (!dietaryOther) return;
      dietaryOther.style.height = "auto";
      dietaryOther.style.height = `${dietaryOther.scrollHeight}px`;
    };
    const syncDietaryState = () => {
      if (!dietarySelect || !dietaryOther) return;
      const enabled = attendingSelect.value === "yes";
      const isOther = dietarySelect.value === "other";

      dietarySelect.disabled = !enabled;

      if (enabled) {
        dietarySelect.setAttribute("required", "required");
        if (dietaryField) dietaryField.classList.remove("is-disabled");
        dietaryOther.disabled = !isOther;
        dietaryOther.classList.toggle("is-hidden", !isOther);
        if (isOther) {
          dietaryOther.setAttribute("required", "required");
          autosizeDietaryOther();
        } else {
          dietaryOther.removeAttribute("required");
        }
      } else {
        dietarySelect.removeAttribute("required");
        dietarySelect.value = "";
        if (dietaryField) dietaryField.classList.add("is-disabled");
        dietaryOther.value = "";
        dietaryOther.classList.add("is-hidden");
        dietaryOther.disabled = true;
        dietaryOther.removeAttribute("required");
      }
    };
    const eventInputs = row.querySelectorAll("input[name='events']");
    const eventField = row.querySelector(".field--events");
    const setEventVisibility = (show) => {
      if (!eventField) return;
      eventField.classList.toggle("is-hidden", !show);
      eventField.setAttribute("aria-hidden", show ? "false" : "true");
    };
    const checkAllEvents = () => {
      eventInputs.forEach((input) => {
        input.checked = true;
      });
    };
    const syncEventState = () => {
      const enabled = attendingSelect.value === "yes";
      eventInputs.forEach((input) => {
        input.disabled = !enabled;
      });
      if (enabled) {
        const anyChecked = Array.from(eventInputs).some((input) => input.checked);
        if (!anyChecked) checkAllEvents();
        setEventVisibility(true);
      } else {
        eventInputs.forEach((input) => {
          input.checked = false;
        });
        setEventVisibility(false);
      }
    };
    attendingSelect.addEventListener("change", () => {
      syncDietaryState();
      syncEventState();
    });
    if (dietarySelect) {
      dietarySelect.addEventListener("change", () => {
        syncDietaryState();
      });
    }
    dietaryOther.addEventListener("input", autosizeDietaryOther);
    syncDietaryState();
    syncEventState();

    if (isPlusOne) {
      const removeBtn = row.querySelector(".guest-row__remove");
      if (removeBtn) {
        removeBtn.addEventListener("click", () => {
          row.remove();
          if (addPlusOneBtn) {
            const canAdd = canAddPlusOne();
            addPlusOneBtn.disabled = !canAdd;
            addPlusOneBtn.classList.toggle("is-hidden", !canAdd);
          }
        });
      }
    }

    return row;
  };

  const renderGuests = (guests) => {
    if (!guestList) return;
    guestList.innerHTML = "";
    let primaryAssigned = false;
    guests.forEach((guest) => {
      const isPrimaryGuest = !primaryAssigned && !guest.isPlusOne;
      if (isPrimaryGuest) primaryAssigned = true;
      guestList.appendChild(createGuestRow({
        ...guest,
        isPrimaryGuest,
        householdEmail: household && household.email ? household.email : (lookupEmail ? lookupEmail.value.trim() : ""),
      }));
    });
  };

  const canAddPlusOne = () => {
    if (!guestList) return false;
    const current = guestList.querySelectorAll("[data-plus-one='1']").length;
    return current < maxPlusOnes;
  };

  const addPlusOne = () => {
    if (!canAddPlusOne()) return;
    guestList.appendChild(createGuestRow({ isPlusOne: true, email: "", whatsappPhone: "" }));
  };

  const collectGuests = () => {
    const rows = Array.from(document.querySelectorAll(".guest-row"));
    return rows.map((row) => {
      const get = (name) => row.querySelector(`[name='${name}']`).value.trim();
      const dietarySelect = row.querySelector("select[name='dietarySelect']");
      const dietaryOther = row.querySelector("[name='dietaryOther']");
      let dietary = "";
      if (dietarySelect) {
        if (dietarySelect.value === "other") {
          dietary = dietaryOther ? dietaryOther.value.trim() : "";
        } else {
          dietary = dietarySelect.value;
        }
      }
      const events = Array.from(row.querySelectorAll("input[name='events']:checked")).map((el) => el.value);
      return {
        firstName: get("firstName"),
        lastName: get("lastName"),
        email: get("guestEmail"),
        whatsappPhone: get("whatsappPhone"),
        attending: get("attending"),
        dietary,
        events,
        isPlusOne: row.dataset.plusOne === "1",
      };
    });
  };

  const post = async (payload) => {
    if (!RSVP_ENDPOINT) {
      throw new Error("RSVP endpoint is not configured.");
    }
    const res = await fetch(RSVP_ENDPOINT, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text || "{}");
    } catch (err) {
      throw new Error("RSVP service is temporarily unavailable. Please try again later.");
    }
    if (!res.ok) {
      throw new Error(data.error || "RSVP service is temporarily unavailable. Please try again later.");
    }
    if (!data.ok) throw new Error(data.error || "Submission failed. Please try again.");
    return data;
  };

  const handleLookup = async ({ email = "", token = "" } = {}) => {
    setStatus(lookupStatus, "Searching...", "info");
    hideCard(confirmationCard);
    try {
      const data = await post({ action: "lookup", email, token });
      household = data.household;
      household.email = data.email || "";
      maxPlusOnes = Number(data.maxPlusOnes || 0);
      activeToken = data.token || token || "";
      householdLabel.textContent = data.householdLabel || "";
      if (data.email && lookupEmail) {
        lookupEmail.value = data.email;
      }
      if (notesField) {
        notesField.value = data.notes || "";
      }
      renderGuests(data.guests || []);
      showCard(formCard);
      setStatus(lookupStatus, "", "");
      if (addPlusOneBtn) {
        const canAdd = canAddPlusOne();
        addPlusOneBtn.disabled = !canAdd;
        addPlusOneBtn.classList.toggle("is-hidden", !canAdd);
      }
    } catch (err) {
      setStatus(lookupStatus, err.message, "error");
      hideCard(formCard);
    }
  };

  if (lookupForm) {
    lookupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = lookupEmail.value.trim();
      if (!email) return;
      handleLookup({ email });
    });
  }

  if (addPlusOneBtn) {
    addPlusOneBtn.addEventListener("click", () => {
      addPlusOne();
      const canAdd = canAddPlusOne();
      addPlusOneBtn.disabled = !canAdd;
      addPlusOneBtn.classList.toggle("is-hidden", !canAdd);
    });
  }

  if (rsvpForm) {
    rsvpForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setStatus(submitStatus, "Submitting...", "info");
      try {
        const guests = collectGuests();
        const missingEvents = guests.some((guest) => guest.attending === "yes" && (!guest.events || guest.events.length === 0));
        if (missingEvents) {
          setStatus(submitStatus, "Please select at least one event for each attending guest.", "error");
          return;
        }
        const payload = {
          action: "submit",
          email: lookupEmail.value.trim(),
          token: activeToken,
          householdId: household ? household.householdId : "",
          guests,
          notes: notesField ? notesField.value.trim() : "",
        };
        const data = await post(payload);
        showCard(confirmationCard);
        hideCard(formCard);
        confirmationText.textContent = data.message || "Thanks! Your RSVP has been recorded.";
        setStatus(submitStatus, "", "");
      } catch (err) {
        setStatus(submitStatus, err.message || "Submission failed. Please try again.", "error");
      }
    });
  }

  // Prefill email from query string
  const params = new URLSearchParams(window.location.search);
  const emailParam = params.get("email");
  const tokenParam = params.get("token");
  if (tokenParam) {
    handleLookup({ token: tokenParam });
  } else if (emailParam && lookupEmail) {
    lookupEmail.value = emailParam;
    handleLookup({ email: emailParam });
  }
})();
