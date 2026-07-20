import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { CategoryPage } from './features/lessons/CategoryPage';
import { LessonsPage } from './features/lessons/LessonsPage';
import { LessonDetailPage } from './features/lessons/LessonDetailPage';
import { ReviewPage } from './features/review/ReviewPage';
import { SearchPage } from './features/search/SearchPage';
import { SettingsPage } from './features/settings/SettingsPage';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="openings" element={<CategoryPage category="Openings" />} />
          <Route path="traps" element={<CategoryPage category="Traps" />} />
          <Route path="middlegame" element={<CategoryPage category="Middlegame" />} />
          <Route path="endgames" element={<CategoryPage category="Endgames" />} />
          <Route path="lessons" element={<LessonsPage />} />
          <Route path="lessons/:id" element={<LessonDetailPage />} />
          <Route path="favorites" element={<CategoryPage category="Favorites" />} />
          <Route path="review" element={<ReviewPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="settings" element={<SettingsPage />} />
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
