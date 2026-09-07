# Subscription & Feature Gating Architecture

**Version:** 1.0
**Last Updated:** 2026-01-14
**Status:** Future Implementation (post-MVP)
**Author:** Claude (Opus 4.5)

---

## Original Prompt

> Let's say we want to make this capability available only for paid users, how would we design/implement and enable only for them?

---

## Executive Summary

This document outlines the architecture for implementing paid subscriptions and feature gating in Yidhan. The approach aligns with Yidhan's "calm monetization" philosophy — soft prompts rather than hard walls, value-first rather than restriction-first.

**Current status:** MVP features are **free for all users**. This architecture will be implemented once feature value is validated.

---

## Philosophy: Calm Monetization

From `monetization-philosophy.md`:

> *"Yidhan is free. If it brings you calm, consider supporting its quiet existence for $4/month."*

### Principles

| Principle | Implementation |
|-----------|----------------|
| **Value first** | Show what the feature does before asking for payment |
| **Soft prompts** | "Support Yidhan" not "UPGRADE NOW!" |
| **No guilt** | Free tier is genuinely useful |
| **Transparency** | Clear about what's free vs premium |

### What This Means in Practice

```
❌ WRONG: "This feature is locked. Pay to unlock."

✅ RIGHT: "Quiet Tasks surfaces the intentions hidden in your writing.
          This is part of Bloom, our way of keeping Yidhan's quiet
          existence sustainable. If it brings you calm..."
```

---

## Tier Structure

### Free Tier

Everything needed for a complete note-taking experience:

- Unlimited notes
- Rich text editing
- Tags and organization
- Temporal chapters
- Search
- Export/Import
- Offline support
- Share as Letter
- Practice Space (demo)

### Bloom Tier ($4/month)

Premium "Quiet Intelligence" features:

| Feature | Description |
|---------|-------------|
| Quiet Tasks | Surface explicit tasks + implicit intentions |
| Resonance Threads | Connect related thoughts across time |
| Seasonal Echo | "This time last year..." reflections |
| Weekly Digest | Email summary of writing + intentions |
| Quiet Questions | Personalized reflection prompts |
| The Convergence | Multi-theme synthesis |
| Gentle Grounding | Emotional tone awareness |
| The Unsaid | Notice absent themes |

---

## Database Schema

### Subscriptions Table

```sql
-- Track user subscription status
create table subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,

  -- Subscription details
  tier text not null default 'free' check (tier in ('free', 'bloom')),
  status text not null default 'active' check (status in (
    'active',      -- Paid and current
    'canceled',    -- User canceled, access until period end
    'past_due',    -- Payment failed, grace period
    'trialing'     -- Free trial period
  )),

  -- Payment provider integration
  provider text,                    -- 'stripe', 'lemonsqueezy', 'paddle', 'manual'
  provider_subscription_id text,    -- External subscription ID
  provider_customer_id text,        -- External customer ID

  -- Billing cycle
  current_period_start timestamptz,
  current_period_end timestamptz,

  -- Trial support
  trial_start timestamptz,
  trial_end timestamptz,

  -- Lifecycle
  started_at timestamptz,
  canceled_at timestamptz,

  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Index for webhook lookups
create index idx_subscriptions_provider_id
  on subscriptions(provider, provider_subscription_id);

-- RLS: Users can only read their own subscription
alter table subscriptions enable row level security;

create policy "Users can read own subscription" on subscriptions
  for select using (auth.uid() = user_id);

-- Service role can update (for webhooks)
create policy "Service role can manage subscriptions" on subscriptions
  for all using (auth.role() = 'service_role');
```

### Migration File

Save as `supabase/migrations/add_subscriptions.sql`:

```sql
-- Subscriptions table for premium feature gating
-- Run this migration when ready to implement paid features

create table if not exists subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  tier text not null default 'free' check (tier in ('free', 'bloom')),
  status text not null default 'active' check (status in ('active', 'canceled', 'past_due', 'trialing')),
  provider text,
  provider_subscription_id text,
  provider_customer_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,
  started_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_subscriptions_provider_id
  on subscriptions(provider, provider_subscription_id);

alter table subscriptions enable row level security;

create policy "Users can read own subscription" on subscriptions
  for select using (auth.uid() = user_id);
```

---

## React Implementation

### Types

```typescript
// src/types/subscription.ts
export type SubscriptionTier = 'free' | 'bloom';

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';

export interface Subscription {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  trialEnd: Date | null;
}

export type PremiumFeature =
  | 'quiet_tasks'
  | 'resonance_threads'
  | 'seasonal_echo'
  | 'weekly_digest'
  | 'quiet_questions'
  | 'the_convergence'
  | 'gentle_grounding'
  | 'the_unsaid';

// Features that require Bloom tier
export const PREMIUM_FEATURES: PremiumFeature[] = [
  'quiet_tasks',
  'resonance_threads',
  'seasonal_echo',
  'weekly_digest',
  'quiet_questions',
  'the_convergence',
  'gentle_grounding',
  'the_unsaid',
];
```

### Subscription Context

```typescript
// src/contexts/SubscriptionContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { fetchSubscription } from '../services/subscription';
import { Subscription, PremiumFeature, PREMIUM_FEATURES } from '../types/subscription';

interface SubscriptionContextType {
  subscription: Subscription | null;
  isLoading: boolean;
  isPremium: boolean;
  isTrialing: boolean;
  daysUntilExpiry: number | null;
  canUseFeature: (feature: PremiumFeature) => boolean;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSubscription = async () => {
    if (!user) {
      setSubscription(null);
      setIsLoading(false);
      return;
    }

    try {
      const sub = await fetchSubscription(user.id);
      setSubscription(sub);
    } catch (error) {
      console.error('Failed to load subscription:', error);
      // Default to free tier on error
      setSubscription({ tier: 'free', status: 'active', currentPeriodEnd: null, trialEnd: null });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSubscription();
  }, [user]);

  const isPremium =
    subscription?.tier === 'bloom' &&
    ['active', 'trialing'].includes(subscription?.status ?? '');

  const isTrialing = subscription?.status === 'trialing';

  const daysUntilExpiry = subscription?.currentPeriodEnd
    ? Math.ceil((new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const canUseFeature = (feature: PremiumFeature): boolean => {
    // If feature doesn't require premium, allow
    if (!PREMIUM_FEATURES.includes(feature)) return true;

    // Check premium status
    return isPremium;
  };

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        isLoading,
        isPremium,
        isTrialing,
        daysUntilExpiry,
        canUseFeature,
        refreshSubscription: loadSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
```

### Subscription Service

```typescript
// src/services/subscription.ts
import { supabase } from '../lib/supabase';
import { Subscription } from '../types/subscription';

export async function fetchSubscription(userId: string): Promise<Subscription> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('tier, status, current_period_end, trial_end')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    // No subscription record = free tier (default)
    return {
      tier: 'free',
      status: 'active',
      currentPeriodEnd: null,
      trialEnd: null,
    };
  }

  return {
    tier: data.tier,
    status: data.status,
    currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end) : null,
    trialEnd: data.trial_end ? new Date(data.trial_end) : null,
  };
}
```

### Feature Gate Component

```typescript
// src/components/FeatureGate.tsx
import { PremiumFeature } from '../types/subscription';
import { useSubscription } from '../contexts/SubscriptionContext';

interface FeatureGateProps {
  feature: PremiumFeature;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { canUseFeature, isLoading } = useSubscription();

  // Show nothing while loading
  if (isLoading) return null;

  // User has access
  if (canUseFeature(feature)) {
    return <>{children}</>;
  }

  // Show fallback (upgrade prompt) or nothing
  return fallback ? <>{fallback}</> : null;
}
```

### Upgrade Prompt Component

```typescript
// src/components/UpgradePrompt.tsx
import { PremiumFeature } from '../types/subscription';

interface UpgradePromptProps {
  feature: PremiumFeature;
  onUpgrade?: () => void;
}

const FEATURE_DESCRIPTIONS: Record<PremiumFeature, { title: string; description: string }> = {
  quiet_tasks: {
    title: 'Quiet Tasks',
    description: 'Surface the intentions hidden in your writing. Never lose track of what matters to you.',
  },
  resonance_threads: {
    title: 'Resonance Threads',
    description: 'Discover connections between thoughts you wrote months apart.',
  },
  seasonal_echo: {
    title: 'Seasonal Echo',
    description: 'Revisit what you were thinking this time last year.',
  },
  weekly_digest: {
    title: 'Weekly Digest',
    description: 'A gentle summary of your week in words, delivered to your inbox.',
  },
  quiet_questions: {
    title: 'Quiet Questions',
    description: 'Reflection prompts drawn from your own writing.',
  },
  the_convergence: {
    title: 'The Convergence',
    description: 'Notice when multiple themes in your life are aligning.',
  },
  gentle_grounding: {
    title: 'Gentle Grounding',
    description: 'Awareness of shifts in emotional tone across your notes.',
  },
  the_unsaid: {
    title: 'The Unsaid',
    description: 'Notice themes that have quietly faded from your writing.',
  },
};

export function UpgradePrompt({ feature, onUpgrade }: UpgradePromptProps) {
  const { title, description } = FEATURE_DESCRIPTIONS[feature];

  return (
    <div className="upgrade-prompt">
      <div className="upgrade-prompt-icon">💭</div>
      <h2 className="upgrade-prompt-title">{title}</h2>
      <p className="upgrade-prompt-description">{description}</p>
      <p className="upgrade-prompt-philosophy">
        This is part of Bloom, our way of keeping Yidhan's quiet existence sustainable.
      </p>
      <button className="upgrade-prompt-button" onClick={onUpgrade}>
        Support Yidhan — $4/mo
      </button>
      <p className="upgrade-prompt-tagline">
        "If it brings you calm..."
      </p>
    </div>
  );
}
```

---

## Payment Provider Integration

### Recommended: LemonSqueezy

**Why LemonSqueezy for Yidhan:**
- Simple setup (indie-dev friendly)
- Handles global tax/VAT automatically
- Good webhook support
- Reasonable fees (5% + 50¢)
- Aligns with calm, simple philosophy

### Webhook Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    PAYMENT WEBHOOK FLOW                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Customer completes checkout on LemonSqueezy                │
│        │                                                    │
│        ▼                                                    │
│  LemonSqueezy sends webhook to:                             │
│  https://your-project.supabase.co/functions/v1/webhooks     │
│        │                                                    │
│        ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Supabase Edge Function: /functions/v1/webhooks     │   │
│  │                                                     │   │
│  │  1. Verify webhook signature                        │   │
│  │  2. Parse event type                                │   │
│  │  3. Find user by email or customer_id              │   │
│  │  4. Update subscriptions table                      │   │
│  └─────────────────────────────────────────────────────┘   │
│        │                                                    │
│        ▼                                                    │
│  User's subscription status updated                         │
│        │                                                    │
│        ▼                                                    │
│  Next app load → SubscriptionContext refreshes              │
│        │                                                    │
│        ▼                                                    │
│  Premium features unlocked                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Webhook Handler (Supabase Edge Function)

```typescript
// supabase/functions/webhooks/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verify } from 'https://esm.sh/@lemonsqueezy/lemonsqueezy.js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  // Verify webhook signature
  const signature = req.headers.get('x-signature');
  const body = await req.text();

  const isValid = verify(body, signature, Deno.env.get('LEMONSQUEEZY_WEBHOOK_SECRET')!);
  if (!isValid) {
    return new Response('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(body);
  const eventName = event.meta.event_name;
  const data = event.data.attributes;

  switch (eventName) {
    case 'subscription_created':
    case 'subscription_updated':
      await handleSubscriptionUpdate(data);
      break;
    case 'subscription_cancelled':
      await handleSubscriptionCanceled(data);
      break;
    case 'subscription_expired':
      await handleSubscriptionExpired(data);
      break;
  }

  return new Response('OK', { status: 200 });
});

async function handleSubscriptionUpdate(data: any) {
  const { user_email, status, renews_at, ends_at, customer_id, id: subscriptionId } = data;

  // Find user by email
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email === user_email);

  if (!user) {
    console.error('User not found for email:', user_email);
    return;
  }

  // Upsert subscription
  await supabase.from('subscriptions').upsert({
    user_id: user.id,
    tier: 'bloom',
    status: mapStatus(status),
    provider: 'lemonsqueezy',
    provider_subscription_id: subscriptionId,
    provider_customer_id: customer_id,
    current_period_end: renews_at || ends_at,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'user_id',
  });
}

function mapStatus(lsStatus: string): string {
  const statusMap: Record<string, string> = {
    'active': 'active',
    'on_trial': 'trialing',
    'paused': 'canceled',
    'past_due': 'past_due',
    'unpaid': 'past_due',
    'cancelled': 'canceled',
    'expired': 'canceled',
  };
  return statusMap[lsStatus] || 'active';
}
```

---

## UI Integration Points

### Settings Modal (New Tab)

```
┌─────────────────────────────────────────────────────────────┐
│  Settings                                              ✕    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Profile    Password    Subscription                        │
│  ─────────────────────────────────────────                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │  Current Plan: Free                                 │   │
│  │                                                     │   │
│  │  Upgrade to Bloom to unlock:                         │   │
│  │  • Quiet Tasks                                      │   │
│  │  • Resonance Threads                                │   │
│  │  • Seasonal Echo                                    │   │
│  │  • Weekly Digest                                    │   │
│  │  • And more...                                      │   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │     Support Yidhan — $4/mo                  │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Profile Menu Badge

```
┌─────────────────────┐
│ 👤 Your Name        │
│    ✨ Bloom          │  ← Shows if premium
├─────────────────────┤
│ ⚙️ Settings         │
│ 📋 Quiet Tasks      │
│ 🌅 Faded Notes      │
│ 📤 Export           │
│ 🚪 Sign out         │
└─────────────────────┘
```

---

## Implementation Phases

### Phase 1: MVP (Current)
- All features free
- No subscription infrastructure
- Validate feature value with users

### Phase 2: Subscription Infrastructure
- Add `subscriptions` table
- Add `SubscriptionContext`
- Add `FeatureGate` component
- No payment integration yet (manual upgrades only)

### Phase 3: Payment Integration
- Set up LemonSqueezy account
- Create checkout flow
- Implement webhook handler
- Add upgrade prompts

### Phase 4: Polish
- Add trial support (7-day free trial)
- Add cancellation flow
- Add subscription management in Settings
- Email receipts and notifications

---

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Webhook forgery | Always verify webhook signatures |
| Client-side bypass | Server-side validation for sensitive operations |
| Subscription status caching | Refresh on each app load; don't cache indefinitely |
| PII in logs | Never log customer email or payment details |

---

## Related Documents

- [Quiet Intelligence Features](quiet-intelligence-features-claude.md) — Features to be gated
- [Monetization Philosophy](monetization-philosophy.md) — Pricing approach
- [PRD](prd.md) — Product requirements

---

*This architecture will be implemented after MVP feature validation. Current status: All features are free.*
