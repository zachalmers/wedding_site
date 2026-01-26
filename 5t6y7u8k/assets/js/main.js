(() => {
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
  const modalTriggers = Array.from(document.querySelectorAll(".event-card__details-trigger"));
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

  // RSVP placeholder submission
  const form = document.getElementById("rsvpForm");
  const toast = document.getElementById("toast");

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.setTimeout(() => toast.classList.remove("is-visible"), 2800);
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      // Minimal “success” behavior (placeholder)
      const data = new FormData(form);
      const name = (data.get("name") || "").toString().trim();
      const attending = (data.get("attending") || "").toString();

      if (attending === "yes") {
        showToast(`RSVP saved (placeholder). Thank you${name ? ", " + name : ""}.`);
      } else if (attending === "no") {
        showToast(`Noted (placeholder). We’ll miss you${name ? ", " + name : ""}.`);
      } else {
        showToast("Please complete the RSVP fields.");
        return;
      }

      form.reset();
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
