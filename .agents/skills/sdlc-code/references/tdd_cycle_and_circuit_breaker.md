# Behavioral TDD Cycles & Circuit Breaker Protocol

## Test-Driven Development (TDD) Protocol

For logic changes suitable for TDD:

1. Write test cases following the Arrange-Act-Assert pattern specifying expected behavior or bug reproduction.
2. Run the test harness and verify a **RED** failure for the expected reason. Configuration errors, missing background services, or syntax compilation failures do not prove an absence of business behavior.
3. Implement the minimal code required to satisfy acceptance criteria; re-run tests to achieve **GREEN**.
4. **REFACTOR** for clarity and performance while keeping regression suites passing.

Select appropriate verification strategies for non-logic changes: link integrity for documentation, schema validation for configuration, integration probes for services. Document evidence and limitations; never write redundant tests that merely parrot internal code structures.

## Assertion & SUT Integrity

Keep the System Under Test (SUT) real. External boundaries can be mocked for isolation, but unit mocks do not prove live integration. Never suppress assertions, disable lint rules, or alter acceptance criteria to disguise failures. New tests must be capable of failing when behavior is broken.

## Edit Loop Circuit Breaker

After every failure, inspect terminal evidence and formulate the next hypothesis. Terminate the edit loop immediately when:
- Attempts cycle without observable progress.
- Missing business decisions or ambiguous specifications stall implementation.
- Required permissions are denied by the platform sandbox.
- Task limits or budget thresholds are reached.

Report symptoms, executed commands, exit codes, attempted hypotheses, and blocking decisions. A three-attempt threshold is a project guideline, not an excuse to prolong risky trial-and-error loops.
