# Customizing Google OAuth Consent Screen

## Problem

When logging in with Google, users see:
```
Choose an account to continue to ijalctbscxyztbwjfoem.supabase.co
```

Instead of seeing the actual app domain (`zenote.vercel.app`).

## Solutions

### Option 1: Supabase Custom Domains (Pro plan)

Supabase offers a **Custom Domains** feature that lets you use your own domain (e.g., `auth.zenote.vercel.app`) instead of the default Supabase project URL. This changes what users see on the Google consent screen.

**Requirements:**
- Supabase Pro plan ($25/month)
- Your own domain with DNS access

**Setup:**
1. Upgrade to Supabase Pro plan
2. Go to Project Settings → Custom Domains
3. Add your domain and configure DNS records
4. Update the Supabase client to use the custom domain

**Documentation:** https://supabase.com/docs/guides/platform/custom-domains

### Option 2: Google OAuth App Verification (Free)

To show your **app name and logo** on the consent screen (instead of just the domain), submit your OAuth app to Google for verification.

**Steps:**
1. Go to [Google Cloud Console → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Fill in:
   - App name: "Zenote"
   - App logo
   - Privacy policy URL: https://zenote.vercel.app/privacy (need to create)
   - Terms of service URL: https://zenote.vercel.app/terms (need to create)
3. Submit for verification (can take several days)

**Note:** This won't change the domain shown, but will make it look more professional with branding.

### Option 3: Both Solutions

For the best user experience, combine both:
- Custom domain shows `zenote.vercel.app`
- Google verification shows app name and logo

## Comparison

| What you want | Solution | Cost |
|---------------|----------|------|
| Show `zenote.vercel.app` instead of Supabase URL | Supabase Custom Domains | Pro plan ($25/mo) |
| Show app name & logo | Google OAuth verification | Free |
| Both | Both solutions | Pro plan |

## Current Status

- [ ] Supabase Custom Domains configured
- [ ] Google OAuth app verification submitted
- [ ] Privacy policy page created
- [ ] Terms of service page created

## References

- Supabase Custom Domains: https://supabase.com/docs/guides/platform/custom-domains
- Google OAuth Consent Screen: https://console.cloud.google.com/apis/credentials/consent
- Supabase Auth Google Login: https://supabase.com/docs/guides/auth/social-login/auth-google
