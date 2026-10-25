"""Analyze the optional memory screen without mixing it into main task outcomes.

Raw exports are preferred. Each raw file is split in its own temporary
directory, retaining same-day sessions that the standard clean-file prefix
cannot otherwise distinguish. Tables and exported audits use ordinal session
labels rather than participant identifiers.
"""
from __future__ import annotations

import contextlib
import hashlib
import importlib.util
import io
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
ANALYSIS_ROOT = ROOT / "analysis"
DATA_ROOT = ANALYSIS_ROOT / "data"
TABLE_SUFFIXES = {
    "metadata": "_metadata.csv",
    "encoding": "_memory_screening_encoding.csv",
    "order": "_memory_screening_order.csv",
    "summary": "_memory_screening_summary.csv",
}
OUTCOME_ORDER = ["complete_pass", "complete_fail", "interrupted",
                 "configuration_error", "unverifiable", "data_issue",
                 "assignment_unknown", "not_requested"]


def truth(value):
    """CSV-safe optional boolean, preserving missing as unknown."""
    if value is None or pd.isna(value):
        return None
    text = str(value).strip().lower()
    if text in {"true", "1", "1.0"}:
        return True
    if text in {"false", "0", "0.0"}:
        return False
    return None


def number(value):
    try:
        answer = float(value)
        return answer if np.isfinite(answer) else np.nan
    except (TypeError, ValueError):
        return np.nan


def scalar(frame, name, default=None):
    if name not in frame:
        return default
    values = frame[name].dropna()
    return values.iloc[-1] if len(values) else default


def json_value(value, default=None):
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except (ValueError, TypeError):
        return default


def _read_tables(directory, session_key):
    tables = {}
    for table, suffix in TABLE_SUFFIXES.items():
        matches = list(Path(directory).glob("*" + suffix))
        if len(matches) > 1:
            raise ValueError("More than one split table for one raw session")
        if matches:
            frame = pd.read_csv(matches[0])
            frame["_session_key"] = session_key
            tables[table] = frame
    return tables


def load_screen_data(raw_dir=None, clean_dir=None, mode="auto"):
    """Return session-separated raw or clean tables, never both at once.

    `auto` uses raw CSV files if any exist, otherwise clean tables. By default
    it discovers memory-only and shared full-task raw exports and ignores exact
    file copies. `raw_dir` can be one directory or a sequence of directories.
    Select `clean` explicitly when the raw collection is incomplete. Source
    paths stay internal and are never included in public report tables.
    """
    if mode not in {"auto", "raw", "clean"}:
        raise ValueError("mode must be auto, raw, or clean")
    if raw_dir is None:
        raw_dirs = [DATA_ROOT / "memory_screen/raw", DATA_ROOT / "drone_task/raw"]
    elif isinstance(raw_dir, (str, Path)):
        raw_dirs = [Path(raw_dir)]
    else:
        raw_dirs = [Path(directory) for directory in raw_dir]
    clean_dir = Path(clean_dir or DATA_ROOT / "memory_screen/clean")
    raw_files, seen_content, duplicate_raw_copies = [], set(), 0
    for directory in raw_dirs:
        for source in sorted(directory.rglob("*.csv")) if directory.exists() else []:
            try:
                digest = hashlib.sha256(source.read_bytes()).hexdigest()
            except OSError:
                # The per-session parser records read failures in the source
                # inventory rather than letting deduplication discard them.
                digest = None
            if digest is not None and digest in seen_content:
                duplicate_raw_copies += 1
                continue
            if digest is not None:
                seen_content.add(digest)
            raw_files.append(source)
    use_raw = mode == "raw" or (mode == "auto" and bool(raw_files))
    frames = {table: [] for table in TABLE_SUFFIXES}
    sources = []
    if use_raw:
        # Import by file so this helper runs from its own folder, the repository
        # root, or any notebook working directory without a sibling path guess.
        spec = importlib.util.spec_from_file_location("drone_task_splitter", ANALYSIS_ROOT / "split_drone_data.py")
        splitter = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(splitter)
        for source in raw_files:
            try:
                key = "raw/" + source.resolve().relative_to(ROOT).as_posix()
            except ValueError:
                key = "raw/" + source.resolve().as_posix()
            error = None
            try:
                with tempfile.TemporaryDirectory() as temporary:
                    with contextlib.redirect_stdout(io.StringIO()):
                        splitter.process_one(str(source), temporary)
                    for table, frame in _read_tables(temporary, key).items():
                        frames[table].append(frame)
            except Exception as exc:
                # Report a failed file as a source/session problem rather than
                # silently dropping it from the inventory.
                error = type(exc).__name__
            sources.append({"_session_key": key, "load_error": error})
    else:
        groups = {}
        for table, suffix in TABLE_SUFFIXES.items():
            for source in sorted(clean_dir.rglob("*" + suffix)) if clean_dir.exists() else []:
                relative = source.relative_to(clean_dir).as_posix()
                key = "clean/" + relative[:-len(suffix)]
                groups.setdefault(key, {})[table] = source
        for key, files in sorted(groups.items()):
            error = None
            for table, source in files.items():
                try:
                    frame = pd.read_csv(source)
                    frame["_session_key"] = key
                    frames[table].append(frame)
                except Exception as exc:
                    error = type(exc).__name__
            sources.append({"_session_key": key, "load_error": error})
    result = {table: pd.concat(values, ignore_index=True) if values else pd.DataFrame()
              for table, values in frames.items()}
    result["sources"] = pd.DataFrame(sources, columns=["_session_key", "load_error"])
    result["mode"] = "raw" if use_raw else "clean"
    result["duplicate_raw_copies"] = duplicate_raw_copies
    return result


def runtime_design():
    """Read the live task design, rather than copying its trajectory in Python."""
    exporter = ROOT / "design_checks/scripts/export_memory_screen.cjs"
    if not exporter.exists():
        raise FileNotFoundError("The live memory screen design exporter is missing")
    return json.loads(subprocess.check_output(["node", str(exporter)], text=True, cwd=ROOT))["screen"]


def _session_frame(data, table, key):
    frame = data.get(table, pd.DataFrame())
    return frame[frame["_session_key"].eq(key)].copy() if "_session_key" in frame else pd.DataFrame()


def _ids(frame, preferred, fallback=None):
    field = preferred if preferred in frame else fallback
    return pd.to_numeric(frame[field], errors="coerce") if field in frame else pd.Series(np.nan, index=frame.index)


def _question_row(row, studied_images=None):
    """Recompute correctness from the visual answer key, never saved accuracy."""
    issues = []
    first, second = number(row.get("item1_trial")), number(row.get("item2_trial"))
    left, right = row.get("left_img"), row.get("right_img")
    earlier_image = None
    serials_valid = (np.isfinite(first) and np.isfinite(second) and first.is_integer() and
                     second.is_integer() and 1 <= first < second <= 20)
    expected_images = []
    if not serials_valid:
        issues.append("invalid_pair_serial_positions")
    else:
        earlier_image = (studied_images or {}).get(int(first))
        if earlier_image is None:
            earlier_image = row.get("item1_img")
        if isinstance(earlier_image, str) and isinstance(row.get("true_first_img"), str) and earlier_image != row["true_first_img"]:
            issues.append("recorded_first_item_mismatch")
        for serial, image_field in [(first, "item1_img"), (second, "item2_img")]:
            studied = (studied_images or {}).get(int(serial))
            if studied is not None and studied != row.get(image_field):
                issues.append("question_item_differs_from_encoding")
            expected_images.append(studied if studied is not None else row.get(image_field))
    display_valid = (len(expected_images) == 2 and all(isinstance(image, str) for image in expected_images)
        and len(set(expected_images)) == 2 and isinstance(left, str) and isinstance(right, str)
        and set([left, right]) == set(expected_images))
    if serials_valid and not display_valid:
        issues.append("displayed_pair_does_not_match_encoding")
    if isinstance(earlier_image, str) and earlier_image == left and earlier_image != right:
        correct_side = "left"
    elif isinstance(earlier_image, str) and earlier_image == right and earlier_image != left:
        correct_side = "right"
    else:
        correct_side = None
        issues.append("answer_key_unverifiable")
    if correct_side and row.get("correct_side") != correct_side:
        issues.append("recorded_answer_key_mismatch")
    timed_out = truth(row.get("timed_out"))
    side = row.get("order_choice_side")
    answered = side in {"left", "right"}
    if timed_out is None:
        issues.append("timeout_flag_missing")
    if timed_out and answered:
        issues.append("choice_with_final_timeout")
    if not answered and timed_out is False:
        issues.append("no_choice_without_final_timeout")
    key_valid = bool(serials_valid and display_valid and correct_side)
    correct = int(answered and not timed_out and side == correct_side) if key_valid and timed_out is not None else np.nan
    saved_correct = number(row.get("order_correct_bin"))
    if np.isfinite(correct) and np.isfinite(saved_correct) and correct != saved_correct:
        issues.append("recorded_accuracy_mismatch")
    raw_attempts = row.get("order_attempts_json")
    attempts = json_value(raw_attempts)
    history_present = raw_attempts is not None and not (isinstance(raw_attempts, float) and np.isnan(raw_attempts))
    if history_present and (not isinstance(attempts, list) or any(not isinstance(a, dict) for a in attempts)):
        issues.append("invalid_attempt_history")
    attempts = [a for a in attempts if isinstance(a, dict)] if isinstance(attempts, list) else []
    any_timeout = truth(row.get("had_timeout"))
    if any_timeout is None:
        any_timeout = bool(timed_out or any(a.get("timed_out") is True for a in attempts))
    return dict(pair_index=number(row.get("pair_index")), item1_trial=first,
        item2_trial=second, serial_gap=second-first,
        item1_concept=row.get("item1_concept", Path(str(row.get("item1_img", "unknown"))).stem),
        item2_concept=row.get("item2_concept", Path(str(row.get("item2_img", "unknown"))).stem),
        correct_side=correct_side, answer_key_valid=key_valid, correct=correct, answered=answered,
        final_timeout=timed_out, any_timeout=any_timeout,
        rt_ms=number(row.get("order_rt")) if answered else np.nan,
        total_duration_ms=number(row.get("order_total_duration_ms")),
        issues="; ".join(issues))


def _geometry(enc, summary, expected, series_version):
    result = {"geometry_rows": len(enc), "saved_geometry_matches": None,
              "current_geometry_matches": None, "constant_step_contract": None,
              "movement_log_matches": None, "summary_motion_matches": None,
              "n_left": np.nan, "n_right": np.nan, "residual_sd": np.nan,
              "residual_mean": np.nan, "mean_abs_residual": np.nan,
              "max_abs_residual": np.nan, "supply_n_left": np.nan,
              "supply_n_right": np.nan, "supply_n_zero": np.nan,
              "supply_balance_contract": None, "offset_magnitude_contract": None,
              "supply_log_matches": None, "summary_supply_matches": None,
              "drone_visibility_matches": None}
    issues = []
    if not len(enc):
        return result, issues
    order = _ids(enc, "screening_trial", "trial")
    enc = enc.assign(_serial=order).sort_values("_serial")
    drone = pd.to_numeric(enc.get("drone_position", pd.Series(np.nan, index=enc.index)), errors="coerce").to_numpy()
    bag = pd.to_numeric(enc.get("bag_position", pd.Series(np.nan, index=enc.index)), errors="coerce").to_numpy()
    residual = bag - drone
    if np.isfinite(residual).all():
        result.update(residual_sd=float(np.std(residual)), residual_mean=float(np.mean(residual)),
                      mean_abs_residual=float(np.mean(np.abs(residual))),
                      max_abs_residual=float(np.max(np.abs(residual))),
                      supply_n_left=int(np.sum(residual < 0)),
                      supply_n_right=int(np.sum(residual > 0)),
                      supply_n_zero=int(np.sum(residual == 0)))
    expected_drone = json_value(scalar(summary, "memory_screening_drone_positions_json"))
    expected_bag = json_value(scalar(summary, "memory_screening_bag_positions_json"))
    if isinstance(expected_drone, list) and isinstance(expected_bag, list):
        try:
            stored_x = np.asarray(expected_drone, dtype=float)
            stored_y = np.asarray(expected_bag, dtype=float)
            arrays_valid = stored_x.shape == stored_y.shape == (20,) and np.isfinite(stored_x).all() and np.isfinite(stored_y).all()
        except (ValueError, TypeError):
            arrays_valid = False
        valid = order.notna().all() and order.between(1, 20).all() and order.mod(1).eq(0).all()
        if not arrays_valid:
            issues.append("invalid_saved_geometry_arrays")
        elif valid:
            indices = enc["_serial"].astype(int).to_numpy() - 1
            match = np.allclose(drone, stored_x[indices], equal_nan=False) and np.allclose(
                bag, stored_y[indices], equal_nan=False)
            result["saved_geometry_matches"] = bool(match)
            if not match:
                issues.append("encoding_differs_from_saved_geometry")
    if expected and series_version == expected.get("series_version"):
        expected_visible = expected.get("drone_visible")
        visibility = enc.get("screening_drone_visible", pd.Series(None, index=enc.index, dtype=object))
        result["drone_visibility_matches"] = bool(
            all(truth(value) is expected_visible for value in visibility) and
            truth(scalar(summary, "memory_screening_drone_visible")) is expected_visible)
        if not result["drone_visibility_matches"]:
            issues.append("drone_visibility_metadata_mismatch_or_missing")
        indices = enc["_serial"].to_numpy()
        valid = np.isfinite(indices).all() and np.all(indices == indices.astype(int)) and np.all((indices >= 1) & (indices <= 20))
        if valid:
            indices = indices.astype(int)-1
            match = np.allclose(drone, np.asarray(expected["drone_positions"])[indices], equal_nan=False) and np.allclose(
                bag, np.asarray(expected["bag_positions"])[indices], equal_nan=False)
            result["current_geometry_matches"] = bool(match)
            if not match:
                issues.append("encoding_differs_from_current_version_geometry")
        if len(enc) == 20 and enc["_serial"].tolist() == list(range(1, 21)):
            baseline = expected["drone_initial_position"]
            steps = np.diff(np.r_[baseline, drone])
            result.update(n_left=int(np.sum(steps < 0)), n_right=int(np.sum(steps > 0)))
            equal = np.allclose(np.abs(steps), expected["drone_step_size"])
            result["constant_step_contract"] = bool(equal and result["n_left"] == result["n_right"] == 10)
            if not result["constant_step_contract"]:
                issues.append("constant_step_direction_contract_failed")
        prefix = enc["_serial"].tolist() == list(range(1, len(enc)+1))
        motion_fields = ["screening_drone_start_position", "screening_drone_step",
                         "screening_drone_direction", "screening_drone_animation_duration_ms"]
        if prefix and np.isfinite(drone).all() and all(field in enc for field in motion_fields):
            actual_starts = np.r_[expected["drone_initial_position"], drone[:-1]]
            actual_steps = drone - actual_starts
            starts = pd.to_numeric(enc[motion_fields[0]], errors="coerce").to_numpy()
            steps = pd.to_numeric(enc[motion_fields[1]], errors="coerce").to_numpy()
            directions = np.where(actual_steps < 0, "left", "right")
            duration = pd.to_numeric(enc[motion_fields[3]], errors="coerce").to_numpy()
            result["movement_log_matches"] = bool(np.allclose(starts, actual_starts) and
                np.allclose(steps, actual_steps) and np.array_equal(enc[motion_fields[2]].to_numpy(), directions)
                and np.allclose(duration, expected.get("drone_animation_duration_ms", 450))
                and enc.get("screening_drone_step_metric", pd.Series(None, index=enc.index, dtype=object))
                    .eq(expected.get("drone_step_metric")).all())
            if not result["movement_log_matches"]:
                issues.append("per_trial_movement_metadata_mismatch")
        if prefix and len(enc) == 20 and len(summary) == 1:
            baseline = number(scalar(summary, "memory_screening_drone_initial_position"))
            step_size = number(scalar(summary, "memory_screening_drone_step_size"))
            saved_directions = json_value(scalar(summary, "memory_screening_drone_directions_json"))
            if np.isfinite(baseline) and np.isfinite(step_size) and isinstance(saved_directions, list):
                actual_steps = np.diff(np.r_[baseline, drone])
                result["summary_motion_matches"] = bool(baseline == expected["drone_initial_position"] and
                    step_size == expected["drone_step_size"] and np.allclose(np.abs(actual_steps), step_size) and
                    np.array_equal(np.sign(actual_steps), saved_directions) and
                    scalar(summary, "memory_screening_drone_step_metric") == expected.get("drone_step_metric"))
                if not result["summary_motion_matches"]:
                    issues.append("summary_movement_metadata_mismatch")
            else:
                issues.append("summary_movement_metadata_missing")
        # Supply contracts are version-specific. Earlier materials may have
        # variable offsets and are still checked against their saved arrays.
        offset_size = number(expected.get("supply_offset_size"))
        if np.isfinite(offset_size) and offset_size > 0:
            complete_geometry = (len(enc) == 20 and
                enc["_serial"].tolist() == list(range(1, 21)) and np.isfinite(residual).all())
            if complete_geometry:
                result["supply_balance_contract"] = bool(
                    result["supply_n_left"] == result["supply_n_right"] == 10 and
                    result["supply_n_zero"] == 0)
                result["offset_magnitude_contract"] = bool(
                    np.allclose(np.abs(residual), offset_size, rtol=0, atol=1e-8))
                if not result["supply_balance_contract"]:
                    issues.append("supply_side_balance_contract_failed")
                if not result["offset_magnitude_contract"]:
                    issues.append("supply_offset_magnitude_contract_failed")
            supply_fields = ["screening_supply_side", "screening_supply_offset_size"]
            if np.isfinite(residual).all() and all(field in enc for field in supply_fields):
                recorded_size = pd.to_numeric(enc[supply_fields[1]], errors="coerce").to_numpy()
                actual_sides = np.where(residual < 0, "left", np.where(residual > 0, "right", "center"))
                result["supply_log_matches"] = bool(
                    np.array_equal(enc[supply_fields[0]].to_numpy(), actual_sides) and
                    np.allclose(recorded_size, offset_size, rtol=0, atol=1e-8) and
                    np.allclose(recorded_size, np.abs(residual), rtol=0, atol=1e-8))
                if not result["supply_log_matches"]:
                    issues.append("per_trial_supply_metadata_mismatch")
            else:
                issues.append("per_trial_supply_metadata_missing")
            if complete_geometry and len(summary) == 1:
                recorded_size = number(scalar(summary, "memory_screening_supply_offset_size"))
                recorded_directions = json_value(scalar(summary, "memory_screening_supply_directions_json"))
                recorded_metric = scalar(summary, "memory_screening_supply_offset_metric")
                try:
                    direction_array = np.asarray(recorded_directions, dtype=float)
                    directions_valid = direction_array.shape == (20,) and np.isfinite(direction_array).all()
                except (ValueError, TypeError):
                    directions_valid = False
                if np.isfinite(recorded_size) and directions_valid and recorded_metric is not None:
                    result["summary_supply_matches"] = bool(
                        np.isclose(recorded_size, offset_size, rtol=0, atol=1e-8) and
                        np.array_equal(direction_array, np.sign(residual)) and
                        np.allclose(np.abs(residual), recorded_size, rtol=0, atol=1e-8) and
                        recorded_metric == expected.get("supply_offset_metric"))
                    if not result["summary_supply_matches"]:
                        issues.append("summary_supply_metadata_mismatch")
                else:
                    issues.append("summary_supply_metadata_missing_or_invalid")
    if "screening_wind_offset" in enc:
        offsets = pd.to_numeric(enc["screening_wind_offset"], errors="coerce").to_numpy()
        if not np.allclose(residual, offsets, equal_nan=False):
            issues.append("saved_wind_offset_mismatch")
    return result, issues


def analyze_screen_data(data, expected=None):
    """Audit every available session, retaining technical and missing outcomes."""
    sessions, question_rows, geometry_rows = [], [], []
    sources = data.get("sources", pd.DataFrame())
    for ordinal, (_, source) in enumerate(sources.iterrows(), 1):
        key = source["_session_key"]
        label = f"S{ordinal:04d}"
        meta, enc, order, summary = [_session_frame(data, table, key)
                                      for table in ["metadata", "encoding", "order", "summary"]]
        issues = []
        load_error = source.get("load_error")
        has_load_error = isinstance(load_error, str) and bool(load_error)
        reported = lambda name, default=None: scalar(summary, name, scalar(meta, name, default))
        request_flag = truth(reported("memory_screening_requested"))
        evidence = bool(len(enc) or len(order) or len(summary))
        assigned = request_flag is True or evidence
        if request_flag is False and evidence:
            issues.append("screen_rows_despite_not_requested_flag")
        if has_load_error:
            issues.append("source_load_error_" + load_error)
        if len(meta) > 1:
            issues.append("multiple_metadata_rows")
        if len(summary) > 1:
            issues.append("multiple_screen_summaries")
        series = reported("memory_screening_series_version", scalar(enc, "screening_series_version", "unknown"))
        module = reported("memory_screening_version", scalar(enc, "memory_screening_version", "unknown"))
        item_version = reported("memory_screening_item_version", scalar(enc, "screening_item_version", "unknown"))
        enc_ids = _ids(enc, "screening_trial", "trial")
        order_ids = _ids(order, "pair_index", "screening_pair_index")
        enc_ids_valid = enc_ids.tolist() and sorted(enc_ids.tolist()) == list(range(1, 21))
        order_ids_valid = order_ids.tolist() and sorted(order_ids.tolist()) == list(range(1, 11))
        if len(enc) and not (enc_ids.notna().all() and enc_ids.between(1, 20).all() and enc_ids.mod(1).eq(0).all()):
            issues.append("invalid_encoding_serials")
        duplicate_enc = int(enc_ids.dropna().duplicated().sum())
        duplicate_order = int(order_ids.dropna().duplicated().sum())
        if duplicate_enc:
            issues.append("duplicate_encoding_serials")
        if duplicate_order:
            issues.append("duplicate_question_ids")
        completion_available = "completed" in enc and enc["completed"].notna().all()
        n_completed = int(enc["completed"].map(number).eq(1).sum()) if completion_available else np.nan
        if len(enc) and not completion_available:
            issues.append("encoding_completion_not_exported")
        rows = []
        studied_images = {}
        if "stim_img" in enc and not duplicate_enc:
            studied_images = {int(serial): image for serial, image in zip(enc_ids, enc.stim_img)
                              if np.isfinite(serial) and serial == int(serial)}
        for _, row in order.iterrows():
            question = _question_row(row, studied_images)
            rows.append(question)
            if question["issues"]:
                issues.extend(question["issues"].split("; "))
            question_rows.append(dict(session=label, module_version=module, series_version=series,
                                      item_version=item_version, **question))
        valid_key = len(rows) == 10 and all(q["answer_key_valid"] and np.isfinite(q["correct"]) and
            "invalid_pair_serial_positions" not in q["issues"] and "question_item_differs_from_encoding" not in q["issues"] for q in rows)
        endpoints = sorted([serial for row in rows for serial in [row["item1_trial"], row["item2_trial"]]])
        coverage_valid = endpoints == list(range(1, 21))
        if order_ids_valid and not coverage_valid:
            issues.append("question_endpoint_coverage_invalid")
        protocol_complete = bool(enc_ids_valid and order_ids_valid and n_completed == 20 and valid_key and coverage_valid)
        n_correct = int(sum(q["correct"] for q in rows)) if order_ids_valid and valid_key else np.nan
        recomputed_pass = bool(n_correct >= 6) if protocol_complete else None
        saved_status = reported("memory_screening_status", "unknown")
        saved_pass = truth(reported("memory_screening_passed"))
        saved_correct = number(reported("memory_screening_n_correct"))
        if np.isfinite(n_correct) and np.isfinite(saved_correct) and n_correct != saved_correct:
            issues.append("saved_correct_count_mismatch")
        if len(summary) and recomputed_pass is not None and saved_pass != recomputed_pass:
            issues.append("saved_pass_mismatch")
        if len(summary) and recomputed_pass is not None and saved_status != ("passed" if recomputed_pass else "failed"):
            issues.append("saved_status_mismatch")
        if len(summary) and number(reported("memory_screening_min_correct")) != 6:
            issues.append("saved_threshold_mismatch")
        if len(summary) and np.isfinite(n_completed) and number(reported("memory_screening_n_encoding_completed")) != n_completed:
            issues.append("saved_encoding_count_mismatch")
        if len(summary) and number(reported("memory_screening_n_pairs")) != 10:
            issues.append("saved_pair_count_mismatch")
        asset_status = str(reported("memory_screening_asset_status", ""))
        config_error = saved_status == "configuration_error" or (
            request_flag is True and any(word in asset_status for word in ["failed", "error", "unavailable"]))
        if has_load_error:
            status = "data_issue"
        elif not assigned:
            status = "not_requested" if request_flag is False else "assignment_unknown"
        elif config_error:
            status = "configuration_error"
        elif duplicate_enc or duplicate_order or len(summary) > 1 or any(issue in issues for issue in [
            "invalid_encoding_serials", "invalid_pair_serial_positions", "question_item_differs_from_encoding",
            "displayed_pair_does_not_match_encoding", "question_endpoint_coverage_invalid"]):
            status = "data_issue"
        elif len(enc) and not completion_available:
            status = "unverifiable"
        elif not len(summary):
            status = "interrupted"
        elif protocol_complete:
            status = "complete_pass" if recomputed_pass else "complete_fail"
        elif any("unverifiable" in issue for issue in issues):
            status = "unverifiable"
        else:
            status = "data_issue"
        geometry, geometry_issues = _geometry(enc, summary, expected, series)
        issues.extend(geometry_issues)
        geometry_rows.append(dict(session=label, series_version=series, **geometry))
        sessions.append(dict(session=label, assigned=assigned, requested_flag=request_flag,
            status=status, saved_status=saved_status, saved_pass=saved_pass,
            protocol_complete=protocol_complete, recomputed_pass=recomputed_pass,
            n_encoding=len(enc), n_encoding_completed=n_completed, n_questions=len(order),
            n_correct=n_correct, saved_n_correct=saved_correct,
            n_final_timeouts=sum(q["final_timeout"] is True for q in rows),
            n_any_timeouts=sum(q["any_timeout"] is True for q in rows),
            duplicate_encoding_rows=duplicate_enc, duplicate_question_rows=duplicate_order,
            module_version=module, series_version=series, item_version=item_version,
            input_mode=data.get("mode"), n_issues=len(set(issues)),
            issues="; ".join(sorted(set(issues)))))
    session_columns = ["session", "assigned", "requested_flag", "status", "saved_status", "saved_pass",
        "protocol_complete", "recomputed_pass", "n_encoding", "n_encoding_completed", "n_questions",
        "n_correct", "saved_n_correct", "n_final_timeouts", "n_any_timeouts", "duplicate_encoding_rows",
        "duplicate_question_rows", "module_version", "series_version", "item_version", "input_mode", "n_issues", "issues"]
    session_df = pd.DataFrame(sessions, columns=session_columns)
    questions = pd.DataFrame(question_rows)
    complete_labels = set(session_df.loc[session_df.status.isin(["complete_pass", "complete_fail"]), "session"])
    if len(questions):
        questions["complete_session"] = questions.session.isin(complete_labels)
    outcome = pd.DataFrame({"status": OUTCOME_ORDER})
    outcome["n_sessions"] = outcome.status.map(session_df.status.value_counts()).fillna(0).astype(int)
    assigned_n = int(session_df.assigned.sum())
    assigned_counts = session_df.loc[session_df.assigned.eq(True), "status"].value_counts()
    outcome["n_assigned"] = outcome.status.map(assigned_counts).fillna(0).astype(int)
    outcome["fraction_of_assigned"] = np.where(
        outcome.status.isin(["not_requested", "assignment_unknown"]), np.nan,
        outcome.n_assigned / assigned_n if assigned_n else np.nan)
    complete = session_df[session_df.status.isin(["complete_pass", "complete_fail"])]
    complete_n = len(complete)
    pass_n = int(complete.status.eq("complete_pass").sum())
    rates = pd.DataFrame([
        {"measure": "Available sessions", "numerator": len(session_df), "denominator": len(session_df)},
        {"measure": "Assigned or observed screen", "numerator": assigned_n, "denominator": len(session_df)},
        {"measure": "Complete screen among assigned", "numerator": complete_n, "denominator": assigned_n},
        {"measure": "Passed among assigned", "numerator": pass_n, "denominator": assigned_n},
        {"measure": "Passed among complete", "numerator": pass_n, "denominator": complete_n},
        {"measure": "Assigned sessions with audit issues", "numerator": int((session_df.assigned & session_df.n_issues.gt(0)).sum()), "denominator": assigned_n},
    ])
    rates["fraction"] = rates.numerator.div(rates.denominator.replace(0, np.nan))
    issue_counts = session_df.issues.str.split("; ").explode()
    issue_counts = issue_counts[issue_counts.ne("") & issue_counts.notna()].value_counts().rename_axis("issue").reset_index(name="n_sessions")
    version = session_df.loc[session_df.assigned.eq(True)].groupby(["module_version", "series_version", "item_version"], dropna=False).agg(
        n_assigned=("session", "size"), n_complete=("status", lambda values: values.isin(["complete_pass", "complete_fail"]).sum()),
        n_pass=("status", lambda values: values.eq("complete_pass").sum())).reset_index()
    eligible = questions[questions.complete_session] if len(questions) else pd.DataFrame()
    versions = ["module_version", "series_version", "item_version"]
    pair = _question_aggregate(eligible, versions + ["item1_trial", "item2_trial", "serial_gap"])
    gap = _question_aggregate(eligible, versions + ["serial_gap"])
    items = []
    if len(eligible):
        for position in [1, 2]:
            part = eligible.copy()
            part["concept"] = part[f"item{position}_concept"]
            items.append(part)
    item = _question_aggregate(pd.concat(items, ignore_index=True) if items else pd.DataFrame(), versions + ["concept"])
    if "accuracy" in item:
        item = item.rename(columns={"accuracy": "pair_accuracy_involving_item"})
    return dict(sessions=session_df, outcomes=outcome, rates=rates, audit_issues=issue_counts,
                versions=version, questions=questions, pair_performance=pair,
                gap_performance=gap, item_performance=item,
                geometry=pd.DataFrame(geometry_rows), mode=data.get("mode"))


def _question_aggregate(frame, grouping):
    if not len(frame):
        return pd.DataFrame(columns=grouping+["n_sessions", "n_questions", "n_correct", "accuracy",
            "final_timeout_rate", "any_timeout_rate", "median_answered_rt_ms", "median_total_duration_ms"])
    return frame.groupby(grouping, dropna=False).agg(n_sessions=("session", "nunique"),
        n_questions=("correct", "size"), n_correct=("correct", "sum"), accuracy=("correct", "mean"),
        final_timeout_rate=("final_timeout", "mean"), any_timeout_rate=("any_timeout", "mean"),
        median_answered_rt_ms=("rt_ms", "median"), median_total_duration_ms=("total_duration_ms", "median")).reset_index()


def plot_report(report):
    """Create aggregate figures only when participant observations exist."""
    import matplotlib.pyplot as plt
    if not len(report["sessions"]) or not report["sessions"].assigned.any():
        return []
    figures = []
    outcomes = report["outcomes"]
    shown = outcomes[outcomes.status.ne("not_requested") & outcomes.status.ne("assignment_unknown")]
    fig, axes = plt.subplots(1, 2, figsize=(12, 4.5), layout="constrained")
    axes[0].barh(shown.status.str.replace("_", " "), shown.n_sessions, color="#52748a")
    axes[0].invert_yaxis()
    axes[0].set(xlabel="Sessions", title="Every assigned screen remains in the denominator")
    complete = report["sessions"][report["sessions"].status.isin(["complete_pass", "complete_fail"])]
    axes[1].hist(complete.n_correct, bins=np.arange(-.5, 11.5), color="#37785e", edgecolor="white")
    axes[1].axvline(5.5, ls="--", color="#a3652d", label="6 correct criterion")
    axes[1].set(xlabel="Correct answers out of 10", ylabel="Complete sessions", xticks=range(11),
                title="Complete screens only")
    axes[1].legend(frameon=False)
    figures.append(("screen_outcomes", fig))
    gap = report["gap_performance"]
    if len(gap):
        fig, axes = plt.subplots(1, 2, figsize=(11, 4), layout="constrained")
        for versions, part in gap.groupby(["module_version", "series_version", "item_version"]):
            label = " / ".join(versions)
            axes[0].plot(part.serial_gap, part.accuracy, "o-", label=label)
            axes[1].plot(part.serial_gap, part.median_answered_rt_ms, "o-", label=label)
        axes[0].set(xlabel="Serial gap", ylabel="Accuracy including final omissions", ylim=(0, 1))
        axes[1].set(xlabel="Serial gap", ylabel="Median answered response time in ms")
        axes[0].legend(frameon=False)
        fig.suptitle("Descriptive question performance by material version")
        figures.append(("screen_question_performance", fig))
    return figures


def export_report(report, output_dir):
    """Write audits to an ignored data folder without source identifiers."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for table, frame in report.items():
        if isinstance(frame, pd.DataFrame):
            destination = output_dir / f"{table}.csv"
            frame.to_csv(destination, index=False)
            paths.append(destination.name)
    return paths
