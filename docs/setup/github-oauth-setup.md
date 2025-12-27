# GitHub OAuth Setup Guide

This guide walks through configuring GitHub OAuth for Zenote.

## Prerequisites

- GitHub account
- Access to Supabase Dashboard

## Step 1: Create GitHub OAuth App

1. Go to **GitHub** → **Settings** → **Developer settings** → **OAuth Apps**
   - Direct link: https://github.com/settings/developers

2. Click **"New OAuth App"**

3. Fill in the form:
   | Field | Value |
   |-------|-------|
   | **Application name** | `Zenote` |
   | **Homepage URL** | `https://zenote.vercel.app` |
   | **Authorization callback URL** | `https://<your-supabase-project>.supabase.co/auth/v1/callback` |

   > Replace `<your-supabase-project>` with your actual Supabase project reference (found in Supabase Dashboard → Settings → API)

4. Click **"Register application"**

5. Copy the **Client ID** (shown immediately)

6. Click **"Generate a new client secret"** and copy it
   > **Important:** Save this secret securely - you won't be able to see it again!

## Step 2: Configure Supabase

1. Go to **Supabase Dashboard** → **Authentication** → **Providers**

2. Find **GitHub** in the list and click to expand

3. Toggle **Enable Sign in with GitHub** to ON

4. Enter your credentials:
   | Field | Value |
   |-------|-------|
   | **Client ID** | (paste from GitHub) |
   | **Client Secret** | (paste from GitHub) |

5. Click **Save**

## Step 3: Update Redirect URLs (if needed)

In Supabase Dashboard → **Authentication** → **URL Configuration**:

1. Ensure **Site URL** is set to: `https://zenote.vercel.app`

2. Add to **Redirect URLs**:
   - `https://zenote.vercel.app` (production)
   - `http://localhost:5173` (local development)

## Step 4: Test the Integration

1. Start the dev server: `npm run dev`
2. Navigate to the login page
3. Click the **GitHub** button
4. Authorize the app on GitHub
5. You should be redirected back and logged in

## Troubleshooting

### "Redirect URI mismatch" error
- Verify the callback URL in GitHub matches exactly: `https://<project>.supabase.co/auth/v1/callback`
- Check for trailing slashes or typos

### User not redirecting back after auth
- Ensure `window.location.origin` is in Supabase's Redirect URLs
- Check browser console for errors

### GitHub shows "Application suspended"
- Verify your OAuth App is still active in GitHub Developer Settings
- Regenerate client secret if needed

## Security Notes

- Never commit Client ID or Secret to version control
- Client Secret should only be stored in Supabase (server-side)
- The frontend code only triggers the OAuth flow - credentials stay secure
