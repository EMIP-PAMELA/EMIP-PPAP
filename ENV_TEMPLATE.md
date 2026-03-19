# Environment Variables Template

Create a `.env.local` file in the project root with these variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## How to Get These Values

1. Go to your Supabase project dashboard
2. Click on the "Settings" icon (gear) in the left sidebar
3. Navigate to "API" section
4. Copy the following:
   - **Project URL** → use as `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API keys** → **anon/public** key → use as `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Important Notes

- Never commit `.env.local` to version control (it's already in `.gitignore`)
- The `NEXT_PUBLIC_` prefix makes these variables available in the browser
- Restart your dev server after creating or modifying `.env.local`
