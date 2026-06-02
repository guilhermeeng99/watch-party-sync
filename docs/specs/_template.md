# <Feature> Spec

> **Status**: Draft | In progress | Implemented
> **Last updated**: YYYY-MM-DD
> **Environment**: extension | server | both
> **Coverage**: which sections below are filled in

One-paragraph description: what the feature does, who uses it, and what product problem it
solves.

**Scope decisions**:

- **<decision>**: <what and why>.
- **<decision>**: <what and why>.

---

## 1. Inputs / Outputs

State exactly what goes in and what comes out. For protocol features, include event names and
payloads. For UI features, include user actions and visible states.

| Input | Output | Notes |
|---|---|---|
| <input> | <output> | <notes> |

---

## 2. Contract

Use TypeScript shapes for extension/server contracts.

```ts
type ExampleInput = {
  id: string;
};

type ExampleResult = {
  ok: boolean;
};
```

Document:

- Runtime validation schema.
- Error shape.
- Which layer owns the behavior.
- Which layer is not allowed to know implementation details.

---

## 3. Business Rules

Numbered, testable, unambiguous. Each important rule should become a unit or integration test.

1. **<rule>** - <precise behavior, including failure case>.
2. **<rule>** - <precise behavior, including failure case>.

---

## 4. Options & Defaults

Every user-facing or configuration parameter.

| Option | Type | Values / range | Default | Effect |
|---|---|---|---|---|
| <option> | <type> | <values> | <default> | <effect> |

---

## 5. Permissions & Privacy

- Browser permissions needed.
- Server data received.
- Server data stored.
- Fields explicitly forbidden.
- Logging/redaction requirements.

---

## 6. Performance / Reliability

- Timing guarantees.
- Retry/reconnect behavior.
- Rate limits.
- Memory or CPU concerns.
- Failure modes.

---

## 7. UI States

```text
Idle -> Working -> Done | Error
```

List empty, loading, success, error, reconnecting, unsupported, and permission states.

---

## 8. Edge Cases

| Scenario | Expected behavior |
|---|---|
| Unsupported input | Friendly unsupported state |
| Connection lost | Reconnect and request room snapshot |

---

## 9. Testing Checklist

- [ ] Unit tests for pure helpers.
- [ ] Runtime validation rejects malformed payloads.
- [ ] Permission failures show a user-facing error.
- [ ] Manual happy path.
- [ ] Manual failure path.

---

## 10. Out Of Scope

- <deferred item> - <why deferred or where it belongs later>.
