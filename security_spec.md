# Security Specification & Red-Team Threat Model

## 1. Data Invariants
1. **Strict Ownership & Verified Email**: Every read and write under `/users/{userId}` and its subcollections (`private`, `languageStats`, `sessions`, `vocabulary`, `notifications`) MUST require `request.auth != null`, `request.auth.uid == userId`, and `request.auth.token.email_verified == true`.
2. **PII Isolation**: Email address and security settings live exclusively in `/users/{userId}/private/security`, never on `/users/{userId}` or any shared collection.
3. **Immutable Identity & Timestamps**: `uid` and `createdAt` cannot change after creation; `createdAt` and `updatedAt` MUST equal `request.time`.
4. **Strict Key Allowlists**: Every document creation enforces `keys().hasAll(...) && keys().hasOnly(...)`, and every update enforces `affectedKeys().hasOnly(...)` combined with full `isValid...` schema validation.
5. **Bounded Strings & Lists**: Every string field enforces `.size()` limits and regex ID/handle/language checks; `unlockedAchievementIds` is capped at `<= 30` elements with first-element type validation when non-empty.
6. **Parent Existence (Master Gate)**: Subcollections (`languageStats`, `sessions`, `vocabulary`, `notifications`, `private`) verify parent `/users/{userId}` exists (or `existsAfter` during atomic batch creation) before writes.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Cross-User Read**: User A reads `/users/userB` or `/users/userB/private/security`.
2. **Identity Spoofing on Create**: User A writes `/users/userA` with `uid: "userB"`.
3. **Unverified Email Write**: Authenticated user with `email_verified: false` writes `/users/userA`.
4. **Shadow / Ghost Field Injection**: User A writes `/users/userA` with extra field `isAdmin: true` or `role: "superuser"`.
5. **Immutable `createdAt` Tampering**: User A updates `/users/userA` modifying `createdAt` or passing a backdated client timestamp for `updatedAt`.
6. **ID Poisoning**: Write to `/users/userA/sessions/` with a 500-char or invalid-character `sessionId` containing `$` or spaces.
7. **Unbounded Array Exhaustion**: Update `/users/userA` with `unlockedAchievementIds` containing >30 items or non-string first element `[123]`.
8. **Score / Counter Poisoning**: Update `/users/userA` with negative `totalScore: -50` or string `totalScore: "99999"`.
9. **Invalid Language Enum**: Write `/users/userA/languageStats/zz` with `language: "zz"`.
10. **PII Injection on Root Profile**: Attempt to add `email` onto `/users/userA` instead of `/users/userA/private/security`.
11. **Session History Tampering**: Attempt to `update` or overwrite an immutable `/users/userA/sessions/{sessionId}` analytics record.
12. **Blanket List Scraping**: Query `/users` collection without owner restriction (`allow list` on `/users` is denied).
