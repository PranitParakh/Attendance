import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Setup from './pages/Setup';
import Dashboard from './pages/Dashboard';
import SubjectDetail from './pages/SubjectDetail';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="setup" element={<Setup />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="subject/:subjectName" element={<SubjectDetail />} />
      </Route>
    </Routes>
  );
}

export default App;
