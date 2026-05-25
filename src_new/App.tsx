import React from 'react';
import { SystemProvider } from './ui/context/SystemProvider';
import { AppRouter } from './ui/AppRouter';

function App() {
    return (
        <SystemProvider>
            <AppRouter />
        </SystemProvider>
    );
}

export default App;
