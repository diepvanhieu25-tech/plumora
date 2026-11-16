# External Adapter Pattern for Boundary Isolation

Used to isolate third-party SDKs, normalize vendor-specific exceptions into domain errors, and facilitate test doubles. Respect existing architectures; wrapping every library in an extra abstraction layer is not universally mandatory.

```typescript
export interface PaymentGateway {
  charge(orderId: string): Promise<{ transactionId: string }>;
}
```

Encapsulate vendor-specific client invocations and error mapping at the infrastructure boundary. Explicitly define timeouts, retry policies, and idempotency guarantees; never retry financial transactions blindly.

Verify domain logic using lightweight test doubles (fakes/stubs); execute integration tests against authorized vendor sandboxes. Swapping third-party providers often shifts data semantics, error structures, and IAM permissions; avoid promising that changing a single adapter class completely eliminates vendor migration complexity.
