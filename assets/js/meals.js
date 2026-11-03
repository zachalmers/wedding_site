(() => {
  const ENDPOINT = "https://script.google.com/macros/s/AKfycbytencCmCLM-Rk_ckS-DhiQgVqyQ_3qn1_kUrXSxGqS5S_tEUpxkenI2hHe9rWQxox8Bw/exec";
  const lookupForm = document.getElementById("meal-lookup");
  const emailInput = document.getElementById("meal-email");
  const lookupStatus = document.getElementById("meal-lookup-status");
  const card = document.getElementById("meal-card");
  const form = document.getElementById("meal-form");
  const list = document.getElementById("meal-guests");
  const status = document.getElementById("meal-status");
  const submit = document.getElementById("meal-submit");
  let invitation = null;
  let guests = [];
  let lookupId = 0;
  const setStatus = (element, message, type = "") => {
    element.textContent = message;
    element.dataset.type = type;
  };
  const post = async (payload) => {
    const response = await fetch(ENDPOINT, { method: "POST", body: JSON.stringify(payload) });
    let data;
    try { data = await response.json(); }
    catch { throw new Error("Meal selection is temporarily unavailable. Please try again later."); }
    if (!response.ok || !data.ok) throw new Error(data.error || "Unable to save. Please try again.");
    return data;
  };
  const lookup = async ({ email = "", token = "" }) => {
    const requestId = ++lookupId;
    card.classList.add("is-hidden");
    invitation = null;
    setStatus(lookupStatus, "Finding your invitation…", "info");
    try {
      const data = await post({ action: "lookup", email, token });
      if (requestId !== lookupId) return;
      if (data.mealSelectionVersion !== 1) throw new Error("Meal selection is not available yet. Please try again later.");
      invitation = data;
      emailInput.value = data.email || email;
      document.getElementById("meal-household").textContent = data.householdLabel || "Your party";
      guests = data.guests.filter((guest) => guest.attending === "yes" && guest.events.includes("wedding"));
      list.replaceChildren();
      guests.forEach((guest, index) => {
        const fieldset = document.createElement("fieldset");
        fieldset.className = "meal-guest";
        const legend = document.createElement("legend");
        legend.textContent = `${guest.firstName} ${guest.lastName}`;
        fieldset.append(legend);
        const options = guest.mealOptions || [];
        options.forEach((meal) => {
          const label = document.createElement("label");
          label.className = "meal-option";
          const input = document.createElement("input");
          input.type = "radio";
          input.name = `meal-${index}`;
          input.value = meal.id;
          input.required = true;
          input.checked = guest.mealChoice === meal.id || options.length === 1;
          const text = document.createElement("span");
          text.textContent = meal.label;
          label.append(input, text);
          fieldset.append(label);
        });
        if (!options.length) {
          const message = document.createElement("p");
          message.textContent = "Please update your dietary preference on your RSVP, then return here to choose a meal.";
          fieldset.append(message);
        }
        const allergyLabel = document.createElement("label");
        allergyLabel.htmlFor = `allergies-${index}`;
        allergyLabel.textContent = "Food allergies or other restrictions";
        const allergies = document.createElement("textarea");
        allergies.id = `allergies-${index}`;
        allergies.name = `allergies-${index}`;
        allergies.rows = 2;
        allergies.value = guest.allergies || "";
        allergies.placeholder = "None, or details we should know";
        fieldset.append(allergyLabel, allergies);
        list.append(fieldset);
      });
      submit.disabled = !guests.length || guests.some((guest) => !guest.mealOptions.length);
      setStatus(status, guests.length ? "" : "There are no guests marked as attending the reception in this party. You can update your RSVP using the link below.");
      setStatus(lookupStatus, "");
      card.classList.remove("is-hidden");
      const editLink = document.getElementById("meal-rsvp-link");
      editLink.href = data.token ? `rsvp.html?token=${encodeURIComponent(data.token)}` : `rsvp.html?email=${encodeURIComponent(data.email)}`;
    } catch (error) {
      if (requestId === lookupId) setStatus(lookupStatus, error.message, "error");
    }
  };
  lookupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    lookup({ email: emailInput.value.trim() });
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!invitation || submit.disabled || !form.reportValidity()) return;
    const currentInvitation = invitation;
    const answers = guests.map((guest, index) => ({
      guestKey: guest.guestKey,
      mealChoice: form.elements.namedItem(`meal-${index}`).value,
      allergies: form.elements.namedItem(`allergies-${index}`).value.trim(),
      previousAllergies: guest.allergies || "",
      previousMealChoice: guest.mealChoice || "",
    }));
    submit.disabled = true;
    lookupForm.querySelector("button").disabled = true;
    setStatus(status, "Saving your meal choices…", "info");
    try {
      const data = await post({ action: "submitMeals", email: invitation.email, token: invitation.token,
        householdId: invitation.household.householdId, guests: answers });
      if (invitation !== currentInvitation) return;
      guests.forEach((guest, index) => Object.assign(guest, { allergies: answers[index].allergies, mealChoice: answers[index].mealChoice }));
      setStatus(status, data.message, "success");
    } catch (error) { setStatus(status, error.message, "error"); }
    finally {
      submit.disabled = false;
      lookupForm.querySelector("button").disabled = false;
    }
  });
  form.addEventListener("input", () => { if (status.dataset.type === "success") setStatus(status, "Unsaved changes", "info"); });
  const params = new URLSearchParams(location.search);
  if (params.get("token")) lookup({ token: params.get("token") });
  else if (params.get("email")) lookup({ email: params.get("email") });
})();
