import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

function Hello() {
  return (
    <button style={{ fontSize: '200%' }}
      onClick={() => {
        window.electron.ipcRenderer.sendMessage('splitImage');
      }}
    >Click here</button>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
      </Routes>
    </Router>
  );
}
