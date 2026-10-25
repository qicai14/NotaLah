# Testing rules (Ch 4.5, 5.3, 5.4)

## Unit test cases

- At least **10 test cases per module** (`TC1`-`TC10`) covering blank, invalid and valid input.
- Columns: TC ID · Test description · Test data · Expected outcome · Actual outcome · Pass/Fail.
- **Chapter 4.5:** Actual outcome and Pass/Fail left blank.
- **Chapter 5.3:** filled in from real runs.
- **Bug loop:** when a case fails, record the failure, fix the code, and add the re-test as the
  next number (e.g. `TC1` fail → fix → `TC11` pass). Examiners look for this as evidence of
  debugging, so keep genuine failures rather than hiding them.

Map automated tests to these IDs (e.g. test names prefixed `TC3:`) so the report tables can be
filled straight from test output.

## UAT

- At least **3 target users** matching personas: Student, Lecturer, Admin.
- Record name, position, date, start/end time.
- Score 1-5 on four categories: Objectives Met, Performance, Security, Error-Free.
- Record **tester feedback** and the **developer response**. For negative feedback: fix,
  re-test with the same user, and document both iterations.
- End with a synthesis of all UAT feedback.
- NFR5: re-evaluate ranking weights (especially w1 engagement and w4 relevance) using UAT
  findings, and report the outcome.

## Objective-linked measurements

Each IR objective needs a measured result for Chapter 6 — notably search latency under
3 seconds (FR5/NFR1). Capture timings in tests, not by eye.
