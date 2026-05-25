import React from 'react';
import { useSystemCore } from '../hooks/useSystemCore';
import { Button } from '../components/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';

export const StartPage: React.FC = () => {
    const { startDay } = useSystemCore();

    return (
        <div style={{ padding: '4rem 2rem', maxWidth: 800, margin: '0 auto', textAlign: 'center' }} className="animate-fade-in">
            <h1 className="text-gradient" style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>Qualia Control</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginBottom: '4rem' }}>
                The system is inactive. Ready to begin your day.
            </p>

            <Button size="lg" onClick={() => startDay()} style={{ padding: '1rem 3rem', fontSize: '1.2rem' }}>
                Comenzar Día
            </Button>

            <Card variant="glass" style={{ marginTop: '4rem', textAlign: 'left' }}>
                <CardHeader>
                    <CardTitle>Yesterday's Summary</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>No previous data available yet.</p>
                </CardContent>
            </Card>
        </div>
    );
};
