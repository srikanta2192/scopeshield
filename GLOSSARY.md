# ScopeShield

Helps freelancers and small agencies review client contracts for commercial risk without sending sensitive data off their device.

## Language

**Trap**:
One of the seven commercial risks ScopeShield looks for in a contract (background IP transfer, payment on acceptance, scope creep, long payment with early IP transfer, uncapped liability, broad non-compete, missing termination fee).
_Avoid_: Risk type, red flag, issue

**Finding**:
A passage in the contract that triggers a Trap, with a quote, a Severity, its impact, and a suggested response.
_Avoid_: Flag, alert, clause

**Severity**:
How much a Finding can cost the freelancer: critical (money or ownership at stake) or warning (worth negotiating).
_Avoid_: Priority, risk level

**Resolved**:
A Finding the user has marked as dealt with, so it drops out of the Pushback Email.
_Avoid_: Done, closed, dismissed

**Pushback Email**:
A polite message to the client that asks for changes to the unresolved Findings.
_Avoid_: Redline, counter-offer

**Deal Leverage**:
How firmly the Pushback Email is worded: soft, balanced, or firm.
_Avoid_: Tone, aggression

**Redaction**:
A sensitive value replaced by a placeholder before anything leaves the device.
_Avoid_: Masking, anonymization

**Redacted Text**:
The contract text with all Redactions applied; the only content ever sent for analysis.
_Avoid_: Sanitized text, clean copy

**Analysis**:
The set of Findings for one contract, plus the Traps where nothing was found.
_Avoid_: Report, review
