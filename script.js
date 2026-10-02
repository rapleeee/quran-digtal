const API_BASE = "https://equran.id/api/v2";

const state = {
  surahs: [],
  selectedSurah: null,
  mode: "guess",
  score: 0,
  currentQuestion: null,
};

const elements = {
  tabs: document.querySelectorAll(".tab"),
  views: document.querySelectorAll(".view"),
  listStatus: document.querySelector("#surah-list-status"),
  surahSearch: document.querySelector("#surah-search"),
  surahList: document.querySelector("#surah-list"),
  readingEmpty: document.querySelector("#reading-empty"),
  readingContent: document.querySelector("#reading-content"),
  readingStatus: document.querySelector("#reading-status"),
  surahMeta: document.querySelector("#surah-meta"),
  surahTitle: document.querySelector("#surah-title"),
  surahMeaning: document.querySelector("#surah-meaning"),
  verseList: document.querySelector("#verse-list"),
  mentorEmpty: document.querySelector("#mentor-empty"),
  mentorContent: document.querySelector("#mentor-content"),
  mentorSurahName: document.querySelector("#mentor-surah-name"),
  score: document.querySelector("#score"),
  modeButtons: document.querySelectorAll(".mode-button"),
  mentorWarning: document.querySelector("#mentor-warning"),
  quizCard: document.querySelector("#quiz-card"),
  quizLabel: document.querySelector("#quiz-label"),
  questionArabic: document.querySelector("#question-arabic"),
  questionPrompt: document.querySelector("#question-prompt"),
  answerOptions: document.querySelector("#answer-options"),
  feedback: document.querySelector("#feedback"),
  nextQuestion: document.querySelector("#next-question"),
  restartQuiz: document.querySelector("#restart-quiz"),
};

function setStatus(element, message) {
  element.textContent = message;
}

async function fetchData(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`Permintaan gagal (${response.status})`);
  const payload = await response.json();
  if (!payload || !payload.data) throw new Error("Respons API tidak berisi data.");
  return payload.data;
}

async function loadSurahs() {
  setStatus(elements.listStatus, "Memuat daftar surat...");
  try {
    state.surahs = await fetchData("/surat");
    renderSurahList(state.surahs);
    setStatus(elements.listStatus, `${state.surahs.length} surat tersedia`);
  } catch (error) {
    setStatus(elements.listStatus, "Daftar surat tidak dapat dimuat.");
    elements.surahList.innerHTML = `<p class="notice">Periksa jaringan Anda, lalu muat ulang halaman.</p>`;
  }
}

function renderSurahList(surahs) {
  if (!surahs.length) {
    elements.surahList.innerHTML = "<p class='status'>Surat tidak ditemukan.</p>";
    return;
  }
  elements.surahList.innerHTML = "";
  surahs.forEach((surah) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "surah-item";
    button.dataset.number = surah.nomor;
    button.innerHTML = `<span class="surah-number">${surah.nomor}</span><span><span class="surah-latin">${surah.namaLatin}</span><span class="surah-info">${surah.jumlahAyat} ayat · ${surah.arti}</span></span><span class="surah-arabic" dir="rtl" lang="ar">${surah.nama}</span>`;
    button.addEventListener("click", () => loadSurah(surah.nomor));
    elements.surahList.append(button);
  });
}

async function loadSurah(number) {
  elements.readingEmpty.hidden = true;
  elements.readingContent.hidden = false;
  elements.verseList.innerHTML = "";
  setStatus(elements.readingStatus, "Memuat ayat surat...");
  try {
    const surah = await fetchData(`/surat/${number}`);
    state.selectedSurah = surah;
    markSelectedSurah(number);
    renderSurah(surah);
    updateMentorAvailability();
  } catch (error) {
    state.selectedSurah = null;
    setStatus(elements.readingStatus, "Ayat tidak dapat dimuat. Periksa jaringan lalu coba pilih surat kembali.");
    updateMentorAvailability();
  }
}

function markSelectedSurah(number) {
  document.querySelectorAll(".surah-item").forEach((item) => {
    item.classList.toggle("is-selected", Number(item.dataset.number) === number);
  });
}

function renderSurah(surah) {
  elements.surahMeta.textContent = `Surat ke-${surah.nomor} · ${surah.tempatTurun}`;
  elements.surahTitle.textContent = `${surah.namaLatin} — ${surah.nama}`;
  elements.surahMeaning.textContent = `${surah.arti} · ${surah.jumlahAyat} ayat`;
  setStatus(elements.readingStatus, "");
  elements.verseList.innerHTML = "";
  surah.ayat.forEach((verse) => {
    const article = document.createElement("article");
    article.className = "verse";
    const translation = verse.teksIndonesia ? `<p class="translation">${verse.teksIndonesia}</p>` : "";
    article.innerHTML = `<span class="verse-number">${verse.nomorAyat}</span><p class="arabic" dir="rtl" lang="ar">${verse.teksArab}</p>${translation}`;
    elements.verseList.append(article);
  });
}

function showView(viewId) {
  elements.tabs.forEach((tab) => {
    const active = tab.dataset.view === viewId;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active);
  });
  elements.views.forEach((view) => {
    const active = view.id === viewId;
    view.classList.toggle("is-active", active);
    view.hidden = !active;
  });
  if (viewId === "mentor-view") updateMentorAvailability();
}

function updateMentorAvailability() {
  const hasSurah = Boolean(state.selectedSurah);
  elements.mentorEmpty.hidden = hasSurah;
  elements.mentorContent.hidden = !hasSurah;
  if (!hasSurah) return;
  elements.mentorSurahName.textContent = state.selectedSurah.namaLatin;
  createQuestion();
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffled(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function getDistinctDistractors(verses, correctVerse, amount) {
  return shuffled(verses.filter((verse) => verse.nomorAyat !== correctVerse.nomorAyat)).slice(0, amount);
}

function createQuestion() {
  const verses = state.selectedSurah.ayat;
  if (verses.length < 4) {
    elements.mentorWarning.hidden = false;
    elements.mentorWarning.textContent = "Surat ini memiliki kurang dari empat ayat. Pilih surat lain agar tiga pilihan jawaban dapat dibuat tanpa ambigu.";
    elements.quizCard.hidden = true;
    return;
  }
  elements.mentorWarning.hidden = true;
  elements.quizCard.hidden = false;
  const eligibleVerses = state.mode === "continue" ? verses.slice(0, -1) : verses;
  const sourceVerse = randomItem(eligibleVerses);
  const correctVerse = state.mode === "continue" ? verses.find((verse) => verse.nomorAyat === sourceVerse.nomorAyat + 1) : sourceVerse;
  const options = shuffled([correctVerse, ...getDistinctDistractors(verses, correctVerse, 2)]);
  state.currentQuestion = { correctNumber: correctVerse.nomorAyat, answered: false };
  renderQuestion(sourceVerse, options);
}

function renderQuestion(sourceVerse, options) {
  const continuing = state.mode === "continue";
  elements.quizLabel.textContent = continuing ? "Mode Sambung Ayat" : "Mode Tebak Ayat";
  elements.questionArabic.textContent = sourceVerse.teksArab;
  elements.questionPrompt.textContent = continuing ? "Pilih ayat yang tepat setelah ayat di atas." : "Ayat ke berapakah teks di atas?";
  elements.answerOptions.innerHTML = "";
  elements.feedback.textContent = "";
  elements.feedback.className = "feedback";
  elements.nextQuestion.disabled = true;
  options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = continuing ? "answer-option arabic-option" : "answer-option";
    button.dataset.number = option.nomorAyat;
    button.textContent = continuing ? option.teksArab : `Ayat ${option.nomorAyat}`;
    if (continuing) {
      button.dir = "rtl";
      button.lang = "ar";
    }
    button.addEventListener("click", () => answerQuestion(button));
    elements.answerOptions.append(button);
  });
}

function answerQuestion(selectedButton) {
  if (state.currentQuestion.answered) return;
  state.currentQuestion.answered = true;
  const isCorrect = Number(selectedButton.dataset.number) === state.currentQuestion.correctNumber;
  document.querySelectorAll(".answer-option").forEach((button) => {
    button.disabled = true;
    if (Number(button.dataset.number) === state.currentQuestion.correctNumber) button.classList.add("is-correct");
  });
  if (isCorrect) {
    state.score += 10;
    elements.score.textContent = state.score;
    elements.feedback.textContent = "Benar! Skor bertambah 10.";
    elements.feedback.classList.add("correct");
  } else {
    selectedButton.classList.add("is-wrong");
    elements.feedback.textContent = "Belum tepat. Jawaban yang benar ditandai hijau.";
    elements.feedback.classList.add("wrong");
  }
  elements.nextQuestion.disabled = false;
}

elements.tabs.forEach((tab) => tab.addEventListener("click", () => showView(tab.dataset.view)));
elements.surahSearch.addEventListener("input", (event) => {
  const keyword = event.target.value.trim().toLowerCase();
  renderSurahList(state.surahs.filter((surah) => `${surah.namaLatin} ${surah.nama} ${surah.nomor}`.toLowerCase().includes(keyword)));
});
elements.modeButtons.forEach((button) => button.addEventListener("click", () => {
  state.mode = button.dataset.mode;
  elements.modeButtons.forEach((item) => item.classList.toggle("is-active", item === button));
  createQuestion();
}));
elements.nextQuestion.addEventListener("click", createQuestion);
elements.restartQuiz.addEventListener("click", () => { state.score = 0; elements.score.textContent = 0; createQuestion(); });
document.querySelector("#go-to-quran").addEventListener("click", () => showView("quran-view"));

loadSurahs();