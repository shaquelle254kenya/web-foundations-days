let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

const CATEGORIES = ["personal", "work", "study"];

// Helper: lower-case, trim, and collapse repeated spaces
function normalise(text) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

// 1. Notes whose text contains the word (ignoring case)
function searchNotes(word) {
  const target = word.toLowerCase();
  return notes.filter((note) => note.text.toLowerCase().includes(target));
}

// 2. Note with the most characters, or null if there are none
function longestNote() {
  if (notes.length === 0) {
    return null;
  }
  let longest = notes[0];
  for (const note of notes) {
    if (note.text.length > longest.text.length) {
      longest = note;
    }
  }
  return longest;
}

// 3. Count of notes per category
function countByCategory() {
  const counts = {};
  for (const note of notes) {
    if (counts[note.category]) {
      counts[note.category] += 1;
    } else {
      counts[note.category] = 1;
    }
  }
  return counts;
}

// 4. Sentence summary of all notes
function getSummary() {
  const total = notes.length;
  const word = total === 1 ? "note" : "notes";
  if (total === 0) {
    return "0 notes.";
  }
  const counts = countByCategory();
  const parts = [];
  for (const category of CATEGORIES) {
    if (counts[category]) {
      parts.push(`${counts[category]} ${category}`);
    }
  }
  return `${total} ${word}: ${parts.join(", ")}.`;
}

// 5. True if a note with the same text already exists
function isDuplicate(text) {
  const target = normalise(text);
  return notes.some((note) => normalise(note.text) === target);
}

// 6. Add a note if it passes all checks
function addNote(text, category) {
  const clean = text.trim();
  if (clean.length < 1 || clean.length > 200) {
    console.log("Not added: text must be 1-200 characters.");
    return false;
  }
  if (isDuplicate(clean)) {
    console.log("Not added: duplicate note.");
    return false;
  }
  if (!CATEGORIES.includes(category)) {
    console.log("Not added: category must be personal, work or study.");
    return false;
  }
  const nextId = notes.length > 0 ? notes[notes.length - 1].id + 1 : 1;
  notes.push({ id: nextId, text: clean, category: category });
  return true;
}

// ---------------- TESTS ----------------

// searchNotes
console.log(searchNotes("the").map((n) => n.text));
// Expected: [ "Finish the Day 3 assignment", "Email the project report to Grace" ]
console.log(searchNotes("MILK").map((n) => n.text));
// Expected: [ "Buy milk and bread" ]  (ignores upper/lower case)
console.log(searchNotes("zebra"));
// Expected: []  (no results)

// longestNote
console.log(longestNote().text);
// Expected: "Email the project report to Grace"

// countByCategory
console.log(countByCategory());
// Expected: { personal: 2, study: 2, work: 1 }

// getSummary
console.log(getSummary());
// Expected: "5 notes: 2 personal, 1 work, 2 study."

// isDuplicate
console.log(isDuplicate("  call   MUM  "));
// Expected: true  (ignores case and extra spaces)
console.log(isDuplicate("Call dad"));
// Expected: false

// Edge cases with fewer notes (temporarily swap the array)
const backup = notes;

notes = [];
console.log(longestNote());
// Expected: null
console.log(countByCategory());
// Expected: {}
console.log(getSummary());
// Expected: "0 notes."

notes = [backup[0]];
console.log(getSummary());
// Expected: "1 note: 1 personal."
console.log(longestNote().text);
// Expected: "Buy milk and bread"

notes = backup; // restore the original notes

// addNote (the reason is logged first, then the true/false result)
console.log(addNote("Pay school fees", "personal"));
// Expected: true
console.log(addNote("call mum", "personal"));
// Expected: "Not added: duplicate note." then false
console.log(addNote("   ", "work"));
// Expected: "Not added: text must be 1-200 characters." then false
console.log(addNote("x".repeat(201), "work"));
// Expected: "Not added: text must be 1-200 characters." then false
console.log(addNote("Learn CSS grid", "hobby"));
// Expected: "Not added: category must be personal, work or study." then false
console.log(addNote("Learn CSS grid", "study"));
// Expected: true

console.log(getSummary());
// Expected: "7 notes: 3 personal, 1 work, 3 study."
