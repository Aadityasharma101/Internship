const API_URL = "https://news-portal-hvgs.onrender.com/api/users/";
const LOGIN_URL = "/login/";
const REDIRECT_DELAY = 2500;
const PASSWORD_MIN_LENGTH = 8;

const form = document.getElementById("registerForm");
const submitBtn = document.getElementById("submitBtn");
const formMessage = document.getElementById("formMessage");

const fields = {
    username: document.getElementById("username"),
    email: document.getElementById("email"),
    password: document.getElementById("password"),
    confirmPassword: document.getElementById("confirmPassword"),
};

const errors = {
    username: document.getElementById("usernameError"),
    email: document.getElementById("emailError"),
    password: document.getElementById("passwordError"),
    confirmPassword: document.getElementById("confirmPasswordError"),
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
    const username = fields.username.value.trim();
    const email = fields.email.value.trim();
    const password = fields.password.value;
    const confirmPassword = fields.confirmPassword.value;

    clearErrors();
    showFormMessage("", "");

    if (!username) {
        setFieldError("username", "Username is required.");
        isValid = false;
    }

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
    } else if (password.length < PASSWORD_MIN_LENGTH) {
        setFieldError("password", `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
        isValid = false;
    }

    if (!confirmPassword) {
        setFieldError("confirmPassword", "Please confirm your password.");
        isValid = false;
    } else if (confirmPassword !== password) {
        setFieldError("confirmPassword", "Passwords do not match.");
        isValid = false;
    }

    return isValid;
}

function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle("loading", isLoading);
    submitBtn.querySelector(".btn-text").textContent = isLoading ? "Creating Account..." : "Create Account";
}

function formatBackendMessage(data) {
    if (!data) {
        return "Registration failed. Please check your details and try again.";
    }

    if (typeof data === "string") {
        return data;
    }

    if (data.detail) {
        return Array.isArray(data.detail) ? data.detail.join(" ") : data.detail;
    }

    const messages = [];

    Object.entries(data).forEach(([field, value]) => {
        const fieldMessage = Array.isArray(value) ? value.join(" ") : String(value);
        const readableField = field.replace(/_/g, " ");

        messages.push(`${readableField}: ${fieldMessage}`);

        if (field === "username" || field === "email" || field === "password") {
            setFieldError(field, fieldMessage);
        }
    });

    return messages.join(" ") || "Registration failed. Please try again.";
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!validateForm()) {
        return;
    }

    const payload = {
        username: fields.username.value.trim(),
        first_name: fields.username.value.trim(),
        email: fields.email.value.trim(),
        password: fields.password.value,
        password2: fields.confirmPassword.value,
    };

    setLoading(true);

    try {
        // Connects to the Django REST Framework registration endpoint using a JSON POST request.
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            const backendMessage = formatBackendMessage(data);
            showFormMessage(backendMessage, "error");
            return;
        }

        form.reset();
        clearErrors();
        showFormMessage("Registration successful. Redirecting to login...", "success");

        window.setTimeout(() => {
            window.location.href = LOGIN_URL;
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
