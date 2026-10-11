
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// =======================================
// 1. FIREBASE CONFIGURATION
// Replace these example values with yours
// =======================================

const firebaseConfig = {
  apiKey: "AIzaSyBOrGkESMaK74FLw0GASsZm2NORMRl8ih4",
  authDomain: "everyday-count-todo-list.firebaseapp.com",
  projectId: "everyday-count-todo-list",
  storageBucket: "everyday-count-todo-list.firebasestorage.app",
  messagingSenderId: "7387479214",
  appId: "1:7387479214:web:b33eca9ca553ac07dc813f"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =======================================
// 2. GET HTML ELEMENTS
// =======================================

const authScreen = document.getElementById("authScreen");
const appScreen = document.getElementById("appScreen");

const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const authSubmit = document.getElementById("authSubmit");
const authMessage = document.getElementById("authMessage");

const nameGroup = document.getElementById("nameGroup");
const fullName = document.getElementById("fullName");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const switchAuth = document.getElementById("switchAuth");
const switchLabel = document.getElementById("switchLabel");

const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const avatar = document.getElementById("avatar");
const welcomeTitle = document.getElementById("welcomeTitle");
const logoutBtn = document.getElementById("logoutBtn");

const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const saveTaskBtn = document.getElementById("saveTaskBtn");
const saveIcon = document.getElementById("saveIcon");
const saveLabel = document.getElementById("saveLabel");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const taskList = document.getElementById("taskList");
const taskMessage = document.getElementById("taskMessage");

const totalCount = document.getElementById("totalCount");
const pendingCount = document.getElementById("pendingCount");
const completedCount = document.getElementById("completedCount");
const taskSummary = document.getElementById("taskSummary");
const todayDate = document.getElementById("todayDate");

// =======================================
// 3. APPLICATION STATE
// =======================================

let isRegisterMode = false;
let currentUser = null;
let tasks = [];
let currentFilter = "all";
let editingTaskId = null;
let unsubscribeTasks = null;
let authBusy = false;
let taskBusy = false;

todayDate.textContent = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric"
}).format(new Date());

// =======================================
// 4. HELPER FUNCTIONS
// =======================================

function showMessage(element, message, type = "error") {
  element.textContent = message;
  element.className = `message ${type}`;
}

function clearMessage(element) {
  element.textContent = "";
  element.className = "message";
}

function friendlyError(error) {
  const errors = {
    "auth/email-already-in-use":
      "This email is already registered. Please sign in.",
    "auth/invalid-email":
      "Please enter a valid email address.",
    "auth/weak-password":
      "Please use a stronger password with at least 6 characters.",
    "auth/invalid-credential":
      "Incorrect email or password.",
    "auth/user-not-found":
      "No account found. Please create an account first.",
    "auth/wrong-password":
      "Incorrect email or password.",
    "auth/too-many-requests":
      "Too many attempts. Please wait and try again.",
    "auth/network-request-failed":
      "Network error. Check your internet connection.",
    "permission-denied":
      "Firebase denied access. Please check your Firestore rules."
  };

  if (errors[error.code]) return errors[error.code];

  if (error.code === "permission-denied" ||
      error.message?.includes("Missing or insufficient permissions")) {
    return "Access denied. Check your Firestore security rules.";
  }

  console.error("Firebase error:", error);
  return "Something went wrong. Check your Firebase setup and try again.";
}

// =======================================
// 5. SWITCH BETWEEN LOGIN AND REGISTER
// =======================================

switchAuth.addEventListener("click", () => {
  isRegisterMode = !isRegisterMode;

  authTitle.textContent = isRegisterMode
    ? "Create your account"
    : "Welcome back";

  authSubtitle.textContent = isRegisterMode
    ? "Sign up to start organizing your tasks."
    : "Sign in to continue to your workspace.";

  authSubmit.textContent = isRegisterMode
    ? "Create Account"
    : "Sign In";

  switchLabel.textContent = isRegisterMode
    ? "Already have an account?"
    : "Don't have an account?";

  switchAuth.textContent = isRegisterMode
    ? "Sign in"
    : "Create account";

  nameGroup.classList.toggle("hidden", !isRegisterMode);
  fullName.required = isRegisterMode;

  passwordInput.autocomplete = isRegisterMode
    ? "new-password"
    : "current-password";

  clearMessage(authMessage);
});

// =======================================
// 6. REGISTER OR LOG IN
// =======================================

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (authBusy) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const name = fullName.value.trim();

  if (isRegisterMode && !name) {
    showMessage(authMessage, "Please enter your full name.");
    fullName.focus();
    return;
  }

  authBusy = true;
  authSubmit.disabled = true;
  authSubmit.textContent = isRegisterMode
    ? "Creating account..."
    : "Signing in...";

  clearMessage(authMessage);

  try {
    if (isRegisterMode) {
      const credential = await createUserWithEmailAndPassword(
        auth, email, password
      );

      await updateProfile(credential.user, {
        displayName: name
      });

      // The authentication listener opens the dashboard.
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (error) {
    showMessage(authMessage, friendlyError(error));
  } finally {
    authBusy = false;
    authSubmit.disabled = false;
    authSubmit.textContent = isRegisterMode
      ? "Create Account"
      : "Sign In";
  }
});

// =======================================
// 7. WATCH LOGIN STATUS
// =======================================

onAuthStateChanged(auth, (user) => {
  currentUser = user;

  if (unsubscribeTasks) {
    unsubscribeTasks();
    unsubscribeTasks = null;
  }

  tasks = [];
  editingTaskId = null;
  currentFilter = "all";
  resetTaskForm();
  clearMessage(taskMessage);

  if (user) {
    authScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");

    const name = user.displayName ||
      user.email?.split("@")[0] || "User";

    userName.textContent = name;
    userEmail.textContent = user.email || "";
    avatar.textContent = name.charAt(0).toUpperCase();
    welcomeTitle.textContent = `Hello, ${name.split(" ")[0]}!`;

    listenToTasks(user.uid);
  } else {
    appScreen.classList.add("hidden");
    authScreen.classList.remove("hidden");
    taskList.replaceChildren();
  }
});

// =======================================
// 8. FIRESTORE: READ TASKS IN REAL TIME
// =======================================

function listenToTasks(uid) {
  taskList.innerHTML =
    '<div class="loading">Loading your tasks...</div>';

  // Every user sees only their own tasks.
  const tasksQuery = query(
    collection(db, "tasks"),
    where("uid", "==", uid)
  );

  unsubscribeTasks = onSnapshot(
    tasksQuery,
    (snapshot) => {
      tasks = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));

      // Newest tasks first; no extra index is needed.
      tasks.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      renderTasks();
    },
    (error) => {
      console.error("Loading tasks failed:", error);
      taskList.replaceChildren();

      showMessage(
        taskMessage,
        friendlyError(error)
      );
    }
  );
}

// =======================================
// 9. ADD OR UPDATE A TASK
// =======================================

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser || taskBusy) return;

  const title = taskInput.value.trim();

  if (!title) {
    showMessage(taskMessage, "Please enter a task.");
    return;
  }

  if (title.length > 200) {
    showMessage(taskMessage, "Tasks cannot exceed 200 characters.");
    return;
  }

  taskBusy = true;
  saveTaskBtn.disabled = true;
  clearMessage(taskMessage);

  try {
    if (editingTaskId) {
      // UPDATE an existing Firestore document.
      const taskRef = doc(db, "tasks", editingTaskId);

      await updateDoc(taskRef, {
        title: title,
        updatedAt: serverTimestamp()
      });

      resetTaskForm();
      showMessage(taskMessage, "Task updated successfully.", "success");
    } else {
      // CREATE a new Firestore document.
      await addDoc(collection(db, "tasks"), {
        title: title,
        completed: false,
        uid: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      taskInput.value = "";
      showMessage(taskMessage, "Task added successfully.", "success");
    }

    taskInput.focus();
  } catch (error) {
    showMessage(taskMessage, friendlyError(error));
  } finally {
    taskBusy = false;
    saveTaskBtn.disabled = false;
  }
});

// =======================================
// 10. EDIT A TASK
// =======================================

function startEdit(task) {
  if (!currentUser || task.uid !== currentUser.uid) return;

  editingTaskId = task.id;
  taskInput.value = task.title || "";

  saveIcon.textContent = "✓";
  saveLabel.textContent = "Update Task";
  cancelEditBtn.classList.remove("hidden");

  clearMessage(taskMessage);
  taskInput.focus();
  taskInput.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

function resetTaskForm() {
  editingTaskId = null;
  taskInput.value = "";
  saveIcon.textContent = "+";
  saveLabel.textContent = "Add Task";
  cancelEditBtn.classList.add("hidden");
  saveTaskBtn.disabled = false;
}

cancelEditBtn.addEventListener("click", () => {
  resetTaskForm();
  clearMessage(taskMessage);
});

// =======================================
// 11. COMPLETE OR DELETE A TASK
// =======================================

async function toggleTask(task) {
  if (!currentUser || task.uid !== currentUser.uid) return;

  try {
    await updateDoc(doc(db, "tasks", task.id), {
      completed: !task.completed,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    showMessage(taskMessage, friendlyError(error));
  }
}

async function removeTask(task) {
  if (!currentUser || task.uid !== currentUser.uid) return;

  const confirmed = window.confirm(
    `Are you sure you want to delete "${task.title}"?`
  );

  if (!confirmed) return;

  try {
    if (editingTaskId === task.id) {
      resetTaskForm();
    }

    await deleteDoc(doc(db, "tasks", task.id));
    showMessage(taskMessage, "Task deleted successfully.", "success");
  } catch (error) {
    showMessage(taskMessage, friendlyError(error));
  }
}

// =======================================
// 12. FILTER TASKS
// =======================================

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;

    document.querySelectorAll(".filter").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    renderTasks();
  });
});

// =======================================
// 13. DISPLAY TASKS ON THE PAGE
// =======================================

function renderTasks() {
  totalCount.textContent = tasks.length;
  pendingCount.textContent =
    tasks.filter((task) => !task.completed).length;
  completedCount.textContent =
    tasks.filter((task) => task.completed).length;

  const filteredTasks = tasks.filter((task) => {
    if (currentFilter === "pending") return !task.completed;
    if (currentFilter === "completed") return task.completed;
    return true;
  });

  taskSummary.textContent =
    `${filteredTasks.length} ${
      filteredTasks.length === 1 ? "task" : "tasks"
    }`;

  taskList.replaceChildren();

  if (filteredTasks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const heading = document.createElement("strong");
    heading.textContent = currentFilter === "completed"
      ? "No completed tasks yet"
      : currentFilter === "pending"
      ? "You're all caught up!"
      : "Your task list is empty";

    const description = document.createElement("span");
    description.textContent = currentFilter === "all"
      ? "Add your first task above to get started."
      : "Try another filter or add a new task.";

    empty.append(heading, description);
    taskList.appendChild(empty);
    return;
  }

  filteredTasks.forEach((task) => {
    const row = document.createElement("article");
    row.className = "task-item";
    if (task.completed) row.classList.add("completed");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-check";
    checkbox.checked = Boolean(task.completed);
    checkbox.setAttribute("aria-label", "Mark task completed");
    checkbox.addEventListener("change", () => toggleTask(task));

    const details = document.createElement("div");
    details.className = "task-details";

    const title = document.createElement("div");
    title.className = "task-title";
    title.textContent = task.title || "";

    const meta = document.createElement("div");
    meta.className = "task-meta";
    meta.textContent = task.completed ? "Completed" : "In progress";

    details.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "action-btn edit-btn";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => startEdit(task));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "action-btn delete-btn";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => removeTask(task));

    actions.append(editButton, deleteButton);
    row.append(checkbox, details, actions);
    taskList.appendChild(row);
  });
}

// =======================================
// 14. LOG OUT
// =======================================

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    showMessage(taskMessage, friendlyError(error));
  }
});
