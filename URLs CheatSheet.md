## Local Base

```
http://localhost:8000/index.html
```

## Pavlovia Base

```
https://run.pavlovia.org/jiaheyi/DroneTask/
```

-----

## Data-saving

Any link with `dev=1` — local **or** Pavlovia — downloads a CSV straight to
your Downloads folder. **Nothing is saved to the Pavlovia server**, even when
the link points at `run.pavlovia.org`. To force a real save during QA,
add `&pavlovia_save=1`.

Only **pilot** (`?pilot=1`) and **production** (no params) links save to
Pavlovia automatically.

-----

## LOCAL QA ROUTES (all require `?dev=1&consent=0`)

### Instructions + Comprehension

```
?dev=1&stage=instructions&consent=0
```

### Comprehension Only

```
?dev=1&stage=comprehension&consent=0
```

### 5 Encoding Trials Only

```
?dev=1&stage=encoding&block=1&ntrials=5&consent=0
?dev=1&stage=encoding&block=2&ntrials=5&consent=0
```

### Memory Test Only (Seeded)

```
?dev=1&stage=test&block=1&consent=0
?dev=1&stage=test&block=2&consent=0
```

### Full Block: Encoding + Memory

```
?dev=1&stage=encoding-test&block=1&consent=0
?dev=1&stage=encoding-test&block=2&consent=0
```

### Survey / Demographics Only

```
?dev=1&stage=survey&consent=0
?dev=1&stage=demographics&consent=0
```

-----

## PAVLOVIA QA ROUTES

Replace base with: `https://run.pavlovia.org/jiaheyi/DroneTask/`

Same parameters and stages as local.

### Force a real Pavlovia save during QA

```
?dev=1&stage=test&block=1&pavlovia_save=1&consent=0
```

-----

## PRODUCTION / PILOT

### Local Full Experiment Pilot

```
http://localhost:8000/index.html?pilot=1&consent=0
```

### Pavlovia Pilot (researcher testing — saves to Pavlovia, no Prolific redirect)

```
https://run.pavlovia.org/jiaheyi/DroneTask/?pilot=1&consent=0
```

### Pavlovia Production (real participants)

```
https://run.pavlovia.org/jiaheyi/DroneTask/
```

-----

## Counterbalancing for small pilot groups

With `?pilot=1` alone, all participants fall through to a timestamp-based
hash for Latin-square assignment (pseudo-random, not balanced). For a
controlled N = 10 pilot, assign groups manually:

```
?pilot=1&latin_group=0&consent=0    ← give to participants 1–2
?pilot=1&latin_group=1&consent=0    ← give to participants 3–4
?pilot=1&latin_group=2&consent=0    ← give to participants 5–7
?pilot=1&latin_group=3&consent=0    ← give to participants 8–10
```

Or give each person a unique `subId` for deterministic (but pseudo-random)
assignment:

```
?pilot=1&subId=alice&consent=0
```

-----

## Notes

- `consent=0` skips the consent screen. Omit it (or use `consent=1`) to
  preview the consent screen.
- If `static/task/consent.js` is missing from the repo entirely, consent
  is skipped automatically.
- Full-screen mode is only enforced on **pilot** and **production** links,
  plus the full (no-`stage`) dev route. Short QA stage routes never force
  full screen, so DevTools stay usable.