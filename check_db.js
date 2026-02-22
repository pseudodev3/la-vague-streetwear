
import Database from 'better-sqlite3';
const db = new Database('database.sqlite');
const rows = db.prepare('SELECT id, name, price, compare_at_price, tags FROM products').all();
console.log(JSON.stringify(rows, null, 2));
