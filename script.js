// Para GitHub Pages: depois que subir o backend, troque pela URL real da API.
// Exemplo: const API_URL = "https://api.seudominio.com/api";
const API_URL = "http://localhost:3000/api";

const screens = {
  login: document.getElementById("loginScreen"),
  register: document.getElementById("registerScreen"),
  home: document.getElementById("homeScreen"),
};

const state = {
  token: localStorage.getItem("epti_token"),
  user: JSON.parse(localStorage.getItem("epti_user") || "null"),
};

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");
}

function saveSession(token, user) {
  localStorage.setItem("epti_token", token);
  localStorage.setItem("epti_user", JSON.stringify(user));

  if (user?.minicurso) {
    localStorage.setItem("epti_minicurso", user.minicurso);
  }

  state.token = token;
  state.user = user;

  updateHomeUser();
  showScreen("home");
}

function clearSession() {
  localStorage.removeItem("epti_token");
  localStorage.removeItem("epti_user");
  localStorage.removeItem("epti_minicurso");

  state.token = null;
  state.user = null;

  showScreen("login");
}

function toast(message, type = "success") {
  const el = document.getElementById("toast");

  el.textContent = message;
  el.className = `toast ${type}`;

  setTimeout(() => {
    el.classList.add("hidden");
  }, 3600);
}

async function apiFetch(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || "Erro ao comunicar com o servidor.");
  }

  return data;
}

function validateInstitutionalEmail(email) {
  return email.trim().toLowerCase().endsWith("@aluno.ce.gov.br");
}

function getCurrentMinicurso() {
  return state.user?.minicurso || localStorage.getItem("epti_minicurso") || "";
}

function renderCurrentCourse(minicurso) {
  const currentCourse = document.getElementById("currentCourse");
  const openCoursesBtn = document.getElementById("openCoursesBtn");

  if (!currentCourse || !openCoursesBtn) return;

  if (minicurso) {
    currentCourse.classList.remove("hidden");
    currentCourse.innerHTML = `
      <strong>Minicurso escolhido:</strong>
      <span>${minicurso}</span>
    `;

    openCoursesBtn.textContent = "Mudar minicurso";
  } else {
    currentCourse.classList.add("hidden");
    currentCourse.innerHTML = "";

    openCoursesBtn.textContent = "Minicursos";
  }
}

function updateHomeUser() {
  const userName = document.getElementById("userName");

  if (!state.user) return;

  userName.textContent = `${state.user.nome || "Aluno(a)"} • ${state.user.turma || "Turma"}`;

  const minicursoAtual = getCurrentMinicurso();
  renderCurrentCourse(minicursoAtual);
}

async function restoreSession() {
  if (!state.token) {
    showScreen("login");
    return;
  }

  try {
    const data = await apiFetch("/me");

    const minicursoCache = localStorage.getItem("epti_minicurso");

    if (!data.user.minicurso && minicursoCache) {
      data.user.minicurso = minicursoCache;
    }

    saveSession(state.token, data.user);
  } catch (error) {
    clearSession();
  }
}

document.getElementById("goRegister").addEventListener("click", () => {
  showScreen("register");
});

document.getElementById("goLogin").addEventListener("click", () => {
  showScreen("login");
});

document.getElementById("logoutBtn").addEventListener("click", clearSession);

document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const senha = document.getElementById("loginSenha").value;

  if (!validateInstitutionalEmail(email)) {
    toast("Use seu email institucional @aluno.ce.gov.br.", "error");
    return;
  }

  try {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, senha }),
    });

    saveSession(data.token, data.user);
    toast("Login realizado com sucesso!");
  } catch (error) {
    toast(error.message, "error");
  }
});

document.getElementById("registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const nome = document.getElementById("registerNome").value.trim();
  const turma = document.getElementById("registerTurma").value;
  const email = document.getElementById("registerEmail").value.trim().toLowerCase();
  const senha = document.getElementById("registerSenha").value;

  if (!validateInstitutionalEmail(email)) {
    toast("O cadastro só aceita email @aluno.ce.gov.br.", "error");
    return;
  }

  try {
    const data = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        nome,
        turma,
        email,
        senha,
      }),
    });

    saveSession(data.token, data.user);
    toast("Cadastro criado e login realizado!");
  } catch (error) {
    toast(error.message, "error");
  }
});

const modal = document.getElementById("courseModal");

document.getElementById("openCoursesBtn").addEventListener("click", () => {
  modal.classList.remove("hidden");
});

document.getElementById("closeCoursesBtn").addEventListener("click", () => {
  modal.classList.add("hidden");
});

modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    modal.classList.add("hidden");
  }
});

document.querySelectorAll(".course-list button").forEach((button) => {
  button.addEventListener("click", async () => {
    const minicurso = button.dataset.course;

    if (!minicurso) {
      toast("Escolha um minicurso válido.", "error");
      return;
    }

    try {
      const data = await apiFetch("/minicursos/escolher", {
        method: "POST",
        body: JSON.stringify({ minicurso }),
      });

      const userAtualizado = data.user || {
        ...state.user,
        minicurso,
      };

      userAtualizado.minicurso = minicurso;

      localStorage.setItem("epti_minicurso", minicurso);
      localStorage.setItem("epti_user", JSON.stringify(userAtualizado));

      state.user = userAtualizado;

      renderCurrentCourse(minicurso);

      modal.classList.add("hidden");

      toast("Minicurso salvo com sucesso!");
    } catch (error) {
      console.error(error);

      toast(
        "Não foi possível mudar o minicurso. Talvez o backend ainda esteja bloqueando alteração.",
        "error"
      );
    }
  });
});

restoreSession();