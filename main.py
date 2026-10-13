import os
import uuid
import json
from flask import Flask, render_template, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename

app = Flask(__name__, static_folder='data', static_url_path='/data')

UPLOAD_FOLDER = os.path.join('data', 'upload')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024


@app.route('/')
def index():
    return render_template('text_redactor.html')


@app.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'no file'}), 400
    f = request.files['file']
    if not f.filename:
        return jsonify({'error': 'empty filename'}), 400

    original = secure_filename(f.filename)
    ext = os.path.splitext(original)[1].lower()
    unique = uuid.uuid4().hex + ext
    save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique)
    f.save(save_path)

    return jsonify({
        'url': '/data/upload/' + unique,
        'name': f.filename,
        'size': os.path.getsize(save_path),
        'type': f.mimetype
    })


@app.route('/data/upload/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


if __name__ == '__main__':
    app.run(debug=True)
