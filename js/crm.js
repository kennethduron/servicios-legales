const services = window.firebaseServices;
const loginPanel = document.getElementById("loginPanel");
const crmPanel = document.getElementById("crmPanel");
const loginForm = document.getElementById("loginForm");
const loginStatus = document.getElementById("loginStatus");
const logoutButton = document.getElementById("logoutButton");
const notificationButton = document.getElementById("notificationButton");
const notificationPanel = document.getElementById("notificationPanel");
const notificationPanelMessage = document.getElementById("notificationPanelMessage");
const statusFilter = document.getElementById("statusFilter");
const leadList = document.getElementById("leadList");
const emptyState = document.getElementById("emptyState");
const crmNotice = document.getElementById("crmNotice");
const deleteModal = document.getElementById("deleteModal");
const deleteModalMessage = document.getElementById("deleteModalMessage");
const cancelDeleteButton = document.getElementById("cancelDeleteButton");
const confirmDeleteButton = document.getElementById("confirmDeleteButton");

const metricTotal = document.getElementById("metricTotal");
const metricNew = document.getElementById("metricNew");
const metricProgress = document.getElementById("metricProgress");
const metricUrgent = document.getElementById("metricUrgent");
const NOTIFICATION_PREF_KEY = "crm_notifications_enabled";

let allLeads = [];
let unsubscribe = null;
let notificationsEnabled = window.localStorage.getItem(NOTIFICATION_PREF_KEY) === "true";
let initialSnapshotLoaded = false;
let pendingDeleteLead = null;
let pendingSnapshotRender = false;
const leadDrafts = new Map();

function setLoginStatus(message, type) {
    if (!loginStatus) {
        return;
    }

    loginStatus.textContent = message;
    loginStatus.classList.remove("is-success", "is-error");

    if (type) {
        loginStatus.classList.add(type);
    }
}

function setCrmNotice(message, type = "info") {
    if (!crmNotice) {
        return;
    }

    crmNotice.textContent = message;
    crmNotice.hidden = !message;
    crmNotice.classList.remove("is-success", "is-info", "is-error");

    if (message) {
        crmNotice.classList.add(`is-${type}`);
    }
}

function formatDate(timestamp) {
    if (!timestamp || !timestamp.toDate) {
        return "Pendiente de sincronizar";
    }

    return new Intl.DateTimeFormat("es-HN", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(timestamp.toDate());
}

function sanitizePhone(phone) {
    const digits = (phone || "").replace(/[^\d]/g, "");

    if (!digits) {
        return "";
    }

    if (digits.startsWith("00504")) {
        return digits.slice(2);
    }

    if (digits.startsWith("504")) {
        return digits;
    }

    if (digits.length === 8) {
        return `504${digits}`;
    }

    return digits;
}

function urgencyClassName(value) {
    return `is-${(value || "normal").toLowerCase()}`;
}

function normalizeAdminLogin(value) {
    return (value || "").trim().toLowerCase();
}

async function resolveAdminEmail(loginValue) {
    const normalizedLogin = normalizeAdminLogin(loginValue);

    if (!normalizedLogin) {
        throw new Error("missing-login");
    }

    if (normalizedLogin.includes("@")) {
        return normalizedLogin;
    }

    const usernameDoc = await services.db.collection("admin_users").doc(normalizedLogin).get();

    if (!usernameDoc.exists) {
        throw new Error("username-not-found");
    }

    const usernameData = usernameDoc.data();
    const mappedEmail = typeof usernameData?.email === "string"
        ? usernameData.email.trim().toLowerCase()
        : "";

    if (!mappedEmail) {
        throw new Error("username-without-email");
    }

    return mappedEmail;
}

function updateMetrics(leads) {
    metricTotal.textContent = String(leads.length);
    metricNew.textContent = String(leads.filter(item => item.estado === "nuevo").length);
    metricProgress.textContent = String(leads.filter(item => item.estado === "en-proceso").length);
    metricUrgent.textContent = String(leads.filter(item => item.urgencia === "Alta").length);
}

function updateNotificationButton() {
    if (!notificationButton) {
        return;
    }

    if (!("Notification" in window)) {
        notificationButton.disabled = true;
        notificationButton.textContent = "Notificaciones no disponibles";
        return;
    }

    if (Notification.permission === "denied") {
        notificationButton.disabled = true;
        notificationButton.textContent = "Notificaciones bloqueadas";
        return;
    }

    notificationButton.disabled = false;
    notificationButton.textContent = notificationsEnabled ? "Notificaciones activas" : "Activar notificaciones";
}

function updateNotificationPanel() {
    if (!notificationPanel || !notificationPanelMessage) {
        return;
    }

    notificationPanel.classList.remove("is-error");

    if (!("Notification" in window)) {
        notificationPanel.hidden = false;
        notificationPanel.classList.add("is-error");
        notificationPanelMessage.textContent = "Este navegador no admite notificaciones del sistema para el CRM.";
        return;
    }

    if (Notification.permission === "denied") {
        notificationPanel.hidden = false;
        notificationPanel.classList.add("is-error");
        notificationPanelMessage.textContent = "Las notificaciones están bloqueadas en este navegador. Debes habilitarlas manualmente para recibir avisos nuevos.";
        return;
    }

    if (notificationsEnabled && Notification.permission === "granted") {
        notificationPanel.hidden = true;
        return;
    }

    notificationPanel.hidden = false;
    notificationPanelMessage.textContent = "Recibe un aviso en esta pantalla y en tu navegador cuando entre una nueva solicitud.";
}

function buildLeadNotice(lead) {
    const service = lead.servicio || "Consulta legal";
    const name = lead.nombre || "Nuevo cliente";
    return `Nueva solicitud: ${name} - ${service}.`;
}

function showBrowserNotification(lead) {
    if (!notificationsEnabled || !("Notification" in window) || Notification.permission !== "granted") {
        return;
    }

    const notification = new Notification("Nueva solicitud en el CRM", {
        body: buildLeadNotice(lead),
        icon: `${window.location.origin}/pictures/logo.jpg`,
        badge: `${window.location.origin}/pictures/logo.jpg`
    });

    notification.onclick = () => {
        window.focus();
        notification.close();
    };
}

function notifyNewLead(lead) {
    const message = buildLeadNotice(lead);
    setCrmNotice(message, "success");
    showBrowserNotification(lead);
}

function openDeleteModal(lead) {
    if (!deleteModal || !deleteModalMessage) {
        return;
    }

    pendingDeleteLead = lead;
    deleteModalMessage.textContent = `Vas a eliminar la solicitud de ${lead.nombre || "este cliente"}. Esta acción no se puede deshacer.`;
    deleteModal.hidden = false;
    deleteModal.setAttribute("aria-hidden", "false");
}

function closeDeleteModal() {
    if (!deleteModal) {
        return;
    }

    deleteModal.hidden = true;
    deleteModal.setAttribute("aria-hidden", "true");
    pendingDeleteLead = null;
}

function hasActiveLeadEditor() {
    if (!leadList) {
        return false;
    }

    const activeElement = document.activeElement;
    return Boolean(
        activeElement
        && leadList.contains(activeElement)
        && activeElement.matches("[data-field]")
    );
}

function updateLeadDraft(leadId, lead, partial) {
    const currentDraft = leadDrafts.get(leadId) || {
        estado: lead.estado || "nuevo",
        notas: typeof lead.notas === "string" ? lead.notas : ""
    };

    leadDrafts.set(leadId, {
        ...currentDraft,
        ...partial
    });
}

function reconcileLeadDrafts(leads) {
    const activeLeadIds = new Set(leads.map(lead => lead.id));

    Array.from(leadDrafts.keys()).forEach(leadId => {
        if (!activeLeadIds.has(leadId)) {
            leadDrafts.delete(leadId);
        }
    });

    leads.forEach(lead => {
        const draft = leadDrafts.get(lead.id);

        if (!draft) {
            return;
        }

        const snapshotStatus = lead.estado || "nuevo";
        const snapshotNotes = typeof lead.notas === "string" ? lead.notas : "";

        if (draft.estado === snapshotStatus && draft.notas === snapshotNotes) {
            leadDrafts.delete(lead.id);
        }
    });
}

function flushDeferredRenderIfReady() {
    if (!pendingSnapshotRender || hasActiveLeadEditor()) {
        return;
    }

    pendingSnapshotRender = false;
    renderLeads();
}

async function persistLeadUpdate(leadId, payload) {
    await services.db.collection("consultas").doc(leadId).update({
        ...payload,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

function createLeadCard(lead) {
    const article = document.createElement("article");
    article.className = "lead-card";
    article.dataset.leadId = lead.id;

    const leadView = leadDrafts.has(lead.id)
        ? {
            ...lead,
            ...leadDrafts.get(lead.id)
        }
        : lead;

    const sanitizedPhone = sanitizePhone(leadView.telefono);
    const emailButton = leadView.email
        ? `<a href="mailto:${leadView.email}" class="btn btn-muted">Enviar correo</a>`
        : "";
    const whatsappButton = sanitizedPhone
        ? `<a href="https://wa.me/${sanitizedPhone}" class="btn btn-secondary btn-whatsapp" target="_blank" rel="noreferrer">WhatsApp</a>`
        : "";

    article.innerHTML = `
        <div class="lead-header">
            <div>
                <h3>${leadView.nombre || "Sin nombre"}</h3>
                <div class="lead-meta">
                    <span>${leadView.servicio || "Servicio no especificado"}</span>
                    <span>${formatDate(leadView.createdAt)}</span>
                    <span>${leadView.canal || "Canal no definido"}</span>
                </div>
            </div>
            <span class="lead-badge ${urgencyClassName(leadView.urgencia)}">${leadView.urgencia || "Normal"}</span>
        </div>

        <div class="lead-meta">
            <span><strong>Teléfono:</strong> ${leadView.telefono || "No indicado"}</span>
            <span><strong>Correo:</strong> ${leadView.email || "No indicado"}</span>
            <span><strong>Origen:</strong> ${leadView.origen || "sitio-web"}</span>
        </div>

        <div class="lead-message">${leadView.mensaje || "Sin descripción del caso."}</div>

        <div class="lead-form">
            <label class="input-group">
                <span>Estado</span>
                <select data-field="estado">
                    <option value="nuevo" ${leadView.estado === "nuevo" ? "selected" : ""}>Nuevo</option>
                    <option value="en-proceso" ${leadView.estado === "en-proceso" ? "selected" : ""}>En proceso</option>
                    <option value="seguimiento" ${leadView.estado === "seguimiento" ? "selected" : ""}>Seguimiento</option>
                    <option value="cerrado" ${leadView.estado === "cerrado" ? "selected" : ""}>Cerrado</option>
                </select>
            </label>

            <label class="input-group">
                <span>Notas internas</span>
                <textarea data-field="notas" placeholder="Agrega observaciones para el seguimiento."></textarea>
            </label>
        </div>

        <div class="lead-actions">
            ${whatsappButton}
            ${emailButton}
            <button type="button" class="btn btn-danger btn-delete" data-action="delete">
                <i class="fas fa-trash" aria-hidden="true"></i>
                Eliminar
            </button>
            <span class="lead-save-status" data-role="save-status" aria-live="polite"></span>
        </div>
    `;

    const deleteButton = article.querySelector('[data-action="delete"]');
    const statusSelect = article.querySelector('[data-field="estado"]');
    const notesInput = article.querySelector('[data-field="notas"]');
    const saveStatus = article.querySelector('[data-role="save-status"]');
    let autoSaveTimer = null;
    let isSaving = false;
    let hasPendingSave = false;
    let clearStatusTimer = null;

    const setSaveStatus = (message, type = "") => {
        if (!saveStatus) {
            return;
        }

        if (clearStatusTimer) {
            window.clearTimeout(clearStatusTimer);
            clearStatusTimer = null;
        }

        saveStatus.textContent = message;
        saveStatus.classList.remove("is-saving", "is-saved", "is-error");

        if (type) {
            saveStatus.classList.add(type);
        }
    };

    const runAutoSave = async () => {
        if (isSaving) {
            hasPendingSave = true;
            return;
        }

        isSaving = true;
        hasPendingSave = false;
        setSaveStatus("Guardando...", "is-saving");

        try {
            await persistLeadUpdate(lead.id, {
                estado: statusSelect.value,
                notas: notesInput.value
            });
            setSaveStatus("Guardado", "is-saved");
            clearStatusTimer = window.setTimeout(() => {
                setSaveStatus("");
            }, 1800);
        } catch (error) {
            console.error(error);
            setSaveStatus("Error al guardar", "is-error");
            setCrmNotice("No se pudieron guardar los cambios de la solicitud.", "error");
        } finally {
            isSaving = false;

            if (hasPendingSave) {
                hasPendingSave = false;
                runAutoSave();
            }
        }
    };

    notesInput.value = typeof leadView.notas === "string" ? leadView.notas : "";

    const scheduleAutoSave = () => {
        if (autoSaveTimer) {
            window.clearTimeout(autoSaveTimer);
        }

        setSaveStatus("Guardando", "is-saving");
        autoSaveTimer = window.setTimeout(() => {
            autoSaveTimer = null;
            runAutoSave();
        }, 700);
    };

    statusSelect.addEventListener("change", () => {
        updateLeadDraft(lead.id, lead, {
            estado: statusSelect.value,
            notas: notesInput.value
        });
        runAutoSave();
    });

    notesInput.addEventListener("input", () => {
        updateLeadDraft(lead.id, lead, {
            estado: statusSelect.value,
            notas: notesInput.value
        });
        scheduleAutoSave();
    });

    statusSelect.addEventListener("blur", () => {
        flushDeferredRenderIfReady();
    });

    notesInput.addEventListener("blur", async () => {
        if (autoSaveTimer) {
            window.clearTimeout(autoSaveTimer);
            autoSaveTimer = null;
            await runAutoSave();
        }

        flushDeferredRenderIfReady();
    });

    if (deleteButton) {
        deleteButton.addEventListener("click", () => {
            openDeleteModal(lead);
        });
    }

    return article;
}

function renderLeads() {
    const filterValue = statusFilter.value;
    const filteredLeads = filterValue === "todos"
        ? allLeads
        : allLeads.filter(item => {
            const draft = leadDrafts.get(item.id);
            const effectiveStatus = draft?.estado || item.estado;
            return effectiveStatus === filterValue;
        });

    leadList.innerHTML = "";
    emptyState.hidden = filteredLeads.length !== 0;

    filteredLeads.forEach(lead => {
        leadList.appendChild(createLeadCard(lead));
    });

    updateMetrics(allLeads);
}

function subscribeToLeads() {
    if (unsubscribe) {
        unsubscribe();
    }

    unsubscribe = services.db.collection("consultas")
        .orderBy("createdAt", "desc")
        .onSnapshot(snapshot => {
            const addedLeads = snapshot.docChanges()
                .filter(change => change.type === "added")
                .map(change => ({
                    id: change.doc.id,
                    ...change.doc.data()
                }));

            allLeads = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            reconcileLeadDrafts(allLeads);

            if (initialSnapshotLoaded && addedLeads.length) {
                addedLeads.forEach(lead => notifyNewLead(lead));
            }

            initialSnapshotLoaded = true;
            if (hasActiveLeadEditor()) {
                pendingSnapshotRender = true;
                updateMetrics(allLeads);
                return;
            }

            pendingSnapshotRender = false;
            renderLeads();
        }, error => {
            console.error(error);
        alert("No se pudieron cargar las consultas. Revisa reglas e índices de Firestore.");
        });
}

if (!services || !services.auth || !services.db) {
    setLoginStatus("Firebase no está disponible. Revisa la configuración cargada.", "is-error");
} else {
    services.auth.onAuthStateChanged(user => {
        const loggedIn = Boolean(user);
        loginPanel.hidden = loggedIn;
        crmPanel.hidden = !loggedIn;

        if (loggedIn) {
            setLoginStatus("");
            setCrmNotice("");
            initialSnapshotLoaded = false;
            pendingSnapshotRender = false;
            leadDrafts.clear();
            updateNotificationButton();
            updateNotificationPanel();
            subscribeToLeads();
        } else {
            if (unsubscribe) {
                unsubscribe();
                unsubscribe = null;
            }

            initialSnapshotLoaded = false;
            pendingSnapshotRender = false;
            leadDrafts.clear();
        }
    });
}

if (loginForm && services && services.auth) {
    loginForm.addEventListener("submit", async event => {
        event.preventDefault();

        const loginValue = document.getElementById("adminLogin").value.trim();
        const password = document.getElementById("adminPassword").value;

        try {
            await services.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            const email = await resolveAdminEmail(loginValue);
            await services.auth.signInWithEmailAndPassword(email, password);
            setLoginStatus("Acceso correcto.", "is-success");
            loginForm.reset();
        } catch (error) {
            console.error(error);
            if (error.message === "username-not-found" || error.message === "username-without-email") {
                setLoginStatus("Ese usuario no existe o no tiene un correo asociado en Firestore.", "is-error");
                return;
            }

            if (error.message === "missing-login") {
                setLoginStatus("Escribe un usuario o correo para continuar.", "is-error");
                return;
            }

                setLoginStatus("No se pudo iniciar sesión. Verifica usuario, correo, contraseña y Auth.", "is-error");
        }
    });
}

if (logoutButton && services && services.auth) {
    logoutButton.addEventListener("click", async () => {
        await services.auth.signOut();
    });
}

if (notificationButton) {
    updateNotificationButton();
    updateNotificationPanel();

    notificationButton.addEventListener("click", async () => {
        if (!("Notification" in window)) {
            setCrmNotice("Este navegador no admite notificaciones del sistema.", "error");
            updateNotificationPanel();
            return;
        }

        if (Notification.permission === "granted") {
            notificationsEnabled = true;
            window.localStorage.setItem(NOTIFICATION_PREF_KEY, "true");
            updateNotificationButton();
            updateNotificationPanel();
            setCrmNotice("Las notificaciones quedaron activadas para nuevas solicitudes.", "success");
            return;
        }

        if (Notification.permission === "denied") {
            setCrmNotice("Las notificaciones están bloqueadas en el navegador. Debes habilitarlas manualmente.", "error");
            updateNotificationButton();
            updateNotificationPanel();
            return;
        }

        const permission = await Notification.requestPermission();
        notificationsEnabled = permission === "granted";
        window.localStorage.setItem(NOTIFICATION_PREF_KEY, notificationsEnabled ? "true" : "false");
        updateNotificationButton();
        updateNotificationPanel();

        if (notificationsEnabled) {
            setCrmNotice("Las notificaciones quedaron activadas para nuevas solicitudes.", "success");
        } else {
            setCrmNotice("No se concedió permiso para mostrar notificaciones.", "error");
        }
    });
}

if (cancelDeleteButton) {
    cancelDeleteButton.addEventListener("click", () => {
        closeDeleteModal();
    });
}

if (confirmDeleteButton) {
    confirmDeleteButton.addEventListener("click", async () => {
        if (!pendingDeleteLead) {
            closeDeleteModal();
            return;
        }

        confirmDeleteButton.disabled = true;
        confirmDeleteButton.textContent = "Eliminando...";

        try {
            await services.db.collection("consultas").doc(pendingDeleteLead.id).delete();
            closeDeleteModal();
        } catch (error) {
            console.error(error);
            setCrmNotice("No se pudo eliminar la solicitud.", "error");
        } finally {
            confirmDeleteButton.disabled = false;
            confirmDeleteButton.textContent = "Eliminar";
        }
    });
}

if (deleteModal) {
    deleteModal.addEventListener("click", event => {
        if (event.target.hasAttribute("data-close-delete-modal")) {
            closeDeleteModal();
        }
    });
}

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && deleteModal && !deleteModal.hidden) {
        closeDeleteModal();
    }
});

if (statusFilter) {
    statusFilter.addEventListener("change", renderLeads);
}
