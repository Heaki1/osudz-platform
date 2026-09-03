import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import roundsRouter from './routes/rounds.js';
import submissionsRouter from './routes/submissions.js';
import votesRouter from './routes/votes.js';
import adminRouter from './routes/admin.js';

const app = express();
const PORT = parseInt(process.env.API_PORT ?? '3001', 10);

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:8443', credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/rounds', roundsRouter);
app.use('/api/submissions', submissionsRouter);
app.use('/api/votes', votesRouter);
app.use('/api/admin', adminRouter);

app.listen(PORT, () => {
  console.log(`osudz API listening on http://localhost:${PORT}`);
});
