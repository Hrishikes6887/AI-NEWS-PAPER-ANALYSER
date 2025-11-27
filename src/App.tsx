import { useState } from 'react';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Analysis from './pages/Analysis';

type Page = 'landing' | 'analysis';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('landing');

  const handleNavigateToAnalysis = () => {
    setCurrentPage('analysis');
  };

  const handleNavigateToLanding = () => {
    setCurrentPage('landing');
  };

  return (
    <Layout showNavbar={currentPage === 'landing'}>
      {currentPage === 'landing' ? (
        <Landing onNavigateToAnalysis={handleNavigateToAnalysis} />
      ) : (
        <Analysis onNavigateToLanding={handleNavigateToLanding} />
      )}
    </Layout>
  );
}

export default App;
