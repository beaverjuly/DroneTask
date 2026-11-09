# Published learning benchmark

`Piray2024_learning_benchmark.json` contains aggregate reference values for
Piray and Daw's 2024 paper, DOI `10.1038/s41467-024-53459-z`.

The reference was recomputed from both experiments in the authors' repository
at commit `71121dc4ca34aee35c619a6e9cb380a18d0411e3`. Each participant's four
OLS learning slopes were fitted from `data.mat` and checked against the saved
`model_neutral.mat` values. Maximum absolute disagreement was below `1.7e-15`.
The JSON records original file hashes, source links, factor mapping and checks.
No participant records or identifiers are bundled.

The diagonal contrast is highVol plus lowSto minus lowVol plus highSto.
Intervals use 10,000 participant bootstrap resamples with seed `20261108`.
Fixed series geometry uses population standard deviations with `ddof=0` for
both the published and Pilot1 arrays. Previously quoted sample SDs of 3.87 and
7.74 correspond to approximately 3.83 and 7.66 under this consistent convention.

Normal notebook execution uses this aggregate reference offline. It does not
download data or depend on the temporary source checkout used for verification.
The intended Pilot1 jump process differs from the published random walk, and
the reference is a descriptive benchmark without an automatic replication gate.
