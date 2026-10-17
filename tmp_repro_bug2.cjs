// 按 sqlite-d1.ts 垫片的真实逻辑复现 friendfeed.ts 的 bug
const Database = require("better-sqlite3");
const db = new Database(":memory:");
db.exec(`CREATE TABLE t (friend_id INTEGER, link TEXT, title TEXT, UNIQUE(friend_id, link))`);

// 复刻 SqliteStatement 垫片逻辑
class Stmt {
  constructor(sql) { this.sql = sql; this.binds = []; }
  bind(...v) { this.binds = v; return this; }
  run() { return db.prepare(this.sql).run(...this.binds); }
}
function prepare(sql) { return new Stmt(sql); }

const items = [
  { title: "文章A(新)", link: "https://a.com/1" },
  { title: "文章B(新)", link: "https://a.com/2" },
  { title: "文章C(新)", link: "https://a.com/3" },
];
const sql = `INSERT INTO t (friend_id, title, link) VALUES (?, ?, ?) ON CONFLICT(friend_id, link) DO UPDATE SET title = excluded.title`;
const stmt = prepare(sql);
db.transaction(() => {
  items.map(it => stmt.bind(1, it.title, it.link).run());
})();
console.log("== 原代码写法（复用同一 stmt）后表中的行 ==");
console.log(db.prepare("SELECT * FROM t").all());

// 修复写法：每个 item 新建 statement
db.exec(`DELETE FROM t`);
db.transaction(() => {
  items.map(it => prepare(sql).bind(1, it.title, it.link).run());
})();
console.log("== 修复写法（每项新建 prepare）后表中的行 ==");
console.log(db.prepare("SELECT * FROM t").all());