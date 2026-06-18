## Local Base

```
http://localhost:8000/index.html
```

## Pavlovia Base

```
https://run.pavlovia.org/jiaheyi/DroneTask/
```

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

### Termination Screen Only

```
?dev=1&stage=termination&consent=0
```

-----

## PAVLOVIA QA ROUTES

Replace base with: `https://run.pavlovia.org/jiaheyi/DroneTask/`

Same parameters as local:

```
?dev=1&stage=comprehension&consent=0
?dev=1&stage=test&block=1&consent=0
?dev=1&stage=encoding-test&block=2&consent=0
```

Pavlovia force-save:

```
?dev=1&stage=test&block=1&pavlovia_save=1&consent=0
```

-----

## PRODUCTION / PILOT

### Local Full Experiment Pilot

```
http://localhost:8000/index.html?pilot=1&consent=0
```

### Pavlovia Pilot (Researcher Testing)

```
https://run.pavlovia.org/jiaheyi/DroneTask/?pilot=1&consent=0
```

### Pavlovia Production (Real Participants)

```
https://run.pavlovia.org/jiaheyi/DroneTask/
```

