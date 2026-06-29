const LOGIN_API_URL = "https://news-portal-hvgs.onrender.com/api/token/";
const DEFAULT_LOGIN_SUCCESS_REDIRECT = "/profile/";
const REDIRECT_DELAY = 1500;

const form = document.getElementById("loginForm");
const submitBtn = document.getElementById("submitBtn");
const formMessage = document.getElementById("formMessage");

const fields = {
    email: document.getElementById("email"),
    password: document.getElementById("password"),
};

const errors = {
    email: document.getElementById("emailError"),
    password: document.getElementById("passwordError"),
};

function setFieldError(fieldName, message) {
    const input = fields[fieldName];
    const group = input.closest(".form-group");

    errors[fieldName].textContent = message || "";
    group.classList.toggle("invalid", Boolean(message));
}

function clearErrors() {
    Object.keys(errors).forEach((fieldName) => setFieldError(fieldName, ""));
}

function showFormMessage(message, type) {
    formMessage.textContent = message;
    formMessage.className = message ? `form-message ${type}` : "form-message";
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateForm() {
    let isValid = true;
    const email = fields.email.value.trim();
    const password = fields.password.value;

    clearErrors();
    showFormMessage("", "");

    if (!email) {
        setFieldError("email", "Email is required.");
        isValid = false;
    } else if (!isValidEmail(email)) {
        setFieldError("email", "Enter a valid email address.");
        isValid = false;
    }

    if (!password) {
        setFieldError("password", "Password is required.");
        isValid = false;
    }

    return isValid;
}

function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle("loading", isLoading);
    submitBtn.querySelector(".btn-text").textContent = isLoading ? "Signing In..." : "Login";
}

function getBackendMessage(data) {
    if (!data) {
        return "Login failed. Please check your credentials and try again.";
    }

    if (typeof data === "string") {
        return data;
    }

    if (data.detail) {
        return Array.isArray(data.detail) ? data.detail.join(" ") : data.detail;
    }

    return Object.entries(data)
        .map(([field, value]) => {
            const message = Array.isArray(value) ? value.join(" ") : String(value);
            return `${field.replace(/_/g, " ")}: ${message}`;
        })
        .join(" ") || "Login failed. Please try again.";
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!validateForm()) {
        return;
    }

    const payload = {
        email: fields.email.value.trim(),
        password: fields.password.value,
    };

    setLoading(true);

    try {
        // Sends credentials to the Django REST Framework JWT endpoint and stores returned tokens.
        const response = await fetch(LOGIN_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            showFormMessage(getBackendMessage(data), "error");
            return;
        }
        if (window.NewsPortalSession) {
            window.NewsPortalSession.storeTokens(data);
        } else {
            localStorage.removeItem("news_portal_auth_invalid");
            localStorage.setItem("accessToken", data.access);
            localStorage.setItem("refreshToken", data.refresh);
            localStorage.setItem("access_token", data.access);
            localStorage.setItem("refresh_token", data.refresh);
        }

        let redirectTo = DEFAULT_LOGIN_SUCCESS_REDIRECT;
        try {
            const user = window.NewsPortalSession ? await window.NewsPortalSession.fetchCurrentUser() : null;
            redirectTo = window.NewsPortalSession?.getDashboardPath(user) || DEFAULT_LOGIN_SUCCESS_REDIRECT;
        } catch {
            redirectTo = DEFAULT_LOGIN_SUCCESS_REDIRECT;
        }

        form.reset();
        clearErrors();
        showFormMessage("Login successful. Redirecting...", "success");

        window.setTimeout(() => {
            window.location.href = redirectTo;
        }, REDIRECT_DELAY);
    } catch (error) {
        showFormMessage("Unable to connect to the server. Please try again later.", "error");
    } finally {
        setLoading(false);
    }
});

Object.values(fields).forEach((field) => {
    field.addEventListener("input", () => {
        setFieldError(field.name, "");
        showFormMessage("", "");
    });
});
