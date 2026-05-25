import React from 'react';
import { useSystemCore } from '../../hooks/useSystemCore';
import { Button } from '../Button';
import { ActivityLibraryModal } from '../../modals/ActivityLibraryModal';
import { TimeBlockModal } from '../../modals/TimeBlockModal';
import { SubjectiveVariablesModal } from '../../modals/SubjectiveVariablesModal';
import { EventModal } from '../../modals/EventModal';

export const TopBar: React.FC = () => {
    const { isDayActive, endDay } = useSystemCore();
    const [isLibraryOpen, setIsLibraryOpen] = React.useState(false);
    const [isTimeBlockOpen, setIsTimeBlockOpen] = React.useState(false);
    const [isSubjectiveOpen, setIsSubjectiveOpen] = React.useState(false);
    const [isEventOpen, setIsEventOpen] = React.useState(false);

    return (
        <header className="glass-panel" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 2rem',
            margin: '1rem',
            position: 'sticky',
            top: '1rem',
            zIndex: 100,
            borderRadius: 'var(--radius-full)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-tertiary))'
                }} />
                <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>Qualia</h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {isDayActive() ? (
                    <>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontSize: '0.9rem' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 10px var(--success)' }} />
                            Día Activo
                        </span>
                        <Button variant="secondary" size="sm" onClick={() => setIsLibraryOpen(true)}>+ Add Activity</Button>
                        <Button variant="secondary" size="sm" onClick={() => setIsSubjectiveOpen(true)}>Log State</Button>
                        <Button variant="secondary" size="sm" onClick={() => setIsEventOpen(true)}>Log Event</Button>
                        <Button variant="secondary" size="sm" onClick={() => setIsTimeBlockOpen(true)}>Manage Blocks</Button>
                        <Button variant="danger" size="sm" onClick={() => endDay()}>Finalizar Día</Button>
                    </>
                ) : (
                    <>
                        <Button variant="ghost" size="sm" onClick={() => setIsLibraryOpen(true)}>Temario</Button>
                        <Button variant="ghost" size="sm" onClick={() => setIsTimeBlockOpen(true)}>Manage Blocks</Button>
                        <span style={{ color: 'var(--text-muted)' }}>Inactivo</span>
                    </>
                )}
            </div>

            <ActivityLibraryModal isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} />
            <TimeBlockModal isOpen={isTimeBlockOpen} onClose={() => setIsTimeBlockOpen(false)} />
            <SubjectiveVariablesModal isOpen={isSubjectiveOpen} onClose={() => setIsSubjectiveOpen(false)} />
            <EventModal isOpen={isEventOpen} onClose={() => setIsEventOpen(false)} />
        </header>
    );
};
