# Context-Driven UI Design & Anti-Slop Rules

Preserve established design systems and user aesthetic preferences. When authorized design assets are available, align components, tokens, and interactions; Design MCP tools do not automatically guarantee visual harmony.

- Handle all 5 UI interactive states: Ideal, Loading, Empty, Error, and Disabled; apply appropriate interaction patterns rather than forcing uniform spinners onto every element. Success confirmations and partial results are additional feedback states when relevant.
- Define explicit accessibility (`a11y`) standards: sequential keyboard navigation, visible focus rings, screen reader labels, and contrast ratios (WCAG AA). Colors in design templates do not prove accessibility compliance.
- Select typography, icons, palettes, and animations proportional to application context; avoid blanket bans on specific colors or decorative elements.
- When interaction patterns remain ambiguous, create prototypes for user sign-off before implementing dependent UI code.

The [Design Tokens Template](../resources/design_tokens_template.json) illustrates structure; it is not pre-approved styling. Verify live interfaces across viewport sizes and color modes supported by the project.

## Interaction Matrix & Verification Checkpoints

Map screens/components $\rightarrow$ user actions $\rightarrow$ API contracts $\rightarrow$ loading/success/error states $\rightarrow$ recovery paths. For example, editing an appointment that encounters a concurrent conflict should preserve unsaved form inputs, render clear explanations, and provide a refresh button; never automatically retry and overwrite new server data.

Audit happy paths via keyboard navigation, empty states, error responses, hydration states, and responsive breakpoints. Record accessibility standards and test commands; a color token definition does not prove complete UI compliance. When multiple interaction patterns affect business workflows, the user decides before dependent implementation begins.
