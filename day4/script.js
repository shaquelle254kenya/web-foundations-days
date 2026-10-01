const textarea = document.getElementById("note-text");
const charCount = document.getElementById("char-count");
const wordCount = document.getElementById("word-count");
const clearBtn = document.getElementById("clear-btn");
const themeToggle = document.getElementById("theme-toggle");

const MAX_CHARS = 200;
const WARNING_AT = 180;
const DRAFT_KEY = "draft";
const THEME_KEY = "theme";

// Update both counters and the warning/over classes
function updateCounts() {
  const text = textarea.value;
  const chars = text.length;
  const trimmed = text.trim();
  const words = trimmed === "" ? 0 : trimmed.split(/\s+/).length;

  charCount.textContent = `${chars} / ${MAX_CHARS} characters`;
  wordCount.textContent = `${words} words`;

  charCount.classList.remove("warning", "over");
  if (chars > MAX_CHARS) {
    charCount.classList.add("over");
  } else if (chars > WARNING_AT) {
    charCount.classList.add("warning");
  }
}

function saveDraft() {
  localStorage.setItem(DRAFT_KEY, textarea.value);
}

// Empty the textarea, reset the counters and remove the draft
function clearAll() {
  textarea.value = "";
  localStorage.removeItem(DRAFT_KEY);
  updateCounts();
  textarea.focus();
}

// Apply the theme and set the button label to match
function applyTheme(isDark) {
  document.body.classList.toggle("dark", isDark);
  themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
}

// On every input: update counters and save the draft
textarea.addEventListener("input", function () {
  updateCounts();
  saveDraft();
});

// Escape inside the textarea clears it
textarea.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    clearAll();
  }
});

clearBtn.addEventListener("click", clearAll);

themeToggle.addEventListener("click", function () {
  const isDark = !document.body.classList.contains("dark");
  applyTheme(isDark);
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
});

// On page load: restore draft and theme, then update the counters
const savedDraft = localStorage.getItem(DRAFT_KEY);
if (savedDraft !== null) {
  textarea.value = savedDraft;
}
applyTheme(localStorage.getItem(THEME_KEY) === "dark");
updateCounts();
