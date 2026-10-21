from app import create_app

app = create_app()
app.config['LAN_PORT'] = 5173

if __name__ == '__main__':
    app.run(debug=True)
