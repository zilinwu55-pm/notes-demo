(function () {
  const STORAGE_KEY = "two-pane-notes";

  const sampleNotes = [
    {
      id: "welcome",
      title: "欢迎使用双栏笔记",
      body: "左侧管理笔记，右侧编辑内容。标题和正文会自动保存到浏览器本地。",
      updatedAt: "2026-07-04T09:00:00.000Z",
    },
    {
      id: "ideas",
      title: "今日灵感",
      body: "可以把会议纪要、读书摘录、待办想法都放在这里。",
      updatedAt: "2026-07-04T09:05:00.000Z",
    },
  ];

  function createNote(now = new Date()) {
    return {
      id: `note-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      title: "未命名笔记",
      body: "",
      updatedAt: now.toISOString(),
    };
  }

  function normalizeNote(note) {
    return {
      id: String(note.id || ""),
      title: String(note.title || "未命名笔记"),
      body: String(note.body || ""),
      updatedAt: note.updatedAt || new Date().toISOString(),
    };
  }

  function sortNotes(notes) {
    return [...notes].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  function filterNotes(notes, query) {
    const term = query.trim().toLowerCase();
    if (!term) return sortNotes(notes);
    return sortNotes(
      notes.filter((note) => {
        return `${note.title} ${note.body}`.toLowerCase().includes(term);
      }),
    );
  }

  function updateNote(notes, id, changes, now = new Date()) {
    return notes.map((note) => {
      if (note.id !== id) return note;
      return normalizeNote({
        ...note,
        ...changes,
        updatedAt: now.toISOString(),
      });
    });
  }

  function deleteNote(notes, id) {
    return notes.filter((note) => note.id !== id);
  }

  function countWords(text) {
    const compact = text.trim();
    if (!compact) return 0;
    const chineseChars = compact.match(/[\u4e00-\u9fff]/g) || [];
    const otherWords = compact
      .replace(/[\u4e00-\u9fff]/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return chineseChars.length + otherWords.length;
  }

  function loadNotes(storage) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return sampleNotes.map(normalizeNote);
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return sampleNotes.map(normalizeNote);
      return parsed.map(normalizeNote);
    } catch (_error) {
      return sampleNotes.map(normalizeNote);
    }
  }

  function saveNotes(storage, notes) {
    storage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function getPreview(body) {
    return body.trim() || "暂无正文";
  }

  function initApp(documentRef = document, storage = window.localStorage) {
    const elements = {
      addNote: documentRef.getElementById("addNote"),
      deleteNote: documentRef.getElementById("deleteNote"),
      noteList: documentRef.getElementById("noteList"),
      searchInput: documentRef.getElementById("searchInput"),
      titleInput: documentRef.getElementById("titleInput"),
      bodyInput: documentRef.getElementById("bodyInput"),
      saveStatus: documentRef.getElementById("saveStatus"),
      wordCount: documentRef.getElementById("wordCount"),
      editor: documentRef.getElementById("editor"),
      emptyState: documentRef.getElementById("emptyState"),
    };

    let notes = loadNotes(storage);
    let activeId = sortNotes(notes)[0]?.id || null;

    function persist() {
      saveNotes(storage, notes);
      elements.saveStatus.textContent = "已保存";
    }

    function revealEditor() {
      if (typeof elements.editor.scrollIntoView === "function") {
        elements.editor.scrollIntoView({
          behavior: "smooth",
          block: "start",
          inline: "nearest",
        });
      }
    }

    function selectNote(id, options = {}) {
      if (!notes.some((note) => note.id === id)) return;
      activeId = id;
      render();
      if (options.reveal) revealEditor();
    }

    function renderList() {
      const visibleNotes = filterNotes(notes, elements.searchInput.value);
      elements.noteList.innerHTML = "";

      if (visibleNotes.length === 0) {
        const empty = documentRef.createElement("p");
        empty.className = "note-preview";
        empty.textContent = "没有匹配的笔记";
        elements.noteList.append(empty);
        return;
      }

      visibleNotes.forEach((note) => {
        const item = documentRef.createElement("button");
        item.type = "button";
        item.className = `note-item${note.id === activeId ? " active" : ""}`;
        item.dataset.noteId = note.id;
        item.setAttribute("aria-current", note.id === activeId ? "true" : "false");

        const title = documentRef.createElement("span");
        title.className = "note-title";
        title.textContent = note.title || "未命名笔记";

        const preview = documentRef.createElement("span");
        preview.className = "note-preview";
        preview.textContent = getPreview(note.body);

        const date = documentRef.createElement("span");
        date.className = "note-date";
        date.textContent = formatDate(note.updatedAt);

        item.append(title, preview, date);
        elements.noteList.append(item);
      });
    }

    function renderEditor() {
      const activeNote = notes.find((note) => note.id === activeId);
      const hasNote = Boolean(activeNote);
      elements.editor.hidden = !hasNote;
      elements.emptyState.hidden = hasNote;

      if (!activeNote) return;

      elements.titleInput.value = activeNote.title;
      elements.bodyInput.value = activeNote.body;
      elements.wordCount.textContent = `${countWords(activeNote.body)} 字`;
    }

    function render() {
      renderList();
      renderEditor();
    }

    function editActive(changes) {
      if (!activeId) return;
      elements.saveStatus.textContent = "保存中...";
      notes = updateNote(notes, activeId, changes);
      persist();
      renderList();
      elements.wordCount.textContent = `${countWords(elements.bodyInput.value)} 字`;
    }

    elements.addNote.addEventListener("click", () => {
      const note = createNote();
      notes = [note, ...notes];
      activeId = note.id;
      persist();
      render();
      elements.titleInput.focus();
      elements.titleInput.select();
    });

    elements.deleteNote.addEventListener("click", () => {
      if (!activeId) return;
      notes = deleteNote(notes, activeId);
      activeId = sortNotes(notes)[0]?.id || null;
      persist();
      render();
    });

    elements.noteList.addEventListener("click", (event) => {
      const item = event.target?.closest?.(".note-item");
      if (!item || !elements.noteList.contains(item)) return;
      selectNote(item.dataset.noteId, { reveal: true });
    });

    elements.searchInput.addEventListener("input", renderList);
    elements.titleInput.addEventListener("input", () => {
      editActive({ title: elements.titleInput.value || "未命名笔记" });
    });
    elements.bodyInput.addEventListener("input", () => {
      editActive({ body: elements.bodyInput.value });
    });

    render();
    return {
      get notes() {
        return notes;
      },
      get activeId() {
        return activeId;
      },
      selectNote,
    };
  }

  const api = {
    STORAGE_KEY,
    createNote,
    countWords,
    deleteNote,
    filterNotes,
    initApp,
    loadNotes,
    normalizeNote,
    saveNotes,
    sortNotes,
    updateNote,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (typeof window !== "undefined") {
    window.NotesApp = { ...api, initApp };
    window.addEventListener("DOMContentLoaded", () => initApp());
  }
})();
