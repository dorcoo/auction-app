import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// 문제가 된 import './index.css' 줄을 삭제했습니다.

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)