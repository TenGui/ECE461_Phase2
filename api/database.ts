import { Pool } from "pg";
import fs from "fs";
const pool = new Pool({
  host: "db1.cxbpqyp9rkhq.us-east-2.rds.amazonaws.com",
  port: 5432,
  database: "ece461test",
  user: "postgres",
  password: "dreamteam",
  ssl: {
    ca: fs.readFileSync(__dirname + "/us-east-2-bundle.pem"),
  },
});

export async function query(text: string, values?: any[]) {
  try {
    const client = await pool.connect();
    const result = await client.query(text, values);
    client.release(); // Release the client back to the pool when done
    return result;
  } catch (error) {
    console.error("Error querying the database:", error);
    throw error;
  }
}

export { pool };
