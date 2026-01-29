(() => {
  // Password gate (client-side)
  const gate = document.getElementById("gate");
  const gateForm = document.getElementById("gate-form");
  const gatePass = document.getElementById("gate-pass");
  const gateError = document.getElementById("gate-error");
  const site = document.getElementById("site");
  const ACCESS_KEY = "wedding-site-access";
  const PASSWORD = "currytacos";

  const unlockSite = () => {
    if (gate) gate.classList.add("is-hidden");
    if (site) site.classList.remove("is-locked");
  };

  const lockSite = () => {
    if (gate) gate.classList.remove("is-hidden");
    if (site) site.classList.add("is-locked");
  };

  if (localStorage.getItem(ACCESS_KEY) === "ok") {
    unlockSite();
  } else {
    lockSite();
  }

  if (gateForm) {
    gateForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const val = (gatePass && gatePass.value ? gatePass.value : "").trim();
      if (val === PASSWORD) {
        localStorage.setItem(ACCESS_KEY, "ok");
        if (gateError) gateError.textContent = "";
        unlockSite();
      } else {
        if (gateError) gateError.textContent = "Incorrect password.";
        if (gatePass) gatePass.focus();
      }
    });
  }

  // Footer year
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Scroll cue: hide on scroll
  const scrollCue = document.querySelector(".scroll-cue");
  if (scrollCue) {
    const updateCue = () => {
      scrollCue.classList.toggle("is-hidden", window.scrollY > 20);
    };
    updateCue();
    window.addEventListener("scroll", updateCue, { passive: true });
  }

  // Flight search helper
  const flightForm = document.getElementById("flightSearchForm");
  if (flightForm) {
    const airports = [      { code: "ABQ", city: "Albuquerque", name: "Albuquerque International Sunport" },
      { code: "AMD", city: "Ahmedabad", name: "Sardar Vallabhbhai Patel International" },
      { code: "ATL", city: "Atlanta", name: "Hartsfield-Jackson Atlanta International" },
      { code: "AUS", city: "Austin", name: "Austin-Bergstrom International" },
      { code: "BNA", city: "Nashville", name: "Nashville International" },
      { code: "BOM", city: "Mumbai", name: "Chhatrapati Shivaji Maharaj International" },
      { code: "BOS", city: "Boston", name: "Logan International" },
      { code: "BUF", city: "Buffalo", name: "Buffalo Niagara International" },
      { code: "BWI", city: "Baltimore", name: "Baltimore/Washington International" },
      { code: "CLE", city: "Cleveland", name: "Cleveland Hopkins International" },
      { code: "CLT", city: "Charlotte", name: "Charlotte Douglas International" },
      { code: "CMH", city: "Columbus", name: "John Glenn Columbus International" },
      { code: "CVG", city: "Cincinnati", name: "Cincinnati/Northern Kentucky International" },
      { code: "DAL", city: "Dallas", name: "Dallas Love Field" },
      { code: "DCA", city: "Washington", name: "Reagan National" },
      { code: "DEL", city: "Delhi", name: "Indira Gandhi International" },
      { code: "DEN", city: "Denver", name: "Denver International" },
      { code: "DFW", city: "Dallas", name: "Dallas/Fort Worth International" },
      { code: "DTW", city: "Detroit", name: "Detroit Metropolitan" },
      { code: "EUG", city: "Eugene", name: "Eugene Airport" },
      { code: "EWR", city: "Newark", name: "Newark Liberty International" },
      { code: "FLL", city: "Fort Lauderdale", name: "Fort Lauderdale-Hollywood International" },
      { code: "HNL", city: "Honolulu", name: "Daniel K. Inouye International" },
      { code: "HOU", city: "Houston", name: "William P. Hobby" },
      { code: "IAD", city: "Washington", name: "Dulles International" },
      { code: "IAH", city: "Houston", name: "George Bush Intercontinental" },
      { code: "IND", city: "Indianapolis", name: "Indianapolis International" },
      { code: "JAX", city: "Jacksonville", name: "Jacksonville International" },
      { code: "JFK", city: "New York", name: "John F. Kennedy International" },
      { code: "LAS", city: "Las Vegas", name: "Harry Reid International" },
      { code: "LAX", city: "Los Angeles", name: "Los Angeles International" },
      { code: "LGA", city: "New York", name: "LaGuardia" },
      { code: "MCI", city: "Kansas City", name: "Kansas City International" },
      { code: "MCO", city: "Orlando", name: "Orlando International" },
      { code: "MDW", city: "Chicago", name: "Midway International" },
      { code: "MIA", city: "Miami", name: "Miami International" },
      { code: "MSP", city: "Minneapolis", name: "Minneapolis-St. Paul International" },
      { code: "MSY", city: "New Orleans", name: "Louis Armstrong New Orleans International" },
      { code: "OAK", city: "Oakland", name: "Oakland International" },
      { code: "ORD", city: "Chicago", name: "O'Hare International" },
      { code: "PDX", city: "Portland", name: "Portland International" },
      { code: "PHL", city: "Philadelphia", name: "Philadelphia International" },
      { code: "PHX", city: "Phoenix", name: "Phoenix Sky Harbor International" },
      { code: "PIT", city: "Pittsburgh", name: "Pittsburgh International" },
      { code: "RDU", city: "Raleigh", name: "Raleigh-Durham International" },
      { code: "SAN", city: "San Diego", name: "San Diego International" },
      { code: "SAT", city: "San Antonio", name: "San Antonio International" },
      { code: "SEA", city: "Seattle", name: "Seattle-Tacoma International" },
      { code: "SFO", city: "San Francisco", name: "San Francisco International" },
      { code: "SJU", city: "San Juan", name: "Luis Muñoz Marín International" },
      { code: "SLC", city: "Salt Lake City", name: "Salt Lake City International" },
      { code: "SMF", city: "Sacramento", name: "Sacramento International" },
      { code: "TPA", city: "Tampa", name: "Tampa International" },
      { code: "YYZ", city: "Toronto", name: "Toronto Pearson International" },
    ];

    const airportAliases = {
      nyc: "NYC",
      "newyorkcity": "NYC",
      "newyork": "NYC",
      "washingtondc": "DCA",
      "dc": "DCA",
    };

    const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
    const airportIndex = new Map();
    airports.forEach((a) => {
      airportIndex.set(normalize(a.code), a.code);
      airportIndex.set(normalize(a.city), a.code);
      airportIndex.set(normalize(a.name), a.code);
    });
    Object.entries(airportAliases).forEach(([k, v]) => airportIndex.set(k, v));

    const datalist = document.getElementById("flight-airports");
    if (datalist) {
      datalist.innerHTML = "";
      airports.forEach((a) => {
        const option = document.createElement("option");
        option.value = `${a.city} (${a.code})`;
        option.label = a.name;
        datalist.appendChild(option);
      });
    }

    const originInput = document.getElementById("flight-origin");
    if (originInput) {
      const defaultOrigin = originInput.value;
      originInput.addEventListener("focus", () => {
        if (originInput.value === defaultOrigin) originInput.value = "";
      });
      originInput.addEventListener("blur", () => {
        if (!originInput.value.trim()) originInput.value = defaultOrigin;
      });
    }
    const coerceOriginToCode = () => {
      if (!originInput) return;
      const raw = (originInput.value || "").trim();
      if (!raw) return;
      const match = raw.match(/\(([A-Z]{3})\)/i);
      if (match) {
        originInput.value = match[1].toUpperCase();
        return;
      }
      if (/^[A-Za-z]{3}$/.test(raw)) {
        originInput.value = raw.toUpperCase();
        return;
      }
      const code = airportIndex.get(normalize(raw));
      if (code) originInput.value = code;
    };
    if (originInput) {
      originInput.addEventListener("blur", coerceOriginToCode);
      originInput.addEventListener("change", coerceOriginToCode);
    }

    flightForm.addEventListener("submit", (event) => {
      event.preventDefault();
      coerceOriginToCode();
      const origin = (document.getElementById("flight-origin").value || "").trim().toUpperCase();
      const depart = (document.getElementById("flight-depart").value || "").trim();
      const ret = (document.getElementById("flight-return").value || "").trim();

      if (!origin || !depart) return;

      const defaults = {
        depart: "2026-12-03",
        ret: "2026-12-06",
      };

      const hardcodedLinks = {
        SFO: "https://www.google.com/travel/flights/search?tfs=CBwQAhojEgoyMDI2LTEyLTAzagwIAhIIL20vMGQ2bHByBwgBEgNPQVgaIxIKMjAyNi0xMi0wNmoHCAESA09BWHIMCAISCC9tLzBkNmxwQAFIAXABggELCP___________wGYAQE",
        ORD: "https://www.google.com/travel/flights/search?tfs=CBwQAhoeEgoyMDI2LTEyLTAzagcIARIDT1JEcgcIARIDT0FYGh4SCjIwMjYtMTItMDZqBwgBEgNPQVhyBwgBEgNPUkRAAUgBcAGCAQsI____________AZgBAQ&tfu=EgYIABAAGAA",
        NYC: "https://www.google.com/travel/flights/search?tfs=CBwQAhokEgoyMDI2LTEyLTAzag0IAxIJL20vMDJfMjg2cgcIARIDT0FYGiQSCjIwMjYtMTItMDZqBwgBEgNPQVhyDQgDEgkvbS8wMl8yODZAAUgBcAGCAQsI____________AZgBAQ&tfu=EgYIABAAGAA",
        LAX: "https://www.google.com/travel/flights/search?tfs=CBwQAhoeEgoyMDI2LTEyLTAzagcIARIDTEFYcgcIARIDT0FYGh4SCjIwMjYtMTItMDZqBwgBEgNPQVhyBwgBEgNMQVhAAUgBcAGCAQsI____________AZgBAQ&tfu=EgYIABAAGAA",
        EUG: "https://www.google.com/travel/flights/search?tfs=CBwQAhoeEgoyMDI2LTEyLTAzagcIARIDRVVHcgcIARIDT0FYGh4SCjIwMjYtMTItMDZqBwgBEgNPQVhyBwgBEgNFVUdAAUgBcAGCAQsI____________AZgBAQ&tfu=EgYIABAAGAA",
        PHX: "https://www.google.com/travel/flights/search?tfs=CBwQAhoeEgoyMDI2LTEyLTAzagcIARIDUEhYcgcIARIDT0FYGh4SCjIwMjYtMTItMDZqBwgBEgNPQVhyBwgBEgNQSFhAAUgBcAGCAQsI____________AZgBAQ&tfu=EgYIABAAGAA",
        AMD: "https://www.google.com/travel/flights/search?tfs=CBwQAhoeEgoyMDI2LTEyLTAzagcIARIDQU1EcgcIARIDT0FYGh4SCjIwMjYtMTItMDZqBwgBEgNPQVhyBwgBEgNBTURAAUgBcAGCAQsI____________AZgBAQ&tfu=EgYIABAAGAA",
        SJU: "https://www.google.com/travel/flights/search?tfs=CBwQAhoeEgoyMDI2LTEyLTAzagcIARIDU0pVcgcIARIDT0FYGh4SCjIwMjYtMTItMDZqBwgBEgNPQVhyBwgBEgNTSlVAAUgBcAGCAQsI____________AZgBAQ&tfu=EgYIABAAGAA",
      };

      const useHardcoded =
        origin in hardcodedLinks &&
        depart === defaults.depart &&
        ret === defaults.ret;

      if (useHardcoded) {
        window.open(hardcodedLinks[origin], "_blank", "noopener,noreferrer");
        return;
      }

      let query = `flights ${origin} to OAX ${depart}`;
      if (ret) query += ` ${ret}`;
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  // Mobile ToC toggle
  const toc = document.querySelector(".toc");
  const tocToggle = document.querySelector(".toc__toggle");
  const tocPanel = document.getElementById("tocPanel");
  if (toc && tocToggle && tocPanel) {
    // Ensure default open state reflects aria
    tocToggle.setAttribute("aria-expanded", String(toc.classList.contains("is-open")));
    tocToggle.addEventListener("click", () => {
      const isOpen = toc.classList.toggle("is-open");
      tocToggle.setAttribute("aria-expanded", String(isOpen));
    });

    tocPanel.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        if (toc.classList.contains("is-open")) {
          toc.classList.remove("is-open");
          tocToggle.setAttribute("aria-expanded", "false");
        }
      });
    });
  }

  // No auto-scroll nudge on load

  // Reveal on scroll
  const reveals = Array.from(document.querySelectorAll(".reveal"));
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add("is-visible");
    });
  }, { threshold: 0.12 });

  reveals.forEach(el => io.observe(el));

  // Event modals
  const modalTriggers = Array.from(document.querySelectorAll(".event-card__details-trigger, .modal-trigger"));
  const modals = Array.from(document.querySelectorAll(".event-modal"));

  const closeModal = (modal) => {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  };

  modalTriggers.forEach(trigger => {
    trigger.addEventListener("click", () => {
      const id = trigger.getAttribute("aria-controls");
      const modal = id ? document.getElementById(id) : null;
      if (!modal) return;
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
    });
  });

  modals.forEach(modal => {
    modal.addEventListener("click", (event) => {
      const target = event.target;
      if (target === modal || (target instanceof HTMLElement && target.hasAttribute("data-close"))) {
        closeModal(modal);
      }
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    modals.forEach(closeModal);
  });

  // Image lightbox
  const imageModal = document.getElementById("imageModal");
  const imageModalImg = document.getElementById("imageModalImg");
  const imageModalClose = imageModal ? imageModal.querySelector(".image-modal__close") : null;
  const imageButtons = Array.from(document.querySelectorAll("[data-lightbox]"));

  const closeImageModal = () => {
    if (!imageModal) return;
    imageModal.classList.remove("is-open");
    imageModal.setAttribute("aria-hidden", "true");
    if (imageModalImg) imageModalImg.removeAttribute("src");
  };

  imageButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      if (!imageModal || !imageModalImg) return;
      const src = btn.getAttribute("data-lightbox");
      const alt = btn.getAttribute("data-lightbox-alt") || "";
      if (!src) return;
      imageModalImg.src = src;
      imageModalImg.alt = alt;
      imageModal.classList.add("is-open");
      imageModal.setAttribute("aria-hidden", "false");
    });
  });

  if (imageModal) {
    imageModal.addEventListener("click", (event) => {
      const target = event.target;
      if (target === imageModal) closeImageModal();
    });
  }
  if (imageModalClose) {
    imageModalClose.addEventListener("click", closeImageModal);
  }
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeImageModal();
  });

  // Countdown
  const countdown = document.getElementById("countdown");
  if (countdown) {
    const targetRaw = countdown.getAttribute("data-date") || "";
    const targetDate = new Date(targetRaw);
    const parts = {
      days: countdown.querySelector('[data-part="days"]'),
      hours: countdown.querySelector('[data-part="hours"]'),
      minutes: countdown.querySelector('[data-part="minutes"]'),
      seconds: countdown.querySelector('[data-part="seconds"]'),
    };

    const isValidDate = !Number.isNaN(targetDate.getTime());

    const renderFallback = () => {
      Object.values(parts).forEach(el => {
        if (el) el.textContent = "--";
      });
    };

    if (!isValidDate) {
      renderFallback();
    } else {
      const tick = () => {
        const now = new Date();
        const diff = Math.max(0, targetDate.getTime() - now.getTime());
        const totalSeconds = Math.floor(diff / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (parts.days) parts.days.textContent = String(days);
        if (parts.hours) parts.hours.textContent = String(hours).padStart(2, "0");
        if (parts.minutes) parts.minutes.textContent = String(minutes).padStart(2, "0");
        if (parts.seconds) parts.seconds.textContent = String(seconds).padStart(2, "0");
      };

      tick();
      window.setInterval(tick, 1000);
    }
  }

  // RSVP lookup (opens dedicated page)
  const rsvpLookupForm = document.getElementById("rsvp-lookup-form");
  if (rsvpLookupForm) {
    rsvpLookupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = (document.getElementById("rsvp-email").value || "").trim();
      if (!email) return;
      const url = `rsvp.html?email=${encodeURIComponent(email)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  // Optional: parallax-ish hero background (very subtle)
  const heroMedia = document.querySelector(".hero__media");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (heroMedia && !reduceMotion) {
    window.addEventListener("scroll", () => {
      const y = window.scrollY || 0;
      heroMedia.style.transform = `scale(1.06) translateY(${Math.min(y * -0.02, 18)}px)`;
    }, { passive: true });
  }
})();
