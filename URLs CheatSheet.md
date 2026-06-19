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
your Downloads folder the moment that mini-timeline finishes. **Nothing is
saved to the Pavlovia server by default**, even when the link points at
`run.pavlovia.org`. To force a real save to the Pavlovia server during QA,
add `&pavlovia_save=1`.

The only links that save to Pavlovia automatically are the ones *without*
`dev=1`: the pilot link and the production link, both below.

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
?dev=1&stage=test&block=boundary&consent=0
```

### Full Block: Encoding + Memory

```
?dev=1&stage=encoding-test&block=1&consent=0
?dev=1&stage=encoding-test&block=2&consent=0
```

-----

## PAVLOVIA QA ROUTES

Replace base with: `https://run.pavlovia.org/jiaheyi/DroneTask/`

Same parameters and stages as local — see “Data-saving behavior” above.

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

## Notes

- `consent=0` skips the consent screen regardless of whether
  `static/task/consent.js` is present. Omit it (or use `consent=1`) to
  preview the consent screen.
- If `static/task/consent.js` is missing from the repo entirely, consent
  is skipped automatically — no code change needed either way.
- Full-screen mode is only enforced on the **pilot** and **production**
  links above, plus the full (no-`stage`) dev route. The short QA stage
  routes (`instructions`, `comprehension`, `encoding`, `test`,
  `encoding-test`) never force full screen, so DevTools stay usable.