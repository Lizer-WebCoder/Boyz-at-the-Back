# Boyz at the Back

Private hangout chat for the boys. Orange + black stripe energy. Desktop + phone.

## Setup (do this once)

### 1. New Supabase project
https://supabase.com → **New project** → wait until green.

### 2. Database
SQL Editor → paste `supabase/schema.sql` → **Run**

### 3. Keys
Project Settings → API → copy **URL** + **anon key**

### 4. Code
```bash
git clone https://github.com/Lizer-WebCoder/Boyz-at-the-Back.git
cd Boyz-at-the-Back
```

Create file `.env.local`:
```
VITE_SUPABASE_URL=https://XXXX.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### 5. Start
```bash
npm install
npm run dev
```

Open the localhost link. First signup creates the group + invite code.
