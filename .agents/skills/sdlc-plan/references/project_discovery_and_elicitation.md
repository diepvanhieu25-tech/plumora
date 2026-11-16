# Project Discovery and Elicitation

This guide instructs agents on proactively discovering, gathering, and clarifying project requirements during Step 1.1 of Phase 1, converting high-level ideas or briefs into an authoritative problem dossier.

## 1. 5D Discovery Framework

When receiving a new proposal or feature expansion, investigate across five core dimensions:

| Discovery Dimension | Core Question | Objective |
| --- | --- | --- |
| **1. Vision & Goals** | What core pain point does this project solve? Why is it prioritized now? | Pinpoint business value; eliminate extraneous, unneeded features. |
| **2. Target Persona** | Who is the primary end-user? What is their technical literacy, context, and environment? | Shape UX design, interface density, and prioritized workflows. |
| **3. Core Scope & MVP** | What is strictly required for the initial release (Must-have)? What can be deferred (Nice-to-have)? | Define the Minimum Viable Product (MVP) boundary and prevent scope creep. |
| **4. Constraints** | Are there infrastructure, budget, existing tech-stack, deadline, or compliance restrictions? | Avoid proposing architectural solutions unfeasible with real-world resources. |
| **5. Success Metrics / KPIs** | How will success be measured quantitatively (user adoption, latency budgets, conversion rate, concurrency)? | Establish measurable baselines for Phase 3 verification and acceptance. |

## 2. Elicitation Techniques

1. **Read Before Asking**:
   * Inspect existing source code, documentation, configuration files, and commit logs prior to asking questions. Never query users for facts already established in the repository.
2. **Structured Multiple-Choice Elicitation**:
   * Avoid vague, open-ended questions that impose heavy cognitive burden on users (e.g., *"How do you want the system to work?"*).
   * Package inquiries into **concrete alternatives accompanied by explicit trade-off analyses**:
     * *Example*: *"Regarding customer authentication, which approach fits your requirements: (A - Recommended) Passwordless Email/OTP to maximize conversion, or (B) Traditional Username/Password with optional 2FA for stricter enterprise security?"*
3. **Classifying Ingested Information**:
   * **Facts**: Information explicitly affirmed by the user or authoritative project artifacts $\rightarrow$ Incorporate into baseline requirements.
   * **Assumptions**: Inferences made by the agent based on industry best practices $\rightarrow$ Tag as `ASSUMPTION` and flag for explicit confirmation.
   * **Proposals**: Recommended technical alternatives justified by trade-offs $\rightarrow$ Await user decision before committing to design.

## 3. Discovery Outputs

Upon concluding discovery, synthesize all gathered data into `docs/intent.md` using the [Intent Template](../resources/intent_template.md). Every open question that impacts downstream implementation must remain documented with dependent tasks held in `blocked` status.
