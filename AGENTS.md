# Agent instructions

## Pull request review loops

- Read pull request feedback with thread-aware state so unresolved, outdated, and resolved comments are distinguished correctly.
- Resolve a review thread after its requested change is implemented and verified. Reply with the fixing commit and concise validation evidence before resolving it.
- Resolve a debunked review thread only after replying with concrete code, test, or runtime evidence showing why no change is appropriate.
- Leave ambiguous, conflicting, partially addressed, or unverified feedback open. Explain the remaining uncertainty instead of closing it optimistically.
