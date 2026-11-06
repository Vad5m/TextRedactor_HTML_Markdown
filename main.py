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


def doc_path(doc_id):
    return os.path.join(app.config['DOCS_FOLDER'], doc_id + '.vd5')


def valid_doc_id(doc_id):
    return bool(doc_id) and all(c.isalnum() or c in ('-', '_') for c in doc_id)


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


@app.route('/api/new', methods=['POST'])
def new_document():
    doc_id = uuid.uuid4().hex
    data = {'format': 'vd5', 'version': 1, 'content': ''}
    path = doc_path(doc_id)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)
    return jsonify({'id': doc_id})


@app.route('/api/document', methods=['GET'])
def get_document():
    doc_id = request.args.get('id') or request.args.get('doc_id') or request.args.get('document_id')
    if doc_id is None:
        doc_id = uuid.uuid4().hex
        data = {'format': 'vd5', 'version': 1, 'content': ''}
        path = doc_path(doc_id)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
        return jsonify({'id': doc_id, 'format': 'vd5', 'version': 1, 'content': ''})
    if not valid_doc_id(doc_id):
        return jsonify({'error': 'invalid id'}), 400
    path = doc_path(doc_id)
    if not os.path.exists(path):
        data = {'format': 'vd5', 'version': 1, 'content': ''}
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
        return jsonify({'id': doc_id, 'format': 'vd5', 'version': 1, 'content': ''})
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    data['id'] = doc_id
    return jsonify(data)


@app.route('/api/document', methods=['POST'])
def save_document():
    data = request.get_json(silent=True)
    if not data or not isinstance(data.get('content'), str):
        return jsonify({'error': 'invalid payload'}), 400
    doc_id = data.get('id') or request.args.get('id') or request.args.get('doc_id') or request.args.get('document_id')
    if not doc_id:
        doc_id = uuid.uuid4().hex
        data['id'] = doc_id
    if not valid_doc_id(doc_id):
        return jsonify({'error': 'invalid id'}), 400
    path = doc_path(doc_id)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, path)
    return jsonify({'ok': True, 'id': doc_id})


if __name__ == '__main__':
    app.run(debug=True)
