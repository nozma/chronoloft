import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    // バックエンドのAPIエンドポイントへリクエストを送信
    fetch('http://127.0.0.1:5000/api/hello')
      .then((response) => response.json())
      .then((data) => setMessage(data.message))
      .catch((error) => console.error('Error fetching API:', error));
  }, []);

  return (
    <div>
      <h1>Activity Tracker</h1>
      <p>バックエンドからのメッセージ: {message}</p>
    </div>
  );
}

export default App
