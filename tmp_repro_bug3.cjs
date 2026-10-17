// 精确复刻 sqlite-d1.ts 的 batch 流程：先 map 收集（复用同一 stmt），后统一执行
const Database = require("better-sqlite3");
const db = new Database(":memory:");
db.exec(`CREATE TABLE t (friend_id INTEGER, link TEXT, title TEXT, UNIQUE(friend_id, link))`);

class Stmt {
  constructor(sql) { this.sql = sql; this.binds = []; }
  bind(...v) { this.binds = v; return this; }
  _execInTx() { return db.prepare(this.sql).run(...this.binds); }
}
function prepare(sql) { return new Stmt(sql); }

const items = [
  { title: "文章A(新)", link: "https://a.com/1" },
  { title: "文章B(新)", link: "https://a.com/2" },
  { title: "文章C(新)", link: "https://a.com/3" },
];
const sql = `INSERT INTO t (friend_id, title, link) VALUES (?, ?, ?) ON CONFLICT(friend_id, link) DO UPDATE SET title = excluded.title`;

// 原代码：复用同一个 stmt
const stmt = prepare(sql);
const stmts = items.map(it => stmt.bind(1, it.title, it.link)); // 全部指向同一对象，binds=最后一条
db.transaction(() => stmts.map(s => s._execInTx()))();
console.log("== 原代码写法（复用 stmt，先收集后执行）后表中的行 ==");
console.log(db.prepare("SELECT * FROM t").all());

// 修复：每个 item 新建 statement
db.exec(`DELETE FROM t`);
const stmts2 = items.map(it => prepare(sql).bind(1, it.title, it.link));
db.transaction(() => stmts2.map(s => s._execInTx()))();
console.log("== 修复写法（每项新建 prepare）后表中的行 ==");
console.log(db.prepare("SELECT * FROM t").all());