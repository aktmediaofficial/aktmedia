import fs from 'fs';
import path from 'path';
import { pool } from '@workspace/db';
// ... import your express app or other modules here

async function runMigration() {
  try {
    // Locate schema.sql relative to the compiled or source file
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schemaSql);
      console.log('✅ Database schema applied successfully.');
    } else {
      console.warn('⚠️ schema.sql not found at path:', schemaPath);
    }
  } catch (err) {
    console.error('❌ Failed to apply database schema:', err);
  }
}

// Run migration, then start the server
runMigration().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
});
