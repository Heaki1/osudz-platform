import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

// Not yet connected — pool is created lazily so the server boots without a DB.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
