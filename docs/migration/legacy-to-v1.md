# Legacy to v1

The original static trainer and GitHub relay were moved to a local-only `archive/legacy/` snapshot so their Git history remains available without shipping old runtime code. No legacy vocabulary is imported automatically because it may contain personal data and its scheduling semantics differ from v1.

To migrate intentionally, review and normalize the old words manually, then insert them into `words` through the authenticated app. Do not copy old progress into `review_state` without reconciling the v1 study rules.
