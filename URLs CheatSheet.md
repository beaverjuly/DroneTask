## Local Base

```
http://localhost:8000/index.html
```

## Pavlovia Base

```
https://run.pavlovia.org/jiaheyi/DroneTask/
```

## Advisor Quick Links

- Full pilot, core only (including consent and data saving):
  <https://run.pavlovia.org/jiaheyi/DroneTask/?pilot=1&mouse_qc=0>
- Full pilot, core + mouse-trajectory QC:
  <https://run.pavlovia.org/jiaheyi/DroneTask/?pilot=1&mouse_qc=1>
- Instructions, practice, and comprehension only:
  <https://run.pavlovia.org/jiaheyi/DroneTask/?dev=1&stage=instructions&consent=0>
- Comprehension check and review loop only:
  <https://run.pavlovia.org/jiaheyi/DroneTask/?dev=1&stage=comprehension&consent=0>

The `dev=1` links download their test CSV locally and do not save data to
Pavlovia. Both full pilot links save to Pavlovia.

-----

## Data-saving

Any link with `dev=1` — local **or** Pavlovia — downloads a CSV straight to
your Downloads folder. **Nothing is saved to the Pavlovia server**, even when
the link points at `run.pavlovia.org`. To force a real save during QA,
add `&pavlovia_save=1`.

Non-dev **pilot** links (`?pilot=1`, or the root URL because pilot mode is the
safe default) and **production** links (`?pilot=0`) save to Pavlovia
automatically.

## Optional mouse-QC switch

`mouse_qc=1` is the only value that enables and loads the optional module.
The flag is default-off: omit it or use `mouse_qc=0` for the independent core
task. Off routes make no requests to `static/task/mouse_qc/`, so the module
directory can be omitted from a core-only deployment.

If a requested module fails to load or build, dev routes stop at a clear
configuration-error screen. Pilot/production routes continue as core-only and
stamp `task_variant=core+mouse-qc-load-failed` in the data.

-----

## LOCAL QA ROUTES (all require `?dev=1&consent=0`)

### Full End-to-End Dev — Core / Mouse-QC Pair

Do not add `ntrials` to these end-to-end checks; the later memory tests require
the complete encoding data.

```text
http://localhost:8000/index.html?dev=1&stage=full&latin_group=0&consent=0&mouse_qc=0
http://localhost:8000/index.html?dev=1&stage=full&latin_group=0&consent=0&mouse_qc=1
```

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

### Full Block: Encoding + Memory (Fast Integrated Pair)

```
?dev=1&stage=encoding-test&block=1&latin_group=0&consent=0&mouse_qc=0
?dev=1&stage=encoding-test&block=1&latin_group=0&consent=0&mouse_qc=1
```

With `mouse_qc=1`, the module runs after the block's memory portion.

### Mouse-QC Module Only

```text
?dev=1&stage=mouse-test&consent=0&mouse_qc=1
```

Aliases: `stage=mouse`, `stage=mouse-qc`, and `stage=mouse-trajectory`.
The module-only route requires the explicit `mouse_qc=1` flag.

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

### Local Full Experiment Pilot — Core / Mouse-QC Pair

```text
http://localhost:8000/index.html?pilot=1&mouse_qc=0
http://localhost:8000/index.html?pilot=1&mouse_qc=1
```

### Pavlovia Pilot — Core / Mouse-QC Pair

Researcher testing; both save to Pavlovia and do not redirect to Prolific.

```text
https://run.pavlovia.org/jiaheyi/DroneTask/?pilot=1&mouse_qc=0
https://run.pavlovia.org/jiaheyi/DroneTask/?pilot=1&mouse_qc=1
```

### Pavlovia Root (pilot mode by default)

```
https://run.pavlovia.org/jiaheyi/DroneTask/
```

### Pavlovia Production — Core / Mouse-QC Pair

Real participants; requires configured Prolific codes.

```text
https://run.pavlovia.org/jiaheyi/DroneTask/?pilot=0&mouse_qc=0
https://run.pavlovia.org/jiaheyi/DroneTask/?pilot=0&mouse_qc=1
```

-----

## Counterbalancing for small pilot groups

With `?pilot=1` alone, all participants fall through to a timestamp-based
hash for Latin-square assignment (pseudo-random, not balanced). For a
controlled N = 10 pilot, assign groups manually:

```
?pilot=1&latin_group=0    ← give to participants 1–2
?pilot=1&latin_group=1    ← give to participants 3–4
?pilot=1&latin_group=2    ← give to participants 5–7
?pilot=1&latin_group=3    ← give to participants 8–10
```

Or give each person a unique `subId` for deterministic (but pseudo-random)
assignment:

```
?pilot=1&subId=alice
```

-----

## Notes

- Consent is required on pilot and production routes. `consent=0` only skips
  the consent screen when paired with `dev=1`; omit it (or use `consent=1`)
  to preview the consent screen in dev mode.
- If `static/task/consent.js` is missing or fails to load, pilot and
  production runs stop at a blocking configuration screen.
- Full-screen mode is only enforced on **pilot** and **production** links,
  plus the full (no-`stage`) dev route. Short QA stage routes never force
  full screen, so DevTools stay usable.
