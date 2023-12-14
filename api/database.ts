import {Pool} from 'pg';
import fs from 'fs';
const pool = new Pool({
    host:'database-1.czbaseadhhdu.us-east-1.rds.amazonaws.com',
    port: 5432,
    database: 'Phase2db',
    user: 'davidasousa',
    password: 'SandalGum17#',
    ssl: {
        ca: fs.readFileSync(__dirname + '/us-east-2-bundle.pem')
    },
    max: 20,
    idleTimeoutMillis: 30000,
})

export async function query(text: string, values?: any[]) {
    try {
      const client = await pool.connect();
      const result = await client.query(text, values);
      client.release(); // Release the client back to the pool when done
      return result;
    } catch (error) {
      console.error('Error querying the database:', error);
      throw error;
    }
  }

  export { pool };