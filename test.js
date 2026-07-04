const assert = require("node:assert/strict");
const {
  STORAGE_KEY,
  countWords,
  deleteNote,
  filterNotes,
  initApp,
  loadNotes,
  saveNotes,
  sortNotes,
  updateNote,
} = require("./app");

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.dataset = {};
    this.eventListeners = {};
    this.parentNode = null;
    this.value = "";
    this.hidden = false;
    this.className = "";
    this.textContent = "";
    this.scrollIntoViewCalls = [];
  }

  set innerHTML(value) {
    this.children = [];
    this.textContent = value;
  }

  get innerHTML() {
    return this.textContent;
  }

  append(...nodes) {
    nodes.forEach((node) => {
      node.parentNode = this;
      this.children.push(node);
    });
  }

  addEventListener(type, handler) {
    this.eventListeners[type] ||= [];
    this.eventListeners[type].push(handler);
  }

  dispatchEvent(event) {
    event.target ||= this;
    event.currentTarget = this;
    (this.eventListeners[event.type] || []).forEach((handler) => handler(event));
    if (event.bubbles !== false && this.parentNode) {
      this.parentNode.dispatchEvent(event);
    }
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  closest(selector) {
    if (!selector.startsWith(".")) return null;
    const className = selector.slice(1);
    let current = this;
    while (current) {
      if (` ${current.className} `.includes(` ${className} `)) return current;
      current = current.parentNode;
    }
    return null;
  }

  contains(node) {
    let current = node;
    while (current) {
      if (current === this) return true;
      current = current.parentNode;
    }
    return false;
  }

  focus() {}

  select() {}

  scrollIntoView(options) {
    this.scrollIntoViewCalls.push(options);
  }
}

function createDocument() {
  const ids = [
    "addNote",
    "deleteNote",
    "noteList",
    "searchInput",
    "titleInput",
    "bodyInput",
    "saveStatus",
    "wordCount",
    "editor",
    "emptyState",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement()]));
  return {
    elements,
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    getElementById(id) {
      return elements[id];
    },
  };
}

const notes = [
  {
    id: "a",
    title: "会议纪要",
    body: "讨论产品排期",
    updatedAt: "2026-07-04T08:00:00.000Z",
  },
  {
    id: "b",
    title: "Reading",
    body: "Design systems and UI polish",
    updatedAt: "2026-07-04T10:00:00.000Z",
  },
];

assert.deepEqual(
  sortNotes(notes).map((note) => note.id),
  ["b", "a"],
  "笔记列表应按更新时间倒序排列",
);

assert.deepEqual(
  filterNotes(notes, "产品").map((note) => note.id),
  ["a"],
  "搜索应匹配正文内容",
);

assert.deepEqual(
  filterNotes(notes, "read").map((note) => note.id),
  ["b"],
  "搜索应忽略英文大小写",
);

const updated = updateNote(notes, "a", { title: "新标题" }, new Date("2026-07-04T11:00:00.000Z"));
assert.equal(updated.find((note) => note.id === "a").title, "新标题", "应更新目标笔记标题");
assert.equal(
  updated.find((note) => note.id === "a").updatedAt,
  "2026-07-04T11:00:00.000Z",
  "编辑笔记时应刷新更新时间",
);
assert.equal(notes.find((note) => note.id === "a").title, "会议纪要", "更新不应修改原数组");

assert.deepEqual(
  deleteNote(notes, "a").map((note) => note.id),
  ["b"],
  "删除应移除指定笔记",
);

assert.equal(countWords("中文 note test"), 4, "字数统计应同时计算中文字符和英文词");
assert.equal(countWords("   "), 0, "空正文应统计为 0");

const storage = createStorage();
saveNotes(storage, notes);
assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).length, 2, "保存应写入本地存储键");
assert.deepEqual(
  loadNotes(storage).map((note) => note.id),
  ["a", "b"],
  "加载应读取本地存储中的笔记",
);

const brokenStorage = createStorage();
brokenStorage.setItem(STORAGE_KEY, "{bad json");
assert.ok(loadNotes(brokenStorage).length > 0, "损坏存储应回退到示例笔记");

const uiStorage = createStorage();
saveNotes(uiStorage, [
  {
    id: "welcome",
    title: "欢迎使用双栏笔记",
    body: "左侧管理笔记，右侧编辑内容。",
    updatedAt: "2026-07-04T09:00:00.000Z",
  },
  {
    id: "ideas",
    title: "今日灵感",
    body: "可以把会议纪要、读书摘录、待办想法都放在这里。",
    updatedAt: "2026-07-04T09:05:00.000Z",
  },
]);
const fakeDocument = createDocument();
const app = initApp(fakeDocument, uiStorage);
app.selectNote("welcome");
const ideasCard = fakeDocument.elements.noteList.children.find((child) => child.dataset.noteId === "ideas");
assert.ok(ideasCard, "左侧列表应渲染今日灵感卡片");
ideasCard.dispatchEvent({ type: "click" });
assert.equal(app.activeId, "ideas", "点击今日灵感卡片后应选中对应笔记");
assert.equal(fakeDocument.elements.titleInput.value, "今日灵感", "右侧标题应显示今日灵感");
assert.equal(
  fakeDocument.elements.bodyInput.value,
  "可以把会议纪要、读书摘录、待办想法都放在这里。",
  "右侧正文应显示今日灵感详情内容",
);
assert.equal(
  fakeDocument.elements.editor.scrollIntoViewCalls.length,
  1,
  "点击左侧卡片后应定位到右侧详情区域",
);
assert.deepEqual(
  fakeDocument.elements.editor.scrollIntoViewCalls[0],
  {
    behavior: "smooth",
    block: "start",
    inline: "nearest",
  },
  "定位详情区域时应使用平滑滚动",
);

console.log("All tests passed.");
