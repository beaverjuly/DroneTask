from flask import (Blueprint, redirect, render_template, request, session, url_for, current_app)
from .io import write_data, write_metadata

## Initialize blueprint.
bp = Blueprint('experiment', __name__)

# ── Block design ───────────────────────────────────────────────────
# Each block defines: volatility, stochasticity, and valence.
# Order: [block1, block2, block3, block4]
BLOCK_VOL     = [4, 49, 4, 49]
BLOCK_STC     = [16, 16, 64, 64]
BLOCK_VALENCE = ['reward', 'reward', 'loss', 'loss']

# Land assets per valence
LAND_ASSETS = {
    'reward': 'img/task_assets/reward/layer_reward.png',
    'loss':   'img/task_assets/loss/layer_loss.png',
}


def dev_bootstrap_session_from_query():
    """
    DEV ONLY: allow direct entry to /experiment* without going through "/".
    """
    if "workerId" in session:
        return

    is_dev = request.args.get("dev") == "1"

    worker_id = (
        request.args.get("workerId")
        or request.args.get("workerID")
        or request.args.get("PROLIFIC_PID")
    )
    assignment_id = (
        request.args.get("assignmentId")
        or request.args.get("SESSION_ID")
        or ""
    )
    hit_id = (
        request.args.get("hitId")
        or request.args.get("STUDY_ID")
        or ""
    )

    if is_dev and not worker_id:
        worker_id = "dev123"
    if is_dev and not assignment_id:
        assignment_id = "devA"
    if is_dev and not hit_id:
        hit_id = "devH"

    if not worker_id:
        return

    session["workerId"] = worker_id
    session["assignmentId"] = assignment_id
    session["hitId"] = hit_id

    session.setdefault("code_success", current_app.config.get("CODE_SUCCESS", ""))
    session.setdefault("code_reject", current_app.config.get("CODE_REJECT", ""))
    session.setdefault("data", current_app.config.get("DATA_DIR", ""))
    session.setdefault("metadata", current_app.config.get("META_DIR", ""))
    session.setdefault("reject", current_app.config.get("REJECT_DIR", ""))


def _block_params():
    """Return the 4-block condition structure for the frontend."""
    return {
        'block_vol': BLOCK_VOL,
        'block_stc': BLOCK_STC,
        'block_valence': BLOCK_VALENCE,
        'land_assets': {v: LAND_ASSETS[v] for v in set(BLOCK_VALENCE)},
    }


@bp.route('/experiment')
def experiment():
    dev_bootstrap_session_from_query()
    """Present jsPsych experiment to participant."""

    if 'workerId' not in session:
        return redirect(url_for('error.error', errornum=1000))

    elif 'complete' in session:
        session['WARNING'] = "Revisited experiment page."
        write_metadata(session, ['WARNING'], 'a')
        return redirect(url_for('complete.complete'))

    elif 'experiment' in session and not current_app.config.get("DEBUG_ALLOW_REPEAT", True):
        session['ERROR'] = "1004: Revisited experiment."
        session['complete'] = 'error'
        write_metadata(session, ['ERROR', 'complete'], 'a')
        return redirect(url_for('error.error', errornum=1004))

    else:
        session['experiment'] = True
        write_metadata(session, ['experiment'], 'a')

        params = _block_params()

        return render_template(
            'experiment.html',
            workerId=session['workerId'],
            assignmentId=session['assignmentId'],
            hitId=session['hitId'],
            code_success=session['code_success'],
            code_reject=session['code_reject'],
            block_vol=params['block_vol'],
            block_stc=params['block_stc'],
            block_valence=params['block_valence'],
            land_assets=params['land_assets'],
        )


@bp.route('/experiment_noinstr')
def experiment_noinstr():
    dev_bootstrap_session_from_query()
    """Present jsPsych experiment without instructions to participant."""

    if 'workerId' not in session:
        return redirect(url_for('error.error', errornum=1000))

    if 'complete' in session:
        session['WARNING'] = "Revisited experiment page."
        write_metadata(session, ['WARNING'], 'a')
        return redirect(url_for('complete.complete'))

    if 'experiment' in session and not current_app.config.get("DEBUG_ALLOW_REPEAT", True):
        session['ERROR'] = "1004: Revisited experiment."
        session['complete'] = 'error'
        write_metadata(session, ['ERROR', 'complete'], 'a')
        return redirect(url_for('error.error', errornum=1004))

    session['experiment'] = True
    write_metadata(session, ['experiment'], 'a')

    params = _block_params()

    return render_template(
        'experiment_noinstr.html',
        workerId=session['workerId'],
        assignmentId=session['assignmentId'],
        hitId=session['hitId'],
        code_success=session['code_success'],
        code_reject=session['code_reject'],
        block_vol=params['block_vol'],
        block_stc=params['block_stc'],
        block_valence=params['block_valence'],
        land_assets=params['land_assets'],
    )


@bp.route('/experiment', methods=['POST'])
def pass_message():
    """Write jsPsych message to metadata."""
    if request.is_json:
        msg = request.get_json()
        session['MESSAGE'] = msg
        write_metadata(session, ['MESSAGE'], 'a')
    return ('', 200)


@bp.route('/redirect_success', methods=['POST'])
def redirect_success():
    """Save complete jsPsych dataset to disk."""
    print(f"[REDIRECT_SUCCESS] workerId={session.get('workerId')} subId={session.get('subId')}")

    if request.is_json:
        JSON = request.get_json()
        write_data(session, JSON, method='pass')
    session['complete'] = 'success'
    write_metadata(session, ['complete', 'code_success'], 'a')
    return ('', 200)

@bp.route('/redirect_reject', methods=['POST'])
def redirect_reject():
    """Save rejected jsPsych dataset to disk."""
    print(f"[REDIRECT_REJECT] workerId={session.get('workerId')} subId={session.get('subId')}")

    if request.is_json:
        JSON = request.get_json()
        write_data(session, JSON, method='reject')
    session['complete'] = 'reject'
    write_metadata(session, ['complete', 'code_reject'], 'a')
    return ('', 200)


@bp.route('/redirect_error', methods=['POST'])
def redirect_error():
    """Save rejected jsPsych dataset to disk."""
    if request.is_json:
        JSON = request.get_json()
        write_data(session, JSON, method='reject')
    session['complete'] = 'error'
    write_metadata(session, ['complete'], 'a')
    return ('', 200)
