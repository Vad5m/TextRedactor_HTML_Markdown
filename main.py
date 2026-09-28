from flask import Flask, render_template

app = Flask(__name__, static_folder='data', static_url_path='/data')

@app.route('/')
def index():
    return render_template('text_redactor.html')

if __name__ == '__main__':
    app.run(debug=True)
