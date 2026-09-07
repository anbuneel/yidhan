# Zenote Onboarding UX Review (Follow-up)
By Codex 
Status: FOLLOW-UP
Date: 2025-12-22

Purpose
- Capture onboarding UI/UX friction points for follow-up work.

Findings (ordered by impact)
1) Demo-to-signup bridge is weak
   - The demo editor suggests signup but offers no direct CTA.
   - Impact: users who just typed are not given a clear next step.
   - Where: src/components/LandingPage.tsx

2) Signup confirmation stalls
   - After signup, the user is told to check email but has no resend option or edit flow.
   - Impact: drop-off when confirmation email is missed or delayed.
   - Where: src/components/Auth.tsx

3) Full Name appears required
   - Full name is shown without an �optional� cue.
   - Impact: adds friction for fast signup.
   - Where: src/components/Auth.tsx

4) Password rules are hidden
   - Minimum length is enforced but not disclosed up front.
   - Impact: avoidable errors on submit.
   - Where: src/components/Auth.tsx

5) Modal dismiss can lose input
   - Clicking outside closes the auth modal with no confirm.
   - Impact: accidental drop-off, especially on mobile.
   - Where: src/components/Auth.tsx

Proposed Follow-up (high priority)
- Add a CTA in the demo card: �Save this note� -> opens signup.
- Show a �Check your email� state with �Resend� and �Change email� actions.
- Mark Full Name as optional or move to post-signup settings.
- Add password hint (�8+ characters�) near the field.
- If modal is dirty, confirm before dismiss.

Owner
- TBD
