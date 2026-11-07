import os
import uuid
import json
from flask import (
    Flask, render_template, request, jsonify,
    send_from_directory, redirect
)
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


def _read_doc(doc_id):
    path = doc_path(doc_id)
    if not os.path.exists(path):
        data = {'format': 'vd5', 'version': 1, 'content': ''}
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
        return data
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/editor')
def editor_page():
    doc_id = request.args.get('id') or request.args.get('doc_id')
    if not doc_id or not valid_doc_id(doc_id):
        doc_id = uuid.uuid4().hex
        data = {'format': 'vd5', 'version': 1, 'content': ''}
        with open(doc_path(doc_id), 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
        return redirect('/editor?id=' + doc_id + '&admin=1')

    title = None
    try:
        data = _read_doc(doc_id)
        title = data.get('title') if isinstance(data, dict) else None
    except Exception:
        pass

    return render_template(
        'editor_page.html',
        doc_id=doc_id,
        title=title or 'Документ ' + doc_id[:8]
    )


@app.route('/editor/raw')
def editor_raw():
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


@app.route('/api/new-document', methods=['GET'])
def new_document_redirect():
    doc_id = uuid.uuid4().hex
    data = {'format': 'vd5', 'version': 1, 'content': ''}
    path = doc_path(doc_id)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)
    return redirect('/editor?id=' + doc_id + '&admin=1')


@app.route('/api/documents', methods=['GET'])
def list_documents():
    docs = []
    folder = app.config['DOCS_FOLDER']
    if os.path.isdir(folder):
        for fname in os.listdir(folder):
            if not fname.lower().endswith('.vd5'):
                continue
            path = os.path.join(folder, fname)
            if not os.path.isfile(path):
                continue
            doc_id = fname[:-4]
            if not valid_doc_id(doc_id):
                continue

            info = {'id': doc_id}
            try:
                st = os.stat(path)
                info['size'] = st.st_size
                info['mtime'] = st.st_mtime
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    info['title'] = data.get('title') or data.get('name') or doc_id
                    info['savedAt'] = data.get('savedAt')
            except Exception:
                info['title'] = doc_id

            docs.append(info)

    docs.sort(key=lambda d: d.get('mtime') or 0, reverse=True)
    return jsonify(docs)


@app.route('/api/document', methods=['GET'])
def get_document():
    doc_id = (
        request.args.get('id')
        or request.args.get('doc_id')
        or request.args.get('document_id')
    )
    if doc_id is None:
        doc_id = uuid.uuid4().hex
        data = {'format': 'vd5', 'version': 1, 'content': ''}
        path = doc_path(doc_id)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
        return jsonify({'id': doc_id, 'format': 'vd5', 'version': 1, 'content': ''})

    if not valid_doc_id(doc_id):
        return jsonify({'error': 'invalid id'}), 400

    data = _read_doc(doc_id)
    data['id'] = doc_id
    return jsonify(data)


@app.route('/api/document', methods=['POST'])
def save_document():
    data = request.get_json(silent=True)
    if not data or not isinstance(data.get('content'), str):
        return jsonify({'error': 'invalid payload'}), 400

    doc_id = (
        data.get('id')
        or request.args.get('id')
        or request.args.get('doc_id')
        or request.args.get('document_id')
    )
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


@app.route('/api/document', methods=['DELETE'])
def delete_document():
    doc_id = (
        request.args.get('id')
        or request.args.get('doc_id')
        or request.args.get('document_id')
    )
    if not doc_id or not valid_doc_id(doc_id):
        return jsonify({'error': 'invalid id'}), 400
    path = doc_path(doc_id)
    if os.path.exists(path):
        os.remove(path)
        return jsonify({'ok': True})
    return jsonify({'error': 'not found'}), 404


if __name__ == '__main__':
    print('''
        ⣿⣿⣿⣿⣿⣷⣿⣿⣿⡅⡹⢿⠆⠙⠋⠉⠻⠿⣿⣿⣿⣿⣿⣿⣮⠻⣦⡙⢷⡑⠘⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣌⠡⠌⠂⣙⠻⣛⠻⠷⠐⠈⠛⢱⣮⣷⣽⣿
        ⣿⣿⣿⣿⡇⢿⢹⣿⣶⠐⠁⠀⣀⣠⣤⠄⠀⠀⠈⠙⠻⣿⣿⣿⣦⣵⣌⠻⣷⢝⠦⠚⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⢟⣻⣿⣊⡃⠀⣙⠿⣿⣿⣿⣎⢮⡀⢮⣽⣿⣿
        ⢿⣿⣿⣿⣧⡸⡎⡛⡩⠖⠀⣴⣿⣿⣿⠀⠀⠀⠀⠸⠇⠀⠙⢿⣿⣿⣿⣷⣌⢷⣑⢷⣄⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⣫⠶⠛⠉⠀⠁⠀⠈⠈⠀⠠⠜⠻⣿⣆⢿⣼⣿⣿⣿
        ⢐⣿⣿⣿⣿⣧⢧⣧⢻⣦⢀⣹⣿⣿⣿⣇⠀⠄⠀⠀⠀⡀⠀⠈⢻⣿⣿⣿⣿⣷⣝⢦⡹⠷⡙⢿⣿⣿⣿⣿⣿⣿⣿⣿⠈⠁⠀⠀⠀⠁⠀⠀⠀⠱⣶⣄⡀⠀⠈⠛⠜⣿⣿⣿⣿
        ⠀⠊⢫⣿⣏⣿⡌⣼⣄⢫⡌⣿⣿⣿⣿⣿⣦⡈⠲⣄⣤⣤⡡⢀⣠⣿⣿⣿⣿⣿⣿⣷⣼⣍⢬⣦⡙⣿⣿⣿⣿⣿⣯⢁⡄⠀⡀⡀⠀⠄⢈⣠⢪⠀⣿⣿⣿⣦⠀⢉⢂⠹⡿⣿⣿
        ⠀⠀⠄⢹⢃⢻⣟⠙⣿⣦⠱⢻⣿⣿⣿⣿⣿⣿⣷⣬⣍⣭⣥⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⡙⢿⣼⡿⣿⣿⣿⣿⣿⣷⣄⠘⣱⢦⣤⡴⡿⢈⣼⣿⣿⣿⣇⣴⣶⣮⣅⢻⣿⡏
        ⠀⠀⠈⠹⣇⢡⢿⡆⠻⣿⣷⠀⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣍⡻⣿⣟⣻⣿⣿⣿⣿⣷⣦⣥⣬⣤⣴⣾⣿⣿⣿⣿⣷⣿⣿⣿⣿⣷⡜⠃
        ⠀⠀⠀⢀⣘⠈⢂⠃⣧⡹⣿⣷⡄⠙⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣮⣅⡙⢿⣟⠿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠋⡕⠂
        ⠀⠀⠀⠀⠀⠀⠛⢷⣜⢷⡌⠻⣿⣿⣦⣝⣻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣯⣹⣷⣦⣹⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⠉⠃⠀
        ''')
    app.run(debug=True)
