import random, string

from flask import Flask, request, jsonify

app = Flask(__name__)

def gen_code(N):
    """Generate random completion code."""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=N))
