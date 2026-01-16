const Database = require('better-sqlite3');
const db = new Database('./database.db');

try {
    const result = db.prepare('DELETE FROM search_history').run();
    console.log(`✅ Successfully cleared ${result.changes} records from search history`);
} catch (error) {
    console.error('❌ Error clearing history:', error.message);
}

db.close();
console.log('Database connection closed');
