import React from 'react';
import { useSystemCore } from './hooks/useSystemCore';
import { TopBar } from './components/Common/TopBar';
import { StartPage } from './pages/StartPage';
import { DayPage } from './pages/DayPage';
// import { OverviewPage } from './pages/OverviewPage';

export const AppRouter: React.FC = () => {
    const { isDayActive } = useSystemCore();
    const active = isDayActive();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <TopBar />
            <main style={{ flexGrow: 1, position: 'relative' }}>
                {/* Simple conditional routing for MVP without react-router overhead right now, 
            or we can add react-router-dom if needed. The original used react-router-dom v7.
            Let's stick to simple conditional or just add react-router.
        */}
                {active ? <DayPage /> : <StartPage />}
            </main>
        </div>
    );
};
