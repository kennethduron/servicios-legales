const toggle = document.getElementById("menuToggle");
const menu = document.getElementById("navMenu");

if (toggle && menu) {
    const closeMenu = () => {
        menu.classList.remove("show");
        document.body.classList.remove("menu-open");
        toggle.setAttribute("aria-expanded", "false");
    };

    const openMenu = () => {
        menu.classList.add("show");
        document.body.classList.add("menu-open");
        toggle.setAttribute("aria-expanded", "true");
    };

    const setMenuState = isOpen => {
        if (isOpen) {
            openMenu();
        } else {
            closeMenu();
        }
    };

    toggle.addEventListener("click", event => {
        event.stopPropagation();
        const isOpen = !menu.classList.contains("show");
        setMenuState(isOpen);
    });

    document.addEventListener("click", event => {
        if (window.innerWidth > 760) {
            return;
        }

        if (!menu.classList.contains("show")) {
            return;
        }

        if (menu.contains(event.target) || toggle.contains(event.target)) {
            return;
        }

        closeMenu();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeMenu();
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 760) {
            closeMenu();
        }
    });

    menu.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
            closeMenu();
        });
    });

    if (window.innerWidth > 760) {
        document.body.classList.remove("menu-open");
        toggle.setAttribute("aria-expanded", "false");
    }
}

const faders = document.querySelectorAll(".fade-in");

if ("IntersectionObserver" in window && faders.length) {
    const observer = new IntersectionObserver((entries, currentObserver) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) {
                return;
            }

            entry.target.classList.add("appear");
            currentObserver.unobserve(entry.target);
        });
    }, { threshold: 0.18 });

    faders.forEach(item => observer.observe(item));
} else {
    faders.forEach(item => item.classList.add("appear"));
}

const serviceSelect = document.getElementById("serviceSelect");

if (serviceSelect) {
    const params = new URLSearchParams(window.location.search);
    const requestedService = params.get("servicio");

    if (requestedService) {
        const normalized = requestedService.trim().toLowerCase();
        const matchingOption = Array.from(serviceSelect.options).find(option =>
            option.value.trim().toLowerCase() === normalized
        );

        if (matchingOption) {
            serviceSelect.value = matchingOption.value;
        }
    }
}

const form = document.getElementById("contactForm");
const formStatus = document.getElementById("formStatus");
const submitButton = document.getElementById("submitButton");
const headerTime = document.getElementById("headerTime");
const firebaseServices = window.firebaseServices;

function setFormStatus(message, type) {
    if (!formStatus) {
        return;
    }

    formStatus.textContent = message;
    formStatus.classList.remove("is-success", "is-error");

    if (type) {
        formStatus.classList.add(type);
    }
}

function normalizeHondurasPhone(phone) {
    const digits = (phone || "").replace(/[^\d]/g, "");

    if (digits.startsWith("00504")) {
        return digits.slice(5);
    }

    if (digits.startsWith("504") && digits.length > 8) {
        return digits.slice(3);
    }

    return digits;
}

function updateHeaderTime() {
    if (!headerTime) {
        return;
    }

    const now = new Date();
    const display = new Intl.DateTimeFormat("es-HN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZone: "America/Tegucigalpa"
    }).format(now);

    const isoValue = new Intl.DateTimeFormat("sv-SE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "America/Tegucigalpa"
    }).format(now).replace(" ", "T");

    headerTime.textContent = display;
    headerTime.setAttribute("datetime", isoValue);
}

async function saveLead(payload) {
    if (!firebaseServices || !firebaseServices.db) {
        throw new Error("Firebase no está disponible.");
    }

    return firebaseServices.db.collection("consultas").add(payload);
}

if (form) {
    form.addEventListener("submit", async event => {
        event.preventDefault();

        const data = new FormData(form);
        const payload = {
            nombre: (data.get("nombre") || "").toString().trim(),
            telefono: normalizeHondurasPhone((data.get("telefono") || "").toString().trim()),
            email: (data.get("email") || "").toString().trim(),
            servicio: (data.get("servicio") || "").toString().trim(),
            urgencia: (data.get("urgencia") || "").toString().trim(),
            canal: (data.get("canal") || "").toString().trim(),
            mensaje: (data.get("mensaje") || "").toString().trim(),
            consentimiento: Boolean(data.get("consentimiento")),
            estado: "nuevo",
            origen: "sitio-web",
            notas: "",
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (!payload.nombre || !payload.telefono || !payload.servicio || !payload.urgencia || !payload.canal || !payload.mensaje) {
            setFormStatus("Completa los campos obligatorios para enviar tu consulta.", "is-error");
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "Enviando...";
        setFormStatus("Enviando tu consulta...", "");

        try {
            await saveLead(payload);
            form.reset();
            setFormStatus("Tu consulta fue enviada correctamente. Pronto nos pondremos en contacto contigo.", "is-success");
        } catch (error) {
            console.error(error);
            setFormStatus("No se pudo enviar tu consulta en este momento. Inténtalo nuevamente.", "is-error");
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Enviar consulta";
        }
    });
}

if (headerTime) {
    updateHeaderTime();
    window.setInterval(updateHeaderTime, 1000);
}
