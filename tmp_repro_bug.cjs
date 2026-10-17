// 复现 friendfeed.ts 的 stmt.bind 复用 bug (CJS)
const Database = require("better-sqlite3");
const db = new Database(":memory:");
db.exec(`CREATE TABLE t (friend_id INTEGER, link TEXT, title TEXT, UNIQUE(friend_id, link))`);

// 模拟原代码：items 3 条，复用同一个 stmt
const items = [
  { title: "文章A(新)", link: "https://a.com/1" },
  { title: "文章B(新)", link: "https://a.com/2" },
  { title: "文章C(新)", link: "https://a.com/3" },
];
const sql = `INSERT INTO t (friend_id, title, link) VALUES (?, ?, ?) ON CONFLICT(friend_id, link) DO UPDATE SET title = excluded.title`;
const stmt = db.prepare(sql);
db.transaction(() => {
  items.map(it => stmt.bind(1, it.title, it.link).run());
})();
console.log("== 原代码写法（复用 stmt）后表中的行 ==");
console.log(db.prepare("SELECT * FROM t").all());

// 修复写法：每个 item 新建 statement
db.exec(`DELETE FROM t`);
db.transaction(() => {
  items.map(it => db.prepare(sql).bind(1, it.title, it.link).run());
})();
console.log("== 修复写法（每项新建 prepare）后表中的行 ==");
console.log(db.prepare("SELECT * FROM t").all());