# Charlatan Bank Demo Issue Scenarios

This fake banking site intentionally contains several independent, fixable
frontend bugs. Each scenario should be usable as a separate Field Agent demo
that can produce a focused pull request.

## 1. Submit Failure

- User behavior: fill the full application and click `Submit application`.
- Console signal: `LoanSubmissionError: applicationSessionId is undefined`.
- Root cause: `appState.applicationSession` is not initialized on page load.
- Expected PR: initialize `appState.applicationSession` with
  `createApplicationSession()` and use the existing demo mock submission path
  for the static site.

## 2. 60 Month Rage Click

- User behavior: repeatedly click the `60 months` repayment term.
- Console signal: `LoanTermSelectionError: 60 month term did not select`.
- Root cause: the `#term-60-option` click handler prevents the native radio
  selection and forces the term back to 48 months.
- Expected PR: remove the dead-click override so the 60 month radio option can
  select normally and update the loan summary.

## 3. Stale Loan Estimate

- User behavior: move the loan amount slider several times.
- Console signal: `LoanEstimateStaleError: monthly payment estimate stopped updating after amount change`.
- Root cause: the slider handler sets `estimateFrozen` and skips
  `updateSummary()`.
- Expected PR: always refresh the amount, APR, monthly payment and term summary
  when the loan amount changes.

## 4. Consent Label Accessibility

- User behavior: click the consent sentence instead of the checkbox.
- Console signal: `ConsentLabelBindingError: consent label received click but checkbox state did not change`.
- Root cause: the consent text is a `span`, not a real label bound to the
  checkbox.
- Expected PR: replace the span with `<label for="consent">` or otherwise bind
  the text click to the checkbox.

## Demo Tip

Record separate sessions when you want separate PRs. If a session includes the
final submit failure, most agents will correctly prioritize the submit bug
because it blocks conversion.
