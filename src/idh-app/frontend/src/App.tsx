import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard/Dashboard';
import ProjectPage from './pages/Project/ProjectPage';
import NewProjectPage from './pages/NewProject/NewProjectPage';
import GlobalSettingsPage from './pages/GlobalSettings/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects/new" element={<NewProjectPage />} />
        <Route path="/projects/:groupId/*" element={<ProjectPage />} />
        <Route path="/settings" element={<GlobalSettingsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
