# Nook landing and account app

This public Cloudflare Pages project contains the Nook marketing landing page,
waitlist form, and the account onboarding page at `/app`.

## Local development

```bash
npm install
VITE_SUPABASE_URL=https://your-project.supabase.co \
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
VITE_NOOK_API_URL=https://nook-production-eee1.up.railway.app \
npm run dev
```

The Supabase publishable key is safe to expose in the browser. Never put a
Supabase secret/service-role key in this repository or in Cloudflare Pages
client code.

## Cloudflare Pages build settings

- Build command: `npm run build`
- Output directory: `dist`
- Production branch: `main`
- `VITE_SUPABASE_URL`: the Nook Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY`: the project publishable key
- `VITE_NOOK_API_URL`: the Railway Nook API URL

The custom-domain/DNS connection for `nookmyapartment.com` remains a pending
infrastructure task. Configure the exact production URL in Supabase Auth before
enabling Google or Apple OAuth in production.
