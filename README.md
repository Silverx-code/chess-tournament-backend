# ♟ ChessArena — Backend

Node.js + Express + MongoDB REST API for the chess tournament tracker.

## File Structure

```
chess-tournament-backend/
├── server.js
├── package.json
├── .env.example
├── .gitignore
├── middleware/
│   └── auth.js
├── models/
│   ├── User.js
│   ├── Match.js
│   └── Poll.js
└── routes/
    ├── authRoutes.js
    ├── matchRoutes.js
    └── pollRoutes.js
```

---

## Step 1 — MongoDB Atlas Setup (Free)

1. Go to **https://cloud.mongodb.com** and create a free account
2. Click **"Build a Database"** → choose **M0 Free Tier** → select any region close to Nigeria (e.g. Frankfurt or Sao Paulo)
3. Create a **username + password** for the database user — save these
4. Under **"Network Access"** → click **"Add IP Address"** → choose **"Allow Access from Anywhere"** (0.0.0.0/0) — required for Render
5. Under **"Database"** → click **"Connect"** → **"Connect your application"**
6. Copy the connection string — it looks like:
   ```
   mongodb+srv://youruser:yourpassword@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
7. Add your database name to it:
   ```
   mongodb+srv://youruser:yourpassword@cluster0.xxxxx.mongodb.net/chess-tournament?retryWrites=true&w=majority
   ```

---

## Step 2 — Local Setup

```bash
cd chess-tournament-backend
npm install

# Create your .env file
cp .env.example .env
# Then edit .env and paste your MONGO_URI and a strong JWT_SECRET
```

**.env file:**
```
MONGO_URI=mongodb+srv://youruser:yourpassword@cluster0.xxxxx.mongodb.net/chess-tournament?retryWrites=true&w=majority
JWT_SECRET=some_very_long_random_secret_string_here
PORT=5000
CLIENT_URL=http://localhost:3000
```

```bash
npm run dev    # starts with nodemon on port 5000
```

Test it: open **http://localhost:5000** — you should see:
```json
{ "status": "ChessArena API is running ♟" }
```

---

## Step 3 — Deploy to Render

1. Push the `chess-tournament-backend` folder to a **GitHub repo** (can be same repo as frontend, different folder)
2. Go to **https://render.com** → New → **Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Root Directory:** `chess-tournament-backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
5. Under **"Environment Variables"** add:
   | Key | Value |
   |---|---|
   | `MONGO_URI` | your Atlas connection string |
   | `JWT_SECRET` | your secret string |
   | `CLIENT_URL` | your Vercel frontend URL (e.g. https://chess-tournament.vercel.app) |
6. Click **Deploy**

Once deployed, copy your Render URL (e.g. `https://chess-arena-api.onrender.com`) and update your frontend `.env`:
```
VITE_API_URL=https://chess-arena-api.onrender.com
```

---

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/signup` | No | Register new player |
| POST | `/api/login` | No | Login, returns JWT |
| POST | `/api/match/register` | JWT | Submit a match result |
| GET | `/api/matches?chessID=X` | JWT | Get all matches for a player |
| GET | `/api/leaderboard` | JWT | Get all players sorted by points |
| GET | `/api/poll` | JWT | Get this month's poll |
| POST | `/api/vote` | JWT | Cast a vote |
| GET | `/` | No | Health check |

---

## Point System

| Match Type | Points |
|---|---|
| Rapid | 1 pt |
| Daily (3-day) | 3 pts |

- Max **20 matches** per player per month
- Stats reset automatically on the **1st of each month** via cron job
