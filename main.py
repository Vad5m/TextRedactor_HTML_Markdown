import os
import uuid
import json
from flask import Flask, render_template, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename

app = Flask(__name__, static_folder='data', static_url_path='/data')

UPLOAD_FOLDER = os.path.join('data', 'upload')
DOCS_FOLDER = os.path.join('data', 'docs')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DOCS_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['DOCS_FOLDER'] = DOCS_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024

DOC_NAME = 'document'


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


@app.route('/api/document', methods=['GET'])
def get_document():
    path = os.path.join(app.config['DOCS_FOLDER'], DOC_NAME + '.vd5')
    if not os.path.exists(path):
        return jsonify({'format': 'vd5', 'version': 1, 'content': ''})
    with open(path, 'r', encoding='utf-8') as f:
        return jsonify(json.load(f))


@app.route('/api/document', methods=['POST'])
def save_document():
    data = request.get_json(silent=True)
    if not data or not isinstance(data.get('content'), str):
        return jsonify({'error': 'invalid payload'}), 400
    path = os.path.join(app.config['DOCS_FOLDER'], DOC_NAME + '.vd5')
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, path)
    return jsonify({'ok': True})


if __name__ == '__main__':
    app.run(debug=True)
