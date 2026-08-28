# Synthetic Customer Architecture Note

Fixture ID: `s1-identity-key-v1`
Document revision: `2019-04-10`
Source role: customer-supplied design claim

The `legacy_patient.patient_num` column is the global, non-null patient identifier.
Use `patient_num` as the source key in every downstream patient mapping.

This note is deliberately stale and unverified. It is synthetic test evidence, not clinical guidance.
