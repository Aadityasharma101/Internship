const LOGIN_API_URL = "/auth/login/";
const LOGIN_SUCCESS_REDIRECT = "/";
const REDIRECT_DELAY = 1500;

const form = document.getElementById("loginForm");
const submitBtn = document.getElementById("submitBtn");
const formMessage = document.getElementById("formMessage");

if (!form) {
    console.warn('Login form not found — login.js will not attach handlers.');
}

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

if (form) {
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

        // Server saved tokens in session. The response may include a `next` URL.
        form.reset();
        clearErrors();
        showFormMessage("Login successful. Redirecting...", "success");

        const nextUrl = (data && data.next) ? data.next : LOGIN_SUCCESS_REDIRECT;
        window.setTimeout(() => {
            window.location.href = nextUrl;
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
} else {
    // If form element not present, attempt to find the submit button and allow native submit
    if (submitBtn) {
        submitBtn.addEventListener('click', () => {
            console.warn('Submit clicked but login form not initialized by JS. Falling back to native POST.');
        });
    }
}
