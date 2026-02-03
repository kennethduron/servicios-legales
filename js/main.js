// MENU MOVIL
const toggle = document.getElementById("menuToggle");
const menu = document.getElementById("navMenu");
if (toggle) {
    toggle.addEventListener("click", () => menu.classList.toggle("show"));
}

// FORMULARIO
const form = document.getElementById("contactForm");
const success = document.getElementById("formSuccess");
if (form) {
    form.addEventListener("submit", async e => {
        e.preventDefault();
        const data = new FormData(form);
        const res = await fetch(form.action, {
            method: "POST",
            body: data,
            headers: { "Accept": "application/json" }
        });
        if (res.ok) {
            form.reset();
            success.style.display = "block";
            setTimeout(() => success.style.display = "none", 6000);
        }
    });
}

// ANIMACIONES SCROLL
const faders = document.querySelectorAll('.fade-in');
const appearOptions = { threshold: 0.3 };
const appearOnScroll = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('appear');
        observer.unobserve(entry.target);
    });
}, appearOptions);

faders.forEach(fader => appearOnScroll.observe(fader));
